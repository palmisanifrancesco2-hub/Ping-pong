import importlib.util
from pathlib import Path
import unittest

from coherent_score_model import score_class

spec = importlib.util.spec_from_file_location('secondary_markets', Path(__file__).with_name('benchmark-secondary-markets.py'))
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class SecondaryOutcomesTest(unittest.TestCase):
    def test_set_counts_point_lines_and_handicap_sides(self):
        sets = [(11, 9), (8, 11), (11, 6), (11, 6)]
        self.assertEqual(
            benchmark.target_outcomes(sets, score_class(sets)),
            [1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1],
        )
        reversed_sets = [(b, a) for a, b in sets]
        self.assertEqual(
            benchmark.target_outcomes(reversed_sets, score_class(reversed_sets)),
            [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4],
        )


if __name__ == '__main__':
    unittest.main()
