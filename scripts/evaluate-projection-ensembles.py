"""Exploratory comparison of frozen arithmetic pools on already known historical data."""
import json,hashlib,importlib.util,os
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from projection_ensemble import aligned_indices,linear_pool,diversity,paired_interval

ROOT=Path(__file__).resolve().parents[1]
P=json.loads((ROOT/'research/protocol-v12.json').read_text())
spec=importlib.util.spec_from_file_location('projection_evaluation',ROOT/'scripts/evaluate-score-projection.py')
evaluation=importlib.util.module_from_spec(spec);spec.loader.exec_module(evaluation)


def run():
    output=ROOT/'research/report-v12.json'
    if output.exists():raise RuntimeError('Report already inspected; do not overwrite')
    for name,digest in P['sources'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise RuntimeError('Source changed: '+name)
    load=lambda name:json.loads((ROOT/'.research-data'/name).read_text())
    projection=load('projection-v11-audit.json');old=load('market-v8-historical-audit.json');v7=load('multi-model-v7-audit.json');selection=load('market-v8-selection.json');features=load('market-v8-features.json')
    ids=projection['ids'];y=np.asarray(projection['y']);order=aligned_indices(ids,old['ids']);oy=np.asarray(old['y'])[order]
    if not np.array_equal(y,oy):raise RuntimeError('Different historical outcomes')
    fp={r['id']:r for r in features['rows']};base=np.asarray([fp[key]['baseline'] for key in ids])
    for i,key in enumerate(ids):
        if fp[key]['y']!=projection['y'][i] or fp[key]['at']!=projection['at'][i]:raise RuntimeError('Baseline/outcome/time mismatch')
    winners={}
    for name in ['ensemble-equal','full:0.001']:
        values=v7['winnerPredictions'][name];indices=aligned_indices(ids,[r['id'] for r in values]);ordered=[values[i] for i in indices]
        if any(r['y']!=y[i,0] or r['at']!=projection['at'][i] for i,r in enumerate(ordered)):raise RuntimeError('Winner prediction mismatch')
        winners[name]=np.asarray([r['p'] for r in ordered])
    rows=[{'at':at} for at in projection['at']];markets=[];comparisons=0
    beta=np.asarray(projection['predictions'][P['projection']]);poisson=np.asarray(projection['predictions']['poisson-total-points'])
    for j,target in enumerate(evaluation.TARGETS):
        prior=winners['ensemble-equal'] if j==0 else np.asarray(old['predictions'][selection['selected'][target]])[order,j]
        recipes=[('projection-with-reference',[beta[:,j],prior],P['recipes']['projection-with-reference']['weights'],['projection','previous-best'])]
        if target in P['recipes']['projection-with-reference-and-poisson']['targets']:
            k=P['recipes']['projection-with-reference-and-poisson']['targets'].index(target)
            recipes.append(('projection-with-reference-and-poisson',[beta[:,j],prior,poisson[:,k]],P['recipes']['projection-with-reference-and-poisson']['weights'],['projection','previous-best','poisson']))
        if target=='winner':recipes.append(('projection-with-full',[beta[:,j],winners['full:0.001']],P['recipes']['projection-with-full']['weights'],['projection','full-logistic']))
        candidates=[]
        for name,components,weights,names in recipes:
            pooled=linear_pool(components,weights);comparators={'league':base[:,j],'previous-best':prior,**dict(zip(names,components))}
            intervals={key:paired_interval(rows,(pooled-y[:,j])**2-(p-y[:,j])**2,P) for key,p in comparators.items()};comparisons+=len(comparators)
            candidates.append({'name':name,'componentNames':names,'weights':weights,'metrics':evaluation.metrics(y[:,j],pooled),
                'components':{key:evaluation.metrics(y[:,j],p) for key,p in comparators.items()},'pairedBrierDifference':intervals,
                'diversity':diversity(y[:,j],components),'beatsEveryComparatorBeyondUncertainty':all(v['upper'] is not None and v['upper']<0 for v in intervals.values())})
        markets.append({'target':target,'reference':evaluation.metrics(y[:,j],prior),'candidates':candidates})
    if comparisons!=P['familyComparisons']:raise RuntimeError(f'Comparison family mismatch: {comparisons}')
    report={'version':P['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'protocol':P,'n':len(ids),'observedDays':len(set(int(at)//86400000 for at in projection['at'])),'markets':markets,'comparisons':comparisons,'independentValidation':False,'operationallyValidated':False,'automaticPromotion':False}
    with output.open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    audit={'ids':ids,'reportHash':hashlib.sha256(output.read_bytes()).hexdigest(),'protocolHash':hashlib.sha256((ROOT/'research/protocol-v12.json').read_bytes()).hexdigest()}
    with (ROOT/'.research-data/projection-ensemble-v12-audit.json').open('x') as f:os.chmod(f.fileno(),0o600);json.dump(audit,f)
    print(json.dumps({'n':len(ids),'targets':len(markets),'comparisons':comparisons,'independentValidation':False,'newlyValidated':sum(c['beatsEveryComparatorBeyondUncertainty'] for m in markets for c in m['candidates'])}))


if __name__=='__main__':run()
