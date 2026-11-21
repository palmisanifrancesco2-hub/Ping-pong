"""Joint score CatBoost on Setka 2022 with a separate chronological calibration window."""
import hashlib
import importlib.util
import json
from datetime import date
from pathlib import Path

import catboost
import numpy as np

from advanced_benchmark import metrics
from coherent_score_model import HEADS, calibrate, calibrated, categorical_metrics, derived
from projection_ensemble import paired_interval

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('setka_archive', Path(__file__).with_name('benchmark-setka-2022.py'))
setka = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setka)


def main():
    research = ROOT/'research'
    protocol = json.loads((research/'protocol-catboost-setka-v27.json').read_text())
    archive = json.loads((research/protocol['archiveProtocol']).read_text())
    path = ROOT/'.research-data/setka-september-2022.csv'
    if hashlib.sha256(path.read_bytes()).hexdigest() != archive['sha256']:
        raise ValueError('Unexpected dataset hash')
    matches, counts = setka.read_matches(path)
    rows = setka.build_features(matches, archive)
    boundary = lambda key: date.fromisoformat(archive[key]).toordinal()
    train = [r for r in rows if r['day'] <= boundary('trainingThrough')]
    cal = [r for r in rows if boundary('calibrationFrom') <= r['day'] <= boundary('calibrationThrough')]
    test = [r for r in rows if boundary('testFrom') <= r['day'] <= boundary('testThrough')]
    x = lambda group: np.asarray([r['x'] for r in group])
    y = lambda group: np.asarray([r['scoreClass'] for r in group])
    prior = (np.bincount(y(train), minlength=6)+1)/(len(train)+6)
    baseline = lambda group: np.tile(prior, (len(group), 1))
    model = catboost.CatBoostClassifier(**protocol['training'], loss_function='MultiClass',
                                       verbose=False, allow_writing_files=False)
    model.fit(x(train), y(train))
    if list(model.classes_) != list(range(6)):
        raise ValueError('Unexpected score class order')
    parameters = calibrate(model.predict_proba(x(cal)), baseline(cal), y(cal),
                           protocol['calibration']['temperatures'], protocol['calibration']['weights'])
    raw = model.predict_proba(x(test))
    pred = calibrated(raw, baseline(test), parameters)
    truth = HEADS[y(test)]
    prob = derived(pred)
    prev = json.loads((research/'report-setka-2022-v25.json').read_text())
    if prev['test'] != len(test) or not np.array_equal(truth[:, :2], np.asarray([r['y'] for r in test])):
        raise ValueError('Test cohort mismatch')
    scores = {}
    settings = {**archive, 'familyComparisons':5}
    for j, market in enumerate(protocol['metrics'][1:]):
        ref = derived(baseline(test))[:,j]
        delta = (prob[:,j]-truth[:,j])**2-(ref-truth[:,j])**2
        benchmark = prev['markets'].get(market)
        scores[market] = {
            'catBoost': metrics(truth[:,j], prob[:,j]),
            'raw': metrics(truth[:,j], derived(raw)[:,j]),
            'historicalFrequency': metrics(truth[:,j], ref),
            'deltaVersusFrequency': paired_interval(test, delta, settings),
            'priorLogistic': benchmark['models']['logistic']['calibrated'] if benchmark else None,
            'priorReference': benchmark['reference'] if benchmark else None,
        }
    report = {'protocol':protocol, 'catboostVersion':catboost.__version__, 'counts':counts,
              'training':len(train), 'calibration':len(cal), 'test':len(test),
              'calibrationSelection':parameters, 'markets':scores, 'oddsAvailable':False,
              'exactScore':{'catBoost':categorical_metrics(pred, y(test)),
                            'raw':categorical_metrics(raw, y(test)),
                            'historicalFrequency':categorical_metrics(baseline(test), y(test))}}
    with (research/'report-catboost-setka-v27.json').open('x') as file:
        json.dump(report, file, indent=2, allow_nan=False)
        file.write('\n')


if __name__ == '__main__':
    main()
