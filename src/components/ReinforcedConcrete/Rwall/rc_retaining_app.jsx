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

// API Configuration
const API_BASE_URL = "http://localhost:8001";

function Retaining() {
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

  // Check API health and fetch constants on component mount
  useEffect(() => {
    checkApiHealth();
    fetchConstants();
  }, []); // Empty dependency array to run only on mount

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (response.ok) {
        setApiStatus("connected");
      } else {
        setApiStatus("error");
        setError("API health check failed");
      }
    } catch (err) {
      setApiStatus("error");
      setError("Unable to connect to API");
      console.error("API health check error:", err);
    }
  };

  const fetchConstants = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/constants`);
      if (response.ok) {
        const data = await response.json();
        setConstants(data);
      } else {
        setError("Failed to fetch constants");
      }
    } catch (err) {
      setError("Error fetching constants");
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
      // Validate inputs
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

      // Check for invalid numbers
      if (Object.values(payload).some((val) => val !== null && isNaN(val))) {
        throw new Error(
          "Invalid input values. Please check all numeric fields."
        );
      }

      const response = await fetch(`${API_BASE_URL}/design`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      console.error("Design error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calculator className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  RC Retaining Structure Designer
                </h1>
                <p className="text-sm text-gray-600">
                  BS 8110 | BS 8007 | BS 4449 Compliant
                </p>
              </div>
            </div>
            {/* API Status Indicator */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50">
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
              {apiStatus === "checking" && (
                <span className="text-gray-500">Checking...</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Alert */}
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
            {/* Structure Type Selection */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    aria-label={`Select ${type} structure`}
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
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Dimensions (m)
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="height"
                  >
                    Height
                  </label>
                  <input
                    id="height"
                    type="number"
                    name="height"
                    value={inputs.height}
                    onChange={handleInputChange}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-describedby="height-error"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="length"
                  >
                    Length
                  </label>
                  <input
                    id="length"
                    type="number"
                    name="length"
                    value={inputs.length}
                    onChange={handleInputChange}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="width"
                  >
                    Width
                  </label>
                  <input
                    id="width"
                    type="number"
                    name="width"
                    value={inputs.width}
                    onChange={handleInputChange}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {(structureType === "tank" || structureType === "pool") && (
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      htmlFor="waterDepth"
                    >
                      Water Depth (m)
                    </label>
                    <input
                      id="waterDepth"
                      type="number"
                      name="waterDepth"
                      value={inputs.waterDepth}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Member Thickness */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Member Thickness (mm)
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="wallThickness"
                  >
                    Wall Thickness
                  </label>
                  <input
                    id="wallThickness"
                    type="number"
                    name="wallThickness"
                    value={inputs.wallThickness}
                    onChange={handleInputChange}
                    step="25"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="baseThickness"
                  >
                    Base Thickness
                  </label>
                  <input
                    id="baseThickness"
                    type="number"
                    name="baseThickness"
                    value={inputs.baseThickness}
                    onChange={handleInputChange}
                    step="25"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Material Properties */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Materials (BS Codes)
              </h3>
              <div className="space-y-3">
                {structureType === "basement" && (
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      htmlFor="soilType"
                    >
                      Soil Type
                    </label>
                    <select
                      id="soilType"
                      name="soilType"
                      value={inputs.soilType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          <option value="Stiff Clay">Stiff Clay</option>
                          <option value="Firm Clay">Firm Clay</option>
                          <option value="Soft Clay">Soft Clay</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="concreteGrade"
                  >
                    Concrete Grade (BS 8110)
                  </label>
                  <select
                    id="concreteGrade"
                    name="concreteGrade"
                    value={inputs.concreteGrade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {constants?.concrete_grades?.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    )) || (
                      <>
                        <option value="C25/30">C25/30</option>
                        <option value="C28/35">C28/35</option>
                        <option value="C32/40">C32/40</option>
                        <option value="C35/45">C35/45</option>
                        <option value="C40/50">C40/50</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="steelGrade"
                  >
                    Steel Grade (BS 4449)
                  </label>
                  <select
                    id="steelGrade"
                    name="steelGrade"
                    value={inputs.steelGrade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Grade 500">Grade 500</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="exposure"
                  >
                    Exposure Class (BS 8007)
                  </label>
                  <select
                    id="exposure"
                    name="exposure"
                    value={inputs.exposure}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="severe">Severe</option>
                    <option value="moderate">Moderate</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={calculateDesign}
              disabled={loading || apiStatus !== "connected"}
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Calculate structure design"
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
            {loading ? (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <Calculator className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  Calculating...
                </h3>
                <p className="text-gray-500">
                  Please wait while the design is being processed
                </p>
              </div>
            ) : results ? (
              <>
                {/* Design Summary Banner */}
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
                    Complete structural analysis per British Standards
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Lateral Pressure
                    </h3>
                    <p className="text-3xl font-bold text-gray-800">
                      {results.pressures.lateral_pressure}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">kN/m²</p>
                    <p className="text-xs text-blue-600 mt-2 capitalize">
                      {results.pressures.pressure_type.replace("_", " ")}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-teal-600">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Design Moment
                    </h3>
                    <p className="text-3xl font-bold text-gray-800">
                      {results.moments.design_moment}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">kNm/m</p>
                    <p className="text-xs text-teal-600 mt-2">Wall bending</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-600">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Steel Reinforcement
                    </h3>
                    <p className="text-2xl font-bold text-gray-800">
                      {results.steel.notation}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Both faces</p>
                    <p className="text-xs text-green-600 mt-2">
                      Utilization:{" "}
                      {(results.steel.utilization_ratio * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between text-left"
                    aria-expanded={showDetails}
                    aria-controls="detailed-results"
                  >
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Detailed Design Output
                    </h2>
                    {showDetails ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  {showDetails && (
                    <div id="detailed-results" className="mt-6 space-y-6">
                      {/* Material Properties */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Material Properties (BS 8110)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Concrete Grade
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.concrete.grade}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Characteristic Strength (fck)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.concrete.fck} N/mm²
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Design Strength (fcd)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.concrete.fcd} N/mm²
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Cover (BS 8007)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.dimensions.cover} mm
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Elastic Modulus (Ecm)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.concrete.Ecm} N/mm²
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Effective Depth (Wall)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.dimensions.effective_depth_wall} mm
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pressure Analysis */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Pressure Analysis
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Lateral Pressure
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.pressures.lateral_pressure} kN/m²
                            </p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Base Pressure
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.pressures.base_pressure} kN/m²
                            </p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Design Moment
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.moments.design_moment} kNm/m
                            </p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Design Shear
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.moments.design_shear} kN/m
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Steel Design */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Steel Reinforcement Design
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Required Area (As,req)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.steel.required_area} mm²/m
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Minimum Area (As,min)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.steel.minimum_area} mm²/m
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Provided Area (As,prov)
                            </p>
                            <p className="font-semibold text-gray-800">
                              {results.steel.provided_area} mm²/m
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                              Bar Diameter
                            </p>
                            <p className="font-semibold text-gray-800">
                              H{results.steel.bar_diameter} mm
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">Bar Spacing</p>
                            <p className="font-semibold text-gray-800">
                              {results.steel.spacing} mm c/c
                            </p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded border-2 border-blue-300">
                            <p className="text-sm text-gray-600">
                              Final Configuration
                            </p>
                            <p className="font-bold text-blue-800 text-lg">
                              {results.steel.notation}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Design Checks */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Design Checks
                        </h3>
                        <div className="space-y-3">
                          {/* Crack Width Check */}
                          <div
                            className={`p-4 rounded-lg border-2 ${
                              results.checks.crack_width.passed
                                ? "bg-green-50 border-green-300"
                                : "bg-red-50 border-red-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {results.checks.crack_width.passed ? (
                                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                                    ✓
                                  </div>
                                ) : (
                                  <AlertCircle className="w-6 h-6 text-red-600" />
                                )}
                                <span className="font-semibold">
                                  Crack Width Check
                                </span>
                              </div>
                              <span
                                className={`font-bold ${
                                  results.checks.crack_width.passed
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {results.checks.crack_width.passed
                                  ? "PASS"
                                  : "FAIL"}
                              </span>
                            </div>
                            <p className="text-sm mt-2 ml-8 text-gray-700">
                              {results.checks.crack_width.description}
                            </p>
                            <p className="text-sm mt-1 ml-8 text-gray-600">
                              Actual: {results.checks.crack_width.value} mm |
                              Limit: {results.checks.crack_width.limit} mm
                            </p>
                          </div>

                          {/* Maximum Spacing Check */}
                          <div
                            className={`p-4 rounded-lg border-2 ${
                              results.checks.maximum_spacing.passed
                                ? "bg-green-50 border-green-300"
                                : "bg-red-50 border-red-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {results.checks.maximum_spacing.passed ? (
                                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                                    ✓
                                  </div>
                                ) : (
                                  <AlertCircle className="w-6 h-6 text-red-600" />
                                )}
                                <span className="font-semibold">
                                  Maximum Spacing
                                </span>
                              </div>
                              <span
                                className={`font-bold ${
                                  results.checks.maximum_spacing.passed
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {results.checks.maximum_spacing.passed
                                  ? "PASS"
                                  : "FAIL"}
                              </span>
                            </div>
                            <p className="text-sm mt-2 ml-8 text-gray-700">
                              {results.checks.maximum_spacing.description}
                            </p>
                            <p className="text-sm mt-1 ml-8 text-gray-600">
                              Actual: {results.checks.maximum_spacing.value} mm
                              | Maximum: {results.checks.maximum_spacing.limit}{" "}
                              mm
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Code References */}
                      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                        <h3 className="font-bold text-gray-800 mb-2">
                          Design Codes Applied
                        </h3>
                        <ul className="text-sm text-gray-700 space-y-1">
                          <li>
                            • <strong>BS 8110:</strong> Structural use of
                            concrete - Material properties and design methods
                          </li>
                          <li>
                            • <strong>BS 8007:</strong> Code of practice for
                            design of concrete structures for retaining aqueous
                            liquids
                          </li>
                          <li>
                            • <strong>BS 4449:</strong> Steel for the
                            reinforcement of concrete - Weldable reinforcing
                            steel
                          </li>
                          <li>
                            • <strong>Partial Safety Factors:</strong> γc = 1.5
                            (concrete), γs = 1.15 (steel)
                          </li>
                          <li>
                            • <strong>Load Factors:</strong> γDL = 1.4, γLL =
                            1.6, γEarth = 1.4, γWater = 1.4
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <Calculator className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  No Design Results Yet
                </h3>
                <p className="text-gray-500">
                  Enter the structure parameters and click "Design Structure" to
                  generate results
                </p>
                <p className="text-sm text-gray-400 mt-4">
                  Calculations performed via FastAPI backend
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          <p>
            <strong>Reinforced Concrete Retaining Structure Designer</strong> |
            BS Codes Compliant
          </p>
          <p className="mt-1">
            For professional use only. Results should be verified by a qualified
            structural engineer.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            FastAPI Backend | React Frontend | Full-Stack Engineering
            Application
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Retaining;
