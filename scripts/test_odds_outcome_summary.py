import unittest
from odds_outcome_summary import summarize


class OddsOutcomeSummaryTests(unittest.TestCase):
    def test_price_is_for_predicted_side_not_the_winner_after_the_fact(self):
        rows = [{'p': .8, 'y': 1, 'homeOdds': 1.5, 'awayOdds': 3},
                {'p': .4, 'y': 0, 'homeOdds': 2.5, 'awayOdds': 2},
                {'p': .6, 'y': 0, 'homeOdds': 2.5, 'awayOdds': 1.6},
                {'p': .2, 'y': 1, 'homeOdds': 1.4, 'awayOdds': 3}]
        r = summarize(rows)
        self.assertEqual(r['correct']['mean'], 1.75)
        self.assertEqual(r['wrong']['mean'], 2.75)
        self.assertEqual(r['meanWrongMinusCorrect'], 1)
        self.assertEqual(r['theoreticalNetUnitsAtRecordedPrices'], -.5)

    def test_ties_empty_groups_and_missing_prices_are_explicit(self):
        r = summarize([{'p': .5, 'y': 1, 'homeOdds': 2, 'awayOdds': 2}])
        self.assertEqual(r['undecided'], 1)
        self.assertEqual(r['selected'], 0)
        self.assertIsNone(r['correct']['mean'])
        self.assertIsNone(r['meanWrongMinusCorrect'])
        with self.assertRaises(ValueError):
            summarize([{'p': .7, 'y': 1, 'homeOdds': float('nan'), 'awayOdds': 2}])

    def test_minimum_and_positive_ev_are_separate_no_maximum_is_applied(self):
        rows = [{'p': .9, 'y': 1, 'homeOdds': 1.2, 'awayOdds': 4},
                {'p': .8, 'y': 1, 'homeOdds': 1.3, 'awayOdds': 3},
                {'p': .75, 'y': 0, 'homeOdds': 4/3, 'awayOdds': 2},
                {'p': .6, 'y': 0, 'homeOdds': 20, 'awayOdds': 1.1}]
        r = summarize(rows, minimum=1.3, positive_ev=True)
        self.assertEqual(r['selected'], 2)
        self.assertEqual(r['excludedByMinimumOdds'], 1)
        self.assertEqual(r['excludedByEV'], 1)
        self.assertEqual(r['wrong']['max'], 20)


if __name__ == '__main__':
    unittest.main()
