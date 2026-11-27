"""Compare prematch set and point models over the v32 chronological folds."""
import json
from collections import defaultdict
from datetime import date
from pathlib import Path
import importlib.util

import numpy as np
import sklearn
from scipy.special import logit
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from advanced_benchmark import metrics
from coherent_score_model import (HEADS, calibrated, calibrate, categorical_losses,
                                  categorical_metrics, derived, score_class)
from projection_ensemble import paired_interval

ROOT = Path(__file__).resolve().parents[1]
COHERENT_HEADS = {'sets-over-3.5': 1, 'sets-over-4.5': 2,
                  'home-set-handicap-minus-1.5': 3, 'home-set-handicap-plus-1.5': 4}


def target_outcomes(sets, score):
    points = sum(a+b for a,b in sets)
    margin = sum(a-b for a,b in sets)
    return [int(sets[0][0]>sets[0][1]), int(sum(sets[0])>19.5),
            int(HEADS[score,1]), int(HEADS[score,2]),
            *(int(points>line) for line in (74.5,79.5,84.5)),
            int(HEADS[score,3]), int(HEADS[score,4]),
            *(int(margin>line) for line in (5.5,-5.5,9.5,-9.5)), score]


def matrix(rows):
    return np.asarray([r['x'] for r in rows]), np.asarray([r['target'] for r in rows])


def league_reference(train, rows, truth, prior_weight):
    by_league = defaultdict(list)
    for r, label in zip(train,truth,strict=True):
        by_league[r['league']].append(label)
    prior = truth.mean(axis=0)
    rates = {league:(np.sum(labels,axis=0)+prior_weight*prior)/(len(labels)+prior_weight)
             for league,labels in by_league.items()}
    return np.asarray([rates.get(r['league'],prior) for r in rows])


def pooled_models(plan, train, cal, choose, test):
    x_train,y_train=matrix(train)
    x_cal,y_cal=matrix(cal)
    x_choose,y_choose=matrix(choose)
    x_test,_=matrix(test)
    def logistic():
        return make_pipeline(StandardScaler(),LogisticRegression(C=plan['logisticC'],max_iter=350))
    joint=logistic().fit(x_train,y_train[:,-1])
    joint_cal=joint.predict_proba(x_cal)
    joint_params=calibrate(joint_cal,joint_cal,y_cal[:,-1],plan['scoreTemperatures'],[1])
    joint_test=calibrated(joint.predict_proba(x_test),joint.predict_proba(x_test),joint_params)
    joint_choose=calibrated(joint.predict_proba(x_choose),joint.predict_proba(x_choose),joint_params)

    output,selection={},{}
    for j,target in enumerate(plan['targets']):
        exact=target=='exact-score'
        truth = np.eye(6)[y_train[:,j]] if exact else y_train[:,j]
        preds={'league':league_reference(train,test,truth,plan['leaguePriorWeight'])}
        choices={'league':league_reference(train,choose,truth,plan['leaguePriorWeight'])}
        if exact:
            preds['joint-logistic'],choices['joint-logistic']=joint_test,joint_choose
        else:
            if target in COHERENT_HEADS:
                head=COHERENT_HEADS[target]
                preds['joint-logistic'],choices['joint-logistic']=derived(joint_test)[:,head],derived(joint_choose)[:,head]
            candidates={'logistic':logistic(),'histogram-boosting':HistGradientBoostingClassifier(**plan['histogramBoosting'])}
            for name,model in candidates.items():
                model.fit(x_train,y_train[:,j])
                def logits(x):
                    return logit(np.clip(model.predict_proba(x)[:,1],1e-6,1-1e-6)).reshape(-1,1)
                calibrator=LogisticRegression(C=plan['calibrationC']).fit(logits(x_cal),y_cal[:,j])
                preds[name]=calibrator.predict_proba(logits(x_test))[:,1]
                choices[name]=calibrator.predict_proba(logits(x_choose))[:,1]
        measure = categorical_metrics if exact else metrics
        selection[target]=min(choices,key=lambda name:measure(choices[name],y_choose[:,j])['brier']
                              if exact else measure(y_choose[:,j],choices[name])['brier'])
        output[target]={**preds,'chosen-on-prior-day':preds[selection[target]]}
    return output,selection,joint_params


