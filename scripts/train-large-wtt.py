"""Train on 2022/23, calibrate 2024, evaluate 2025. Date-only external research."""
import os
os.environ.setdefault('OMP_NUM_THREADS','2')
os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
import csv,json,hashlib,heapq
from pathlib import Path
from datetime import datetime,timezone
from collections import defaultdict,deque,Counter
import numpy as np
import joblib
from scipy.special import expit,logit
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from projection_ensemble import paired_interval
from importlib.util import spec_from_file_location,module_from_spec
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data';DAY=86400000
P=json.loads((ROOT/'research/protocol-v15.json').read_text())
spec=spec_from_file_location('audit',ROOT/'scripts/audit-large-history.py');audit=module_from_spec(spec);spec.loader.exec_module(audit)
spec=spec_from_file_location('evaluation',ROOT/'scripts/evaluate-score-projection.py');ev=module_from_spec(spec);spec.loader.exec_module(ev)
stamp=lambda s:int(datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()*1000)


def load_records(file):
    # Reuse explicit scoring checks here without trusting the declared best_of.
    import re
    records=[];bad=Counter();seen=set()
    with (DATA/file).open() as stream:inputs=list(csv.DictReader(stream))
    for r in inputs:
        key=file+':'+r['match_id']
        if key in seen:raise RuntimeError('Duplicate cohort event ID')
        seen.add(key)
        try:
            at=stamp(r['event_date']);pairs=[tuple(map(int,re.fullmatch(r'(\d+)-(\d+)',s.strip()).groups())) for s in r['score'].split(',')]
            if not r['player1_name'] or not r['player2_name'] or r['player1_name']==r['player2_name']:raise ValueError()
            if any(max(a,b)<11 or (max(a,b)==11 and min(a,b)>9) or (max(a,b)>11 and abs(a-b)!=2) for a,b in pairs):raise ValueError()
            a=sum(x>y for x,y in pairs);b=len(pairs)-a;target=max(a,b)
            if target not in [3,4] or a==b or r['winner']!=str(1 if a>b else 2):raise ValueError()
            if any(sum(x>y for x,y in pairs[:i])==target or sum(x<y for x,y in pairs[:i])==target for i in range(1,len(pairs))):raise ValueError()
        except (ValueError,AttributeError):bad['inconsistentScoreOrIdentity']+=1;continue
        records.append({'id':key,'at':at,'available':at+P['historyLagDays']*DAY,'home':r['player1_name'],'away':r['player2_name'],'y':int(a>b),'setMargin':(a-b)/len(pairs),'pointMargin':(sum(x-y for x,y in pairs))/sum(x+y for x,y in pairs)})
    return sorted(records,key=lambda r:(r['at'],r['id'])),dict(bad)


def feature_rows(records):
    stats=defaultdict(lambda:{'n':0,'wins':0,'recent':deque(maxlen=10),'sets':0,'points':0,'elo':1500.})
    h2h=defaultdict(lambda:[0,0]);pending=[];rows=[];cold=0
    for i,r in enumerate(records):
        while pending and pending[0][0]<r['at']:
            _,j=heapq.heappop(pending);old=records[j];a=stats[old['home']];b=stats[old['away']]
            delta=P['eloK']*(old['y']-expit((a['elo']-b['elo'])*np.log(10)/400))
            a['elo']+=delta;b['elo']-=delta
            for s,y,sign in [(a,old['y'],1),(b,1-old['y'],-1)]:
                s['n']+=1;s['wins']+=y;s['recent'].append(y);s['sets']+=sign*old['setMargin'];s['points']+=sign*old['pointMargin']
            pair=tuple(sorted([old['home'],old['away']]));z=h2h[pair];z[0]+=1;z[1]+=old['y'] if old['home']==pair[0] else 1-old['y']
        a=stats[r['home']];b=stats[r['away']];pair=tuple(sorted([r['home'],r['away']]));n,w=h2h[pair];w=w if r['home']==pair[0] else n-w
        if min(a['n'],b['n'])>=P['minimumPlayerHistory']:
            x=[(a['elo']-b['elo'])/400,(a['wins']+2)/(a['n']+4)-(b['wins']+2)/(b['n']+4),(sum(a['recent'])+1)/(len(a['recent'])+2)-(sum(b['recent'])+1)/(len(b['recent'])+2),a['sets']/a['n']-b['sets']/b['n'],a['points']/a['n']-b['points']/b['n'],(w-n/2)/(n+4),np.log1p(a['n'])-np.log1p(b['n'])]
            rows.append({**r,'x':x,'elo':float(expit(x[0]*np.log(10)))})
        else:cold+=1
        heapq.heappush(pending,(r['available'],i))
    return rows,cold


