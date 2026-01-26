import React, { useState, createContext } from "react";
import { Calculator, BookOpen, Layers } from "lucide-react";
import Stair3DVisualization from "../../components/visualisation_helper";
import Stair2D from "./Stair2D"; // Import the new 2D component

// Theme Context
const ThemeContext = createContext();

// Main App Component
function StairDesignerApp({ isDark = false }) {
  const [activeCode, setActiveCode] = useState("eurocode");
  const theme = isDark ? "dark" : "light";

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`min-h-screen ${isDark ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
        {/* Header */}
        <div className={`${isDark ? "bg-slate-800/50" : "bg-white"} backdrop-blur-sm border-b ${isDark ? "border-slate-700" : "border-gray-200"} sticky top-0 z-10`}>
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Calculator className={`${isDark ? "text-teal-400" : "text-teal-600"}`} size={32} />
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Stair Design
                </h1>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Professional stair design to Eurocode & BS 8110
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Code Selection */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveCode("eurocode")}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${activeCode === "eurocode"
                  ? isDark
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30"
                    : "bg-teal-500 text-white shadow-lg shadow-teal-500/30"
                  : isDark
                    ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
            >
              <BookOpen className="inline mr-2" size={20} />
              Eurocode EN 1992-1-1
            </button>
            <button
              onClick={() => setActiveCode("bs8110")}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${activeCode === "bs8110"
                  ? isDark
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                  : isDark
                    ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
            >
              <BookOpen className="inline mr-2" size={20} />
              BS 8110-1:1997
            </button>
          </div>

          {/* Main Content */}
          {activeCode === "eurocode" ? (
            <EurocodeCalculator theme={theme} isDark={isDark} />
          ) : (
            <BS8110Calculator theme={theme} isDark={isDark} />
          )}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

// Eurocode Calculator Component
function EurocodeCalculator({ theme, isDark }) {
  const [stairType, setStairType] = useState("simply_supported");
  const [cantileverType, setCantileverType] = useState("side_support");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show2D, setShow2D] = useState(false);

  const STAIR_TYPE_TO_ELEMENT = {
    simply_supported: "stair_MST1",
    cantilever: "stair_MST2",
  };

  const [inputs, setInputs] = useState({
    span: 3.0,
    width: 1.2,
    waist_thickness: 150,
    riser_height: 175,
    tread_length: 250,
    num_risers: 14,
    concrete_class: "C30/37",
    steel_grade: "B500B",
    exposure_class: "XC3",
    cover: 30,
    live_load: 3.0,
    finishes_load: 1.5,
    concrete_unit_weight: 25.0,
  });

  const euro_data_object = {
    inputs: inputs,
    results: results,
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
    try {
      const payload = {
        stair_type: stairType,
        cantilever_type: stairType === "cantilever" ? cantileverType : null,
        ...inputs,
      };

      const response = await fetch(
        "http://localhost:8001/stair_euro_backend/api/v1/eurocode/design",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Calculation failed");
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error("Error:", err);
      alert("Calculation error. Please check API connection.");
    } finally {
      setLoading(false);
    }
  };

  const cardClass = theme === "dark" ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200";
  const inputClass = theme === "dark" ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500";
  const textClass = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedClass = theme === "dark" ? "text-gray-400" : "text-gray-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl`}>
        <h2 className={`text-xl font-bold mb-6 ${textClass}`}>
          Design Parameters - Eurocode
        </h2>

        {/* Stair Type Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
            Stair Support Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStairType("simply_supported")}
              className={`p-3 rounded-lg font-medium transition-all ${stairType === "simply_supported"
                  ? "bg-teal-500 text-white"
                  : isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-slate-200 text-slate-700"
                }`}
            >
              Simply Supported
            </button>
            <button
              onClick={() => setStairType("cantilever")}
              className={`p-3 rounded-lg font-medium transition-all ${stairType === "cantilever"
                  ? "bg-teal-500 text-white"
                  : isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-slate-200 text-slate-700"
                }`}
            >
              Cantilever
            </button>
          </div>
        </div>

        {/* Cantilever Type (if applicable) */}
        {stairType === "cantilever" && (
          <div className="mb-6">
            <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
              Cantilever Support Configuration
            </label>
            <div className="space-y-3">
              <button
                onClick={() => setCantileverType("side_support")}
                className={`w-full p-3 rounded-lg text-left transition-all ${cantileverType === "side_support"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-200 text-gray-700"
                  }`}
              >
                <div className="font-semibold">Side Wall/Beam Support</div>
                <div className="text-sm opacity-80">
                  Steps cantilevering from side wall or beam
                </div>
              </button>
              <button
                onClick={() => setCantileverType("central_beam")}
                className={`w-full p-3 rounded-lg text-left transition-all ${cantileverType === "central_beam"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-200 text-gray-700"
                  }`}
              >
                <div className="font-semibold">Central Spine Beam</div>
                <div className="text-sm opacity-80">
                  Steps supported at center, cantilevering both sides
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Geometry */}
        <div className="mb-6">
          <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>Geometry</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Span (m)</label>
              <input
                type="number"
                name="span"
                value={inputs.span}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Width (m)</label>
              <input
                type="number"
                name="width"
                value={inputs.width}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Waist (mm)</label>
              <input
                type="number"
                name="waist_thickness"
                value={inputs.waist_thickness}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Riser (mm)</label>
              <input
                type="number"
                name="riser_height"
                value={inputs.riser_height}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Tread (mm)</label>
              <input
                type="number"
                name="tread_length"
                value={inputs.tread_length}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>No. of Risers</label>
              <input
                type="number"
                name="num_risers"
                value={inputs.num_risers}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="mb-6">
          <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>Materials</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Concrete Class</label>
              <select
                name="concrete_class"
                value={inputs.concrete_class}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option>C25/30</option>
                <option>C30/37</option>
                <option>C35/45</option>
                <option>C40/50</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Steel Grade</label>
              <select
                name="steel_grade"
                value={inputs.steel_grade}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option>B500A</option>
                <option>B500B</option>
                <option>B500C</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Exposure</label>
              <select
                name="exposure_class"
                value={inputs.exposure_class}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option>XC1</option>
                <option>XC2</option>
                <option>XC3</option>
                <option>XC4</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Cover (mm)</label>
              <input
                type="number"
                name="cover"
                value={inputs.cover}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        <div className="mb-6">
          <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>
            Loading (kN/m²)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Live Load</label>
              <input
                type="number"
                name="live_load"
                value={inputs.live_load}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Finishes</label>
              <input
                type="number"
                name="finishes_load"
                value={inputs.finishes_load}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Weight (kN/m³)</label>
              <input
                type="number"
                name="concrete_unit_weight"
                value={inputs.concrete_unit_weight}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
          </div>
        </div>

        <button
          onClick={calculateDesign}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-teal-500 hover:bg-teal-600 text-white shadow-lg"
            }`}
        >
          {loading ? "Calculating..." : "Calculate Design"}
        </button>

        {/* Show 2D Button */}
        {results && (
          <button
            onClick={() => setShow2D(true)}
            className="w-full mt-3 py-3 rounded-xl font-semibold bg-purple-500 hover:bg-purple-600 text-white shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Layers size={20} />
            Show 2D Details
          </button>
        )}
      </div>

      {/* 3D Visualization - Eurocode */}
      <div className={`${cardClass} rounded-2xl border shadow-xl overflow-hidden`}>
        <Stair3DVisualization
          stair_element={STAIR_TYPE_TO_ELEMENT[stairType]}
          data_object={euro_data_object}
          theme={theme}
        />
      </div>

      {/* Results Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl lg:col-span-2`}>
        <h2 className={`text-xl font-bold mb-4 ${textClass}`}>Design Results</h2>
        {!results ? (
          <div className={`text-center py-12 ${mutedClass}`}>
            Enter parameters and calculate
          </div>
        ) : (
          <div>
            <div
              className={`p-4 rounded-xl mb-4 font-semibold text-center ${results.checks?.all_checks_passed
                  ? "bg-green-500/20 text-green-600"
                  : "bg-red-500/20 text-red-600"
                }`}
            >
              {results.checks?.all_checks_passed
                ? "✓ DESIGN SATISFACTORY"
                : "⚠ REQUIRES REVISION"}
            </div>
          </div>
        )}
      </div>

      {/* 2D Visualization Modal */}
      <Stair2D
        isOpen={show2D}
        onClose={() => setShow2D(false)}
        data={euro_data_object}
        codeType="eurocode"
        stairType={stairType}
        cantileverType={cantileverType}
        theme={theme}
      />
    </div>
  );
}

