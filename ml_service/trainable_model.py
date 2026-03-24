from __future__ import annotations

import json
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path


def safe_num(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else 0.0
    except Exception:
        return 0.0


def mean(values):
    values = [safe_num(v) for v in values]
    return sum(values) / len(values) if values else 0.0


def stddev(values):
    values = [safe_num(v) for v in values]
    if not values:
        return 0.0
    m = mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / len(values))


def clamp(value, low, high):
    return max(low, min(high, value))


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def is_off_hours(ts):
    dt = parse_dt(ts)
    if dt is None:
        return False
    return dt.weekday() >= 5 or dt.hour < 7 or dt.hour >= 20


def trend_delta(values):
    values = [safe_num(v) for v in values]
    if len(values) < 2:
        return 0.0
    midpoint = max(1, len(values) // 2)
    first = mean(values[:midpoint])
    last = mean(values[midpoint:])
    if first == 0:
        return 0.0
    return ((last - first) / first) * 100.0


def top_location(records, metric):
    totals = {}
    for record in records or []:
        location = (record.get("location") or "Unknown").strip() or "Unknown"
        totals[location] = totals.get(location, 0.0) + safe_num(record.get(metric))
    if not totals:
        return {"location": "Unknown", "value": 0}
    location, value = max(totals.items(), key=lambda item: item[1])
    return {"location": location, "value": round(value)}


class SustainOSLinearModel:
    def __init__(self, state_path, model_name, model_version):
        self.path = Path(state_path)
        self.model_name = model_name
        self.model_version = model_version
        self.window_size = 6
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
        ]
        self.state = self._default_state()
        self.load()

    def _default_state(self):
        return {
            "trained": False,
            "trainedSamples": 0,
            "featureMeans": [0.0] * len(self.feature_names),
            "featureStds": [1.0] * len(self.feature_names),
            "weights": {"energy": [0.0] * len(self.feature_names), "water": [0.0] * len(self.feature_names), "score": [0.0] * len(self.feature_names)},
            "biases": {"energy": 0.0, "water": 0.0, "score": 0.0},
            "metrics": {"energy": {}, "water": {}, "score": {}},
            "residualStd": {"energy": 1.0, "water": 1.0, "score": 1.0},
            "lastTrainedAt": None,
        }

    def load(self):
        if self.path.exists():
            try:
                with self.path.open("r", encoding="utf-8") as handle:
                    state = json.load(handle)
                if isinstance(state, dict):
                    self.state.update(state)
            except Exception:
                self.state = self._default_state()
        return self.state

    def save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("w", encoding="utf-8") as handle:
                json.dump(self.state, handle, indent=2)
        except Exception:
            pass

    def status(self):
        metrics = self.state.get("metrics", {})
        r2 = mean([safe_num(metrics.get(k, {}).get("r2")) for k in ("energy", "water", "score")])
        return {
            "name": self.model_name,
            "version": self.model_version,
            "type": "pure-python-trained-linear",
            "active": bool(self.state.get("trained")),
            "label": "Python ML Active" if self.state.get("trained") else "Python ML Warmup",
            "source": "python-ml",
            "trainedSamples": int(self.state.get("trainedSamples") or 0),
            "featureCount": len(self.feature_names),
            "lastTrainedAt": self.state.get("lastTrainedAt"),
            "metrics": metrics,
            "fitScore": round(clamp(55 + (max(0.0, r2) * 35) + min(10, self.state.get("trainedSamples", 0) * 0.7), 0, 100)),
        }

    def _ordered(self, records):
        ordered = [dict(r) for r in (records or []) if isinstance(r, dict)]
        ordered.sort(key=lambda item: parse_dt(item.get("timestamp") or item.get("createdAt") or item.get("time")) or datetime.fromtimestamp(0, tz=timezone.utc))
        return ordered

    def _heuristic_score(self, records):
        ordered = self._ordered(records)
        if not ordered:
            return 0.0
        energy = [safe_num(r.get("energy")) for r in ordered]
        water = [safe_num(r.get("water")) for r in ordered]
        score = 100.0 - (mean(energy) / 15.0) - (mean(water) / 120.0) - (abs(trend_delta(energy)) + abs(trend_delta(water))) / 6.0
        score -= stddev(energy + water) / 10.0
        score -= sum(1 for r in ordered if is_off_hours(r.get("timestamp"))) * 0.45
        return clamp(score, 0, 100)

    def _features(self, window):
        ordered = self._ordered(window)
        latest = ordered[-1]
        prev = ordered[-2] if len(ordered) > 1 else latest
        energy = [safe_num(r.get("energy")) for r in ordered]
        water = [safe_num(r.get("water")) for r in ordered]
        last3 = ordered[-3:]
        last5 = ordered[-5:]
        ts = parse_dt(latest.get("timestamp") or latest.get("createdAt") or latest.get("time")) or datetime.now(timezone.utc)
        prev_ts = parse_dt(prev.get("timestamp") or prev.get("createdAt") or prev.get("time")) or ts
        gap_hours = max(0.0, (ts - prev_ts).total_seconds() / 3600.0)
        battery = safe_num(latest.get("batteryLevel")) / 100.0
        signal = safe_num(latest.get("signalQuality")) / 100.0
        return [
            1.0,
            safe_num(latest.get("energy")),
            safe_num(latest.get("water")),
            safe_num(latest.get("energy")) - safe_num(prev.get("energy")),
            safe_num(latest.get("water")) - safe_num(prev.get("water")),
            mean([safe_num(r.get("energy")) for r in last3]),
            mean([safe_num(r.get("water")) for r in last3]),
            stddev([safe_num(r.get("energy")) for r in last5]),
            stddev([safe_num(r.get("water")) for r in last5]),
            trend_delta(energy),
            trend_delta(water),
            (sum(1 for r in ordered if is_off_hours(r.get("timestamp"))) / len(ordered)) if ordered else 0.0,
            math.sin(2 * math.pi * ts.hour / 24.0),
            math.cos(2 * math.pi * ts.hour / 24.0),
            math.sin(2 * math.pi * ts.weekday() / 7.0),
            math.cos(2 * math.pi * ts.weekday() / 7.0),
            math.log1p(len(ordered)),
        ]

    def _samples(self, ordered):
        samples = []
        if len(ordered) < 3:
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

    def _standardize(self, matrix):
        columns = list(zip(*matrix))
        means = [mean(col) for col in columns]
        stds = [stddev(col) or 1.0 for col in columns]
        scaled = [[(value - m) / s for value, m, s in zip(row, means, stds)] for row in matrix]
        return scaled, means, stds

    def _fit(self, X, y, epochs=320, lr=0.03, reg=0.0008):
        if not X:
            return [0.0] * len(self.feature_names), 0.0, {"mse": 0.0, "mae": 0.0, "rmse": 0.0, "r2": 0.0, "residualStd": 1.0}
        weights = [0.0] * len(X[0])
        bias = mean(y)
        for epoch in range(epochs):
            rate = lr / (1 + epoch * 0.02)
            for row, target in zip(X, y):
                pred = bias + sum(w * x for w, x in zip(weights, row))
                err = pred - target
                bias -= rate * 2 * err
                for idx in range(len(weights)):
                    weights[idx] -= rate * (2 * err * row[idx] + reg * weights[idx])
        preds = [bias + sum(w * x for w, x in zip(weights, row)) for row in X]
        residuals = [t - p for t, p in zip(y, preds)]
        mse = mean([r * r for r in residuals])
        mae = mean([abs(r) for r in residuals])
        rmse = math.sqrt(mse) if mse >= 0 else 0.0
        target_mean = mean(y)
        ss_tot = sum((target - target_mean) ** 2 for target in y)
        ss_res = sum((target - pred) ** 2 for target, pred in zip(y, preds))
        r2 = 1.0 - (ss_res / ss_tot) if ss_tot else 0.0
        return weights, bias, {
            "mse": round(mse, 3),
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "r2": round(r2, 3),
            "residualStd": round(stddev(residuals) or max(1.0, rmse), 3),
        }

    def train(self, records):
        ordered = self._ordered(records)
        samples = self._samples(ordered)
        if len(samples) < 3:
            self.state = self._default_state()
            self.state["trainedSamples"] = len(samples)
            self.save()
            return self.status()

        X = [s["x"] for s in samples]
        energy_y = [s["energy"] for s in samples]
        water_y = [s["water"] for s in samples]
        score_y = [s["score"] for s in samples]
        scaled, means, stds = self._standardize(X)

        e_w, e_b, e_m = self._fit(scaled, energy_y)
        w_w, w_b, w_m = self._fit(scaled, water_y)
        s_w, s_b, s_m = self._fit(scaled, score_y)

        self.state.update(
            {
                "trained": True,
                "trainedSamples": len(samples),
                "featureMeans": means,
                "featureStds": stds,
                "weights": {"energy": e_w, "water": w_w, "score": s_w},
                "biases": {"energy": e_b, "water": w_b, "score": s_b},
                "metrics": {"energy": e_m, "water": w_m, "score": s_m},
                "residualStd": {"energy": max(1.0, e_m["residualStd"]), "water": max(1.0, w_m["residualStd"]), "score": max(1.0, s_m["residualStd"])},
                "lastTrainedAt": datetime.now(timezone.utc).isoformat(),
            }
        )
        self.save()
        return self.status()

    def _scaled(self, features):
        means = self.state.get("featureMeans") or [0.0] * len(self.feature_names)
        stds = self.state.get("featureStds") or [1.0] * len(self.feature_names)
        return [(value - mean_value) / (std_value or 1.0) for value, mean_value, std_value in zip(features, means, stds)]

    def _predict_window(self, window):
        scaled = self._scaled(self._features(window))
        out = {}
        for target in ("energy", "water", "score"):
            weights = self.state.get("weights", {}).get(target) or [0.0] * len(self.feature_names)
            bias = safe_num(self.state.get("biases", {}).get(target))
            value = bias + sum(w * x for w, x in zip(weights, scaled))
            out[target] = clamp(value, 0, 100) if target == "score" else max(0.0, value)
        return out

    def _fallback(self, ordered):
        energy = [safe_num(r.get("energy")) for r in ordered]
        water = [safe_num(r.get("water")) for r in ordered]
        if len(ordered) >= 2:
            last, prev = ordered[-1], ordered[-2]
            e_delta = safe_num(last.get("energy")) - safe_num(prev.get("energy"))
            w_delta = safe_num(last.get("water")) - safe_num(prev.get("water"))
        else:
            e_delta = w_delta = 0.0
        return {
            "energy": max(0.0, mean(energy) + e_delta * 0.75),
            "water": max(0.0, mean(water) + w_delta * 0.75),
            "score": clamp(100.0 - (mean(energy) / 15.0) - (mean(water) / 120.0), 0, 100),
        }

    def forecast(self, records, steps=1):
        ordered = self._ordered(records)
        if not ordered:
            return None
        if not self.state.get("trained") or self.state.get("trainedSamples", 0) < 3:
            base = self._fallback(ordered)
            return {"prediction": {"predictedEnergy": round(base["energy"]), "predictedWater": round(base["water"]), "predictedScore": round(base["score"])}, "path": [base], "confidence": 52, "model": self.status()}

        window = [dict(r) for r in ordered[-self.window_size :]]
        if not window:
            window = [dict(ordered[-1])]
        ts = parse_dt(window[-1].get("timestamp") or window[-1].get("createdAt") or window[-1].get("time")) or datetime.now(timezone.utc)
        path = []
        for _ in range(max(1, steps)):
            pred = self._predict_window(window)
            ts = ts + timedelta(hours=1)
            path.append({"predictedEnergy": round(pred["energy"]), "predictedWater": round(pred["water"]), "predictedScore": round(pred["score"]), "timestamp": ts.isoformat()})
            window.append({"timestamp": ts.isoformat(), "energy": pred["energy"], "water": pred["water"], "score": pred["score"]})
            window = window[-self.window_size :]
        confidence = self.status()["fitScore"]
        return {"prediction": path[-1], "path": path, "confidence": confidence, "model": self.status()}

    def anomaly(self, water, energy, history):
        ordered = self._ordered(history)
        if len(ordered) < 3:
            return {"anomaly": False, "reason": "No anomaly", "severity": "low", "score": 0, "summary": "Normal", "recommendation": "No action", "priority": "low", "rootCause": "Stable operating window", "confidence": 62}
        baseline = self.forecast(ordered[:-1], steps=1) or {}
        predicted = baseline.get("prediction") or {}
        latest = ordered[-1]
        actual_water = safe_num(water if water is not None else latest.get("water"))
        actual_energy = safe_num(energy if energy is not None else latest.get("energy"))
        residual_water = actual_water - safe_num(predicted.get("predictedWater"))
        residual_energy = actual_energy - safe_num(predicted.get("predictedEnergy"))
        water_std = max(1.0, safe_num(self.state.get("residualStd", {}).get("water")))
        energy_std = max(1.0, safe_num(self.state.get("residualStd", {}).get("energy")))
        z_water = residual_water / water_std
        z_energy = residual_energy / energy_std
        if abs(z_water) >= 2.1 and abs(z_water) >= abs(z_energy):
            severity = "high" if abs(z_water) >= 3.0 else "medium"
            return {"anomaly": True, "metric": "water", "reason": "Water Spike", "severity": severity, "score": round(z_water, 2), "summary": "Water usage spike", "recommendation": "Inspect leakage", "priority": severity, "rootCause": "Possible leakage or uncontrolled water draw", "confidence": 80 if severity == "high" else 68}
        if abs(z_energy) >= 2.1:
            severity = "high" if abs(z_energy) >= 3.0 else "medium"
            return {"anomaly": True, "metric": "energy", "reason": "Energy Spike", "severity": severity, "score": round(z_energy, 2), "summary": "Energy usage spike", "recommendation": "Reduce heavy load", "priority": severity, "rootCause": "After-hours energy usage" if is_off_hours(latest.get("timestamp")) else "Peak load or equipment cycle drift", "confidence": 80 if severity == "high" else 68}
        return {"anomaly": False, "reason": "No anomaly", "severity": "low", "score": 0, "summary": "Normal", "recommendation": "No action", "priority": "low", "rootCause": "Stable operating window", "confidence": 62}

    def simulate(self, records, energy_reduction_pct=10, water_reduction_pct=10, horizon_days=30):
        ordered = self._ordered(records)
        if not ordered:
            return {"energyReductionPct": energy_reduction_pct, "waterReductionPct": water_reduction_pct, "horizonDays": horizon_days, "projectedSavings": 0, "projectedCarbonReduction": 0, "projectedScore": 0, "riskImprovement": "No data", "recommendations": ["Collect telemetry first"]}
        forecast = self.forecast(ordered, steps=1) or {}
        prediction = forecast.get("prediction") or {}
        energy = safe_num(prediction.get("predictedEnergy"))
        water = safe_num(prediction.get("predictedWater"))
        base_score = safe_num(prediction.get("predictedScore")) or self._heuristic_score(ordered)
        energy_saved = energy * horizon_days * (safe_num(energy_reduction_pct) / 100.0)
        water_saved = water * horizon_days * (safe_num(water_reduction_pct) / 100.0)
        projected_savings = round((energy_saved * 8.0) + (water_saved * 0.02))
        projected_carbon = round(energy_saved * 0.82)
        projected_score = clamp(round(base_score + (energy_reduction_pct * 0.8) + (water_reduction_pct * 0.6)), 0, 100)
        if projected_score >= 80:
            risk = "Low"
        elif projected_score >= 60:
            risk = "Moderate"
        elif projected_score >= 40:
            risk = "High"
        else:
            risk = "Critical"
        return {"energyReductionPct": energy_reduction_pct, "waterReductionPct": water_reduction_pct, "horizonDays": horizon_days, "projectedSavings": projected_savings, "projectedCarbonReduction": projected_carbon, "projectedScore": projected_score, "riskImprovement": risk, "recommendations": ["Shift high-load devices off-peak", "Repair leaks and auto-close valves", "Track sensor health before scaling automation"], "model": self.status()}

    def build_insights(self, records):
        ordered = self._ordered(records)
        status = self.status()
        if not ordered:
            return {"model": status, "mlStatus": status, "score": 0, "riskLevel": "No Data", "summary": "No telemetry available", "confidence": 0, "rootCause": "No telemetry", "confidenceReasons": ["Start collecting telemetry"], "recommendations": ["Start collecting telemetry"], "hotspots": [], "forecast": None, "anomalies": [], "whatIf": None, "training": {"samples": 0, "featureCount": len(self.feature_names), "lastTrainedAt": self.state.get("lastTrainedAt")}}

        self.train(ordered)
        latest = ordered[-1]
        forecast_1h = self.forecast(ordered, steps=1) or {}
        forecast_24h = self.forecast(ordered, steps=24) or {}
        anomaly = self.anomaly(latest.get("water"), latest.get("energy"), ordered)
        energy_vals = [safe_num(r.get("energy")) for r in ordered]
        water_vals = [safe_num(r.get("water")) for r in ordered]
        latest_energy = safe_num(latest.get("energy"))
        latest_water = safe_num(latest.get("water"))
        breakdown = {
            "energyTrend": round(trend_delta(energy_vals), 2),
            "waterTrend": round(trend_delta(water_vals), 2),
            "volatility": round(stddev(energy_vals + water_vals), 2),
            "offHoursRatio": round((sum(1 for r in ordered if is_off_hours(r.get("timestamp"))) / len(ordered)) * 100.0, 2) if ordered else 0.0,
            "usageConsistency": round(max(0.0, 100.0 - min(70.0, abs(trend_delta(energy_vals)) * 0.35 + abs(trend_delta(water_vals)) * 0.35 + stddev(energy_vals + water_vals) * 0.2)), 2),
        }
        stats = {"energy": {"mean": mean(energy_vals), "std": stddev(energy_vals)}, "water": {"mean": mean(water_vals), "std": stddev(water_vals)}}
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
            ranked.append({"building": item["building"], "energy": round(item["energy"]), "water": round(item["water"]), "count": item["count"], "locations": sorted(list(item["locations"])), "totalLoad": round(total_load)})
        ranked.sort(key=lambda x: x["totalLoad"], reverse=True)
        max_load = ranked[0]["totalLoad"] if ranked else 1
        for item in ranked:
            item["efficiency"] = max(15, round(100 - (item["totalLoad"] / max_load) * 70))

        heuristic_score = self._heuristic_score(ordered)
        model_score = safe_num(forecast_1h.get("prediction", {}).get("predictedScore"))
        score = clamp(round((heuristic_score * 0.45) + (model_score * 0.55) - (12 if anomaly.get("anomaly") else 0)), 0, 100)
        risk = "Low"
        if score < 80:
            risk = "Moderate"
        if score < 60:
            risk = "High"
        if score < 40:
            risk = "Critical"

        recommendations = []
        if anomaly.get("anomaly"):
            recommendations.append("Investigate latest spike source")
        if latest_energy > mean(energy_vals) * 1.15:
            recommendations.append("Shift peak energy loads off-peak")
        if latest_water > mean(water_vals) * 1.15:
            recommendations.append("Inspect water lines for leakage")
        if not recommendations:
            recommendations.append("Maintain current operations and monitor trends")

        confidence = clamp(status.get("fitScore", 55) + min(18, len(ordered) * 1.5), 50, 97)
        training = {"samples": status.get("trainedSamples", 0), "featureCount": status.get("featureCount", len(self.feature_names)), "lastTrainedAt": self.state.get("lastTrainedAt"), "metrics": status.get("metrics", {})}
        return {
            "model": status,
            "mlStatus": status,
            "score": score,
            "riskLevel": risk,
            "statusLabel": f"{risk} risk with {1 if anomaly.get('anomaly') else 0} active anomaly signals",
            "summary": f"{risk} risk with {1 if anomaly.get('anomaly') else 0} active anomaly signals",
            "confidence": confidence,
            "rootCause": root_cause,
            "signalBreakdown": breakdown,
            "confidenceReasons": [
                f"Telemetry count: {len(ordered)}",
                f"Energy volatility: {round(stats['energy']['std'], 2)}",
                f"Water volatility: {round(stats['water']['std'], 2)}",
                f"Off-hours usage: {breakdown['offHoursRatio']}%",
                f"Model samples: {status.get('trainedSamples', 0)}",
            ],
            "anomalies": [anomaly] if anomaly.get("anomaly") else [],
            "forecast": {
                "predictedEnergyAvg": round(safe_num(forecast_1h.get("prediction", {}).get("predictedEnergy"))),
                "predictedWaterAvg": round(safe_num(forecast_1h.get("prediction", {}).get("predictedWater"))),
                "predictedEnergyNextHour": round(safe_num(forecast_1h.get("prediction", {}).get("predictedEnergy"))),
                "predictedWaterNextHour": round(safe_num(forecast_1h.get("prediction", {}).get("predictedWater"))),
                "predictedEnergyNextDay": round(safe_num(forecast_24h.get("prediction", {}).get("predictedEnergy"))),
                "predictedWaterNextDay": round(safe_num(forecast_24h.get("prediction", {}).get("predictedWater"))),
                "confidence": forecast_1h.get("confidence", confidence),
                "model": status,
            },
            "hotspots": ranked[:5],
            "recommendations": recommendations[:4],
            "latest": {"building": latest.get("building") or "Unknown", "location": latest.get("location") or "", "energy": latest_energy, "water": latest_water, "sensorId": latest.get("sensorId") or ""},
            "whatIf": self.simulate(ordered, 10, 10, 30),
            "training": training,
        }

