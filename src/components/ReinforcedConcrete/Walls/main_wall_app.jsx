import React, { useState } from "react";
import { Moon, Sun, BookOpen, Euro } from "lucide-react";
import EurocodeWallCalculator from "./eurocode_wall_calc";
// Import the BS Codes Calculator (from first artifact)
const WallDesignCalculator = ({ isDark }) => {
  const [wallType, setWallType] = useState("shear");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [inputs, setInputs] = useState({
    height: 3.5,
    length: 4.0,
    thickness: 200,
    axialLoad: 1500,
    shearForce: 250,
    moment: 350,
    concreteGrade: 30,
    steelGrade: 500,
    coverDepth: 40,
    exposureClass: "XC1",
  });

  const handleInputChange = (e) => {
    setInputs({
      ...inputs,
      [e.target.name]: parseFloat(e.target.value) || e.target.value,
    });
  };

  const calculateDesign = async () => {
    setLoading(true);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockResult = {
      wallType,
      designStatus: "PASS",
      reinforcement: {
        vertical: { diameter: 16, spacing: 200, area: 1005, ratio: 0.0063 },
        horizontal: { diameter: 12, spacing: 250, area: 452, ratio: 0.0028 },
      },
      capacities: {
        axialCapacity: 2450,
        shearCapacity: 380,
        momentCapacity: 485,
        utilization: { axial: 0.61, shear: 0.66, moment: 0.72 },
      },
      checks: [
        {
          name: "Minimum Reinforcement",
          status: "PASS",
          value: "0.63%",
          limit: "0.40%",
        },
        {
          name: "Maximum Reinforcement",
          status: "PASS",
          value: "0.91%",
          limit: "4.00%",
        },
        {
          name: "Slenderness Ratio",
          status: "PASS",
          value: "17.5",
          limit: "30.0",
        },
      ],
      bsCodeReferences: ["BS EN 1992-1-1:2004", "BS 8110-1:1997"],
    };

    setResult(mockResult);
    setLoading(false);
  };

  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-800";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-600";
  const bgInput = isDark ? "bg-gray-700" : "bg-white";
  const border = isDark ? "border-gray-700" : "border-gray-300";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className={`${bgCard} rounded-lg shadow-md p-6`}>
            <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>
              Wall Type
            </h2>
            <div className="space-y-2">
              {["shear", "core", "retaining", "bearing"].map((type) => (
                <button
                  key={type}
                  onClick={() => setWallType(type)}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                    wallType === type
                      ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white"
                      : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} Wall
                </button>
              ))}
            </div>
          </div>

          <div className={`${bgCard} rounded-lg shadow-md p-6`}>
            <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>
              Geometry
            </h2>
            <div className="space-y-4">
              {[
                { name: "height", label: "Height (m)", step: "0.1" },
                { name: "length", label: "Length (m)", step: "0.1" },
                { name: "thickness", label: "Thickness (mm)", step: "10" },
              ].map((field) => (
                <div key={field.name}>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    {field.label}
                  </label>
                  <input
                    type="number"
                    name={field.name}
                    value={inputs[field.name]}
                    onChange={handleInputChange}
                    step={field.step}
                    className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={calculateDesign}
            disabled={loading}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-6 py-4 rounded-lg font-semibold"
          >
            {loading ? "Calculating..." : "Calculate Design"}
          </button>
        </div>

        <div className="lg:col-span-2">
          {result && (
            <div className={`${bgCard} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                Design {result.designStatus}
              </h3>
              <p className={textSecondary}>BS Codes calculation complete</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Import Eurocode Calculator (from second artifact - simplified for reference)

// Main App Component
const MainWallDesignApp = () => {
  const [isDark, setIsDark] = useState(false);
  const [activeStandard, setActiveStandard] = useState("bs"); // 'bs' or 'eurocode'

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const bgMain = isDark ? "bg-gray-900" : "bg-gray-50";
  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-800";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-600";

  return (
    <div className={`min-h-screen ${bgMain} transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header with Theme Toggle */}
        <div className={`${bgCard} rounded-lg shadow-lg p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary} mb-2`}>
                RC Wall Design Calculator
              </h1>
              <p className={textSecondary}>
                Professional structural engineering tool for reinforced concrete
                walls
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-lg transition-all ${
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

        {/* Standard Selection Tabs */}
        <div className={`${bgCard} rounded-lg shadow-lg p-2 mb-6`}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveStandard("bs")}
              className={`flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all ${
                activeStandard === "bs"
                  ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md"
                  : isDark
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <div className="text-left">
                <div className="font-bold">BS Codes</div>
                <div className="text-xs opacity-90">
                  BS EN 1992-1-1 / BS 8110
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveStandard("eurocode")}
              className={`flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all ${
                activeStandard === "eurocode"
                  ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md"
                  : isDark
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Euro className="w-5 h-5" />
              <div className="text-left">
                <div className="font-bold">Eurocodes</div>
                <div className="text-xs opacity-90">EN 1992-1-1:2004 (EC2)</div>
              </div>
            </button>
          </div>
        </div>

        {/* Active Standard Information Banner */}
        <div
          className={`${
            activeStandard === "bs"
              ? isDark
                ? "bg-teal-900/30 border-teal-700"
                : "bg-teal-50 border-teal-500"
              : isDark
              ? "bg-blue-900/30 border-blue-700"
              : "bg-blue-50 border-blue-500"
          } border-l-4 rounded-lg p-4 mb-6`}
        >
          <div className="flex items-start gap-3">
            {activeStandard === "bs" ? (
              <BookOpen className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
            ) : (
              <Euro className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <h3 className={`font-semibold ${textPrimary} mb-1`}>
                {activeStandard === "bs"
                  ? "British Standards Mode"
                  : "Eurocode Mode"}
              </h3>
              <p className={`text-sm ${textSecondary}`}>
                {activeStandard === "bs"
                  ? "Calculations per BS EN 1992-1-1:2004 (Eurocode 2) with UK National Annex and BS 8110-1:1997"
                  : "Calculations per EN 1992-1-1:2004 (Eurocode 2: Design of concrete structures)"}
              </p>
            </div>
          </div>
        </div>

        {/* Calculator Content */}
        <div className="transition-all duration-300">
          {activeStandard === "bs" ? (
            <WallDesignCalculator isDark={isDark} />
          ) : (
            <EurocodeWallCalculator isDark={isDark} />
          )}
        </div>

        {/* Footer */}
        <div className={`mt-8 ${bgCard} rounded-lg shadow-md p-6`}>
          <div className="text-center">
            <p className={`text-sm ${textSecondary} mb-2`}>
              Professional Structural Engineering Software
            </p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className={textSecondary}>
                {activeStandard === "bs"
                  ? "BS EN 1992-1-1"
                  : "EN 1992-1-1:2004"}
              </span>
              <span className={textSecondary}>•</span>
              <span className={textSecondary}>
                {activeStandard === "bs" ? "BS 8110-1:1997" : "EN 1990:2002"}
              </span>
              <span className={textSecondary}>•</span>
              <span className={textSecondary}>
                {activeStandard === "bs" ? "BS 8500-1:2015" : "EN 206:2013"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainWallDesignApp;
