import React, { useContext, useMemo } from "react";
import Card from "../ui/Card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ThemeContext } from "../../context/ThemeContext";

const formatData = (data = []) => {
  if (!Array.isArray(data)) return [];

  return data
    .slice()
    .map((item) => {
      if (!item) return null;

      const rawDate = item.createdAt ?? item.timestamp ?? item.time ?? item.date ?? item.label ?? null;
      if (rawDate == null) return null;

      let parsedDate;
      if (typeof rawDate === "number") {
        parsedDate = rawDate < 1e12 ? new Date(rawDate * 1000) : new Date(rawDate);
      } else {
        parsedDate = new Date(String(rawDate));
      }

      if (Number.isNaN(parsedDate.getTime())) return null;

      const energyVal = Number(item.energy ?? item.energy_kwh ?? 0);
      const waterVal = Number(item.water ?? item.water_liters ?? 0);

      return {
        name: parsedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        energy: Number.isNaN(energyVal) ? 0 : energyVal,
        water: Number.isNaN(waterVal) ? 0 : waterVal,
        time: parsedDate.getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
};

const ValueDot = ({ cx, cy, payload, dataKey, color }) => {
  const value = payload && payload[dataKey] != null ? payload[dataKey] : "";
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={11} fill={color} fontWeight="bold">
        {value}
      </text>
    </g>
  );
};

const ChartCard = ({ title, subtitle, dataKey, color, data }) => {
  const { darkMode } = useContext(ThemeContext);
  const chartData = useMemo(() => formatData(data), [data]);

  return (
    <Card className="relative overflow-hidden p-0 border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="relative p-5 md:p-6 h-80 md:h-96 flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>

        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#E5E7EB"} />
              <XAxis dataKey="name" stroke={darkMode ? "#9CA3AF" : "#4B5563"} tick={{ fontSize: 12 }} />
              <YAxis stroke={darkMode ? "#9CA3AF" : "#4B5563"} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? "#111827" : "#ffffff",
                  borderRadius: "12px",
                  border: `1px solid ${darkMode ? "#374151" : "#E5E7EB"}`,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={3}
                dot={(props) => <ValueDot {...props} dataKey={dataKey} color={color} />}
                activeDot={{ r: 6 }}
                animationDuration={1200}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};

const EnergyWaterCharts = ({ data = [] }) => {
  const formattedData = useMemo(() => formatData(data), [data]);

  if (!formattedData.length) {
    return (
      <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
        No data available for charts
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard
        title="Energy Trend"
        subtitle="Electricity usage across the latest telemetry points."
        dataKey="energy"
        color="#22C55E"
        data={formattedData}
      />
      <ChartCard
        title="Water Trend"
        subtitle="Water consumption movement over the same period."
        dataKey="water"
        color="#3B82F6"
        data={formattedData}
      />
    </div>
  );
};

export default EnergyWaterCharts;
