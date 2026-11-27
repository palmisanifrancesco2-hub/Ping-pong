"""Export an already-fitted v8 candidate; no training or tuning on the 64 outcomes."""
import hashlib,json,joblib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest_path=ROOT/'.research-data/market-v8-selection.json'
manifest=json.loads(manifest_path.read_text());path=ROOT/'.research-data/market-v8-frozen.joblib'
if digest(path)!=manifest['modelHash']:raise RuntimeError('Frozen model changed')
frozen=joblib.load(path);pipeline=frozen['models']['logistic-context'][0]
scaler=pipeline.named_steps['standardscaler'];model=pipeline.named_steps['logisticregression']
out={'version':'winner-context-v8-frozen-1','exportedAt':datetime.now(timezone.utc).isoformat(),
     'sourceModelHash':digest(path),'selectionHash':digest(manifest_path),
     'mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'weights':model.coef_[0].tolist(),
     'intercept':float(model.intercept_[0]),'shrink':float(frozen['weights']['logistic-context'][0]),'validated':False}
with (ROOT/'models/winner-context-v8.json').open('x') as f:json.dump(out,f,separators=(',',':'),allow_nan=False)
rows=json.loads((ROOT/'.research-data/market-v8-features.json').read_text())['rows'][::100]
x=np.array([r['x'] for r in rows]);raw=pipeline.predict_proba(x)[:,1]
parity=[{'x':r['x'],'baseline':r['baseline'][0], 'expected':float(r['baseline'][0]+out['shrink']*(raw[i]-r['baseline'][0]))} for i,r in enumerate(rows)]
with (ROOT/'research/winner-context-parity.json').open('x') as f:json.dump(parity,f,separators=(',',':'),allow_nan=False)
print(json.dumps({'frozenCandidate':out['version'],'features':len(out['weights']),'parityCases':len(parity),'trainedOnNewOutcomes':False}))
