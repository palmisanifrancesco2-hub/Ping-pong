"""Replay decisions at completed-set boundaries using real archived scores."""
import hashlib
import importlib.util
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
import joblib
from catboost import CatBoostClassifier
from scipy.special import logit
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from advanced_benchmark import metrics

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('setka_archive', Path(__file__).with_name('benchmark-setka-2022.py'))
setka = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setka)


def live_states(sets):
    home = away = 0
    for win in sets:
        yield home, away
        home += win
        away += 1-win


def fit_stages(groups, protocol):
    stages = []
    fitted_stages = {}
    for stage, block in sorted(groups.items()):
        train, cal, test = [block[key] for key in ('train','cal','test')]
        x = lambda items: np.asarray([x+list(state) for x,state,_,_ in items])
        y = lambda items: np.asarray([y for _,_,y,_ in items])
        states = defaultdict(list)
        for _,state,label,_ in train:
            states[state].append(label)
        weight = protocol['statePriorWeight']
        def reference(items):
            return [(sum(states[state])+weight/2)/(len(states[state])+weight) for _,state,_,_ in items]
        cal_scores = {'scoreOnly':reference(cal)}
        test_scores = {'scoreOnly':reference(test)}
        candidates = {
            'logistic':make_pipeline(StandardScaler(), LogisticRegression(C=protocol['logisticC'])),
            'catboost':CatBoostClassifier(**protocol['catboost'], verbose=False, allow_writing_files=False),
        }
        fitted = {}
        for name, model in candidates.items():
            model.fit(x(train), y(train))
            def predictor(items):
                raw = model.predict_proba(x(items))[:,1]
                return logit(np.clip(raw, 1e-6, 1-1e-6)).reshape(-1,1)
            calibration = LogisticRegression(C=protocol['calibrationC']).fit(predictor(cal), y(cal))
            fitted[name] = (model, calibration)
            cal_scores[name] = calibration.predict_proba(predictor(cal))[:,1]
            test_scores[name] = calibration.predict_proba(predictor(test))[:,1]
        calibration_metrics = {k:metrics(y(cal), p) for k,p in cal_scores.items()}
        selected = min(calibration_metrics, key=lambda k:calibration_metrics[k]['brier'])
        fitted_stages[stage] = {'models':fitted, 'selected':selected,
                                'scoreOnly':{s:(sum(values)+weight/2)/(len(values)+weight)
                                             for s,values in states.items()}}
        pre_model, pre_calibration = fitted_stages[0]['models']['logistic']
        pre_features = np.asarray([features+[0,0] for features,_,_,_ in test])
        pre_logits = logit(np.clip(pre_model.predict_proba(pre_features)[:,1], 1e-6, 1-1e-6)).reshape(-1,1)
        stages.append({'completedSets':stage, 'train':len(train), 'calibration':len(cal),
                                 'test':len(test), 'selectedOnCalibration':selected,
                                 'calibrationMetrics':calibration_metrics,
                                 'prematchLogisticOnSameMatches':metrics(y(test), pre_calibration.predict_proba(pre_logits)[:,1]),
                                 'testMetrics':{k:metrics(y(test), p) for k,p in test_scores.items()}})
    return stages, fitted_stages


def main():
    root = ROOT/'research'
    protocol = json.loads((root/'protocol-live-setka-v28.json').read_text())
    archive = json.loads((root/protocol['archive']).read_text())
    path = ROOT/'.research-data/setka-september-2022.csv'
    if hashlib.sha256(path.read_bytes()).hexdigest() != archive['sha256']:
        raise ValueError('Unexpected dataset hash')
    histories = defaultdict(list)
    matches, counts = setka.read_matches(path, set_history=histories)
    rows = setka.build_features(matches, archive)
    sequences = [seq for day in sorted(histories) for seq in histories[day]]
    if len(rows) != len(sequences):
        raise ValueError('Unaligned set histories')
    boundary = lambda key: date.fromisoformat(archive[key]).toordinal()
    groups = defaultdict(lambda: defaultdict(list))
    for row, sets in zip(rows, sequences):
        if len(sets) != row['scoreClass']%3+3 or int(sum(sets)==3) != row['y'][0]:
            raise ValueError('Mismatched match outcome')
        day = row['day']
        if day <= boundary('trainingThrough'):
            block = 'train'
        elif boundary('calibrationFrom') <= day <= boundary('calibrationThrough'):
            block = 'cal'
        elif boundary('testFrom') <= day <= boundary('testThrough'):
            block = 'test'
        else:
            continue
        for stage, state in enumerate(live_states(sets)):
            groups[stage][block].append((row['x'], state, row['y'][0], day))
    report = {'protocol':protocol, 'sourceCounts':counts, 'stages':[],
              'oddsAvailable':False, 'operationallyValidated':False}
    report['stages'], fitted_stages = fit_stages(groups, protocol)
    artifact = ROOT/'.research-data/live-setka-v28.joblib'
    with artifact.open('xb') as file:
        artifact.chmod(0o600)
        joblib.dump({'stages':fitted_stages, 'protocol':protocol, 'archiveHash':archive['sha256']}, file)
    report['artifactHash'] = hashlib.sha256(artifact.read_bytes()).hexdigest()
    with (root/'report-live-setka-v28.json').open('x') as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write('\n')


if __name__ == '__main__':
    main()
