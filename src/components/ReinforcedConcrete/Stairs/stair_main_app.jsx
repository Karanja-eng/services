import React, { useState, createContext } from "react";
import { Moon, Sun, Calculator, BookOpen } from "lucide-react";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import ThreeD_helper from '../../components/visualisation_helper'


// Theme Context
const ThemeContext = createContext();

// Main App Component
function StairDesignerApp() {
  const [theme, setTheme] = useState("light");
  const [activeCode, setActiveCode] = useState("eurocode");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme }}>
      <div
        className={`min-h-screen transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
            : "bg-gradient-to-br from-gray-50 via-white to-gray-100"
        }`}
      >
        {/* Header with Theme Toggle */}
        <div
          className={`border-b ${
            theme === "dark"
              ? "bg-gray-800/50 border-gray-700"
              : "bg-white/80 border-gray-200"
          } backdrop-blur-lg sticky top-0 z-50 shadow-lg`}
        >
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-xl ${
                    theme === "dark" ? "bg-blue-600" : "bg-blue-500"
                  } shadow-lg`}
                >
                  <Calculator className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1
                    className={`text-2xl font-bold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Stairs
                  </h1>
                  <p
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    choose between Eurocode and BS 8110 design codes
                  </p>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className={`p-3 rounded-xl transition-all ${
                  theme === "dark"
                    ? "bg-gray-700 hover:bg-gray-600 text-yellow-400"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                } shadow-lg hover:shadow-xl`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? (
                  <Sun className="w-6 h-6" />
                ) : (
                  <Moon className="w-6 h-6" />
                )}
              </button>
            </div>

            {/* Code Selection */}
            <div className="mt-4 flex gap-4">
              <button
                onClick={() => setActiveCode("eurocode")}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                  activeCode === "eurocode"
                    ? theme === "dark"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : theme === "dark"
                    ? "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Eurocode EN 1992-1-1
                </div>
              </button>

              <button
                onClick={() => setActiveCode("bs8110")}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                  activeCode === "bs8110"
                    ? theme === "dark"
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                      : "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                    : theme === "dark"
                    ? "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  BS 8110-1:1997
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-6">
          {activeCode === "eurocode" ? (
            <EurocodeCalculator theme={theme} />
          ) : (
            <BS8110Calculator theme={theme} />
          )}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

