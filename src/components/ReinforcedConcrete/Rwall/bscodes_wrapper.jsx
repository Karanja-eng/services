import React, { useState, useEffect } from "react";
import {
  Calculator,
  FileText,
  Waves,
  Home,
  Box,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Server,
  CheckCircle,
  XCircle,
} from "lucide-react";
import RetainingWall3DVisualization from "../../components/retaining_wall_3d_helper";

const API_BASE_URL = "http://localhost:8001/retaining_backend";

const BSCodesApp = ({ isDark }) => {
  const [structureType, setStructureType] = useState("tank");
  const [inputs, setInputs] = useState({
    height: 4.0,
    length: 10.0,
    width: 8.0,
    wallThickness: 300,
    baseThickness: 400,
    waterDepth: 3.5,
    soilType: "Medium Sand",
    concreteGrade: "C32/40",
    steelGrade: "Grade 500",
    exposure: "severe",
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [constants, setConstants] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkApiHealth();
    fetchConstants();
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "POST",
      });
      if (response.ok) {
        setApiStatus("connected");
      } else {
        setApiStatus("error");
      }
    } catch (err) {
      setApiStatus("error");
    }
  };

  const fetchConstants = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/constants`);
      if (response.ok) {
        const data = await response.json();
        setConstants(data);
      }
    } catch (err) {
      console.error("Failed to fetch constants:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const calculateDesign = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        structure_type: structureType,
        height: parseFloat(inputs.height),
        length: parseFloat(inputs.length),
        width: parseFloat(inputs.width),
        wall_thickness: parseFloat(inputs.wallThickness),
        base_thickness: parseFloat(inputs.baseThickness),
        water_depth:
          structureType !== "basement" ? parseFloat(inputs.waterDepth) : null,
        soil_type: inputs.soilType,
        concrete_grade: inputs.concreteGrade,
        steel_grade: inputs.steelGrade,
        exposure: inputs.exposure,
      };

      const response = await fetch(`${API_BASE_URL}/design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Design calculation failed");
      }

      const data = await response.json();
      setResults(data);
      setShowDetails(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Theme classes
  const bgPrimary = isDark
    ? "bg-gray-900"
    : "bg-gradient-to-br from-gray-50 to-gray-100";
  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-800";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const borderColor = isDark ? "border-gray-700" : "border-gray-200";
  const inputBg = isDark
    ? "bg-gray-700 border-gray-600"
    : "bg-white border-gray-300";
  const inputText = isDark ? "text-gray-100" : "text-gray-900";

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <header className={`${bgCard} shadow-md border-b-4 border-blue-600`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calculator className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className={`text-3xl font-bold ${textPrimary}`}>
                  RC Retaining Structure Designer
                </h1>
                <p className={`text-sm ${textSecondary}`}>
                  BS 8110 | BS 8007 | BS 4449 Compliant
                </p>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isDark ? "bg-gray-700" : "bg-gray-50"
              }`}
            >
              <Server className="w-5 h-5" />
              <span className="text-sm font-medium">API:</span>
              {apiStatus === "connected" && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              )}
              {apiStatus === "error" && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  Disconnected
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800">Design Error</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className={`${bgCard} rounded-lg shadow-lg p-6`}>
              <h2
                className={`text-xl font-bold ${textPrimary} mb-4 flex items-center gap-2`}
              >
                <Box className="w-5 h-5 text-blue-600" />
                Structure Type
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {["tank", "pool", "basement"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setStructureType(type)}
                    className={`p-3 rounded-lg font-medium transition-all flex flex-col items-center gap-2 ${
                      structureType === type
                        ? "bg-gradient-to-br from-blue-600 to-teal-600 text-white shadow-lg scale-105"
                        : isDark
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type === "tank" && <Waves className="w-6 h-6" />}
                    {type === "pool" && <Waves className="w-6 h-6" />}
                    {type === "basement" && <Home className="w-6 h-6" />}
                    <span className="text-xs capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={`${bgCard} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${textPrimary} mb-4`}>
                Dimensions (m)
              </h3>
              <div className="space-y-3">
                {["height", "length", "width"].map((field) => (
                  <div key={field}>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-1 capitalize`}
                    >
                      {field}
                    </label>
                    <input
                      type="number"
                      name={field}
                      value={inputs[field]}
                      onChange={handleInputChange}
                      step="0.1"
                      className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                ))}
                {(structureType === "tank" || structureType === "pool") && (
                  <div>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-1`}
                    >
                      Water Depth (m)
                    </label>
                    <input
                      type="number"
                      name="waterDepth"
                      value={inputs.waterDepth}
                      onChange={handleInputChange}
                      step="0.1"
                      className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className={`${bgCard} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${textPrimary} mb-4`}>
                Member Thickness (mm)
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Wall Thickness
                  </label>
                  <input
                    type="number"
                    name="wallThickness"
                    value={inputs.wallThickness}
                    onChange={handleInputChange}
                    step="25"
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Base Thickness
                  </label>
                  <input
                    type="number"
                    name="baseThickness"
                    value={inputs.baseThickness}
                    onChange={handleInputChange}
                    step="25"
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            </div>

            <div className={`${bgCard} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${textPrimary} mb-4`}>
                Materials (BS Codes)
              </h3>
              <div className="space-y-3">
                {structureType === "basement" && (
                  <div>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-1`}
                    >
                      Soil Type
                    </label>
                    <select
                      name="soilType"
                      value={inputs.soilType}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                    >
                      {constants?.soil_types?.map((soil) => (
                        <option key={soil} value={soil}>
                          {soil}
                        </option>
                      )) || (
                        <>
                          <option value="Dense Sand">Dense Sand</option>
                          <option value="Medium Sand">Medium Sand</option>
                          <option value="Loose Sand">Loose Sand</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Concrete Grade (BS 8110)
                  </label>
                  <select
                    name="concreteGrade"
                    value={inputs.concreteGrade}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  >
                    {constants?.concrete_grades?.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    )) || <option value="C32/40">C32/40</option>}
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Steel Grade (BS 4449)
                  </label>
                  <select
                    name="steelGrade"
                    value={inputs.steelGrade}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="Grade 500">Grade 500</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Exposure Class (BS 8007)
                  </label>
                  <select
                    name="exposure"
                    value={inputs.exposure}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="severe">Severe</option>
                    <option value="moderate">Moderate</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={calculateDesign}
              disabled={loading || apiStatus !== "connected"}
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Calculating..."
                : apiStatus !== "connected"
                ? "API Disconnected"
                : "Design Structure"}
            </button>
          </div>

          {/* Results Panel - Similar structure as Eurocode but adapted for BS results */}
          <div className="lg:col-span-2 space-y-6">
            {results ? (
              <>
                <div
                  className={`rounded-lg shadow-lg p-6 ${
                    results.design_summary.includes("ACCEPTABLE")
                      ? "bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300"
                      : "bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300"
                  }`}
                >
                  <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                    {results.design_summary.includes("ACCEPTABLE") ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    )}
                    {results.design_summary}
                  </h2>
                  <p className="text-gray-600">
                    British Standards Compliance Analysis
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`${bgCard} rounded-lg shadow-lg p-6 border-l-4 border-blue-600`}
                  >
                    <h3 className={`text-sm font-medium ${textSecondary} mb-2`}>
                      Lateral Pressure
                    </h3>
                    <p className={`text-3xl font-bold ${textPrimary}`}>
                      {results.pressures.lateral_pressure}
                    </p>
                    <p className={`text-xs ${textSecondary} mt-1`}>kN/m²</p>
                  </div>
                  <div
                    className={`${bgCard} rounded-lg shadow-lg p-6 border-l-4 border-teal-600`}
                  >
                    <h3 className={`text-sm font-medium ${textSecondary} mb-2`}>
                      Design Moment
                    </h3>
                    <p className={`text-3xl font-bold ${textPrimary}`}>
                      {results.moments.design_moment}
                    </p>
                    <p className={`text-xs ${textSecondary} mt-1`}>kNm/m</p>
                  </div>
                  <div
                    className={`${bgCard} rounded-lg shadow-lg p-6 border-l-4 border-green-600`}
                  >
                    <h3 className={`text-sm font-medium ${textSecondary} mb-2`}>
                      Steel Reinforcement
                    </h3>
                    <p className={`text-2xl font-bold ${textPrimary}`}>
                      {results.steel.notation}
                    </p>
                    <p className={`text-xs ${textSecondary} mt-1`}>
                      Both faces
                    </p>
                  </div>
                </div>

                {/* 3D Visualization Component */}
                <RetainingWall3DVisualization
                  inputs={inputs}
                  results={results}
                  theme={isDark ? "dark" : "light"}
                  wallType="cantilever"
                />

                {/* Detailed results section would go here - similar to previous implementation */}
              </>
            ) : (
              <div
                className={`${bgCard} rounded-lg shadow-lg p-12 text-center`}
              >
                <Calculator
                  className={`w-16 h-16 ${
                    isDark ? "text-gray-600" : "text-gray-300"
                  } mx-auto mb-4`}
                />
                <h3 className={`text-xl font-semibold ${textSecondary} mb-2`}>
                  No Design Results Yet
                </h3>
                <p className={textSecondary}>
                  Enter parameters and click "Design Structure"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BSCodesApp;
