"""Join frozen winner forecasts to pre-decision prices; no training or wagering."""
import hashlib
import importlib.util
import json
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
from odds_outcome_summary import summarize

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()


def load_audit(name, report):
    audit = json.loads((DATA/name).read_text())
    if audit['reportHash'] != sha(ROOT/'research'/report):
        raise ValueError('Audit/report mismatch')
    if len(audit['ids']) != len(set(audit['ids'])):
        raise ValueError('Duplicate audit IDs')
    return audit


def join(ids, truth, predictions, prices):
    out = []
    if len(ids) != len(set(ids)) or len(ids) != len(truth) or len(ids) != len(predictions):
        raise ValueError('Invalid forecast join')
    for event, y, p in zip(ids, truth, predictions):
        if event not in prices:
            continue
        price = prices[event]
        if int(y) != price['y']:
            raise ValueError('Quote/outcome mismatch')
        out.append({'p': float(p), 'y': int(y), 'homeOdds': price['homeOdds'], 'awayOdds': price['awayOdds'], 'at': price['at']})
    if len(out) != len(prices):
        raise ValueError('Incomplete comparison cohort')
    return out


def load_cohorts(*, all_matched=False):
    protocol = json.loads((ROOT/'research/protocol-v22-odds-outcomes.json').read_text())
    for file, expected in protocol['inputHashes'].items():
        if sha(ROOT/file) != expected:
            raise ValueError('Changed input')
    spec = importlib.util.spec_from_file_location('inventory', ROOT/'scripts/inventory-data-v16.py')
    inv = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inv)
    main_results = {r['id']: r for r in inv.load(DATA/'3000-data.json')['results']}
    odds = load_audit('v16-odds-audit.json', 'report-v16-odds.json')
    advanced = load_audit('advanced-v16-audit.json', 'report-v16-benchmark.json')
    qualified = {r['id']: r for r in inv.load(DATA/'v16-qualified-market-baselines.json')['rows']}
    main_prices = {}
    main_ids = [event for event in advanced['ids'] if event in qualified] if all_matched else odds['ids']
    for event in main_ids:
        q, r = qualified[event], main_results[event]
        payload = inv.load(DATA/'3000-data.json.cache'/(event+'.json'))
        if inv.strict_start(payload, r) != q['at'] or not inv.strict_pair(payload, r, q['at']):
            raise ValueError('Invalid historical price pair')
        main_prices[event] = {'homeOdds': q['homeOdds'], 'awayOdds': q['awayOdds'], 'y': int(r['homeWon']), 'at': q['at']}
    transfer = load_audit('frozen-transfer-v20-audit.json', 'report-v20-frozen-transfer.json')
    source = inv.load(DATA/'market-v8-confirmation-features.json')['rows']
    results = {r['id']: r for r in inv.load(DATA/'market-v8-confirmation/sealed.json')['results']}
    transfer_prices = {}
    for row in source:
        event = row['id']
        payload, r = inv.load(DATA/'market-v8-confirmation'/(event+'.json')), results[event]
        if inv.strict_start(payload, r) != row['at'] or not inv.strict_pair(payload, r, row['at']):
            continue
        selections = [s['pre_close'] for s in payload['selections'] if s.get('group_id') == '920000'
                      and s.get('market_id') == '920000' and s.get('line') == 'To Win'
                      and s.get('side') in [r['home'], r['away']]]
        home = next(q['odds_dec'] for q in selections if q['side'] == r['home'])
        away = next(q['odds_dec'] for q in selections if q['side'] == r['away'])
        transfer_prices[event] = {'homeOdds': home, 'awayOdds': away, 'y': int(r['homeWon']), 'at': row['at']}
    if set(main_prices) & set(transfer_prices):
        raise ValueError('Overlapping comparison cohorts')
    probabilistic = load_audit('probabilistic-v18-audit.json', 'report-v18-probabilistic.json')
    coherent = load_audit('coherent-v21-audit.json', 'report-v21-coherent-scores.json')
    main_models, transfer_models = {}, {}
    add = lambda target, name, ids, y, p, quotes: target.update({name: join(ids, y, p, quotes)})
    for name, values in advanced['predictions'].items():
        add(main_models, 'v16/'+name, advanced['ids'], np.asarray(advanced['y'])[:, 0], np.asarray(values)[:, 0], main_prices)
    for name, values in probabilistic['predictions'].items():
        if name != 'conditional-normalizing-flow':
            add(main_models, 'v18/'+name, probabilistic['ids'], np.asarray(probabilistic['y'])[:, 0], np.asarray(values)[:, 0], main_prices)
    if not all_matched:
        for name, values in odds['predictions'].items():
            add(main_models, 'v16-odds/'+name, odds['ids'], odds['y'], np.asarray(values).reshape(-1), main_prices)
    for name, values in transfer['predictions'].items():
        if name not in ['conditional-normalizing-flow', 'point-pool']:
            add(transfer_models, 'v20/'+name, transfer['ids'], np.asarray(transfer['y'])[:, 0], np.asarray(values)[:, 0], transfer_prices)
    for name, values in coherent['predictions'].items():
        add(main_models, 'v21/'+name, coherent['ids'], (np.asarray(coherent['y']) < 3).astype(int),
            np.asarray(values)[:, :3].sum(axis=1), main_prices)
    for name, values in coherent['transferPredictions'].items():
        add(transfer_models, 'v21/'+name, coherent['transferIds'], (np.asarray(coherent['transferY']) < 3).astype(int),
            np.asarray(values)[:, :3].sum(axis=1), transfer_prices)
    return [('v16-matched-test' if all_matched else 'v16-asof-test-88', main_prices, main_models),
            ('v20-transfer-qualified-28', transfer_prices, transfer_models)]


