import React from "react";
import { Settings, Sun, Moon, X } from "lucide-react";

const RightSidebar = ({ isOpen, onClose, isDark, toggleTheme }) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-l border-gray-200 dark:border-gray-800 z-[70] transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"} shadow-2xl flex flex-col`}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Settings size={22} className="text-blue-600" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close sidebar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-5 space-y-8 overflow-y-auto flex-1">
          {/* Theme Settings */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Appearance
            </h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-yellow-100 text-yellow-600'}`}>
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Dark Mode
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isDark ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span
                  className={`${isDark ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
                />
              </button>
            </div>
          </div>

          {/* Other Settings placeholders */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              General
            </h3>
            <div className="group p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Account Preferences</span>
            </div>
            <div className="group p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Notifications</span>
            </div>
            <div className="group p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Help & Support</span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
          >
            Close Settings
          </button>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;
