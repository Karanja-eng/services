import React, { useState } from "react";
import { History, Settings, Sun, Moon } from "lucide-react";

const RightSidebar = ({ isOpen, onClose, isDark, toggleTheme }) => {
  const [activeTab, setActiveTab] = useState("history");

  return (
    <div
      className={`fixed top-0 right-0 h-full w-64 bg-gray-100 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      } overflow-y-auto`}
      style={{ pointerEvents: isOpen ? "auto" : "none" }}
      aria-hidden={!isOpen}
    >
      <button
        onClick={onClose}
        className="absolute top-2 left-2 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 z-50 text-gray-700 dark:text-gray-300"
        aria-label="Close sidebar"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <div className="p-4 pt-10">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              activeTab === "history"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
            aria-label="View history"
          >
            <History size={16} />
            <span className="text-sm">History</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              activeTab === "settings"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
            aria-label="View settings"
          >
            <Settings size={16} />
            <span className="text-sm">Settings</span>
          </button>
        </div>

        {activeTab === "history" && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Recent Activity
            </h3>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                >
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Beam calculation #{i}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    2 hours ago
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Theme
                </span>
                <button
                  onClick={toggleTheme}
                  disabled={!toggleTheme}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                  }
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RightSidebar;
