"""Offline winner model comparison across seven individual sports."""

import argparse
import csv
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date, datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import sqlite3

import joblib
import numpy as np
from scipy.special import expit, logit
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression


SPORTS = {
    "table_tennis": "WTT singolare, uomini e donne",
    "tennis": "ATP singolare",
    "badminton": "BWF singolare, uomini e donne",
    "darts": "PDC Players Championship",
    "snooker": "Stagioni del circuito storico",
    "boxing": "Incontri per titoli mondiali",
    "mma": "UFC",
}
EXPANDED_SPORTS = {
    **SPORTS,
    "tennis": "ATP e WTA singolare, con qualificazioni, Challenger e ITF",
    "snooker": "Circuito storico CueTracker con date da SnookerDB",
    "setka": "Setka Cup 2022",
    "moviodds": "Tennistavolo MoviOdds · ottobre e novembre 2026",
}
FOLDS = ((.35, .45, .55, .70), (.50, .60, .70, .85), (.65, .75, .85, 1.))
EPSILON = 1e-6
SCORE = re.compile(r"^(\d{1,3})-(\d{1,3})$")


@dataclass(frozen=True, slots=True)
class Match:
    ident: str
    at: date
    available: date
    home: str
    away: str
    group: str
    won: int


def csv_matches(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def winner_from_score(score, sport):
    pairs = [SCORE.fullmatch(part.strip()) for part in score.split(",")]
    if any(pair is None for pair in pairs):
        return None
    sets = [(int(pair[1]), int(pair[2])) for pair in pairs]
    if len(sets) == 1 and sport != "table_tennis":
        a, b = sets[0]
        return int(a > b) if a != b and sport != "badminton" else None
    if len(sets) > (7 if sport == "table_tennis" else 3):
        return None
    a = b = 0
    for first, second in sets:
        high, low = max(first, second), min(first, second)
        if sport == "badminton":
            valid = (high == 21 and low <= 19) or (21 < high < 30 and high - low == 2) or (high == 30 and low in (28, 29))
        else:
            valid = (high == 11 and low <= 9) or (high > 11 and high - low == 2)
        if not valid:
            return None
        a += first > second
        b += second > first
    if a == b or max(a, b) not in ((2,) if sport == "badminton" else (3, 4)):
        return None
    if int(sets[-1][0] > sets[-1][1]) != int(a > b):
        return None
    return int(a > b)


def build_match(ident, at, lag, home, away, group, won):
    home, away = home.strip().casefold(), away.strip().casefold()
    if not ident or not home or not away or home == away or won not in (0, 1):
        return None
    # Assign sides without referencing the outcome or the input's winner-first convention.
    a, b = sorted((home, away))
    if hashlib.sha256(ident.encode()).digest()[0] & 1:
        a, b = b, a
    return Match(ident, at, at + timedelta(days=lag), a, b, group, won if a == home else 1 - won)


def valid_singles(competition, home, away):
    non_singles = r"\b(?:doubles?|teams?|pairs?|MD|WD|XD)\b"
    return not re.search(non_singles, competition, re.I) and all(
        name.strip() and not re.search(r"/|\s&\s", name) for name in (home, away))


def tennis_paths(root):
    directory = root / "tennis-expanded"
    # Every file is expected. A failed download must not silently shrink the experiment.
    names = {f"{tour}_matches{suffix}_{year}.csv"
             for tour, qualifying in (("atp", "_qual_chall"), ("wta", "_qual_itf"))
             for suffix, first_year in (("", 2010), (qualifying, 2019))
             for year in range(first_year, 2026)}
    paths = sorted(directory / name for name in names)
    for path in paths:
        if not path.is_file() or not path.stat().st_size:
            raise FileNotFoundError(path)
    return paths


def tennis_completed(score, best_of):
    if best_of not in ("3", "5"):
        return False
    needed = (int(best_of)+1)//2
    wins = [0, 0]
    for token in score.split():
        pair = re.fullmatch(r"\[?(\d{1,2})-(\d{1,2})(?:\(\d{1,2}\))?\]?", token)
        if needed in wins or pair is None:
            return False
        a, b = int(pair[1]), int(pair[2])
        high, low = max(a,b), min(a,b)
        regular = (high==6 and low<=4) or (high==7 and low in (5,6)) or (high>=8 and high-low==2)
        deciding = wins[0]==wins[1]==needed-1
        if token.startswith("["):
            if not token.endswith("]") or not deciding or high<10 or high-low<2:
                return False
        elif not regular and not (deciding and (high,low)==(13,12)):
            return False
        wins[int(b>a)] += 1
    return wins[0]==needed and wins[1]<needed


def expanded_tennis_rows(paths):
    for path in paths:
        tour = path.name[:3]
        for row in csv_matches(path):
            day, score = row["tourney_date"], row["score"]
            if (not tennis_completed(score, row["best_of"])
                    or len(day) != 8 or not day.isdecimal() or not row["match_num"]
                    or not row["winner_id"].isdigit() or not row["loser_id"].isdigit()):
                continue
            at = date(int(day[:4]), int(day[4:6]), int(day[6:]))
            ident = f"{tour}:{row['tourney_id']}:{row['match_num']}:{row['round']}"
            # ATP and WTA ids share no namespace. Balance strength by court surface.
            yield build_match(ident, at, 21, f"{tour}:{row['winner_id']}", f"{tour}:{row['loser_id']}",
                              f"{tour}:{row['surface']}", 1)


def moviodds_rows(paths):
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data if isinstance(data, list) else data["results"]:
            league, home, away = item["league"], item["home"], item["away"]
            if not valid_singles(league, home, away):
                continue
            score = ",".join(f"{a}-{b}" for a, b in item["sets"])
            winner = winner_from_score(score, "table_tennis")
            if winner is None or winner != int(item["homeWon"]):
                continue
            at = date.fromisoformat(item["finishedAt"][:10])
            available = date.fromisoformat(item["availableAt"][:10])
            if available < at:
                continue
            lag = max(1, (available - at).days)
            # A name in one league is not automatically joined to the same name in others.
            yield build_match(str(item["id"]), at, lag, f"{league}:{home}", f"{league}:{away}", league, winner)


def setka_rows(path):
    for row in csv_matches(path):
        pairs = [(row[f"P1_G{index}"],row[f"P2_G{index}"]) for index in range(1,6)]
        scored = [pair for pair in pairs if pair != ("NA", "NA")]
        if pairs[:len(scored)] != scored:
            continue
        winner = winner_from_score(",".join(f"{a}-{b}" for a,b in scored), "table_tennis")
        if winner is None or str(winner) != row["HomeWinner"] or not all(s.isdigit() for s in (row["Sets_P1"],row["Sets_P2"])):
            continue
        wins = sum(int(a)>int(b) for a,b in scored)
        if (wins,len(scored)-wins)!=(int(row["Sets_P1"]),int(row["Sets_P2"])) or max(wins,len(scored)-wins)!=3:
            continue
        at = datetime.strptime(row["Date"], "%m/%d/%Y").date()
        ident = f"{at}:{row['Time']}:{row['Player1']}:{row['Player2']}"
        yield build_match(ident, at, 1, row["Player1"], row["Player2"], "Setka Cup 2022", winner)


def snooker_rows(path):
    with sqlite3.connect(path.resolve().as_uri() + "?mode=ro&immutable=1", uri=True) as database:
        database.execute("PRAGMA trusted_schema=OFF")
        rows = database.execute("""
            SELECT m.match_id, m.date, t.start_date, t.end_date, t.category,
                   m.player_1_url, m.player_2_url, m.player_1_score, m.player_2_score, m.best_of, m.winner_url, t.name
            FROM matches AS m JOIN tournament AS t USING (tourn_id)
            WHERE lower(trim(m.walkover)) IN ('false', '0') AND CAST(m.best_of AS INTEGER)>0
        """)
        for ident, played, started, finished, category, home, away, a, b, best_of, winner, tournament in rows:
            if not home or not away or not valid_singles(tournament or "", home.rsplit("/",1)[-1], away.rsplit("/",1)[-1]):
                continue
            if not all(isinstance(value, str) and value.isdigit() for value in (a,b,best_of)):
                continue
            a,b,best_of=int(a),int(b),int(best_of)
            if best_of % 2==0 or max(a,b)!=(best_of+1)//2 or a==b or winner!=(home if a>b else away):
                continue
            try:
                start = date.fromisoformat((played or started or "")[:10])
                available = date.fromisoformat((played or finished or "")[:10])
            except ValueError:
                continue
            if available < start or available > date.today():
                continue
            yield build_match(str(ident), start, max(1, (available-start).days), home, away,
                              category or "Circuito storico", int(a>b))


def load(root, sport, expanded=False):
    if sport == "tennis" and expanded:
        paths = tennis_paths(root)
        rows = expanded_tennis_rows(paths)
    elif sport == "snooker" and expanded:
        paths = [root / "snooker-expanded" / "snookerdb.db"]
        rows = snooker_rows(paths[0])
    elif sport == "setka":
        paths = [root / "setka-september-2022.csv"]
        rows = setka_rows(paths[0])
    elif sport == "moviodds":
        paths = [root / filename for filename in ("3000-data.json", "5000-data.json", "forward-v3.json.archive.json")]
        rows = moviodds_rows(paths)
    elif sport == "table_tennis":
        paths = [root / f"table_tennis_wtt_{gender}_std.csv" for gender in ("men", "women")]
        rows = (build_match(f"{gender}:{r['match_id']}", date.fromisoformat(r["event_date"]), 21,
                            f"{gender}:{r['player1_name']}", f"{gender}:{r['player2_name']}", f"{gender}:{r['event_tier']}",
                            winner_from_score(r["score"], sport))
                for gender, path in zip(("men", "women"), paths) for r in csv_matches(path)
                if r["event_date"] and r["player1_name"].strip() and r["player2_name"].strip() and r["winner"] in ("1", "2")
                and winner_from_score(r["score"], sport) == int(r["winner"] == "1"))
    elif sport == "tennis":
        paths = sorted((root / "tennis-atp").glob("*.csv"))
        rows = (build_match(f"{r['tourney_id']}:{r['match_num']}",
                            date(int(r["tourney_date"][:4]), int(r["tourney_date"][4:6]), int(r["tourney_date"][6:])), 21,
                            r["winner_id"], r["loser_id"], r["surface"], 1)
                for path in paths for r in csv_matches(path)
                if r["score"] and not any(flag in r["score"].upper() for flag in ("W/O", "RET", "DEF", "ABD", "UNP"))
                and len(r["tourney_date"]) == 8 and r["tourney_date"].isdigit())
    else:
        paths = [root / "multisport" / f"{sport}-normalized.json"]
        raw = json.loads(paths[0].read_text(encoding="utf-8"))
        # Snooker uses whole seasons. Delay every same-season result to the following year.
        rows = (build_match(r["fixture_id"], date.fromisoformat(r["finished_at"][:10]), 350 if sport == "snooker" else 1,
                            r["home"], r["away"], r["league"], winner_from_score(r["final_score"], sport))
                for r in raw)
    by_id, conflicts = {}, set()
    for match in rows:
        if match is None:
            continue
        if match.ident in by_id and by_id[match.ident] != match:
            conflicts.add(match.ident)
        by_id[match.ident] = match
    matches = sorted((m for ident, m in by_id.items() if ident not in conflicts), key=lambda m: (m.at, m.ident))
    return matches, {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}


class Player:
    def __init__(self):
        self.rating = self.fast = 1500.0
        self.matches = self.wins = 0
        self.form = deque(maxlen=20)
        self.latest = None


def rating_chance(delta):
    return 1 / (1 + 10 ** (-delta / 400))


def features(matches, fitted_ratings=None):
    global_players = defaultdict(Player)
    contexts = defaultdict(Player)
    meetings = defaultdict(lambda: [0, 0])
    results = sorted(matches, key=lambda m: (m.available, m.at, m.ident))

    def change(pool, a, b, match):
        slow = 24 * (match.won - rating_chance(pool[a].rating - pool[b].rating))
        fast = 48 * (match.won - rating_chance(pool[a].fast - pool[b].fast))
        for name, direction, won in ((a, 1, match.won), (b, -1, 1 - match.won)):
            player = pool[name]
            player.rating += direction * slow
            player.fast += direction * fast
            player.matches += 1
            player.wins += won
            player.form.append(won)
            player.latest = max(player.latest or match.at, match.at)

    def form(player, n):
        recent = list(player.form)[-n:]
        return (sum(recent) + 2) / (len(recent) + 4)

    def update(past):
        a, b = past.home, past.away
        change(global_players, a, b, past)
        change(contexts, (past.group, a), (past.group, b), past)
        meetings[tuple(sorted((a, b)))][int((a < b) != bool(past.won))] += 1

    index, data = 0, []
    for match in matches:
        while index < len(results) and results[index].available < match.at:
            update(results[index])
            index += 1
        a, b = global_players[match.home], global_players[match.away]
        if min(a.matches, b.matches) < 4:
            continue
        ac, bc = contexts[match.group, match.home], contexts[match.group, match.away]
        h2h = meetings[tuple(sorted((match.home, match.away)))]
        rest = lambda player: min(120, (match.at - player.latest).days) / 120
        data.append((match.at.toordinal(), [
            (a.rating - b.rating) / 400, (ac.rating - bc.rating) / 400,
            (a.wins + 3) / (a.matches + 6) - (b.wins + 3) / (b.matches + 6),
            np.log1p(a.matches) - np.log1p(b.matches), (a.fast - b.fast) / 400,
            (ac.fast - bc.fast) / 400, form(a, 5) - form(b, 5), form(a, 20) - form(b, 20),
            (h2h[0] - h2h[1]) / (sum(h2h) + 5) * (1 if match.home < match.away else -1),
            rest(a) - rest(b),
        ], match.won))
    if fitted_ratings is not None:
        for past in results[index:]:
            if past.available < date.today():
                update(past)
        def serialize(players):
            return {name: {**vars(player), "form":list(player.form)}
                    for name, player in players.items() if player.matches}
        fitted_ratings.update(globalPlayers=serialize(global_players), byContext=serialize(contexts),
                              meetings=dict(meetings), through=date.today().isoformat())
    return data


def clipped(probability):
    return np.clip(probability, EPSILON, 1 - EPSILON)


def losses(target, probability):
    prob = clipped(probability)
    return np.where(target, -np.log(prob), -np.log1p(-prob))


def metrics(target, probability):
    n = len(target)
    bins = np.minimum(9, (probability * 10).astype(int))
    calibration = sum(abs(np.sum(probability[bins == i] - target[bins == i])) for i in range(10)) / n
    hits = int(np.sum((probability > .5) & (target == 1)) + np.sum((probability < .5) & (target == 0)))
    return {"test": n, "correct": hits, "logLoss": float(losses(target, probability).mean()),
            "brier": float(np.mean((probability - target)**2)), "ece10": float(calibration)}


def model_configs():
    return [
        ("Elo", 1, None),
        ("Logistica di riferimento", 4, LogisticRegression(fit_intercept=False, C=.3)),
        ("Logistica con forma e precedenti", 10, LogisticRegression(fit_intercept=False, C=.3)),
        ("Gradient boosting", 10, HistGradientBoostingClassifier(max_leaf_nodes=7, max_iter=80,
          min_samples_leaf=45, l2_regularization=3, random_state=28)),
    ]


def fit_model(config, x, y):
    name, columns, model = config
    xx = x[:, :columns]
    if model is not None:
        model.fit(np.vstack([xx, -xx]), np.concatenate([y, 1 - y]))
    return name, columns, model


def predict(fitted, x):
    _, columns, model = fitted
    xx = x[:, :columns]
    if model is None:
        return expit(xx[:, 0] * np.log(10))
    return (model.predict_proba(xx)[:, 1] + 1 - model.predict_proba(-xx)[:, 1]) / 2


def select(fitted, x, y):
    return min(fitted, key=lambda model: losses(y, predict(model, x)).mean())


def temperature(model, x, y):
    logits = logit(clipped(predict(model, x)))
    # One positive temperature keeps ranking, complements and the .5 boundary.
    choices = (1.0, .7, .85, 1.15, 1.3, 1.5)
    return min(choices, key=lambda scale: losses(y, expit(logits * scale)).mean())


def block_intervals(delta, days, comparisons=len(SPORTS)):
    active_weeks = np.unique(days // 7)
    if len(active_weeks) < 8:
        return {"interval95": None, "familyInterval95": None}
    totals = np.array([delta[days // 7 == week].sum() for week in active_weeks])
    counts = np.array([(days // 7 == week).sum() for week in active_weeks])
    indices = np.random.default_rng(28).integers(0, len(active_weeks), (2500, len(active_weeks)))
    averages = totals[indices].sum(axis=1) / counts[indices].sum(axis=1)
    family_tail = .025 / comparisons
    return {"interval95": np.quantile(averages, [.025, .975]).tolist(),
            "familyInterval95": np.quantile(averages, [family_tail, 1 - family_tail]).tolist()}


def evaluate(matches, comparisons=len(SPORTS)):
    rows = features(matches)
    days = np.array([row[0] for row in rows])
    unique = np.unique(days)
    if len(unique) < 10:
        return {"matches": len(matches), "eligible": len(rows), "folds": []}, None
    x = np.array([row[1] for row in rows])
    y = np.array([row[2] for row in rows])
    fold_results, all_test, all_days, references, candidates = [], [], [], [], []
    saved = None
    for train, choose, calibrate, end in FOLDS:
        train_end, choice_end, calibration_end = (unique[int(len(unique) * part)] for part in (train, choose, calibrate))
        test_end = unique[int(len(unique) * end)] if end < 1 else unique[-1] + 1
        splits = (days < train_end, (days >= train_end) & (days < choice_end),
                  (days >= choice_end) & (days < calibration_end), (days >= calibration_end) & (days < test_end))
        if min(map(np.count_nonzero, splits)) < 20 or any(len(np.unique(y[split])) < 2 for split in splits):
            continue
        a, b, c, d = splits
        models = [fit_model(config, x[a], y[a]) for config in model_configs()]
        reference = select(models[:2], x[b], y[b])
        candidate = select(models, x[b], y[b])
        rt, ct = temperature(reference, x[c], y[c]), temperature(candidate, x[c], y[c])
        reference_prob = expit(logit(clipped(predict(reference, x[d]))) * rt)
        candidate_prob = expit(logit(clipped(predict(candidate, x[d]))) * ct)
        fold_results.append({"train": int(a.sum()), "selection": int(b.sum()), "calibration": int(c.sum()),
                             "from": date.fromordinal(int(days[d].min())).isoformat(),
                             "to": date.fromordinal(int(days[d].max())).isoformat(),
                             "reference": reference[0], "selected": candidate[0], "temperature": ct,
                             "referenceMetrics": metrics(y[d], reference_prob), "candidateMetrics": metrics(y[d], candidate_prob)})
        all_test.extend(y[d])
        all_days.extend(days[d])
        references.extend(reference_prob)
        candidates.extend(candidate_prob)
        saved = {"candidate": candidate, "temperature": ct, "calibratedBefore": date.fromordinal(int(calibration_end)).isoformat()}
    target, ref, cand, test_days = map(np.array, (all_test, references, candidates, all_days))
    if not len(target):
        return {"matches": len(matches), "eligible": len(rows), "folds": []}, None
    delta = losses(target, cand) - losses(target, ref)
    return {"matches": len(matches), "eligible": len(rows), "folds": fold_results, "reference": metrics(target, ref),
            "candidate": metrics(target, cand), "deltaLogLoss": float(delta.mean()),
            **block_intervals(delta, test_days, comparisons)}, saved


def refit_corpus(root, evaluated, output):
    report = json.loads(evaluated.read_text(encoding="utf-8"))
    refits = {}
    for cohort, evaluation in report.items():
        if not evaluation["folds"]:
            continue
        matches, hashes = load(root, cohort, expanded=True)
        if evaluation["sourceHashes"] != hashes:
            raise ValueError(f"Corpus changed since evaluation: {cohort}")
        matches = [match for match in matches if match.available < date.today()]
        ratings = {}
        rows = features(matches, ratings)
        family = evaluation["folds"][-1]["selected"]
        config = next(config for config in model_configs() if config[0] == family)
        x, y = np.array([row[1] for row in rows]), np.array([row[2] for row in rows])
        fitted = fit_model(config, x, y)
        refits[cohort] = {"family": family, "eligible": len(rows), "through": matches[-1].at.isoformat(),
                          "model": "rating updates only" if family == "Elo" else "fit on all eligible matches"}
        joblib.dump({"candidate": fitted, "ratings": ratings, "sourceHashes": hashes, "researchOnly": True,
                     "validatedOnFutureData": False}, output / f"{cohort}-refit.joblib")
        print(cohort, refits[cohort], flush=True)
    (output / "refits.json").write_text(json.dumps(refits, ensure_ascii=False, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--refit-from", type=Path, help="refit the selected research families on all eligible matches in a completed expanded report")
    parser.add_argument("--expand", action="store_true", help="include the larger tennis, snooker and table tennis archives")
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Use a new output directory for each run")
    args.output.mkdir(parents=True)
    if args.refit_from:
        refit_corpus(args.data, args.refit_from, args.output)
        return
    reports = {}
    cohorts = EXPANDED_SPORTS if args.expand else SPORTS
    for sport, label in cohorts.items():
        matches, hashes = load(args.data, sport, args.expand)
        result, model = evaluate(matches, len(cohorts))
        reports[sport] = {"scope": label, "sourceHashes": hashes, **result}
        if model:
            joblib.dump(model, args.output / f"{sport}.joblib")
        print(sport, result.get("candidate"), flush=True)
    (args.output / "report.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
