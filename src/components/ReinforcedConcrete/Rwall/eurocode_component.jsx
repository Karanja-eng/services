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

const API_BASE_URL = "http://localhost:8001/retaining_eurocode";

const EurocodeDesigner = ({ isDark }) => {
  const [structureType, setStructureType] = useState("tank");
  const [inputs, setInputs] = useState({
    height: 4.0,
    length: 10.0,
    width: 8.0,
    wallThickness: 300,
    baseThickness: 400,
    waterDepth: 3.5,
    soilType: "Medium Dense Sand",
    concreteClass: "C30/37",
    steelClass: "B500B",
    exposureClass: "XC4",
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
      const response = await fetch(`${API_BASE_URL}/health`);
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
        concrete_class: inputs.concreteClass,
        steel_class: inputs.steelClass,
        exposure_class: inputs.exposureClass,
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
                  RC Structure Designer - EUROCODES
                </h1>
                <p className={`text-sm ${textSecondary}`}>
                  EN 1992-1-1 | EN 1992-3 | EN 1997-1 | EN 1990
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
            {/* Structure Type */}
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

            {/* Dimensions */}
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

            {/* Member Thickness */}
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

            {/* Materials */}
            <div className={`${bgCard} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${textPrimary} mb-4`}>
                Materials (Eurocodes)
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
                          <option value="Dense Gravel">Dense Gravel</option>
                          <option value="Dense Sand">Dense Sand</option>
                          <option value="Medium Dense Sand">
                            Medium Dense Sand
                          </option>
                          <option value="Loose Sand">Loose Sand</option>
                          <option value="Stiff Clay">Stiff Clay</option>
                          <option value="Firm Clay">Firm Clay</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Concrete Class (EN 1992-1-1)
                  </label>
                  <select
                    name="concreteClass"
                    value={inputs.concreteClass}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  >
                    {constants?.concrete_classes?.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    )) || (
                      <>
                        <option value="C20/25">C20/25</option>
                        <option value="C25/30">C25/30</option>
                        <option value="C30/37">C30/37</option>
                        <option value="C35/45">C35/45</option>
                        <option value="C40/50">C40/50</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Steel Class (EN 1992-1-1)
                  </label>
                  <select
                    name="steelClass"
                    value={inputs.steelClass}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="B500A">B500A</option>
                    <option value="B500B">B500B</option>
                    <option value="B500C">B500C</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Exposure Class (EN 1992-1-1)
                  </label>
                  <select
                    name="exposureClass"
                    value={inputs.exposureClass}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${inputBg} ${inputText} rounded-lg focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="XC1">XC1 - Dry/Permanently Wet</option>
                    <option value="XC2">XC2 - Wet, Rarely Dry</option>
                    <option value="XC3">XC3 - Moderate Humidity</option>
                    <option value="XC4">XC4 - Cyclic Wet/Dry</option>
                    <option value="XD1">XD1 - Water Tightness</option>
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

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {results ? (
              <>
                {/* Summary Banner */}
                <div
                  className={`rounded-lg shadow-lg p-6 ${
                    results.design_summary.includes("COMPLIES")
                      ? "bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300"
                      : "bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300"
                  }`}
                >
                  <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                    {results.design_summary.includes("COMPLIES") ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    )}
                    {results.design_summary}
                  </h2>
                  <p className="text-gray-600">{results.eurocode_compliance}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`${bgCard} rounded-lg shadow-lg p-6 border-l-4 border-blue-600`}
                  >
                    <h3 className={`text-sm font-medium ${textSecondary} mb-2`}>
                      Design Pressure
                    </h3>
                    <p className={`text-3xl font-bold ${textPrimary}`}>
                      {results.pressures.design_pressure}
                    </p>
                    <p className={`text-xs ${textSecondary} mt-1`}>kN/m²</p>
                    <p className="text-xs text-blue-600 mt-2 capitalize">
                      {results.pressures.pressure_type.replace("_", " ")}
                    </p>
                  </div>
                  <div
                    className={`${bgCard} rounded-lg shadow-lg p-6 border-l-4 border-teal-600`}
                  >
                    <h3 className={`text-sm font-medium ${textSecondary} mb-2`}>
                      Design Moment (MEd)
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
                    <p className="text-xs text-green-600 mt-2">
                      σs: {results.steel.stress_check_sigma_s} MPa
                    </p>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className={`${bgCard} rounded-lg shadow-lg p-6`}>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h2
                      className={`text-xl font-bold ${textPrimary} flex items-center gap-2`}
                    >
                      <FileText className="w-5 h-5 text-blue-600" />
                      Detailed Eurocode Analysis
                    </h2>
                    {showDetails ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  {showDetails && (
                    <div className="mt-6 space-y-6">
                      {/* Material Properties */}
                      <div>
                        <h3
                          className={`font-bold ${textPrimary} mb-3 pb-2 border-b-2 ${borderColor}`}
                        >
                          Material Properties
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              Concrete Class
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.concrete.concrete_class}
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              fck (Characteristic)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.concrete.fck} MPa
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              fcd (Design)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.concrete.fcd} MPa
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              fctm (Tensile)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.concrete.fctm} MPa
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              Ecm (Elastic Modulus)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.concrete.Ecm} MPa
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              Nominal Cover (cnom)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.dimensions.cover_nominal} mm
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Steel Design */}
                      <div>
                        <h3
                          className={`font-bold ${textPrimary} mb-3 pb-2 border-b-2 ${borderColor}`}
                        >
                          Steel Reinforcement
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              As,req (Required)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.steel.required_area} mm²/m
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              As,min (Minimum)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.steel.minimum_area} mm²/m
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-gray-700" : "bg-gray-50"
                            } p-3 rounded`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              As,prov (Provided)
                            </p>
                            <p className={`font-semibold ${textPrimary}`}>
                              {results.steel.provided_area} mm²/m
                            </p>
                          </div>
                          <div
                            className={`${
                              isDark ? "bg-blue-900" : "bg-blue-50"
                            } p-3 rounded border-2 border-blue-300`}
                          >
                            <p className={`text-sm ${textSecondary}`}>
                              Bar Configuration
                            </p>
                            <p className="font-bold text-blue-600 text-lg">
                              {results.steel.notation}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Design Checks */}
                      <div>
                        <h3
                          className={`font-bold ${textPrimary} mb-3 pb-2 border-b-2 ${borderColor}`}
                        >
                          Eurocode Compliance Checks
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(results.checks).map(
                            ([key, check]) => (
                              <div
                                key={key}
                                className={`p-4 rounded-lg border-2 ${
                                  check.passed
                                    ? "bg-green-50 border-green-300"
                                    : "bg-red-50 border-red-300"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {check.passed ? (
                                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                                        ✓
                                      </div>
                                    ) : (
                                      <AlertCircle className="w-6 h-6 text-red-600" />
                                    )}
                                    <span className="font-semibold text-gray-800 capitalize">
                                      {key.replace("_", " ")}
                                    </span>
                                  </div>
                                  <span
                                    className={`font-bold ${
                                      check.passed
                                        ? "text-green-700"
                                        : "text-red-700"
                                    }`}
                                  >
                                    {check.passed ? "PASS" : "FAIL"}
                                  </span>
                                </div>
                                <p className="text-sm mt-2 ml-8 text-gray-700">
                                  {check.description}
                                </p>
                                <p className="text-sm mt-1 ml-8 text-gray-600">
                                  Value: {check.value} | Limit: {check.limit}
                                </p>
                                <p className="text-xs mt-1 ml-8 text-blue-600 font-medium">
                                  {check.eurocode_reference}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Eurocode References */}
                      <div
                        className={`${
                          isDark ? "bg-blue-900" : "bg-blue-50"
                        } p-4 rounded-lg border-2 border-blue-200`}
                      >
                        <h3 className={`font-bold ${textPrimary} mb-2`}>
                          Applied Eurocodes
                        </h3>
                        <ul className={`text-sm ${textSecondary} space-y-1`}>
                          <li>
                            • <strong>EN 1992-1-1:</strong> Design of concrete
                            structures - General rules
                          </li>
                          <li>
                            • <strong>EN 1992-3:</strong> Liquid retaining and
                            containment structures
                          </li>
                          <li>
                            • <strong>EN 1997-1:</strong> Geotechnical design -
                            General rules
                          </li>
                          <li>
                            • <strong>EN 1990:</strong> Basis of structural
                            design
                          </li>
                          <li>
                            • <strong>Partial Factors:</strong> γc = 1.5, γs =
                            1.15, γG = 1.35, γQ = 1.5
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
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
                <p
                  className={`text-sm ${
                    isDark ? "text-gray-500" : "text-gray-400"
                  } mt-4`}
                >
                  Eurocode calculations via FastAPI
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`${bgCard} border-t ${borderColor} mt-12 py-6`}>
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p className={textPrimary}>
            <strong>RC Structure Designer - EUROCODES</strong>
          </p>
          <p className={`mt-1 ${textSecondary}`}>
            For professional use only. Verify with qualified engineer.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EurocodeDesigner;
