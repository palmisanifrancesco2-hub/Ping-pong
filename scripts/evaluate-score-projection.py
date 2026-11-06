"""Exploratory chronological benchmark; no new prospective outcomes are opened."""
import os
os.environ.setdefault('OMP_NUM_THREADS','2')
os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
import json,hashlib,time
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from scipy.stats import poisson
from sklearn.linear_model import PoissonRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from score_projection import TARGETS,projection_grid,fit_point_model,projection_predict,project_point_probability

ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data'
P=json.loads((ROOT/'research/protocol-v11.json').read_text())
DAY=86400000
stamp=lambda s:int(datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def metrics(y,p):
    p=np.clip(p,1e-9,1-1e-9);correct=int(np.sum(((p>.5).astype(int)==y)&(p!=.5)));undecided=int(np.sum(p==.5));ece=0
    for i in range(5):
        mask=np.minimum(4,(p*5).astype(int))==i
        if mask.any():ece+=abs(float((p[mask]-y[mask]).sum()))/len(y)
    return{'n':len(y),'brier':float(((p-y)**2).mean()),'logLoss':float(-(y*np.log(p)+(1-y)*np.log(1-p)).mean()),'ece':ece,'correct':correct,'wrong':len(y)-correct-undecided,'undecided':undecided}


def paired_interval(rows,loss):
    hours=np.asarray([r['at'] for r in rows],dtype=np.int64)//DAY;hours-=hours.min();span=int(hours.max())+1
    sums=np.bincount(hours,weights=loss,minlength=span);counts=np.bincount(hours,minlength=span)
    if (counts>0).sum()<7:return{'lower':None,'upper':None,'days':int((counts>0).sum())}
    bs=np.convolve(sums,np.ones(3),'valid');bn=np.convolve(counts,np.ones(3),'valid');rng=np.random.default_rng(20261105)
    chosen=rng.integers(0,len(bs),size=(P['bootstrapReplicates'],int(np.ceil(span/3))))
    n=bn[chosen].sum(axis=1);values=bs[chosen].sum(axis=1)[n>0]/n[n>0]
    alpha=.05/P['familyComparisons'];lo,hi=np.quantile(values,[alpha/2,1-alpha/2])
    return{'lower':float(lo),'upper':float(hi),'days':int((counts>0).sum()),'blockDays':3,'familyComparisons':P['familyComparisons']}


def split(rows,start):
    cal=start-2*DAY
    return([r for r in rows if r['at']<cal and r['available']<cal],
            [r for r in rows if cal<=r['at']<start and r['available']<start])


def matrix(rows,key):return np.asarray([r[key] for r in rows],dtype=float)


def poisson_x(rows):
    x=matrix(rows,'x');return np.column_stack([np.abs(x[:,:8]),(x[:,39]+x[:,47])/2,(x[:,38]+x[:,46])/2])


def fit(kind,train):
    if kind=='poisson-total-points':
        model=make_pipeline(StandardScaler(),PoissonRegressor(alpha=P['poissonAlpha'],max_iter=1000))
        model.fit(poisson_x(train),np.asarray([r['pointsFor']+r['pointsAgainst'] for r in train]))
        return model
    model=fit_point_model(train,kind,P['regularization'],P['kappaBounds'],P['initialKappa'],P['optimizerMaxIterations'])
    if not model['success']:raise RuntimeError('Projection fit did not converge: '+model['message'])
    return model


def predict(kind,model,rows,grid,table,temperature=1,nodes=None):
    if kind=='poisson-total-points':
        mean=model.predict(poisson_x(rows));den=poisson.sf(32,mean)
        return np.column_stack([poisson.sf(k,mean)/den for k in [74,79,84]])
    return projection_predict(model,rows,grid,table,temperature,nodes or P['quadratureNodes'])


def choose_calibration(kind,model,cal,grid,table):
    indices=[5,6,7] if kind=='poisson-total-points' else list(range(14));y=matrix(cal,'y')[:,indices];base=matrix(cal,'baseline')[:,indices]
    choices=[]
    for temp in ([1] if kind=='poisson-total-points' else P['temperatures']):
        raw=predict(kind,model,cal,grid,table,temp)
        for weight in P['shrinkWeights']:
            p=base+weight*(raw-base);choices.append((float(((p-y)**2).mean()),weight,temp))
    _,weight,temp=min(choices,key=lambda x:(x[0],x[1],abs(x[2]-1)))
    return{'weight':weight,'temperature':temp,'indices':indices}


def run():
    if (ROOT/'research/report-v11.json').exists():raise RuntimeError('Report already written; do not overwrite after inspection')
    feature_path=DATA/'market-v8-features.json';features=json.loads(feature_path.read_text());source_path=ROOT/P['historyInput'];source=json.loads(source_path.read_text())
    if sha(source_path)!=features['inputHash'] or features['targets']!=TARGETS or P['targets']!=TARGETS:raise RuntimeError('Source/target mismatch')
    by_id={r['id']:r for r in source['results']};rows=[]
    for r in features['rows']:
        m=by_id[r['id']];sets=m['sets'];a=sum(s[0] for s in sets);b=sum(s[1] for s in sets);ha=sum(s[0]>s[1] for s in sets);aw=len(sets)-ha
        y=[int(m['homeWon']),int(sets[0][0]>sets[0][1]),int(sum(sets[0])>19.5),int(len(sets)>3.5),int(len(sets)>4.5),int(a+b>74.5),int(a+b>79.5),int(a+b>84.5),int(ha-aw>1.5),int(ha-aw>-1.5),int(a-b>5.5),int(a-b>-5.5),int(a-b>9.5),int(a-b>-9.5)]
        if max(ha,aw)!=3 or y!=r['y'] or r['featuresAvailable']>=r['at'] or r['available']<=r['at']:raise RuntimeError('Noncausal/inconsistent point result')
        rows.append({**r,'pointsFor':a,'pointsAgainst':b})
    started=time.monotonic();grid,table=projection_grid(P['projectionGridIntervals'])
    print(json.dumps({'phase':'projection_grid','nodes':len(grid),'seconds':round(time.monotonic()-started,2),'finite':bool(np.isfinite(table).all())}),flush=True)
    model_predictions={k:[] for k in P['candidates']};tested=[];folds=[];end=stamp(P['historyEndExclusive']);starts=list(map(stamp,P['foldStarts']))
    for i,start in enumerate(starts):
        train,cal=split(rows,start);test=[r for r in rows if start<=r['at']<(starts[i+1] if i+1<len(starts) else end) and r['available']<end]
        if len(train)<P['minimumTraining'] or len(cal)<P['minimumCalibration'] or not test:continue
        detail={'start':start,'training':len(train),'calibration':len(cal),'test':len(test),'models':{}}
        for kind in P['candidates']:
            model=fit(kind,train);settings=choose_calibration(kind,model,cal,grid,table);raw=predict(kind,model,test,grid,table,settings['temperature']);base=matrix(test,'baseline')[:,settings['indices']]
            predicted=base+settings['weight']*(raw-base);model_predictions[kind].append(predicted)
            detail['models'][kind]={**settings,**({'kappa':model['kappa'],'weights':model['weights']} if isinstance(model,dict) else {})}
        tested.extend(test);folds.append(detail);print(json.dumps({'phase':'projection_fold',**detail}),flush=True)
    if not tested:raise RuntimeError('No common temporal test cases')
    y=matrix(tested,'y');base=matrix(tested,'baseline');markets=[]
    pooled={k:np.concatenate(v) for k,v in model_predictions.items()}
    for j,target in enumerate(TARGETS):
        candidates=[]
        for kind in P['candidates']:
            if kind=='poisson-total-points' and j not in [5,6,7]:continue
            p=pooled[kind][:,[5,6,7].index(j) if kind=='poisson-total-points' else j]
            interval=paired_interval(tested,(p-y[:,j])**2-(base[:,j]-y[:,j])**2)
            candidates.append({'name':kind,'metrics':metrics(y[:,j],p),'pairedBrierDifference':interval})
        markets.append({'target':target,'reference':metrics(y[:,j],base[:,j]),'candidates':candidates})
    final_train,final_cal=split(rows,end);final={};quadrature_error=0
    for kind in P['candidates']:
        model=fit(kind,final_train);settings=choose_calibration(kind,model,final_cal,grid,table)
        if isinstance(model,dict):
            final[kind]={**model,**settings}
            if model['kappa'] is not None:
                subset=final_cal[::max(1,len(final_cal)//25)]
                a=predict(kind,model,subset,grid,table,settings['temperature'],P['quadratureNodes'])
                b=predict(kind,model,subset,grid,table,settings['temperature'],P['quadratureCheckNodes'])
                quadrature_error=float(np.max(np.abs(a-b)))
        else:final[kind]={**settings,'featureCount':10,'coefficients':model.named_steps['poissonregressor'].coef_.tolist(),'intercept':float(model.named_steps['poissonregressor'].intercept_)}
    checks=np.linspace(.01,.99,97);interpolation_error=float(max(np.max(np.abs(np.array([np.interp(p,grid,table[:,j]) for j in range(14)])-project_point_probability(float(p)))) for p in checks))
    report={'version':P['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'protocol':P,'source':'MoviOdds reported complete BO5 scores; old verified closing start snapshot','hashes':{'input':sha(source_path),'features':sha(feature_path),'closing':features['closingHash'],'implementation':sha(ROOT/'scripts/score_projection.py')},'n':len(tested),'folds':folds,'markets':markets,'finalTraining':len(final_train),'finalCalibration':len(final_cal),'finalModels':final,'numerics':{'gridIntervals':P['projectionGridIntervals'],'interpolationMaxAbsError97Checks':interpolation_error,'quadrature21vs41MaxAbsDifference':quadrature_error,'massConserved':bool(all(abs(project_point_probability(p)[0]+project_point_probability(1-p)[0]-1)<1e-10 for p in checks))},'independentValidation':False,'operationallyValidated':False,'limitations':P['limitations']}
    (ROOT/'research/report-v11.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    audit={'ids':[r['id'] for r in tested],'at':[r['at'] for r in tested],'y':y.tolist(),'predictions':{k:v.tolist() for k,v in pooled.items()},'reportHash':sha(ROOT/'research/report-v11.json')}
    with (DATA/'projection-v11-audit.json').open('x') as f:os.chmod(f.fileno(),0o600);json.dump(audit,f,allow_nan=False,separators=(',',':'))
    print(json.dumps({'phase':'projection_complete','cases':len(tested),'markets':len(markets),'independentValidation':False,'operationallyValidated':False,'numerics':report['numerics']}),flush=True)


if __name__=='__main__':run()
