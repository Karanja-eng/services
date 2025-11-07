import React, { useState, useEffect } from "react";
import {
  Calculator,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Server,
  Loader2,
} from "lucide-react";

// Note: In production, replace with your actual backend URL
const API_BASE_URL = "http://localhost:8001";

function StairApp() {
  const [stairType, setStairType] = useState("supported");
  const [apiStatus, setApiStatus] = useState("checking");
  const [inputs, setInputs] = useState({
    span: 3.0,
    width: 1.2,
    waist_thickness: 150,
    riser_height: 175,
    tread_length: 250,
    num_risers: 14,
    concrete_grade: "C30/37",
    steel_grade: "Grade 460",
    exposure: "Moderate",
    live_load: 3.0,
    finishes_load: 1.5,
    cover: 35,
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check API health on mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setApiStatus("online");
      } else {
        setApiStatus("offline");
      }
    } catch (err) {
      setApiStatus("offline");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: isNaN(value) ? value : parseFloat(value) || value,
    }));
  };

  const calculateDesign = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        stair_type: stairType,
        span: parseFloat(inputs.span),
        width: parseFloat(inputs.width),
        waist_thickness: parseInt(inputs.waist_thickness),
        riser_height: parseInt(inputs.riser_height),
        tread_length: parseInt(inputs.tread_length),
        num_risers: parseInt(inputs.num_risers),
        concrete_grade: inputs.concrete_grade,
        steel_grade: inputs.steel_grade,
        exposure: inputs.exposure,
        cover: parseInt(inputs.cover),
        live_load: parseFloat(inputs.live_load),
        finishes_load: parseFloat(inputs.finishes_load),
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/design`, {
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
    } catch (err) {
      setError(err.message);
      console.error("Design error:", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!results) return;

    const report = `
REINFORCED CONCRETE STAIR DESIGN CALCULATION
BS 8110-1:1997 Compliance Report
=============================================

PROJECT INFORMATION
-------------------
Stair Type: ${results.input_summary.stair_type.toUpperCase()}
Calculation Date: ${new Date(results.calculation_timestamp).toLocaleString()}

DESIGN PARAMETERS
-----------------
Span: ${results.input_summary.span_m} m
Width: ${results.input_summary.width_m} m
Waist Thickness: ${results.input_summary.waist_mm} mm
Concrete Grade: ${results.input_summary.concrete_grade}
Steel Grade: ${results.input_summary.steel_grade}
Exposure Class: ${results.input_summary.exposure_class}

LOADING SUMMARY (per meter width)
----------------------------------
Self Weight: ${results.loading.self_weight} kN/m²
Dead Load: ${results.loading.dead_load} kN/m²
Live Load: ${results.loading.live_load} kN/m²
Ultimate Load: ${results.loading.ultimate_load} kN/m²
  (Dead Load Factor: ${results.loading.load_factor_dead})
  (Live Load Factor: ${results.loading.load_factor_live})

DESIGN FORCES
-------------
Bending Moment: ${results.forces.moment} kNm
Shear Force: ${results.forces.shear} kN
Moment per meter: ${results.forces.moment_per_meter} kNm/m
Shear per meter: ${results.forces.shear_per_meter} kN/m

FLEXURAL REINFORCEMENT DESIGN
------------------------------
Effective Depth: ${results.steel_design.effective_depth} mm
K Factor: ${results.steel_design.K_factor}
Lever Arm: ${results.steel_design.lever_arm} mm
Required Steel Area: ${results.steel_design.As_required} mm²
Minimum Steel Area: ${results.steel_design.As_minimum} mm²
Provided Steel Area: ${results.steel_design.As_provided} mm²
Steel Percentage: ${results.steel_design.steel_percentage}%

Main Reinforcement: ${results.steel_design.main_reinforcement}
Distribution Steel: ${results.steel_design.distribution_reinforcement}

SHEAR DESIGN
------------
Applied Shear Stress (v): ${results.shear_design.applied_shear_stress} N/mm²
Concrete Shear Capacity (vc): ${
      results.shear_design.concrete_shear_capacity
    } N/mm²
Maximum Shear Capacity: ${results.shear_design.max_shear_capacity} N/mm²
Shear Adequate: ${results.shear_design.shear_adequate ? "YES" : "NO"}
Shear Links Required: ${
      results.shear_design.shear_reinforcement_required ? "YES" : "NO"
    }

