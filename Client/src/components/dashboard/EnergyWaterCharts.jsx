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

// Format data - robust, tolerate different shapes and already-formatted input
const formatData = (data = []) => {
  if (!Array.isArray(data)) return [];

  let warned = { missing: false, invalid: false };
  return data
    .slice()
    .map((item) => {
      if (!item) return null;

      // If already formatted (used earlier), return as-is (ensure numbers)
      if (item.name && item.time) {
        return {
          ...item,
          energy: Number(item.energy) || 0,
          water: Number(item.water) || 0,
        };
      }

      // accept many date keys
      const rawDate = item.createdAt ?? item.timestamp ?? item.time ?? item.date ?? item.label ?? item.label;
      if (rawDate == null) {
        if (!warned.missing) { console.warn("Some entries missing date were skipped."); warned.missing = true; }
        return null;
      }

      // handle numeric epoch (seconds or ms) and strings
      let parsedDate;
      if (typeof rawDate === "number") {
        // if seconds (10 digits) convert to ms
        parsedDate = rawDate < 1e12 ? new Date(rawDate * 1000) : new Date(rawDate);
      } else {
        parsedDate = new Date(String(rawDate));
      }

      if (isNaN(parsedDate.getTime())) {
        if (!warned.invalid) { console.warn("Some entries have invalid dates and were skipped:", rawDate); warned.invalid = true; }
        return null;
      }

      const energyVal = Number(item.energy ?? item.energy_kwh ?? 0);
      const waterVal = Number(item.water ?? item.water_liters ?? 0);

      return {
        name: parsedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        energy: isNaN(energyVal) ? 0 : energyVal,
        water: isNaN(waterVal) ? 0 : waterVal,
        time: parsedDate.getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
};

// Custom dot with number label
const ValueDot = ({ cx, cy, payload, dataKey, color }) => {
  const value = payload && payload[dataKey] != null ? payload[dataKey] : "";
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={12} fill={color} fontWeight="bold">
        {value}
      </text>
    </g>
  );
};

const ChartCard = ({ title, dataKey, color, data }) => {
  const { darkMode } = useContext(ThemeContext);
  const chartData = useMemo(() => formatData(data), [data]);

  return (
    <Card className="h-80 md:h-96 flex flex-col hover:scale-[1.02] transition-all duration-300 shadow-xl border border-gray-200 dark:border-gray-800">
      <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#E5E7EB"} />
            <XAxis dataKey="name" stroke={darkMode ? "#9CA3AF" : "#4B5563"} tick={{ fontSize: 12 }} />
            <YAxis stroke={darkMode ? "#9CA3AF" : "#4B5563"} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: darkMode ? "#111827" : "#fff",
                borderRadius: "10px",
                border: "1px solid",
                borderColor: darkMode ? "#374151" : "#E5E7EB",
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
    </Card>
  );
};

const EnergyWaterCharts = ({ data = [] }) => {
  const formattedData = useMemo(() => formatData(data), [data]);

  if (!formattedData.length)
    return (
      <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
        No data available for charts
      </Card>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Energy Trend (kWh)" dataKey="energy" color="#22C55E" data={formattedData} />
      <ChartCard title="Water Trend (Liters)" dataKey="water" color="#3B82F6" data={formattedData} />
    </div>
  );
};

export default EnergyWaterCharts;