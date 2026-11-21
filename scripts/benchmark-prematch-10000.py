"""Compare two fixed prematch model families across non-overlapping date folds."""
import hashlib
import importlib.util
import json
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from scipy.special import expit, logit

from advanced_benchmark import metrics
from odds_outcome_summary import summarize
from projection_ensemble import paired_interval

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'.research-data'


def load_module(name, basename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(basename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def configure():
    read = lambda name: json.loads((ROOT/'research'/name).read_text())
    plan = read('protocol-prematch-10000-v31.json')
    archive = read(plan['archiveProtocol'])
    rules = read(plan['modelProtocol'])
    setka_rules = read(rules['archive'])
    paths = [DATA/'forward-v3.json.archive.json', DATA/'setka-september-2022.csv']
    for path, expected in zip(paths, [archive['movioddsSha256'],setka_rules['sha256']]):
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Unexpected archive hash')
    return plan, archive, rules, setka_rules, paths


def features(expanded, archive_path, archive):
    ids = defaultdict(list)
    entries, counts = expanded.load_moviodds(archive_path, archive, fixture_ids=ids)
    rows = []
    for league, matches in entries.items():
        daily = defaultdict(list)
        for day, history, _ in matches:
            daily[day].append(history)
        computed = expanded.replay.setka.build_features(daily, archive)
        for key, match, row in zip(ids[league], matches, computed, strict=True):
            if match[0] != row['day'] or match[1][1] != row['y'][0]:
                raise ValueError('Unaligned result')
            rows.append({**row, 'id':key, 'league':league})
    if len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Duplicate match')
    return rows, counts


def quote_pairs(rows, archive_path, inventory):
    matches = {r['id']:r for r in json.loads(archive_path.read_text())}
    pairs = {}
    for row in rows:
        key = row['id']
        path = DATA/'3000-data.json.cache'/(key+'.json')
        if not path.is_file():
            continue
        payload = json.loads(path.read_text())
        match = matches[key]
        at = inventory.strict_start(payload, match)
        if at is None or datetime.fromtimestamp(at/1000,timezone.utc).date().toordinal() != row['day']:
            continue
        if not inventory.strict_pair(payload, match, at):
            continue
        pair = {s['side']:s['pre_close']['odds_dec'] for s in payload['selections']
                if s.get('group_id') == '920000' and s.get('market_id') == '920000'
                and s.get('line') == 'To Win' and s.get('side') in [match['home'],match['away']]}
        pairs[key] = {'homeOdds':pair[match['home']], 'awayOdds':pair[match['away']]}
    return pairs


def main():
    plan, archive, rules, setka_rules, paths = configure()
    expanded = load_module('expanded', 'benchmark-live-expanded.py')
    inventory = load_module('inventory', 'inventory-data-v16.py')
    above_two = load_module('odds', 'benchmark-odds-above-two.py').above_two
    rows, counts = features(expanded, paths[0], archive)
    setka, _ = expanded.replay.setka.read_matches(paths[1])
    older = expanded.replay.setka.build_features(setka, setka_rules)
    boundaries = [date.fromisoformat(d).toordinal() for d in plan['testBoundariesUtc']]
    folds, tested = [], []
    forecasts = defaultdict(list)
    block = lambda sample: [(r['x'], (0,0), r['y'][0], r['day']) for r in sample]
    for start,end in zip(boundaries,boundaries[1:]):
        train = [r for r in rows if r['day'] <= start-plan['trainingEndsDaysBeforeFold']]
        cal = [r for r in rows if start-plan['calibrationStartsDaysBeforeFold'] <= r['day'] <= start-plan['calibrationEndsDaysBeforeFold']]
        test = [r for r in rows if start <= r['day'] < end]
        fitted_report, fit = expanded.replay.fit_stages(
            {0:{'train':block(older+train),'cal':block(cal),'test':block(test)}},rules)
        x = np.asarray([r['x']+[0,0] for r in test])
        for name,(model,calibrator) in fit[0]['models'].items():
            raw = model.predict_proba(x)[:,1]
            prob = calibrator.predict_proba(logit(np.clip(raw,1e-6,1-1e-6)).reshape(-1,1))[:,1]
            forecasts[name].extend(prob)
        forecasts['elo'].extend(expit(x[:,0]*np.log(10)))
        tested.extend(test)
        folds.append({'from':date.fromordinal(start).isoformat(), 'untilExclusive':date.fromordinal(end).isoformat(),
                      'trainMoviOdds':len(train),'trainSetka':len(older),'calibration':len(cal),
                      'test':len(test),'testMetrics':fitted_report[0]['testMetrics']})
    if len(tested) < 10000 or len({r['id'] for r in tested}) != len(tested):
        raise ValueError('Test count or uniqueness failed')
    truth = np.asarray([r['y'][0] for r in tested])
    pairs = quote_pairs(tested, paths[0], inventory)
    quoted = [i for i,r in enumerate(tested) if r['id'] in pairs]
    report = {'protocol':plan,'sourceCounts':counts,'n':len(tested),
              'testDays':len({r['day'] for r in tested}),'folds':folds,'quoted':len(quoted),
              'models':{},'retrospective':True,'operationallyValidated':False}
    market = [(1/pairs[tested[i]['id']]['homeOdds'])/(1/pairs[tested[i]['id']]['homeOdds']+
               1/pairs[tested[i]['id']]['awayOdds']) for i in quoted]
    report['marketNoVigOnQuotedMatches'] = metrics(truth[quoted],market)
    for name, p in forecasts.items():
        p = np.asarray(p)
        selections = [{'p':float(p[i]),'y':int(truth[i]),**pairs[tested[i]['id']]} for i in quoted]
        delta = (p-truth)**2-(np.asarray(forecasts['elo'])-truth)**2
        report['models'][name] = {'all':metrics(truth,p),'quoted':metrics(truth[quoted],p[quoted]),
                                  'aboveTwo':summarize(above_two(selections)),
                                  'pairedBrierVsElo':paired_interval(tested,delta,plan['pairedComparisons']) if name!='elo' else None}
    with (ROOT/'research/report-prematch-10000-v31.json').open('x') as file:
        json.dump(report,file,indent=2,allow_nan=False)
        file.write('\n')


if __name__ == '__main__':
    main()
