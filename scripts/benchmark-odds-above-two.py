"""Count winner picks above decimal 2.00 on timestamp-verified historical prices."""
import importlib.util
import json
from pathlib import Path

from odds_outcome_summary import summarize

spec = importlib.util.spec_from_file_location('odds_analysis', Path(__file__).with_name('analyze-forecast-odds.py'))
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)

THRESHOLD = 2.0


def above_two(cases):
    return [row for row in cases if
            (row['p'] > .5 and row['homeOdds'] > THRESHOLD)
            or (row['p'] < .5 and row['awayOdds'] > THRESHOLD)]


def main():
    report = {
        'market': 'match winner',
        'strictlyAbove': THRESHOLD,
        'selection': 'Most probable side only, exact ties omitted',
        'prospectiveValidation': False,
        'cohorts': [],
    }
    for name, prices, models in source.load_cohorts(all_matched=True):
        cohort = {'name':name, 'n':len(prices),
                  'days':len({r['at']//86400000 for r in prices.values()}), 'models':{}}
        for model, cases in models.items():
            picks = above_two(cases)
            cohort['models'][model] = {'all': summarize(picks), 'positiveEV': summarize(picks, positive_ev=True)}
        report['cohorts'].append(cohort)
    with (source.ROOT/'research/report-odds-above-two-v26.json').open('x') as file:
        json.dump(report, file, indent=2, allow_nan=False)
        file.write('\n')


if __name__ == '__main__':
    main()
