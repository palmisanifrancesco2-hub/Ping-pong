"""Reproducible historical benchmark; no new independent/operational claim."""
import os
os.environ.setdefault('OMP_NUM_THREADS','2');os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
import json,hashlib,time,platform,sys
from pathlib import Path
from datetime import datetime,timezone
from collections import defaultdict
import numpy as np
from scipy.sparse import csr_matrix
from scipy.special import expit
import scipy,sklearn,joblib
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier,RandomForestClassifier
from advanced_benchmark import nested_split,choose_shrink,metrics
from projection_ensemble import paired_interval
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data'
P=json.loads((ROOT/'research/protocol-v16-benchmark.json').read_text())
stamp=lambda s:int(datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def matrix(rows,key):return np.asarray([r[key] for r in rows],dtype=float)


def fit(kind,rows,param):
    x=matrix(rows,'x');y=matrix(rows,'y')
    if kind=='random-forest':return RandomForestClassifier(**P['fixed'][kind],**param,random_state=P['seed']).fit(x,y.astype(int))
    models=[]
    for j in range(y.shape[1]):
        if len(np.unique(y[:,j]))<2:models.append(float(y[:,j].mean()));continue
        model=make_pipeline(StandardScaler(),LogisticRegression(**P['fixed'][kind],**param,random_state=P['seed'])) if kind=='logistic' else HistGradientBoostingClassifier(**P['fixed'][kind],**param,random_state=P['seed'])
        models.append(model.fit(x,y[:,j]))
    return models


def predict(kind,model,rows):
    x=matrix(rows,'x')
    if kind=='random-forest':return np.column_stack([values[:,list(classes).index(1)] if 1 in classes else np.zeros(len(rows)) for values,classes in zip(model.predict_proba(x),model.classes_)])
    return np.column_stack([np.full(len(rows),m) if isinstance(m,float) else m.predict_proba(x)[:,1] for m in model])


def bt_fit(results,cutoff,c):
    eligible=[r for r in results if stamp(r['availableAt'])<cutoff and max(sum(a>b for a,b in r['sets']),sum(a<b for a,b in r['sets']))==3]
    players=sorted({(r['league'],r[side]) for r in eligible for side in ['home','away']});index={v:i for i,v in enumerate(players)}
    rr=[];cc=[];vv=[];y=[]
    for i,r in enumerate(eligible):
        rr.extend([i,i]);cc.extend([index[r['league'],r['home']],index[r['league'],r['away']]]);vv.extend([1,-1]);y.append(int(r['homeWon']))
    x=csr_matrix((vv,(rr,cc)),shape=(len(eligible),len(players)))
    model=LogisticRegression(C=c,fit_intercept=False,max_iter=1000,random_state=P['seed']).fit(x,y)
    return {'strengths':dict(zip(players,model.coef_[0])),'trainingMatches':len(eligible),'C':c}


def bt_predict(model,rows,byid):
    s=model['strengths'];out=[]
    for r in rows:
        m=byid[r['id']];out.append(float(expit(s.get((m['league'],m['home']),0)-s.get((m['league'],m['away']),0))))
    return np.asarray(out)


def main():
    output=ROOT/'research/report-v16-benchmark.json'
    if output.exists():raise RuntimeError('Do not overwrite inspected benchmark')
    fp=ROOT/P['input'];rp=ROOT/P['results']
    if sha(fp)!=P['inputHash'] or sha(rp)!=P['resultsHash']:raise RuntimeError('Changed dataset')
    features=json.loads(fp.read_text());raw=json.loads(rp.read_text());rows=features['rows'];targets=features['targets'];byid={r['id']:r for r in raw['results']}
    if features['inputHash']!=sha(rp) or len({r['id'] for r in rows})!=len(rows):raise RuntimeError('Input provenance or duplicate IDs')
    for r in rows:
        m=byid[r['id']];sets=m['sets'];ha=sum(a>b for a,b in sets);aw=len(sets)-ha;a=sum(a for a,b in sets);b=sum(b for a,b in sets)
        y=[int(m['homeWon']),int(sets[0][0]>sets[0][1]),int(sum(sets[0])>19.5),int(len(sets)>3.5),int(len(sets)>4.5),int(a+b>74.5),int(a+b>79.5),int(a+b>84.5),int(ha-aw>1.5),int(ha-aw>-1.5),int(a-b>5.5),int(a-b>-5.5),int(a-b>9.5),int(a-b>-9.5)]
        if r['y']!=y or not r['featuresAvailable']<r['at']<r['available']:raise RuntimeError('Inconsistent/noncausal row')
    predictions=defaultdict(list);tested=[];folds=[];artifacts=[];selected=[];runstart=time.monotonic();starts=list(map(stamp,P['foldStarts']));finalend=stamp(P['endExclusive'])
    for i,start in enumerate(starts):
        end=starts[i+1] if i+1<len(starts) else finalend
        train,tune,refit,cal,test=nested_split(rows,start,end,P)
        test=[r for r in test if r['available']<finalend]
        info={'start':start,'end':end,'train':len(train),'tuning':len(tune),'refit':len(refit),'calibration':len(cal),'test':len(test)}
        if len(train)<P['minimumTraining'] or len(tune)<P['minimumTuning'] or len(cal)<P['minimumCalibration'] or not test:folds.append({**info,'skipped':True});continue
        info['models']={};cy=matrix(cal,'y');ty=matrix(tune,'y');basecal=matrix(cal,'baseline');base=matrix(test,'baseline');foldcal={};foldtest={}
        for kind in ['hierarchical-eb','logistic','hist-gradient-boosting','random-forest']:
            begin=time.monotonic();chosen=None
            if kind=='hierarchical-eb':rawcal=matrix(cal,'eb');rawtest=matrix(test,'eb');models=None
            else:
                grid=P['parameterGrid'][kind];trained=[fit(kind,train,param) for param in grid];tuned=[predict(kind,model,tune) for model in trained];loss=np.asarray([np.mean((p-ty)**2,axis=0) for p in tuned]);chosen=np.argmin(loss,axis=0)
                # Refit each configuration on all eligible data before calibration day.
                models=[fit(kind,refit,param) for param in grid];cp=[predict(kind,model,cal) for model in models];tp=[predict(kind,model,test) for model in models]
                rawcal=np.column_stack([cp[k][:,j] for j,k in enumerate(chosen)]);rawtest=np.column_stack([tp[k][:,j] for j,k in enumerate(chosen)])
            weights=choose_shrink(rawcal,basecal,cy,P['shrinkWeights']);pc=basecal+weights*(rawcal-basecal);pt=base+weights*(rawtest-base)
            foldcal[kind]=pc;foldtest[kind]=pt;predictions[kind].append(pt)
            info['models'][kind]={'selectedParameterIndexPerTarget':chosen.tolist() if chosen is not None else None,'calibrationWeights':weights.tolist(),'trainPredictSeconds':time.monotonic()-begin}
            if models is not None:
                path=DATA/f'advanced-v16-fold-{i}-{kind}.joblib'
                if path.exists():raise RuntimeError('Private artifact exists')
                joblib.dump({'models':models,'selection':chosen,'calibrationWeights':weights,'protocol':P,'targets':targets,'validated':False},path);os.chmod(path,0o600);artifacts.append({'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size})
        btstart=time.monotonic();cutoff=start-2*86400000;calcut=start-86400000
        btmodels=[bt_fit(raw['results'],cutoff,param['C']) for param in P['parameterGrid']['bradley-terry-winner']]
        bt_losses=[float(np.mean((bt_predict(model,tune,byid)-ty[:,0])**2)) for model in btmodels];best=int(np.argmin(bt_losses));bt=bt_fit(raw['results'],calcut,P['parameterGrid']['bradley-terry-winner'][best]['C'])
        rawcal=bt_predict(bt,cal,byid)[:,None];rawtest=bt_predict(bt,test,byid)[:,None];weights=choose_shrink(rawcal,basecal[:,:1],cy[:,:1],P['shrinkWeights']);pc=basecal[:,:1]+weights*(rawcal-basecal[:,:1]);pt=base[:,:1]+weights*(rawtest-base[:,:1])
        predictions['bradley-terry-winner'].append(pt);info['models']['bradley-terry-winner']={'C':bt['C'],'trainingMatches':bt['trainingMatches'],'players':len(bt['strengths']),'calibrationWeights':weights.tolist(),'trainPredictSeconds':time.monotonic()-btstart}
        foldcal['bradley-terry-winner']=pc;foldtest['bradley-terry-winner']=pt
        path=DATA/f'advanced-v16-fold-{i}-bradley-terry.joblib';joblib.dump({'model':bt,'weight':weights,'validated':False},path);os.chmod(path,0o600);artifacts.append({'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size})
        decisions=[];selector=[]
        for j in range(len(targets)):
            eligible=[k for k in foldcal if j==0 or k!='bradley-terry-winner'];winner=min(eligible,key=lambda k:np.mean((foldcal[k][:,0 if k=='bradley-terry-winner' else j]-cy[:,j])**2));decisions.append(winner);selector.append(foldtest[winner][:,0 if winner=='bradley-terry-winner' else j])
        selected.append(np.column_stack(selector));info['validationSelectedFamilyPerTarget']=decisions;tested.extend(test);folds.append(info)
        print(json.dumps({'phase':'nested_fold','start':start,'train':len(train),'tuning':len(tune),'refit':len(refit),'calibration':len(cal),'test':len(test),'seconds':round(time.monotonic()-runstart,2)}),flush=True)
    pooled={name:np.concatenate(values) for name,values in predictions.items()};y=matrix(tested,'y');base=matrix(tested,'baseline');elo=expit(matrix(tested,'x')[:,0]*np.log(10));selection=np.concatenate(selected);markets=[]
    for j,target in enumerate(targets):
        cs=[]
        for name,values in pooled.items():
            if name=='bradley-terry-winner' and j!=0:continue
            p=values[:,0 if name=='bradley-terry-winner' else j];comparators={'league':base[:,j]}
            if j==0:comparators['elo']=elo
            intervals={key:paired_interval(tested,(p-y[:,j])**2-(reference-y[:,j])**2,P) for key,reference in comparators.items()}
            leagues={league:metrics(y[np.asarray([r['league']==league for r in tested]),j],p[np.asarray([r['league']==league for r in tested])]) for league in sorted({r['league'] for r in tested})}
            cs.append({'name':name,'metrics':metrics(y[:,j],p),'perCompetition':leagues,'pairedBrierDifference':intervals})
        markets.append({'target':target,'reference':metrics(y[:,j],base[:,j]),'eloReference':metrics(y[:,j],elo) if j==0 else None,'candidates':cs,'validationSelector':metrics(y[:,j],selection[:,j]),'operationalWinner':None})
    report={'version':P['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'protocol':P,'n':len(tested),'observedDays':len({r['at']//86400000 for r in tested}),'folds':folds,'markets':markets,'artifacts':artifacts,'totalSeconds':time.monotonic()-runstart,'dataset':{'featuresHash':sha(fp),'resultsHash':sha(rp),'closingHash':features['closingHash'],'features':len(rows[0]['x']),'targets':targets},'environment':{'python':sys.version.split()[0],'numpy':np.__version__,'scipy':scipy.__version__,'sklearn':sklearn.__version__,'joblib':joblib.__version__,'platform':platform.platform()},'independentValidation':False,'operationallyValidated':False,'automaticPromotion':False,'oddsEnhancedBenchmark':'Separate as-of quote subset required; this main comparison is sports-only.','roi':None}
    with output.open('x') as file:json.dump(report,file,indent=2,allow_nan=False);file.write('\n')
    audit={'ids':[r['id'] for r in tested],'at':[r['at'] for r in tested],'y':y.tolist(),'predictions':{k:v.tolist() for k,v in pooled.items()},'selector':selection.tolist(),'reportHash':sha(output)}
    with (DATA/'advanced-v16-audit.json').open('x') as file:os.chmod(file.fileno(),0o600);json.dump(audit,file,allow_nan=False)
    print(json.dumps({'phase':'completed','cases':len(tested),'targets':len(markets),'seconds':report['totalSeconds'],'artifacts':len(artifacts)}),flush=True)


if __name__=='__main__':main()
