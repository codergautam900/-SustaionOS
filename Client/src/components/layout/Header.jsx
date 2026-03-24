import React, { useState, useContext, useEffect } from "react";
import { Menu, Bell, ChevronDown, AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import { ThemeContext } from "../../context/ThemeContext";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getAuthToken } from "../../utils/auth";
import socket from "../../utils/socket";

const API = "http://localhost:5000";

const Header = ({ setIsOpen }) => {
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [alertMenuOpen, setAlertMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const markNotificationRead = async (id) => {
    try {
      const token = getAuthToken();
      if (!token) return;
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, read: true } : item))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      console.error("Mark notification read failed:", err);
    }
  };

  useEffect(() => {
    const loadNotifications = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${API}/api/notifications?limit=6`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const json = await res.json();
        setNotifications(Array.isArray(json?.notifications) ? json.notifications : []);
        setUnreadCount(Number(json?.unreadCount || 0));
      } catch (err) {
        console.error("Header notifications load failed:", err);
      }
    };

    loadNotifications();

    if (!socket.connected) socket.connect();
    const onNewNotification = (notification) => {
      if (!notification?._id) return;
      if (String(notification.userId || "") !== String(user?._id || "")) return;
      setNotifications((prev) => [notification, ...prev].slice(0, 6));
      setUnreadCount((count) => count + 1);
    };

    socket.on("newNotification", onNewNotification);

    return () => {
      socket.off("newNotification", onNewNotification);
    };
  }, [user?._id]);

  return (
    <header
      className={`h-16 flex items-center justify-between px-4 md:px-6
      backdrop-blur-xl bg-white/70 dark:bg-gray-900/70
      border-b border-white/20 dark:border-gray-700 shadow-md`}
    >
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

      <div className="flex items-center gap-5 relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAlertMenuOpen((open) => !open)}
            className="relative cursor-pointer"
          >
            <Bell className="text-gray-600 dark:text-gray-300 hover:text-primary transition" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {alertMenuOpen && (
            <div className="absolute right-0 mt-3 w-80 max-w-[85vw] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Notifications</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {unreadCount} unread
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigate("/notifications");
                    setAlertMenuOpen(false);
                  }}
                  className="text-xs inline-flex items-center gap-1 text-primary font-medium"
                >
                  View all <ExternalLink size={12} />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 4).length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 4).map((item) => (
                    <button
                      key={item._id}
                      onClick={async () => {
                        await markNotificationRead(item._id);
                        navigate(item.link || "/alerts");
                        setAlertMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 ${
                            item.read ? "text-gray-400" : "text-primary"
                          }`}
                        >
                          {item.type === "SCORE" ? <Sparkles size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm">{item.title}</p>
                            {!item.read && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.message}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-black font-bold">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>

            <span className="text-sm hidden md:block">{user?.name || "User"}</span>
            <ChevronDown size={16} />
          </div>

          {userMenuOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
              <button
                onClick={() => {
                  navigate("/profile");
                  setUserMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
              >
                Profile
              </button>

              <div className="border-t border-gray-300 dark:border-gray-700" />

              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500 hover:text-white transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>

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
