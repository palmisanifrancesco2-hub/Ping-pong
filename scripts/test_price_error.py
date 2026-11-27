import importlib.util
import unittest
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location('price_error', Path(__file__).with_name('benchmark-price-error.py'))
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class PriceErrorTest(unittest.TestCase):
    def test_power_is_symmetric_and_removes_margin(self):
        odds = np.array([[1.5, 2.7], [1.9, 1.9], [2, 2]])
        home = benchmark.power_probability(odds)
        np.testing.assert_allclose(home + benchmark.power_probability(odds[:, ::-1]), 1, atol=1e-12)
        self.assertGreater(home[0], 2.7/4.2)
        self.assertAlmostEqual(home[1], .5)
        self.assertAlmostEqual(home[2], .5)

    def test_screen_leaves_sports_favorite_fixed(self):
        choices = benchmark.selections(np.array([.56, .47, .5]), np.array([.40, .90, .2]),
                                       np.array([[3, 1.4], [1.6, 2.5], [2.2, 2.3]]), 1.3)
        np.testing.assert_array_equal(choices[0], [True, False, False])
        np.testing.assert_array_equal(choices[2], [True, False, False])
        self.assertTrue(choices[3][0])

    def test_predictions_do_not_see_same_day_or_recent_results(self):
        days = np.repeat(np.arange(739800, 739807), 6)
        sport = np.tile([.7, .7, .55, .4, .2, .6], 7)
        market = np.tile([.6, .4, .55, .35, .4, .55], 7)
        outcomes = np.tile([1, 1, 0, 0, 0, 1], 7)
        plan = {'calibrationLagDays':2, 'minimumCalibrationMatches':12, 'minimumCalibrationDays':2,
                'residualPenalty':1}
        changed = outcomes.copy()
        changed[days >= days.max()-1] = 1-changed[days >= days.max()-1]
        index, base, residual, _ = benchmark.collect_predictions(days, outcomes, market, sport, plan)
        other_index, other_base, other_residual, _ = benchmark.collect_predictions(days, changed, market, sport, plan)
        self.assertGreater(len(index), 0)
        np.testing.assert_array_equal(index, other_index)
        np.testing.assert_allclose(base, other_base)
        np.testing.assert_allclose(residual, other_residual)


if __name__ == '__main__':
    unittest.main()
