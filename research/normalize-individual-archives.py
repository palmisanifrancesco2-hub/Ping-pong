"""Prepare local, date-only archives for the individual-sport research runner.

The normalized records are research inputs. The noon UTC timestamp is a date
marker, not the actual kickoff, finish, or publication time. For snooker only
the season is known, so an entire season is kept at a single date marker.
"""

import argparse
import csv
import gzip
import hashlib
import json
import re
from contextlib import contextmanager
from datetime import date
from pathlib import Path


@contextmanager
def csv_rows(path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as stream:
        yield csv.DictReader(stream)


def outcome(row, sport):
    if sport == "badminton":
        parts = re.findall(r"\b(\d{1,2})-(\d{1,2})\b", row["score"])
        if not parts or row["winner"] not in {"1", "2"}:
            return
        wins = [sum(int(a) > int(b) for a, b in parts), sum(int(b) > int(a) for a, b in parts)]
        first = row["winner"] == "1"
        if max(wins) != 2 or min(wins) >= 2 or first != (wins[0] > wins[1]):
            return
        return (row["date"], row["team1"], row["team2"], row["discipline"],
                ",".join(f"{a}-{b}" for a, b in parts), first,
                "|".join(row[key] for key in ("date", "tournament", "round", "team1", "team2")))
    if sport == "darts":
        a, b = int(row["player_1_legs_won"]), int(row["player_2_legs_won"])
        if a == b or max(a, b) != int(row["best_of_legs"]) // 2 + 1:
            return
        return row["event_date"], row["player_1_id"], row["player_2_id"], "PDC Players Championship", f"{a}-{b}", a > b, row["match_key"]
    if sport == "snooker":
        if row["walkover"] != "FALSE" or not all(row[key].isdigit() for key in ("best_of", "player_1_score", "player_2_score", "season")):
            return
        a, b = int(row["player_1_score"]), int(row["player_2_score"])
        if a == b or max(a, b) != int(row["best_of"]) // 2 + 1:
            return
        return f"{row['season']}-07-01", row["player_1"], row["player_2"], "Circuito storico", f"{a}-{b}", a > b, row["match_id"]
    if sport == "mma":
        if (row["result_f1"], row["result_f2"]) not in {("W", "L"), ("L", "W")}:
            return
        first = row["result_f1"] == "W"
        return row["event_date"], row["f1_id"], row["f2_id"], row["bout_division"] or "UFC", "1-0" if first else "0-1", first, row["fight_id"]
    if row["status"] != "FINISHED" or row["winner"] not in {"BOXER A", "BOXER B"}:
        return
    first = row["winner"] == "BOXER A"
    return row["date"], row["boxer_a_champion_id"] or row["boxer_a_name"], row["boxer_b_champion_id"] or row["boxer_b_name"], row["weight_class"], "1-0" if first else "0-1", first, row["bout_id"]


def normalize(directory):
    sources = {
        "badminton": ["badminton-ms.csv", "badminton-ws.csv"],
        "darts": ["darts.csv.gz"],
        "snooker": ["snooker.csv"],
        "boxing": ["boxing.csv"],
        "mma": ["mma.csv"],
    }
    for sport, files in sources.items():
        output = []
        for file in files:
            with csv_rows(directory / file) as rows:
                for row in rows:
                    item = outcome(row, sport)
                    if not item:
                        continue
                    day, home, away, league, score, home_won, ref = item
                    if not home or not away or not league or not ref:
                        continue
                    try:
                        date.fromisoformat(day)
                    except ValueError:
                        continue
                    # Source order can favor the winner. Change orientation without looking at the result.
                    digest = hashlib.sha256(ref.encode()).hexdigest()
                    if int(digest[0], 16) % 2:
                        home, away = away, home
                        score = ",".join("-".join(reversed(part.split("-"))) for part in score.split(","))
                        home_won = not home_won
                    record = {"fixture_id": digest, "sport": sport, "home": home, "away": away,
                              "league": league, "status": "finished", "final_score": score, "finished_at": day + "T12:00:00Z"}
                    if sport in {"boxing", "mma"}:
                        record["fight"] = {"result": "home" if home_won else "away"}
                    output.append(record)
        (directory / f"{sport}-normalized.json").write_text(json.dumps(output), encoding="utf-8")
        print(sport, len(output))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    normalize(parser.parse_args().directory)
