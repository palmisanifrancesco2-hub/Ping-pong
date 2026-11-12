"""Retrospective market comparison. Run --select BEFORE building confirmation features.

Research dependencies: Python 3.11+, numpy, scikit-learn, joblib. No production imports.
Labels for the new cohort are never opened by the selection stage.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone

os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
import joblib
import numpy as np
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / ".research-data"
PROTOCOL = json.loads((ROOT / "research/protocol-v8.json").read_text())
CANDIDATES = PROTOCOL["candidates"]
TARGETS = PROTOCOL["targetNames"]
SEED = PROTOCOL["seed"]
DAY = 86400000


def stamp(value):
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value, exclusive=False):
    with path.open("x" if exclusive else "w") as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream, allow_nan=False, separators=(",", ":"))


def matrix(rows, key):
    return np.asarray([r[key] for r in rows], dtype=float)


def fit_model(kind, rows):
    if kind == "hierarchical-eb":
        return None
    x, y = matrix(rows, "x"), matrix(rows, "y")
    if kind == "joint-score-forest":
        # Scaling balances split criteria. Each leaf still predicts the same weighted
        # empirical mean of all 14 indicators; threshold nesting is preserved.
        scale = np.maximum(y.std(axis=0), .1)
        model = RandomForestRegressor(**PROTOCOL["forest"], random_state=SEED, n_jobs=2)
        model.fit(x, y / scale)
        return {"forest": model, "scale": scale}
    models = []
    for target in range(len(TARGETS)):
        if len(np.unique(y[:, target])) < 2:
            models.append(float(y[:, target].mean()))
            continue
        if kind == "logistic-context":
            model = make_pipeline(StandardScaler(), LogisticRegression(**PROTOCOL["logistic"], random_state=SEED))
        else:
            model = HistGradientBoostingClassifier(**PROTOCOL["boosted"], random_state=SEED)
        model.fit(x, y[:, target])
        models.append(model)
    return models


def predict(kind, model, rows):
    if kind == "hierarchical-eb":
        return matrix(rows, "eb")
    x = matrix(rows, "x")
    if kind == "joint-score-forest":
        return np.clip(model["forest"].predict(x) * model["scale"], 0, 1)
    return np.column_stack([
        np.full(len(rows), m) if isinstance(m, float) else m.predict_proba(x)[:, 1]
        for m in model
    ])


def calibrate(raw, baseline, y, coherent=False):
    grid = np.asarray(PROTOCOL["shrinkWeights"])
    loss = np.asarray([((baseline + w * (raw - baseline) - y) ** 2).mean(axis=0) for w in grid])
    if coherent:
        return np.full(y.shape[1], grid[np.argmin(loss.mean(axis=1))])
    return grid[np.argmin(loss, axis=0)]


def metrics(y, p):
    p = np.clip(p, 1e-9, 1 - 1e-9)
    bins = []
    for i in range(5):
        mask = np.minimum(4, (p * 5).astype(int)) == i
        if mask.any():
            bins.append({"range": [i / 5, (i + 1) / 5], "n": int(mask.sum()),
                         "probability": float(p[mask].mean()), "frequency": float(y[mask].mean())})
    confident = np.maximum(p, 1 - p) >= .65
    return {"n": len(y), "brier": float(np.mean((p - y) ** 2)),
            "logLoss": float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))),
            "ece": float(sum(b["n"] * abs(b["probability"] - b["frequency"]) for b in bins) / len(y)),
            "accuracy": float(np.mean((p >= .5) == y)), "calibration": bins,
            "confidence65": {"n": int(confident.sum()),
                             "accuracy": float(np.mean((p[confident] >= .5) == y[confident])) if confident.any() else None}}


def temporal_split(rows, start):
    cal_start = start - PROTOCOL["calibrationDays"] * DAY
    train = [r for r in rows if r["at"] < cal_start and r["available"] < cal_start]
    calibration = [r for r in rows if cal_start <= r["at"] < start and r["available"] < start]
    return train, calibration


def block_interval(times, differences, draws=10000):
    """Moving 3-hour block bootstrap, including gaps as empty hours.

    Fixed seed resamples observed loss differences only, never creates predictions.
    Bonferroni family-wise intervals over the 14 declared targets.
    """
    hours = (np.asarray(times, dtype=np.int64) // 3600000)
    hours -= hours.min()
    span = int(hours.max()) + 1
    sums = np.bincount(hours, weights=differences, minlength=span)
    counts = np.bincount(hours, minlength=span)
    observed = int((counts > 0).sum())
    if span < 3 or observed < 3:
        return {"lower": None, "upper": None, "observedHours": observed, "blockHours": 3}
    block_sums = np.convolve(sums, np.ones(3), "valid")
    block_counts = np.convolve(counts, np.ones(3), "valid")
    rng = np.random.default_rng(SEED)
    sampled = rng.integers(0, len(block_sums), size=(draws, int(np.ceil(span / 3))))
    totals = block_counts[sampled].sum(axis=1)
    values = block_sums[sampled].sum(axis=1)[totals > 0] / totals[totals > 0]
    alpha = .05 / len(TARGETS)
    lo, hi = np.quantile(values, [alpha / 2, 1 - alpha / 2])
    return {"lower": float(lo), "upper": float(hi), "observedHours": observed,
            "blockHours": 3, "draws": draws, "familyTargets": len(TARGETS)}


def select():
    manifest_path = DATA / "market-v8-selection.json"
    if manifest_path.exists():
        raise RuntimeError("Selection already frozen: do not overwrite after inspecting confirmation")
    feature_path = DATA / "market-v8-features.json"
    source = json.loads(feature_path.read_text())
    if source["protocol"] != PROTOCOL or list(source["targets"]) != TARGETS:
        raise RuntimeError("Protocol or target mismatch")
    rows = source["rows"]
    if any(r["featuresAvailable"] >= r["at"] or r["available"] <= r["at"] for r in rows):
        raise RuntimeError("Non-causal row")
    starts = [stamp(s) for s in PROTOCOL["foldStarts"]]
    end = stamp(PROTOCOL["historyEndExclusive"])
    predictions = {k: [] for k in CANDIDATES}
    tested, folds = [], []
    for i, start in enumerate(starts):
        train, cal = temporal_split(rows, start)
        test = [r for r in rows if start <= r["at"] < (starts[i + 1] if i + 1 < len(starts) else end) and r["available"] < end]
        if len(train) < PROTOCOL["minimumTraining"] or len(cal) < PROTOCOL["minimumCalibration"] or not test:
            folds.append({"start": start, "training": len(train), "calibration": len(cal), "test": len(test), "skipped": True})
            continue
        info = {"start": start, "training": len(train), "calibration": len(cal), "test": len(test), "weights": {}}
        for kind in CANDIDATES:
            model = fit_model(kind, train)
            weights = calibrate(predict(kind, model, cal), matrix(cal, "baseline"), matrix(cal, "y"), kind == "joint-score-forest")
            raw, baseline = predict(kind, model, test), matrix(test, "baseline")
            predictions[kind].append(baseline + weights * (raw - baseline))
            info["weights"][kind] = weights.tolist()
        tested.extend(test)
        folds.append(info)
        print(json.dumps({"phase": "historical_fold", **{k: v for k, v in info.items() if k != "weights"}}), flush=True)
    if not tested:
        raise RuntimeError("Insufficient historical folds")
    y = matrix(tested, "y")
    pooled = {k: np.concatenate(predictions[k]) for k in CANDIDATES}
    selection = [min(CANDIDATES, key=lambda k: np.mean((pooled[k][:, j] - y[:, j]) ** 2)) for j in range(len(TARGETS))]
    train, cal = temporal_split(rows, end)
    if len(train) < PROTOCOL["minimumTraining"] or len(cal) < PROTOCOL["minimumCalibration"]:
        raise RuntimeError("Insufficient final training/calibration")
    models, weights = {}, {}
    for kind in CANDIDATES:
        models[kind] = fit_model(kind, train)
        weights[kind] = calibrate(predict(kind, models[kind], cal), matrix(cal, "baseline"), matrix(cal, "y"), kind == "joint-score-forest")
    model_path = DATA / "market-v8-frozen.joblib"
    if model_path.exists():
        raise RuntimeError("Frozen model exists")
    joblib.dump({"models": models, "weights": weights}, model_path)
    os.chmod(model_path, 0o600)
    history = [{"target": name, "selected": selection[j], "reference": metrics(y[:, j], matrix(tested, "baseline")[:, j]),
                "candidates": {k: metrics(y[:, j], pooled[k][:, j]) for k in CANDIDATES}} for j, name in enumerate(TARGETS)]
    manifest = {"protocol": PROTOCOL, "frozenAt": datetime.now(timezone.utc).isoformat(),
                "featuresHash": sha(feature_path), "modelHash": sha(model_path), "inputHash": source["inputHash"],
                "closingHash": source["closingHash"], "sklearnVersion": sklearn.__version__,
                "selected": dict(zip(TARGETS, selection)), "finalTraining": len(train), "finalCalibration": len(cal),
                "finalWeights": {k: w.tolist() for k, w in weights.items()}, "folds": folds,
                "history": history, "historicalCases": len(tested)}
    write_json(manifest_path, manifest, exclusive=True)
    write_json(DATA / "market-v8-historical-audit.json", {"ids": [r["id"] for r in tested], "y": y.tolist(),
               "predictions": {k: p.tolist() for k, p in pooled.items()}}, exclusive=True)
    print(json.dumps({"phase": "selection_frozen", "historicalCases": len(tested), "selected": manifest["selected"]}), flush=True)


def confirm():
    manifest_path = DATA / "market-v8-selection.json"
    manifest = json.loads(manifest_path.read_text())
    model_path = DATA / "market-v8-frozen.joblib"
    if sha(model_path) != manifest["modelHash"] or manifest["protocol"] != PROTOCOL:
        raise RuntimeError("Frozen model/protocol modified")
    source = json.loads((DATA / "market-v8-confirmation-features.json").read_text())
    if source["selectionHash"] != sha(manifest_path):
        raise RuntimeError("Confirmation not bound to frozen selection")
    rows = source["rows"]
    if not rows or len({r["id"] for r in rows}) != len(rows):
        raise RuntimeError("Empty or duplicate confirmation")
    if any(r["featuresAvailable"] >= stamp(PROTOCOL["freshStartInclusive"]) or r["at"] < stamp(PROTOCOL["freshStartInclusive"]) for r in rows):
        raise RuntimeError("Confirmation did not use frozen historical features")
    frozen = joblib.load(model_path)
    baseline, y = matrix(rows, "baseline"), matrix(rows, "y")
    predictions = {k: baseline + frozen["weights"][k] * (predict(k, frozen["models"][k], rows) - baseline) for k in CANDIDATES}
    targets = []
    for j, target in enumerate(TARGETS):
        kind = manifest["selected"][target]
        p = predictions[kind][:, j]
        score, reference = metrics(y[:, j], p), metrics(y[:, j], baseline[:, j])
        interval = block_interval([r["at"] for r in rows], (p - y[:, j]) ** 2 - (baseline[:, j] - y[:, j]) ** 2)
        gates = {"cases": len(rows) >= PROTOCOL["freshTargetCases"], "hours": interval["observedHours"] >= 12,
                 "brierImprovement": interval["upper"] is not None and interval["upper"] < 0,
                 "logLossImprovement": score["logLoss"] < reference["logLoss"], "calibration": score["ece"] < .08}
        targets.append({"target": target, "selected": kind, "metrics": score, "reference": reference,
                        "pairedBrierDifference": interval, "gates": gates, "temporalConfirmationPassed": all(gates.values()),
                        "operationallyValidated": False})
    report = {"version": PROTOCOL["version"], "generatedAt": datetime.now(timezone.utc).isoformat(),
              "source": "MoviOdds reported results; kickoff checked against closing", "protocol": PROTOCOL,
              "hashes": {"selection": sha(manifest_path), "model": sha(model_path), "history": manifest["inputHash"],
                         "confirmationFeatures": sha(DATA / "market-v8-confirmation-features.json")},
              "historicalCases": manifest["historicalCases"], "historicalFolds": manifest["folds"],
              "history": manifest["history"], "finalTraining": manifest["finalTraining"], "finalCalibration": manifest["finalCalibration"],
              "confirmation": {"n": len(rows), "collectionComplete": source["complete"],
                               "from": min(r["at"] for r in rows), "to": max(r["at"] for r in rows),
                               "sealedAt": source["sealedAt"], "selectionFrozenAt": manifest["frozenAt"],
                               "targets": targets},
              "limitations": PROTOCOL["limits"] + ["Confirmation is retrospective, from one day, with frozen previous-day features; not independent multi-day forward betting evidence.",
                "Joint score forest uses common CART leaf weights for score indicators at declared lines; it does not implement the MMD-based Distributional Random Forest algorithm.",
                "Only the historically selected candidate is evaluated per target on confirmation. No re-selection from these outcomes."]}
    write_json(DATA / "market-v8-confirmation-audit.json", {"ids": [r["id"] for r in rows], "y": y.tolist(),
                "predictions": {k: p.tolist() for k, p in predictions.items()}}, exclusive=True)
    # Publish aggregate results only, never player/event-level prediction history.
    (ROOT / "research/report-v8.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"phase": "confirmation_complete", "n": len(rows), "passed": sum(t["temporalConfirmationPassed"] for t in targets),
                      "operationallyValidated": False}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=["select", "confirm"])
    args = parser.parse_args()
    select() if args.stage == "select" else confirm()
