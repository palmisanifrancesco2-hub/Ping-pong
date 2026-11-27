"""Compare ATP singles winner models with chronological splits.

Input files are YYYY.csv snapshots from the pinned Sackmann archive documented in
docs/SPORT-INDIVIDUALI.md. Raw data and fitted models stay outside the repository.
"""

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss


def read_matches(directory):
    rows = {}
    hashes = {}
    for path in sorted(directory.glob("*.csv")):
        hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for match in csv.DictReader(stream):
                score = match.get("score", "").strip()
                if not score or any(flag in score.upper() for flag in ("W/O", "RET", "DEF", "ABD", "UNP")):
                    continue
                first, second = match["winner_id"], match["loser_id"]
                day = match["tourney_date"]
                if not first or not second or first == second or len(day) != 8:
                    continue
                tournament_start = date(int(day[:4]), int(day[4:6]), int(day[6:]))
                rows.setdefault((match["tourney_id"], match["match_num"]), (tournament_start, match))
    return sorted(rows.values(), key=lambda pair: pair[0]), hashes


def chance(delta):
    return 1 / (1 + 10 ** (-delta / 400))


def features(matches):
    general, surface = defaultdict(lambda: 1500.0), defaultdict(lambda: 1500.0)
    experience, meetings = defaultdict(int), defaultdict(lambda: [0, 0])
    data = []
    update_at = 0
    for day, match in matches:
        # The archive has tournament dates rather than per-match availability.
        # Keep whole tournaments together and delay all results by three weeks.
        while update_at < len(matches) and matches[update_at][0] + timedelta(days=21) < day:
            _, old = matches[update_at]
            winner, loser, court = old["winner_id"], old["loser_id"], old["surface"]
            for pool, a, b in ((general, winner, loser), (surface, (court, winner), (court, loser))):
                delta = 24 * (1 - chance(pool[a] - pool[b]))
                pool[a] += delta
                pool[b] -= delta
            experience[winner] += 1
            experience[loser] += 1
            ordered = tuple(sorted((winner, loser)))
            meetings[ordered][int(winner != ordered[0])] += 1
            update_at += 1
        winner, loser, court = match["winner_id"], match["loser_id"], match["surface"]
        # Deterministic side assignment independent of the winner and reproducible across runs.
        a, b = sorted((winner, loser))
        if hashlib.sha256(f"{match['tourney_id']}:{match['match_num']}".encode()).digest()[0] & 1:
            a, b = b, a
        home_won = int(a == winner)
        if not match["winner_rank"].isdigit() or not match["loser_rank"].isdigit() or not court:
            continue
        ranks = {winner: int(match["winner_rank"]), loser: int(match["loser_rank"])}
        if min(ranks.values()) <= 0 or min(experience[a], experience[b]) < 10:
            continue
        past = meetings[tuple(sorted((a, b)))]
        direct = (past[0] - past[1]) / (sum(past) + 5) * (1 if a < b else -1)
        data.append((day.year, [(general[a] - general[b]) / 400,
                               (surface[court, a] - surface[court, b]) / 400,
                               np.log(ranks[b] / ranks[a]), direct,
                               np.log1p(experience[a]) - np.log1p(experience[b])], home_won))
    return data


def metrics(target, probabilities):
    return {"n": len(target), "accuracy": accuracy_score(target, probabilities >= .5),
            "brier": brier_score_loss(target, probabilities), "logLoss": log_loss(target, probabilities)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    matches, hashes = read_matches(args.directory)
    rows = features(matches)
    year = np.array([row[0] for row in rows])
    x = np.array([row[1] for row in rows])
    y = np.array([row[2] for row in rows])
    train, validation, test = year < 2024, year == 2024, year == 2025
    if min(train.sum(), validation.sum(), test.sum()) < 100:
        raise SystemExit("Need at least 100 matches per chronological split")
    predictions = {"Elo": np.array([chance(delta * 400) for delta in x[:, 0]])}
    for name, model, columns in (
        ("Ranking calibrato", LogisticRegression(), [2]),
        ("Logistica Elo e superficie", LogisticRegression(), [0, 1, 3, 4]),
        ("Logistica completa", LogisticRegression(), list(range(5))),
        ("Gradient boosting", HistGradientBoostingClassifier(max_leaf_nodes=7, min_samples_leaf=80, random_state=0), list(range(5))),
    ):
        # Fit the mirrored rows too and average complementary predictions at inference.
        xx = x[:, columns]
        model.fit(np.concatenate((xx[train], -xx[train])), np.concatenate((y[train], 1 - y[train])))
        predictions[name] = (model.predict_proba(xx)[:, 1] + 1 - model.predict_proba(-xx)[:, 1]) / 2
    standings = {name: {"validation": metrics(y[validation], p[validation]), "test": metrics(y[test], p[test])}
                 for name, p in predictions.items()}
    winner = min(standings, key=lambda name: standings[name]["validation"]["logLoss"])
    print(json.dumps({"sourceHashes": hashes, "completeRows": len(matches), "training": int(train.sum()),
                      "selectionBy2024LogLoss": winner, "models": standings}, indent=2))


if __name__ == "__main__":
    main()
