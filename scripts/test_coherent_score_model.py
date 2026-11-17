import unittest
import importlib.util
from pathlib import Path
import numpy as np
from coherent_score_model import (SCORES, score_class, derived, distribution, categorical_metrics,
                                  calibrate, calibrated)


class CoherentScoreTests(unittest.TestCase):
    def test_labels_and_derived_markets_for_every_terminal_score(self):
        for i, (a, b) in enumerate(SCORES):
            sets = [[11, 5]]*int(a) + [[5, 11]]*int(b) if b == 3 else [[5, 11]]*int(b) + [[11, 5]]*int(a)
            self.assertEqual(score_class(sets), i)
            expected = [a > b, a+b > 3.5, a+b > 4.5, a-b > 1.5, a-b > -1.5]
            np.testing.assert_equal(derived(np.eye(6)[i:i+1])[0], expected)

    def test_invalid_scores_and_probabilities_are_rejected(self):
        for sets in [[], [[11, 10]]*3, [[11, 5]]*2, [[11, 5]]*4]:
            with self.assertRaises(ValueError):
                score_class(sets)
        for p in [np.ones((2, 6)), np.full((1, 6), np.nan), np.array([[1, 0]])]:
            with self.assertRaises(ValueError):
                distribution(p)

    def test_joint_calibration_and_pooling_preserve_coherence(self):
        rng = np.random.default_rng(42)
        raw, base = rng.dirichlet(np.ones(6), 30), rng.dirichlet(np.ones(6), 30)
        y = np.arange(30) % 6
        params = calibrate(raw, base, y, [.75, 1, 1.25], [0, .5, 1])
        result = calibrated(raw, base, params)
        distribution(result)
        p = derived(result)
        self.assertTrue(np.all(p[:, 1] >= p[:, 2]))
        np.testing.assert_allclose(p[:, 0], result[:, :3].sum(axis=1))
        np.testing.assert_allclose(1-p[:, 0], result[:, 3:].sum(axis=1))
        np.testing.assert_allclose(derived((result+base)/2), (derived(result)+derived(base))/2)

    def test_exact_score_ties_are_not_counted_as_correct(self):
        m = categorical_metrics(np.ones((2, 6))/6, np.array([0, 4]))
        self.assertEqual(m['undecided'], 2)
        self.assertEqual(m['correct'], 0)
        self.assertIsNone(m['accuracy'])
        self.assertAlmostEqual(m['brier'], 5/6)
        self.assertAlmostEqual(m['logLoss'], np.log(6))


@unittest.skipUnless(all(importlib.util.find_spec(n) for n in ['torch', 'catboost']),
                     'Requires isolated optional training libraries')
class CoherentTrainingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('coherent_training', Path(__file__).with_name('benchmark-coherent-scores.py'))
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_reference_excludes_future_outcomes_and_handles_unseen_leagues(self):
        rows = [{'availableAt': '2026-01-01T00:00:00Z', 'league': 'A', 'category': 0}]
        cutoff = self.module.stamp('2026-01-02T00:00:00Z')
        before = self.module.baseline_fit(rows, cutoff, 50)
        after = self.module.baseline_fit(rows+[{'availableAt': '2026-01-03T00:00:00Z', 'league': 'A', 'category': 5}], cutoff, 50)
        np.testing.assert_equal(before['global'], after['global'])
        np.testing.assert_equal(before['leagues']['A'], after['leagues']['A'])
        np.testing.assert_equal(self.module.baseline_predict(before, [{'league': 'unseen'}])[0], before['global'])

    def test_neural_fit_is_reproducible_and_inference_does_not_read_labels(self):
        self.module.torch.set_num_threads(2)
        rows = [{'x': [i/20]+[0.]*62, 'category': i%6} for i in range(24)]
        fixed = {'epochs': 5, 'learningRate': .003, 'dropout': .1}
        params = {'hidden': 4, 'weightDecay': .01}
        first = self.module.fit('categorical-mlp', rows, params, fixed, 42)
        second = self.module.fit('categorical-mlp', rows, params, fixed, 42)
        inputs = [{'x': rows[0]['x']}, {'x': rows[1]['x']}]
        p = self.module.predict('categorical-mlp', first, inputs)
        np.testing.assert_allclose(p, self.module.predict('categorical-mlp', second, inputs), atol=0, rtol=0)
        np.testing.assert_allclose(p.sum(axis=1), [1, 1])


if __name__ == '__main__':
    unittest.main()
