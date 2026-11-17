"""Descriptive prices of model selections; no real-bet or executable-ROI claim."""
import math
import statistics


def price_stats(values):
    if not values:
        return {'n': 0, 'mean': None, 'median': None, 'min': None, 'max': None}
    return {'n': len(values), 'mean': statistics.mean(values), 'median': statistics.median(values),
            'min': min(values), 'max': max(values)}


def summarize(cases, minimum=None, positive_ev=False, tolerance=1e-12):
    won, lost, undecided, excluded_odds, excluded_ev = [], [], 0, 0, 0
    for row in cases:
        p, y, home, away = (row[k] for k in ['p', 'y', 'homeOdds', 'awayOdds'])
        if (not all(math.isfinite(v) for v in [p, home, away]) or not 0 <= p <= 1
                or y not in [0, 1] or min(home, away) <= 1):
            raise ValueError('Invalid aligned forecast, result or quote')
        if p == .5:
            undecided += 1
            continue
        selected = int(p > .5)
        odds = home if selected else away
        probability = p if selected else 1-p
        if minimum is not None and odds < minimum:
            excluded_odds += 1
            continue
        if positive_ev and probability*odds-1 <= tolerance:
            excluded_ev += 1
            continue
        (won if selected == y else lost).append(odds)
    n = len(won)+len(lost)
    ws, ls = price_stats(won), price_stats(lost)
    return {'eligibleSourceCases': len(cases), 'selected': n, 'correct': ws, 'wrong': ls,
            'undecided': undecided, 'excludedByMinimumOdds': excluded_odds, 'excludedByEV': excluded_ev,
            'accuracy': len(won)/n if n else None,
            'meanWrongMinusCorrect': ls['mean']-ws['mean'] if won and lost else None,
            'theoreticalNetUnitsAtRecordedPrices': sum(won)-n if n else None,
            'realBetsPlaced': False, 'executablePricesVerified': False, 'verifiedHistoricalROI': None}
