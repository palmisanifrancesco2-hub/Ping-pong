"""Chronological six-class BO5 benchmark; exploratory, never a runtime import."""
import os
os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
import json
import time
import hashlib
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
import numpy as np
import torch
import joblib
from sklearn.preprocessing import StandardScaler
from catboost import CatBoostClassifier
from advanced_benchmark import nested_split, metrics
from projection_ensemble import paired_interval, aligned_indices
from coherent_score_model import (score_class, distribution, derived, categorical_losses,
                                   categorical_metrics, calibrate, calibrated)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
stamp = lambda s: int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()*1000)
matrix = lambda rows: np.asarray([r['x'] for r in rows], dtype=float)
labels = lambda rows: np.asarray([r['category'] for r in rows], dtype=int)


def baseline_fit(results, cutoff, strength):
    counts, global_counts = defaultdict(lambda: np.zeros(6)), np.zeros(6)
    for result in results:
        if stamp(result['availableAt']) < cutoff:
            counts[result['league']][result['category']] += 1
            global_counts[result['category']] += 1
    prior = (global_counts+1)/(global_counts.sum()+6)
    return {'global': prior, 'leagues': {league: (c+strength*prior)/(c.sum()+strength)
                                      for league, c in counts.items()}, 'cutoff': cutoff}


def baseline_predict(model, rows):
    return distribution([model['leagues'].get(r['league'], model['global']) for r in rows])


def network(hidden, dropout):
    return torch.nn.Sequential(torch.nn.Linear(63, hidden), torch.nn.Tanh(),
                               torch.nn.Dropout(dropout), torch.nn.Linear(hidden, 6))


def fit(kind, rows, parameters, fixed, seed):
    x, y = matrix(rows), labels(rows)
    if kind == 'categorical-catboost':
        return CatBoostClassifier(**fixed, **parameters, loss_function='MultiClass',
            random_seed=seed, verbose=False, allow_writing_files=False).fit(x, y)
    torch.manual_seed(seed)
    scaler = StandardScaler().fit(x)
    tx = torch.tensor(scaler.transform(x), dtype=torch.float32)
    ty = torch.tensor(y, dtype=torch.long)
    model = network(parameters['hidden'], fixed['dropout'])
    optimizer = torch.optim.AdamW(model.parameters(), lr=fixed['learningRate'],
                                  weight_decay=parameters['weightDecay'])
    model.train()
    for _ in range(fixed['epochs']):
        optimizer.zero_grad()
        loss = torch.nn.functional.cross_entropy(model(tx), ty)
        if not torch.isfinite(loss):
            raise ValueError('Nonfinite neural loss')
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 5)
        optimizer.step()
    model.eval()
    return model, scaler


def predict(kind, model, rows):
    if kind == 'categorical-catboost':
        p = model.predict_proba(matrix(rows))
    else:
        model, scaler = model
        with torch.no_grad():
            p = torch.softmax(model(torch.tensor(scaler.transform(matrix(rows)), dtype=torch.float32)), dim=1).numpy().astype(float)
        # Float32 softmax sums can deviate slightly; normalize before scoring.
        p /= p.sum(axis=1, keepdims=True)
    return distribution(p)


