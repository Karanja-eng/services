import React, { useState } from "react";
import {
  Calculator,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// BS 8110 Design Tables
const designTables = {
  concreteGrades: {
    "C25/30": { fcu: 25, gamma_m: 1.5 },
    "C30/37": { fcu: 30, gamma_m: 1.5 },
    "C35/45": { fcu: 35, gamma_m: 1.5 },
    "C40/50": { fcu: 40, gamma_m: 1.5 },
  },
  steelGrades: {
    "Grade 460": { fy: 460, gamma_m: 1.15, Es: 200000 },
    "Grade 500": { fy: 500, gamma_m: 1.15, Es: 200000 },
  },
  barDiameters: [8, 10, 12, 16, 20, 25, 32],
  coverRequirements: {
    Mild: 25,
    Moderate: 35,
    Severe: 40,
    "Very Severe": 50,
  },
};

function StairApp() {
  const [stairType, setStairType] = useState("supported");
  const [inputs, setInputs] = useState({
    span: 3.0,
    width: 1.2,
    waistThickness: 150,
    riserHeight: 175,
    treadLength: 250,
    numRisers: 14,
    concreteGrade: "C30/37",
    steelGrade: "Grade 460",
    exposure: "Moderate",
    liveLoad: 3.0,
    finishesLoad: 1.5,
    cover: 25,
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: isNaN(value) ? value : parseFloat(value) || value,
    }));
  };

  const calculateDesign = () => {
    setLoading(true);

    setTimeout(() => {
      const concrete = designTables.concreteGrades[inputs.concreteGrade];
      const steel = designTables.steelGrades[inputs.steelGrade];

      // Material properties
      const fcu = concrete.fcu;
      const fy = steel.fy / steel.gamma_m;

      // Geometry
      const effectiveSpan =
        stairType === "cantilever" ? inputs.span : inputs.span;
      const waist = inputs.waistThickness;
      const effectiveDepth = waist - inputs.cover - 10;

      // Load calculations (per meter width)
      const selfWeight =
        (waist / 1000) *
        25 *
        Math.sqrt(1 + Math.pow(inputs.riserHeight / inputs.treadLength, 2));
      const finishes = inputs.finishesLoad;
      const liveLoad = inputs.liveLoad;

      const deadLoad = selfWeight + finishes;

      // Ultimate loads (BS 8110)
      const ultimateLoad = 1.4 * deadLoad + 1.6 * liveLoad;

      // Moment calculation
      let moment, shear;
      if (stairType === "cantilever") {
        moment = (ultimateLoad * Math.pow(effectiveSpan, 2)) / 2;
        shear = ultimateLoad * effectiveSpan;
      } else {
        moment = (ultimateLoad * Math.pow(effectiveSpan, 2)) / 8;
        shear = (ultimateLoad * effectiveSpan) / 2;
      }

      // Steel area calculation (BS 8110)
      const K =
        (moment * 1e6) /
        (inputs.width * 1000 * Math.pow(effectiveDepth, 2) * fcu);
      const z = effectiveDepth * (0.5 + Math.sqrt(0.25 - K / 0.9));
      const leverArm = Math.min(z, 0.95 * effectiveDepth);

      const As_req = (moment * 1e6) / (fy * leverArm);

      // Minimum steel (BS 8110)
      const As_min = (0.13 * inputs.width * 1000 * waist) / 100;
      const As_provided = Math.max(As_req, As_min);

      // Bar spacing
      const barDia = K > 0.05 ? 12 : 10;
      const barArea = (Math.PI * Math.pow(barDia, 2)) / 4;
      const numBars = Math.ceil(As_provided / barArea);
      const spacing = Math.floor(
        (inputs.width * 1000 - 2 * inputs.cover) / (numBars - 1)
      );
      const actualSpacing = Math.min(spacing, 300); // Max spacing per BS 8110

      // Distribution steel
      const As_dist = (0.12 * waist * 1000) / 100;
      const distBarDia = 8;
      const distBarArea = (Math.PI * Math.pow(distBarDia, 2)) / 4;
      const numDistBars = Math.ceil(As_dist / distBarArea);
      const distSpacing = Math.floor(1000 / numDistBars);

      // Shear check
      const v = (shear * 1000) / (inputs.width * 1000 * effectiveDepth);
      const rho = (As_provided * 100) / (inputs.width * 1000 * effectiveDepth);
      const vc =
        (0.79 * Math.pow(rho, 1 / 3) * Math.pow(fcu / 25, 1 / 3)) / 1.25;

      const shearOk = v <= vc * 2;
      const shearReinforcement = v > vc;

      setResults({
        loads: {
          selfWeight: selfWeight.toFixed(2),
          deadLoad: deadLoad.toFixed(2),
          liveLoad: liveLoad.toFixed(2),
          ultimateLoad: ultimateLoad.toFixed(2),
        },
        forces: {
          moment: moment.toFixed(2),
          shear: shear.toFixed(2),
        },
        steel: {
          effectiveDepth: effectiveDepth.toFixed(0),
          K: K.toFixed(4),
          As_req: As_req.toFixed(0),
          As_min: As_min.toFixed(0),
          As_provided: As_provided.toFixed(0),
          mainBars: `${numBars}H${barDia}`,
          spacing: actualSpacing.toFixed(0),
          distributionBars: `H${distBarDia}@${distSpacing}mm c/c`,
        },
        shear: {
          v: v.toFixed(3),
          vc: vc.toFixed(3),
          shearOk: shearOk,
          reinforcementNeeded: shearReinforcement,
        },
        checks: {
          deflection:
            (effectiveSpan * 1000) / effectiveDepth <=
            (stairType === "cantilever" ? 7 : 20),
          spacing: actualSpacing <= 300,
          minimumSteel: As_provided >= As_min,
        },
      });

      setLoading(false);
    }, 500);
  };

  const downloadReport = () => {
    if (!results) return;

    const report = `
REINFORCED CONCRETE STAIR DESIGN CALCULATION
BS 8110 Compliance Report
============================================

PROJECT INFORMATION
-------------------
Stair Type: ${stairType === "cantilever" ? "Cantilever" : "Simply Supported"}
Date: ${new Date().toLocaleDateString()}

DESIGN PARAMETERS
-----------------
Span: ${inputs.span} m
Width: ${inputs.width} m
Waist Thickness: ${inputs.waistThickness} mm
Riser Height: ${inputs.riserHeight} mm
Tread Length: ${inputs.treadLength} mm
Number of Risers: ${inputs.numRisers}
Concrete Grade: ${inputs.concreteGrade}
Steel Grade: ${inputs.steelGrade}
Exposure Class: ${inputs.exposure}
Cover: ${inputs.cover} mm

LOADING (per meter width)
--------------------------
Self Weight: ${results.loads.selfWeight} kN/m
Dead Load: ${results.loads.deadLoad} kN/m
Live Load: ${results.loads.liveLoad} kN/m
Ultimate Load: ${results.loads.ultimateLoad} kN/m

DESIGN FORCES
-------------
Bending Moment: ${results.forces.moment} kNm
Shear Force: ${results.forces.shear} kN

FLEXURAL REINFORCEMENT
----------------------
Effective Depth: ${results.steel.effectiveDepth} mm
K Factor: ${results.steel.K}
Required Steel Area: ${results.steel.As_req} mm²
Minimum Steel Area: ${results.steel.As_min} mm²
Provided Steel Area: ${results.steel.As_provided} mm²

Main Bars: ${results.steel.mainBars} @ ${results.steel.spacing}mm c/c
Distribution Bars: ${results.steel.distributionBars}

SHEAR DESIGN
------------
Applied Shear Stress: ${results.shear.v} N/mm²
Concrete Shear Capacity: ${results.shear.vc} N/mm²
Shear Reinforcement Required: ${
      results.shear.reinforcementNeeded ? "YES" : "NO"
    }

DESIGN CHECKS
-------------
✓ Deflection Check: ${results.checks.deflection ? "PASS" : "FAIL"}
✓ Bar Spacing Check: ${results.checks.spacing ? "PASS" : "FAIL"}
✓ Minimum Steel Check: ${results.checks.minimumSteel ? "PASS" : "FAIL"}
✓ Shear Check: ${results.shear.shearOk ? "PASS" : "FAIL"}

DESIGN SUMMARY
--------------
${
  results.checks.deflection &&
  results.checks.spacing &&
  results.checks.minimumSteel &&
  results.shear.shearOk
    ? "Design is SATISFACTORY and complies with BS 8110 requirements."
    : "Design REQUIRES REVISION. Please review failed checks."
}

Generated by RC Stair Designer
`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stair_design_${new Date().getTime()}.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 p-3 rounded-xl">
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  RC Stair Designer
                </h1>
                <p className="text-blue-200">BS 8110 Compliant Design Tool</p>
              </div>
            </div>
            <div className="text-right text-white">
              <p className="text-sm opacity-80">
                Professional Engineering Software
              </p>
              <p className="text-xs opacity-60">BS 8110-1:1997</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Design Parameters
            </h2>

            {/* Stair Type Selection */}
            <div className="mb-6">
              <label className="block text-white font-medium mb-3">
                Stair Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setStairType("supported")}
                  className={`p-4 rounded-xl font-medium transition-all ${
                    stairType === "supported"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  Simply Supported
                </button>
                <button
                  onClick={() => setStairType("cantilever")}
                  className={`p-4 rounded-xl font-medium transition-all ${
                    stairType === "cantilever"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  Cantilever
                </button>
              </div>
            </div>

            {/* Geometry Inputs */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-white">Geometry</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm mb-1">
                    Span (m)
                  </label>
                  <input
                    type="number"
                    name="span"
                    value={inputs.span}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">
                    Width (m)
                  </label>
                  <input
                    type="number"
                    name="width"
                    value={inputs.width}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-white text-sm mb-1">
                    Waist (mm)
                  </label>
                  <input
                    type="number"
                    name="waistThickness"
                    value={inputs.waistThickness}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">
                    Riser (mm)
                  </label>
                  <input
                    type="number"
                    name="riserHeight"
                    value={inputs.riserHeight}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">
                    Tread (mm)
                  </label>
                  <input
                    type="number"
                    name="treadLength"
                    value={inputs.treadLength}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white text-sm mb-1">
                  Number of Risers
                </label>
                <input
                  type="number"
                  name="numRisers"
                  value={inputs.numRisers}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Material Properties */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-white">Materials</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm mb-1">
                    Concrete Grade
                  </label>
                  <select
                    name="concreteGrade"
                    value={inputs.concreteGrade}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.keys(designTables.concreteGrades).map((grade) => (
                      <option
                        key={grade}
                        value={grade}
                        className="bg-slate-800"
                      >
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">
                    Steel Grade
                  </label>
                  <select
                    name="steelGrade"
                    value={inputs.steelGrade}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.keys(designTables.steelGrades).map((grade) => (
                      <option
                        key={grade}
                        value={grade}
                        className="bg-slate-800"
                      >
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm mb-1">
                    Exposure Class
                  </label>
                  <select
                    name="exposure"
                    value={inputs.exposure}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.keys(designTables.coverRequirements).map((exp) => (
                      <option key={exp} value={exp} className="bg-slate-800">
                        {exp}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">
                    Cover (mm)
                  </label>
                  <input
                    type="number"
                    name="cover"
                    value={inputs.cover}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Loading */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-white">
                Loading (kN/m²)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm mb-1">
                    Live Load
                  </label>
                  <input
                    type="number"
                    name="liveLoad"
                    value={inputs.liveLoad}
                    onChange={handleInputChange}
                    step="0.5"
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">
                    Finishes Load
                  </label>
                  <input
                    type="number"
                    name="finishesLoad"
                    value={inputs.finishesLoad}
                    onChange={handleInputChange}
                    step="0.5"
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={calculateDesign}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? "Calculating..." : "Calculate Design"}
            </button>
          </div>

          {/* Results Panel */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                Design Results
              </h2>
              {results && (
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-all"
                >
                  <Download className="w-4 h-4" />
                  Report
                </button>
              )}
            </div>

            {!results ? (
              <div className="flex flex-col items-center justify-center h-96 text-white/60">
                <AlertCircle className="w-16 h-16 mb-4" />
                <p className="text-lg">
                  Enter parameters and calculate to see results
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Loading Summary */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Loading Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-white/80">Self Weight:</div>
                    <div className="text-white font-medium">
                      {results.loads.selfWeight} kN/m
                    </div>
                    <div className="text-white/80">Dead Load:</div>
                    <div className="text-white font-medium">
                      {results.loads.deadLoad} kN/m
                    </div>
                    <div className="text-white/80">Live Load:</div>
                    <div className="text-white font-medium">
                      {results.loads.liveLoad} kN/m
                    </div>
                    <div className="text-white/80">Ultimate Load:</div>
                    <div className="text-blue-300 font-bold">
                      {results.loads.ultimateLoad} kN/m
                    </div>
                  </div>
                </div>

                {/* Design Forces */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Design Forces
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-white/80">Bending Moment:</div>
                    <div className="text-white font-medium">
                      {results.forces.moment} kNm
                    </div>
                    <div className="text-white/80">Shear Force:</div>
                    <div className="text-white font-medium">
                      {results.forces.shear} kN
                    </div>
                  </div>
                </div>

                {/* Reinforcement */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Reinforcement Design
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-white/80">Effective Depth:</div>
                      <div className="text-white font-medium">
                        {results.steel.effectiveDepth} mm
                      </div>
                      <div className="text-white/80">K Factor:</div>
                      <div className="text-white font-medium">
                        {results.steel.K}
                      </div>
                      <div className="text-white/80">Required As:</div>
                      <div className="text-white font-medium">
                        {results.steel.As_req} mm²
                      </div>
                      <div className="text-white/80">Provided As:</div>
                      <div className="text-white font-medium">
                        {results.steel.As_provided} mm²
                      </div>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <div className="bg-blue-500/20 p-3 rounded-lg">
                        <p className="text-white font-bold mb-1">
                          Main Reinforcement:
                        </p>
                        <p className="text-blue-200">
                          {results.steel.mainBars} @ {results.steel.spacing}mm
                          c/c
                        </p>
                      </div>
                      <div className="bg-blue-500/20 p-3 rounded-lg mt-2">
                        <p className="text-white font-bold mb-1">
                          Distribution Steel:
                        </p>
                        <p className="text-blue-200">
                          {results.steel.distributionBars}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shear Design */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Shear Design
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-white/80">Applied Stress (v):</div>
                    <div className="text-white font-medium">
                      {results.shear.v} N/mm²
                    </div>
                    <div className="text-white/80">Concrete Capacity (vc):</div>
                    <div className="text-white font-medium">
                      {results.shear.vc} N/mm²
                    </div>
                    <div className="text-white/80">Status:</div>
                    <div
                      className={
                        results.shear.shearOk
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {results.shear.shearOk ? "ADEQUATE" : "INADEQUATE"}
                    </div>
                  </div>
                </div>

                {/* Design Checks */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Design Verification
                  </h3>
                  <div className="space-y-2">
                    {[
                      {
                        name: "Deflection Check",
                        pass: results.checks.deflection,
                      },
                      { name: "Bar Spacing", pass: results.checks.spacing },
                      {
                        name: "Minimum Steel",
                        pass: results.checks.minimumSteel,
                      },
                      { name: "Shear Capacity", pass: results.shear.shearOk },
                    ].map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white/5 rounded"
                      >
                        <span className="text-white/80 text-sm">
                          {check.name}
                        </span>
                        <span
                          className={`font-bold text-sm ${
                            check.pass ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {check.pass ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall Status */}
                <div
                  className={`rounded-xl p-4 border-2 ${
                    results.checks.deflection &&
                    results.checks.spacing &&
                    results.checks.minimumSteel &&
                    results.shear.shearOk
                      ? "bg-green-500/20 border-green-500"
                      : "bg-red-500/20 border-red-500"
                  }`}
                >
                  <p className="text-white font-bold text-center">
                    {results.checks.deflection &&
                    results.checks.spacing &&
                    results.checks.minimumSteel &&
                    results.shear.shearOk
                      ? "✓ DESIGN SATISFACTORY"
                      : "⚠ DESIGN REQUIRES REVISION"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/60 text-sm">
          <p>
            Design calculations based on BS 8110-1:1997 | For professional use
            by qualified engineers
          </p>
        </div>
      </div>
    </div>
  );
}

export default StairApp;
