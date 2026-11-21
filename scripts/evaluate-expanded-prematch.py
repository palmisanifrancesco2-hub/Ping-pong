"""Score frozen v29 models on a later, timestamp-verified prematch cohort."""
import hashlib
import importlib.util
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from scipy.special import logit

from advanced_benchmark import metrics
from odds_outcome_summary import summarize

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'.research-data'


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def main():
    expanded = module('expanded', 'benchmark-live-expanded.py')
    inventory = module('inventory', 'inventory-data-v16.py')
    odds = module('above_two', 'benchmark-odds-above-two.py')
    previous = json.loads((ROOT/'research/report-live-expanded-v29.json').read_text())
    protocol = previous['protocol']
    archive_path = DATA/'forward-v3.json.archive.json'
    artifact_path = DATA/'live-expanded-v29.joblib'
    for path, digest in [(archive_path, protocol['movioddsSha256']), (artifact_path, previous['artifactSha256'])]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('Unexpected source hash')
    candidates = joblib.load(artifact_path)['models']['combined'][0]['models']
    seen = {r['id'] for r in json.loads(archive_path.read_text())}
    contexts, _ = expanded.load_moviodds(archive_path, protocol)
    targets = defaultdict(list)
    for directory in ['market-v8-confirmation','market-v8-extension']:
        folder = DATA/directory
        sealed = json.loads((folder/'sealed.json').read_text())
        results = {r['id']:r for r in sealed['results']}
        for start in sealed['starts']:
            key, at = start['id'], start['at']
            result = results[key]
            league = result['league']
            if league not in contexts:
                continue
            if key in seen:
                raise ValueError('Overlapping event')
            seen.add(key)
            payload = json.loads((folder/(key+'.json')).read_text())
            day = datetime.fromtimestamp(at/1000, timezone.utc).date()
            if (day.isoformat() <= protocol['testThrough'] or inventory.strict_start(payload, result) != at
                    or int(expanded.score_class(result['sets']) < 3) != result['homeWon']):
                raise ValueError('Invalid holdout match')
            players = tuple(' '.join(result[side].casefold().split()) for side in ('home','away'))
            if not all(players) or players[0] == players[1]:
                raise ValueError('Invalid participants')
            prices = None
            if inventory.strict_pair(payload, result, at):
                pair = {s['side']:s['pre_close']['odds_dec'] for s in payload['selections']
                        if s.get('group_id') == '920000' and s.get('market_id') == '920000'
                        and s.get('line') == 'To Win' and s.get('side') in [result['home'],result['away']]}
                prices = {'homeOdds':pair[result['home']], 'awayOdds':pair[result['away']]}
            targets[league, day.toordinal()].append((players, int(result['homeWon']), prices))
    cases = []
    for (league, day), fixtures in targets.items():
        # Every target on a given date uses the same prior history. Zeroed
        # placeholders request feature rows without supplying holdout outcomes.
        daily = defaultdict(list)
        for event_day, history, _ in contexts[league]:
            if event_day <= day-protocol['historyLagCalendarDays']:
                daily[event_day].append(history)
        daily[day] = [(players, 0, 0, 0, 3) for players,_,_ in fixtures]
        features = expanded.replay.setka.build_features(daily, protocol)[-len(fixtures):]
        for row, (_,label,prices) in zip(features,fixtures):
            cases.append({'x':row['x']+[0,0], 'y':label, 'prices':prices})
    x = np.asarray([r['x'] for r in cases])
    y = np.asarray([r['y'] for r in cases])
    indices = [i for i,r in enumerate(cases) if r['prices']]
    market = [(1/cases[i]['prices']['homeOdds'])/(1/cases[i]['prices']['homeOdds']+
              1/cases[i]['prices']['awayOdds']) for i in indices]
    report = {'modelArtifactSha256':previous['artifactSha256'], 'n':len(cases),
              'quoted':len(indices), 'sampleDates':sorted({datetime.fromordinal(day).date().isoformat() for _,day in targets}),
              'marketOnQuotedMatches':metrics(y[indices],market), 'models':{},
              'thresholdExclusive':2, 'retrospective':True, 'operationallyValidated':False}
    for name,(model,calibration) in candidates.items():
        pred = calibration.predict_proba(logit(np.clip(model.predict_proba(x)[:,1],1e-6,1-1e-6)).reshape(-1,1))[:,1]
        quoted = [{'p':float(pred[i]), 'y':int(y[i]), **cases[i]['prices']} for i in indices]
        report['models'][name] = {'all':metrics(y,pred), 'quoted':metrics(y[indices],pred[indices]),
                                  'aboveTwo':summarize(odds.above_two(quoted))}
    with (ROOT/'research/report-prematch-expansion-v30.json').open('x') as file:
        json.dump(report,file,indent=2,allow_nan=False)
        file.write('\n')


if __name__ == '__main__':
    main()
