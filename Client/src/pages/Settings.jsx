import React, { useState, useEffect, useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";
import { Save, User, Shield, Bell, Zap, Trash2 } from "lucide-react";

const Settings = () => {
  const { darkMode, setDarkMode } = useContext(ThemeContext);

  const [settings, setSettings] = useState({
    name: "",
    email: "",
    aiSuggestions: true,
    predictiveInsights: true,
    energyLimit: 500,
    waterLimit: 200,
    energyAlerts: true,
    waterAlerts: true,
    weeklyReports: false,
    sustainabilityGoal: 20,
    darkMode: false,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/settings", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setDarkMode(data.darkMode);
        setLoading(false);
      });
  }, []);

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  const saveSettings = async () => {
    await fetch("http://localhost:5000/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(settings),
    });

    alert("✅ Settings Saved");
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  const cardStyle = `p-6 rounded-2xl shadow-md transition ${
    darkMode
      ? "bg-gray-900 text-white border border-gray-700"
      : "bg-white text-black border border-gray-200"
  }`;

  const inputStyle = `w-full p-3 rounded-lg outline-none ${
    darkMode
      ? "bg-gray-800 text-white border border-gray-700"
      : "bg-gray-100 border border-gray-300"
  }`;

  const toggle = (value, onChange) => (
    <div
      onClick={() => onChange(!value)}
      className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${
        value ? "bg-green-500" : "bg-gray-400"
      }`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full transform transition ${
          value ? "translate-x-6" : ""
        }`}
      />
    </div>
  );

  return (
    <div className="space-y-8 pb-10">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">⚙️ Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your account and sustainability preferences
        </p>
      </div>

      {/* PROFILE */}
      <div className={cardStyle}>
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <User size={18} /> Profile
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            placeholder="Full Name"
            value={settings.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={inputStyle}
          />
          <input
            placeholder="Email"
            value={settings.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className={inputStyle}
          />
        </div>
      </div>

      {/* AI SETTINGS */}
      <div className={cardStyle}>
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <Zap size={18} /> AI System
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span>AI Suggestions</span>
            {toggle(settings.aiSuggestions, (v) =>
              handleChange("aiSuggestions", v)
            )}
          </div>

          <div className="flex justify-between">
            <span>Predictive Insights</span>
            {toggle(settings.predictiveInsights, (v) =>
              handleChange("predictiveInsights", v)
            )}
          </div>
        </div>
      </div>

      {/* THRESHOLDS */}
      <div className={cardStyle}>
        <h2 className="text-xl font-semibold mb-4">📊 Monitoring Limits</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="number"
            value={settings.energyLimit}
            onChange={(e) => handleChange("energyLimit", e.target.value)}
            className={inputStyle}
            placeholder="Energy Limit"
          />
          <input
            type="number"
            value={settings.waterLimit}
            onChange={(e) => handleChange("waterLimit", e.target.value)}
            className={inputStyle}
            placeholder="Water Limit"
          />
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className={cardStyle}>
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <Bell size={18} /> Notifications
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between">
            Energy Alerts
            {toggle(settings.energyAlerts, (v) =>
              handleChange("energyAlerts", v)
            )}
          </div>

          <div className="flex justify-between">
            Water Alerts
            {toggle(settings.waterAlerts, (v) =>
              handleChange("waterAlerts", v)
            )}
          </div>

          <div className="flex justify-between">
            Weekly Reports
            {toggle(settings.weeklyReports, (v) =>
              handleChange("weeklyReports", v)
            )}
          </div>
        </div>
      </div>

      {/* THEME */}
      <div className={cardStyle}>
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <Shield size={18} /> Theme
        </h2>

        <div className="flex justify-between">
          Dark Mode
          {toggle(darkMode, (v) => {
            setDarkMode(v);
            handleChange("darkMode", v);
          })}
        </div>
      </div>

      {/* DANGER */}
      <div className="p-6 rounded-2xl border border-red-500 bg-red-50 dark:bg-red-900/20">
        <h2 className="flex items-center gap-2 text-red-500 text-lg font-semibold mb-3">
          <Trash2 size={18} /> Danger Zone
        </h2>

        <button className="bg-red-500 text-white px-4 py-2 rounded-lg">
          Delete Account
        </button>
      </div>

      {/* SAVE BUTTON */}
      <button
        onClick={saveSettings}
        className="flex items-center gap-2 bg-primary px-6 py-3 rounded-xl font-semibold hover:scale-105 transition"
      >
        <Save size={16} />
        Save Changes
      </button>
    </div>
  );
};

export default Settings;