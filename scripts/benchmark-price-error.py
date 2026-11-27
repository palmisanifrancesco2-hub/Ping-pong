"""Test whether the disagreement with Bet365 improves later forecasts and price selection."""
import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit, logit

from advanced_benchmark import DAY, metrics
from projection_ensemble import paired_interval

ROOT = Path(__file__).resolve().parents[1]


def power_probability(prices):
    inverse = 1 / np.asarray(prices, dtype=float)
    lo = np.zeros(len(inverse))
    hi = np.ones(len(inverse))
    while np.any((inverse ** hi[:, None]).sum(axis=1) > 1):
        hi *= 2
    for _ in range(50):
        mid = (lo + hi) / 2
        too_large = (inverse ** mid[:, None]).sum(axis=1) > 1
        lo = np.where(too_large, mid, lo)
        hi = np.where(too_large, hi, mid)
    return inverse[:, 0] ** ((hi + lo) / 2)


def fit_adjustment(market, sport, labels, penalty, *, add_residual):
    market_logit = logit(market)
    features = market_logit[:, None]
    if add_residual:
        features = np.column_stack((features, logit(sport)-market_logit))
    def loss(coefs):
        linear = market_logit + features @ coefs
        value = np.logaddexp(0, linear) - labels * linear
        gradient = features.T @ (expit(linear) - labels)
        return value.sum() + penalty/2 * (coefs @ coefs), gradient + penalty*coefs
    fit = minimize(loss, np.zeros(features.shape[1]), jac=True, method='L-BFGS-B',
                   bounds=[(-.75, 1), (0, 1)][:features.shape[1]])
    if not fit.success:
        raise RuntimeError(fit.message)
    return fit.x


def collect_predictions(day, truth, power, sport, plan):
    scored, market_calibrated, residual, folds = [], [], [], []
    for target in np.unique(day):
        train = day <= target-plan['calibrationLagDays']
        n, days = int(train.sum()), len(np.unique(day[train]))
        if n < plan['minimumCalibrationMatches'] or days < plan['minimumCalibrationDays']:
            continue
        test = np.flatnonzero(day == target)
        market_weight, = fit_adjustment(power[train], sport[train], truth[train], plan['residualPenalty'], add_residual=False)
        scale, weight = fit_adjustment(power[train], sport[train], truth[train], plan['residualPenalty'], add_residual=True)
        market = logit(power[test])
        scored.extend(test)
        market_calibrated.extend(expit((1+market_weight)*market))
        residual.extend(expit((1+scale)*market + weight*(logit(sport[test])-market)))
        folds.append({'day': date.fromordinal(int(target)).isoformat(), 'n': len(test), 'priorMatches': n,
                      'priorDays': days, 'sportsResidualWeight': float(weight)})
    return np.asarray(scored, dtype=int), np.asarray(market_calibrated), np.asarray(residual), folds


def selections(sport, screen, prices, minimum):
    """Keep the sports favorite fixed even if the screening estimate prefers the other player."""
    home = sport > .5
    price = np.where(home, prices[:, 0], prices[:, 1])
    other = np.where(home, prices[:, 1], prices[:, 0])
    ev = np.where(home, screen, 1-screen) * price - 1
    raw_ev = np.maximum(sport, 1-sport) * price - 1
    keep = (sport != .5) & (price >= minimum) & (raw_ev > 1e-12) & (ev > 1e-12)
    return home, price, keep, price > other


def summarize(day, prices, profit, won, subset, bootstrap):
    n = int(subset.sum())
    if not n:
        return {'n': 0, 'correct': 0, 'wrong': 0, 'meanOdds': None, 'theoreticalRoi': None, 'roiInterval': None}
    rows = [{'at': int(d) * DAY} for d in day[subset]]
    wins = int(won[subset].sum())
    return {'n': n, 'correct': wins, 'wrong': n-wins, 'meanOdds': float(prices[subset].mean()),
            'theoreticalRoi': float(profit[subset].mean()), 'roiInterval': paired_interval(rows, profit[subset], bootstrap)}


def evaluate(raw, plan):
    day, truth, sport, prices = (np.asarray([r[key] for r in raw]) for key in ('day', 'outcome', 'sports', 'prices'))
    if (prices.shape != (len(day), 2) or not np.isfinite(prices).all() or (prices <= 1).any()
            or not np.isin(truth, (0, 1)).all() or not ((sport > 0) & (sport < 1)).all()
            or (day <= 0).any() or plan['calibrationLagDays'] < 1):
        raise ValueError('Invalid historical sample or protocol')
    inverse = 1/prices
    proportion = inverse[:, 0]/inverse.sum(axis=1)
    power = power_probability(prices)
    index, calibrated, residual, folds = collect_predictions(day, truth, power, sport, plan)
    if not len(index):
        raise ValueError('Insufficient priced examples after temporal fit')
    methods = {'sports': sport[index], 'proportional': proportion[index], 'power': power[index],
               'calibratedPower': calibrated, 'powerWithSportsResidual': residual}
    results = {name: metrics(truth[index], p) for name,p in methods.items()}
    for baseline in ('calibratedPower', 'power', 'sports'):
        delta = (residual-truth[index])**2 - (methods[baseline]-truth[index])**2
        results[baseline]['differenceResidualMinusBaseline'] = {
            'mean': float(delta.mean()),
            'interval': paired_interval([{'at': int(d)*DAY} for d in day[index]], delta, plan['bootstrap'])}
    policies = {}
    for name in ('sports', 'calibratedPower', 'powerWithSportsResidual'):
        home, price, selected, underdog = selections(sport[index], methods[name], prices[index], plan['minimumPrice'])
        win = home == truth[index]
        profit = win * price - 1
        policies[name] = {group: summarize(day[index], price, profit, win, subset, plan['bootstrap']) for group,subset in
                          {'all': selected, 'bet365Underdogs': selected & underdog, 'aboveTwo': selected & (price > 2)}.items()}
    return {'pricedMatches': len(day), 'agreementPowerAndProportional': int(((power > .5) == (proportion > .5)).sum()),
            'devigFullSample': {'proportional': metrics(truth, proportion), 'power': metrics(truth, power)},
            'evaluatedMatches': len(index), 'evaluatedDays': len(folds), 'folds': folds, 'models': results,
            'policies': policies, 'retrospective': True, 'executablePricesVerified': False, 'operationallyValidated': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sample', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'research/report-price-error-v37.json')
    args = parser.parse_args()
    plan = json.loads((ROOT/'research/protocol-price-error-v37.json').read_text())
    raw = args.sample.read_bytes()
    output = {'protocol': plan, 'sampleSha256': hashlib.sha256(raw).hexdigest(), **evaluate(json.loads(raw), plan)}
    with args.output.open('x') as handle:
        json.dump(output, handle, indent=2, allow_nan=False)
        handle.write('\n')


if __name__ == '__main__':
    main()
