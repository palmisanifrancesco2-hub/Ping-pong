"""Historical temporal stacking study. Never reads prospective study outcomes."""
import json,hashlib,importlib.util,os
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from temporal_pool import calibration_rows,fit,predict
from projection_ensemble import aligned_indices,paired_interval
ROOT=Path(__file__).resolve().parents[1]
P=json.loads((ROOT/'research/protocol-v13.json').read_text())
spec=importlib.util.spec_from_file_location('metrics',ROOT/'scripts/evaluate-score-projection.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


def run():
    output=ROOT/'research/report-v13.json'
    if output.exists():raise RuntimeError('Do not overwrite an inspected report')
    for path,h in P['sources'].items():
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=h:raise RuntimeError('Changed source')
    load=lambda path:json.loads((ROOT/'.research-data'/path).read_text())
    a=load('projection-v11-audit.json');v=load('multi-model-v7-audit.json');features=load('market-v8-features.json');f={r['id']:r for r in features['rows']}
    full=v['winnerPredictions']['full:0.001'];order=aligned_indices(a['ids'],[r['id'] for r in full]);rows=[]
    for i,key in enumerate(a['ids']):
        r=f[key];old=full[order[i]]
        if r['at']!=a['at'][i] or old['at']!=r['at'] or old['y']!=a['y'][i][0] or r['y'][0]!=old['y']:raise RuntimeError('Mismatched forecast')
        if not r['featuresAvailable']<r['at']<r['available']:raise RuntimeError('Noncausal source')
        rows.append({'id':key,'at':r['at'],'available':r['available'],'y':old['y'],'full':old['p'],'projection':a['predictions']['rally-beta-binomial'][i][0],'league':r['baseline'][0]})
    days=sorted(set(r['at']//86400000 for r in rows));tested=[];folds=[];predictions={name:[] for name in P['candidates']}
    for day in days:
        start=day*86400000;cal=calibration_rows(rows,start);test=[r for r in rows if r['at']//86400000==day]
        if len(cal)<P['minimumCalibration'] or len(set(r['at']//86400000 for r in cal))<P['minimumDays']:continue
        settings={name:fit(cal,name,P['ridge']) for name in P['candidates']}
        for name,params in settings.items():predictions[name].extend(predict(test,params['weight'],params['temperature']).tolist())
        tested.extend(test);folds.append({'day':datetime.fromtimestamp(start/1000,timezone.utc).date().isoformat(),'calibration':len(cal),'maxOutcomeAvailable':max(r['available'] for r in cal),'start':start,'test':len(test),'parameters':settings})
    if not tested:raise RuntimeError('Insufficient common cases')
    y=np.asarray([r['y'] for r in tested]);comparators={name:np.asarray([r[name] for r in tested]) for name in ['full','projection','league']};comparators['fixed-half']=np.asarray([(r['full']+r['projection'])/2 for r in tested])
    candidates=[{'name':name,'metrics':m.metrics(y,np.asarray(values)),'pairedBrierDifference':{key:paired_interval(tested,(np.asarray(values)-y)**2-(ref-y)**2,P) for key,ref in comparators.items()}} for name,values in predictions.items()]
    report={'version':P['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'protocol':P,'n':len(tested),'observedDays':len(folds),'folds':folds,'comparators':{key:m.metrics(y,ref) for key,ref in comparators.items()},'candidates':candidates,'independentValidation':False,'operationallyValidated':False,'automaticPromotion':False}
    with output.open('x') as file:json.dump(report,file,indent=2,allow_nan=False);file.write('\n')
    audit={'ids':[r['id'] for r in tested],'reportHash':hashlib.sha256(output.read_bytes()).hexdigest(),'predictions':predictions}
    with (ROOT/'.research-data/temporal-pool-v13-audit.json').open('x') as file:os.chmod(file.fileno(),0o600);json.dump(audit,file)
    print(json.dumps({'n':len(tested),'days':len(folds),'comparators':report['comparators'],'candidates':candidates}))


if __name__=='__main__':run()
