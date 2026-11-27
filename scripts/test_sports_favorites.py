import importlib.util
import json
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name+'.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


benchmark = load_module('benchmark-sports-favorites')
inventory = load_module('inventory-data-v16')


class SportsFavoritesTest(unittest.TestCase):
    def test_selection_uses_model_favorite_even_when_bookmaker_disagrees(self):
        pick = benchmark.select_favorite
        self.assertEqual(pick(.56, 2.25, 1.67, 1.3, 0), (1, 2.25))
        self.assertEqual(pick(.44, 1.67, 2.25, 1.3, 0), (0, 2.25))
        self.assertIsNone(pick(.49, 2.8, 1.4, 1.3, 0))
        self.assertIsNone(pick(.5, 2.8, 1.4, 1.3, 0))
        self.assertIsNone(pick(.55, 2, 1.8, 1.3, .1))
        self.assertIsNone(pick(.9, 1.29, 6, 1.3, 0))

    def test_symmetric_features_only_flip_directional_data(self):
        inputs = [[1, 2, 3, 4, 5, 6, 7, 8, 10], [-1, -2, -3, -4, -5, 6, -7, 8, 10]]
        feature = benchmark.features([{'x': x} for x in inputs])
        np.testing.assert_array_equal(feature[0], -feature[1])

    def test_unit_roi_and_underdog_slice(self):
        rows = [{'at': 0}, {'at': 86400000}, {'at': 2*86400000}]
        result = benchmark.evaluate_prices(rows, [.6, .65, .65], [1, 0, 1], [(2.5, 1.6), (2, 1.8), (1.7, 2.3)],
                                           1.3, 0, {'blockDays': 3})
        self.assertEqual(result['all']['correct'], 2)
        self.assertAlmostEqual(result['all']['roiAtRecordedPrices'], .4)
        self.assertEqual(result['bet365Underdogs']['n'], 2)
        self.assertEqual(result['aboveTwo']['n'], 1)

    def test_price_pair_excludes_late_quotes_and_at_tie_conflicts(self):
        kickoff = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)
        first = '2026-10-22T11:57:00Z'
        result = {'id': 'match', 'home': 'A', 'away': 'B', 'finishedAt': '2026-10-22T12:17:00Z'}
        row = {'day': date(2026, 10, 22).toordinal()}

        def payload(stamp, odds):
            selections = []
            for side, price in zip(('A', 'B'), odds, strict=True):
                q = {'group_id': '920000', 'market_id': '920000', 'line': 'To Win', 'side': side, 'period': ''}
                selections.append({**q, 'pre_close': {**q, 'ts': stamp, 'odds_dec': price, 'suspended': False}})
            return {'closed': True, 'kickoff_known': True, 'kickoff_estimated': False, 'pre_close_basis': 'kickoff',
                    'kickoff_utc': kickoff.isoformat(), 'fixture_id': 'match', 'selections': selections}

        with tempfile.TemporaryDirectory() as directory:
            a, b = (Path(directory)/file for file in ('a.json', 'b.json'))
            a.write_text(json.dumps(payload(first, (2, 1.8))))
            b.write_text(json.dumps(payload('2026-10-22T11:59:20Z', (2.2, 1.65))))
            self.assertEqual(benchmark.priced_pair([a, b], row, result, inventory), (2, 1.8))
            b.write_text(json.dumps(payload(first, (2.2, 1.65))))
            self.assertIsNone(benchmark.priced_pair([a, b], row, result, inventory))


if __name__ == '__main__':
    unittest.main()
