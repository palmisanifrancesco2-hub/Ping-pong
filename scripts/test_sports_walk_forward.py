import importlib.util
import sys
import unittest
from datetime import date
from pathlib import Path

import numpy as np

path = Path(__file__).resolve().parents[1] / "research" / "evaluate-sports-walk-forward.py"
spec = importlib.util.spec_from_file_location("sports_walk_forward", path)
study = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = study
spec.loader.exec_module(study)


class SportsWalkForwardTests(unittest.TestCase):
    def test_same_day_results_are_unavailable_for_features(self):
        prior = [
            study.Match(str(i), date(2024, 1, i + 1), date(2024, 1, i + 2), "a", "b", "league", 1)
            for i in range(4)
        ]
        today = date(2024, 1, 8)
        same_day = study.Match("before", today, today, "a", "b", "league", 0)
        target = study.Match("target", today, today, "a", "b", "league", 1)
        features = study.features(prior + [same_day, target])
        assert len(features) == 2
        assert features[0][1] == features[1][1]


    def test_orientation_is_independent_of_winner_and_input_order(self):
        day = date(2024, 1, 8)
        result = study.build_match("test", day, 1, "a", "b", "tour", 1)
        reverse = study.build_match("test", day, 1, "b", "a", "tour", 0)
        assert result == reverse


    def test_confirmed_winner_and_retirement_rejection(self):
        assert study.winner_from_score("21-19,19-21,30-29", "badminton") == 1
        assert study.winner_from_score("21-10,21-16,5-4", "badminton") is None
        assert study.winner_from_score("11-7,11-8,13-11", "table_tennis") == 1
        assert study.winner_from_score("0-0", "boxing") is None


    def test_temporal_interval_handles_small_samples_and_multiple_comparisons(self):
        assert study.evaluate([])[0]["folds"] == []
        assert study.block_intervals(np.array([0.0]), np.array([1]))["familyInterval95"] is None
        result = study.block_intervals(np.arange(100) - 55, np.arange(100))
        assert result["familyInterval95"][0] <= result["interval95"][0]
        assert result["familyInterval95"][1] >= result["interval95"][1]
