"""Descriptive update only; never a new independent significance test."""
import importlib.util,json,joblib
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('comparison',ROOT/'scripts/evaluate-market-distributions.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
manifest_path=ROOT/'.research-data/market-v8-selection.json';manifest=json.loads(manifest_path.read_text())
model_path=ROOT/'.research-data/market-v8-frozen.joblib'
source=json.loads((ROOT/'.research-data/market-v8-extension-features.json').read_text())
if c.sha(model_path)!=manifest['modelHash'] or c.sha(manifest_path)!=source['selectionHash']:raise RuntimeError('Frozen selection modified')
original=json.loads((ROOT/'.research-data/market-v8-confirmation-features.json').read_text())
old_ids={r['id'] for r in original['rows']}
if any(r['id'] in old_ids for r in source['rows']):raise RuntimeError('Duplicate extension event')
rows=original['rows']+source['rows']
frozen=joblib.load(model_path);baseline=c.matrix(rows,'baseline');y=c.matrix(rows,'y')
pred={k:baseline+frozen['weights'][k]*(c.predict(k,frozen['models'][k],rows)-baseline) for k in set(manifest['selected'].values())}
targets=[{'target':t,'selected':manifest['selected'][t],'metrics':c.metrics(y[:,j],pred[manifest['selected'][t]][:,j]),'reference':c.metrics(y[:,j],baseline[:,j])} for j,t in enumerate(c.TARGETS)]
report={'version':source['protocol']['version'],'generatedAt':datetime.now(timezone.utc).isoformat(),'originalCases':len(original['rows']),'additionalCases':len(source['rows']),'totalCases':len(rows),'targets':targets,'selectionHash':c.sha(manifest_path),'modelHash':manifest['modelHash'],'protocol':source['protocol'],'operationallyValidated':False,'formalConfirmation':False}
(ROOT/'research/report-v8-extension.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
print(json.dumps({'descriptiveExtensionCases':len(rows),'additionalCases':len(source['rows']),'formalConfirmation':False}))
