import React, { useState } from "react";
import { Moon, Sun, BookOpen, Globe } from "lucide-react";
import BSCodesApp from "./bscodes_wrapper";
import EurocodeDesigner from "./eurocode_component";

const MainRetainingApp = () => {
  const [isDark, setIsDark] = useState(false);
  const [activeStandard, setActiveStandard] = useState("eurocode"); // 'bs' or 'eurocode'

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Theme classes
  const bgPrimary = isDark ? "bg-gray-900" : "bg-gray-50";
  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-800";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const borderColor = isDark ? "border-gray-700" : "border-gray-200";

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-300`}>
      {/* Main Navigation Bar */}
      <nav
        className={`${bgCard} shadow-lg border-b-4 border-gradient-to-r from-blue-600 to-teal-600 sticky top-0 z-50`}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-teal-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${textPrimary}`}>
                  RC Structure Designer Pro
                </h1>
                <p className={`text-xs ${textSecondary}`}>
                  Professional Concrete Design Suite
                </p>
              </div>
            </div>

            {/* Standard Toggle */}
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center ${bgPrimary} rounded-lg p-1 shadow-inner`}
              >
                <button
                  onClick={() => setActiveStandard("bs")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${
                    activeStandard === "bs"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105"
                      : isDark
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  BS Codes
                </button>
                <button
                  onClick={() => setActiveStandard("eurocode")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${
                    activeStandard === "eurocode"
                      ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg scale-105"
                      : isDark
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  Eurocodes
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-3 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-gray-700 hover:bg-gray-600 text-yellow-400"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-6 h-6" />
                ) : (
                  <Moon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Standard Info Banner */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                {activeStandard === "bs" ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    <span className={`text-sm font-medium ${textPrimary}`}>
                      British Standards (BS 8110 | BS 8007 | BS 4449)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></div>
                    <span className={`text-sm font-medium ${textPrimary}`}>
                      Eurocodes (EN 1992-1-1 | EN 1992-3 | EN 1997-1 | EN 1990)
                    </span>
                  </div>
                )}
              </div>
              <div className={`text-xs ${textSecondary}`}>
                {activeStandard === "bs"
                  ? "UK Design Standards"
                  : "European Design Standards"}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content Area - Render Active Component */}
      <main className="transition-all duration-500">
        {activeStandard === "bs" ? (
          <BSCodesApp isDark={isDark} />
        ) : (
          <EurocodeDesigner isDark={isDark} />
        )}
      </main>

      {/* Floating Info Card */}
      <div
        className={`fixed bottom-6 right-6 ${bgCard} rounded-lg shadow-2xl p-4 border ${borderColor} max-w-xs`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              activeStandard === "bs" ? "bg-blue-100" : "bg-teal-100"
            }`}
          >
            <BookOpen
              className={`w-6 h-6 ${
                activeStandard === "bs" ? "text-blue-600" : "text-teal-600"
              }`}
            />
          </div>
          <div>
            <h4 className={`font-bold ${textPrimary} text-sm`}>
              {activeStandard === "bs" ? "BS Codes Active" : "Eurocodes Active"}
            </h4>
            <p className={`text-xs ${textSecondary} mt-1`}>
              {activeStandard === "bs"
                ? "Designing per British Standards with full code compliance"
                : "Designing per European Standards with EN compliance"}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  activeStandard === "bs" ? "bg-blue-600" : "bg-teal-600"
                } animate-pulse`}
              ></div>
              <span className={`text-xs ${textSecondary}`}>
                Real-time calculations
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainRetainingApp;