// Eurocode Calculator Component
function EurocodeCalculator({ theme }) {
  const [stairType, setStairType] = useState("simply_supported");
  const [cantileverType, setCantileverType] = useState("side_support");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  // add this state with the other useState calls in EurocodeCalculator

  const [show3D, setShow3D] = useState(false);
  const [stairPropsFor3D, setStairPropsFor3D] = useState(null);

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
  });

  const euro_data_object = { inputs: inputs, results: results };

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
          headers: { "Content-Type": "application/json" },
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

  const cardClass =
    theme === "dark"
      ? "bg-gray-800/50 border-gray-700"
      : "bg-white border-gray-200";

  const inputClass =
    theme === "dark"
      ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500";

  const textClass = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedClass = theme === "dark" ? "text-gray-400" : "text-gray-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl`}>
        <h2 className={`text-xl font-bold ${textClass} mb-4`}>
          Design Parameters - Eurocode
        </h2>

        {/* Stair Type Selection */}
        <div className="mb-6">
          <label className={`block ${textClass} font-medium mb-2`}>
            Stair Support Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStairType("simply_supported")}
              className={`p-3 rounded-lg font-medium transition-all ${
                stairType === "simply_supported"
                  ? "bg-blue-500 text-white"
                  : theme === "dark"
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Simply Supported
            </button>
            <button
              onClick={() => setStairType("cantilever")}
              className={`p-3 rounded-lg font-medium transition-all ${
                stairType === "cantilever"
                  ? "bg-blue-500 text-white"
                  : theme === "dark"
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Cantilever
            </button>
          </div>
        </div>

        {/* Cantilever Type (if applicable) */}
        {stairType === "cantilever" && (
          <div className="mb-6">
            <label className={`block ${textClass} font-medium mb-2`}>
              Cantilever Support Configuration
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setCantileverType("side_support")}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  cantileverType === "side_support"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                <div className="font-medium">Side Wall/Beam Support</div>
                <div className="text-sm opacity-80">
                  Steps cantilevering from side wall or beam
                </div>
              </button>
              <button
                onClick={() => setCantileverType("central_beam")}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  cantileverType === "central_beam"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                <div className="font-medium">Central Spine Beam</div>
                <div className="text-sm opacity-80">
                  Steps supported at center, cantilevering both sides
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {/* Geometry */}
          <div>
            <h3 className={`font-semibold ${textClass} mb-3`}>Geometry</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Span (m)
                </label>
                <input
                  type="number"
                  name="span"
                  value={inputs.span}
                  onChange={handleInputChange}
                  step="0.1"
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Width (m)
                </label>
                <input
                  type="number"
                  name="width"
                  value={inputs.width}
                  onChange={handleInputChange}
                  step="0.1"
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Waist (mm)
                </label>
                <input
                  type="number"
                  name="waist_thickness"
                  value={inputs.waist_thickness}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Riser (mm)
                </label>
                <input
                  type="number"
                  name="riser_height"
                  value={inputs.riser_height}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>
          </div>

          {/* Materials */}
          <div>
            <h3 className={`font-semibold ${textClass} mb-3`}>Materials</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Concrete Class
                </label>
                <select
                  name="concrete_class"
                  value={inputs.concrete_class}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="C25/30">C25/30</option>
                  <option value="C30/37">C30/37</option>
                  <option value="C35/45">C35/45</option>
                  <option value="C40/50">C40/50</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Steel Grade
                </label>
                <select
                  name="steel_grade"
                  value={inputs.steel_grade}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="B500A">B500A</option>
                  <option value="B500B">B500B</option>
                  <option value="B500C">B500C</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loading */}
          <div>
            <h3 className={`font-semibold ${textClass} mb-3`}>
              Loading (kN/m²)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Live Load
                </label>
                <input
                  type="number"
                  name="live_load"
                  value={inputs.live_load}
                  onChange={handleInputChange}
                  step="0.5"
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Finishes
                </label>
                <input
                  type="number"
                  name="finishes_load"
                  value={inputs.finishes_load}
                  onChange={handleInputChange}
                  step="0.5"
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={calculateDesign}
          disabled={loading}
          className="w-full mt-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg disabled:opacity-50"
        >
          {loading ? "Calculating..." : "Calculate Design"}
        </button>
  {/* ################################################## */}

        {/* Show 3D button - place immediately below the Calculate Design button */}
        <button
          onClick={() => {
            // prepare and normalize inputs for the DrawStairsMST1 component
            // convert mm → m where applicable (your inputs have some mm fields)
            const stairProps = {
              flightLength: inputs.span, // span is in meters already
              flightWidth: inputs.width, // width in meters
              waistThickness: (inputs.waist_thickness || 150) / 1000, // mm -> m
              riserHeight: (inputs.riser_height || 175) / 1000, // mm -> m
              goingDepth: (inputs.tread_length || 250) / 1000, // mm -> m
              numSteps: inputs.num_risers || 14,
              landingLength: 1.2, // you can pass a UI value later
              landingThickness: (inputs.waist_thickness || 150) / 1000,
              cover: (inputs.cover || 30) / 1000,
              showConcrete: true,
              showRebar: true,
              opacity: 0.6,
              wireframe: false,
              // optional color overrides:
              colors: {
                concrete: "#c0c0c0",
                waist: "#b0b0b0",
                landing: "#a8a8a8",
                mainBars: "#cc3333",
                distributionBars: "#3366cc",
                uBars: "#ff6600",
              },
              elementType: STAIR_TYPE_TO_ELEMENT[stairType],
            };

            setStairPropsFor3D(stairProps);
            setShow3D(true);
          }}
          className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
        >
          Show 3D
        </button>


      </div>

      
      {/* ################################################# */}




      {/* Results Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl`}>
        <h2 className={`text-xl font-bold ${textClass} mb-4`}>
          Design Results
        </h2>

        {!results ? (
          <div className="flex flex-col items-center justify-center h-96">
            <Calculator className={`w-16 h-16 ${mutedClass} mb-4`} />
            <p className={mutedClass}>Enter parameters and calculate</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <ResultSection
              title="Loading"
              data={results.loading}
              theme={theme}
            />
            <ResultSection title="Forces" data={results.forces} theme={theme} />
            <ResultSection
              title="Steel Design"
              data={results.steel_design}
              theme={theme}
            />
            <ResultSection
              title="Shear"
              data={results.shear_design}
              theme={theme}
            />

            <div
              className={`rounded-xl p-4 ${
                results.checks?.all_checks_passed
                  ? "bg-green-500/20 border-2 border-green-500"
                  : "bg-red-500/20 border-2 border-red-500"
              }`}
            >
              <p className={`text-center font-bold ${textClass}`}>
                {results.checks?.all_checks_passed
                  ? "✓ DESIGN SATISFACTORY"
                  : "⚠ REQUIRES REVISION"}
              </p>
            </div>
          </div>
        )}
      </div>

      
      {/* ################################################ */}

      {/* ------------- 3D Popup (full-screen) ------------- */}
      {show3D && stairPropsFor3D && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center"
          role="dialog"
          aria-modal="true"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShow3D(false)}
          />

          {/* content */}
          <div className="relative m-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* header with Back button */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShow3D(false)}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
                >
                  ← Back
                </button>
                <h3 className="font-semibold">3D Stair Visualization</h3>
              </div>

              {/* optional quick toggles */}
              <div className="flex items-center gap-2 pr-2">
                {/* you can later add export/print controls here */}
                <button
                  onClick={() => {
                    /* example: zoom to fit could be implemented in the viz component by exposing a ref */
                  }}
                  className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  Fit
                </button>
              </div>
            </div>

            {/* visualization container */}
            <div className="w-full h-[calc(100%-64px)]">
              {/* render the StructuralVisualizationComponent and pass stair props */}
              <StructuralVisualizationComponent
                theme={theme}
                visible={show3D}
                onClose={() => setShow3D(false)}
                elementType={stairPropsFor3D.elementType} // or "beam_RC1", "column_RC2", "slab_FF1"
                elementData={euro_data_object} // contains all inputs and results
              />
            </div>
          </div>
        </div>
      )}


      {/*############################################# */}
    </div>
  );
}

