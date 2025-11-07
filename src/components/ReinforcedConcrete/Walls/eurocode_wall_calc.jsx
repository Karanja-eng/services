import React, { useState, useEffect } from "react";
import {
  Calculator,
  Building2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Euro,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8001/eurocode_walls/";

const EurocodeWallCalculator = ({ isDark = false }) => {
  const [wallType, setWallType] = useState("shear");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");

  const [inputs, setInputs] = useState({
    height: 3.5,
    length: 4.0,
    thickness: 200,
    axialLoad: 1500,
    shearForce: 250,
    moment: 350,
    concreteClass: "C30/37",
    steelClass: "B500B",
    coverDepth: 40,
    exposureClass: "XC3",
    fireResistance: "R60",
    nationalAnnex: "EN",
  });

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        setApiStatus(response.ok ? "connected" : "error");
      } catch (err) {
        setApiStatus("error");
      }
    };

    checkApiHealth();
  }, []);

  const handleInputChange = (e) => {
    setInputs({
      ...inputs,
      [e.target.name]: parseFloat(e.target.value) || e.target.value,
    });
  };

  const calculateDesign = async () => {
    if (apiStatus !== "connected") {
      setError("API is not connected");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/eurocode/design`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallType,
          ...inputs,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Design calculation failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Calculation failed");
    } finally {
      setLoading(false);
    }
  };

  const bgMain = isDark ? "bg-gray-900" : "bg-gray-50";
  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-800";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-300";
  const bgInput = isDark ? "bg-gray-700" : "bg-white";
  const bgAccent = isDark ? "bg-gray-700" : "bg-gray-50";

  return (
    <div
      className={`min-h-screen ${bgMain} p-6 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${bgCard} rounded-lg shadow-md p-6 mb-6`}>
          <div className="flex items-center gap-3 mb-2">
            <Euro className="w-8 h-8 text-blue-600" />
            <h1 className={`text-3xl font-bold ${textPrimary}`}>
              Eurocode RC Wall Design
            </h1>
          </div>
          <p className={textSecondary}>
            Comprehensive wall design per EN 1992-1-1:2004 (Eurocode 2)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Wall Type */}
            <div className={`${bgCard} rounded-lg shadow-md p-6`}>
              <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                Wall Type
              </h2>
              <div className="space-y-2">
                {[
                  { value: "shear", label: "Shear Wall" },
                  { value: "core", label: "Core Wall" },
                  { value: "basement", label: "Basement Wall" },
                  { value: "loadbearing", label: "Load Bearing Wall" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setWallType(type.value)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                      wallType === type.value
                        ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md"
                        : isDark
                        ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Geometry */}
            <div className={`${bgCard} rounded-lg shadow-md p-6`}>
              <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                Geometry (EC2 Clause 5.3)
              </h2>
              <div className="space-y-4">
                {[
                  { name: "height", label: "Height (m)", step: "0.1" },
                  { name: "length", label: "Length (m)", step: "0.1" },
                  { name: "thickness", label: "Thickness (mm)", step: "10" },
                ].map((field) => (
                  <div key={field.name}>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-1`}
                    >
                      {field.label}
                    </label>
                    <input
                      type="number"
                      name={field.name}
                      value={inputs[field.name]}
                      onChange={handleInputChange}
                      step={field.step}
                      className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Design Actions */}
            <div className={`${bgCard} rounded-lg shadow-md p-6`}>
              <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                Design Actions (EC2 Clause 6.1)
              </h2>
              <div className="space-y-4">
                {[
                  { name: "axialLoad", label: "NEd - Axial Load (kN)" },
                  { name: "shearForce", label: "VEd - Shear Force (kN)" },
                  { name: "moment", label: "MEd - Bending Moment (kNm)" },
                ].map((field) => (
                  <div key={field.name}>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-1`}
                    >
                      {field.label}
                    </label>
                    <input
                      type="number"
                      name={field.name}
                      value={inputs[field.name]}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Materials */}
            <div className={`${bgCard} rounded-lg shadow-md p-6`}>
              <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                Materials (EC2 Table 3.1)
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Concrete Class
                  </label>
                  <select
                    name="concreteClass"
                    value={inputs.concreteClass}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500`}
                  >
                    <option>C25/30</option>
                    <option>C30/37</option>
                    <option>C35/45</option>
                    <option>C40/50</option>
                    <option>C45/55</option>
                    <option>C50/60</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Steel Class
                  </label>
                  <select
                    name="steelClass"
                    value={inputs.steelClass}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500`}
                  >
                    <option>B500A</option>
                    <option>B500B</option>
                    <option>B500C</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Nominal Cover (mm)
                  </label>
                  <input
                    type="number"
                    name="coverDepth"
                    value={inputs.coverDepth}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Exposure Class (EC2 Table 4.1)
                  </label>
                  <select
                    name="exposureClass"
                    value={inputs.exposureClass}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="XC1">XC1 - Dry</option>
                    <option value="XC3">XC3 - Moderate Humidity</option>
                    <option value="XC4">XC4 - Cyclic Wet/Dry</option>
                    <option value="XD1">XD1 - Moderate Chloride</option>
                    <option value="XD2">XD2 - Wet Chloride</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${textSecondary} mb-1`}
                  >
                    Fire Resistance (EC2-1-2)
                  </label>
                  <select
                    name="fireResistance"
                    value={inputs.fireResistance}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 ${bgInput} border ${border} rounded-md ${textPrimary} focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="R30">R30</option>
                    <option value="R60">R60</option>
                    <option value="R90">R90</option>
                    <option value="R120">R120</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={calculateDesign}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-6 py-4 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              {loading ? "Calculating..." : "Calculate per EC2"}
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div
                className={`${
                  isDark
                    ? "bg-red-900/30 border-red-700"
                    : "bg-red-50 border-red-500"
                } border-l-4 rounded-lg p-4`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p
                    className={`${
                      isDark ? "text-red-300" : "text-red-700"
                    } font-medium`}
                  >
                    {error}
                  </p>
                </div>
              </div>
            )}

            {result && (
              <>
                {/* Status */}
                <div
                  className={`rounded-lg p-6 ${
                    result.designStatus === "PASS"
                      ? isDark
                        ? "bg-green-900/30 border-green-700"
                        : "bg-green-50 border-green-500"
                      : isDark
                      ? "bg-red-900/30 border-red-700"
                      : "bg-red-50 border-red-500"
                  } border-l-4`}
                >
                  <div className="flex items-center gap-3">
                    {result.designStatus === "PASS" ? (
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    )}
                    <div>
                      <h3 className={`text-2xl font-bold ${textPrimary}`}>
                        Design {result.designStatus}
                      </h3>
                      <p className={textSecondary}>
                        Eurocode 2 Analysis Complete
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reinforcement */}
                <div className={`${bgCard} rounded-lg shadow-md p-6`}>
                  <h3 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                    Reinforcement Layout (EC2 Clause 9.6)
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className={`${bgAccent} rounded-lg p-4`}>
                      <h4 className={`font-semibold ${textPrimary} mb-3`}>
                        Vertical Steel
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={textSecondary}>Outer Layer:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            T{result.reinforcement.vertical.outerLayer.diameter}{" "}
                            @ {result.reinforcement.vertical.outerLayer.spacing}
                            mm
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Inner Layer:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            T{result.reinforcement.vertical.innerLayer.diameter}{" "}
                            @ {result.reinforcement.vertical.innerLayer.spacing}
                            mm
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Total Area:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            {result.reinforcement.vertical.outerLayer.area +
                              result.reinforcement.vertical.innerLayer
                                .area}{" "}
                            mm²/m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>ρ Ratio:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            {(
                              result.reinforcement.vertical.totalRatio * 100
                            ).toFixed(2)}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`${bgAccent} rounded-lg p-4`}>
                      <h4 className={`font-semibold ${textPrimary} mb-3`}>
                        Horizontal Steel
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={textSecondary}>Outer Layer:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            T
                            {
                              result.reinforcement.horizontal.outerLayer
                                .diameter
                            }{" "}
                            @{" "}
                            {result.reinforcement.horizontal.outerLayer.spacing}
                            mm
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Inner Layer:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            T
                            {
                              result.reinforcement.horizontal.innerLayer
                                .diameter
                            }{" "}
                            @{" "}
                            {result.reinforcement.horizontal.innerLayer.spacing}
                            mm
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Total Area:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            {result.reinforcement.horizontal.outerLayer.area +
                              result.reinforcement.horizontal.innerLayer
                                .area}{" "}
                            mm²/m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>ρ Ratio:</span>
                          <span className={`font-medium ${textPrimary}`}>
                            {(
                              result.reinforcement.horizontal.totalRatio * 100
                            ).toFixed(2)}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`${bgAccent} rounded-lg p-4 mt-4`}>
                    <h4 className={`font-semibold ${textPrimary} mb-2`}>
                      Shear Links (EC2 Clause 9.2.2)
                    </h4>
                    <p className={`text-sm ${textSecondary}`}>
                      T{result.reinforcement.shearLinks.diameter} @{" "}
                      {result.reinforcement.shearLinks.spacing}mm c/c,
                      {result.reinforcement.shearLinks.legs} legs
                    </p>
                  </div>
                </div>

                {/* Design Resistance */}
                <div className={`${bgCard} rounded-lg shadow-md p-6`}>
                  <h3 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                    Design Resistance (EC2 Clause 6)
                  </h3>
                  <div className="space-y-4">
                    {[
                      {
                        label: "Axial (NRd)",
                        value: result.capacities.NRd,
                        util: result.capacities.utilization.axial,
                        unit: "kN",
                      },
                      {
                        label: "Shear (VRd)",
                        value: result.capacities.VRd,
                        util: result.capacities.utilization.shear,
                        unit: "kN",
                      },
                      {
                        label: "Moment (MRd)",
                        value: result.capacities.MRd,
                        util: result.capacities.utilization.moment,
                        unit: "kNm",
                      },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`font-medium ${textSecondary}`}>
                            {item.label}
                          </span>
                          <span className={textTertiary}>
                            {item.value} {item.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex-1 ${
                              isDark ? "bg-gray-700" : "bg-gray-200"
                            } rounded-full h-6 overflow-hidden`}
                          >
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.util > 0.9
                                  ? "bg-red-500"
                                  : item.util > 0.7
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${item.util * 100}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium w-16 text-right ${textPrimary}`}
                          >
                            {(item.util * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Eurocode Checks */}
                <div className={`${bgCard} rounded-lg shadow-md p-6`}>
                  <h3 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                    Eurocode 2 Compliance
                  </h3>
                  <div className="space-y-3">
                    {result.eurocodeChecks.map((check, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 ${bgAccent} rounded-lg`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {check.status === "PASS" ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className={`font-medium ${textPrimary}`}>
                              {check.name}
                            </div>
                            <div className={`text-xs ${textTertiary}`}>
                              {check.clause}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className={textSecondary}>
                            <span className={`font-medium ${textPrimary}`}>
                              {check.value}
                            </span>
                          </div>
                          <div className={textTertiary}>{check.limit}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailing */}
                <div className={`${bgCard} rounded-lg shadow-md p-6`}>
                  <h3 className={`text-xl font-semibold ${textPrimary} mb-4`}>
                    Detailing Requirements (EC2 Clause 8)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`${bgAccent} rounded-lg p-4`}>
                      <h4
                        className={`text-sm font-semibold ${textSecondary} mb-2`}
                      >
                        Anchorage
                      </h4>
                      <p className={`text-sm ${textPrimary}`}>
                        lb,rqd = {result.detailing.anchorage.length}mm
                      </p>
                      <p className={`text-xs ${textTertiary}`}>
                        {result.detailing.anchorage.type}
                      </p>
                    </div>
                    <div className={`${bgAccent} rounded-lg p-4`}>
                      <h4
                        className={`text-sm font-semibold ${textSecondary} mb-2`}
                      >
                        Lap Length
                      </h4>
                      <p className={`text-sm ${textPrimary}`}>
                        l0 = {result.detailing.lapping.length}mm
                      </p>
                      <p className={`text-xs ${textTertiary}`}>
                        {result.detailing.lapping.position}
                      </p>
                    </div>
                    <div className={`${bgAccent} rounded-lg p-4`}>
                      <h4
                        className={`text-sm font-semibold ${textSecondary} mb-2`}
                      >
                        Corners
                      </h4>
                      <p className={`text-sm ${textPrimary}`}>
                        r = {result.detailing.corners.radius}mm
                      </p>
                      <p className={`text-xs ${textTertiary}`}>
                        {result.detailing.corners.reinforcement}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Standards */}
                <div
                  className={`${
                    isDark
                      ? "bg-blue-900/30 border-blue-700"
                      : "bg-blue-50 border-blue-500"
                  } rounded-lg p-6 border-l-4`}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className={`font-semibold ${textPrimary} mb-2`}>
                        Applied Standards
                      </h3>
                      <ul className={`space-y-1 text-sm ${textSecondary}`}>
                        {result.standards.map((std, idx) => (
                          <li key={idx}>• {std}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!result && !error && !loading && (
              <div
                className={`${bgCard} rounded-lg shadow-md p-12 text-center`}
              >
                <Euro
                  className={`w-16 h-16 ${
                    isDark ? "text-gray-600" : "text-gray-300"
                  } mx-auto mb-4`}
                />
                <h3 className={`text-xl font-semibold ${textSecondary} mb-2`}>
                  Ready to Design
                </h3>
                <p className={textTertiary}>
                  Enter parameters and click Calculate per EC2
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EurocodeWallCalculator;
