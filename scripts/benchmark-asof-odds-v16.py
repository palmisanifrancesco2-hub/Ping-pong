"""Exact as-of common subset: sports-only, sports+odds and market-only."""
import json,hashlib,os
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
import joblib
from scipy.special import expit,logit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from advanced_benchmark import metrics
from projection_ensemble import paired_interval
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data';P=json.loads((ROOT/'research/protocol-v16-odds.json').read_text())
stamp=lambda s:int(datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def features(rows,combined):
    x=np.asarray([r['x'][:8] for r in rows])
    return np.column_stack([x,logit([r['marketProbability'] for r in rows])]) if combined else x


def main():
    output=ROOT/'research/report-v16-odds.json'
    if output.exists():raise RuntimeError('Do not overwrite inspected odds experiment')
    for file,h in P['hashes'].items():
        if sha(ROOT/file)!=h:raise RuntimeError('Source changed')
    odds=json.loads((DATA/'v16-qualified-market-baselines.json').read_text());f=json.loads((DATA/'market-v8-features.json').read_text());byid={r['id']:r for r in f['rows']};rows=[]
    for q in odds['rows']:
        r=byid[q['id']]
        if r['at']!=q['decisionTime'] or q['actualKickoff']-q['decisionTime']!=60000 or r['featuresAvailable']>=q['decisionTime']:raise RuntimeError('Feature time mismatch')
        if any(stamp(q[k])>q['decisionTime'] or stamp(q[k])<q['decisionTime']-300000 for k in ['homeQuoteAt','awayQuoteAt']):raise RuntimeError('Quote not available/fresh')
        expected=(1/q['homeOdds'])/(1/q['homeOdds']+1/q['awayOdds'])
        if abs(expected-q['marketProbability'])>1e-12:raise RuntimeError('Odds probability mismatch')
        rows.append({**r,**q,'y':r['y'][0]})
    if len({r['id'] for r in rows})!=len(rows):raise RuntimeError('Duplicate event')
    train_end=stamp(P['trainBefore']);cal_end=stamp(P['calibrationBefore']);test_end=stamp(P['testBefore'])
    train=[r for r in rows if r['at']<train_end and r['available']<train_end];cal=[r for r in rows if train_end<=r['at']<cal_end and r['available']<cal_end];test=[r for r in rows if cal_end<=r['at']<test_end and r['available']<test_end]
    if len(train)<P['minimumTraining'] or len(cal)<P['minimumCalibration']:raise RuntimeError('Insufficient independent train/calibration events')
    y=np.asarray([r['y'] for r in train]);cy=np.asarray([r['y'] for r in cal]);ty=np.asarray([r['y'] for r in test]);market=np.asarray([r['marketProbability'] for r in test]);models=[];audit={};artifacts=[]
    for name in P['models']:
        combined=name=='sports-and-market';x=features(train,combined);model=make_pipeline(StandardScaler(with_mean=False),LogisticRegression(**P['fit']))
        model.fit(np.concatenate([x,-x]),np.r_[y,1-y]);raw=model.predict_proba(features(cal,combined))[:,1];baseline=np.asarray([r['marketProbability'] for r in cal]) if combined else np.full(len(cal),.5)
        choices=[]
        for temperature in P['temperatures']:
            transformed=expit(temperature*logit(np.clip(raw,1e-9,1-1e-9)))
            for weight in P['shrinkWeights']:
                p=baseline+weight*(transformed-baseline);choices.append((float(np.mean((p-cy)**2)),temperature,weight))
        _,temperature,weight=min(choices,key=lambda a:(a[0],abs(a[1]-1),a[2]));rawtest=model.predict_proba(features(test,combined))[:,1];base=market if combined else np.full(len(test),.5);pred=base+weight*(expit(temperature*logit(np.clip(rawtest,1e-9,1-1e-9)))-base)
        audit[name]=pred.tolist();models.append({'name':name,'temperature':temperature,'shrinkWeight':weight,'metrics':metrics(ty,pred),'pairedBrierDifferenceVsMarket':paired_interval(test,(pred-ty)**2-(market-ty)**2,P)})
        path=DATA/f'v16-asof-{name}.joblib'
        if path.exists():raise RuntimeError('Private artifact exists')
        joblib.dump({'model':model,'temperature':temperature,'weight':weight,'combined':combined,'validated':False,'protocol':P},path);os.chmod(path,0o600);artifacts.append({'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size})
    report={'version':P['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'protocol':P,'qualifiedRows':len(rows),'training':len(train),'calibration':len(cal),'test':len(test),'outsideSplits':len(rows)-len(train)-len(cal)-len(test),'observedTestDays':len({r['at']//86400000 for r in test}),'models':models,'marketOnly':metrics(ty,market),'artifacts':artifacts,'roi':None,'independentValidation':False,'operationallyValidated':False,'automaticPromotion':False}
    with output.open('x') as file:json.dump(report,file,indent=2,allow_nan=False);file.write('\n')
    with (DATA/'v16-odds-audit.json').open('x') as file:os.chmod(file.fileno(),0o600);json.dump({'ids':[r['id'] for r in test],'y':ty.tolist(),'predictions':audit,'market':market.tolist(),'reportHash':sha(output)},file)
    print(json.dumps(report))


if __name__=='__main__':main()
