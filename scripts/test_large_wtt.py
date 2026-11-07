import unittest,importlib.util,tempfile,csv
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
spec=importlib.util.spec_from_file_location('large_wtt',Path(__file__).with_name('train-large-wtt.py'));w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)


class LargeWttTests(unittest.TestCase):
    def test_future_and_delayed_results_cannot_change_earlier_features(self):
        def row(i,day,y):return {'id':str(i),'at':day*w.DAY,'available':(day+7)*w.DAY,'home':'A','away':'B','y':y,'setMargin':.5 if y else -.5,'pointMargin':.1 if y else -.1}
        records=[row(0,0,1),row(1,7,0),row(2,8,1),row(3,9,0)]
        previous=w.P['minimumPlayerHistory'];w.P['minimumPlayerHistory']=1
        try:
            a,_=w.feature_rows(records)
            self.assertEqual([r['id'] for r in a],['2','3'])
            changed=[dict(r) for r in records];changed[-1]['y']=1
            b,_=w.feature_rows(changed)
            np.testing.assert_array_equal(a[0]['x'],b[0]['x'])
            self.assertGreater(a[0]['x'][0],0)
        finally:w.P['minimumPlayerHistory']=previous

    def test_loader_rejects_wrong_winner_and_does_not_use_false_format(self):
        old=w.DATA
        with tempfile.TemporaryDirectory() as tmp:
            w.DATA=Path(tmp)
            try:
                with (w.DATA/'sample.csv').open('w') as f:
                    fields=['match_id','event_date','player1_name','player2_name','score','winner','best_of'];writer=csv.DictWriter(f,fields);writer.writeheader()
                    base={'match_id':'1','event_date':'2023-01-01','player1_name':'A','player2_name':'B','score':'11-5,11-4,11-8','winner':'1','best_of':'7'};writer.writerow(base);writer.writerow({**base,'match_id':'2','winner':'2'})
                records,bad=w.load_records('sample.csv');self.assertEqual(len(records),1);self.assertEqual(sum(bad.values()),1)
                self.assertTrue(records[0]['id'].startswith('sample.csv:'))
            finally:w.DATA=old

    def test_symmetrized_predictions_and_identity_calibration(self):
        x=np.asarray([[-2],[-1],[1],[2]]);model=LogisticRegression().fit(x,[0,0,1,1])
        a=w.raw_predict(model,[{'x':[.7]}]);b=w.raw_predict(model,[{'x':[-.7]}])
        np.testing.assert_allclose(a,1-b,atol=1e-12)
        np.testing.assert_allclose(w.calibrated(a,1,1),a,atol=1e-12)
        np.testing.assert_allclose(w.calibrated(a,1,0),.5,atol=1e-12)
