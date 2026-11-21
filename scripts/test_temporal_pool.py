import unittest
import numpy as np
from temporal_pool import calibration_rows,fit,predict


class TemporalPoolTests(unittest.TestCase):
    def test_late_outcomes_and_same_day_events_are_excluded(self):
        a={'at':1,'available':5};b={'at':2,'available':12};c={'at':10,'available':9}
        self.assertEqual(calibration_rows([a,b,c],10),[a])

    def test_weight_moves_towards_better_previous_forecaster(self):
        rows=[{'full':.5,'projection':.8 if i%2 else .2,'y':i%2} for i in range(100)]
        for kind in ['learned-weight','learned-weight-temperature']:
            params=fit(rows,kind);self.assertGreater(params['weight'],.5)
            self.assertTrue(.5<=params['temperature']<=1.5)

    def test_player_reversal_and_finite_extremes(self):
        rows=[{'full':.2,'projection':.7},{'full':0,'projection':0},{'full':1,'projection':1}]
        flipped=[{'full':1-r['full'],'projection':1-r['projection']} for r in rows]
        np.testing.assert_allclose(predict(rows,.3,1.4),1-predict(flipped,.3,1.4),atol=1e-12)
        with self.assertRaises(ValueError):predict([{'full':1.2,'projection':.5}],.5,1)
        with self.assertRaises(ValueError):fit([],'learned-weight')
