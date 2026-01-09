import React, { useState } from "react";
import {
  Calculator,
  GitBranch,
  ArrowRight,
  ChevronLeft,
  Layout,
  Layers,
  Box,
  Monitor,
  Settings,
  Ruler,
  Shield,
  Award
} from "lucide-react";
import RCBeamDesigner from "./RCBeamDesigner";
import MomentDistributionCalculator from "./distribution";
import EnhancedThreeMomentCalculator from "./Three";
import BSCoefficientsCalculator from "./BSCoefficientsCalculator";
import EurocodeBeamDesign from "./Eurocode_beam";

/**
 * StructuralEngineeringSuite
 * 
 * New Workflow:
 * 1. Design Parameters (Dimensions, Materials, BS 8110 Settings)
 * 2. Beam Configuration (Single, Continuous, Cantilever)
 * 3. Analysis Method (if Continuous)
 * 4. Analysis & Design Results
 */
const StructuralEngineeringSuite = ({ isDark = false }) => {
  const [activeCode, setActiveCode] = useState("BS8110"); // new state for design code
  const [step, setStep] = useState("params"); // params, type, method, calculator, design
  const [beamType, setBeamType] = useState(null);
  const [analysisMethod, setAnalysisMethod] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);

  // Design Parameters State (Global for the suite)
  const [beamParams, setBeamParams] = useState({
    beam_type: "Rectangular", // Section type
    fcu: 30,
    fy: 460,
    width: 300,
    depth: 500,
    cover: 25,
    web_width: 300,
    flange_width: 1000,
    flange_thickness: 150,
    exposure_condition: "Moderate",
    fire_resistance_period: "1 hour",
    permanent_load: 5.0,
    imposed_load: 10.0,
  });

  const beamConfigurations = [
    {
      id: "single",
      name: "Single Span",
      description: "Simply supported beam with a single span",
      icon: <Box className="h-8 w-8" />,
      color: "blue"
    },
    {
      id: "cantilever",
      name: "Cantilevered",
      description: "Beam fixed at one end and free at the other",
      icon: <Layers className="h-8 w-8" />,
      color: "orange"
    },
    {
      id: "continuous",
      name: "Continuous",
      description: "Beam spanning over multiple supports",
      icon: <GitBranch className="h-8 w-8" />,
      color: "green"
    }
  ];

  const continuousMethods = [
    {
      id: "three-moment",
      name: "Three-Moment Theorem",
      description: "Classical method for continuous beam analysis",
      icon: <Calculator className="h-8 w-8" />,
      component: EnhancedThreeMomentCalculator,
      color: "blue"
    },
    {
      id: "moment-distribution",
      name: "Moment Distribution",
      description: "Hardy Cross iterative method for frames and beams",
      icon: <GitBranch className="h-8 w-8" />,
      component: MomentDistributionCalculator,
      color: "green"
    },
    {
      id: "bs-coefficients",
      name: "BS 8110 Coefficients",
      description: "Simplified design using Table 3.5 coefficients",
      icon: <Layout className="h-8 w-8" />,
      component: BSCoefficientsCalculator,
      color: "purple"
    }
  ];

  const handleTypeSelect = (type) => {
    setBeamType(type);
    if (type === "continuous") {
      setStep("method");
    } else {
      setAnalysisMethod("three-moment"); // Default for single/cantilever (can be overridden later if needed)
      setStep("calculator");
    }
  };

  const handleMethodSelect = (method) => {
    setAnalysisMethod(method);
    setStep("calculator");
  };

  const reset = () => {
    setStep("params");
    setBeamType(null);
    setAnalysisMethod(null);
    setAnalysisResults(null);
  };

  // Helper to map UI beam type to Backend Support Condition
  const getSupportCondition = (type) => {
    switch (type) {
      case "single": return "Simply Supported";
      case "cantilever": return "Cantilever";
      case "continuous": return "Continuous";
      default: return "Continuous";
    }
  };

  const currentDesignParams = {
    ...beamParams,
    support_condition: getSupportCondition(beamType)
  };

  // Step 1: Design Parameters Input
  const renderDesignParameters = () => (
    <div className="max-w-5xl mx-auto p-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          RC Beam Designer
        </h1>
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg p-1 bg-gray-100 dark:bg-slate-700">
            <button
              onClick={() => setActiveCode("BS8110")}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${activeCode === "BS8110"
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900"
                }`}
            >
              BS 8110
            </button>
            <button
              onClick={() => setActiveCode("Eurocode")}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${activeCode === "Eurocode"
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900"
                }`}
            >
              Eurocode 2
            </button>
          </div>
        </div>

        {activeCode === "Eurocode" ? (
          <p className="text-xl text-gray-600 dark:text-slate-400">
            Eurocode 2 (EN 1992-1-1) Compliant Design
          </p>
        ) : (
          <p className="text-xl text-gray-600 dark:text-slate-400">
            BS 8110-1:1997 Compliant Design Suite
          </p>
        )}
      </div>

      {activeCode === "Eurocode" ? (
        <EurocodeBeamDesign />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-slate-700 space-y-8">

          {/* Section 1: Beam Section Type */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Layout className="h-5 w-5 text-blue-500" /> Section Configuration
            </h3>
            <div className="flex flex-wrap gap-4">
              {["Rectangular", "T-Beam", "L-Beam"].map((type) => (
                <button
                  key={type}
                  onClick={() => setBeamParams({ ...beamParams, beam_type: type })}
                  className={`flex-1 min-w-[150px] p-4 rounded-xl border-2 transition-all font-bold ${beamParams.beam_type === type
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-slate-600 hover:border-blue-300 text-gray-600 dark:text-slate-400"
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Geometry & Materials Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Materials */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" /> Materials
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Concrete (fcu)</label>
                  <select
                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl"
                    value={beamParams.fcu}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBeamParams({ ...beamParams, fcu: val === "C30/37" ? "C30/37" : parseInt(val) });
                    }}
                  >
                    {/* Modified map to include special string options */
                      [20, 25, 30, 35, 40, 45, 50].map(f => (
                        <option key={f} value={f}>C{f} ({f} N/mm²)</option>
                      ))}
                    <option value="C30/37">C30/37 (Eurocode)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Steel (fy)</label>
                  <select
                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl"
                    value={beamParams.fy}
                    onChange={(e) => setBeamParams({ ...beamParams, fy: parseInt(e.target.value) })}
                  >
                    <option value={250}>Grade 250</option>
                    <option value={460}>Grade 460</option>
                  </select>
                </div>
              </div>

              {/* BS 8110 Extras */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Exposure</label>
                  <select
                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl"
                    value={beamParams.exposure_condition}
                    onChange={(e) => setBeamParams({ ...beamParams, exposure_condition: e.target.value })}
                  >
                    {["Mild", "Moderate", "Severe", "Very Severe", "Extreme"].map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Fire Resistance</label>
                  <select
                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-sm"
                    value={beamParams.fire_resistance_period}
                    onChange={(e) => setBeamParams({ ...beamParams, fire_resistance_period: e.target.value })}
                  >
                    {["30 mins", "1 hour", "1.5 hours", "2 hours", "3 hours", "4 hours"].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="bg-gray-50 dark:bg-slate-700/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-600">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Ruler className="h-5 w-5 text-green-500" /> Dimensions (mm)
              </h3>

              {beamParams.beam_type === "Rectangular" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500">Width (b)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.width}
                      onChange={(e) => setBeamParams({ ...beamParams, width: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Depth (h)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.depth}
                      onChange={(e) => setBeamParams({ ...beamParams, depth: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">Nominal Cover (c)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.cover}
                      onChange={(e) => setBeamParams({ ...beamParams, cover: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500">Web Width (bw)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.web_width}
                      onChange={(e) => setBeamParams({ ...beamParams, web_width: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Total Depth (h)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.depth}
                      onChange={(e) => setBeamParams({ ...beamParams, depth: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Flange Width (bf)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.flange_width}
                      onChange={(e) => setBeamParams({ ...beamParams, flange_width: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Flange Thick (hf)</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.flange_thickness}
                      onChange={(e) => setBeamParams({ ...beamParams, flange_thickness: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">Nominal Cover</label>
                    <input type="number" className="w-full p-2 rounded-lg border dark:bg-slate-600 dark:border-slate-500"
                      value={beamParams.cover}
                      onChange={(e) => setBeamParams({ ...beamParams, cover: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Proceed Button */}
          <button
            onClick={() => setStep("type")}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-2xl transition hover:scale-[1.01] flex items-center justify-center gap-3 text-lg"
          >
            Continue to Analysis Configuration <ArrowRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );

  const renderTypeSelection = () => (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => setStep("params")}
        className="flex items-center text-gray-600 hover:text-blue-600 mb-8 transition-colors group font-semibold"
      >
        <ChevronLeft className="h-5 w-5 mr-1 group-hover:-translate-x-1 transition-transform" /> Edit Parameters
      </button>

      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold mb-4 text-gray-900 dark:text-white">
          Structural Configuration
        </h2>
        <p className="text-lg text-gray-600 dark:text-slate-400">
          How is this beam supported?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {beamConfigurations.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type.id)}
            className="group relative bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-left overflow-hidden border border-transparent hover:border-blue-500/30"
          >
            <div className={`p-4 rounded-2xl bg-${type.color}-100 dark:bg-${type.color}-900/10 text-${type.color}-600 mb-6 w-fit group-hover:scale-110 transition-transform`}>
              {type.icon}
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
              {type.name}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-6">
              {type.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderMethodSelection = () => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setStep("type")} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
        <span className="font-bold text-gray-400">Back</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {continuousMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => handleMethodSelect(method.id)}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border-l-4 border-transparent hover:border-blue-500 group text-left"
          >
            <div className={`text-${method.color}-600 mb-4`}>{method.icon}</div>
            <h4 className="text-xl font-bold mb-2">{method.name}</h4>
            <p className="text-sm text-gray-500 mb-4">{method.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const SelectedCalculator = continuousMethods.find(m => m.id === analysisMethod)?.component || EnhancedThreeMomentCalculator;

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-900" : "bg-gray-50 text-gray-900"}`}>

      {step === "calculator" && (
        <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep("params")} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
              Edit Params
            </button>
            <h2 className="font-bold text-gray-700">Analysis Mode</h2>
          </div>
          {analysisResults && (
            <button onClick={() => setStep("design")} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-green-700">
              View Design Report
            </button>
          )}
        </div>
      )}

      <div className="py-8">
        {step === "params" && renderDesignParameters()}
        {step === "type" && renderTypeSelection()}
        {step === "method" && renderMethodSelection()}

        {step === "calculator" && (
          <div className="space-y-6">
            <SelectedCalculator
              key={analysisMethod}
              isDark={isDark}
              beamType={beamType}
              initialParams={currentDesignParams} // Pass full params
              onAnalysisComplete={(results) => {
                setAnalysisResults(results);
              }}
            />

            {analysisResults && (
              <div className="max-w-4xl mx-auto px-4 mt-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between border-l-4 border-green-500">
                  <div>
                    <h3 className="font-bold text-lg text-green-700">Analysis Successful</h3>
                    <p className="text-gray-500">Moments and shears have been calculated.</p>
                  </div>
                  <button onClick={() => setStep("design")} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg hover:shadow-green-500/30">
                    Proceed to Styling & Detailing <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "design" && analysisResults && (
          <RCBeamDesigner
            analysisResults={analysisResults}
            designParams={currentDesignParams} // Pass full params including support_condition
            analysisMethod={analysisMethod}
            isDark={isDark}
            onBack={() => setStep("calculator")} // Allow going back
          />
        )}
      </div>
    </div>
  );
};

export default StructuralEngineeringSuite;
