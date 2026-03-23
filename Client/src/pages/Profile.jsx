// src/pages/Profile.jsx
import React, { useState, useEffect, useContext } from "react";
import Card from "../components/ui/Card";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";
import SustainabilityGauge from "../components/dashboard/SustainabilityGauge";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { Sun, Moon } from "lucide-react";

const API = "http://localhost:5000";

const Profile = () => {
  const { user, setUser } = useContext(AuthContext);
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({ building: "", water: "", energy: "" });
  const [profileForm, setProfileForm] = useState({ name: "", building: "" });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEnergy: 0,
    totalWater: 0,
    score: 0,
    avgEnergy: 0,
    avgWater: 0,
  });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (user && !profileForm.name && !profileForm.building) {
      setProfileForm({
        name: user.name || "",
        building: user.building || "",
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.token) return;

      try {
        const [profileRes, statsRes, historyRes, scoreRes] = await Promise.all([
          fetch(`${API}/api/user/profile`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API}/api/user/stats`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API}/api/data/history`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API}/api/score`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);

        const profileJson = await profileRes.json();
        const statsJson = await statsRes.json();
        const historyJson = await historyRes.json();
        const scoreJson = await scoreRes.json();

        if (!profileRes.ok) throw new Error(profileJson.msg || "Profile fetch failed");
        if (!statsRes.ok) throw new Error(statsJson.msg || "Stats fetch failed");
        if (!historyRes.ok) throw new Error(historyJson.msg || "History fetch failed");

        const updatedUser = { ...profileJson.user, token: user.token };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));

        const historyArray = Array.isArray(historyJson)
          ? historyJson
          : historyJson.history || [];

        const avgEnergy = historyArray.length
          ? Math.round(historyArray.reduce((a, b) => a + b.energy, 0) / historyArray.length)
          : 0;

        const avgWater = historyArray.length
          ? Math.round(historyArray.reduce((a, b) => a + b.water, 0) / historyArray.length)
          : 0;

        setStats({
          ...statsJson,
          score: scoreJson.score || 0,
          avgEnergy,
          avgWater,
        });

        setHistory(historyArray.slice(0, 5));
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Error loading profile");
        setHistory([]);
      } finally {
        setPageLoading(false);
      }
    };

    fetchData();
  }, [user?.token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTheme = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    try {
      await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ darkMode: newMode }),
      });
    } catch {
      toast.error("Theme save failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.building) return toast.error("Building required");
    setLoading(true);

    try {
      const submittedData = { ...form, timestamp: new Date().toISOString() };

      const res = await fetch(`${API}/api/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          ...form,
          water: Number(form.water),
          energy: Number(form.energy),
        }),
      });

      const data = await res.json();
      if (!res.ok) return toast.error(data.msg || "Submit failed");

      toast.success("Data submitted");

      setHistory((prev) => [submittedData, ...prev].slice(0, 5));
      setForm({ building: "", water: "", energy: "" });
    } catch {
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!user?.token) return toast.error("User not logged in");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/user/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) return toast.error(data.msg || "Update failed");

      const updatedUser = { ...data.user, token: user.token };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Profile updated successfully");
    } catch (err) {
      console.error("❌ Update failed:", err);
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading)
    return <div className="p-10 text-center text-lg animate-pulse">Loading Profile...</div>;

  return (
    <div className="min-h-screen p-6 bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Toaster />

      <div className="max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">👤 Profile</h1>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-3 rounded-full bg-gray-200 dark:bg-gray-800">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button onClick={() => navigate("/")} className="px-4 py-2 bg-primary rounded-lg">
              Dashboard
            </button>
          </div>
        </div>

        {/* STATS */}
        <Card className="p-6">
          <SustainabilityGauge score={stats.score} />
        </Card>

        {/* UPDATE PROFILE */}
        <Card className="p-6">
          <form onSubmit={handleProfileUpdate} className="space-y-3">
            <input
              name="name"
              value={profileForm.name}
              onChange={handleProfileChange}
              className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border"
              placeholder="Name"
            />

            <input
              name="building"
              value={profileForm.building}
              onChange={handleProfileChange}
              className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border"
              placeholder="Building"
            />

            <button className="w-full py-3 rounded-lg bg-green-500 text-white">
              {loading ? "Saving..." : "Update Profile"}
            </button>
          </form>
        </Card>

        {/* ADD DATA */}









        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              name="building"
              value={form.building}
              onChange={handleChange}
              placeholder="Building"
              className="w-full p-3 border rounded bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <input
              name="water"
              type="number"
              value={form.water}
              onChange={handleChange}
              placeholder="Water"
              className="w-full p-3 border rounded bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <input
              name="energy"
              type="number"
              value={form.energy}
              onChange={handleChange}
              placeholder="Energy"
              className="w-full p-3 border rounded bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />

            <button className="w-full py-3 bg-blue-500 text-white rounded">
              {loading ? "Submitting..." : "Submit Data"}
            </button>



{/* RECENT ACTIVITY */}
<Card className="p-6">
  <h3 className="text-lg font-semibold mb-4">📊 Recent Activity</h3>

  {history.length === 0 ? (
    <p className="text-gray-500 dark:text-gray-400">
      No recent activity
    </p>
  ) : (
    <div className="space-y-3">
      {history.map((item, index) => (
        <div
          key={index}
          className="flex justify-between items-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800"
        >
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {item.building || "Building"}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(item.timestamp || item.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="text-sm text-right">
            <p className="text-blue-500">💧 {item.water}</p>
            <p className="text-green-500">⚡ {item.energy}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</Card>










          </form>
        </Card>











      </div>
    </div>
  );
};

export default Profile;