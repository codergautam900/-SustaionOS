from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path


def safe_num(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else 0.0
    except Exception:
        return 0.0


def mean(values):
    clean = [safe_num(value) for value in values]
    return sum(clean) / len(clean) if clean else 0.0


def stddev(values):
    clean = [safe_num(value) for value in values]
    if not clean:
        return 0.0
    peak = max(abs(value) for value in clean)
    if peak == 0:
        return 0.0
    if peak > 1_000_000:
        scaled = [value / peak for value in clean]
        center = mean(scaled)
        return math.sqrt(sum((value - center) ** 2 for value in scaled) / len(scaled)) * peak
    center = mean(clean)
    return math.sqrt(sum((value - center) ** 2 for value in clean) / len(clean))


def clamp(value, low, high):
    return max(low, min(high, value))


def forecast_cap(values, floor=25.0):
    clean = [max(0.0, safe_num(value)) for value in values]
    if not clean:
        return floor
    return max(floor, max(clean) * 3.5, mean(clean) + stddev(clean) * 8.0)


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def hour_of_week(value):
    dt = parse_dt(value)
    if dt is None:
        return None
    return dt.weekday() * 24 + dt.hour


def is_off_hours(value):
    dt = parse_dt(value)
    if dt is None:
        return False
    return dt.weekday() >= 5 or dt.hour < 7 or dt.hour >= 20


def trend_delta(values):
    clean = [safe_num(value) for value in values]
    if len(clean) < 2:
        return 0.0
    midpoint = max(1, len(clean) // 2)
    first = mean(clean[:midpoint])
    last = mean(clean[midpoint:])
    if first == 0:
        return 0.0
    return ((last - first) / first) * 100.0


def ema(values, alpha=0.38):
    clean = [safe_num(value) for value in values]
    if not clean:
        return 0.0
    current = clean[0]
    for point in clean[1:]:
        current = alpha * point + (1.0 - alpha) * current
    return current


def recent_slope(values, lookback=4):
    clean = [safe_num(value) for value in values][-max(2, lookback) :]
    if len(clean) < 2:
        return 0.0
    deltas = [clean[idx] - clean[idx - 1] for idx in range(1, len(clean))]
    return mean(deltas)


class SustainOSLinearModel:
    def __init__(self, state_path, model_name, model_version):
        self.path = Path(state_path)
        self.model_name = model_name
        self.model_version = model_version
        self.window_size = 8
        self.feature_names = [
            "bias",
            "energy",
            "water",
            "delta_energy",
            "delta_water",
            "mean_energy_3",
            "mean_water_3",
            "std_energy_5",
            "std_water_5",
            "trend_energy",
            "trend_water",
            "off_hours_ratio",
            "hour_sin",
            "hour_cos",
            "dow_sin",
            "dow_cos",
            "log_window",
            "battery_level",
            "signal_quality",
            "gap_hours",
        ]
        self.state = self._default_state()
        self.load()

    def _default_state(self):
        feature_count = len(self.feature_names)
        return {
            "trained": False,
            "trainedSamples": 0,
            "featureMeans": [0.0] * feature_count,
            "featureStds": [1.0] * feature_count,
            "weights": {
                "energy": [0.0] * feature_count,
                "water": [0.0] * feature_count,
                "score": [0.0] * feature_count,
            },
            "biases": {"energy": 0.0, "water": 0.0, "score": 0.0},
            "metrics": {"energy": {}, "water": {}, "score": {}},
            "validationMetrics": {"energy": {}, "water": {}, "score": {}},
            "residualStd": {"energy": 1.0, "water": 1.0, "score": 1.0},
            "featureImportance": {"energy": [], "water": [], "score": []},
            "temporalProfile": {
                "hourOfWeekEnergy": [None] * (24 * 7),
                "hourOfWeekWater": [None] * (24 * 7),
                "avgGapHours": 1.0,
                "offHoursEnergy": 0.0,
                "offHoursWater": 0.0,
            },
            "trainingHistory": [],
            "trainingFingerprint": None,
            "lastTrainedAt": None,
        }

    def _align_vector(self, values, fill):
        clean = list(values or [])
        target = len(self.feature_names)
        if len(clean) < target:
            clean.extend([fill] * (target - len(clean)))
        return clean[:target]

    def _align_state(self):
        self.state["featureMeans"] = self._align_vector(self.state.get("featureMeans"), 0.0)
        self.state["featureStds"] = [value or 1.0 for value in self._align_vector(self.state.get("featureStds"), 1.0)]

        weights = self.state.get("weights") or {}
        for target in ("energy", "water", "score"):
            weights[target] = self._align_vector(weights.get(target), 0.0)
        self.state["weights"] = weights

        biases = self.state.get("biases") or {}
        for target in ("energy", "water", "score"):
            biases[target] = safe_num(biases.get(target))
        self.state["biases"] = biases

        metrics = self.state.get("metrics") or {}
        validation = self.state.get("validationMetrics") or {}
        for target in ("energy", "water", "score"):
            metrics[target] = metrics.get(target) or {}
            validation[target] = validation.get(target) or {}
        self.state["metrics"] = metrics
        self.state["validationMetrics"] = validation

        residual_std = self.state.get("residualStd") or {}
        for target in ("energy", "water", "score"):
            residual_std[target] = max(1.0, safe_num(residual_std.get(target)) or 1.0)
        self.state["residualStd"] = residual_std

        importance = self.state.get("featureImportance") or {}
        for target in ("energy", "water", "score"):
            importance[target] = list(importance.get(target) or [])
        self.state["featureImportance"] = importance

        temporal = self.state.get("temporalProfile") or {}
        energy_hours = list(temporal.get("hourOfWeekEnergy") or [])
        water_hours = list(temporal.get("hourOfWeekWater") or [])
        if len(energy_hours) < 168:
            energy_hours.extend([None] * (168 - len(energy_hours)))
        if len(water_hours) < 168:
            water_hours.extend([None] * (168 - len(water_hours)))
        self.state["temporalProfile"] = {
            "hourOfWeekEnergy": energy_hours[:168],
            "hourOfWeekWater": water_hours[:168],
            "avgGapHours": max(0.25, safe_num(temporal.get("avgGapHours")) or 1.0),
            "offHoursEnergy": max(0.0, safe_num(temporal.get("offHoursEnergy"))),
            "offHoursWater": max(0.0, safe_num(temporal.get("offHoursWater"))),
        }

        self.state["trainingHistory"] = list(self.state.get("trainingHistory") or [])[-12:]
        self.state["trainingFingerprint"] = self.state.get("trainingFingerprint")
        self.state["trained"] = bool(self.state.get("trained"))
        self.state["trainedSamples"] = int(self.state.get("trainedSamples") or 0)

    def load(self):
        state = self._default_state()
        if self.path.exists():
            try:
                with self.path.open("r", encoding="utf-8") as handle:
                    raw = json.load(handle)
                if isinstance(raw, dict):
                    state.update(raw)
            except Exception:
                state = self._default_state()
        self.state = state
        self._align_state()
        return self.state

    def save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("w", encoding="utf-8") as handle:
                json.dump(self.state, handle, indent=2)
        except Exception:
            pass

    def _average_r2(self, metrics):
        values = [safe_num((metrics.get(target) or {}).get("r2")) for target in ("energy", "water", "score")]
        return mean(values)

    def status(self):
        metrics = self.state.get("metrics", {})
        validation = self.state.get("validationMetrics", {})
        train_r2 = self._average_r2(metrics)
        validation_r2 = self._average_r2(validation)
        samples = int(self.state.get("trainedSamples") or 0)
        fit_score = round(
            clamp(
                46.0
                + max(0.0, train_r2) * 16.0
                + max(0.0, validation_r2) * 24.0
                + min(16.0, samples * 0.22),
                0,
                100,
            )
        )
        temporal = self.state.get("temporalProfile", {})
        return {
            "name": self.model_name,
            "version": self.model_version,
            "type": "pure-python-ensemble-linear",
            "ensembleMode": "hybrid-linear-seasonal-momentum",
            "active": bool(self.state.get("trained")),
            "label": "Python ML Advanced" if self.state.get("trained") else "Python ML Warmup",
            "source": "python-ml",
            "trainedSamples": samples,
            "featureCount": len(self.feature_names),
            "lastTrainedAt": self.state.get("lastTrainedAt"),
            "metrics": metrics,
            "validationMetrics": validation,
            "fitScore": fit_score,
            "topFeatures": {
                "energy": list((self.state.get("featureImportance") or {}).get("energy") or [])[:3],
                "water": list((self.state.get("featureImportance") or {}).get("water") or [])[:3],
            },
            "temporalProfile": {
                "avgGapHours": round(safe_num(temporal.get("avgGapHours")) or 1.0, 2),
                "offHoursEnergy": round(safe_num(temporal.get("offHoursEnergy"))),
                "offHoursWater": round(safe_num(temporal.get("offHoursWater"))),
            },
            "trainingHistory": list(self.state.get("trainingHistory") or [])[-5:],
        }

    def _ordered(self, records):
        ordered = [dict(record) for record in (records or []) if isinstance(record, dict)]
        ordered.sort(
            key=lambda item: parse_dt(item.get("timestamp") or item.get("createdAt") or item.get("time"))
            or datetime.fromtimestamp(0, tz=timezone.utc)
        )
        return ordered

    def _training_fingerprint(self, ordered):
        if not ordered:
            return None
        latest = ordered[-1]
        latest_ts = latest.get("timestamp") or latest.get("createdAt") or latest.get("time") or ""
        latest_energy = round(safe_num(latest.get("energy")), 3)
        latest_water = round(safe_num(latest.get("water")), 3)
        return f"{len(ordered)}::{latest_ts}::{latest_energy}::{latest_water}"

    def _heuristic_score(self, records):
        ordered = self._ordered(records)
        if not ordered:
            return 0.0
        energy = [safe_num(record.get("energy")) for record in ordered]
        water = [safe_num(record.get("water")) for record in ordered]
        score = 100.0
        score -= mean(energy) / 15.0
        score -= mean(water) / 120.0
        score -= (abs(trend_delta(energy)) + abs(trend_delta(water))) / 6.0
        score -= stddev(energy + water) / 10.0
        score -= sum(1 for record in ordered if is_off_hours(record.get("timestamp"))) * 0.45
        return clamp(score, 0.0, 100.0)

    def _features(self, window):
        ordered = self._ordered(window)
        latest = ordered[-1]
        previous = ordered[-2] if len(ordered) > 1 else latest
        energy = [safe_num(record.get("energy")) for record in ordered]
        water = [safe_num(record.get("water")) for record in ordered]
        last3 = ordered[-3:]
        last5 = ordered[-5:]
        ts = parse_dt(latest.get("timestamp") or latest.get("createdAt") or latest.get("time")) or datetime.now(timezone.utc)
        prev_ts = parse_dt(previous.get("timestamp") or previous.get("createdAt") or previous.get("time")) or ts
        gap_hours = max(0.0, (ts - prev_ts).total_seconds() / 3600.0)
        return [
            1.0,
            safe_num(latest.get("energy")),
            safe_num(latest.get("water")),
            safe_num(latest.get("energy")) - safe_num(previous.get("energy")),
            safe_num(latest.get("water")) - safe_num(previous.get("water")),
            mean([safe_num(record.get("energy")) for record in last3]),
            mean([safe_num(record.get("water")) for record in last3]),
            stddev([safe_num(record.get("energy")) for record in last5]),
            stddev([safe_num(record.get("water")) for record in last5]),
            trend_delta(energy),
            trend_delta(water),
            (sum(1 for record in ordered if is_off_hours(record.get("timestamp"))) / len(ordered)) if ordered else 0.0,
            math.sin(2 * math.pi * ts.hour / 24.0),
            math.cos(2 * math.pi * ts.hour / 24.0),
            math.sin(2 * math.pi * ts.weekday() / 7.0),
            math.cos(2 * math.pi * ts.weekday() / 7.0),
            math.log1p(len(ordered)),
            safe_num(latest.get("batteryLevel")) / 100.0,
            safe_num(latest.get("signalQuality")) / 100.0,
            gap_hours,
        ]

    def _samples(self, ordered):
        samples = []
        if len(ordered) < 4:
            return samples
        for idx in range(2, len(ordered)):
            history = ordered[max(0, idx - self.window_size) : idx]
            current = ordered[idx]
            samples.append(
                {
                    "x": self._features(history),
                    "energy": safe_num(current.get("energy")),
                    "water": safe_num(current.get("water")),
                    "score": self._heuristic_score(history + [current]),
                }
            )
        return samples

    def _standardize_fit(self, matrix):
        columns = list(zip(*matrix))
        means = [mean(column) for column in columns]
        stds = [stddev(column) or 1.0 for column in columns]
        scaled = [[(value - center) / spread for value, center, spread in zip(row, means, stds)] for row in matrix]
        return scaled, means, stds

    def _standardize_apply(self, matrix, means, stds):
        return [[(value - center) / (spread or 1.0) for value, center, spread in zip(row, means, stds)] for row in matrix]

    def _fit(self, X, y, epochs=360, lr=0.028, reg=0.001):
        if not X:
            return [0.0] * len(self.feature_names), 0.0, {
                "mse": 0.0,
                "mae": 0.0,
                "rmse": 0.0,
                "r2": 0.0,
                "residualStd": 1.0,
            }

        weights = [0.0] * len(X[0])
        bias = mean(y)
        for epoch in range(epochs):
            rate = lr / (1.0 + epoch * 0.02)
            for row, target in zip(X, y):
                prediction = bias + sum(weight * feature for weight, feature in zip(weights, row))
                error = prediction - target
                bias -= rate * 2.0 * error
                for index in range(len(weights)):
                    weights[index] -= rate * (2.0 * error * row[index] + reg * weights[index])

        metrics = self._evaluate(weights, bias, X, y)
        return weights, bias, metrics

    def _evaluate(self, weights, bias, X, y):
        if not X or not y:
            return {
                "mse": 0.0,
                "mae": 0.0,
                "rmse": 0.0,
                "r2": 0.0,
                "residualStd": 1.0,
            }

        predictions = [bias + sum(weight * feature for weight, feature in zip(weights, row)) for row in X]
        residuals = [target - prediction for target, prediction in zip(y, predictions)]
        mse = mean([residual * residual for residual in residuals])
        mae = mean([abs(residual) for residual in residuals])
        rmse = math.sqrt(mse) if mse >= 0 else 0.0
        target_mean = mean(y)
        ss_total = sum((target - target_mean) ** 2 for target in y)
        ss_residual = sum((target - prediction) ** 2 for target, prediction in zip(y, predictions))
        r2 = 1.0 - (ss_residual / ss_total) if ss_total else 0.0
        return {
            "mse": round(mse, 3),
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "r2": round(r2, 3),
            "residualStd": round(stddev(residuals) or max(1.0, rmse), 3),
        }

    def _split_samples(self, samples):
        if len(samples) < 8:
            return samples, []
        validation_count = max(2, int(round(len(samples) * 0.2)))
        train_samples = samples[:-validation_count]
        validation_samples = samples[-validation_count:]
        if len(train_samples) < 4:
            return samples, []
        return train_samples, validation_samples

    def _feature_importance_for_target(self, weights):
        ranked = []
        for name, weight in zip(self.feature_names, weights):
            if name == "bias":
                continue
            size = abs(safe_num(weight))
            if size <= 0:
                continue
            ranked.append(
                {
                    "feature": name,
                    "magnitude": round(size, 3),
                    "direction": "up" if safe_num(weight) >= 0 else "down",
                }
            )
        ranked.sort(key=lambda item: item["magnitude"], reverse=True)
        return ranked[:6]

    def _temporal_profile_from_records(self, ordered):
        energy_buckets = [{"sum": 0.0, "count": 0} for _ in range(168)]
        water_buckets = [{"sum": 0.0, "count": 0} for _ in range(168)]
        off_hours_energy = []
        off_hours_water = []
        gaps = []

        previous_ts = None
        for record in ordered:
            timestamp = record.get("timestamp") or record.get("createdAt") or record.get("time")
            index = hour_of_week(timestamp)
            if index is not None:
                energy_buckets[index]["sum"] += safe_num(record.get("energy"))
                energy_buckets[index]["count"] += 1
                water_buckets[index]["sum"] += safe_num(record.get("water"))
                water_buckets[index]["count"] += 1

            current_ts = parse_dt(timestamp)
            if previous_ts is not None and current_ts is not None:
                gaps.append(max(0.0, (current_ts - previous_ts).total_seconds() / 3600.0))
            previous_ts = current_ts or previous_ts

            if is_off_hours(timestamp):
                off_hours_energy.append(safe_num(record.get("energy")))
                off_hours_water.append(safe_num(record.get("water")))

        return {
            "hourOfWeekEnergy": [
                round(bucket["sum"] / bucket["count"], 3) if bucket["count"] else None for bucket in energy_buckets
            ],
            "hourOfWeekWater": [
                round(bucket["sum"] / bucket["count"], 3) if bucket["count"] else None for bucket in water_buckets
            ],
            "avgGapHours": round(mean(gaps) or 1.0, 3),
            "offHoursEnergy": round(mean(off_hours_energy), 3),
            "offHoursWater": round(mean(off_hours_water), 3),
        }

    def train(self, records):
        ordered = self._ordered(records)
        samples = self._samples(ordered)
        fingerprint = self._training_fingerprint(ordered)

        if self.state.get("trained") and fingerprint and fingerprint == self.state.get("trainingFingerprint"):
            return self.status()

        if len(samples) < 4:
            if not self.state.get("trained"):
                self.state = self._default_state()
                self.state["trainedSamples"] = len(samples)
            self.state["trainingFingerprint"] = fingerprint
            self.save()
            return self.status()

        train_samples, validation_samples = self._split_samples(samples)
        train_X = [sample["x"] for sample in train_samples]
        validation_X = [sample["x"] for sample in validation_samples]
        train_scaled, means, stds = self._standardize_fit(train_X)
        validation_scaled = self._standardize_apply(validation_X, means, stds) if validation_X else []

        e_w, e_b, e_train = self._fit(train_scaled, [sample["energy"] for sample in train_samples])
        w_w, w_b, w_train = self._fit(train_scaled, [sample["water"] for sample in train_samples])
        s_w, s_b, s_train = self._fit(train_scaled, [sample["score"] for sample in train_samples])

        if validation_scaled:
            e_validation = self._evaluate(e_w, e_b, validation_scaled, [sample["energy"] for sample in validation_samples])
            w_validation = self._evaluate(w_w, w_b, validation_scaled, [sample["water"] for sample in validation_samples])
            s_validation = self._evaluate(s_w, s_b, validation_scaled, [sample["score"] for sample in validation_samples])
        else:
            e_validation = dict(e_train)
            w_validation = dict(w_train)
            s_validation = dict(s_train)

        history_entry = {
            "at": datetime.now(timezone.utc).isoformat(),
            "samples": len(samples),
            "validationR2": round(mean([e_validation["r2"], w_validation["r2"], s_validation["r2"]]), 3),
            "fitScore": round(
                clamp(
                    46.0
                    + max(0.0, mean([e_train["r2"], w_train["r2"], s_train["r2"]])) * 16.0
                    + max(0.0, mean([e_validation["r2"], w_validation["r2"], s_validation["r2"]])) * 24.0
                    + min(16.0, len(samples) * 0.22),
                    0,
                    100,
                )
            ),
        }

        self.state.update(
            {
                "trained": True,
                "trainedSamples": len(samples),
                "featureMeans": means,
                "featureStds": stds,
                "weights": {"energy": e_w, "water": w_w, "score": s_w},
                "biases": {"energy": e_b, "water": w_b, "score": s_b},
                "metrics": {"energy": e_train, "water": w_train, "score": s_train},
                "validationMetrics": {
                    "energy": e_validation,
                    "water": w_validation,
                    "score": s_validation,
                },
                "residualStd": {
                    "energy": max(1.0, e_validation["residualStd"]),
                    "water": max(1.0, w_validation["residualStd"]),
                    "score": max(1.0, s_validation["residualStd"]),
                },
                "featureImportance": {
                    "energy": self._feature_importance_for_target(e_w),
                    "water": self._feature_importance_for_target(w_w),
                    "score": self._feature_importance_for_target(s_w),
                },
                "temporalProfile": self._temporal_profile_from_records(ordered),
                "trainingHistory": (list(self.state.get("trainingHistory") or []) + [history_entry])[-12:],
                "trainingFingerprint": fingerprint,
                "lastTrainedAt": history_entry["at"],
            }
        )
        self.save()
        return self.status()

    def _scaled(self, features):
        means = self._align_vector(self.state.get("featureMeans"), 0.0)
        stds = [value or 1.0 for value in self._align_vector(self.state.get("featureStds"), 1.0)]
        return [(value - center) / spread for value, center, spread in zip(features, means, stds)]

    def _predict_window(self, window):
        scaled = self._scaled(self._features(window))
        output = {}
        for target in ("energy", "water", "score"):
            weights = self._align_vector((self.state.get("weights") or {}).get(target), 0.0)
            bias = safe_num((self.state.get("biases") or {}).get(target))
            value = bias + sum(weight * feature for weight, feature in zip(weights, scaled))
            output[target] = clamp(value, 0.0, 100.0) if target == "score" else max(0.0, value)
        return output

    def _fallback(self, ordered):
        energy = [safe_num(record.get("energy")) for record in ordered]
        water = [safe_num(record.get("water")) for record in ordered]
        return {
            "energy": max(0.0, ema(energy[-6:] or energy) + recent_slope(energy)),
            "water": max(0.0, ema(water[-6:] or water) + recent_slope(water)),
            "score": clamp(100.0 - (mean(energy) / 15.0) - (mean(water) / 120.0), 0.0, 100.0),
        }

    def _temporal_baseline(self, ordered, metric, target_ts):
        profile = self.state.get("temporalProfile") or {}
        key = "hourOfWeekEnergy" if metric == "energy" else "hourOfWeekWater"
        hour_means = list(profile.get(key) or [])
        index = hour_of_week(target_ts.isoformat())
        overall = mean([safe_num(record.get(metric)) for record in ordered])
        seasonal = hour_means[index] if index is not None and index < len(hour_means) else None
        baseline = safe_num(seasonal) if seasonal is not None else overall
        if is_off_hours(target_ts.isoformat()):
            off_hours_key = "offHoursEnergy" if metric == "energy" else "offHoursWater"
            off_hours_value = safe_num(profile.get(off_hours_key))
            if off_hours_value > 0:
                baseline = (baseline * 0.65) + (off_hours_value * 0.35)
        return max(0.0, baseline)

    def _momentum_baseline(self, ordered, metric, step_index):
        values = [safe_num(record.get(metric)) for record in ordered][-6:]
        return max(0.0, ema(values) + recent_slope(values) * max(1, step_index))

    def _component_weights(self, record_count):
        if not self.state.get("trained"):
            return {"model": 0.0, "seasonal": 0.55, "momentum": 0.45}

        validation = self.state.get("validationMetrics") or {}
        validation_r2 = mean([safe_num((validation.get(target) or {}).get("r2")) for target in ("energy", "water", "score")])
        model_weight = clamp(0.24 + max(0.0, validation_r2) * 0.32 + min(0.16, record_count / 180.0), 0.26, 0.64)
        seasonal_weight = 0.42 if record_count >= 24 else 0.32
        momentum_weight = max(0.12, 1.0 - model_weight - seasonal_weight)
        total = model_weight + seasonal_weight + momentum_weight
        return {
            "model": round(model_weight / total, 3),
            "seasonal": round(seasonal_weight / total, 3),
            "momentum": round(momentum_weight / total, 3),
        }

    def _score_from_usage(self, energy, water, off_hours_ratio):
        score = 100.0 - (safe_num(energy) / 15.0) - (safe_num(water) / 120.0) - (safe_num(off_hours_ratio) * 18.0)
        return clamp(score, 0.0, 100.0)

    def _forecast_drivers(self, ordered, latest_point):
        energy_values = [safe_num(record.get("energy")) for record in ordered]
        water_values = [safe_num(record.get("water")) for record in ordered]
        latest = ordered[-1] if ordered else {}
        drivers = [
            {
                "label": "Energy trend",
                "value": round(trend_delta(energy_values), 2),
                "unit": "%",
                "direction": "up" if trend_delta(energy_values) >= 0 else "down",
            },
            {
                "label": "Water trend",
                "value": round(trend_delta(water_values), 2),
                "unit": "%",
                "direction": "up" if trend_delta(water_values) >= 0 else "down",
            },
            {
                "label": "After-hours share",
                "value": round(
                    (
                        sum(1 for record in ordered if is_off_hours(record.get("timestamp")))
                        / max(1, len(ordered))
                    )
                    * 100.0,
                    2,
                ),
                "unit": "%",
                "direction": "up",
            },
        ]

        battery = safe_num(latest.get("batteryLevel"))
        signal = safe_num(latest.get("signalQuality"))
        if battery > 0:
            drivers.append(
                {
                    "label": "Battery health",
                    "value": round(battery, 1),
                    "unit": "%",
                    "direction": "down" if battery < 30 else "stable",
                }
            )
        if signal > 0:
            drivers.append(
                {
                    "label": "Signal quality",
                    "value": round(signal, 1),
                    "unit": "%",
                    "direction": "down" if signal < 40 else "stable",
                }
            )
        if latest_point:
            drivers.append(
                {
                    "label": "Predicted score",
                    "value": round(safe_num(latest_point.get("predictedScore")), 1),
                    "unit": "%",
                    "direction": "up" if safe_num(latest_point.get("predictedScore")) >= 70 else "down",
                }
            )
        return drivers[:5]

    def forecast(self, records, steps=1):
        ordered = self._ordered(records)
        if not ordered:
            return None

        history = [dict(record) for record in ordered]
        window = history[-self.window_size :] or [dict(history[-1])]
        timestamp = parse_dt(window[-1].get("timestamp") or window[-1].get("createdAt") or window[-1].get("time")) or datetime.now(timezone.utc)
        weights = self._component_weights(len(ordered))
        energy_cap = forecast_cap([record.get("energy") for record in ordered], 50.0)
        water_cap = forecast_cap([record.get("water") for record in ordered], 50.0)
        path = []

        for step_index in range(1, max(1, steps) + 1):
            target_ts = timestamp + timedelta(hours=1)
            model_component = self._predict_window(window) if self.state.get("trained") else self._fallback(window)
            model_energy = clamp(safe_num(model_component.get("energy")), 0.0, energy_cap)
            model_water = clamp(safe_num(model_component.get("water")), 0.0, water_cap)
            seasonal_energy = clamp(self._temporal_baseline(history, "energy", target_ts), 0.0, energy_cap)
            seasonal_water = clamp(self._temporal_baseline(history, "water", target_ts), 0.0, water_cap)
            momentum_energy = clamp(self._momentum_baseline(window, "energy", step_index), 0.0, energy_cap)
            momentum_water = clamp(self._momentum_baseline(window, "water", step_index), 0.0, water_cap)

            predicted_energy = clamp(
                (
                model_energy * weights["model"]
                + seasonal_energy * weights["seasonal"]
                + momentum_energy * weights["momentum"]
                ),
                0.0,
                energy_cap,
            )
            predicted_water = clamp(
                (
                model_water * weights["model"]
                + seasonal_water * weights["seasonal"]
                + momentum_water * weights["momentum"]
                ),
                0.0,
                water_cap,
            )
            off_hours_ratio = sum(1 for record in window if is_off_hours(record.get("timestamp"))) / max(1, len(window))
            predicted_score = self._score_from_usage(predicted_energy, predicted_water, off_hours_ratio)

            energy_spread = max(
                1.0,
                safe_num((self.state.get("residualStd") or {}).get("energy")),
                stddev([model_energy, seasonal_energy, momentum_energy]),
            )
            water_spread = max(
                1.0,
                safe_num((self.state.get("residualStd") or {}).get("water")),
                stddev([model_water, seasonal_water, momentum_water]),
            )
            energy_ci = 1.96 * energy_spread
            water_ci = 1.96 * water_spread

            point = {
                "timestamp": target_ts.isoformat(),
                "predictedEnergy": round(predicted_energy),
                "predictedWater": round(predicted_water),
                "predictedScore": round(predicted_score),
                "energyBand": {
                    "low": max(0, round(predicted_energy - energy_ci)),
                    "high": round(predicted_energy + energy_ci),
                },
                "waterBand": {
                    "low": max(0, round(predicted_water - water_ci)),
                    "high": round(predicted_water + water_ci),
                },
                "components": {
                    "modelEnergy": round(model_energy),
                    "seasonalEnergy": round(seasonal_energy),
                    "momentumEnergy": round(momentum_energy),
                    "modelWater": round(model_water),
                    "seasonalWater": round(seasonal_water),
                    "momentumWater": round(momentum_water),
                },
            }
            path.append(point)

            history.append(
                {
                    "timestamp": target_ts.isoformat(),
                    "energy": predicted_energy,
                    "water": predicted_water,
                    "score": predicted_score,
                    "batteryLevel": window[-1].get("batteryLevel"),
                    "signalQuality": window[-1].get("signalQuality"),
                }
            )
            window.append(history[-1])
            window = window[-self.window_size :]
            timestamp = target_ts

        agreement_penalty = mean(
            [
                stddev(
                    [
                        safe_num(point["components"]["modelEnergy"]),
                        safe_num(point["components"]["seasonalEnergy"]),
                        safe_num(point["components"]["momentumEnergy"]),
                    ]
                )
                / max(1.0, safe_num(point["predictedEnergy"]))
                for point in path
            ]
        )
        confidence = round(clamp(self.status()["fitScore"] - (agreement_penalty * 8.0) + min(8.0, len(ordered) * 0.15), 45, 98))
        return {
            "prediction": path[-1],
            "path": path,
            "confidence": confidence,
            "componentWeights": weights,
            "drivers": self._forecast_drivers(ordered, path[-1]),
            "model": self.status(),
        }

    def anomaly(self, water, energy, history):
        ordered = self._ordered(history)
        if len(ordered) < 4:
            return {
                "anomaly": False,
                "reason": "No anomaly",
                "severity": "low",
                "score": 0,
                "summary": "Not enough telemetry for anomaly scoring",
                "recommendation": "Collect more telemetry before acting",
                "priority": "low",
                "rootCause": "Warmup window",
                "confidence": 54,
                "drivers": [],
            }

        latest = dict(ordered[-1])
        actual_water = safe_num(water if water is not None else latest.get("water"))
        actual_energy = safe_num(energy if energy is not None else latest.get("energy"))
        baseline = self.forecast(ordered[:-1], steps=1) or {}
        predicted = baseline.get("prediction") or {}

        predicted_water = safe_num(predicted.get("predictedWater"))
        predicted_energy = safe_num(predicted.get("predictedEnergy"))
        water_std = max(1.0, safe_num((self.state.get("residualStd") or {}).get("water")))
        energy_std = max(1.0, safe_num((self.state.get("residualStd") or {}).get("energy")))

        residual_water = actual_water - predicted_water
        residual_energy = actual_energy - predicted_energy
        z_water = residual_water / water_std
        z_energy = residual_energy / energy_std
        water_delta_pct = ((actual_water - predicted_water) / predicted_water * 100.0) if predicted_water else 0.0
        energy_delta_pct = ((actual_energy - predicted_energy) / predicted_energy * 100.0) if predicted_energy else 0.0

        drivers = []
        if is_off_hours(latest.get("timestamp")):
            drivers.append("After-hours activity is present in the latest reading.")
        if safe_num(latest.get("batteryLevel")) and safe_num(latest.get("batteryLevel")) < 30:
            drivers.append("Low sensor battery can amplify noisy readings.")
        if safe_num(latest.get("signalQuality")) and safe_num(latest.get("signalQuality")) < 40:
            drivers.append("Weak signal quality suggests unreliable transmission.")
        if abs(energy_delta_pct) >= 12:
            drivers.append(f"Energy is {round(abs(energy_delta_pct), 1)}% away from ensemble baseline.")
        if abs(water_delta_pct) >= 12:
            drivers.append(f"Water is {round(abs(water_delta_pct), 1)}% away from ensemble baseline.")

        if abs(z_water) >= 2.1 and abs(z_water) >= abs(z_energy):
            severity = "critical" if abs(z_water) >= 4.0 else "high" if abs(z_water) >= 3.0 else "medium"
            return {
                "anomaly": True,
                "metric": "water",
                "reason": "Water Spike",
                "severity": severity,
                "score": round(z_water, 2),
                "summary": f"Water usage is {round(abs(water_delta_pct), 1)}% above expected baseline.",
                "recommendation": "Inspect leakage paths, valves, and uncontrolled water draw.",
                "priority": severity,
                "rootCause": "Possible leakage or uncontrolled water draw",
                "confidence": round(clamp(70 + abs(z_water) * 4, 62, 96)),
                "drivers": drivers[:4],
                "baseline": {"predictedWater": round(predicted_water), "predictedEnergy": round(predicted_energy)},
                "actual": {"water": round(actual_water), "energy": round(actual_energy)},
                "recommendedActions": [
                    "Inspect nearby pipelines and restroom fixtures.",
                    "Check if auto-close valves or leak sensors are responsive.",
                    "Compare this spike with the last validated maintenance log.",
                ],
            }

        if abs(z_energy) >= 2.1:
            severity = "critical" if abs(z_energy) >= 4.0 else "high" if abs(z_energy) >= 3.0 else "medium"
            return {
                "anomaly": True,
                "metric": "energy",
                "reason": "Energy Spike",
                "severity": severity,
                "score": round(z_energy, 2),
                "summary": f"Energy usage is {round(abs(energy_delta_pct), 1)}% above expected baseline.",
                "recommendation": "Inspect heavy equipment scheduling and suppress avoidable peak load.",
                "priority": severity,
                "rootCause": "After-hours energy usage" if is_off_hours(latest.get("timestamp")) else "Peak load or equipment cycle drift",
                "confidence": round(clamp(70 + abs(z_energy) * 4, 62, 96)),
                "drivers": drivers[:4],
                "baseline": {"predictedWater": round(predicted_water), "predictedEnergy": round(predicted_energy)},
                "actual": {"water": round(actual_water), "energy": round(actual_energy)},
                "recommendedActions": [
                    "Shift discretionary load to a lower-tariff window.",
                    "Inspect HVAC, pumps, and other high-draw equipment.",
                    "Verify occupancy or schedule overrides before escalating.",
                ],
            }

        return {
            "anomaly": False,
            "reason": "No anomaly",
            "severity": "low",
            "score": 0,
            "summary": "Usage remains within the ensemble baseline.",
            "recommendation": "No immediate action",
            "priority": "low",
            "rootCause": "Stable operating window",
            "confidence": 64,
            "drivers": drivers[:3],
            "baseline": {"predictedWater": round(predicted_water), "predictedEnergy": round(predicted_energy)},
            "actual": {"water": round(actual_water), "energy": round(actual_energy)},
        }

    def _rank_actions(self, ordered, anomaly, breakdown, ranked_buildings, forecast_24h):
        latest = ordered[-1] if ordered else {}
        actions = []

        def add_action(title, impact, reason, rank_score, owner_hint, window):
            actions.append(
                {
                    "title": title,
                    "impact": impact,
                    "reason": reason,
                    "rankScore": round(rank_score, 1),
                    "ownerHint": owner_hint,
                    "window": window,
                }
            )

        if anomaly.get("anomaly"):
            if anomaly.get("metric") == "water":
                add_action(
                    "Contain water spike source",
                    "High",
                    "Ensemble anomaly scoring points to leakage or uncontrolled water draw in the latest window.",
                    96.0,
                    "Maintenance",
                    "30 min",
                )
            if anomaly.get("metric") == "energy":
                add_action(
                    "Suppress peak energy cycle",
                    "High",
                    "Energy demand is materially above forecast, so high-draw equipment or schedules should be checked first.",
                    95.0,
                    "Facilities",
                    "30 min",
                )

        if breakdown["offHoursRatio"] >= 20:
            add_action(
                "Tighten after-hours scheduling",
                "High" if breakdown["offHoursRatio"] >= 35 else "Medium",
                f"Off-hours usage is {breakdown['offHoursRatio']}%, which is high for this telemetry window.",
                88.0 if breakdown["offHoursRatio"] >= 35 else 76.0,
                "Operations",
                "Today",
            )

        if abs(breakdown["energyTrend"]) >= 10 or abs(breakdown["waterTrend"]) >= 10:
            add_action(
                "Review directional usage drift",
                "Medium",
                "Recent telemetry shows directional drift, so thresholds and equipment schedules should be recalibrated.",
                73.0,
                "Analytics",
                "Today",
            )

        if safe_num(latest.get("batteryLevel")) and safe_num(latest.get("batteryLevel")) < 30:
            add_action(
                "Service weak sensor battery",
                "Medium",
                "Low battery can reduce confidence and create unreliable telemetry during live operations.",
                68.0,
                "IoT",
                "24 hr",
            )

        if safe_num(latest.get("signalQuality")) and safe_num(latest.get("signalQuality")) < 40:
            add_action(
                "Stabilize sensor connectivity",
                "Medium",
                "Weak signal quality suggests patchy transmission, which can distort model confidence and anomaly trust.",
                66.0,
                "IoT",
                "24 hr",
            )

        if ranked_buildings:
            hotspot = ranked_buildings[0]
            if hotspot.get("efficiency", 100) < 60:
                add_action(
                    f"Audit {hotspot.get('building', 'top hotspot')}",
                    "Medium",
                    f"{hotspot.get('building', 'This building')} is carrying the heaviest combined load and should be inspected first.",
                    64.0,
                    "Facilities",
                    "This week",
                )

        forecast_point = (forecast_24h or {}).get("prediction") or {}
        if safe_num(forecast_point.get("predictedEnergy")) > mean([safe_num(record.get("energy")) for record in ordered]) * 1.1:
            add_action(
                "Pre-stage load balancing",
                "Medium",
                "The 24-hour forecast still trends high, so load balancing should happen before the next peak window.",
                62.0,
                "Operations",
                "Next shift",
            )

        deduped = []
        seen = set()
        for action in sorted(actions, key=lambda item: item["rankScore"], reverse=True):
            key = action["title"].strip().lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(action)
        return deduped[:5]

    def simulate(self, records, energy_reduction_pct=10, water_reduction_pct=10, horizon_days=30):
        ordered = self._ordered(records)
        if not ordered:
            return {
                "energyReductionPct": energy_reduction_pct,
                "waterReductionPct": water_reduction_pct,
                "horizonDays": horizon_days,
                "projectedSavings": 0,
                "projectedCarbonReduction": 0,
                "projectedScore": 0,
                "riskImprovement": "No data",
                "recommendations": ["Collect telemetry first"],
            }

        horizon_hours = min(max(24, horizon_days * 24), 24 * 7)
        forecast = self.forecast(ordered, steps=horizon_hours) or {}
        path = forecast.get("path") or []
        daily_energy = sum(safe_num(point.get("predictedEnergy")) for point in path[:24]) or mean(
            [safe_num(record.get("energy")) for record in ordered]
        )
        daily_water = sum(safe_num(point.get("predictedWater")) for point in path[:24]) or mean(
            [safe_num(record.get("water")) for record in ordered]
        )

        energy_saved = daily_energy * horizon_days * (safe_num(energy_reduction_pct) / 100.0)
        water_saved = daily_water * horizon_days * (safe_num(water_reduction_pct) / 100.0)
        projected_savings = round((energy_saved * 8.0) + (water_saved * 0.02))
        projected_carbon = round(energy_saved * 0.82)
        base_score = mean([safe_num(point.get("predictedScore")) for point in path[:24]]) or self._heuristic_score(ordered)
        projected_score = clamp(round(base_score + energy_reduction_pct * 0.7 + water_reduction_pct * 0.55), 0, 100)

        if projected_score >= 80:
            risk = "Low"
        elif projected_score >= 60:
            risk = "Moderate"
        elif projected_score >= 40:
            risk = "High"
        else:
            risk = "Critical"

        return {
            "energyReductionPct": energy_reduction_pct,
            "waterReductionPct": water_reduction_pct,
            "horizonDays": horizon_days,
            "projectedSavings": projected_savings,
            "projectedCarbonReduction": projected_carbon,
            "projectedScore": projected_score,
            "riskImprovement": risk,
            "projectedOperationalLoad": {
                "dailyEnergy": round(daily_energy),
                "dailyWater": round(daily_water),
            },
            "assumptions": [
                "Forecast baseline uses the current hybrid ensemble path.",
                "Reductions are applied evenly across the planning horizon.",
                "Tariff and carbon factors are held constant for simulation.",
            ],
            "recommendations": [
                "Shift high-load devices off-peak",
                "Repair leaks and auto-close valves",
                "Stabilize sensor health before scaling automation",
            ],
            "model": self.status(),
        }

    def build_insights(self, records):
        ordered = self._ordered(records)
        status = self.status()
        if not ordered:
            return {
                "model": status,
                "mlStatus": status,
                "score": 0,
                "riskLevel": "No Data",
                "summary": "No telemetry available",
                "confidence": 0,
                "rootCause": "No telemetry",
                "confidenceReasons": ["Start collecting telemetry"],
                "recommendations": ["Start collecting telemetry"],
                "rankedActions": [],
                "hotspots": [],
                "forecast": None,
                "anomalies": [],
                "whatIf": None,
                "training": {
                    "samples": 0,
                    "featureCount": len(self.feature_names),
                    "lastTrainedAt": self.state.get("lastTrainedAt"),
                },
                "modelOps": {
                    "ensembleMode": "hybrid-linear-seasonal-momentum",
                    "avgGapHours": 1.0,
                    "history": [],
                },
            }

        self.train(ordered)
        status = self.status()
        latest = ordered[-1]
        forecast_1h = self.forecast(ordered, steps=1) or {}
        forecast_24h = self.forecast(ordered, steps=24) or {}
        anomaly = self.anomaly(latest.get("water"), latest.get("energy"), ordered)

        energy_values = [safe_num(record.get("energy")) for record in ordered]
        water_values = [safe_num(record.get("water")) for record in ordered]
        latest_energy = safe_num(latest.get("energy"))
        latest_water = safe_num(latest.get("water"))
        breakdown = {
            "energyTrend": round(trend_delta(energy_values), 2),
            "waterTrend": round(trend_delta(water_values), 2),
            "volatility": round(stddev(energy_values + water_values), 2),
            "offHoursRatio": round((sum(1 for record in ordered if is_off_hours(record.get("timestamp"))) / max(1, len(ordered))) * 100.0, 2),
            "usageConsistency": round(
                max(
                    0.0,
                    100.0
                    - min(
                        70.0,
                        abs(trend_delta(energy_values)) * 0.35
                        + abs(trend_delta(water_values)) * 0.35
                        + stddev(energy_values + water_values) * 0.2,
                    ),
                ),
                2,
            ),
        }

        stats = {
            "energy": {"mean": mean(energy_values), "std": stddev(energy_values)},
            "water": {"mean": mean(water_values), "std": stddev(water_values)},
        }

        root_cause = "Stable operating window"
        if anomaly.get("anomaly"):
            root_cause = anomaly.get("rootCause") or root_cause
        elif latest_water > stats["water"]["mean"] * 1.2 and latest_energy <= stats["energy"]["mean"] * 1.1:
            root_cause = "Possible leakage or valve drift"
        elif latest_energy > stats["energy"]["mean"] * 1.2 and latest_water > stats["water"]["mean"] * 1.15:
            root_cause = "Occupancy surge or parallel load spike"
        elif abs(breakdown["energyTrend"]) > 12 or abs(breakdown["waterTrend"]) > 12:
            root_cause = "Directional drift across recent usage window"

        by_building = {}
        for record in ordered:
            building = record.get("building") or "Unknown"
            item = by_building.setdefault(building, {"building": building, "energy": 0.0, "water": 0.0, "count": 0, "locations": set()})
            item["energy"] += safe_num(record.get("energy"))
            item["water"] += safe_num(record.get("water"))
            item["count"] += 1
            if record.get("location"):
                item["locations"].add(record.get("location"))

        ranked = []
        for item in by_building.values():
            total_load = item["energy"] + item["water"]
            ranked.append(
                {
                    "building": item["building"],
                    "energy": round(item["energy"]),
                    "water": round(item["water"]),
                    "count": item["count"],
                    "locations": sorted(list(item["locations"])),
                    "totalLoad": round(total_load),
                }
            )
        ranked.sort(key=lambda item: item["totalLoad"], reverse=True)
        max_load = ranked[0]["totalLoad"] if ranked else 1
        for item in ranked:
            item["efficiency"] = max(15, round(100 - (item["totalLoad"] / max_load) * 70))

        heuristic_score = self._heuristic_score(ordered)
        model_score = safe_num((forecast_1h.get("prediction") or {}).get("predictedScore"))
        anomaly_penalty = 18 if anomaly.get("severity") == "critical" else 12 if anomaly.get("anomaly") else 0
        score = clamp(round((heuristic_score * 0.4) + (model_score * 0.6) - anomaly_penalty), 0, 100)
        risk = "Low"
        if score < 80:
            risk = "Moderate"
        if score < 60:
            risk = "High"
        if score < 40:
            risk = "Critical"

        ranked_actions = self._rank_actions(ordered, anomaly, breakdown, ranked, forecast_24h)
        recommendations = [f"{action['title']}: {action['reason']}" for action in ranked_actions[:4]]
        if not recommendations:
            recommendations = ["Maintain current operations and continue monitoring telemetry."]

        temporal = self.state.get("temporalProfile") or {}
        confidence = round(clamp(status.get("fitScore", 55) + min(14.0, len(ordered) * 0.18), 50, 97))
        training = {
            "samples": status.get("trainedSamples", 0),
            "featureCount": status.get("featureCount", len(self.feature_names)),
            "lastTrainedAt": self.state.get("lastTrainedAt"),
            "metrics": status.get("metrics", {}),
            "validationMetrics": status.get("validationMetrics", {}),
            "featureImportance": self.state.get("featureImportance", {}),
            "history": list(self.state.get("trainingHistory") or [])[-5:],
        }

        return {
            "model": status,
            "mlStatus": status,
            "score": score,
            "riskLevel": risk,
            "statusLabel": f"{risk} risk with {1 if anomaly.get('anomaly') else 0} active anomaly signals",
            "summary": f"{risk} risk over the current telemetry window. Model confidence is {confidence}% and the strongest signal is {root_cause.lower()}.",
            "confidence": confidence,
            "rootCause": root_cause,
            "signalBreakdown": breakdown,
            "confidenceReasons": [
                f"Telemetry count: {len(ordered)}",
                f"Energy volatility: {round(stats['energy']['std'], 2)}",
                f"Water volatility: {round(stats['water']['std'], 2)}",
                f"Off-hours usage: {breakdown['offHoursRatio']}%",
                f"Validation R2: {round(self._average_r2(self.state.get('validationMetrics') or {}), 3)}",
            ],
            "anomalies": [anomaly] if anomaly.get("anomaly") else [],
            "forecast": {
                "predictedEnergyAvg": round(mean(energy_values)),
                "predictedWaterAvg": round(mean(water_values)),
                "predictedEnergyNextHour": round(safe_num((forecast_1h.get("prediction") or {}).get("predictedEnergy"))),
                "predictedWaterNextHour": round(safe_num((forecast_1h.get("prediction") or {}).get("predictedWater"))),
                "predictedEnergyNextDay": round(safe_num((forecast_24h.get("prediction") or {}).get("predictedEnergy"))),
                "predictedWaterNextDay": round(safe_num((forecast_24h.get("prediction") or {}).get("predictedWater"))),
                "confidence": forecast_1h.get("confidence", confidence),
                "path": forecast_24h.get("path") or [],
                "drivers": forecast_24h.get("drivers") or [],
                "componentWeights": forecast_24h.get("componentWeights") or {},
                "model": status,
            },
            "hotspots": ranked[:5],
            "recommendations": recommendations,
            "rankedActions": ranked_actions,
            "nextBestAction": ranked_actions[0]["title"] if ranked_actions else recommendations[0],
            "latest": {
                "building": latest.get("building") or "Unknown",
                "location": latest.get("location") or "",
                "energy": latest_energy,
                "water": latest_water,
                "sensorId": latest.get("sensorId") or "",
                "batteryLevel": safe_num(latest.get("batteryLevel")),
                "signalQuality": safe_num(latest.get("signalQuality")),
            },
            "whatIf": self.simulate(ordered, 12, 10, 30),
            "training": training,
            "modelOps": {
                "ensembleMode": status.get("ensembleMode"),
                "avgGapHours": round(safe_num(temporal.get("avgGapHours")) or 1.0, 2),
                "offHoursEnergy": round(safe_num(temporal.get("offHoursEnergy"))),
                "offHoursWater": round(safe_num(temporal.get("offHoursWater"))),
                "history": list(self.state.get("trainingHistory") or [])[-5:],
                "topFeatures": status.get("topFeatures"),
            },
        }
