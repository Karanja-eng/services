import React, { useState } from "react";
import { Moon, Sun, BookOpen, Euro, FileText, Settings } from "lucide-react";

// Import the calculator components (in actual implementation, these would be separate files)
// For demonstration, we'll use placeholders that would be replaced with actual imports:
import SlabCalculator from "./slab_calculator_frontend";
import EurocodeSlabCalculator from "./eurocode_slab_calculator";

const MainSlabApp = () => {
  const [theme, setTheme] = useState("light");
  const [activeCode, setActiveCode] = useState("bs8110"); // 'bs8110' or 'eurocode'
  const [showSettings, setShowSettings] = useState(false);

  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Theme classes
  const bgPrimary = isDark ? "bg-gray-900" : "bg-gray-50";
  const bgSecondary = isDark ? "bg-gray-800" : "bg-white";
  const bgTertiary = isDark ? "bg-gray-700" : "bg-gray-100";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-400" : "text-gray-500";
  const borderColor = isDark ? "border-gray-700" : "border-gray-200";
  const hoverBg = isDark ? "hover:bg-gray-700" : "hover:bg-gray-100";

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-300`}>
      {/* Top Navigation Bar */}
      <nav
        className={`${bgSecondary} border-b ${borderColor} sticky top-0 z-50 shadow-lg`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div
                className={`p-2 ${
                  activeCode === "bs8110" ? "bg-blue-500" : "bg-green-500"
                } rounded-lg transition-colors duration-300`}
              >
                {activeCode === "bs8110" ? (
                  <BookOpen className="w-6 h-6 text-white" />
                ) : (
                  <Euro className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h1 className={`text-xl font-bold ${textPrimary}`}>
                  Structural Design Suite
                </h1>
                <p className={`text-xs ${textTertiary}`}>
                  {activeCode === "bs8110"
                    ? "BS 8110:1997"
                    : "EN 1992-1-1:2004"}
                </p>
              </div>
            </div>

            {/* Center - Code Toggle */}
            <div className={`flex items-center ${bgTertiary} rounded-lg p-1`}>
              <button
                onClick={() => setActiveCode("bs8110")}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeCode === "bs8110"
                    ? "bg-blue-500 text-white shadow-lg"
                    : `${textSecondary} ${hoverBg}`
                }`}
              >
                <BookOpen className="w-4 h-4" />
                BS 8110
              </button>
              <button
                onClick={() => setActiveCode("eurocode")}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeCode === "eurocode"
                    ? "bg-green-500 text-white shadow-lg"
                    : `${textSecondary} ${hoverBg}`
                }`}
              >
                <Euro className="w-4 h-4" />
                Eurocode
              </button>
            </div>

            {/* Right side - Theme toggle and Settings */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className={`p-2 ${bgTertiary} rounded-lg ${hoverBg} transition-colors`}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className={`w-5 h-5 ${textPrimary}`} />
                ) : (
                  <Moon className={`w-5 h-5 ${textPrimary}`} />
                )}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 ${bgTertiary} rounded-lg ${hoverBg} transition-colors`}
                aria-label="Settings"
              >
                <Settings className={`w-5 h-5 ${textPrimary}`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Settings Panel (Optional) */}
      {showSettings && (
        <div className={`${bgSecondary} border-b ${borderColor} shadow-lg`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Units System
                </label>
                <select
                  className={`w-full px-3 py-2 ${bgTertiary} border ${borderColor} rounded-lg ${textPrimary}`}
                >
                  <option>SI (Metric)</option>
                  <option>Imperial</option>
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Report Format
                </label>
                <select
                  className={`w-full px-3 py-2 ${bgTertiary} border ${borderColor} rounded-lg ${textPrimary}`}
                >
                  <option>PDF</option>
                  <option>Word (DOCX)</option>
                  <option>Excel (XLSX)</option>
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Precision
                </label>
                <select
                  className={`w-full px-3 py-2 ${bgTertiary} border ${borderColor} rounded-lg ${textPrimary}`}
                >
                  <option>2 decimal places</option>
                  <option>3 decimal places</option>
                  <option>4 decimal places</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Banner */}
        <div
          className={`${bgSecondary} rounded-xl border ${borderColor} p-6 mb-6 shadow-lg`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 ${
                activeCode === "bs8110" ? "bg-blue-500/20" : "bg-green-500/20"
              } rounded-lg`}
            >
              <FileText
                className={`w-6 h-6 ${
                  activeCode === "bs8110" ? "text-blue-500" : "text-green-500"
                }`}
              />
            </div>
            <div className="flex-1">
              <h2 className={`text-lg font-semibold ${textPrimary} mb-2`}>
                {activeCode === "bs8110"
                  ? "British Standard 8110 - Structural Use of Concrete"
                  : "Eurocode 2 - Design of Concrete Structures"}
              </h2>
              <p className={`${textSecondary} text-sm`}>
                {activeCode === "bs8110"
                  ? "Complete slab design according to BS 8110-1:1997. Includes one-way, two-way, ribbed, and waffle slabs with all standard coefficient tables and design checks."
                  : "Complete slab design according to EN 1992-1-1:2004. Includes comprehensive moment and shear calculations with Eurocode-specific load combinations and material properties."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    activeCode === "bs8110"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  ✓ One-way slabs
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    activeCode === "bs8110"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  ✓ Two-way slabs
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    activeCode === "bs8110"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  ✓ Ribbed slabs
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    activeCode === "bs8110"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  ✓ Waffle slabs
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    activeCode === "bs8110"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  ✓ Multiple spans
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Calculator Component */}
        <div className="transition-all duration-300">
          {activeCode === "bs8110" ? (
            <SlabCalculator theme={theme} />
          ) : (
            <EurocodeSlabCalculator theme={theme} />
          )}
        </div>
      </main>
    </div>
  );
};

export default MainSlabApp;
