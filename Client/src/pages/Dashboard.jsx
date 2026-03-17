import { useState, useEffect } from "react";
import io from "socket.io-client";

import SustainabilityGauge from "../components/dashboard/SustainabilityGauge";
import LiveStats from "../components/dashboard/LiveStats";
import Card from "../components/ui/Card";
import EnergyWaterCharts from "../components/dashboard/EnergyWaterCharts";
import AlertsPanel from "../components/dashboard/AlertsPanel";
import SuggestionsPanel from "../components/dashboard/SuggestionsPanel";
import DashboardSkeleton from "../components/skeleton/DashboardSkeleton";
import AIChatWidget from "../components/ai/AIChatWidget";

const socket = io("http://localhost:5000");

const Dashboard = () => {

  const [loading, setLoading] = useState(true);

  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const [lastUpdated, setLastUpdated] = useState(null);

  // 🔥 FETCH INITIAL DATA
  const fetchDashboard = async () => {
    try {
      const [historyRes, scoreRes, alertsRes] = await Promise.all([
        fetch("http://localhost:5000/api/data/history"),
        fetch("http://localhost:5000/api/score"),
        fetch("http://localhost:5000/api/alerts"),
      ]);

      const historyJson = await historyRes.json();
      const scoreJson = await scoreRes.json();
      const alertsJson = await alertsRes.json();

      setHistory(historyJson);
      setLatest(historyJson[0]);
      setScoreData(scoreJson);
      setAlerts(alertsJson);

      setLastUpdated(new Date());

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 SOCKET REAL-TIME
  useEffect(() => {

    fetchDashboard();

    socket.on("newData", (data) => {
      setHistory(prev => [data, ...prev]);
      setLatest(data);
      setLastUpdated(new Date());
    });

    socket.on("newAlert", (alert) => {
      setAlerts(prev => [alert, ...prev]);
    });

    return () => {
      socket.off("newData");
      socket.off("newAlert");
    };

  }, []);

  if (loading || !latest || !scoreData) return <DashboardSkeleton />;

  // 🔥 SMART AI INSIGHTS
  const energyInsight =
    latest.energy > 400
      ? "⚠️ High energy consumption detected. Shift heavy appliances to off-peak hours."
      : "✅ Energy usage is optimized and within safe limits.";

  const waterInsight =
    latest.water > 2000
      ? "⚠️ Water usage spike detected. Possible leakage or inefficiency."
      : "✅ Water consumption is efficient and controlled.";

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Smart Sustainability Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time AI-powered monitoring & optimization system
          </p>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated:
          <span className="ml-2 font-semibold text-gray-900 dark:text-white">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
          </span>
        </div>

      </div>

      {/* TOP GRID */}
      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-12 md:col-span-4">
          <SustainabilityGauge score={scoreData.score} />
        </div>

        <div className="col-span-12 md:col-span-8">
          <LiveStats
            water={latest.water}
            energy={latest.energy}
          />
        </div>

      </div>

      {/* CHARTS */}
      <div className="transition hover:scale-[1.01]">
        <EnergyWaterCharts data={history} />
      </div>

      {/* ALERTS + AI SUGGESTIONS */}
      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-12 lg:col-span-6">
          <AlertsPanel alerts={alerts} />
        </div>

        <div className="col-span-12 lg:col-span-6">
          <SuggestionsPanel latest={latest} />
        </div>

      </div>

      {/* AI INSIGHTS */}
      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-12 md:col-span-6">
          <Card className="hover:scale-[1.03] transition shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
              ⚡ Energy Intelligence
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {energyInsight}
            </p>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-6">
          <Card className="hover:scale-[1.03] transition shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
              💧 Water Intelligence
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {waterInsight}
            </p>
          </Card>
        </div>

      </div>

      {/* FLOATING AI CHAT */}
      <AIChatWidget />

    </div>
  );
};

export default Dashboard;