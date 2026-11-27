"""Replay fixed EV cutoffs on the v38 archive without tuning the test period."""
import argparse
from datetime import date
import hashlib
import json
from pathlib import Path

import numpy as np


RULES = {
    'above50': (1.30, .50),
    'above60': (1.30, .60),
    'odds2Above50': (2, .50),
}


def evaluate(raw):
    cases = json.loads(raw)
    day = np.array([row['day'] for row in cases])
    odds = np.array([row['prices'] for row in cases])
    winner = np.array([1-row['outcome'] for row in cases])
    sport = np.array([row['sports'] for row in cases])
    symmetric = np.array([row['symmetric'] for row in cases])
    sides = np.column_stack((sport,1-sport))
    other = np.column_stack((symmetric,1-symmetric))
    cohorts = {'all':np.ones(len(day),bool), 'final':day>=date(2026,11,1).toordinal()}
    methods = {'sports':sides, 'symmetric':other, 'bothAboveCutoff':np.minimum(sides,other)}
    report = {}
    for name,mask in cohorts.items():
        result = {}
        for model,probabilities in methods.items():
            groups = {}
            for key,(minimum_odds,minimum_ev) in RULES.items():
                ev = np.where(odds>=minimum_odds,probabilities*odds-1,-np.inf)
                chosen = np.argmax(ev,axis=1)
                selected = mask & (np.max(ev,axis=1)>minimum_ev+1e-12)
                hit = selected & (chosen==winner)
                selected_count, wins = int(selected.sum()), int(hit.sum())
                groups[key] = {'selected':selected_count,'exact':wins,'wrong':selected_count-wins,
                               'accuracy':wins/selected_count if selected_count else None}
            result[model]=groups
        report[name]={'matches':int(mask.sum()),'days':len(set(day[mask])),'methods':result}
    return {'sourceSha256':hashlib.sha256(raw).hexdigest(),'rules':RULES,'cohorts':report,
            'finalStart':'2026-11-01','prospective':False,'executionVerified':False}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    args.output.write_text(json.dumps(evaluate(args.input.read_bytes()),indent=2,allow_nan=False)+'\n')
