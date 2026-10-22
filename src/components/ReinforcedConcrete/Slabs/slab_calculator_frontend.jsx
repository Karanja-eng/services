import React, { useState } from "react";
import { Calculator, FileText, AlertCircle, CheckCircle2, Eye } from "lucide-react";
import Slab3DVisualization from "../../components/slab_3d_helper";
import SlabDrawer from "./SlabDrawer";

const SlabCalculator = () => {
  const [slabType, setSlabType] = useState("one-way");
  const [spanType, setSpanType] = useState("single");
  const [support, setSupport] = useState("simply-supported");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [show2D, setShow2D] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    // Material properties
    fck: 30,
    fy: 500,
    exposureClass: "XC1",
    maxAggregate: 20,
    fireResistance: 1.0,
    surfaceFalls: 0,
    finishThickness: 0,

    // Loading
    deadLoad: 1.5,
    liveLoad: 2.5,

    // Dimensions for one-way
    spanLength: 5.0,
    slabWidth: 1.0,

    // Dimensions for two-way
    lx: 5.0,
    ly: 6.0,
    edgeConditions: "Four edges continuous",

    // Cantilever
    cantileverLength: 1.5,
    backspanLength: 3.0,

    // Ribbed/Waffle
    ribWidth: 125,
    ribSpacing: 500,
    topping: 50,
    ribDepth: 300,
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const calculateSlab = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Prepare request data
      const requestData = {
        slabType,
        spanType,
        support,
        ...formData
      };

      // Call enhanced backend API
      const response = await fetch("http://localhost:8001/slab_backend/api/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Calculation failed");
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message || "Calculation failed");
      console.error("Calculation error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md p-8 mb-6 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-xl">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                BS 8110 Slab Design Calculator
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Professional Structural Engineering Tool
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl shadow-md p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Design Parameters
            </h2>

            {/* Slab Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Slab Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["one-way", "two-way", "ribbed", "waffle"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSlabType(type)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${slabType === type
                      ? "bg-blue-500 text-white shadow-md dark:bg-blue-400 dark:text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                  >
                    {type
                      .split("-")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Support Conditions */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support Conditions
              </label>
              <div className="grid grid-cols-3 gap-3">
                {["simply-supported", "continuous", "cantilever"].map(
                  (supp) => (
                    <button
                      key={supp}
                      onClick={() => setSupport(supp)}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${support === supp
                        ? "bg-green-500 text-white shadow-md dark:bg-green-400 dark:text-white"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        }`}
                    >
                      {supp
                        .split("-")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Material Properties */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  fck (N/mm²)
                </label>
                <input
                  type="number"
                  name="fck"
                  value={formData.fck}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  fy (N/mm²)
                </label>
                <input
                  type="number"
                  name="fy"
                  value={formData.fy}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exposure Class
                </label>
                <select
                  name="exposureClass"
                  value={formData.exposureClass}
                  onChange={(e) => setFormData(prev => ({ ...prev, exposureClass: e.target.value }))}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="XC1">XC1 (Internal)</option>
                  <option value="XC3">XC3 (External)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fire Resistance (h)
                </label>
                <input
                  type="number"
                  name="fireResistance"
                  value={formData.fireResistance}
                  onChange={handleInputChange}
                  step="0.5"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Loading */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dead Load (kN/m²)
                </label>
                <input
                  type="number"
                  name="deadLoad"
                  value={formData.deadLoad}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Live Load (kN/m²)
                </label>
                <input
                  type="number"
                  name="liveLoad"
                  value={formData.liveLoad}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Dimensions based on slab type */}
            {slabType === "one-way" && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Span Length (m)
                  </label>
                  <input
                    type="number"
                    name="spanLength"
                    value={formData.spanLength}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Slab Width (m)
                  </label>
                  <input
                    type="number"
                    name="slabWidth"
                    value={formData.slabWidth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {slabType === "two-way" && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lx - Short Span (m)
                  </label>
                  <input
                    type="number"
                    name="lx"
                    value={formData.lx}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ly - Long Span (m)
                  </label>
                  <input
                    type="number"
                    name="ly"
                    value={formData.ly}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {(slabType === "ribbed" || slabType === "waffle") && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rib Width (mm)
                  </label>
                  <input
                    type="number"
                    name="ribWidth"
                    value={formData.ribWidth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rib Spacing (mm)
                  </label>
                  <input
                    type="number"
                    name="ribSpacing"
                    value={formData.ribSpacing}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Topping (mm)
                  </label>
                  <input
                    type="number"
                    name="topping"
                    value={formData.topping}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rib Depth (mm)
                  </label>
                  <input
                    type="number"
                    name="ribDepth"
                    value={formData.ribDepth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <button
              onClick={calculateSlab}
              disabled={loading}
              className="w-full bg-blue-500 text-white font-bold py-4 px-6 rounded-xl hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-500 transition-all shadow-md disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? "Calculating..." : "Calculate Design"}
            </button>
          </div>

          {/* Results Panel */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6">
              Design Results
            </h2>

            {error && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-500 dark:border-red-400 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {results ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 border border-blue-500 dark:border-blue-400 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                    {results.slabType}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {results.bendingMoment && (
                      <p>
                        Bending Moment:{" "}
                        <span className="font-bold">
                          {results.bendingMoment} kNm
                        </span>
                      </p>
                    )}
                    {results.bendingMomentX && (
                      <>
                        <p>
                          Mx:{" "}
                          <span className="font-bold">
                            {results.bendingMomentX} kNm
                          </span>
                        </p>
                        <p>
                          My:{" "}
                          <span className="font-bold">
                            {results.bendingMomentY} kNm
                          </span>
                        </p>
                      </>
                    )}
                    {results.shearForce && (
                      <p>
                        Shear Force:{" "}
                        <span className="font-bold">
                          {results.shearForce} kN
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-green-500 dark:border-green-400 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                    Dimensions
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      Effective Depth:{" "}
                      <span className="font-bold">
                        {results.effectiveDepth} mm
                      </span>
                    </p>
                    <p>
                      Total Depth:{" "}
                      <span className="font-bold">{results.totalDepth} mm</span>
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-blue-500 dark:border-blue-400 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                    Reinforcement
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {results.mainReinforcement && (
                      <p>
                        Main Steel:{" "}
                        <span className="font-bold">
                          {results.mainReinforcement}
                        </span>
                      </p>
                    )}
                    {results.distributionSteel && (
                      <p>
                        Distribution:{" "}
                        <span className="font-bold">
                          {results.distributionSteel}
                        </span>
                      </p>
                    )}
                    {results.reinforcementX && (
                      <>
                        <p>
                          X-Direction:{" "}
                          <span className="font-bold">
                            {results.reinforcementX}
                          </span>
                        </p>
                        <p>
                          Y-Direction:{" "}
                          <span className="font-bold">
                            {results.reinforcementY}
                          </span>
                        </p>
                      </>
                    )}
                    {results.ribReinforcement && (
                      <>
                        <p>
                          Rib Steel:{" "}
                          <span className="font-bold">
                            {results.ribReinforcement}
                          </span>
                        </p>
                        <p>
                          Topping:{" "}
                          <span className="font-bold">
                            {results.toppingReinforcement}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                    Design Checks
                  </h3>
                  <div className="space-y-2">
                    {results.checksPassed.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailing Information */}
                {results.nominalCover && (
                  <div className="bg-gray-50 dark:bg-gray-700 border border-purple-500 dark:border-purple-400 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                      Detailing Information
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <p>Nominal Cover: <span className="font-bold">{results.nominalCover}mm</span></p>
                      <p>Actual Cover: <span className="font-bold">{results.actualCover}mm</span></p>
                      <p>Min Reinforcement: <span className="font-bold">{results.minReinforcement}mm²</span></p>
                      <p>Max Bar Spacing: <span className="font-bold">{results.maxBarSpacing}mm</span></p>
                      <p>Min Bar Spacing: <span className="font-bold">{results.minBarSpacing}mm</span></p>
                      <p>Anchorage Length: <span className="font-bold">{results.anchorageLength}mm</span></p>
                      <p>Lap Length: <span className="font-bold">{results.lapLength}mm</span></p>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {results.warnings && results.warnings.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-500 dark:border-yellow-400 rounded-lg p-4">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Warnings
                    </h3>
                    <div className="space-y-1">
                      {results.warnings.map((warning, idx) => (
                        <p key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                          • {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2D Drawer Toggle */}
                <button
                  onClick={() => setShow2D(!show2D)}
                  className="w-full bg-purple-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-purple-600 dark:bg-purple-400 dark:hover:bg-purple-500 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  {show2D ? "Hide" : "Show"} 2D Section Drawing
                </button>

                {/* 2D Drawer */}
                {show2D && results.barLayout && (
                  <SlabDrawer
                    config={{
                      slabDepth: results.totalDepth,
                      effectiveDepth: results.effectiveDepth,
                      cover: results.actualCover,
                      ...results.barLayout,
                      ribWidth: results.designDetails?.rib_width,
                      ribSpacing: results.designDetails?.rib_spacing,
                      toppingThickness: results.designDetails?.topping_thickness,
                    }}
                    section="both"
                    showLabels={true}
                    slabType={slabType}
                  />
                )}

                {/* 3D Visualization Component */}
                <Slab3DVisualization
                  inputs={formData}
                  results={results}
                  theme="light"
                  slabType={slabType}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Enter parameters and click Calculate to see results</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>
            Designed according to BS 8110 & EC2 | Professional Structural Engineering Tool
          </p>
        </div>
      </div>
    </div>
  );
};

export default SlabCalculator;

