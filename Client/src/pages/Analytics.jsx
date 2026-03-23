// src/pages/Analytics.jsx
import React, { useContext, useState, useEffect } from "react";
import Card from "../components/ui/Card";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar
} from "recharts";
import { ThemeContext } from "../context/ThemeContext";

const Analytics = () => {
  const { darkMode } = useContext(ThemeContext);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [scoreData, setScoreData] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [period, setPeriod] = useState("6"); // default last 6 months
  const [error, setError] = useState("");

  const fetchAnalytics = async (selectedPeriod = period) => {
    setLoading(true);
    setError("");
    try {
      // Summary
      const summaryRes = await fetch(`/api/analytics/summary?period=${selectedPeriod}`);
      const summaryJson = await summaryRes.json();
      if(summaryJson.msg) {
        setSummary({});
      } else {
        setSummary(summaryJson);
      }

      // Score
      const scoreRes = await fetch(`/api/analytics/score`);
      const scoreJson = await scoreRes.json();
      setScoreData(scoreJson || { score: 0, usage: { energy:0, water:0 } });

      // Trend
      const trendRes = await fetch(`/api/analytics/trend?period=${selectedPeriod}`);
      const trendJson = await trendRes.json();

      if (!Array.isArray(trendJson) || trendJson.length === 0) {
        setTrendData([]);
      } else {
        const formattedTrend = trendJson.map(item => ({
          date: item.date || item.timestamp, // backend date field
          energy: item.energy || 0,
          water: item.water || 0,
        }));
        setTrendData(formattedTrend);
      }
    } catch(err) {
      console.error("Error fetching analytics data:", err);
      setError("Failed to load analytics. Try refreshing.");
      setSummary({});
      setScoreData({});
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  if(loading) return <div className="text-center text-gray-500 p-10">Loading Analytics...</div>;
  if(error) return <div className="text-center text-red-500 p-10">{error}</div>;
  if(trendData.length === 0) return <div className="text-center text-gray-500 p-10">No data available for this period.</div>;

  return (
    <div className="space-y-8">
      {/* Header + Period Select */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Analytics & Insights</h1>
          <p className={`${darkMode ? "text-gray-400" : "text-gray-600"} mt-1`}>
            Deep sustainability performance analysis
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className={`bg-gray-200 dark:bg-gray-900 border border-gray-300 dark:border-gray-700
            text-gray-900 dark:text-white px-3 py-2 rounded-lg text-sm w-full md:w-auto transition-colors`}
        >
          <option value="6">Last 6 Months</option>
          <option value="12">Last 12 Months</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Energy Usage</p>
          <h2 className="text-2xl font-semibold mt-2">{summary.avgEnergy || 0} kWh</h2>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Water Usage</p>
          <h2 className="text-2xl font-semibold mt-2">{summary.avgWater || 0} L</h2>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">Carbon Footprint</p>
          <h2 className="text-2xl font-semibold mt-2">
            {(scoreData.usage?.energy || 0) + (scoreData.usage?.water || 0)} units
          </h2>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">Efficiency Score</p>
          <h2 className="text-2xl font-semibold mt-2 text-green-500">{scoreData.score || 0}%</h2>
        </Card>
      </div>

      {/* Line Chart */}
      <Card className="h-96 flex flex-col">
        <h3 className="text-lg font-semibold mb-4">Energy & Water Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#d1d5db"} />
            <XAxis dataKey="date" stroke={darkMode ? "#9CA3AF" : "#4B5563"} />
            <YAxis stroke={darkMode ? "#9CA3AF" : "#4B5563"} />
            <Tooltip
              contentStyle={{
                backgroundColor: darkMode ? "#111827" : "#ffffff",
                border: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`,
                borderRadius: 10,
              }}
            />
            <Line type="monotone" dataKey="energy" stroke="#22C55E" strokeWidth={3} />
            <Line type="monotone" dataKey="water" stroke="#3B82F6" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Bar Chart */}
      <Card className="h-96 flex flex-col">
        <h3 className="text-lg font-semibold mb-4">Monthly Energy Comparison</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#d1d5db"} />
            <XAxis dataKey="date" stroke={darkMode ? "#9CA3AF" : "#4B5563"} />
            <YAxis stroke={darkMode ? "#9CA3AF" : "#4B5563"} />
            <Tooltip
              contentStyle={{
                backgroundColor: darkMode ? "#111827" : "#ffffff",
                border: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`,
                borderRadius: 10,
              }}
            />
            <Bar dataKey="energy" fill="#22C55E" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Analytics;