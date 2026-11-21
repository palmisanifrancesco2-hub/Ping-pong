"""Measure incremental signal over the bookmaker on the fixed v22 cohorts."""
import importlib.util
import json
from datetime import datetime, timezone

from advanced_benchmark import metrics
from odds_outcome_summary import summarize
from pathlib import Path

spec = importlib.util.spec_from_file_location('odds_analysis', Path(__file__).with_name('analyze-forecast-odds.py'))
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


def evaluate(cases, weight, minimum):
    mixed = []
    for case in cases:
        home, away = case['homeOdds'], case['awayOdds']
        market = (1 / home) / (1 / home + 1 / away)
        mixed.append({**case, 'market': market, 'p': market + weight * (case['p'] - market)})
    y = [row['y'] for row in mixed]
    scored = metrics(y, [row['p'] for row in mixed])
    market_scores = metrics(y, [row['market'] for row in mixed])
    selected = summarize(mixed, minimum=minimum, positive_ev=True)
    # Match-by-match differences aggregated by day. Four observed days are too few
    # to infer a stable edge, so these are descriptive sensitivity checks only.
    dates = sorted({row['at'] // 86400000 for row in mixed})
    daily = []
    for date in dates:
        rows = [row for row in mixed if row['at'] // 86400000 == date]
        delta = sum((row['p']-row['y'])**2 - (row['market']-row['y'])**2 for row in rows)
        daily.append({'date': datetime.fromtimestamp(date*86400, timezone.utc).date().isoformat(),
                      'n': len(rows), 'deltaBrier': delta/len(rows)})
    return {'sportWeight': weight, 'metrics': scored, 'deltaBrier': scored['brier']-market_scores['brier'],
            'deltaLogLoss': scored['logLoss']-market_scores['logLoss'], 'daily': daily,
            'selected': selected, 'theoreticalReturnPerUnit': (
                selected['theoreticalNetUnitsAtRecordedPrices']/selected['selected'] if selected['selected'] else None)}


def main():
    root = source.ROOT / 'research'
    protocol = json.loads((root/'protocol-market-blend-v24.json').read_text())
    report = {'protocol': protocol, 'cohorts': [], 'operationallyValidated': False}
    for index, (name, prices, models) in enumerate(source.load_cohorts()):
        cohort = {'name': name, 'n': len(prices), 'models': {}}
        for label, aliases in protocol['models'].items():
            cohort['models'][label] = [evaluate(models[aliases[index]], weight, protocol['minimumOdds'])
                                       for weight in protocol['sportWeights']]
        report['cohorts'].append(cohort)
    with (root/'report-market-blend-v24.json').open('x') as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write('\n')


if __name__ == '__main__':
    main()
