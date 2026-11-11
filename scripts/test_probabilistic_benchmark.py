"""Optional-library checks; run explicitly in the isolated v18 research environment."""
import importlib.util
import unittest
from pathlib import Path
import numpy as np

AVAILABLE = all(importlib.util.find_spec(n) for n in ['torch', 'catboost', 'ngboost', 'nflows'])


@unittest.skipUnless(AVAILABLE, 'Requires isolated research v18 optional dependencies')
class ProbabilisticBenchmarkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('probabilistic', Path(__file__).with_name('run-probabilistic-benchmark.py'))
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_point_markets_use_exact_lines_and_are_monotonic(self):
        samples = np.array([[[74, -10], [75, -5], [80, 6], [85, 10]]])
        p = self.module.points_to_probabilities(samples)[0]
        np.testing.assert_allclose(p, [.75, .5, .25, .5, .75, .25, .75])
        self.assertGreaterEqual(p[0], p[1])
        self.assertGreaterEqual(p[1], p[2])
        with self.assertRaises(ValueError):
            self.module.points_to_probabilities(np.array([[[np.nan, 0]]]))

    def test_flow_fit_and_sampling_are_reproducible(self):
        rng = np.random.default_rng(123)
        rows = [{'x': rng.normal(size=3).tolist(), 'points': [70+i%20, i%9-4]} for i in range(30)]
        config = dict(transforms=1, hidden_features=8, epochs=3, learning_rate=.001)
        first = self.module.fit_flow(rows, config, 42)
        second = self.module.fit_flow(rows, config, 42)
        a = self.module.predict_flow(first, rows[:4], 128, 55)
        b = self.module.predict_flow(second, rows[:4], 128, 55)
        np.testing.assert_allclose(a, b, atol=0, rtol=0)
        self.assertTrue(np.all((a >= 0) & (a <= 1)))

    def test_direct_models_constant_target_and_valid_probabilities(self):
        rows = [{'x': [i/20, i%3], 'y': [i%2, 1]} for i in range(40)]
        configs = {'catboost': dict(iterations=3, depth=2, thread_count=1),
                   'ngboost': dict(n_estimators=3, verbose=False)}
        for kind, config in configs.items():
            model = self.module.fit_heads(kind, rows, config, 42)
            # Inference must not read target labels.
            predictions = self.module.predict_heads(model, [{'x': [0., 1.]}, {'x': [1., 2.]}])
            self.assertEqual(predictions.shape, (2, 2))
            self.assertTrue(np.isfinite(predictions).all())
            self.assertTrue(np.all((predictions >= 0) & (predictions <= 1)))
            np.testing.assert_equal(predictions[:, 1], [1, 1])


if __name__ == '__main__':
    unittest.main()
