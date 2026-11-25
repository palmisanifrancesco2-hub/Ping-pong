"""Compare sports-only price consensus on the original chronological v36 forecasts."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from advanced_benchmark import DAY, metrics
from projection_ensemble import paired_interval

PLAN = {'minimumOdds':1.3, 'bootstrap':{'blockDays':3, 'bootstrapReplicates':10000,
          'familyComparisons':3, 'seed':3801}}


def evaluate(rows):
    y = np.asarray([r['outcome'] for r in rows])
    day = [{'at':r['day']*DAY} for r in rows]
    odds = np.asarray([r['prices'] for r in rows])
    reference = np.asarray([r['sports'] for r in rows])
    symmetric = np.asarray([r['symmetric'] for r in rows])
    inverse = 1/odds
    market = inverse[:, 0]/inverse.sum(axis=1)
    prediction = {'reference':reference, 'symmetric':symmetric, 'equalPool':(reference+symmetric)/2, 'market':market}
    forecast = {}
    for name, p in prediction.items():
        difference = (p-y)**2-(market-y)**2
        forecast[name] = {'score':metrics(y, p), 'brierDifferenceVsMarket':float(difference.mean()),
                          'interval':paired_interval(day, difference, PLAN['bootstrap'])}

    policies = {}
    for name,p,peer in [('reference',reference,reference),('symmetric',symmetric,symmetric),
                        ('consensus',prediction['equalPool'],reference)]:
        home = p>.5
        probability = np.where(home,p,1-p)
        lower = np.where(home,peer,1-peer)
        if name=='consensus':
            lower = np.minimum(lower,np.where(home,symmetric,1-symmetric))
        price = np.where(home,odds[:,0],odds[:,1])
        opposite = np.where(home,odds[:,1],odds[:,0])
        selected = (probability>.5)&(lower>.5)&(price>=PLAN['minimumOdds'])&(lower*price>1+1e-12)
        exact = home==y
        profit = np.where(exact,price-1,-1)
        policies[name] = {}
        for label, mask in [('all',selected),('marketUnderdogs',selected&(price>opposite)),('aboveTwo',selected&(price>2))]:
            indices = np.flatnonzero(mask)
            n = len(indices)
            hits = int(exact[mask].sum())
            policies[name][label] = {'n':n,'exact':hits,'wrong':n-hits,
                'theoreticalRoi':float(profit[mask].mean()) if n else None,
                'interval':paired_interval([day[i] for i in indices],profit[mask],PLAN['bootstrap']) if n else None}
    return {'n':len(rows),'forecast':forecast,'policies':policies,'retrospective':True,'operationallyValidated':False}


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sample',type=Path)
    parser.add_argument('output',type=Path)
    args = parser.parse_args()
    source = args.sample.read_bytes()
    report = {'policy':PLAN,'sampleSha256':hashlib.sha256(source).hexdigest(),**evaluate(json.loads(source))}
    with args.output.open('x') as stream:
        json.dump(report,stream,indent=2,allow_nan=False)
        stream.write('\n')
