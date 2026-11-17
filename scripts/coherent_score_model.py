"""One BO5 score distribution implies coherent winner/set markets. No point model."""
import numpy as np

SCORES = np.array([[3, 0], [3, 1], [3, 2], [0, 3], [1, 3], [2, 3]])
HEADS = np.stack([SCORES[:, 0] > SCORES[:, 1], SCORES.sum(axis=1) > 3.5,
                 SCORES.sum(axis=1) > 4.5, SCORES[:, 0]-SCORES[:, 1] > 1.5,
                 SCORES[:, 0]-SCORES[:, 1] > -1.5], axis=1).astype(float)


def score_class(sets):
    if not sets or any(len(s) != 2 or any(not isinstance(v, int) for v in s)
                       or min(s) < 0 or max(s) < 11 or abs(s[0]-s[1]) < 2
                       or (max(s) > 11 and abs(s[0]-s[1]) != 2) for s in sets):
        raise ValueError('Illegal set score')
    a = b = 0
    for home, away in sets:
        if max(a, b) == 3:
            raise ValueError('Match continues after terminal score')
        a += home > away
        b += away > home
    matches = np.flatnonzero(np.all(SCORES == [a, b], axis=1))
    if not len(matches):
        raise ValueError('Not a complete BO5 result')
    return int(matches[0])


def distribution(values):
    p = np.asarray(values, dtype=float)
    if (p.ndim != 2 or p.shape[1] != 6 or not len(p) or not np.isfinite(p).all()
            or np.any((p < 0) | (p > 1)) or not np.allclose(p.sum(axis=1), 1, atol=1e-9, rtol=0)):
        raise ValueError('Invalid score distribution')
    return p


def derived(values):
    return distribution(values) @ HEADS


def categorical_losses(values, y):
    p = distribution(values)
    y = np.asarray(y)
    if y.shape != (len(p),) or not np.issubdtype(y.dtype, np.integer) or np.any((y < 0) | (y > 5)):
        raise ValueError('Invalid exact-score outcomes')
    return -np.log(np.clip(p[np.arange(len(p)), y], 1e-9, 1)), np.sum((p-np.eye(6)[y])**2, axis=1)


def categorical_metrics(values, y):
    p = distribution(values)
    logloss, brier = categorical_losses(p, y)
    maximum = p.max(axis=1)
    decided = (p == maximum[:, None]).sum(axis=1) == 1
    correct = int(np.sum((p.argmax(axis=1) == y) & decided))
    undecided = int(np.sum(~decided))
    return {'n': len(p), 'correct': correct, 'wrong': len(p)-correct-undecided,
            'undecided': undecided, 'accuracy': correct/int(decided.sum()) if decided.any() else None,
            'brier': float(brier.mean()), 'logLoss': float(logloss.mean())}


def temperature(values, value):
    p = distribution(values)
    if not np.isfinite(value) or value <= 0:
        raise ValueError('Invalid temperature')
    logits = np.log(np.clip(p, 1e-9, 1))/value
    logits -= logits.max(axis=1, keepdims=True)
    out = np.exp(logits)
    return out/out.sum(axis=1, keepdims=True)


def calibrate(raw, baseline, y, temperatures, weights):
    raw, baseline = distribution(raw), distribution(baseline)
    if raw.shape != baseline.shape:
        raise ValueError('Calibration shape mismatch')
    if not weights or any(not np.isfinite(w) or not 0 <= w <= 1 for w in weights):
        raise ValueError('Invalid shrink weights')
    candidates = [(float(categorical_losses(baseline+w*(temperature(raw, t)-baseline), y)[0].mean()), t, w)
                  for t in temperatures for w in weights]
    _, t, w = min(candidates)  # Stable tie-breaking; no test inputs accepted.
    return {'temperature': t, 'weight': w}


def calibrated(raw, baseline, parameters):
    baseline = distribution(baseline)
    p = baseline + parameters['weight']*(temperature(raw, parameters['temperature'])-baseline)
    return distribution(p)