// BS 8110 Calculator Component
function BS8110Calculator({ theme }) {
  const [stairType, setStairType] = useState("supported");
  const [cantileverType, setCantileverType] = useState("side_support");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

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
          headers: { "Content-Type": "application/json" },
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

  const cardClass =
    theme === "dark"
      ? "bg-gray-800/50 border-gray-700"
      : "bg-white border-gray-200";

  const inputClass =
    theme === "dark"
      ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500";

  const textClass = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedClass = theme === "dark" ? "text-gray-400" : "text-gray-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Similar structure to Eurocode but with BS 8110 specific fields */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl`}>
        <h2 className={`text-xl font-bold ${textClass} mb-4`}>
          Design Parameters - BS 8110
        </h2>

        {/* Stair Type Selection */}
        <div className="mb-6">
          <label className={`block ${textClass} font-medium mb-2`}>
            Stair Support Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStairType("supported")}
              className={`p-3 rounded-lg font-medium transition-all ${
                stairType === "supported"
                  ? "bg-purple-500 text-white"
                  : theme === "dark"
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Simply Supported
            </button>
            <button
              onClick={() => setStairType("cantilever")}
              className={`p-3 rounded-lg font-medium transition-all ${
                stairType === "cantilever"
                  ? "bg-purple-500 text-white"
                  : theme === "dark"
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Cantilever
            </button>
          </div>
        </div>

        {/* Cantilever Type */}
        {stairType === "cantilever" && (
          <div className="mb-6">
            <label className={`block ${textClass} font-medium mb-2`}>
              Cantilever Configuration
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setCantileverType("side_support")}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  cantileverType === "side_support"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                <div className="font-medium">Side Wall/Beam Support</div>
                <div className="text-sm opacity-80">
                  Steps fixed to side wall or beam
                </div>
              </button>
              <button
                onClick={() => setCantileverType("central_beam")}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  cantileverType === "central_beam"
                    ? "bg-green-500 text-white"
                    : theme === "dark"
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                <div className="font-medium">Central Spine Beam</div>
                <div className="text-sm opacity-80">
                  Steps supported centrally, both sides cantilever
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {/* Input fields similar to Eurocode */}
          <div>
            <h3 className={`font-semibold ${textClass} mb-3`}>Geometry</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Span (m)
                </label>
                <input
                  type="number"
                  name="span"
                  value={inputs.span}
                  onChange={handleInputChange}
                  step="0.1"
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Width (m)
                </label>
                <input
                  type="number"
                  name="width"
                  value={inputs.width}
                  onChange={handleInputChange}
                  step="0.1"
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className={`font-semibold ${textClass} mb-3`}>Materials</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Concrete Grade
                </label>
                <select
                  name="concrete_grade"
                  value={inputs.concrete_grade}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-purple-500`}
                >
                  <option value="C25/30">C25/30</option>
                  <option value="C30/37">C30/37</option>
                  <option value="C35/45">C35/45</option>
                  <option value="C40/50">C40/50</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm ${mutedClass} mb-1`}>
                  Steel Grade
                </label>
                <select
                  name="steel_grade"
                  value={inputs.steel_grade}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:ring-2 focus:ring-purple-500`}
                >
                  <option value="Grade 460">Grade 460</option>
                  <option value="Grade 500">Grade 500</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={calculateDesign}
          disabled={loading}
          className="w-full mt-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg disabled:opacity-50"
        >
          {loading ? "Calculating..." : "Calculate Design"}
        </button>

        <ThreeD_helper />
      </div>

      {/* Results Panel */}
      <div className={`${cardClass} rounded-2xl p-6 border shadow-xl`}>
        <h2 className={`text-xl font-bold ${textClass} mb-4`}>
          Design Results
        </h2>

        {!results ? (
          <div className="flex flex-col items-center justify-center h-96">
            <Calculator className={`w-16 h-16 ${mutedClass} mb-4`} />
            <p className={mutedClass}>Enter parameters and calculate</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <ResultSection
              title="Loading"
              data={results.loading}
              theme={theme}
            />
            <ResultSection title="Forces" data={results.forces} theme={theme} />
            <ResultSection
              title="Steel Design"
              data={results.steel_design}
              theme={theme}
            />
            <ResultSection
              title="Shear"
              data={results.shear_design}
              theme={theme}
            />

            <div
              className={`rounded-xl p-4 ${
                results.checks?.all_checks_passed
                  ? "bg-green-500/20 border-2 border-green-500"
                  : "bg-red-500/20 border-2 border-red-500"
              }`}
            >
              <p className={`text-center font-bold ${textClass}`}>
                <strong>Design Status: </strong>
                {results.checks?.all_checks_passed
                  ? "✓ DESIGN SATISFACTORY"
                  : "⚠ REQUIRES REVISION"}
              </p>
              {results.warnings && results.warnings.length > 0 && (
                <div className="mt-2 text-sm">
                  <strong>Warnings:</strong>
                  <ul className="list-disc pl-4">
                    {results.warnings.map((warning, idx) => (
                      <li key={idx} className="text-amber-500">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Result Section Component
function ResultSection({ title, data, theme }) {
  const cardClass = theme === "dark" ? "bg-gray-700/30" : "bg-gray-100";
  const textClass = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedClass = theme === "dark" ? "text-gray-400" : "text-gray-600";
  const highlightClass = theme === "dark" ? "text-blue-300" : "text-blue-600";

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
    <div className={`${cardClass} rounded-lg p-4`}>
      <h3 className={`font-semibold ${textClass} mb-3 text-lg`}>{title}</h3>
      <div className="space-y-2 text-sm">
        {Object.entries(data || {}).map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between items-center border-b border-gray-700/20 pb-1"
          >
            <strong className={mutedClass}>{formatKey(key)}:</strong>
            <span
              className={
                typeof value === "boolean"
                  ? value
                    ? "text-green-500"
                    : "text-red-500"
                  : highlightClass
              }
            >
              {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StairDesignerApp;
