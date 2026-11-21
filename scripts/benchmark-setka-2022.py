"""Chronological replay on the distinct Setka SCORE archive."""
import csv
import hashlib
import json
from collections import Counter, defaultdict, deque
from datetime import datetime, date
from pathlib import Path

import numpy as np
import sklearn
from scipy.special import expit, logit
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from advanced_benchmark import metrics
from projection_ensemble import paired_interval

ROOT = Path(__file__).resolve().parents[1]


def read_matches(path, *, set_history=None, point_history=None):
    rows_by_day, counts, seen = defaultdict(list), Counter(), set()
    with path.open(newline='') as file:
        for row in csv.DictReader(file):
            counts['raw'] += 1
            key = tuple(v for k, v in row.items() if k != 'X')
            if key in seen:
                counts['duplicates'] += 1
                continue
            seen.add(key)
            day = datetime.strptime(row['Date'], '%m/%d/%Y').date().toordinal()
            players = tuple(' '.join(row[k].casefold().split()) for k in ('Player1', 'Player2'))
            score = [0, 0]
            points = []
            set_scores = []
            valid = bool(all(players)) and players[0] != players[1]
            ended = False
            for idx in range(1, 6):
                pair = tuple(row[f'P{side}_G{idx}'] for side in (1, 2))
                if pair == ('NA', 'NA'):
                    ended = True
                    continue
                if ended or 3 in score or not all(s.isdecimal() for s in pair):
                    valid = False
                    break
                a, b = map(int, pair)
                if max(a, b) < 11 or abs(a-b) < 2 or (max(a, b) > 11 and abs(a-b) != 2):
                    valid = False
                    break
                score[int(b > a)] += 1
                points.append(a-b)
                set_scores.append((a,b))
            won = int(score[0] > score[1])
            if (not valid or max(score) != 3 or [str(v) for v in score] != [row['Sets_P1'], row['Sets_P2']]
                    or row['HomeWinner'] != str(won)):
                counts['invalid'] += 1
                continue
            rows_by_day[day].append((players, won, score[0]-score[1], sum(points), len(points)))
            if set_history is not None:
                set_history[day].append(tuple(int(gap > 0) for gap in points))
            if point_history is not None:
                point_history[day].append(set_scores)
            counts['valid'] += 1
    return rows_by_day, counts


def build_features(matches, protocol):
    ratings = defaultdict(lambda: 1500.)
    history = defaultdict(lambda: deque(maxlen=20))
    pair_history = defaultdict(lambda: deque(maxlen=20))
    rows = []
    days = sorted(matches)
    eligible = iter(days)
    next_day = next(eligible, None)
    for day in days:
        cutoff = day - protocol['historyLagCalendarDays']
        while next_day is not None and next_day <= cutoff:
            delta = Counter()
            for (home, away), won, sets, points, length in matches[next_day]:
                expected = expit((ratings[home]-ratings[away])*np.log(10)/400)
                change = protocol['eloK']*(won-expected)
                delta[home] += change
                delta[away] -= change
                history[home].append((won, sets, points, length))
                history[away].append((1-won, -sets, -points, length))
                pair_history[tuple(sorted((home, away)))].append(won if home < away else 1-won)
            for player, change in delta.items():
                ratings[player] += change
            next_day = next(eligible, None)
        for (home, away), won, _, _, length in matches[day]:
            def form(player):
                recent = list(history[player])
                return (np.sum(recent, axis=0) if recent else np.zeros(4)) / (len(recent)+5)
            a, b = form(home), form(away)
            pair = pair_history[tuple(sorted((home, away)))]
            h2h = (sum(pair)-len(pair)/2)/(len(pair)+10)
            diff = (ratings[home]-ratings[away])/400
            rows.append({'day':day, 'at':(day-date(1970,1,1).toordinal())*86400000,
                         'x':[diff, *list(a-b), float(a[3]+b[3]), h2h if home < away else -h2h,
                              len(pair), min(len(history[home]), len(history[away]))],
                         'y':[won, int(length > 3.5)], 'scoreClass':(0 if won else 3)+length-3})
    return rows


def main():
    protocol = json.loads((ROOT/'research/protocol-setka-2022-v25.json').read_text())
    path = ROOT/'.research-data/setka-september-2022.csv'
    if hashlib.sha256(path.read_bytes()).hexdigest() != protocol['sha256']:
        raise ValueError('Unexpected dataset hash')
    matches, counts = read_matches(path)
    rows = build_features(matches, protocol)
    ordinal = lambda key: date.fromisoformat(protocol[key]).toordinal()
    train = [r for r in rows if r['day'] <= ordinal('trainingThrough')]
    cal = [r for r in rows if ordinal('calibrationFrom') <= r['day'] <= ordinal('calibrationThrough')]
    test = [r for r in rows if ordinal('testFrom') <= r['day'] <= ordinal('testThrough')]
    x = lambda group: np.asarray([r['x'] for r in group])
    y = lambda group, j: np.asarray([r['y'][j] for r in group])
    results = {}
    for target, name in enumerate(protocol['markets']):
        # The market-specific reference uses probabilities available before the test.
        ref = (expit(x(test)[:, 0]*np.log(10)) if target == 0 else
               np.full(len(test), y(train, target).mean()))
        truth = y(test, target)
        results[name] = {'reference': metrics(truth, ref), 'models': {}}
        candidates = {
            'logistic': make_pipeline(StandardScaler(), LogisticRegression(C=protocol['logisticC'])),
            'gradientBoosting': HistGradientBoostingClassifier(max_iter=100, max_leaf_nodes=15,
                min_samples_leaf=50, l2_regularization=2, early_stopping=False,
                random_state=protocol['seed'])
        }
        for label, model in candidates.items():
            model.fit(x(train), y(train, target))
            raw_cal = model.predict_proba(x(cal))[:,1]
            raw_test = model.predict_proba(x(test))[:,1]
            logits = lambda p: logit(np.clip(p, 1e-6, 1-1e-6)).reshape(-1,1)
            calibration = LogisticRegression(C=1).fit(logits(raw_cal), y(cal,target))
            p = calibration.predict_proba(logits(raw_test))[:,1]
            delta = (p-truth)**2-(ref-truth)**2
            scored = metrics(truth, p)
            results[name]['models'][label] = {
                'raw':metrics(truth, raw_test), 'calibrated':scored,
                'deltaBrier':float(delta.mean()), 'pairedBlockInterval':paired_interval(test, delta, protocol),
                'daily': [{'date':date.fromordinal(day).isoformat(), 'n':sum(r['day']==day for r in test),
                           'deltaBrier':float(delta[[r['day']==day for r in test]].mean())}
                          for day in sorted({r['day'] for r in test})]
            }
    report = {'protocol':protocol, 'counts':counts, 'train':len(train), 'calibration':len(cal),
              'test':len(test), 'historyOnly':len(rows)-len(train)-len(cal)-len(test),
              'testDays':len({r['day'] for r in test}), 'sklearn':sklearn.__version__,
              'markets':results, 'oddsAvailable':False, 'operationallyValidated':False}
    with (ROOT/'research/report-setka-2022-v25.json').open('x') as file:
        json.dump(report, file, indent=2, allow_nan=False)
        file.write('\n')


if __name__ == '__main__':
    main()