// BS 8110 Calculator Component
function BS8110Calculator({ theme, isDark }) {
  const [stairType, setStairType] = useState("supported");
  const [cantileverType, setCantileverType] = useState("side_support");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show2D, setShow2D] = useState(false);

  const STAIR_TYPE_TO_ELEMENT = {
    supported: "stair_MST1",
    cantilever: "stair_MST2",
  };

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
    cover: 35,
    live_load: 3.0,
    finishes_load: 1.5,
    concrete_unit_weight: 25.0,
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: isNaN(value) ? value : parseFloat(value) || value,
    }));
  };

  const calculateDesign = async () => {
    setLoading(true);
    try {
      const payload = {
        stair_type: stairType,
        cantilever_type: stairType === "cantilever" ? cantileverType : null,
        ...inputs,
      };

      const response = await fetch(
        "http://localhost:8001/stair_euro_backend/api/v1/bs8110/design",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Calculation failed");
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error("Error:", err);
      alert("Calculation error. Please check API connection.");
    } finally {
      setLoading(false);
    }
  };

  const cardClass = theme === "dark" ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200";
  const inputClass = theme === "dark" ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500";
  const textClass = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedClass = theme === "dark" ? "text-gray-400" : "text-gray-600";

  const bs_data_object = {
    inputs: inputs,
    results: results,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl`}>
        <h2 className={`text-xl font-bold mb-6 ${textClass}`}>
          Design Parameters - BS 8110
        </h2>

        {/* Stair Type Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
            Stair Support Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStairType("supported")}
              className={`p-3 rounded-lg font-medium transition-all ${stairType === "supported"
                  ? "bg-blue-500 text-white"
                  : isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-slate-200 text-slate-700"
                }`}
            >
              Simply Supported
            </button>
            <button
              onClick={() => setStairType("cantilever")}
              className={`p-3 rounded-lg font-medium transition-all ${stairType === "cantilever"
                  ? "bg-blue-500 text-white"
                  : isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-slate-200 text-slate-700"
                }`}
            >
              Cantilever
            </button>
          </div>
        </div>

        {/* Cantilever Type */}
        {stairType === "cantilever" && (
          <div className="mb-6">
            <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
              Cantilever Configuration
            </label>
            <div className="space-y-3">
              <button
                onClick={() => setCantileverType("side_support")}
                className={`w-full p-3 rounded-lg text-left transition-all ${cantileverType === "side_support"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-200 text-gray-700"
                  }`}
              >
                <div className="font-semibold">Side Wall/Beam Support</div>
                <div className="text-sm opacity-80">
                  Steps fixed to side wall or beam
                </div>
              </button>
              <button
                onClick={() => setCantileverType("central_beam")}
                className={`w-full p-3 rounded-lg text-left transition-all ${cantileverType === "central_beam"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-200 text-gray-700"
                  }`}
              >
                <div className="font-semibold">Central Spine Beam</div>
                <div className="text-sm opacity-80">
                  Steps supported centrally, both sides cantilever
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Geometry */}
        <div className="mb-6">
          <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>Geometry</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Span (m)</label>
              <input
                type="number"
                name="span"
                value={inputs.span}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Width (m)</label>
              <input
                type="number"
                name="width"
                value={inputs.width}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Waist (mm)</label>
              <input
                type="number"
                name="waist_thickness"
                value={inputs.waist_thickness}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Riser (mm)</label>
              <input
                type="number"
                name="riser_height"
                value={inputs.riser_height}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Tread (mm)</label>
              <input
                type="number"
                name="tread_length"
                value={inputs.tread_length}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>No. of Risers</label>
              <input
                type="number"
                name="num_risers"
                value={inputs.num_risers}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="mb-6">
          <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>Materials</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Concrete Grade</label>
              <select
                name="concrete_grade"
                value={inputs.concrete_grade}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option>C25/30</option>
                <option>C30/37</option>
                <option>C35/45</option>
                <option>C40/50</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Steel Grade</label>
              <select
                name="steel_grade"
                value={inputs.steel_grade}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option>Grade 460</option>
                <option>Grade 500</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Exposure</label>
              <select
                name="exposure"
                value={inputs.exposure}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option>Mild</option>
                <option>Moderate</option>
                <option>Severe</option>
                <option>Very Severe</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Cover (mm)</label>
              <input
                type="number"
                name="cover"
                value={inputs.cover}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        <div className="mb-6">
          <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>
            Loading (kN/m²)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Live Load</label>
              <input
                type="number"
                name="live_load"
                value={inputs.live_load}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Finishes</label>
              <input
                type="number"
                name="finishes_load"
                value={inputs.finishes_load}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${mutedClass}`}>Weight (kN/m³)</label>
              <input
                type="number"
                name="concrete_unit_weight"
                value={inputs.concrete_unit_weight}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              />
            </div>
          </div>
        </div>

        <button
          onClick={calculateDesign}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
            }`}
        >
          {loading ? "Calculating..." : "Calculate Design"}
        </button>

        {/* Show 2D Button */}
        {results && (
          <button
            onClick={() => setShow2D(true)}
            className="w-full mt-3 py-3 rounded-xl font-semibold bg-purple-500 hover:bg-purple-600 text-white shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Layers size={20} />
            Show 2D Details
          </button>
        )}
      </div>

      {/* 3D Visualization - BS 8110 */}
      <div className={`${cardClass} rounded-2xl border shadow-xl overflow-hidden`}>
        <Stair3DVisualization
          stair_element={STAIR_TYPE_TO_ELEMENT[stairType]}
          data_object={bs_data_object}
          theme={theme}
        />
      </div>

      {/* Results Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl lg:col-span-2`}>
        <h2 className={`text-xl font-bold mb-4 ${textClass}`}>Design Results</h2>
        {!results ? (
          <div className={`text-center py-12 ${mutedClass}`}>
            Enter parameters and calculate
          </div>
        ) : (
          <div>
            <div
              className={`p-4 rounded-xl mb-4 font-semibold text-center ${results.checks?.all_checks_passed
                  ? "bg-green-500/20 text-green-600"
                  : "bg-red-500/20 text-red-600"
                }`}
            >
              Design Status:{" "}
              {results.checks?.all_checks_passed
                ? "✓ DESIGN SATISFACTORY"
                : "⚠ REQUIRES REVISION"}
            </div>
            {results.warnings && results.warnings.length > 0 && (
              <div className="mt-4">
                <h3 className={`font-semibold mb-2 ${textClass}`}>Warnings:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {results.warnings.map((warning, idx) => (
                    <li key={idx} className={mutedClass}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2D Visualization Modal */}
      <Stair2D
        isOpen={show2D}
        onClose={() => setShow2D(false)}
        data={bs_data_object}
        codeType="bs8110"
        stairType={stairType}
        cantileverType={cantileverType}
        theme={theme}
      />
    </div>
  );
}

// Result Section Component
function ResultSection({ title, data, theme }) {
  const cardClass = theme === "dark" ? "bg-gray-700/30" : "bg-gray-100";
  const textClass = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedClass = theme === "dark" ? "text-gray-400" : "text-gray-600";

  const formatValue = (value) => {
    if (typeof value === "boolean") {
      return value ? "✓ Yes" : "✗ No";
    }
    if (typeof value === "number") {
      return value % 1 !== 0 ? value.toFixed(3) : value;
    }
    return value;
  };

  const formatKey = (key) => {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className={`${cardClass} rounded-xl p-4 mb-4`}>
      <h3 className={`font-semibold mb-3 ${textClass}`}>{title}</h3>
      <div className="space-y-2">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className={mutedClass}>{formatKey(key)}:</span>
            <span className={textClass}>{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StairDesignerApp;