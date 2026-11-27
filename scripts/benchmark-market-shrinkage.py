"""Test chronological market anchoring with two independent sports forecasts."""
import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np
from scipy.special import expit, logit

from advanced_benchmark import DAY, metrics
from projection_ensemble import paired_interval

PLAN = {'lagDays':2, 'minimumPriorMatches':70, 'minimumPriorDays':4, 'minimumOdds':1.30,
        'weights':[0, .25, .5, .75, 1], 'priorEffectiveMatches':25, 'strongFavoriteThreshold':.65,
        'bootstrap':{'blockDays':3, 'bootstrapReplicates':10000, 'familyComparisons':2, 'seed':4001}}


def choose_weight(y, market, sport, plan, prior):
    weights = np.asarray(plan['weights'])
    candidates = expit(logit(market)[:, None] + (logit(sport)-logit(market))[:, None]*weights)
    brier = np.sum((candidates-y[:, None])**2, axis=0)
    # Express the penalty in Brier units. With no local labels the weights stay at the pooled estimate.
    penalty = plan['priorEffectiveMatches']*.01*(weights-prior)**2
    return float(weights[np.argmin(brier+penalty)])


def evaluate(rows, plan):
    day, y, prices, main, symmetric = (np.asarray([r[k] for r in rows]) for k in ('day','outcome','prices','sports','symmetric'))
    if (prices.shape!=(len(y),2) or not np.isfinite(prices).all() or (prices<=1).any()
            or not np.isin(y,(0,1)).all() or not all(((p>0)&(p<1)).all() for p in (main,symmetric))):
        raise ValueError('Invalid aligned observations')
    market = prices[:,1]/prices.sum(axis=1)
    sports = (main+symmetric)/2
    regime = np.maximum(market,1-market)>=plan['strongFavoriteThreshold']
    forecasts = {label: np.full(len(y), np.nan) for label in ('global','byMarketStrength')}
    folds = []
    for d in np.unique(day):
        past = day<=d-plan['lagDays']
        if past.sum()<plan['minimumPriorMatches'] or len(np.unique(day[past]))<plan['minimumPriorDays']:
            continue
        test = day==d
        global_weight = choose_weight(y[past],market[past],sports[past],plan,0)
        local = [choose_weight(y[past&(regime==g)],market[past&(regime==g)],sports[past&(regime==g)],plan,global_weight)
                 for g in (False,True)]
        base = logit(market[test])
        difference = logit(sports[test])-base
        forecasts['global'][test] = expit(base + global_weight*difference)
        forecasts['byMarketStrength'][test] = expit(base + np.where(regime[test],local[1],local[0])*difference)
        folds.append({'date':date.fromordinal(int(d)).isoformat(),'n':int(test.sum()),'priorN':int(past.sum()),
                      'weights':{'global':global_weight,'balanced':local[0],'strongFavorite':local[1]}})
    evaluated = np.isfinite(forecasts['global'])
    if not evaluated.any():
        raise ValueError('Insufficient chronological observations')
    idx = np.flatnonzero(evaluated)
    forecasts.update({'market':market,'sports':sports})
    scored = {name:metrics(y[evaluated],p[evaluated]) for name,p in forecasts.items()}
    payout = np.max(prices,axis=1)
    underdog = np.argmax(prices,axis=1)==0
    sport_prefers_underdog = np.where(underdog,(main>.5)&(symmetric>.5),(main<.5)&(symmetric<.5))
    wins = underdog==y
    results = {}
    for name,p in forecasts.items():
        implied = np.where(underdog,p,1-p)
        keep = evaluated & sport_prefers_underdog & (prices[:,0]!=prices[:,1]) & (payout>=plan['minimumOdds']) & (implied*payout>1+1e-12)
        results[name]={}
        for label, mask in [('all',keep),('atLeast3.65',keep&(payout>=3.65))]:
            n=int(mask.sum()); exact=int(wins[mask].sum())
            results[name][label]={'n':n,'exact':exact,'wrong':n-exact,
                'theoreticalRoi':float(np.mean(payout[mask]*wins[mask]-1)) if n else None}
    opportunities = len(set(int(d) for d in day[idx]))
    paired = {}
    for name in ('global','byMarketStrength'):
        delta=(forecasts[name][idx]-y[idx])**2-(market[idx]-y[idx])**2
        paired[name]={'deltaBrier':float(delta.mean()),'interval':paired_interval([{'at':int(day[i])*DAY} for i in idx],delta,plan['bootstrap'])}
    return {'nArchived':len(y),'nEvaluated':len(idx),'evaluatedDays':opportunities,'folds':folds,
            'forecast':scored,'pairedVsMarket':paired,'disagreementValue':results,'operationallyValidated':False}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sample',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    source=args.sample.read_bytes()
    result={'protocol':PLAN,'sampleSha256':hashlib.sha256(source).hexdigest(),**evaluate(json.loads(source),PLAN)}
    with args.output.open('x') as stream:
        json.dump(result,stream,indent=2,allow_nan=False)
        stream.write('\n')