DESIGN VERIFICATION CHECKS
---------------------------
✓ Deflection Check: ${results.checks.deflection_check ? "PASS" : "FAIL"}
  (Actual: ${results.checks.deflection_ratio}, Limit: ${
      results.checks.deflection_limit
    })
✓ Bar Spacing: ${results.checks.spacing_check ? "PASS" : "FAIL"}
✓ Minimum Steel: ${results.checks.minimum_steel_check ? "PASS" : "FAIL"}
✓ Shear Capacity: ${results.checks.shear_check ? "PASS" : "FAIL"}
✓ Cover Requirement: ${results.checks.cover_check ? "PASS" : "FAIL"}

${
  results.warnings.length > 0
    ? `
DESIGN WARNINGS
---------------
${results.warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}
`
    : ""
}

DESIGN STATUS
-------------
${results.design_status}

${
  results.checks.all_checks_passed
    ? "The design is SATISFACTORY and complies with BS 8110-1:1997 requirements."
    : "The design REQUIRES REVISION. Please review failed checks and warnings."
}

---
Generated by RC Stair Designer v1.0
Professional Structural Engineering Software
BS 8110-1:1997 Compliant
`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RC_Stair_Design_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-200 dark:border-gray-600 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 p-3 rounded-xl shadow-md">
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                  RC Stair Designer Pro
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  BS 8110-1:1997 Compliant Design Tool
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-gray-600 dark:text-gray-400">
                <p className="text-sm">Professional Engineering Software</p>
                <p className="text-xs">British Standard Code</p>
              </div>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  apiStatus === "online"
                    ? "bg-green-50 dark:bg-green-900 border-green-500 dark:border-green-400"
                    : apiStatus === "offline"
                    ? "bg-red-50 dark:bg-red-900 border-red-500 dark:border-red-400"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                }`}
              >
                <Server
                  className={`w-4 h-4 ${
                    apiStatus === "online"
                      ? "text-green-600 dark:text-green-400"
                      : apiStatus === "offline"
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    apiStatus === "online"
                      ? "text-green-600 dark:text-green-400"
                      : apiStatus === "offline"
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  API{" "}
                  {apiStatus === "online"
                    ? "Connected"
                    : apiStatus === "offline"
                    ? "Offline"
                    : "Checking..."}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-500 dark:border-red-400 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-1">
                Calculation Error
              </h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-600 shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Design Parameters
            </h2>

            {/* Stair Type Selection */}
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-3">
                Stair Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setStairType("supported")}
                  className={`p-4 rounded-xl font-medium transition-all ${
                    stairType === "supported"
                      ? "bg-blue-500 text-white shadow-md dark:bg-blue-400 dark:text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  Simply Supported
                </button>
                <button
                  onClick={() => setStairType("cantilever")}
                  className={`p-4 rounded-xl font-medium transition-all ${
                    stairType === "cantilever"
                      ? "bg-blue-500 text-white shadow-md dark:bg-blue-400 dark:text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  Cantilever
                </button>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto pr-2 space-y-6">
              {/* Geometry Inputs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Geometry
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Span (m)
                    </label>
                    <input
                      type="number"
                      name="span"
                      value={inputs.span}
                      onChange={handleInputChange}
                      step="0.1"
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Width (m)
                    </label>
                    <input
                      type="number"
                      name="width"
                      value={inputs.width}
                      onChange={handleInputChange}
                      step="0.1"
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Waist (mm)
                    </label>
                    <input
                      type="number"
                      name="waist_thickness"
                      value={inputs.waist_thickness}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Riser (mm)
                    </label>
                    <input
                      type="number"
                      name="riser_height"
                      value={inputs.riser_height}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Tread (mm)
                    </label>
                    <input
                      type="number"
                      name="tread_length"
                      value={inputs.tread_length}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                    Number of Risers
                  </label>
                  <input
                    type="number"
                    name="num_risers"
                    value={inputs.num_risers}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Material Properties */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Materials
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Concrete Grade
                    </label>
                    <select
                      name="concrete_grade"
                      value={inputs.concrete_grade}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option
                        value="C25/30"
                        className="bg-white dark:bg-gray-900"
                      >
                        C25/30
                      </option>
                      <option
                        value="C30/37"
                        className="bg-white dark:bg-gray-900"
                      >
                        C30/37
                      </option>
                      <option
                        value="C35/45"
                        className="bg-white dark:bg-gray-900"
                      >
                        C35/45
                      </option>
                      <option
                        value="C40/50"
                        className="bg-white dark:bg-gray-900"
                      >
                        C40/50
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Steel Grade
                    </label>
                    <select
                      name="steel_grade"
                      value={inputs.steel_grade}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option
                        value="Grade 460"
                        className="bg-white dark:bg-gray-900"
                      >
                        Grade 460
                      </option>
                      <option
                        value="Grade 500"
                        className="bg-white dark:bg-gray-900"
                      >
                        Grade 500
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Exposure Class
                    </label>
                    <select
                      name="exposure"
                      value={inputs.exposure}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option
                        value="Mild"
                        className="bg-white dark:bg-gray-900"
                      >
                        Mild
                      </option>
                      <option
                        value="Moderate"
                        className="bg-white dark:bg-gray-900"
                      >
                        Moderate
                      </option>
                      <option
                        value="Severe"
                        className="bg-white dark:bg-gray-900"
                      >
                        Severe
                      </option>
                      <option
                        value="Very Severe"
                        className="bg-white dark:bg-gray-900"
                      >
                        Very Severe
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Cover (mm)
                    </label>
                    <input
                      type="number"
                      name="cover"
                      value={inputs.cover}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Loading */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Loading (kN/m²)
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Live Load
                    </label>
                    <input
                      type="number"
                      name="live_load"
                      value={inputs.live_load}
                      onChange={handleInputChange}
                      step="0.5"
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">
                      Finishes Load
                    </label>
                    <input
                      type="number"
                      name="finishes_load"
                      value={inputs.finishes_load}
                      onChange={handleInputChange}
                      step="0.5"
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={calculateDesign}
              disabled={loading || apiStatus === "offline"}
              className="w-full mt-6 bg-blue-500 dark:bg-blue-400 hover:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5" />
                  Calculate Design
                </>
              )}
            </button>

            {apiStatus === "offline" && (
              <p className="text-red-600 dark:text-red-400 text-sm text-center mt-2">
                Backend API is offline. Please start the FastAPI server.
              </p>
            )}
          </div>

          {/* Results Panel */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-600 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                Design Results
              </h2>
              {results && (
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 bg-green-500 dark:bg-green-400 hover:bg-green-600 dark:hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-all shadow-md"
                >
                  <Download className="w-4 h-4" />
                  Report
                </button>
              )}
            </div>

            {!results ? (
              <div className="flex flex-col items-center justify-center h-96 text-gray-600 dark:text-gray-400">
                <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg text-center">
                  Enter design parameters and click Calculate
                  <br />
                  to see comprehensive results
                </p>
              </div>
            ) : (
              <div className="max-h-[700px] overflow-y-auto pr-2 space-y-6">
                {/* Loading Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-blue-500 dark:border-blue-400">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-500 dark:bg-blue-400 rounded"></div>
                    Loading Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-700 dark:text-gray-300">
                      Self Weight:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.loading.self_weight} kN/m²
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Dead Load:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.loading.dead_load} kN/m²
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Live Load:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.loading.live_load} kN/m²
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 font-bold">
                      Ultimate Load:
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 font-bold">
                      {results.loading.ultimate_load} kN/m²
                    </div>
                  </div>
                </div>

                {/* Design Forces */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-blue-500 dark:border-blue-400">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-500 dark:bg-blue-400 rounded"></div>
                    Design Forces
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-700 dark:text-gray-300">
                      Bending Moment:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.forces.moment} kNm
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Shear Force:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.forces.shear} kN
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Moment/meter:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.forces.moment_per_meter} kNm/m
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Shear/meter:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.forces.shear_per_meter} kN/m
                    </div>
                  </div>
                </div>

                {/* Reinforcement */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-blue-500 dark:border-blue-400">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-500 dark:bg-blue-400 rounded"></div>
                    Reinforcement Design
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-gray-700 dark:text-gray-300">
                        Effective Depth:
                      </div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {results.steel_design.effective_depth} mm
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        K Factor:
                      </div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {results.steel_design.K_factor}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Lever Arm:
                      </div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {results.steel_design.lever_arm} mm
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Required A<sub>s</sub>:
                      </div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {results.steel_design.As_required.toFixed(1)} mm²
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Provided A<sub>s</sub>:
                      </div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {results.steel_design.As_provided.toFixed(1)} mm²
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Steel %:
                      </div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {results.steel_design.steel_percentage}%
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-blue-500 dark:border-blue-400">
                        <p className="text-gray-800 dark:text-gray-200 font-bold mb-1">
                          Main Reinforcement:
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 text-lg">
                          {results.steel_design.main_reinforcement}
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-blue-500 dark:border-blue-400">
                        <p className="text-gray-800 dark:text-gray-200 font-bold mb-1">
                          Distribution Steel:
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 text-lg">
                          {results.steel_design.distribution_reinforcement}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shear Design */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-blue-500 dark:border-blue-400">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-500 dark:bg-blue-400 rounded"></div>
                    Shear Design
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-700 dark:text-gray-300">
                      Applied Stress (v):
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.shear_design.applied_shear_stress} N/mm²
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Concrete Capacity (v<sub>c</sub>):
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.shear_design.concrete_shear_capacity} N/mm²
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Max Capacity:
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {results.shear_design.max_shear_capacity} N/mm²
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Shear Links:
                    </div>
                    <div
                      className={
                        results.shear_design.shear_reinforcement_required
                          ? "text-red-600 dark:text-red-400 font-bold"
                          : "text-green-600 dark:text-green-400 font-bold"
                      }
                    >
                      {results.shear_design.shear_reinforcement_required
                        ? "REQUIRED"
                        : "NOT REQUIRED"}
                    </div>
                  </div>
                </div>

                {/* Design Checks */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-green-500 dark:bg-green-400 rounded"></div>
                    Design Verification
                  </h3>
                  <div className="space-y-2">
                    {[
                      {
                        name: "Deflection Check",
                        pass: results.checks.deflection_check,
                        detail: `${results.checks.deflection_ratio} ≤ ${results.checks.deflection_limit}`,
                      },
                      {
                        name: "Bar Spacing",
                        pass: results.checks.spacing_check,
                      },
                      {
                        name: "Minimum Steel",
                        pass: results.checks.minimum_steel_check,
                      },
                      {
                        name: "Shear Capacity",
                        pass: results.checks.shear_check,
                      },
                      {
                        name: "Cover Requirement",
                        pass: results.checks.cover_check,
                      },
                    ].map((check, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          check.pass
                            ? "bg-green-50 dark:bg-green-900 border-green-500 dark:border-green-400"
                            : "bg-red-50 dark:bg-red-900 border-red-500 dark:border-red-400"
                        }`}
                      >
                        <div>
                          <span className="text-gray-800 dark:text-gray-200 text-sm font-medium">
                            {check.name}
                          </span>
                          {check.detail && (
                            <span className="text-gray-600 dark:text-gray-400 text-xs ml-2">
                              ({check.detail})
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-bold text-sm ${
                            check.pass
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {check.pass ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warnings */}
                {results.warnings && results.warnings.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-red-500 dark:border-red-400">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      Design Warnings
                    </h3>
                    <ul className="space-y-1">
                      {results.warnings.map((warning, idx) => (
                        <li
                          key={idx}
                          className="text-red-600 dark:text-red-400 text-sm"
                        >
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Overall Status */}
                <div
                  className={`rounded-xl p-4 border-2 ${
                    results.checks.all_checks_passed
                      ? "bg-green-50 dark:bg-green-900 border-green-500 dark:border-green-400"
                      : "bg-red-50 dark:bg-red-900 border-red-500 dark:border-red-400"
                  }`}
                >
                  <p className="text-gray-800 dark:text-gray-200 font-bold text-center text-lg">
                    {results.checks.all_checks_passed
                      ? "✓ DESIGN SATISFACTORY"
                      : "⚠ DESIGN REQUIRES REVISION"}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 text-sm text-center mt-1">
                    {results.design_status}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 dark:text-gray-400 text-sm space-y-1">
          <p>
            Design calculations based on BS 8110-1:1997 | For professional use
            by qualified engineers
          </p>
          <p className="text-xs">
            © 2024 RC Stair Designer Pro | Structural Engineering Software
          </p>
        </div>
      </div>
    </div>
  );
}

export default StairApp;
