import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

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
    if (form.water < 0 || form.energy < 0) {
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
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          ...form,
          water: Number(form.water),
          energy: Number(form.energy),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg("❌ " + (data.msg || "Error"));
      } else {
        setMsg("✅ Data submitted successfully");
        setForm({ building: "", water: "", energy: "" });
      }
    } catch {
      setMsg("❌ Server error");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">

        {/* PROFILE CARD */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-black text-xl font-bold">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                User Profile
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.email || "No Email"}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <p className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status</span>
              <span className="text-green-500 font-semibold">Active</span>
            </p>

            <p className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Role</span>
              <span>User</span>
            </p>

            <p className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Login</span>
              <span>Today</span>
            </p>
          </div>
        </div>

        {/* DATA FORM */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">

          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            📊 Add Resource Data
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            <input
              type="text"
              name="building"
              placeholder="Building Name"
              value={form.building}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white outline-none focus:ring-2 focus:ring-primary"
            />

            <input
              type="number"
              name="water"
              placeholder="Water Usage (liters)"
              value={form.water}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="number"
              name="energy"
              placeholder="Energy Usage (kWh)"
              value={form.energy}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
            />

            {/* PREVIEW */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200">
                💧 Water: {form.water || 0}
              </div>
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200">
                ⚡ Energy: {form.energy || 0}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-black font-semibold hover:scale-105 transition"
            >
              {loading ? "Submitting..." : "Submit Data"}
            </button>

            {msg && (
              <p className="text-center text-sm mt-2">{msg}</p>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;