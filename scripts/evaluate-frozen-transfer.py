"""Evaluate saved models only. This module never fits, tunes or promotes a model."""
import os
os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
import importlib.util
import json
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import joblib
import torch
from nflows.flows.base import Flow
from nflows.distributions.normal import StandardNormal
from nflows.transforms.base import CompositeTransform
from nflows.transforms.autoregressive import MaskedAffineAutoregressiveTransform
from nflows.transforms.permutations import ReversePermutation
from advanced_benchmark import metrics

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
POINT_HEADS = [5, 6, 7, 10, 11, 12, 13]
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
matrix = lambda rows, key: np.asarray([r[key] for r in rows], dtype=float)


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def verified_artifact(path, manifest):
    entry = next((r for r in manifest['artifacts'] if r['file'] == path.name), None)
    if entry is None or sha(path) != entry['sha256']:
        raise ValueError('Artifact does not match frozen benchmark manifest')
    artifact = joblib.load(path)  # Only locally generated artifacts after hash check.
    if artifact.get('validated') is not False:
        raise ValueError('Unexpected validation flag')
    return artifact


def main():
    begin = time.monotonic()
    protocol = json.loads((ROOT / 'research/protocol-v20-frozen-transfer.json').read_text())
    output = ROOT / 'research/report-v20-frozen-transfer.json'
    audit_path = DATA / 'frozen-transfer-v20-audit.json'
    if output.exists() or audit_path.exists():
        raise RuntimeError('Do not overwrite inspected results')
    fp, sp = ROOT / protocol['features'], ROOT / protocol['sealed']
    if sha(fp) != protocol['featuresHash'] or sha(sp) != protocol['sealedHash']:
        raise ValueError('Changed transfer data')
    original_path = DATA / 'market-v8-features.json'
    if sha(original_path) != protocol['originalFeaturesHash']:
        raise ValueError('Changed original feature cohort')
    rows = json.loads(fp.read_text())['rows']
    sealed = json.loads(sp.read_text())
    original = json.loads(original_path.read_text())
    original_ids = {r['id'] for r in original['rows']}
    if len({r['id'] for r in rows}) != len(rows) or any(r['id'] in original_ids for r in rows):
        raise ValueError('Duplicate or overlapping transfer cohort')
    byid = {r['id']: r for r in sealed['results']}
    inventory = module('inventory', 'inventory-data-v16.py')
    qualified = []
    for i, row in enumerate(rows):
        r = byid[row['id']]
        sets = r['sets']
        a, b = sum(s[0] for s in sets), sum(s[1] for s in sets)
        ha = sum(s[0] > s[1] for s in sets)
        expected = [int(r['homeWon']), int(sets[0][0] > sets[0][1]), int(sum(sets[0]) > 19.5),
            int(len(sets) > 3.5), int(len(sets) > 4.5), int(a+b > 74.5), int(a+b > 79.5),
            int(a+b > 84.5), int(2*ha-len(sets) > 1.5), int(2*ha-len(sets) > -1.5),
            int(a-b > 5.5), int(a-b > -5.5), int(a-b > 9.5), int(a-b > -9.5)]
        if (expected != row['y'] or len(row['x']) != 63 or not np.isfinite(row['x']).all()
                or not row['featuresAvailable'] < row['at'] < row['available']
                or inventory.stamp(sealed['oldCollectedAt']) >= row['at']):
            raise ValueError('Invalid causal feature/label row')
        closing = inventory.load(DATA / 'market-v8-confirmation' / (row['id'] + '.json'))
        if inventory.strict_start(closing, r) != row['at']:
            raise ValueError('Unverified event start')
        if inventory.strict_pair(closing, r, row['at']):
            selections = [q['pre_close'] for q in closing['selections'] if q.get('group_id') == '920000'
                          and q.get('market_id') == '920000' and q.get('line') == 'To Win'
                          and q.get('side') in [r['home'], r['away']]]
            h = next(q['odds_dec'] for q in selections if q['side'] == r['home'])
            a = next(q['odds_dec'] for q in selections if q['side'] == r['away'])
            qualified.append((i, (1/h)/(1/h+1/a)))
    reports = {}
    reports[16] = json.loads((ROOT / 'research/report-v16-benchmark.json').read_text())
    reports[18] = json.loads((ROOT / 'research/report-v18-probabilistic.json').read_text())
    if (reports[16]['dataset']['featuresHash'] != protocol['originalFeaturesHash']
            or reports[18]['protocol']['inputHash'] != protocol['originalFeaturesHash']):
        raise ValueError('Original benchmark provenance mismatch')
    cutoff = reports[16]['folds'][protocol['fold']]['start']
    if min(r['at'] for r in rows) <= cutoff:
        raise ValueError('Transfer cohort precedes the frozen model evaluation window')
    helpers = module('probabilistic', 'run-probabilistic-benchmark.py')
    old = module('advanced', 'run-advanced-benchmark.py')
    base, y = matrix(rows, 'baseline'), matrix(rows, 'y')
    predictions, raw, artifact_manifest = {}, {}, []
    torch.set_num_threads(2)
    for kind in protocol['models']:
        if kind == 'hierarchical-eb':
            weights = np.asarray(reports[16]['folds'][protocol['fold']]['models'][kind]['calibrationWeights'])
            raw[kind] = matrix(rows, 'eb')
            predictions[kind] = base + weights*(raw[kind]-base)
            continue
        version = 18 if kind in ['catboost', 'ngboost', 'conditional-normalizing-flow'] else 16
        filename = (f'probabilistic-v18-fold-{protocol["fold"]}-{kind}.joblib' if version == 18 else
                    f'advanced-v16-fold-{protocol["fold"]}-'+('bradley-terry' if kind == 'bradley-terry-winner' else kind)+'.joblib')
        path = DATA / filename
        artifact = verified_artifact(path, reports[version])
        artifact_manifest.append({'file': filename, 'sha256': sha(path)})
        heads = POINT_HEADS if kind == 'conditional-normalizing-flow' else ([0] if kind == 'bradley-terry-winner' else list(range(14)))
        if kind in ['catboost', 'ngboost']:
            p = helpers.predict_heads(artifact['models'], rows)
        elif kind == 'conditional-normalizing-flow':
            config = artifact['protocol']['fixed'][kind]
            transforms = []
            for _ in range(config['transforms']):
                transforms.extend([ReversePermutation(features=2), MaskedAffineAutoregressiveTransform(
                    features=2, hidden_features=config['hidden_features'], context_features=63)])
            flow = Flow(CompositeTransform(transforms), StandardNormal([2]))
            flow.load_state_dict(artifact['state_dict'])
            flow.eval()
            p = helpers.predict_flow((flow, artifact['xScaler'], artifact['yScaler']), rows,
                                     protocol['flowSamples'], protocol['seed'])
        elif kind == 'bradley-terry-winner':
            p = old.bt_predict(artifact['model'], rows, byid)[:, None]
        else:
            choices = [old.predict(kind, model, rows) for model in artifact['models']]
            p = np.column_stack([choices[k][:, j] for j, k in enumerate(artifact['selection'])])
        if not np.isfinite(p).all() or np.any((p < 0) | (p > 1)):
            raise ValueError('Invalid inference probabilities')
        weights = artifact['weight'] if kind == 'bradley-terry-winner' else artifact['calibrationWeights']
        raw[kind] = p
        predictions[kind] = base[:, heads] + weights*(p-base[:, heads])
    for pool, components in protocol['pooling'].items():
        heads = POINT_HEADS if pool == 'point-pool' else list(range(14))
        predictions[pool] = sum(weight*(predictions[kind] if kind == 'conditional-normalizing-flow'
                                       else predictions[kind][:, heads]) for kind, weight in components.items())
    markets = []
    for j, target in enumerate(original['targets']):
        candidates = []
        for kind, values in predictions.items():
            heads = POINT_HEADS if kind in ['conditional-normalizing-flow', 'point-pool'] else ([0] if kind == 'bradley-terry-winner' else list(range(14)))
            if j not in heads:
                continue
            h = heads.index(j)
            p = values[:, h]
            candidates.append({'name': kind, 'metrics': metrics(y[:, j], p),
                'rawMetrics': metrics(y[:, j], raw[kind][:, h]) if kind in raw else None,
                'pairedBrierDifference': float(np.mean((p-y[:, j])**2-(base[:, j]-y[:, j])**2)),
                'perCompetition': {league: metrics(y[mask, j], p[mask]) for league in sorted({r['league'] for r in rows})
                                   for mask in [np.asarray([r['league'] == league for r in rows])]}})
        markets.append({'target': target, 'reference': metrics(y[:, j], base[:, j]), 'candidates': candidates})
    indices = np.asarray([i for i, _ in qualified], dtype=int)
    odds = {'n': len(qualified), 'roi': None, 'executablePricesVerified': False}
    if len(indices):
        odds['bookmaker'] = metrics(y[indices, 0], np.asarray([p for _, p in qualified]))
        odds['candidates'] = {name: metrics(y[indices, 0], values[indices, 0]) for name, values in predictions.items()
                              if name not in ['conditional-normalizing-flow', 'point-pool']}
    report = {'version': protocol['version'], 'generatedAt': datetime.now(timezone.utc).isoformat(),
        'protocol': protocol, 'n': len(rows), 'observedDays': len({r['at']//86400000 for r in rows}),
        'from': datetime.fromtimestamp(min(r['at'] for r in rows)/1000, timezone.utc).isoformat(),
        'to': datetime.fromtimestamp(max(r['at'] for r in rows)/1000, timezone.utc).isoformat(),
        'duplicateIds': 0, 'overlapWithOriginalFeatureIds': 0, 'fittingPerformed': False,
        'recalibrationPerformed': False, 'selectedWinner': None, 'confidenceIntervals': None,
        'uncertaintyReason': 'One calendar day; temporal block intervals are not estimable with the prespecified minimum days.',
        'markets': markets, 'historicalQuoteSubset': odds, 'artifacts': artifact_manifest,
        'inputHashes': {'features': sha(fp), 'sealed': sha(sp), 'sourceCode': sha(Path(__file__))},
        'totalSeconds': time.monotonic()-begin, 'independentValidation': False,
        'operationallyValidated': False, 'automaticPromotion': False, 'roi': None}
    if any(sha(DATA / a['file']) != a['sha256'] for a in artifact_manifest):
        raise ValueError('Frozen artifact modified')
    with output.open('x') as f:
        json.dump(report, f, indent=2, allow_nan=False)
    with audit_path.open('x') as f:
        os.chmod(f.fileno(), 0o600)
        json.dump({'ids': [r['id'] for r in rows], 'y': y.tolist(),
                   'predictions': {k: p.tolist() for k, p in predictions.items()}, 'reportHash': sha(output)}, f, allow_nan=False)
    print(json.dumps({'n': len(rows), 'markets': len(markets), 'quotePairs': len(qualified),
                      'seconds': report['totalSeconds'], 'newTraining': False}), flush=True)


if __name__ == '__main__':
    main()