def load_rows(plan, prematch):
    partition,archive,rules,setka_rules,paths=prematch.configure(plan['partition'])
    expanded=prematch.load_module('expanded','benchmark-live-expanded.py')
    rows,counts=prematch.features(expanded,paths[0],archive)
    by_id={r['id']:r['sets'] for r in json.loads(paths[0].read_text())}
    for r in rows:
        sets=by_id[r['id']]
        label=score_class(sets)
        if label!=r['scoreClass']:
            raise ValueError('Misaligned MoviOdds outcome')
        r['target']=target_outcomes(sets,label)
    points=defaultdict(list)
    past,setka_counts=expanded.replay.setka.read_matches(paths[1],point_history=points)
    older=expanded.replay.setka.build_features(past,setka_rules)
    for r,(day,sets) in zip(older,((day,sets) for day in sorted(points) for sets in points[day]),strict=True):
        label=score_class(sets)
        if r['day']!=day or label!=r['scoreClass']:
            raise ValueError('Misaligned Setka outcome')
        r.update(target=target_outcomes(sets,label),league='Setka 2022 SCORE')
    return partition,rows,older,counts,setka_counts,paths[0]


def replay(plan,partition,rows,older):
    boundaries=[date.fromisoformat(value).toordinal() for value in partition['testBoundariesUtc']]
    for start,end in zip(boundaries,boundaries[1:]):
        train=older+[r for r in rows if r['day']<=start-partition['trainingEndsDaysBeforeFold']]
        choose_day=start-partition['calibrationEndsDaysBeforeFold']
        cal=[r for r in rows if start-partition['calibrationStartsDaysBeforeFold']<=r['day']<choose_day]
        choose=[r for r in rows if r['day']==choose_day]
        test=[r for r in rows if start<=r['day']<end]
        predictions,selected,temp=pooled_models(plan,train,cal,choose,test)
        yield ({'from':date.fromordinal(start).isoformat(),'untilExclusive':date.fromordinal(end).isoformat(),
                'training':len(train),'calibration':len(cal),'selection':len(choose),'test':len(test),
                'selected':selected,'scoreCalibration':temp},test,predictions)


def main():
    research=ROOT/'research'
    plan=json.loads((research/'protocol-secondary-markets-v33.json').read_text())
    spec=importlib.util.spec_from_file_location('prematch',Path(__file__).with_name('benchmark-prematch-10000.py'))
    prematch=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prematch)
    partition,rows,older,counts,setka_counts,_=load_rows(plan,prematch)
    folds,tested,pool=[],[],defaultdict(lambda:defaultdict(list))
    for fold,test,predictions in replay(plan,partition,rows,older):
        for target, models in predictions.items():
            for model,values in models.items():
                pool[target][model].append(values)
        tested.extend(test)
        folds.append(fold)
        print(fold['from'],len(test),flush=True)
    if len({r['id'] for r in tested})!=len(tested) or len(tested)<partition['minimumTestMatches']:
        raise ValueError('Invalid test coverage or duplicate matches')
    _,truth=matrix(tested)
    summary={}
    for j,target in enumerate(plan['targets']):
        exact=target=='exact-score'
        y=truth[:,j]
        candidates={name:np.concatenate(blocks) for name,blocks in pool[target].items()}
        summary[target]={name:categorical_metrics(p,y) if exact else metrics(y,p) for name,p in candidates.items()}
        p,ref=candidates['chosen-on-prior-day'],candidates['league']
        delta=(categorical_losses(p,y)[1]-categorical_losses(ref,y)[1]) if exact else ((p-y)**2-(ref-y)**2)
        summary[target]['chosenBrierDifference']=float(delta.mean())
        summary[target]['chosenPairedInterval']=paired_interval(tested,delta,plan['pairedComparisons'])
    report={'protocol':plan,'moviodds':counts,'setka':setka_counts,'n':len(tested),
            'testDays':len({r['day'] for r in tested}),'folds':folds,'markets':summary,
            'sklearn':sklearn.__version__,'retrospective':True,'operationallyValidated':False}
    with (research/'report-secondary-markets-v33.json').open('x') as file:
        json.dump(report,file,indent=2,allow_nan=False)
        file.write('\n')


if __name__=='__main__':
    main()
