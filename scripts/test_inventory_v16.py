import copy,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('inventory_v16',Path(__file__).with_name('inventory-data-v16.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class InventoryV16Tests(unittest.TestCase):
    def fixture(self):
        result={'id':'fixture','home':'A','away':'B','finishedAt':'2026-01-01T10:30:00Z'}
        quotes=[{'group_id':'920000','market_id':'920000','line':'To Win','side':name,'pre_close':{'side':name,'market_id':'920000','period':'match','ts':'2026-01-01T09:58:30Z','odds_dec':odds,'suspended':False}} for name,odds in [('A',1.8),('B',2.1)]]
        payload={'fixture_id':'fixture','fixture_ids':['fixture'],'closed':True,'kickoff_known':True,'kickoff_estimated':False,'kickoff_utc':'2026-01-01T10:00:00Z','pre_close_basis':'kickoff','selections':quotes}
        return result,payload

    def test_legality_includes_stopping_and_winner(self):
        self.assertTrue(m.score_checks([(11,5)]*3,True))
        self.assertTrue(m.score_checks([(12,10)]*3,True))
        self.assertFalse(m.score_checks([(11,10)]*3,True))
        self.assertFalse(m.score_checks([(11,5)]*3+[(0,11)],True))
        self.assertFalse(m.score_checks([(11,5)]*3,False))

    def test_normalization_does_not_merge_accents_or_competitions(self):
        self.assertEqual(m.normalize(' Ａ  B  '),'a b')
        self.assertNotEqual(m.normalize('Jose'),m.normalize('José'))

    def test_guard_is_one_minute_before_actual_kickoff(self):
        r,p=self.fixture();guard=m.strict_start(p,r)
        self.assertEqual(guard,m.stamp('2026-01-01T09:59:00Z'))
        self.assertTrue(m.strict_pair(p,r,guard))
        p['kickoff_estimated']=True;self.assertIsNone(m.strict_start(p,r))
        self.assertIsNone(m.strict_start(None,r))

    def test_quotes_after_guard_stale_suspended_or_missing_are_rejected(self):
        r,p=self.fixture();guard=m.strict_start(p,r)
        changes=[{'ts':'2026-01-01T09:59:01Z'},{'ts':'2026-01-01T09:53:59Z'},{'suspended':True},{'odds_dec':1},{'odds_dec':float('nan')}]
        for values in changes:
            altered=copy.deepcopy(p);altered['selections'][0]['pre_close'].update(values)
            self.assertFalse(m.strict_pair(altered,r,guard))
        altered=copy.deepcopy(p);altered['selections'].pop();self.assertFalse(m.strict_pair(altered,r,guard))

    def test_expected_unplayed_set_na_and_false_result_are_not_conflated(self):
        rows=[{'winner':False,'set5':'NA'},{'winner':True,'set5':'11'}]
        missing=m.fields_missing(rows,['winner','set5'])
        self.assertEqual(missing['winner']['missing'],0)
        self.assertEqual(missing['set5']['missing'],1)
