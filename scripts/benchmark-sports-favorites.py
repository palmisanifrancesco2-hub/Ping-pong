"""Replay sports-only favorites. Bet365 prices enter only after probabilities are frozen."""
import argparse
import hashlib
import importlib.util
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from scipy.special import expit, logit
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from advanced_benchmark import metrics
from projection_ensemble import paired_interval

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
CANDIDATES = ('logistica-v32', 'simmetrica', 'simmetrica-recente-per-lega', 'media-simmetriche')


def features(rows):
    x = np.asarray([r['x'] for r in rows])
    # Columns with a direction. Remaining columns describe confidence, not a player.
    directional = x[:, [0, 1, 2, 3, 4, 6]]
    support = x[:, [7, 8]] / 20
    return np.column_stack((directional, *(directional * support[:, i:i+1] for i in range(2))))


def sports_logits(train, calibration, test, leagues, cutoff, plan, localized):
    scaler = StandardScaler(with_mean=False).fit(features(train))

    def inputs(rows):
        x = scaler.transform(features(rows))
        if not localized:
            return x
        return np.column_stack((x, *(x * plan['leagueInteractionScale'] *
                                     np.asarray([r['league'] == league for r in rows])[:, None]
                                     for league in leagues)))

    x = inputs(train)
    y = np.asarray([r['y'][0] for r in train])
    weights = np.ones(len(train))
    if localized:
        weights = np.asarray([2 ** (-(cutoff-r['day']) / plan['recentHalfLifeDays']) for r in train])
    model = LogisticRegression(C=0.1, fit_intercept=False, max_iter=500)
    model.fit(np.vstack((x, -x)), np.r_[y, 1-y], sample_weight=np.tile(weights, 2))
    return [model.decision_function(inputs(rows)) for rows in (calibration, test)]


def calibrate(logits, labels, temperatures):
    return min(temperatures, key=lambda t: metrics(labels, expit(t * logits))['logLoss'])


def priced_pair(paths, row, result, inventory):
    candidates = []
    for path in paths:
        if not path.is_file():
            continue
        try:
            payload = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        at = inventory.strict_start(payload, result)
        if at is None or datetime.fromtimestamp(at/1000, timezone.utc).date().toordinal() != row['day']:
            continue
        if not inventory.strict_pair(payload, result, at):
            continue
        pair = {s['side']: s['pre_close'] for s in payload['selections']
                if s.get('group_id') == '920000' and s.get('market_id') == '920000'
                and s.get('line') == 'To Win' and s.get('side') in (result['home'], result['away'])}
        home, away = (pair[player] for player in (result['home'], result['away']))
        if any(q.get('market_id') != '920000' or q.get('line') != 'To Win' or q.get('period')
               for q in (home, away)):
            continue
        freshness = min(inventory.stamp(q['ts']) for q in (home, away))
        candidates.append((at, freshness, home['odds_dec'], away['odds_dec']))
    if not candidates or len({p[0] for p in candidates}) != 1:
        return None
    newest = max(p[1] for p in candidates)
    prices = {p[2:] for p in candidates if p[1] == newest}
    return next(iter(prices)) if len(prices) == 1 else None


def select_favorite(p, home, away, minimum, buffer):
    if p == 0.5:
        return None
    side = int(p > 0.5)
    price = home if side else away
    edge = max(p, 1-p) * price - 1
    return (side, price) if price >= minimum and edge > buffer + 1e-12 else None


def roi_summary(rows, profits, prices, correct, bootstrap):
    n = len(rows)
    return {'n': n, 'correct': correct, 'wrong': n-correct,
            'accuracy': correct/n if n else None,
            'averageOdds': float(np.mean(prices)) if n else None,
            'roiAtRecordedPrices': float(np.mean(profits)) if n else None,
            'roiBlockInterval': paired_interval(rows, np.asarray(profits), bootstrap) if n else None}


def evaluate_prices(rows, p, y, prices, minimum, buffer, bootstrap):
    buckets = {'all': ([], [], [], 0), 'bet365Underdogs': ([], [], [], 0), 'aboveTwo': ([], [], [], 0)}
    for row, prob, actual, (home, away) in zip(rows, p, y, prices, strict=True):
        pick = select_favorite(prob, home, away, minimum, buffer)
        if pick is None:
            continue
        side, price = pick
        win = int(side == actual)
        names = ['all']
        if price > (away if side else home):
            names.append('bet365Underdogs')
        if price > 2:
            names.append('aboveTwo')
        for name in names:
            selected, profits, odds, correct = buckets[name]
            selected.append(row)
            profits.append(win * price - 1)
            odds.append(price)
            buckets[name] = selected, profits, odds, correct + win
    return {name: roi_summary(*bucket, bootstrap) for name, bucket in buckets.items()}