def main():
    output = ROOT/'research/report-v22-odds-outcomes.json'
    if output.exists():
        raise RuntimeError('Do not overwrite inspected analysis')
    protocol = json.loads((ROOT/'research/protocol-v22-odds-outcomes.json').read_text())
    cohorts = []
    for name, prices, models in load_cohorts():
        market_rows = [{'y': v['y'], 'p': (1/v['homeOdds'])/(1/v['homeOdds']+1/v['awayOdds']),
                        'homeOdds': v['homeOdds'], 'awayOdds': v['awayOdds']} for v in prices.values()]
        models['bookmaker-reference'] = market_rows
        summaries = []
        for model, cases in models.items():
            summaries.append({'model': model, 'allDecided': summarize(cases),
                'minimumOdds130': summarize(cases, minimum=1.3),
                'minimumOdds130PositiveEV': summarize(cases, minimum=1.3, positive_ev=True,
                                                     tolerance=protocol['positiveEVTolerance'])})
        cohorts.append({'cohort': name, 'availableQuoteCases': len(prices),
                        'observedDays': len({v['at']//86400000 for v in prices.values()}),
                        'from': datetime.fromtimestamp(min(v['at'] for v in prices.values())/1000, timezone.utc).isoformat(),
                        'to': datetime.fromtimestamp(max(v['at'] for v in prices.values())/1000, timezone.utc).isoformat(),
                        'models': summaries})
    report = {'version': protocol['version'], 'generatedAt': datetime.now(timezone.utc).isoformat(),
              'protocol': protocol, 'cohorts': cohorts, 'uniqueQuoteCases': sum(c['availableQuoteCases'] for c in cohorts),
              'realBetsPlaced': False, 'newModelTraining': False, 'independentValidation': False,
              'operationallyValidated': False, 'automaticPromotion': False, 'verifiedHistoricalROI': None}
    with output.open('x') as f:
        json.dump(report, f, indent=2, allow_nan=False)
    print(json.dumps({'cohorts': [c['availableQuoteCases'] for c in cohorts],
                      'uniqueCases': report['uniqueQuoteCases'], 'newTraining': False}))


if __name__ == '__main__':
    main()
