import React, { useState } from "react";
import { BookOpen, Globe } from "lucide-react";
import Retaining from "./rc_retaining_app";
import EurocodeDesigner from "./eurocode_component";

const MainRetainingApp = ({ isDark = false }) => {
  const [activeStandard, setActiveStandard] = useState("eurocode");

  // Theme classes using slate/teal palette
  const bgPrimary = isDark ? "bg-slate-900" : "bg-slate-50";
  const bgCard = isDark ? "bg-slate-800" : "bg-white";
  const textPrimary = isDark ? "text-slate-100" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-600";
  const borderColor = isDark ? "border-slate-700" : "border-slate-200";

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-300`}>
      {/* Main Navigation Bar */}
      <nav
        className={`${bgCard} shadow-lg border-b ${borderColor}  top-0 z-50`}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${textPrimary}`}>
                  Retaining Wall Designer
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
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${activeStandard === "bs"
                    ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg scale-105"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Globe className="w-5 h-5" />
                  BS Codes
                </button>
                <button
                  onClick={() => setActiveStandard("eurocode")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${activeStandard === "eurocode"
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Globe className="w-5 h-5" />
                  Eurocodes
                </button>
              </div>
            </div>
          </div>

          {/* Standard Info Banner */}
          <div className={`mt-4 pt-4 border-t ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                {activeStandard === "bs" ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></div>
                    <span className={`text-sm font-medium ${textPrimary}`}>
                      British Standards (BS 8110 | BS 8007 | BS 4449)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
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
          <Retaining isDark={isDark} />
        ) : (
          <EurocodeDesigner isDark={isDark} />
        )}
      </main>
    </div>
  );
};

export default MainRetainingApp;