def main(output, priced_sample=None, include_challenger=False):
    protocol_path = ROOT / 'research/protocol-sports-favorites-v36.json'
    plan = json.loads(protocol_path.read_text())
    spec = importlib.util.spec_from_file_location('prematch', Path(__file__).with_name('benchmark-prematch-10000.py'))
    prematch = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prematch)
    base, archive, rules, setka, paths = prematch.configure(plan['baseProtocol'])
    expanded = prematch.load_module('expanded', 'benchmark-live-expanded.py')
    inventory = prematch.load_module('inventory', 'inventory-data-v16.py')
    rows, counts = prematch.features(expanded, paths[0], archive)
    older, _ = expanded.replay.setka.read_matches(paths[1])
    older = expanded.replay.setka.build_features(older, setka)
    leagues = archive['leagues']
    boundaries = [date.fromisoformat(v).toordinal() for v in plan['testBoundariesUtc']]
    if sorted(set(boundaries)) != boundaries or base['trainingEndsDaysBeforeFold'] <= base['calibrationStartsDaysBeforeFold']:
        raise ValueError('Overlapping dates')
    folds, test_rows = [], []
    predictions = {name: [] for name in CANDIDATES}
    stage = lambda group: [(r['x'], (0, 0), r['y'][0], r['day']) for r in group]
    for start, end in zip(boundaries, boundaries[1:]):
        cutoff = start - base['trainingEndsDaysBeforeFold']
        train = [r for r in rows if r['day'] <= cutoff]
        cal = [r for r in rows if start-base['calibrationStartsDaysBeforeFold'] <= r['day'] <=
               start-base['calibrationEndsDaysBeforeFold']]
        test = [r for r in rows if start <= r['day'] < end]
        # Use the existing v32 pipeline and its prior-only Platt calibrator for the reference.
        _, fitted = expanded.replay.fit_stages({0: {'train': stage(older+train),
                                                        'cal': stage(cal), 'test': stage(test)}}, rules)
        model, calibrator = fitted[0]['models']['logistic']
        x = np.asarray([r['x']+[0, 0] for r in test])
        raw = model.predict_proba(x)[:, 1]
        reference = calibrator.predict_proba(logit(np.clip(raw, 1e-6, 1-1e-6)).reshape(-1, 1))[:, 1]
        labels = [r['y'][0] for r in cal]
        calibrated, temps = [], []
        for localized in (False, True):
            # The local training excludes Setka 2022, which has no shared player IDs.
            log_cal, log_test = sports_logits(train, cal, test, leagues, cutoff, plan, localized)
            temp = calibrate(log_cal, labels, plan['calibrationTemperatures'])
            calibrated.append(expit(temp * log_test))
            temps.append(temp)
        fold_probs = [reference, *calibrated, np.mean(calibrated, axis=0)]
        for name, prob in zip(CANDIDATES, fold_probs, strict=True):
            predictions[name].extend(prob)
        test_rows.extend(test)
        folds.append({'from': date.fromordinal(start).isoformat(), 'untilExclusive': date.fromordinal(end).isoformat(),
                      'trainLocal': len(train), 'calibration': len(cal), 'test': len(test), 'temperatures': temps,
                      'metrics': {name: metrics([r['y'][0] for r in test], p)
                                  for name, p in zip(CANDIDATES, fold_probs, strict=True)}})
    if len({r['id'] for r in test_rows}) != len(test_rows):
        raise ValueError('Match was tested twice')
    archive_results = {r['id']: r for r in json.loads(paths[0].read_text())}
    eligibility = [i for i,r in enumerate(test_rows) if r['x'][-1] >= plan['eligibilityMinMatchesPerPlayer']]
    quote_indices, prices = [], []
    for i in eligibility:
        row = test_rows[i]
        key = row['id']
        pair = priced_pair([DATA/dir_name/(key+'.json') for dir_name in plan['priceCaches']], row,
                           archive_results[key], inventory)
        if pair is not None:
            quote_indices.append(i)
            prices.append(pair)
    truth = np.asarray([r['y'][0] for r in test_rows])
    quoted_rows = [test_rows[i] for i in quote_indices]
    reference = np.asarray(predictions[CANDIDATES[0]])
    models = {}
    for name, prob in predictions.items():
        prob = np.asarray(prob)
        models[name] = {'all': metrics(truth, prob), 'supported': metrics(truth[eligibility], prob[eligibility]),
                        'brierDifferenceVsReference': paired_interval(test_rows, (prob-truth)**2-(reference-truth)**2,
                                                                      plan['bootstrap']) if name != CANDIDATES[0] else None,
                        'quoted': metrics(truth[quote_indices], prob[quote_indices]) if prices else None,
                        'priceRules': {str(buffer): evaluate_prices(quoted_rows, prob[quote_indices], truth[quote_indices],
                                                                    prices, plan['minimumOdds'], buffer, plan['bootstrap'])
                                       for buffer in plan['evBuffers']}}
    report = {'protocol': plan, 'archiveSha256': hashlib.sha256(paths[0].read_bytes()).hexdigest(),
              'acceptedArchive': counts['valid'], 'test': len(test_rows), 'folds': folds,
              'supported': len(eligibility), 'quotedSupported': len(prices),
              'quotedDays': len({r['day'] for r in quoted_rows}), 'models': models,
              'marketNoVig': metrics(truth[quote_indices], [b/(a+b) for a,b in prices]) if prices else None,
              'retrospective': True, 'executablePricesVerified': False, 'operationallyValidated': False}
    with output.open('x') as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write('\n')
    if priced_sample is not None:
        sample = [{'day': row['day'], 'outcome': int(truth[index]), 'prices': price,
                   'sports': float(reference[index]),
                   **({'symmetric': float(predictions['simmetrica'][index])} if include_challenger else {})}
                  for row, index, price in zip(quoted_rows, quote_indices, prices, strict=True)]
        with os.fdopen(os.open(priced_sample, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as handle:
            json.dump(sample, handle, allow_nan=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'research/report-sports-favorites-v36.json')
    parser.add_argument('--priced-sample', type=Path, help='Optional private inputs for the price-error benchmark')
    parser.add_argument('--include-challenger',action='store_true',help='Include symmetric estimates in the private sample')
    args = parser.parse_args()
    main(args.output, args.priced_sample, args.include_challenger)
