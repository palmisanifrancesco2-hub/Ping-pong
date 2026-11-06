import unittest
import numpy as np
from projection_ensemble import aligned_indices,linear_pool,diversity


class EnsembleTests(unittest.TestCase):
    def test_same_events_required_and_order_restored(self):
        self.assertEqual(aligned_indices(['a','b'],['b','a']),[1,0])
        for other in [['a','c'],['a','a']]:
            with self.assertRaises(ValueError):aligned_indices(['a','b'],other)

    def test_probability_pool_and_exact_brier_diversity_identity(self):
        a=np.array([.1,.9,.7,.3]);b=np.array([.5,.5,.2,.8]);y=np.array([0,1,1,0])
        p=linear_pool([a,b],[.5,.5])
        np.testing.assert_allclose(p,[.3,.7,.45,.55])
        expected=(np.mean((a-y)**2)+np.mean((b-y)**2))/2-np.mean((a-b)**2)/4
        self.assertAlmostEqual(float(np.mean((p-y)**2)),expected)
        for components,weights in [([a,b],[.3,.3]),([a,b],[1.1,-.1]),([a,b[:-1]],[.5,.5]),([a,np.array([0,1,np.nan,0])],[.5,.5]),([a,np.array([0,1,1.1,0])],[.5,.5])]:
            with self.assertRaises(ValueError):linear_pool(components,weights)

    def test_identical_models_offer_no_diversity_and_ties_are_excluded_from_agreement(self):
        a=np.array([.1,.8,.5,.3]);y=np.array([0,1,1,1])
        np.testing.assert_array_equal(linear_pool([a,a],[.5,.5]),a)
        d=diversity(y,[a,a]);self.assertAlmostEqual(d['pairs'][0]['residualCorrelation'],1)
        self.assertEqual(d['agreement']['n'],3);self.assertEqual(d['agreement']['correct'],2)
        self.assertAlmostEqual(d['agreement']['accuracy'],2/3)

    def test_disagreement_is_not_counted_as_confident_consensus(self):
        d=diversity([1,0],[[.8,.2],[.3,.9]])
        self.assertEqual(d['agreement']['n'],0);self.assertIsNone(d['agreement']['accuracy'])


if __name__=='__main__':unittest.main()
