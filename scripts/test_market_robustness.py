from datetime import date
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('robustness',Path(__file__).with_name('benchmark-market-robustness.py'))
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)
inventory = benchmark.module('inventory-data-v16.py')


class SecondaryPriceTest(unittest.TestCase):
    def test_only_pairs_exact_complement_and_prices_before_decision(self):
        match = {'id':'fixture','home':'A','away':'B','finishedAt':'2026-10-26T15:00:00Z'}
        def selection(side,line,at='2026-10-26T14:00:00Z',market='920065'):
            row = {'group_id':'240','market_id':market,'side':side,'line':line,'handicap':line}
            return {**row,'pre_close':{**row,'ts':at,'odds_dec':1.9,'suspended':False}}
        home,away = selection('A','-1.5'),selection('B','+1.5')
        payload = {'fixture_id':'fixture','closed':True,'kickoff_known':True,'kickoff_estimated':False,
                   'kickoff_utc':'2026-10-26T14:02:00Z','pre_close_basis':'kickoff','selections':[home,away]}
        plan = {'maximumQuoteAgeSeconds':300}
        day = date(2026,10,26).toordinal()
        self.assertEqual(benchmark.exact_pairs(payload,match,day,plan,inventory),
                         {'home-set-handicap-minus-1.5':(1.9,1.9)})
        for other in [selection('B','-1.5'),selection('B','+1.5','2026-10-26T14:01:01Z'),
                      selection('B','+1.5',market='920066')]:
            self.assertEqual(benchmark.exact_pairs({**payload,'selections':[home,other]},match,day,plan,inventory),{})
        self.assertEqual(benchmark.exact_pairs(payload,match,day+1,plan,inventory),{})


if __name__ == '__main__':
    unittest.main()
