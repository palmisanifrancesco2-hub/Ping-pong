"""Bounded exploratory comparison. Never imported by production or promoted automatically."""
import os
os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
import hashlib
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
import numpy as np
import joblib
import torch
from catboost import CatBoostClassifier
from ngboost import NGBClassifier
from ngboost.distns import Bernoulli
from sklearn.tree import DecisionTreeRegressor
from sklearn.preprocessing import StandardScaler
from nflows.flows.base import Flow
from nflows.distributions.normal import StandardNormal
from nflows.transforms.base import CompositeTransform
from nflows.transforms.autoregressive import MaskedAffineAutoregressiveTransform
from nflows.transforms.permutations import ReversePermutation
from advanced_benchmark import nested_split, choose_shrink, metrics
from projection_ensemble import aligned_indices, paired_interval

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
stamp = lambda s: int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp() * 1000)
matrix = lambda rows, key: np.asarray([r[key] for r in rows], dtype=float)
POINT_HEADS = [5, 6, 7, 10, 11, 12, 13]


def points_to_probabilities(samples):
    """Samples shape [events, draws, (total, difference)]; fixed half-point lines."""
    samples = np.asarray(samples)
    if samples.ndim != 3 or samples.shape[2] != 2 or not np.isfinite(samples).all():
        raise ValueError('Invalid point samples')
    return np.column_stack([(samples[:, :, dim] > line).mean(axis=1)
                            for dim, line in [(0, 74.5), (0, 79.5), (0, 84.5),
                                              (1, 5.5), (1, -5.5), (1, 9.5), (1, -9.5)]])


def fit_heads(kind, rows, config, seed):
    x, y = matrix(rows, 'x'), matrix(rows, 'y')
    models = []
    for j in range(y.shape[1]):
        if len(np.unique(y[:, j])) < 2:
            models.append(float(y[:, j].mean()))
            continue
        if kind == 'catboost':
            model = CatBoostClassifier(**config, random_seed=seed, verbose=False,
                                       allow_writing_files=False, loss_function='Logloss')
        else:
            model = NGBClassifier(**config, Dist=Bernoulli, random_state=seed,
                                  Base=DecisionTreeRegressor(max_depth=3, min_samples_leaf=15,
                                                             random_state=seed))
        models.append(model.fit(x, y[:, j].astype(int)))
    return models


def predict_heads(models, rows):
    x = matrix(rows, 'x')
    return np.column_stack([np.full(len(rows), model) if isinstance(model, float)
                            else model.predict_proba(x)[:, 1] for model in models])


def fit_flow(rows, config, seed):
    torch.manual_seed(seed)
    torch.set_num_threads(2)
    xs, ys = StandardScaler(), StandardScaler()
    x = torch.tensor(xs.fit_transform(matrix(rows, 'x')), dtype=torch.float32)
    # Dequantize observed integer totals/differences during fitting only.
    rng = np.random.default_rng(seed)
    y = matrix(rows, 'points') + rng.uniform(-.5, .5, (len(rows), 2))
    y = torch.tensor(ys.fit_transform(y), dtype=torch.float32)
    transforms = []
    for _ in range(config['transforms']):
        transforms.extend([ReversePermutation(features=2),
                           MaskedAffineAutoregressiveTransform(features=2,
                               hidden_features=config['hidden_features'], context_features=x.shape[1])])
    flow = Flow(CompositeTransform(transforms), StandardNormal([2]))
    optimizer = torch.optim.Adam(flow.parameters(), lr=config['learning_rate'])
    flow.train()
    for _ in range(config['epochs']):
        optimizer.zero_grad()
        loss = -flow.log_prob(y, context=x).mean()
        if not torch.isfinite(loss):
            raise ValueError('Nonfinite flow loss')
        loss.backward()
        torch.nn.utils.clip_grad_norm_(flow.parameters(), 5.)
        optimizer.step()
    flow.eval()
    return flow, xs, ys


def predict_flow(model, rows, draws, seed):
    flow, xs, ys = model
    torch.manual_seed(seed)
    context = torch.tensor(xs.transform(matrix(rows, 'x')), dtype=torch.float32)
    out = []
    with torch.no_grad():
        for chunk in context.split(32):
            samples = flow.sample(draws, context=chunk).numpy()
            samples = samples * ys.scale_ + ys.mean_
            out.append(points_to_probabilities(samples))
    return np.concatenate(out)


