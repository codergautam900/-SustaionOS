import React, { useEffect, useState, useContext } from "react";
import Card from "../ui/Card";
import { Cpu, Gauge, Droplets, Sparkles, Zap } from "lucide-react";
import { ThemeContext } from "../../context/ThemeContext";
import { getAuthToken } from "../../utils/auth";
import { fetchJson } from "../../utils/api";

const PredictionCard = () => {
  const { darkMode } = useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [pred, setPred] = useState(null);
  const [err, setErr] = useState(null);
  const [emptyState, setEmptyState] = useState("");

  useEffect(() => {
    const fetchPred = async () => {
      setErr(null);
      setEmptyState("");
      try {
        const token = getAuthToken();
        if (!token) {
          setErr("Unauthorized");
          setLoading(false);
          return;
        }

        const res = await fetchJson("/api/ai/forecast", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }, 12000);

        if (!res.ok) {
          const body = res.data || {};
          setErr(body.msg || body.error || "Failed to fetch predictions");
          setLoading(false);
          return;
        }

        const data = res.data || {};
        if (!data.prediction) {
          setPred(null);
          setEmptyState(data.msg || "No telemetry data available yet for ML forecast. Add a few readings first.");
          return;
        }

        setPred(data.prediction || null);
      } catch (e) {
        console.error("Prediction fetch error", e);
        setErr("Prediction error");
      } finally {
        setLoading(false);
      }
    };

    fetchPred();
  }, []);

  return (
    <Card className={`p-6 ${darkMode ? "bg-gray-900 text-white" : "bg-white text-black"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Gauge size={18} className="text-primary" />
          Quick Forecast
        </h3>
        {pred?.model?.name ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300">
            <Cpu size={12} />
            {pred.model.name}
          </span>
        ) : null}
      </div>

      {loading && <div className="text-sm opacity-70">Loading predictions...</div>}
      {err && <div className="text-sm text-red-500">{err}</div>}
      {emptyState && !loading && !err && (
        <div className="rounded-xl border border-dashed border-gray-200/70 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {emptyState}
        </div>
      )}
      {pred && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200/70 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/40 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-500" />
              <span>Next hour</span>
              <strong>{pred.predictedEnergyNextHour}</strong>
              <span>kWh</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets size={14} className="text-sky-500" />
              <span>{pred.predictedWaterNextHour}</span>
              <span>L water</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-500" />
              <span>Next day</span>
              <strong>{pred.predictedEnergyNextDay}</strong>
              <span>kWh</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets size={14} className="text-sky-500" />
              <span>{pred.predictedWaterNextDay}</span>
              <span>L water</span>
            </div>
          </div>
          {(pred.predictedEnergyCI95 || pred.predictedWaterCI95) && (
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200/70 p-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300 md:grid-cols-2">
              <div>
                <div className="font-semibold text-gray-800 dark:text-gray-100">Next hour energy band</div>
                <div>
                  {pred.predictedEnergyCI95?.low ?? "N/A"} to {pred.predictedEnergyCI95?.high ?? "N/A"} kWh
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-800 dark:text-gray-100">Next hour water band</div>
                <div>
                  {pred.predictedWaterCI95?.low ?? "N/A"} to {pred.predictedWaterCI95?.high ?? "N/A"} L
                </div>
              </div>
            </div>
          )}
          {Array.isArray(pred.drivers) && pred.drivers.length > 0 ? (
            <div className="rounded-xl border border-gray-200/70 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Sparkles size={12} />
                Forecast Drivers
              </div>
              <div className="flex flex-wrap gap-2">
                {pred.drivers.slice(0, 4).map((driver, index) => (
                  <span
                    key={`${driver.label}-${index}`}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 dark:border-gray-800 dark:text-gray-300"
                  >
                    {driver.label}: {driver.value}
                    {driver.unit || ""}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(pred.forecastPath) && pred.forecastPath.length > 0 ? (
            <div className="rounded-xl border border-gray-200/70 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                6-Hour Path Preview
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                {pred.forecastPath.slice(0, 6).map((point) => (
                  <div
                    key={point.timestamp}
                    className="rounded-lg border border-gray-200/70 px-2.5 py-2 dark:border-gray-800"
                  >
                    <div className="font-semibold text-gray-800 dark:text-gray-100">
                      {new Date(point.timestamp).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="mt-1 text-gray-600 dark:text-gray-300">E {point.predictedEnergy}</div>
                    <div className="text-gray-600 dark:text-gray-300">W {point.predictedWater}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs opacity-70">
            <span>Avg energy {pred.predictedEnergyAvg}</span>
            <span>Avg water {pred.predictedWaterAvg}</span>
            {pred.confidence != null ? <span>Confidence {pred.confidence}%</span> : null}
            {pred.model?.trainedSamples != null ? <span>Trained {pred.model.trainedSamples}</span> : null}
          </div>
        </div>
      )}
    </Card>
  );
};

export default PredictionCard;
