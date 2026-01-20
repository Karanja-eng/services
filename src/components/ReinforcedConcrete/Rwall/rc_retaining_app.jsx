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
  Monitor,
  Download,
  Maximize2,

} from "lucide-react";
import { useNavigate } from "react-router-dom";
import RetainingWallVisualizer, { getRetainingCADPrimitives } from "./Retaining_visualiser";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";

// API Configuration
const API_BASE_URL = "http://localhost:8001/retaining_bs";

function Retaining({ isDark }) {
  const navigate = useNavigate();
  const [wallType, setWallType] = useState("cantilever");
  const [inputs, setInputs] = useState({
    height: 4.0,
    length: 10.0,
    wall_thickness: 300,
    base_thickness: 400,
    base_width: 2.5,
    toe_width: 0.8,
    heel_width: 1.4,
    counterfort_spacing: 3.0,
    counterfort_thickness: 300,
    surcharge: 10,
    safe_bearing_capacity: 200,
    water_table_depth: 4.0,
    soil_type: "Medium Sand",
    foundation_soil: "Medium Sand",
    concrete_grade: "C30/37",
    steel_grade: "Grade 460",
    exposure: "moderate",
    has_nib: false,
    nib_depth: 0.5,
    auto_size: true,
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");

  // Visualisation State
  const [show2DDrawer, setShow2DDrawer] = useState(false);
  const [show3DViewer, setShow3DViewer] = useState(false);

  const downloadDXF = async () => {
    if (!results) return;

    try {
      const filename = `retaining_wall_${wallType}_${new Date().toISOString().slice(0, 10)}.dxf`;

      // Use the correct endpoint on New_retaining router
      const response = await fetch(`${API_BASE_URL}/generate-dxf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(results),
      });

      if (!response.ok) throw new Error("DXF export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("DXF Export Error:", err);
      alert("Failed to export DXF. See console for details.");
    }
  };
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
    const { name, value, type, checked } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const calculateDesign = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        wall_type: wallType,
        height: parseFloat(inputs.height),
        length: parseFloat(inputs.length),
        wall_thickness: parseFloat(inputs.wall_thickness),
        base_thickness: parseFloat(inputs.base_thickness),
        base_width: parseFloat(inputs.base_width),
        toe_width: parseFloat(inputs.toe_width),
        heel_width: parseFloat(inputs.heel_width),
        counterfort_spacing: inputs.counterfort_spacing
          ? parseFloat(inputs.counterfort_spacing)
          : null,
        counterfort_thickness: inputs.counterfort_thickness
          ? parseFloat(inputs.counterfort_thickness)
          : null,
        surcharge: parseFloat(inputs.surcharge),
        safe_bearing_capacity: parseFloat(inputs.safe_bearing_capacity),
        water_table_depth: inputs.water_table_depth
          ? parseFloat(inputs.water_table_depth)
          : null,
        soil_type: inputs.soil_type,
        foundation_soil: inputs.foundation_soil,
        concrete_grade: inputs.concrete_grade,
        steel_grade: inputs.steel_grade,
        exposure: inputs.exposure,
        has_nib: inputs.has_nib,
        nib_depth: inputs.nib_depth ? parseFloat(inputs.nib_depth) : null,
        auto_size: inputs.auto_size,
      };

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
            {/* Wall Type Selection */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" />
                Wall Type
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {["cantilever", "counterfort", "buttress", "gravity"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setWallType(type)}
                    className={`p-3 rounded-lg font-medium transition-all flex flex-col items-center gap-2 ${wallType === type
                      ? "bg-gradient-to-br from-blue-600 to-teal-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <span className="text-xs capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Geometry & Loads */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Geometry & Loads
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height (m)
                    </label>
                    <input
                      type="number"
                      name="height"
                      value={inputs.height}
                      onChange={handleInputChange}
                      step="0.1"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Length (m)
                    </label>
                    <input
                      type="number"
                      name="length"
                      value={inputs.length}
                      onChange={handleInputChange}
                      step="0.1"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Counterfort/Heel/Toe inputs */}
                {!inputs.auto_size && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Wall Thick (mm)
                        </label>
                        <input
                          type="number"
                          name="wall_thickness"
                          value={inputs.wall_thickness}
                          onChange={handleInputChange}
                          step="25"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Base Thick (mm)
                        </label>
                        <input
                          type="number"
                          name="base_thickness"
                          value={inputs.base_thickness}
                          onChange={handleInputChange}
                          step="25"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Base Width (m)
                        </label>
                        <input
                          type="number"
                          name="base_width"
                          value={inputs.base_width}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Toe Width (m)
                        </label>
                        <input
                          type="number"
                          name="toe_width"
                          value={inputs.toe_width}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    name="auto_size"
                    checked={inputs.auto_size}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label className="text-sm font-medium text-gray-700">Auto-Size Dimensions</label>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Surcharge (kN/m²)
                    </label>
                    <input
                      type="number"
                      name="surcharge"
                      value={inputs.surcharge}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bearing Cap. (kN/m²)
                    </label>
                    <input
                      type="number"
                      name="safe_bearing_capacity"
                      value={inputs.safe_bearing_capacity}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Water Table Depth (m)
                  </label>
                  <input
                    type="number"
                    name="water_table_depth"
                    value={inputs.water_table_depth}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Material Properties */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Soils & Materials
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Backfill Soil
                  </label>
                  <select
                    name="soil_type"
                    value={inputs.soil_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {constants?.soil_types?.map((soil) => (
                      <option key={soil} value={soil}>{soil}</option>
                    )) || (
                        <>
                          <option value="Dense Sand">Dense Sand</option>
                          <option value="Medium Sand">Medium Sand</option>
                          <option value="Loose Sand">Loose Sand</option>
                          <option value="Stiff Clay">Stiff Clay</option>
                        </>
                      )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concrete Grade
                  </label>
                  <select
                    name="concrete_grade"
                    value={inputs.concrete_grade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {constants?.concrete_grades?.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    )) || (
                        <>
                          <option value="C25/30">C25/30</option>
                          <option value="C30/37">C30/37</option>
                          <option value="C35/45">C35/45</option>
                        </>
                      )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Steel Grade
                  </label>
                  <select
                    name="steel_grade"
                    value={inputs.steel_grade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {constants?.steel_grades?.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    )) || <option value="Grade 460">Grade 460</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exposure
                  </label>
                  <select
                    name="exposure"
                    value={inputs.exposure}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="severe">Severe</option>
                    <option value="moderate">Moderate</option>
                    <option value="mild">Mild</option>
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
                  className={`rounded-lg shadow-lg p-6 ${results.design_summary.includes("satisfies all checks")
                    ? "bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300"
                    : "bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300"
                    }`}
                >
                  <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                    {results.design_summary.includes("satisfies all checks") ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    )}
                    Design Summary
                  </h2>
                  <p className="text-gray-800 font-medium">
                    {results.design_summary}
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Total Lateral Force
                    </h3>
                    <p className="text-3xl font-bold text-gray-800">
                      {results.pressures.total_force.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">kN/m</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-teal-600">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Wall Moment
                    </h3>
                    <p className="text-3xl font-bold text-gray-800">
                      {results.wall_design.design_moment.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">kNm/m</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-600">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Stability Status
                    </h3>
                    <p className="text-2xl font-bold text-gray-800">
                      {results.stability.passes_overturning && results.stability.passes_sliding && results.stability.passes_bearing
                        ? "PASS"
                        : "FAIL"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Global Stability</p>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => setShow2DDrawer(!show2DDrawer)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold shadow transition flex items-center justify-center gap-2"
                  >
                    <Monitor className="w-5 h-5" />
                    {show2DDrawer ? "Hide Inline 2D" : "Show Inline 2D"}
                  </button>

                  <button
                    onClick={() => {
                      const primitives = getRetainingCADPrimitives(results);
                      window.CAD_PENDING_PRIMITIVES = primitives;
                      navigate("/drawing");
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow transition flex items-center justify-center gap-2"
                  >
                    <Maximize2 className="w-5 h-5" />
                    Universal 2D Viewer
                  </button>

                  <button
                    onClick={() => setShow3DViewer(true)}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-bold shadow transition flex items-center justify-center gap-2"
                  >
                    <Box className="w-5 h-5" />
                    View 3D Model
                  </button>

                  <button
                    onClick={downloadDXF}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold shadow transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Generate AutoCAD Script
                  </button>
                </div>

                {/* Visualization */}
                {show2DDrawer && (
                  <div className="bg-white rounded-lg shadow-lg p-6 overflow-hidden animate-in fade-in zoom-in duration-300">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Maximize2 className="w-5 h-5 text-purple-600" />
                      Structural Visualization
                    </h3>
                    <div className="w-full overflow-x-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <RetainingWallVisualizer designData={results} viewType="section" scale={0.5} />
                    </div>
                  </div>
                )}

                {/* 3D Visualization Overlay */}
                {show3DViewer && (
                  <div className="fixed inset-0 z-50 bg-white">
                    <StructuralVisualizationComponent
                      theme={isDark ? "dark" : "light"}
                      componentType="retaining_MRW1"
                      /* Map results to 3D props */
                      componentData={{
                        // Geometry (convert mm to m)
                        wallHeight: inputs.height || 3.0,
                        wallThickness: (inputs.wall_thickness || 300) / 1000,
                        baseWidth: (inputs.length || 2.5),
                        baseThickness: (inputs.base_thickness || 400) / 1000,
                        toeLength: (inputs.toe_length || 0.75),
                        heelLength: (inputs.length - (inputs.toe_length || 0.75) - (inputs.wall_thickness || 300) / 1000), // Approximate if not direct

                        // Default keys
                        hasKey: false,

                        // Covers (convert mm to m)
                        earthFaceCover: 0.05,
                        exposedFaceCover: 0.04,

                        // Reinforcement (from design results if available, else defaults)
                        verticalBarDiameter: (results?.design_results?.wall?.main_bar_diameter || 16) / 1000,
                        verticalBarSpacing: (results?.design_results?.wall?.main_bar_spacing || 150) / 1000,
                        horizontalBarDiameter: (results?.design_results?.wall?.dist_bar_diameter || 12) / 1000,
                        horizontalBarSpacing: (results?.design_results?.wall?.dist_bar_spacing || 200) / 1000,
                        baseBarDiameter: (results?.design_results?.toe?.main_bar_diameter || 16) / 1000,
                        baseBarSpacing: (results?.design_results?.toe?.main_bar_spacing || 150) / 1000,

                        showConcrete: true,
                        showRebar: true,
                      }}
                      visible={show3DViewer}
                      onClose={() => setShow3DViewer(false)}
                    />
                    <button
                      onClick={() => setShow3DViewer(false)}
                      className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full z-50 hover:bg-red-700 shadow-lg"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {/* Detailed Results */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between text-left"
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
                    <div id="detailed-results" className="mt-6 space-y-8">
                      {/* Stability Checks */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Stability Checks
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className={`p-4 rounded border-l-4 ${results.stability.passes_overturning ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            <p className="text-sm font-semibold">Overturning</p>
                            <p className="text-lg font-bold">FOS: {results.stability.factor_of_safety_overturning.toFixed(2)}</p>
                            <p className="text-xs">Limit: 2.0</p>
                          </div>
                          <div className={`p-4 rounded border-l-4 ${results.stability.passes_sliding ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            <p className="text-sm font-semibold">Sliding</p>
                            <p className="text-lg font-bold">FOS: {results.stability.factor_of_safety_sliding.toFixed(2)}</p>
                            <p className="text-xs">Limit: 1.5</p>
                          </div>
                          <div className={`p-4 rounded border-l-4 ${results.stability.passes_bearing ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            <p className="text-sm font-semibold">Bearing</p>
                            <p className="text-lg font-bold">{results.stability.max_bearing_pressure.toFixed(1)} kN/m²</p>
                            <p className="text-xs">Allowable: {inputs.safe_bearing_capacity} kN/m²</p>
                          </div>
                        </div>
                      </div>

                      {/* Wall Design */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Wall Element Design
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Thickness</span>
                            <span className="font-semibold">{results.wall_design.thickness} mm</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Main Steel</span>
                            <span className="font-semibold text-blue-600">{results.wall_design.main_steel.notation}</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Provided Area</span>
                            <span className="font-semibold">{results.wall_design.main_steel.provided_area} mm²/m</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Shear Check</span>
                            <span className={`font-semibold ${results.wall_design.shear_check_passed ? 'text-green-600' : 'text-red-600'}`}>
                              {results.wall_design.shear_check_passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Base Design */}
                      <div>
                        <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                          Base Element Design
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Thickness</span>
                            <span className="font-semibold">{results.base_design.thickness} mm</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Main Steel</span>
                            <span className="font-semibold text-blue-600">{results.base_design.main_steel.notation}</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Provided Area</span>
                            <span className="font-semibold">{results.base_design.main_steel.provided_area} mm²/m</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-gray-500">Shear Check</span>
                            <span className={`font-semibold ${results.base_design.shear_check_passed ? 'text-green-600' : 'text-red-600'}`}>
                              {results.base_design.shear_check_passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
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
        </div >
      </div >

      {/* Footer */}
      < footer className="bg-white border-t border-gray-200 mt-12 py-6" >
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
      </footer >
    </div >
  );
}

export default Retaining;
