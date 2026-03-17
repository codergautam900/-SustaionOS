import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { User, Building, Droplet, Zap } from "lucide-react";

const Profile = () => {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    building: "",
    water: "",
    energy: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.building || !form.water || !form.energy) {
      return "All fields are required";
    }
    if (Number(form.water) < 0 || Number(form.energy) < 0) {
      return "Values must be positive";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validate();
    if (error) {
      setMsg("❌ " + error);
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("http://localhost:5000/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: user?.token ? `Bearer ${user.token}` : "",
        },
        body: JSON.stringify({
          ...form,
          water: Number(form.water),
          energy: Number(form.energy),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg("❌ " + (data.msg || data.error || "Error"));
      } else {
        setMsg("✅ Data submitted successfully");
        setForm({ building: "", water: "", energy: "" });
      }
    } catch (err) {
      setMsg("❌ Server error");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-950 dark:to-black text-gray-900 dark:text-white">

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">

        {/* 👤 PROFILE CARD */}
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700">

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-black text-xl font-bold shadow-md">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>

            <div>
              <h2 className="text-xl font-bold">User Profile</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="text-green-500 font-semibold">Active</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span>User</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">System</span>
              <span className="text-primary font-semibold">AI Enabled</span>
            </div>
          </div>
        </div>

        {/* 📊 DATA FORM */}
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700">

          <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
            <Building size={18} /> Add Resource Data
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Building */}
            <div className="relative">
              <Building className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                name="building"
                placeholder="Building Name"
                value={form.building}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Water */}
            <div className="relative">
              <Droplet className="absolute left-3 top-3 text-blue-400" size={18} />
              <input
                type="number"
                name="water"
                placeholder="Water Usage (liters)"
                value={form.water}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Energy */}
            <div className="relative">
              <Zap className="absolute left-3 top-3 text-yellow-400" size={18} />
              <input
                type="number"
                name="energy"
                placeholder="Energy Usage (kWh)"
                value={form.energy}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {/* LIVE PREVIEW */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-center">
                💧 {form.water || 0} L
              </div>
              <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-center">
                ⚡ {form.energy || 0} kWh
              </div>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold shadow-md hover:scale-105 transition"
            >
              {loading ? "Submitting..." : "Submit Data"}
            </button>

            {/* MESSAGE */}
            {msg && (
              <div className="text-center text-sm mt-2 font-medium">
                {msg}
              </div>
            )}

          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;