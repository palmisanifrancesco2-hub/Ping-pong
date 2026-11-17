"""Read-only recheck of saved datasets. No network, credentials, training or DB writes.

Live HTTP evidence is captured separately from unauthenticated public probes.
Outputs aggregates only, never player names or event-level predictions.
"""
import importlib.util
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
spec = importlib.util.spec_from_file_location('inventory', Path(__file__).with_name('inventory-data-v16.py'))
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


def main():
    output = ROOT / 'research/data-audit-20261117.json'
    if output.exists():
        raise RuntimeError('Do not overwrite an inspected audit')
    primary = inventory.load(DATA / '3000-data.json')
    forward = inventory.load(DATA / 'forward-v3.json.archive.json')
    paths = [DATA / '3000-data.json', DATA / 'forward-v3.json.archive.json',
             DATA / 'market-v8-features.json', DATA / 'table_tennis_wtt_men_std.csv',
             DATA / 'table_tennis_wtt_women_std.csv', DATA / 'setka-september-2022.csv']
    hashes_before = {str(p.relative_to(ROOT)): inventory.digest(p) for p in paths}
    main_inventory = inventory.normalized_results(primary['results'], 'MoviOdds saved snapshot', paths[0])
    forward_inventory = inventory.normalized_results(forward, 'MoviOdds saved forward archive', paths[1])
    men, men_ids = inventory.wtt(paths[3].name, 'men')
    women, women_ids = inventory.wtt(paths[4].name, 'women')
    features = inventory.load(paths[2])
    rows = features['rows']
    results = {r['id']: r for r in primary['results']}
    checks = Counter()
    for row in rows:
        match = results.get(row['id'])
        if match is None:
            checks['missingSourceResult'] += 1
            continue
        sets = match['sets']
        a, b = sum(s[0] for s in sets), sum(s[1] for s in sets)
        ha = sum(s[0] > s[1] for s in sets)
        expected = [int(match['homeWon']), int(sets[0][0] > sets[0][1]),
                    int(sum(sets[0]) > 19.5), int(len(sets) > 3.5), int(len(sets) > 4.5),
                    int(a+b > 74.5), int(a+b > 79.5), int(a+b > 84.5),
                    int(2*ha-len(sets) > 1.5), int(2*ha-len(sets) > -1.5),
                    int(a-b > 5.5), int(a-b > -5.5), int(a-b > 9.5), int(a-b > -9.5)]
        if row['y'] != expected:
            checks['outcomeMismatch'] += 1
        if not row['featuresAvailable'] < row['at'] < row['available']:
            checks['invalidTemporalOrder'] += 1
        if len(row['x']) != 63 or any(not math.isfinite(v) for v in row['x']):
            checks['invalidFeatures'] += 1
    checks['duplicateIds'] = len(rows) - len({r['id'] for r in rows})
    checks['sourceHashMismatch'] = int(features['inputHash'] != inventory.digest(paths[0]))
    qualified = inventory.load(DATA / 'v16-qualified-market-baselines.json')
    matched_ids = {r['id'] for r in rows}
    bad_pairs = 0
    for row in qualified['rows']:
        result = results.get(row['id'])
        payload = inventory.load(DATA / '3000-data.json.cache' / (row['id'] + '.json'))
        at = inventory.strict_start(payload, result) if result else None
        if (at != row['at'] or not inventory.strict_pair(payload, result, at)
                or row['id'] not in matched_ids or row['featuresAvailable'] >= at):
            bad_pairs += 1
    main_ids, forward_ids = set(results), {r['id'] for r in forward}
    benchmarks = {}
    for filename in ['report-v16-benchmark.json', 'report-v18-probabilistic.json']:
        path = ROOT / 'research' / filename
        report = inventory.load(path)
        winner = report['markets'][0]
        benchmarks[filename] = {
            'sha256': inventory.digest(path), 'generatedAt': report['generatedAt'],
            'n': report['n'], 'observedDays': report['observedDays'],
            'independentValidation': report['independentValidation'],
            'operationallyValidated': report['operationallyValidated'],
            'winner': [{'name': c['name'], 'metrics': c['metrics']} for c in winner['candidates']],
        }
    report = {
        'version': 'read-only-data-audit-20261117',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'scope': 'Local dataset revalidation and separately observed public HTTP responses; no current private DB access.',
        'moviodds': [main_inventory, forward_inventory],
        'overlap': {'common': len(main_ids & forward_ids), 'distinctUnion': len(main_ids | forward_ids),
                    'forwardAdditional': len(forward_ids - main_ids),
                    'wttRawIdsCollideAcrossGender': len(men_ids & women_ids)},
        'wtt': [men, women], 'setka': inventory.setka(),
        'features': {'rows': len(rows), 'featureCount': 63, 'targets': features['targets'],
                     'checks': dict(checks), 'datasets': inventory.features()},
        'historicalClosing': inventory.closing_inventory(results),
        'qualifiedOdds': {'rows': len(qualified['rows']), 'invalidOnRecheck': bad_pairs,
                          'sourceSha256': inventory.digest(DATA / 'v16-qualified-market-baselines.json'),
                          'liveExecutabilityVerified': False},
        'benchmarks': benchmarks,
        'publicSourceProbe': {
            'date': '2026-11-17', 'resultsHTTP': 401, 'oddsHTTP': 401,
            'response': 'API key required', 'signup': 'https://moviodds.com/account',
            'authenticatedRequestTested': False,
            'documentation': 'https://moviodds.com/doc', 'keyHeader': 'X-API-Key',
            'publishedPricing': 'https://moviodds.com/pricing/',
            'publishedFreeLimits': {'requestsPerMonth': 5000, 'requestsPerMinute': 30,
                                    'markets': 'main lines', 'historyHours': 24,
                                    'closingLines': False, 'websocket': False},
            'limitsCaveat': 'Pricing also says Free changes soon/current limits stay until then; active account limits not authenticated or verified.',
            'continuousThirtySecondPollingRequestsPerThirtyDays': 86400,
        },
        'privateProduction': {
            'currentCountsVerified': False, 'currentTrainingOutcomesVerified': False,
            'lastVerifiedSnapshotAt': '2026-11-12T16:59:31.110Z',
            'captured': 800, 'settled': 730, 'pending': 67, 'invalid': 3, 'observedDays': 8,
            'winnerCorrect': 379, 'winnerWrong': 351,
            'evidence': 'Existing production build logs, deployment dpl_CQsjZ7dcQ9dhK3SM2FrpGMTF5PMv',
            'newAuditBuildStarted': False,
            'block': 'Automatic approval review rejected a production-env diagnostic build; no retry or alternative secret-bearing execution attempted.',
        },
        'modelPromoted': False, 'newTrainingExecuted': False,
        'inputs': hashes_before,
    }
    if hashes_before != {str(p.relative_to(ROOT)): inventory.digest(p) for p in paths}:
        raise RuntimeError('Unexpected source mutation')
    with output.open('x') as f:
        json.dump(report, f, indent=2, allow_nan=False)
        f.write('\n')
    print(json.dumps({'report': str(output.relative_to(ROOT)), 'mainRows': len(results),
                      'unionRows': len(main_ids | forward_ids), 'featureChecks': dict(checks),
                      'qualifiedPairs': len(qualified['rows']), 'invalidPairs': bad_pairs,
                      'remoteCurrentVerified': False}))


if __name__ == '__main__':
    main()