def main():
    output = ROOT / 'research/report-v18-probabilistic.json'
    if output.exists():
        raise RuntimeError('Do not overwrite inspected report')
    protocol = json.loads((ROOT / 'research/protocol-v18-probabilistic.json').read_text())
    fp, rp = ROOT / protocol['input'], ROOT / protocol['results']
    if sha(fp) != protocol['inputHash'] or sha(rp) != protocol['resultsHash']:
        raise ValueError('Changed source data')
    features = json.loads(fp.read_text())
    results = {r['id']: r for r in json.loads(rp.read_text())['results']}
    rows = features['rows']
    if features['inputHash'] != sha(rp) or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Invalid provenance/duplicates')
    for row in rows:
        sets = results[row['id']]['sets']
        a, b = sum(s[0] for s in sets), sum(s[1] for s in sets)
        ha = sum(s[0] > s[1] for s in sets)
        y = [int(results[row['id']]['homeWon']), int(sets[0][0] > sets[0][1]),
             int(sum(sets[0]) > 19.5), int(len(sets) > 3.5), int(len(sets) > 4.5),
             int(a+b > 74.5), int(a+b > 79.5), int(a+b > 84.5),
             int(2*ha-len(sets) > 1.5), int(2*ha-len(sets) > -1.5),
             int(a-b > 5.5), int(a-b > -5.5), int(a-b > 9.5), int(a-b > -9.5)]
        if row['y'] != y or not row['featuresAvailable'] < row['at'] < row['available']:
            raise ValueError('Invalid outcome or temporal feature provenance')
        row['points'] = [a+b, a-b]
    tested, folds, artifacts = [], [], []
    predictions, raws = defaultdict(list), defaultdict(list)
    start_time = time.monotonic()
    starts = list(map(stamp, protocol['foldStarts']))
    final = stamp(protocol['endExclusive'])
    for i, start in enumerate(starts):
        end = starts[i+1] if i+1 < len(starts) else final
        train, tune, refit, cal, test = nested_split(rows, start, end, protocol)
        test = [r for r in test if r['available'] < final]
        info = dict(start=start, end=end, train=len(train), tuning=len(tune), refit=len(refit),
                    calibration=len(cal), test=len(test))
        if (len(train) < protocol['minimumTraining'] or len(tune) < protocol['minimumTuning']
                or len(cal) < protocol['minimumCalibration'] or not test):
            folds.append({**info, 'skipped': True})
            continue
        info['models'] = {}
        for kind in protocol['models']:
            begin = time.monotonic()
            config = protocol['fixed'][kind]
            heads = POINT_HEADS if kind == 'conditional-normalizing-flow' else list(range(14))
            if kind == 'conditional-normalizing-flow':
                model = fit_flow(refit, config, protocol['seed'])
                cp = predict_flow(model, cal, config['samples'], protocol['seed']+i)
                tp = predict_flow(model, test, config['samples'], protocol['seed']+i+100)
                artifact = {'state_dict': model[0].state_dict(), 'xScaler': model[1], 'yScaler': model[2]}
            else:
                model = fit_heads(kind, refit, config, protocol['seed'])
                cp, tp = predict_heads(model, cal), predict_heads(model, test)
                artifact = {'models': model}
            cb, tb = matrix(cal, 'baseline')[:, heads], matrix(test, 'baseline')[:, heads]
            weights = choose_shrink(cp, cb, matrix(cal, 'y')[:, heads], protocol['shrinkWeights'])
            predictions[kind].append(tb + weights * (tp-tb))
            raws[kind].append(tp)
            path = DATA / f'probabilistic-v18-fold-{i}-{kind}.joblib'
            if path.exists():
                raise RuntimeError('Do not overwrite private model')
            artifact.update(protocol=protocol, heads=heads, calibrationWeights=weights, validated=False)
            joblib.dump(artifact, path)
            os.chmod(path, 0o600)
            artifacts.append(dict(file=path.name, sha256=sha(path), bytes=path.stat().st_size))
            info['models'][kind] = dict(heads=heads, weights=weights.tolist(), seconds=time.monotonic()-begin)
            print(json.dumps(dict(fold=i, model=kind, test=len(test), **info['models'][kind])), flush=True)
        tested.extend(test)
        folds.append(info)
    previous = json.loads((DATA / 'advanced-v16-audit.json').read_text())
    order = aligned_indices([r['id'] for r in tested], previous['ids'])
    y, baseline = matrix(tested, 'y'), matrix(tested, 'baseline')
    pooled = {k: np.concatenate(v) for k, v in predictions.items()}
    raw = {k: np.concatenate(v) for k, v in raws.items()}
    markets = []
    for j, target in enumerate(features['targets']):
        candidates = []
        for kind in protocol['models']:
            heads = POINT_HEADS if kind == 'conditional-normalizing-flow' else list(range(14))
            if j not in heads:
                continue
            h = heads.index(j)
            p = pooled[kind][:, h]
            delta = (p-y[:, j])**2-(baseline[:, j]-y[:, j])**2
            candidates.append(dict(name=kind, metrics=metrics(y[:, j], p),
                rawMetrics=metrics(y[:, j], raw[kind][:, h]),
                pairedBrierDifference={'mean': float(delta.mean()), **paired_interval(tested, delta, protocol)},
                perCompetition={league: metrics(y[mask, j], p[mask])
                    for league in sorted({r['league'] for r in tested})
                    for mask in [np.asarray([r['league'] == league for r in tested])]}))
        earlier = {kind: metrics(y[:, j], np.asarray(values)[order, j])
                   for kind, values in previous['predictions'].items()
                   if kind != 'bradley-terry-winner' or j == 0}
        markets.append(dict(target=target, reference=metrics(y[:, j], baseline[:, j]),
                            previous=earlier, candidates=candidates, operationalWinner=None))
    import importlib.metadata as metadata
    report = dict(version=protocol['version'], generatedAt=datetime.now(timezone.utc).isoformat(),
        protocol=protocol, n=len(tested), observedDays=len({r['at']//86400000 for r in tested}),
        folds=folds, markets=markets, artifacts=artifacts, seconds=time.monotonic()-start_time,
        environment={name: metadata.version(name) for name in ['catboost', 'ngboost', 'torch', 'nflows', 'numpy', 'scikit-learn']},
        independentValidation=False, operationallyValidated=False, automaticPromotion=False, roi=None,
        monteCarloMaximumStandardError=(.25/2048)**.5)
    with output.open('x') as f:
        json.dump(report, f, indent=2, allow_nan=False)
    audit = dict(ids=[r['id'] for r in tested], y=y.tolist(),
                 predictions={k: v.tolist() for k, v in pooled.items()},
                 rawPredictions={k: v.tolist() for k, v in raw.items()}, reportHash=sha(output))
    with (DATA / 'probabilistic-v18-audit.json').open('x') as f:
        os.chmod(f.fileno(), 0o600)
        json.dump(audit, f, allow_nan=False)
    print(json.dumps(dict(completed=True, n=len(tested), seconds=report['seconds'])), flush=True)


if __name__ == '__main__':
    main()
