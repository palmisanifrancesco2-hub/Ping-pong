"""Test temperature correction on archived Bet365 pairs and a separate open Elo sample."""
import argparse
import csv
from datetime import date
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize_scalar
from scipy.special import expit, logit

from advanced_benchmark import metrics
from projection_ensemble import paired_interval


def valid_probability(values):
    if not np.all(np.isfinite(values) & (values > 0) & (values < 1)):
        raise ValueError('Invalid probability')
    return values


def calibration_slope(probability, truth, shrink):
    base = logit(probability)
    def loss(slope):
        margin = slope * base
        return np.sum(np.logaddexp(0, margin) - truth * margin) + shrink * (slope - 1)**2
    return float(minimize_scalar(loss, bounds=(.35, 1.65), method='bounded').x)


def high_ev(p, y, odds):
    edge = np.column_stack((p,1-p)) * odds - 1
    edge[odds < 1.30] = -np.inf
    selection = np.argmax(edge, axis=1)
    row = np.arange(len(p))
    chosen = edge[row, selection] > .5+1e-12
    exact = (selection == (1-y)) & chosen
    return {'eligible':int(np.any(odds >= 1.30, axis=1).sum()),'selections': int(chosen.sum()),
            'exact':int(exact.sum()),'wrong':int(chosen.sum()-exact.sum())}


def archived(data):
    rows = json.loads(data)
    day = np.array([r['day'] for r in rows])
    odds = np.array([r['prices'] for r in rows])
    if not np.all(np.isfinite(odds) & (odds > 1)):
        raise ValueError('Invalid price')
    y = np.array([r['outcome'] for r in rows])
    market = valid_probability((1/odds[:,0])/np.sum(1/odds,axis=1))
    sport = valid_probability(np.array([r['sports'] for r in rows]))
    valid_after = date(2026,10,26).toordinal()
    test_after = date(2026,11,1).toordinal()
    training = day < valid_after
    validation = (day >= valid_after) & (day < test_after)
    test = day >= test_after
    slope = calibration_slope(market[training],y[training],20)
    probabilities = {'market':market,'sports':sport,
                     'market_temperature':expit(slope*logit(market)),
                     'market_temperature_plus_sport':expit(slope*(.75*logit(market)+.25*logit(sport)))}
    candidates = ['market','market_temperature','market_temperature_plus_sport']
    chosen = min(candidates,key=lambda name:metrics(y[validation],probabilities[name][validation])['brier'])
    def score(mask):
        return {name:{**metrics(y[mask],p[mask]),'highEv':high_ev(p[mask],y[mask],odds[mask])}
                for name,p in probabilities.items()}
    return {'n':len(rows),'days':len(set(day)), 'testStarts':'2026-11-01','temperatureSlope':slope,'chosen':chosen,
            'training':score(training),'validation':score(validation),'test':score(test),
            'historicalSportsHighEv':high_ev(sport,y,odds), 'verifiedExecution':False}


def open_sample(data):
    rows = list(csv.DictReader(data.decode().splitlines()))
    if len({r['match_id'] for r in rows}) != len(rows) or any(r['winner'] not in ('A','B') for r in rows):
        raise ValueError('Duplicate or invalid external outcome')
    day = np.array([date.fromisoformat(r['date']).toordinal() for r in rows])
    p = np.array([float(r['p_model']) for r in rows])
    p = valid_probability(p)
    y = np.array([int(r['winner']=='A') for r in rows])
    boundary = date(2026,9,1).toordinal()
    if not any(day >= boundary) or not any(day < boundary):
        boundary = sorted(set(day))[len(set(day))*2//3]
    train = day < boundary
    test = ~train
    slope = calibration_slope(p[train],y[train],20)
    corrected = expit(slope*logit(p[test]))
    difference = (corrected-y[test])**2-(p[test]-y[test])**2
    ci = paired_interval([{'at':int(d)*86400000} for d in day[test]],difference,
                         {'blockDays':3,'bootstrapReplicates':10000,'familyComparisons':1,'seed':42})
    return {'n':len(rows),'competitions':len({r['league'] for r in rows}),'setka':sum(r['league'] in ('Setka Cup','Setka Cup Women') for r in rows),
            'from':date.fromordinal(min(day)).isoformat(),'to':date.fromordinal(max(day)).isoformat(),
            'cutoff':date.fromordinal(boundary).isoformat(),'training':int(train.sum()),'temperatureSlope':slope,
            'test':{'reportedElo':metrics(y[test],p[test]),'calibratedElo':metrics(y[test],corrected),'differenceBrierInterval':ci},
            'hasBookmakerPrices':False}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('archived',type=Path)
    parser.add_argument('external',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    prices,sample=args.archived.read_bytes(),args.external.read_bytes()
    report={'archivedSourceSha256':hashlib.sha256(prices).hexdigest(),
            'externalSourceSha256':hashlib.sha256(sample).hexdigest(),
            'archived':archived(prices),'openElo':open_sample(sample)}
    args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')


if __name__=='__main__':
    main()
