"""Run: python -m unittest discover -s scripts -p 'test_market_distributions.py'."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('research', Path(__file__).with_name('evaluate-market-distributions.py'))
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)


class ResearchTests(unittest.TestCase):
    def test_temporal_split_purges_delayed_labels(self):
        start=10*research.DAY
        rows=[{'at':research.DAY,'available':9*research.DAY},
              {'at':2*research.DAY,'available':3*research.DAY},
              {'at':8*research.DAY,'available':9*research.DAY},
              {'at':9*research.DAY,'available':10*research.DAY}]
        train,cal=research.temporal_split(rows,start)
        self.assertEqual(train,[rows[1]])
        self.assertEqual(cal,[rows[2]])

    def test_calibration_never_uses_confirmation_and_can_reject_model(self):
        y=np.tile([0,1],(80,7))
        baseline=np.full(y.shape,.5)
        raw=1-y
        self.assertTrue(np.all(research.calibrate(raw,baseline,y)==0))
        w=research.calibrate(y,baseline,y,coherent=True)
        self.assertTrue(np.all(w==1))

    def test_joint_forest_preserves_probability_order_and_empirical_bounds(self):
        rows=[]
        for i in range(100):
            points=60+i%40
            y=[int(i%3==0),int(i%2==0),int(i%4==0),int(i%4>0),int(i%4>2),
               int(points>74.5),int(points>79.5),int(points>84.5),0,1,0,1,0,1]
            rows.append({'x':[i/100,i%3], 'y':y})
        fitted=research.fit_model('joint-score-forest',rows)
        p=research.predict('joint-score-forest',fitted,rows)
        self.assertTrue(np.all((p>=0)&(p<=1)))
        self.assertTrue(np.all(p[:,5]+1e-12>=p[:,6]))
        self.assertTrue(np.all(p[:,6]+1e-12>=p[:,7]))
        self.assertTrue(np.all(p[:,3]+1e-12>=p[:,4]))
        np.testing.assert_allclose(p,research.predict('joint-score-forest',fitted,rows))

    def test_paired_hour_blocks_detect_known_loss_gap_and_insufficient_span(self):
        times=np.arange(40)*3600000
        ci=research.block_interval(times,np.full(40,-.01),draws=1000)
        self.assertAlmostEqual(ci['lower'],-.01)
        self.assertAlmostEqual(ci['upper'],-.01)
        self.assertEqual(ci['familyTargets'],14)
        self.assertIsNone(research.block_interval([0,1000],np.zeros(2))['upper'])

    def test_metrics_proper_scores_and_calibration(self):
        y=np.array([0,1,0,1]);p=np.array([.2,.8,.2,.8])
        m=research.metrics(y,p)
        self.assertAlmostEqual(m['brier'],.04)
        self.assertAlmostEqual(m['logLoss'],-np.log(.8))
        self.assertAlmostEqual(m['ece'],.2)
        self.assertEqual(m['confidence65']['n'],4)


if __name__=='__main__':
    unittest.main()
