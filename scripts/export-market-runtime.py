"""Export the already frozen v8 selection. No training, tuning or label selection."""
import hashlib
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import joblib

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('comparison',ROOT/'scripts/evaluate-market-distributions.py')
comparison=importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)
manifest_path=ROOT/'.research-data/market-v8-selection.json'
manifest=json.loads(manifest_path.read_text())
model_path=ROOT/'.research-data/market-v8-frozen.joblib'
digest=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
if digest(model_path)!=manifest['modelHash']:
    raise RuntimeError('Frozen model changed')
frozen=joblib.load(model_path)
targets=manifest['protocol']['targetNames']
indices=[j for j,t in enumerate(targets) if manifest['selected'][t]=='joint-score-forest']
weights=[float(frozen['weights'][manifest['selected'][t]][j]) for j,t in enumerate(targets)]
for j,t in enumerate(targets):
    kind=manifest['selected'][t]
    if kind not in ['hierarchical-eb','joint-score-forest'] and weights[j]!=0:
        raise RuntimeError('Unsupported nonzero selected model: export explicitly, never substitute')
forest=frozen['models']['joint-score-forest']
trees=[]
for estimator in forest['forest'].estimators_:
    tree=estimator.tree_
    trees.append({'feature':tree.feature.tolist(),'threshold':tree.threshold.tolist(),
                  'left':tree.children_left.tolist(),'right':tree.children_right.tolist(),
                  'value':[[float(tree.value[n,j,0]*forest['scale'][j]) for j in indices] for n in range(tree.node_count)]})
artifact={'version':'market-v8-frozen-runtime-1','exportedAt':datetime.now(timezone.utc).isoformat(),
          'selectionHash':digest(manifest_path),'pythonModelHash':manifest['modelHash'],
          'featureCodeHash':digest(ROOT/'src/domain/market-context.ts'),
          'scoreFeatureCodeHash':digest(ROOT/'src/domain/score-model.ts'),
          'targets':targets,'selected':[manifest['selected'][t] for t in targets],
          'weights':weights,'forestIndices':indices,'trees':trees,'validated':False}
out=ROOT/'models/market-v8-runtime.json'
with out.open('x') as stream: json.dump(artifact,stream,separators=(',',':'),allow_nan=False)
rows=json.loads((ROOT/'.research-data/market-v8-features.json').read_text())['rows'][::100]
baseline=comparison.matrix(rows,'baseline')
predictions={k: baseline+frozen['weights'][k]*(comparison.predict(k,frozen['models'][k],rows)-baseline) for k in set(manifest['selected'].values())}
parity=[{'x':r['x'],'baseline':r['baseline'],'eb':r['eb'],
         'expected':[float(predictions[manifest['selected'][t]][i,j]) for j,t in enumerate(targets)]} for i,r in enumerate(rows)]
with (ROOT/'research/market-runtime-parity.json').open('x') as stream: json.dump(parity,stream,separators=(',',':'),allow_nan=False)
print(json.dumps({'exported':out.name,'bytes':out.stat().st_size,'trees':len(trees),'parityCases':len(parity),'sha256':digest(out)}))
