import unittest
import numpy as np
from advanced_benchmark import nested_split,choose_shrink,metrics,DAY


class AdvancedBenchmarkTests(unittest.TestCase):
    def test_temporal_windows_separate_late_labels_and_match_ids(self):
        rows=[{'id':str(i),'at':i*DAY,'available':(i+.5)*DAY} for i in range(6)]
        rows.append({'id':'late','at':DAY,'available':6*DAY})
        train,tune,refit,cal,test=nested_split(rows,4*DAY,6*DAY,{'calibrationDays':1,'tuningDays':1})
        self.assertEqual([r['id'] for r in train],['0','1']);self.assertEqual([r['id'] for r in tune],['2']);self.assertEqual([r['id'] for r in cal],['3']);self.assertEqual([r['id'] for r in test],['4','5'])
        self.assertNotIn('late',[r['id'] for group in [train,tune,refit,cal,test] for r in group])

    def test_shrink_uses_calibration_only_and_accepts_baseline(self):
        w=choose_shrink([[.9],[.1]],[[.5],[.5]],[[0],[1]],[0,.5,1]);np.testing.assert_array_equal(w,[0])
        with self.assertRaises(ValueError):choose_shrink([[np.nan]],[[.5]],[[1]],[0,1])

    def test_metrics_distinguish_undecided_from_wrong_and_score_probabilities(self):
        r=metrics(np.asarray([1,0,1]),np.asarray([.8,.1,.5]));self.assertEqual(r['correct'],2);self.assertEqual(r['undecided'],1);self.assertEqual(r['wrong'],0);self.assertEqual(r['accuracy'],1)
        self.assertAlmostEqual(r['brier'],(.04+.01+.25)/3)
        self.assertEqual(sum(b['n'] for b in r['calibration']),3)
        with self.assertRaises(ValueError):metrics([1],[1.2])