def main():
    torch.set_num_threads(2)
    began = time.monotonic()
    protocol_path = ROOT / 'research/protocol-v21-coherent-scores.json'
    protocol = json.loads(protocol_path.read_text())
    output = ROOT / 'research/report-v21-coherent-scores.json'
    audit_path = DATA / 'coherent-v21-audit.json'
    if output.exists() or audit_path.exists():
        raise RuntimeError('Do not overwrite inspected results')
    fp, rp = ROOT/protocol['input'], ROOT/protocol['results']
    if sha(fp) != protocol['inputHash'] or sha(rp) != protocol['resultsHash']:
        raise ValueError('Source hashes changed')
    original = json.loads(fp.read_text())
    results = json.loads(rp.read_text())['results']
    for r in results:
        r['category'] = score_class(r['sets'])
    byid = {r['id']: r for r in results}
    rows = original['rows']
    if len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Duplicate matches')
    for r in rows:
        r['category'] = byid[r['id']]['category']
        expected = derived(np.eye(6)[r['category']:r['category']+1])[0]
        if (not r['featuresAvailable'] < r['at'] < r['available'] or len(r['x']) != 63
                or not np.isfinite(r['x']).all()
                or not np.array_equal(expected, np.asarray(r['y'])[protocol['originalTargetIndices']])):
            raise ValueError('Invalid temporal row or score-derived labels')
    predictions, raw = defaultdict(list), defaultdict(list)
    tested, baseline_values, folds, artifacts, last = [], [], [], [], None
    starts, final = list(map(stamp, protocol['foldStarts'])), stamp(protocol['endExclusive'])
    for i, start in enumerate(starts):
        end = starts[i+1] if i+1 < len(starts) else final
        train, tune, refit, cal, test = nested_split(rows, start, end, protocol)
        test = [r for r in test if r['available'] < final]
        info = dict(start=start, end=end, train=len(train), tuning=len(tune), refit=len(refit), calibration=len(cal), test=len(test))
        if (len(train) < protocol['minimumTraining'] or len(tune) < protocol['minimumTuning']
                or len(cal) < protocol['minimumCalibration'] or not test):
            folds.append({**info, 'skipped': True})
            continue
        base = baseline_fit(results, start-protocol['calibrationDays']*86400000, protocol['baselinePrior'])
        bc, bt = baseline_predict(base, cal), baseline_predict(base, test)
        fold_cal, fold_test, saved = {}, {}, {}
        info['models'] = {}
        for kind in protocol['models']:
            tick = time.monotonic()
            grid, fixed = protocol['parameterGrid'][kind], protocol['fixed'][kind]
            tuned = [fit(kind, train, parameters, fixed, protocol['seed']+i) for parameters in grid]
            losses = [float(categorical_losses(predict(kind, m, tune), labels(tune))[0].mean()) for m in tuned]
            selected = int(np.argmin(losses))
            fitted = fit(kind, refit, grid[selected], fixed, protocol['seed']+i)
            cp, tp = predict(kind, fitted, cal), predict(kind, fitted, test)
            params = calibrate(cp, bc, labels(cal), protocol['temperatures'], protocol['shrinkWeights'])
            pc, pt = calibrated(cp, bc, params), calibrated(tp, bt, params)
            fold_cal[kind], fold_test[kind] = pc, pt
            predictions[kind].append(pt)
            raw[kind].append(tp)
            artifact = {'protocol': protocol, 'parameters': grid[selected], 'calibration': params,
                        'baseline': base, 'validated': False}
            if kind == 'categorical-mlp':
                artifact.update(state_dict=fitted[0].state_dict(), scaler=fitted[1])
            else:
                artifact['model'] = fitted
            path = DATA/f'coherent-v21-fold-{i}-{kind}.joblib'
            if path.exists():
                raise RuntimeError('Private artifact exists')
            joblib.dump(artifact, path)
            os.chmod(path, 0o600)
            artifacts.append({'file': path.name, 'sha256': sha(path), 'bytes': path.stat().st_size})
            saved[kind] = (fitted, params)
            info['models'][kind] = dict(tuningLogLoss=losses, selectedParameters=grid[selected],
                                        calibration=params, seconds=time.monotonic()-tick)
        chosen = min(fold_cal, key=lambda k: categorical_losses(fold_cal[k], labels(cal))[0].mean())
        predictions['calibration-selector'].append(fold_test[chosen])
        predictions['fixed-pool'].append(sum(fold_test.values())/2)
        info['selectedFamily'] = chosen
        baseline_values.append(bt)
        tested.extend(test)
        folds.append(info)
        last = base, saved, chosen
        print(json.dumps({'fold': i, **info}), flush=True)
    values = {k: np.concatenate(v) for k, v in predictions.items()}
    raw_values = {k: np.concatenate(v) for k, v in raw.items()}
    baseline = np.concatenate(baseline_values)
    y = labels(tested)
    previous = json.loads((DATA/'advanced-v16-audit.json').read_text())
    aligned_indices([r['id'] for r in tested], previous['ids'])
    # The previous report's metrics are comparable only after this exact ID check.
    previous_report = json.loads((ROOT/'research/report-v16-benchmark.json').read_text())
    joint = []
    _, base_loss = categorical_losses(baseline, y)
    for kind, p in values.items():
        _, loss = categorical_losses(p, y)
        joint.append({'name': kind, 'metrics': categorical_metrics(p, y),
                      'rawMetrics': categorical_metrics(raw_values[kind], y) if kind in raw_values else None,
                      'pairedBrierDifference': paired_interval(tested, loss-base_loss, protocol)})
    targets = []
    by = derived(baseline)
    for j, target in enumerate(protocol['derivedTargets']):
        truth = np.asarray([r['y'][protocol['originalTargetIndices'][j]] for r in tested])
        comparisons = []
        for kind, p in values.items():
            dp = derived(p)[:, j]
            comparisons.append({'name': kind, 'metrics': metrics(truth, dp),
                'pairedBrierDifference': paired_interval(tested, (dp-truth)**2-(by[:, j]-truth)**2, protocol),
                'perCompetition': {league: metrics(truth[mask], dp[mask]) for league in sorted({r['league'] for r in tested})
                                   for mask in [np.asarray([r['league'] == league for r in tested])]}})
        old = previous_report['markets'][protocol['originalTargetIndices'][j]]
        targets.append({'target': target, 'reference': metrics(truth, by[:, j]), 'candidates': comparisons,
                        'previousIndependentHeads': [{'name': c['name'], 'metrics': c['metrics']} for c in old['candidates']]})
    cf, cr = ROOT/protocol['confirmationFeatures'], ROOT/protocol['confirmationResults']
    if sha(cf) != protocol['confirmationFeaturesHash'] or sha(cr) != protocol['confirmationResultsHash']:
        raise ValueError('Changed transfer data')
    transfer = json.loads(cf.read_text())['rows']
    transfer_results = {r['id']: r for r in json.loads(cr.read_text())['results']}
    if ({r['id'] for r in transfer} & {r['id'] for r in rows}
            or len({r['id'] for r in transfer}) != len(transfer)):
        raise ValueError('Transfer overlap')
    for r in transfer:
        r['category'] = score_class(transfer_results[r['id']]['sets'])
        if not r['featuresAvailable'] < r['at'] < r['available']:
            raise ValueError('Noncausal transfer')
    base, saved, chosen = last
    tb = baseline_predict(base, transfer)
    transferred = {kind: calibrated(predict(kind, m, transfer), tb, params) for kind, (m, params) in saved.items()}
    transferred['calibration-selector'] = transferred[chosen]
    transferred['fixed-pool'] = sum(transferred[kind] for kind in protocol['models'])/2
    transfer_report = {'n': len(transfer), 'observedDays': len({r['at']//86400000 for r in transfer}),
        'jointReference': categorical_metrics(tb, labels(transfer)),
        'joint': {k: categorical_metrics(p, labels(transfer)) for k, p in transferred.items()},
        'targets': [{'target': target, 'reference': metrics(np.asarray([r['y'][protocol['originalTargetIndices'][j]] for r in transfer]), derived(tb)[:, j]),
                     'models': {k: metrics(np.asarray([r['y'][protocol['originalTargetIndices'][j]] for r in transfer]), derived(p)[:, j])
                                for k, p in transferred.items()}} for j, target in enumerate(protocol['derivedTargets'])]}
    report = {'version': protocol['version'], 'generatedAt': datetime.now(timezone.utc).isoformat(), 'protocol': protocol,
        'n': len(tested), 'observedDays': len({r['at']//86400000 for r in tested}), 'folds': folds,
        'jointReference': categorical_metrics(baseline, y), 'joint': joint, 'markets': targets, 'transfer': transfer_report,
        'artifacts': artifacts, 'sourceCodeHash': sha(__file__), 'seconds': time.monotonic()-began,
        'fittedModels': len([f for f in folds if not f.get('skipped')])*6,
        'independentValidation': False, 'operationallyValidated': False, 'automaticPromotion': False, 'roi': None}
    if any(sha(DATA/a['file']) != a['sha256'] for a in artifacts):
        raise ValueError('Artifact changed')
    with output.open('x') as f:
        json.dump(report, f, indent=2, allow_nan=False)
    with audit_path.open('x') as f:
        os.chmod(f.fileno(), 0o600)
        json.dump({'ids': [r['id'] for r in tested], 'y': y.tolist(), 'baseline': baseline.tolist(),
                   'predictions': {k: p.tolist() for k, p in values.items()},
                   'transferIds': [r['id'] for r in transfer], 'transferY': labels(transfer).tolist(),
                   'transferPredictions': {k: p.tolist() for k, p in transferred.items()}, 'reportHash': sha(output)}, f, allow_nan=False)
    print(json.dumps({'completed': True, 'n': len(tested), 'transfer': len(transfer),
                      'artifacts': len(artifacts), 'seconds': report['seconds']}), flush=True)


if __name__ == '__main__':
    main()