def raw_predict(model,rows):
    x=np.asarray([r['x'] for r in rows]);return (model.predict_proba(x)[:,1]+1-model.predict_proba(-x)[:,1])/2


def calibrated(raw,t,w):return .5+w*(expit(t*logit(np.clip(raw,1e-9,1-1e-9)))-.5)


def run():
    output=ROOT/'research/report-v15.json'
    if output.exists():raise RuntimeError('Do not overwrite inspected performance')
    cohorts=[];pooled=defaultdict(list);pooledrows=[];audits=[]
    for file,h in P['inputs'].items():
        if hashlib.sha256((DATA/file).read_bytes()).hexdigest()!=h:raise RuntimeError('Changed source')
        records,excluded=load_records(file);rows,cold=feature_rows(records)
        train=[r for r in rows if r['at']<stamp(P['trainBefore']) and r['available']<stamp(P['trainBefore'])]
        cal=[r for r in rows if stamp(P['trainBefore'])<=r['at']<stamp(P['calibrationBefore']) and r['available']<stamp(P['calibrationBefore'])]
        test=[r for r in rows if stamp(P['calibrationBefore'])<=r['at']<stamp(P['testBefore']) and r['available']<stamp(P['testBefore'])]
        if min(len(train),len(cal),len(test))<100:raise RuntimeError('Insufficient cohort split')
        x=np.asarray([r['x'] for r in train]);y=np.asarray([r['y'] for r in train]);x=np.concatenate([x,-x]);y=np.r_[y,1-y]
        cy=np.asarray([r['y'] for r in cal]);ty=np.asarray([r['y'] for r in test]);preds={'elo':np.asarray([r['elo'] for r in test]),'neutral':np.full(len(test),.5)};candidates=[]
        for kind in P['candidates']:
            model=make_pipeline(StandardScaler(with_mean=False),LogisticRegression(C=P['logisticC'],fit_intercept=False,max_iter=1000,random_state=P['seed'])) if kind=='logistic' else HistGradientBoostingClassifier(**P['boosted'],random_state=P['seed'])
            model.fit(x,y);raw=raw_predict(model,cal)
            choices=[(float(np.mean((calibrated(raw,t,w)-cy)**2)),t,w) for t in P['temperatures'] for w in P['shrinkWeights']]
            _,t,w=min(choices,key=lambda z:(z[0],abs(z[1]-1),z[2]));preds[kind]=calibrated(raw_predict(model,test),t,w)
            candidates.append({'name':kind,'temperature':t,'shrinkWeight':w,'metrics':ev.metrics(ty,preds[kind]),'pairedBrierDifference':{name:paired_interval(test,(preds[kind]-ty)**2-(preds[name]-ty)**2,P) for name in ['elo','neutral']}})
            path=DATA/(file+'.'+kind+'.joblib')
            if path.exists():raise RuntimeError('Do not overwrite trained artifact')
            joblib.dump({'model':model,'temperature':t,'shrinkWeight':w,'protocol':P,'validated':False},path);os.chmod(path,0o600)
        info={'sourceFile':file,'raw':len(records)+sum(excluded.values()),'scoreCoherent':len(records),'excluded':excluded,'coldStart':cold,'eligibleFeatureRows':len(rows),'training':len(train),'calibration':len(cal),'test':len(test),'embargoOrOutsideWindows':len(rows)-len(train)-len(cal)-len(test),'candidates':candidates,'comparators':{name:ev.metrics(ty,preds[name]) for name in ['elo','neutral']}}
        cohorts.append(info);pooledrows.extend(test)
        for name,values in preds.items():pooled[name].extend(values.tolist())
        audits.extend([{'id':r['id'],'at':r['at'],'y':r['y'],'predictions':{name:float(values[i]) for name,values in preds.items()}} for i,r in enumerate(test)])
        print(json.dumps({'phase':'cohort_complete',**info}),flush=True)
    y=np.asarray([r['y'] for r in pooledrows]);aggregate={name:ev.metrics(y,np.asarray(values)) for name,values in pooled.items()}
    report={'version':P['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'protocol':P,'cohorts':cohorts,'aggregate':aggregate,'totalTestCases':len(pooledrows),'rawRows':sum(c['raw'] for c in cohorts),'tenThousandTestCases':False,'sourceDatesVerifiedAgainstOfficialResults':False,'operationallyValidated':False,'automaticPromotion':False}
    with output.open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (DATA/'wtt-v15-test-audit.json').open('x') as f:os.chmod(f.fileno(),0o600);json.dump({'rows':audits,'reportHash':hashlib.sha256(output.read_bytes()).hexdigest()},f)
    print(json.dumps({'phase':'completed','raw':report['rawRows'],'test':len(pooledrows),'aggregate':aggregate,'operationallyValidated':False}))


if __name__=='__main__':run()
