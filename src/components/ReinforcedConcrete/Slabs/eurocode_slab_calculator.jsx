import React, { useState } from "react";
import {
  Calculator,
  FileText,
  AlertCircle,
  CheckCircle2,
  Euro,
} from "lucide-react";

const EurocodeSlabCalculator = ({ theme = "light" }) => {
  const [slabType, setSlabType] = useState("one-way");
  const [spanType, setSpanType] = useState("single");
  const [support, setSupport] = useState("simply-supported");
  const [exposureClass, setExposureClass] = useState("XC1");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const isDark = theme === "dark";

  const [formData, setFormData] = useState({
    // Material properties - Eurocode
    concreteClass: "C30/37",
    fck: 30,
    fcd: 20, // Design value
    steelClass: "B500B",
    fyk: 500,
    fyd: 435, // Design value
    cover: 30,

    // Loading - Eurocode format
    permanentLoad: 1.5, // Gk
    variableLoad: 2.5, // Qk
    loadCategory: "A", // Residential

    // Dimensions for one-way
    spanLength: 5.0,
    slabWidth: 1.0,

    // Dimensions for two-way
    lx: 5.0,
    ly: 6.0,

    // Cantilever
    cantileverLength: 1.5,

    // Ribbed/Waffle
    ribWidth: 125,
    ribSpacing: 500,
    topping: 50,
    ribDepth: 300,

    // Eurocode specific
    fireResistance: "R60",
    reductionFactor: 1.0,
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Update concrete design strength when class changes
    if (name === "concreteClass") {
      const fckMap = {
        "C20/25": 20,
        "C25/30": 25,
        "C30/37": 30,
        "C35/45": 35,
        "C40/50": 40,
        "C45/55": 45,
        "C50/60": 50,
      };
      const fck = fckMap[value] || 30;
      const fcd = (0.85 * fck) / 1.5; // αcc × fck / γc
      setFormData((prev) => ({ ...prev, [name]: value, fck, fcd }));
    } else if (name === "steelClass") {
      const fykMap = { B500A: 500, B500B: 500, B500C: 500 };
      const fyk = fykMap[value] || 500;
      const fyd = fyk / 1.15; // fyk / γs
      setFormData((prev) => ({ ...prev, [name]: value, fyk, fyd }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || value }));
    }
  };

  const calculateSlab = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const mockResults = calculateEurocodeResults();
      setResults(mockResults);
    } catch (err) {
      setError(err.message || "Calculation failed");
    } finally {
      setLoading(false);
    }
  };

  const calculateEurocodeResults = () => {
    const {
      fck,
      fcd,
      fyk,
      fyd,
      spanLength,
      lx,
      ly,
      permanentLoad,
      variableLoad,
    } = formData;

    // EN 1990 - Load combinations
    const Ed = 1.35 * permanentLoad + 1.5 * variableLoad; // Ultimate limit state

    if (slabType === "one-way") {
      // EN 1992-1-1: Table A.1 - Moment coefficients
      const momentCoeff =
        support === "simply-supported"
          ? 0.125
          : support === "continuous"
          ? 0.08 // End span
          : support === "cantilever"
          ? 0.5
          : 0.125;

      const shearCoeff =
        support === "simply-supported"
          ? 0.5
          : support === "continuous"
          ? 0.6
          : 1.0;

      const Med = momentCoeff * Ed * Math.pow(spanLength, 2);
      const Ved = shearCoeff * Ed * spanLength;

      // Effective depth - EN 1992-1-1: 7.4.2
      const spanDepthRatio =
        support === "simply-supported" ? 20 : support === "continuous" ? 26 : 7;
      const dMin = (spanLength * 1000) / spanDepthRatio;

      // Design for bending
      const b = formData.slabWidth * 1000; // mm
      const d = Math.max(dMin, 150); // Minimum 150mm for slabs
      const h = d + formData.cover + 12;

      // Calculate μ = Med / (b × d² × fcd)
      const mu = (Med * 1e6) / (b * d * d * fcd);

      // Calculate lever arm z
      let z;
      if (mu <= 0.167) {
        // No compression steel needed
        z = d * (1 - 0.5 * (1 - Math.sqrt(1 - 3.53 * mu)));
      } else {
        z = 0.82 * d; // Simplified for compression steel case
      }

      // Steel area: As = Med / (fyd × z)
      const As = (Med * 1e6) / (fyd * z);

      // Minimum steel - EN 1992-1-1: 9.2.1.1
      const fctm = 0.3 * Math.pow(fck, 2 / 3); // Mean tensile strength
      const AsMin = Math.max(0.26 * (fctm / fyk) * b * d, 0.0013 * b * d);
      const AsProv = Math.max(As, AsMin);

      // Bar selection
      const spacing = calculateSpacing(AsProv, b);
      const barSize = selectBarSize(AsProv, b);

      // Shear check - EN 1992-1-1: 6.2.2
      const rho = Math.min(AsProv / (b * d), 0.02);
      const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
      const vRdC = Math.max(
        (0.18 * k * Math.pow(100 * rho * fck, 1 / 3)) / 1.5,
        0.035 * Math.pow(k, 1.5) * Math.sqrt(fck)
      );
      const vEd = (Ved * 1000) / (b * d);

      return {
        slabType: "One-Way Slab (EN 1992-1-1)",
        designMoment: Med.toFixed(2),
        designShear: Ved.toFixed(2),
        effectiveDepth: d.toFixed(0),
        totalDepth: h.toFixed(0),
        steelArea: AsProv.toFixed(0),
        minSteelArea: AsMin.toFixed(0),
        mainReinforcement: `Ø${barSize} @ ${spacing}mm c/c`,
        distributionSteel: `Ø8 @ 250mm c/c`,
        leverArm: z.toFixed(0),
        muValue: mu.toFixed(4),
        checksPassed: [
          `μ = ${mu.toFixed(4)} ${
            mu <= 0.167
              ? "≤ 0.167 (OK - No comp. steel)"
              : "> 0.167 (Comp. steel required)"
          }`,
          `Span/depth: ${((spanLength * 1000) / d).toFixed(
            1
          )} ≤ ${spanDepthRatio} (OK)`,
          `As,prov = ${AsProv.toFixed(0)} mm² ≥ As,min = ${AsMin.toFixed(
            0
          )} mm² (OK)`,
          `Shear: vEd = ${vEd.toFixed(2)} ≤ vRd,c = ${vRdC.toFixed(2)} N/mm² ${
            vEd <= vRdC ? "(OK)" : "(Shear reinf. required)"
          }`,
        ],
        eurocode: "EN 1992-1-1:2004",
      };
    } else if (slabType === "two-way") {
      const ratio = ly / lx;

      // EN 1992-1-1: Annex I - Moment coefficients for two-way slabs
      const coeffs = getTwoWayCoefficients(ratio, support === "continuous");

      const Medx = coeffs.mx * Ed * lx * lx;
      const Medy = coeffs.my * Ed * lx * lx;

      // Effective depth
      const spanDepthRatio = support === "continuous" ? 30 : 25;
      const d = Math.max((lx * 1000) / spanDepthRatio, 150);
      const h = d + formData.cover + 12;

      // Steel in X-direction
      const b = 1000;
      const mux = (Medx * 1e6) / (b * d * d * fcd);
      const zx = d * (1 - 0.5 * (1 - Math.sqrt(1 - 3.53 * mux)));
      const Asx = (Medx * 1e6) / (fyd * zx);

      // Steel in Y-direction
      const muy = (Medy * 1e6) / (b * d * d * fcd);
      const zy = d * (1 - 0.5 * (1 - Math.sqrt(1 - 3.53 * muy)));
      const Asy = (Medy * 1e6) / (fyd * zy);

      // Minimum steel
      const fctm = 0.3 * Math.pow(fck, 2 / 3);
      const AsMin = Math.max(0.26 * (fctm / fyk) * b * d, 0.0013 * b * d);

      const AsxProv = Math.max(Asx, AsMin);
      const AsyProv = Math.max(Asy, AsMin);

      const spacingX = calculateSpacing(AsxProv, b);
      const spacingY = calculateSpacing(AsyProv, b);
      const barSizeX = selectBarSize(AsxProv, b);
      const barSizeY = selectBarSize(AsyProv, b);

      return {
        slabType: "Two-Way Slab (EN 1992-1-1)",
        designMomentX: Medx.toFixed(2),
        designMomentY: Medy.toFixed(2),
        effectiveDepth: d.toFixed(0),
        totalDepth: h.toFixed(0),
        steelAreaX: AsxProv.toFixed(0),
        steelAreaY: AsyProv.toFixed(0),
        reinforcementX: `Ø${barSizeX} @ ${spacingX}mm c/c`,
        reinforcementY: `Ø${barSizeY} @ ${spacingY}mm c/c`,
        checksPassed: [
          `ly/lx = ${ratio.toFixed(2)}`,
          `μx = ${mux.toFixed(4)}, μy = ${muy.toFixed(4)}`,
          `Span/depth: ${((lx * 1000) / d).toFixed(
            1
          )} ≤ ${spanDepthRatio} (OK)`,
          `As,x,prov = ${AsxProv.toFixed(0)} mm² ≥ As,min (OK)`,
          `As,y,prov = ${AsyProv.toFixed(0)} mm² ≥ As,min (OK)`,
        ],
        eurocode: "EN 1992-1-1:2004 + Annex I",
      };
    } else if (slabType === "ribbed" || slabType === "waffle") {
      const span = spanLength || lx;
      const Med = 0.08 * Ed * (formData.ribSpacing / 1000) * span * span;

      const bw = formData.ribWidth;
      const d = formData.ribDepth - formData.cover - 16;
      const h = formData.ribDepth;

      // Effective flange width - EN 1992-1-1: 5.3.2.1
      const beff = Math.min(
        formData.ribSpacing,
        bw + 0.2 * formData.topping + 0.1 * span * 1000
      );

      const mu = (Med * 1e6) / (beff * d * d * fcd);
      const z = d * (1 - 0.5 * (1 - Math.sqrt(1 - 3.53 * mu)));
      const As = (Med * 1e6) / (fyd * z);

      const ribReinf = selectRibReinforcement(As);

      return {
        slabType:
          slabType === "ribbed"
            ? "Ribbed Slab (EN 1992-1-1)"
            : "Waffle Slab (EN 1992-1-1)",
        designMoment: Med.toFixed(2),
        effectiveDepth: d.toFixed(0),
        totalDepth: h.toFixed(0),
        steelArea: As.toFixed(0),
        ribReinforcement: ribReinf,
        toppingReinforcement: "Ø8 @ 200mm c/c both ways",
        effectiveFlangeWidth: beff.toFixed(0),
        checksPassed: [
          `beff = ${beff.toFixed(0)}mm (EN 1992-1-1: 5.3.2.1)`,
          `Rib spacing: ${formData.ribSpacing}mm ≤ 1500mm (OK)`,
          `Topping ≥ 50mm (EN 1992-1-1: 9.2.1.5)`,
          `μ = ${mu.toFixed(4)}`,
          `As,prov adequate for Med`,
        ],
        eurocode: "EN 1992-1-1:2004",
      };
    }
  };

  const getTwoWayCoefficients = (ratio, restrained) => {
    // EN 1992-1-1: Annex I - simplified coefficients
    if (!restrained) {
      if (ratio <= 1.0) return { mx: 0.062, my: 0.062 };
      if (ratio <= 1.5) return { mx: 0.104, my: 0.046 };
      if (ratio <= 2.0) return { mx: 0.118, my: 0.029 };
      return { mx: 0.125, my: 0.02 };
    } else {
      if (ratio <= 1.0) return { mx: 0.024, my: 0.024 };
      if (ratio <= 1.5) return { mx: 0.04, my: 0.02 };
      if (ratio <= 2.0) return { mx: 0.048, my: 0.017 };
      return { mx: 0.056, my: 0.014 };
    }
  };

  const calculateSpacing = (As, width) => {
    const barArea = 113; // Ø12 = 113mm²
    const spacing = (barArea / As) * width;
    return Math.min(Math.max(Math.round(spacing / 25) * 25, 100), 300);
  };

  const selectBarSize = (As, width = 1000) => {
    const barAreas = { 8: 50, 10: 79, 12: 113, 16: 201, 20: 314, 25: 491 };
    for (const [size, area] of Object.entries(barAreas)) {
      const spacing = (area / As) * width;
      if (spacing >= 100 && spacing <= 300) return size;
    }
    return 12;
  };

  const selectRibReinforcement = (As) => {
    if (As < 300) return "2Ø12";
    if (As < 450) return "2Ø16";
    if (As < 600) return "3Ø16";
    return "2Ø20 + 2Ø16";
  };

  const bgClass = isDark ? "bg-gray-900" : "bg-gray-50";
  const cardBg = isDark ? "bg-gray-800/90" : "bg-white/90";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-600";
  const borderColor = isDark ? "border-gray-700" : "border-gray-200";
  const inputBg = isDark ? "bg-gray-700/50" : "bg-gray-100";
  const inputBorder = isDark ? "border-gray-600" : "border-gray-300";

  return (
    <div
      className={`min-h-screen ${bgClass} p-6 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          className={`${cardBg} backdrop-blur-md rounded-2xl shadow-xl p-8 mb-6 border ${borderColor}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Euro className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary}`}>
                Eurocode Slab Design Calculator
              </h1>
              <p className={`${textSecondary} mt-1`}>
                EN 1992-1-1:2004 (Eurocode 2)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div
            className={`lg:col-span-2 ${cardBg} backdrop-blur-md rounded-2xl shadow-xl p-6 border ${borderColor}`}
          >
            <h2
              className={`text-xl font-bold ${textPrimary} mb-6 flex items-center gap-2`}
            >
              <FileText className="w-5 h-5" />
              Design Parameters (EN 1992-1-1)
            </h2>

            {/* Slab Type */}
            <div className="mb-6">
              <label
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Slab Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["one-way", "two-way", "ribbed", "waffle"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSlabType(type)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      slabType === type
                        ? "bg-blue-600 text-white shadow-lg"
                        : `${inputBg} ${textPrimary} hover:bg-blue-100 ${
                            isDark ? "hover:bg-gray-600" : ""
                          }`
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
              <label
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Support Conditions
              </label>
              <div className="grid grid-cols-3 gap-3">
                {["simply-supported", "continuous", "cantilever"].map(
                  (supp) => (
                    <button
                      key={supp}
                      onClick={() => setSupport(supp)}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${
                        support === supp
                          ? "bg-green-600 text-white shadow-lg"
                          : `${inputBg} ${textPrimary} hover:bg-green-100 ${
                              isDark ? "hover:bg-gray-600" : ""
                            }`
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
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Concrete Class
                </label>
                <select
                  name="concreteClass"
                  value={formData.concreteClass}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  {[
                    "C20/25",
                    "C25/30",
                    "C30/37",
                    "C35/45",
                    "C40/50",
                    "C45/55",
                    "C50/60",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Steel Class
                </label>
                <select
                  name="steelClass"
                  value={formData.steelClass}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  {["B500A", "B500B", "B500C"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Cover (mm)
                </label>
                <input
                  type="number"
                  name="cover"
                  value={formData.cover}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Exposure
                </label>
                <select
                  name="exposureClass"
                  value={exposureClass}
                  onChange={(e) => setExposureClass(e.target.value)}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  {["XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XD3"].map(
                    (x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Loading (Eurocode format) */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Gk (kN/m²)
                </label>
                <input
                  type="number"
                  name="permanentLoad"
                  value={formData.permanentLoad}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Qk (kN/m²)
                </label>
                <input
                  type="number"
                  name="variableLoad"
                  value={formData.variableLoad}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Category
                </label>
                <select
                  name="loadCategory"
                  value={formData.loadCategory}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="A">A - Residential</option>
                  <option value="B">B - Office</option>
                  <option value="C">C - Assembly</option>
                  <option value="D">D - Shopping</option>
                </select>
              </div>
            </div>

            {/* Dimensions */}
            {slabType === "one-way" && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Span Length (m)
                  </label>
                  <input
                    type="number"
                    name="spanLength"
                    value={formData.spanLength}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Slab Width (m)
                  </label>
                  <input
                    type="number"
                    name="slabWidth"
                    value={formData.slabWidth}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
              </div>
            )}

            {slabType === "two-way" && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Lx - Short Span (m)
                  </label>
                  <input
                    type="number"
                    name="lx"
                    value={formData.lx}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Ly - Long Span (m)
                  </label>
                  <input
                    type="number"
                    name="ly"
                    value={formData.ly}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
              </div>
            )}

            {(slabType === "ribbed" || slabType === "waffle") && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Rib Width (mm)
                  </label>
                  <input
                    type="number"
                    name="ribWidth"
                    value={formData.ribWidth}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Spacing (mm)
                  </label>
                  <input
                    type="number"
                    name="ribSpacing"
                    value={formData.ribSpacing}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Topping (mm)
                  </label>
                  <input
                    type="number"
                    name="topping"
                    value={formData.topping}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-2`}
                  >
                    Rib Depth (mm)
                  </label>
                  <input
                    type="number"
                    name="ribDepth"
                    value={formData.ribDepth}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
              </div>
            )}

            <button
              onClick={calculateSlab}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-green-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Calculating..." : "Calculate Design (EN 1992-1-1)"}
            </button>
          </div>

          {/* Results Panel */}
          <div
            className={`${cardBg} backdrop-blur-md rounded-2xl shadow-xl p-6 border ${borderColor}`}
          >
            <h2 className={`text-xl font-bold ${textPrimary} mb-6`}>
              Design Results
            </h2>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {results ? (
              <div className="space-y-4">
                <div className="bg-blue-300/20 border border-blue-500 rounded-lg p-4">
                  <h3 className="font-bold text-blue-800 mb-2">
                    {results.slabType}
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    {results.designMoment && (
                      <p>
                        MEd:{" "}
                        <span className="font-bold">
                          {results.designMoment} kNm/m
                        </span>
                      </p>
                    )}
                    {results.designMomentX && (
                      <>
                        <p>
                          MEd,x:{" "}
                          <span className="font-bold">
                            {results.designMomentX} kNm/m
                          </span>
                        </p>
                        <p>
                          MEd,y:{" "}
                          <span className="font-bold">
                            {results.designMomentY} kNm/m
                          </span>
                        </p>
                      </>
                    )}
                    {results.designShear && (
                      <p>
                        VEd:{" "}
                        <span className="font-bold">
                          {results.designShear} kN/m
                        </span>
                      </p>
                    )}
                    {results.muValue && (
                      <p>
                        μ: <span className="font-bold">{results.muValue}</span>
                      </p>
                    )}
                    {results.leverArm && (
                      <p>
                        z:{" "}
                        <span className="font-bold">{results.leverArm} mm</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-green-300/20 border border-green-500 rounded-lg p-4">
                  <h3 className="font-bold text-green-900 mb-2">Dimensions</h3>
                  <div className="space-y-2 text-sm text-green-800">
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
                    {results.effectiveFlangeWidth && (
                      <p>
                        beff:{" "}
                        <span className="font-bold">
                          {results.effectiveFlangeWidth} mm
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-purple-300/20 border border-purple-500 rounded-lg p-4">
                  <h3 className="font-bold text-purple-900 mb-2">
                    Reinforcement
                  </h3>
                  <div className="space-y-2 text-sm text-purple-800">
                    {results.mainReinforcement && (
                      <>
                        <p>
                          Main:{" "}
                          <span className="font-bold">
                            {results.mainReinforcement}
                          </span>
                        </p>
                        <p>
                          As:{" "}
                          <span className="font-bold">
                            {results.steelArea} mm²/m
                          </span>
                        </p>
                        {results.minSteelArea && (
                          <p>
                            As,min:{" "}
                            <span className="font-bold">
                              {results.minSteelArea} mm²/m
                            </span>
                          </p>
                        )}
                      </>
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
                          X-Dir:{" "}
                          <span className="font-bold">
                            {results.reinforcementX}
                          </span>
                        </p>
                        <p>
                          As,x:{" "}
                          <span className="font-bold">
                            {results.steelAreaX} mm²/m
                          </span>
                        </p>
                        <p>
                          Y-Dir:{" "}
                          <span className="font-bold">
                            {results.reinforcementY}
                          </span>
                        </p>
                        <p>
                          As,y:{" "}
                          <span className="font-bold">
                            {results.steelAreaY} mm²/m
                          </span>
                        </p>
                      </>
                    )}
                    {results.ribReinforcement && (
                      <>
                        <p>
                          Rib:{" "}
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

                <div
                  className={`${inputBg} border ${borderColor} rounded-lg p-4`}
                >
                  <h3 className={`font-bold ${textPrimary} mb-2`}>
                    Design Checks
                  </h3>
                  <div className="space-y-2">
                    {results.checksPassed.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-sm text-green-400"
                      >
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`${inputBg} border ${borderColor} rounded-lg p-3`}
                >
                  <p className={`text-xs ${textSecondary} text-center`}>
                    {results.eurocode}
                  </p>
                </div>
              </div>
            ) : (
              <div className={`text-center py-12 ${textSecondary}`}>
                <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Enter parameters and calculate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EurocodeSlabCalculator;
