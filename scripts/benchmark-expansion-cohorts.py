"""Chronological holdouts on the separate Setka and WTT archives."""
import json
from datetime import date

import numpy as np
from scipy.special import logit
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from advanced_benchmark import metrics

import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('robustness', Path(__file__).with_name('benchmark-market-robustness.py'))
robust = importlib.util.module_from_spec(spec)
spec.loader.exec_module(robust)


def evaluate(rows, train_from, train_until, calibration_from, calibration_until, test_from, test_until, lag, min_history):
    dates = [date.fromisoformat(value).toordinal() for value in (
        train_from, train_until, calibration_from, calibration_until, test_from, test_until)]
    if not dates[0] < dates[1] <= dates[2]-lag < dates[3] <= dates[4]-lag < dates[5]:
        raise ValueError('Overlapping or insufficiently separated dates')
    train, cal, test = [[r for r in rows if a<=r['day']<b and r['x'][-1]>=min_history]
                        for a,b in zip(dates[::2],dates[1::2])]
    def xy(sample):
        return np.asarray([r['x'] for r in sample]), np.asarray([int(r['scoreClass']<3) for r in sample])
    x,y=xy(train)
    model=make_pipeline(StandardScaler(),LogisticRegression(C=1,max_iter=350)).fit(x,y)
    def logits(features):
        return logit(np.clip(model.predict_proba(features)[:,1],1e-6,1-1e-6)).reshape(-1,1)
    x_cal,y_cal=xy(cal)
    calibration=LogisticRegression(C=1).fit(logits(x_cal),y_cal)
    x_test,y_test=xy(test)
    return {'training':len(train),'calibration':len(cal),'test':len(test),
            'testDays':len({r['day'] for r in test}),
            'logistic':metrics(y_test,calibration.predict_proba(logits(x_test))[:,1]),
            'reference':metrics(y_test,np.full(len(test),y.mean()))}


def main():
    plan=robust.load('protocol-expansion-v35.json')
    base=robust.module('benchmark-prematch-10000.py')
    _,_,_,setka_protocol,paths=base.configure('protocol-prematch-20000-v32.json')
    setka=robust.module('benchmark-setka-2022.py')
    archive,counts=setka.read_matches(paths[1])
    setka_rows=setka.build_features(archive,setka_protocol)
    data={'Setka 2022':{'counts':counts,**evaluate(setka_rows,*plan['setkaWindows'],lag=2,min_history=0)}}
    v33=robust.module('benchmark-secondary-markets.py')
    for filename,sha in robust.load('protocol-v15.json')['inputs'].items():
        rows,counts=robust.wtt_samples(filename,sha,{'historyLagCalendarDays':8,'eloK':20},setka.build_features,v33.target_outcomes)
        data[filename]={'counts':counts,**evaluate(rows,*plan['wttWindows'],lag=8,min_history=0)}
    path=robust.RESEARCH/'report-expansion-cohorts-v35.json'
    with path.open('x') as handle:
        json.dump({'protocol':plan,'cohorts':data},handle,indent=2,allow_nan=False)
        handle.write('\n')
    for name,cohort in data.items():
        print(name,cohort['test'],cohort['logistic']['correct'],cohort['logistic']['brier'])


if __name__=='__main__':
    main()
