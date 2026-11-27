"""Chronological price audit. Recorded closing quotes do not establish executable ROI."""
import argparse
from collections import defaultdict
from datetime import date
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import brentq
from scipy.special import expit, logit

from advanced_benchmark import metrics
from projection_ensemble import paired_interval


def markets(row):
    a, b = (1 / q for q in row["prices"])
    return a / (a + b), a**brentq(lambda exponent: a**exponent + b**exponent - 1, 0, 1024)


def blended(market, sports, weight):
    return expit((1-weight) * logit(market) + weight * logit(sports))


def evaluate(rows, weights=(.25,), intervals=False):
    day = np.array([r["day"] for r in rows])
    truth = np.array([r["outcome"] for r in rows])
    odds = np.array([r["prices"] for r in rows])
    sports = np.array([r["sports"] for r in rows])
    market, power = np.array([markets(r) for r in rows]).T
    stages = {"marketProportional": market, "marketPower": power, "sportsOnly": sports}
    stages.update({f"blend{w:.2f}": blended(market, sports, w) for w in weights})
    out = {"n": len(rows), "days": len(set(day)), "from": date.fromordinal(min(day)).isoformat(),
           "to": date.fromordinal(max(day)).isoformat(), "meanMargin": float(np.mean((1/odds).sum(axis=1)-1)),
           "maxDevigDifference": float(np.max(np.abs(market-power))), "metrics": {}}
    for name, p in stages.items():
        result = metrics(truth, p)
        diff = (p-truth)**2-(market-truth)**2
        result["deltaBrier"] = float(np.mean(diff))
        result["deltaInterval"] = (paired_interval([{"at":int(d)*86400000} for d in day], diff, {
            "blockDays": 3, "bootstrapReplicates": 10000, "familyComparisons": 3, "seed": 4101,
        }) if intervals else None)
        # A stress screen only. These prices have no availability/latency confirmation.
        ev = np.column_stack((p,1-p))*odds-1
        sides = ev.argmax(axis=1)
        q = odds[np.arange(len(p)), sides]
        prob = np.where(sides==0,p,1-p)
        selected = (q>=1.30) & (q*prob>1+1e-12)
        stress = np.maximum(0,prob-.05)*(1+.95*(q-1))>1+1e-12
        won = np.where(sides==0,truth,1-truth)
        result["thresholdSensitivity"] = {"minimum1.30": int(selected.sum()),
            "near2.00": int((selected & (np.abs(q-2)<=.25)).sum()),
            "correct": int(won[selected].sum()), "stress5ppAnd5pctNetPrice": int((selected & stress).sum())}
        out["metrics"][name] = result
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("winner", type=Path)
    parser.add_argument("setka", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    winner = json.loads(args.winner.read_bytes())
    # Fixed calendar boundaries. The archive had already been examined for other versions.
    validation = date(2026,10,26).toordinal()
    final = date(2026,11,1).toordinal()
    weights = (0, .25, .50, .75, 1)
    train = evaluate([r for r in winner if r["day"] < validation], weights)
    selection = evaluate([r for r in winner if validation <= r["day"] < final], weights)
    weight = min(weights,key=lambda w:selection["metrics"][f"blend{w:.2f}"]["brier"])
    test = evaluate([r for r in winner if r["day"] >= final], (weight,.25), True)
    setka = json.loads(args.setka.read_bytes())
    groups = defaultdict(list)
    for row in setka.pop("samples"):
        groups[row["target"]].append(row)
    setka["perMarket"] = {target:evaluate(rows) for target,rows in sorted(groups.items())}
    report = {"data": {"winnerSha256": hashlib.sha256(args.winner.read_bytes()).hexdigest(),
                       "admPrices": 0, "verifiedExecution": 0, "independentOperators": 0,
                       "roi": None, "drawdown": None, "independentLaterClosing": None},
              "winner": {"training":train,"validation":selection,"selectedBlendWeight":weight,"test":test, "fullFixedWeightSensitivity":evaluate(winner,(.25,),True)},
              "setka":setka, "retrospective":True,"operationallyValidated":False}
    args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+"\n")


if __name__ == "__main__":
    main()
