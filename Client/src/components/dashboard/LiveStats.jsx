import React, { useEffect, useState, useContext } from "react";
import Card from "../ui/Card";
import { Zap, Droplet } from "lucide-react";
import { ThemeContext } from "../../context/ThemeContext";

// 🔥 Smooth Counter Animation
const AnimatedCounter = ({ value = 0, duration = 1000, unit }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;

    if (!value) {
      setCount(0);
      return;
    }

    const increment = value / (duration / 30);

    const timer = setInterval(() => {
      start += increment;

      if (start >= value) {
        start = value;
        clearInterval(timer);
      }

      setCount(Math.floor(start));
    }, 30);

    return () => clearInterval(timer);
  }, [value, duration]);

  return (
    <span className="font-bold text-2xl text-gray-900 dark:text-white">
      {count} {unit}
    </span>
  );
};

const LiveStats = ({ water = 0, energy = 0 }) => {
  const { darkMode } = useContext(ThemeContext);

  const stats = [
    {
      id: 1,
      title: "Energy Usage",
      value: energy,
      unit: "kWh",
      icon: Zap,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      id: 2,
      title: "Water Usage",
      value: water,
      unit: "L",
      icon: Droplet,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <Card
            key={stat.id}
            className={`
              flex items-center gap-4 p-5 rounded-2xl
              transition-all duration-300
              hover:scale-[1.04] hover:shadow-2xl
              ${darkMode
                ? "bg-cardBg border border-gray-800"
                : "bg-white border border-gray-200"}
            `}
          >
            {/* ICON */}
            <div
              className={`
                w-14 h-14 flex items-center justify-center rounded-xl
                ${stat.bg} ${stat.color}
              `}
            >
              <Icon size={26} />
            </div>

            {/* CONTENT */}
            <div className="flex flex-col">
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                {stat.title}
              </p>

              <AnimatedCounter value={stat.value} unit={stat.unit} />
            </div>
          </Card>
        );
      })}

    </div>
  );
};

export default LiveStats;