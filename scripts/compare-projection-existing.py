"""Additional exploratory comparison against previous best candidates on matched IDs.

This is explicitly a post-report comparator, not a change to the registered primary
frequency-reference comparison. Doubles the comparison family conservatively.
"""
import json,hashlib,importlib.util
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('projection',ROOT/'scripts/evaluate-score-projection.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
primary=json.loads((ROOT/'research/report-v11.json').read_text())
audit=json.loads((ROOT/'.research-data/projection-v11-audit.json').read_text())
old=json.loads((ROOT/'.research-data/market-v8-historical-audit.json').read_text())
selected=json.loads((ROOT/'.research-data/market-v8-selection.json').read_text())
v7=json.loads((ROOT/'.research-data/multi-model-v7-audit.json').read_text())
if (ROOT/'research/report-v11-existing.json').exists():raise RuntimeError('Supplement already written')
if hashlib.sha256((ROOT/'research/report-v11.json').read_bytes()).hexdigest()!=audit['reportHash']:raise RuntimeError('Primary report changed')
index={key:i for i,key in enumerate(old['ids'])};winner={r['id']:r for r in v7['winnerPredictions']['ensemble-equal']}
if set(audit['ids'])!=set(index) or set(audit['ids'])!=set(winner):raise RuntimeError('Different historical case sets; do not silently exclude cases')
p.P['familyComparisons']=62
rows=[{'id':key,'at':at} for key,at in zip(audit['ids'],audit['at'])];y=np.asarray(audit['y']);markets=[]
for j,target in enumerate(p.TARGETS):
    kind=selected['selected'][target]
    reference=np.asarray([winner[key]['p'] if j==0 else old['predictions'][kind][index[key]][j] for key in audit['ids']])
    for i,key in enumerate(audit['ids']):
        if old['y'][index[key]][j]!=y[i,j] or (j==0 and winner[key]['y']!=y[i,j]):raise RuntimeError('Historical outcome mismatch')
    candidates=[]
    for model,values in audit['predictions'].items():
        if model=='poisson-total-points' and j not in [5,6,7]:continue
        pred=np.asarray(values)[:,[5,6,7].index(j) if model=='poisson-total-points' else j]
        candidates.append({'name':model,'metrics':p.metrics(y[:,j],pred),'pairedBrierDifference':p.paired_interval(rows,(pred-y[:,j])**2-(reference-y[:,j])**2)})
    markets.append({'target':target,'referenceName':'ensemble-equal-v7' if j==0 else kind+'-v8','reference':p.metrics(y[:,j],reference),'candidates':candidates})
report={'version':'score-projection-v11-existing-comparator','n':len(rows),'primaryReportHash':audit['reportHash'],'exploratoryPostReportComparison':True,'familyComparisons':62,'markets':markets,'independentValidation':False,'operationallyValidated':False,'limitation':'Best previous models were selected on this already inspected archive. Not independent validation and not a replacement criterion.'}
(ROOT/'research/report-v11-existing.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
print(json.dumps({'matchedCases':len(rows),'comparisonsFamily':62,'independentValidation':False}))
