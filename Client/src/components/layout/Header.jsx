import React, { useState, useContext } from "react";
import { Menu, Bell, User, ChevronDown } from "lucide-react";
import { ThemeContext } from "../../context/ThemeContext";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Header = ({ setIsOpen }) => {
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header
      className={`h-16 flex items-center justify-between px-4 md:px-6
      backdrop-blur-xl bg-white/70 dark:bg-gray-900/70
      border-b border-white/20 dark:border-gray-700 shadow-md`}
    >
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <Menu
          className={`cursor-pointer lg:hidden ${
            darkMode ? "text-white" : "text-black"
          }`}
          onClick={() => setIsOpen(true)}
        />

        <h1 className="text-xl font-bold tracking-wide">
          <span className="text-primary">Sustain</span>OS
        </h1>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-5 relative">

        {/* 🔔 Notification */}
        <div className="relative cursor-pointer">
          <Bell className="text-gray-600 dark:text-gray-300 hover:text-primary transition" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
            3
          </span>
        </div>

        {/* 👤 USER */}
        <div className="relative">

          {/* Trigger */}
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition"
          >
            {/* Avatar */}
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-black font-bold">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>

            {/* Name */}
            <span className="text-sm hidden md:block">
              {user?.name || "User"}
            </span>

            <ChevronDown size={16} />
          </div>

          {/* Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">

              {/* Profile */}
              <button
                onClick={() => {
                  navigate("/profile");
                  setUserMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
              >
                👤 Profile
              </button>

              {/* Divider */}
              <div className="border-t border-gray-300 dark:border-gray-700"></div>

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500 hover:text-white transition"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>

        {/* 🌙 Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
            darkMode ? "bg-primary" : "bg-gray-400"
          }`}
        >
          <div
            className={`bg-black w-4 h-4 rounded-full transform transition ${
              darkMode ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>

      </div>
    </header>
  );
};

export default Header;