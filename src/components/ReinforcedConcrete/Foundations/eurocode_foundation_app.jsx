import React, { useState } from "react";
import {
  Calculator,
  FileText,
  Download,
  Save,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Foundation3DVisualization from "../../components/foundation_3d_helper";

const EurocodeFoundationApp = ({ theme = "light" }) => {
  const [foundationType, setFoundationType] = useState("isolated");
  const [columnShape, setColumnShape] = useState("rectangular");
  const [columnPosition, setColumnPosition] = useState("centric");
  const [activeTab, setActiveTab] = useState("input");

  const isDark = theme === "dark";

  // Theme-aware classes
  const bgPrimary = isDark ? "bg-gray-900" : "bg-white";
  const bgSecondary = isDark ? "bg-gray-800" : "bg-gray-50";
  const bgTertiary = isDark ? "bg-gray-700" : "bg-gray-100";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const borderHover = isDark
    ? "hover:border-gray-600"
    : "hover:border-gray-300";
  const inputBg = isDark
    ? "bg-gray-800 border-gray-600"
    : "bg-white border-gray-300";
  const tableBg = isDark ? "bg-gray-800" : "bg-white";
  const tableHeaderBg = isDark ? "bg-gray-700" : "bg-gray-100";
  const tableRowBg = isDark ? "bg-gray-800" : "bg-gray-50";

  const [inputs, setInputs] = useState({
    // Actions (EN 1991) - kN, kNm
    permanentAction: "",
    variableAction: "",
    windAction: "",
    seismicAction: "",
    momentEdX: "",
    momentEdY: "",
    shearVEdX: "",
    shearVEdY: "",

    // Column Geometry - mm
    columnWidth: "",
    columnDepth: "",
    columnDiameter: "",

    // Material Properties (EN 1992-1-1)
    concreteClass: "C30/37",
    steelClass: "B500B",
    exposureClass: "XC2",
    groundBearing: "",

    // Foundation Geometry - mm
    foundationLength: "",
    foundationWidth: "",
    foundationThickness: "",

    // Piles (EN 1997-1)
    numberOfPiles: "",
    pileDiameter: "",
    pileResistance: "",
    pileAxialSpacing: "",
    pileTransverseSpacing: "",

    // Additional Parameters
    nominalCover: "50",
    concreteClass: "25",
    soilType: "cohesive",
    designApproach: "DA1-C2",
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const calculateFoundation = async () => {
    setLoading(true);

    setTimeout(() => {
      const mockResults = {
        designSummary: {
          status: "VERIFIED",
          unity_check: 0.83,
          foundationSize: `${inputs.foundationLength || "3000"} x ${
            inputs.foundationWidth || "3000"
          } x ${inputs.foundationThickness || "700"}mm`,
          designApproach: inputs.designApproach,
          eurocode: "EN 1997-1:2004",
        },
        actionAnalysis: {
          designValue_ULS: (
            parseFloat(inputs.permanentAction || 0) * 1.35 +
            parseFloat(inputs.variableAction || 0) * 1.5
          ).toFixed(2),
          designValue_SLS: (
            parseFloat(inputs.permanentAction || 0) +
            parseFloat(inputs.variableAction || 0)
          ).toFixed(2),
          characteristicAction:
            parseFloat(inputs.permanentAction || 0) +
            parseFloat(inputs.variableAction || 0),
          groundPressure_Ed: 268.5,
          groundResistance_Rd: 325.0,
          combinationUsed: "6.10a: 1.35Gk + 1.5Qk",
        },
        reinforcement: {
          bottomReinfX: "15H16@200 c/c (As = 3016 mm²/m)",
          bottomReinfY: "15H16@200 c/c (As = 3016 mm²/m)",
          topReinf: "10H12@250 c/c (nominal)",
          utilizationX: 0.78,
          utilizationY: 0.78,
          minimumReinf: "0.26% (EN 1992-1-1, 9.2.1.1)",
          providedReinf: "0.43%",
        },
        ulsChecks: [
          {
            clause: "EN 1997-1: 6.5.2.1",
            check: "Ground Bearing Resistance",
            applied: "268.5 kPa",
            resistance: "325.0 kPa",
            unity: 0.83,
            status: "OK",
          },
          {
            clause: "EN 1992-1-1: 6.4.4",
            check: "Punching Shear (Control Perimeter)",
            applied: "1.42 MPa",
            resistance: "2.15 MPa",
            unity: 0.66,
            status: "OK",
          },
          {
            clause: "EN 1992-1-1: 6.2.2",
            check: "Shear Without Reinforcement (X)",
            applied: "0.52 MPa",
            resistance: "0.71 MPa",
            unity: 0.73,
            status: "OK",
          },
          {
            clause: "EN 1992-1-1: 6.2.2",
            check: "Shear Without Reinforcement (Y)",
            applied: "0.52 MPa",
            resistance: "0.71 MPa",
            unity: 0.73,
            status: "OK",
          },
          {
            clause: "EN 1992-1-1: 6.1",
            check: "Bending Resistance (X-direction)",
            applied: "145 kNm/m",
            resistance: "186 kNm/m",
            unity: 0.78,
            status: "OK",
          },
          {
            clause: "EN 1992-1-1: 6.1",
            check: "Bending Resistance (Y-direction)",
            applied: "145 kNm/m",
            resistance: "186 kNm/m",
            unity: 0.78,
            status: "OK",
          },
        ],
        slsChecks: [
          {
            description: "Crack Width (Exposure XC2)",
            calculated: "0.22 mm",
            limit: "0.30 mm",
            status: "OK",
            clause: "EN 1992-1-1: 7.3.1",
          },
          {
            description: "Differential Settlement",
            calculated: "12 mm",
            limit: "25 mm",
            status: "OK",
            clause: "EN 1997-1: 6.6.2",
          },
        ],
        eurocodes: [
          "EN 1990:2002 - Basis of structural design",
          "EN 1991-1-1:2002 - Actions on structures",
          "EN 1992-1-1:2004 - Design of concrete structures",
          "EN 1997-1:2004 - Geotechnical design",
          "EN 1998-5:2004 - Seismic design of foundations",
        ],
        nationalAnnex: "Using Recommended Values (CEN)",
        partialFactors: {
          permanent_unfavourable: 1.35,
          permanent_favourable: 1.0,
          variable_unfavourable: 1.5,
          concrete_strength: 1.5,
          steel_strength: 1.15,
          soil_bearing: 1.4,
        },
      };

      setResults(mockResults);
      setLoading(false);
      setActiveTab("results");
    }, 1500);
  };

  const renderInputSection = () => {
    return (
      <div className="space-y-6">
        {/* Foundation Type */}
        <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Foundation Type (EN 1997-1)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "isolated", label: "Isolated (Spread)" },
              { id: "combined", label: "Combined" },
              { id: "piled", label: "Piled" },
              { id: "raft", label: "Raft (Mat)" },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setFoundationType(type.id)}
                className={`p-3 rounded border-2 transition-all ${textPrimary} ${
                  foundationType === type.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : `${border} ${borderHover}`
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Design Approach */}
        <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Design Approach (EN 1997-1: 2.4.7.3.4)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Approach
              </label>
              <select
                name="designApproach"
                value={inputs.designApproach}
                onChange={handleInputChange}
                className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
              >
                <option value="DA1-C1">DA1 - Combination 1</option>
                <option value="DA1-C2">DA1 - Combination 2</option>
                <option value="DA2">DA2 (Recommended)</option>
                <option value="DA3">DA3</option>
              </select>
            </div>
            <div>
              <label
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Soil Type
              </label>
              <select
                name="soilType"
                value={inputs.soilType}
                onChange={handleInputChange}
                className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
              >
                <option value="cohesive">Cohesive</option>
                <option value="granular">Granular</option>
                <option value="rock">Rock</option>
              </select>
            </div>
            <div>
              <label
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Exposure Class
              </label>
              <select
                name="exposureClass"
                value={inputs.exposureClass}
                onChange={handleInputChange}
                className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
              >
                <option value="XC1">XC1 (Dry)</option>
                <option value="XC2">XC2 (Wet, rarely dry)</option>
                <option value="XC3">XC3 (Moderate humidity)</option>
                <option value="XC4">XC4 (Cyclic wet/dry)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Column Configuration */}
        {foundationType === "isolated" && (
          <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
              Column Configuration
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Shape
                </label>
                <select
                  value={columnShape}
                  onChange={(e) => setColumnShape(e.target.value)}
                  className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
                >
                  <option value="rectangular">Rectangular</option>
                  <option value="circular">Circular</option>
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium ${textSecondary} mb-2`}
                >
                  Position
                </label>
                <select
                  value={columnPosition}
                  onChange={(e) => setColumnPosition(e.target.value)}
                  className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
                >
                  <option value="centric">Centric</option>
                  <option value="eccentric">Eccentric</option>
                  <option value="edge">Edge</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Actions (Loads) */}
        <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Design Actions - EN 1991 (kN, kNm)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField
              theme={theme}
              label="Permanent (Gk)"
              name="permanentAction"
              value={inputs.permanentAction}
              onChange={handleInputChange}
              unit="kN"
            />
            <InputField
              theme={theme}
              label="Variable (Qk)"
              name="variableAction"
              value={inputs.variableAction}
              onChange={handleInputChange}
              unit="kN"
            />
            <InputField
              theme={theme}
              label="Wind (Wk)"
              name="windAction"
              value={inputs.windAction}
              onChange={handleInputChange}
              unit="kN"
            />
            <InputField
              theme={theme}
              label="Seismic (AEk)"
              name="seismicAction"
              value={inputs.seismicAction}
              onChange={handleInputChange}
              unit="kN"
            />
            <InputField
              theme={theme}
              label="Moment MEd,x"
              name="momentEdX"
              value={inputs.momentEdX}
              onChange={handleInputChange}
              unit="kNm"
            />
            <InputField
              theme={theme}
              label="Moment MEd,y"
              name="momentEdY"
              value={inputs.momentEdY}
              onChange={handleInputChange}
              unit="kNm"
            />
            <InputField
              theme={theme}
              label="Shear VEd,x"
              name="shearVEdX"
              value={inputs.shearVEdX}
              onChange={handleInputChange}
              unit="kN"
            />
            <InputField
              theme={theme}
              label="Shear VEd,y"
              name="shearVEdY"
              value={inputs.shearVEdY}
              onChange={handleInputChange}
              unit="kN"
            />
          </div>
        </div>

        {/* Column Dimensions */}
        <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Column Dimensions (mm)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {columnShape !== "circular" ? (
              <>
                <InputField
                  theme={theme}
                  label="Width (c₁)"
                  name="columnWidth"
                  value={inputs.columnWidth}
                  onChange={handleInputChange}
                  unit="mm"
                />
                <InputField
                  theme={theme}
                  label="Depth (c₂)"
                  name="columnDepth"
                  value={inputs.columnDepth}
                  onChange={handleInputChange}
                  unit="mm"
                />
              </>
            ) : (
              <InputField
                theme={theme}
                label="Diameter (Ø)"
                name="columnDiameter"
                value={inputs.columnDiameter}
                onChange={handleInputChange}
                unit="mm"
              />
            )}
          </div>
        </div>

        {/* Material Properties */}
        <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Material Properties - EN 1992-1-1: Table 3.1
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Concrete Class
              </label>
              <select
                name="concreteClass"
                value={inputs.concreteClass}
                onChange={handleInputChange}
                className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
              >
                <option value="C25/30">C25/30</option>
                <option value="C30/37">C30/37</option>
                <option value="C35/45">C35/45</option>
                <option value="C40/50">C40/50</option>
                <option value="C45/55">C45/55</option>
                <option value="C50/60">C50/60</option>
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
                value={inputs.steelClass}
                onChange={handleInputChange}
                className={`w-full p-2 ${inputBg} rounded focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
              >
                <option value="B500A">B500A</option>
                <option value="B500B">B500B</option>
                <option value="B500C">B500C</option>
              </select>
            </div>
            <InputField
              theme={theme}
              label="Ground Bearing"
              name="groundBearing"
              value={inputs.groundBearing}
              onChange={handleInputChange}
              unit="kPa"
            />
            <InputField
              theme={theme}
              label="Nominal Cover (cnom)"
              name="nominalCover"
              value={inputs.nominalCover}
              onChange={handleInputChange}
              unit="mm"
            />
          </div>
        </div>

        {/* Foundation Dimensions */}
        <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Foundation Geometry (mm)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InputField
              theme={theme}
              label="Length (l)"
              name="foundationLength"
              value={inputs.foundationLength}
              onChange={handleInputChange}
              unit="mm"
            />
            <InputField
              theme={theme}
              label="Width (b)"
              name="foundationWidth"
              value={inputs.foundationWidth}
              onChange={handleInputChange}
              unit="mm"
            />
            <InputField
              theme={theme}
              label="Thickness (h)"
              name="foundationThickness"
              value={inputs.foundationThickness}
              onChange={handleInputChange}
              unit="mm"
            />
          </div>
        </div>

        {/* Pile Configuration */}
        {foundationType === "piled" && (
          <div className={`${bgPrimary} p-6 rounded-lg border ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
              Pile Configuration - EN 1997-1: Section 7
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InputField
                theme={theme}
                label="Number of Piles"
                name="numberOfPiles"
                value={inputs.numberOfPiles}
                onChange={handleInputChange}
              />
              <InputField
                theme={theme}
                label="Pile Ø"
                name="pileDiameter"
                value={inputs.pileDiameter}
                onChange={handleInputChange}
                unit="mm"
              />
              <InputField
                theme={theme}
                label="Rc,d (Pile Resistance)"
                name="pileResistance"
                value={inputs.pileResistance}
                onChange={handleInputChange}
                unit="kN"
              />
              <InputField
                theme={theme}
                label="Axial Spacing"
                name="pileAxialSpacing"
                value={inputs.pileAxialSpacing}
                onChange={handleInputChange}
                unit="mm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Design
          </button>
          <button
            onClick={calculateFoundation}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-400"
          >
            <Calculator className="w-5 h-5" />
            {loading ? "Calculating..." : "Verify Design"}
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="space-y-6">
        {/* Design Summary */}
        <div
          className={`p-6 rounded-lg border-2 ${
            results.designSummary.status === "VERIFIED"
              ? "bg-green-50 dark:bg-green-900/20 border-green-500"
              : "bg-red-50 dark:bg-red-900/20 border-red-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle
                className={`w-8 h-8 ${
                  results.designSummary.status === "VERIFIED"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600"
                }`}
              />
              <div>
                <h3 className={`text-xl font-bold ${textPrimary}`}>
                  Design {results.designSummary.status}
                </h3>
                <p className={textSecondary}>
                  Unity Check:{" "}
                  {(results.designSummary.unity_check * 100).toFixed(1)}%
                </p>
                <p className={`text-sm ${textTertiary}`}>
                  Design Approach: {results.designSummary.designApproach}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm ${textSecondary}`}>Foundation Size</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {results.designSummary.foundationSize}
              </p>
            </div>
          </div>
        </div>

        {/* Partial Factors Table */}
        <div
          className={`${tableBg} rounded-lg border ${border} overflow-hidden`}
        >
          <div className={`${tableHeaderBg} px-6 py-3 border-b ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>
              Partial Factors (EN 1990: Table A1.2)
            </h3>
          </div>
          <table className="w-full">
            <thead className={tableHeaderBg}>
              <tr>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Symbol
                </th>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Description
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${border}`}>
              <tr>
                <td className={`px-6 py-3 font-mono ${textPrimary}`}>γG,sup</td>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Permanent actions (unfavourable)
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.partialFactors.permanent_unfavourable}
                </td>
              </tr>
              <tr className={tableRowBg}>
                <td className={`px-6 py-3 font-mono ${textPrimary}`}>γG,inf</td>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Permanent actions (favourable)
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.partialFactors.permanent_favourable}
                </td>
              </tr>
              <tr>
                <td className={`px-6 py-3 font-mono ${textPrimary}`}>γQ</td>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Variable actions
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.partialFactors.variable_unfavourable}
                </td>
              </tr>
              <tr className={tableRowBg}>
                <td className={`px-6 py-3 font-mono ${textPrimary}`}>γC</td>
                <td className={`px-6 py-3 ${textSecondary}`}>Concrete</td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.partialFactors.concrete_strength}
                </td>
              </tr>
              <tr>
                <td className={`px-6 py-3 font-mono ${textPrimary}`}>γS</td>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Reinforcing steel
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.partialFactors.steel_strength}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action Analysis */}
        <div
          className={`${tableBg} rounded-lg border ${border} overflow-hidden`}
        >
          <div className={`${tableHeaderBg} px-6 py-3 border-b ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>
              Action Analysis (EN 1990: 6.4.3)
            </h3>
          </div>
          <table className="w-full">
            <thead className={tableHeaderBg}>
              <tr>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Parameter
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Value
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Unit
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${border}`}>
              <tr>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Design Value Ed (ULS)
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.actionAnalysis.designValue_ULS}
                </td>
                <td className={`px-6 py-3 text-right ${textTertiary}`}>kN</td>
              </tr>
              <tr className={tableRowBg}>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Serviceability Value (SLS)
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.actionAnalysis.designValue_SLS}
                </td>
                <td className={`px-6 py-3 text-right ${textTertiary}`}>kN</td>
              </tr>
              <tr>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Ground Pressure σEd
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.actionAnalysis.groundPressure_Ed}
                </td>
                <td className={`px-6 py-3 text-right ${textTertiary}`}>kPa</td>
              </tr>
              <tr className={tableRowBg}>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Ground Resistance Rd
                </td>
                <td
                  className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                >
                  {results.actionAnalysis.groundResistance_Rd}
                </td>
                <td className={`px-6 py-3 text-right ${textTertiary}`}>kPa</td>
              </tr>
              <tr>
                <td className={`px-6 py-3 ${textSecondary}`}>
                  Combination Used
                </td>
                <td
                  className={`px-6 py-3 text-right font-mono text-sm ${textPrimary}`}
                  colSpan={2}
                >
                  {results.actionAnalysis.combinationUsed}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ULS Checks */}
        <div
          className={`${tableBg} rounded-lg border ${border} overflow-hidden`}
        >
          <div className={`${tableHeaderBg} px-6 py-3 border-b ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>
              Ultimate Limit State Verification
            </h3>
          </div>
          <table className="w-full">
            <thead className={tableHeaderBg}>
              <tr>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Eurocode Clause
                </th>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Verification
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Ed
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Rd
                </th>
                <th
                  className={`px-6 py-3 text-center text-sm font-semibold ${textPrimary}`}
                >
                  Ed/Rd
                </th>
                <th
                  className={`px-6 py-3 text-center text-sm font-semibold ${textPrimary}`}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${border}`}>
              {results.ulsChecks.map((check, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "" : tableRowBg}>
                  <td className={`px-6 py-3 font-mono text-xs ${textPrimary}`}>
                    {check.clause}
                  </td>
                  <td className={`px-6 py-3 ${textSecondary}`}>
                    {check.check}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                  >
                    {check.applied}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                  >
                    {check.resistance}
                  </td>
                  <td className={`px-6 py-3 text-center`}>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        check.unity < 0.85
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : check.unity < 1.0
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {(check.unity * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className={`px-6 py-3 text-center`}>
                    <span
                      className={`px-3 py-1 rounded text-sm font-bold ${
                        check.status === "OK"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {check.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SLS Checks */}
        <div
          className={`${tableBg} rounded-lg border ${border} overflow-hidden`}
        >
          <div className={`${tableHeaderBg} px-6 py-3 border-b ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>
              Serviceability Limit State Verification
            </h3>
          </div>
          <table className="w-full">
            <thead className={tableHeaderBg}>
              <tr>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Eurocode Clause
                </th>
                <th
                  className={`px-6 py-3 text-left text-sm font-semibold ${textPrimary}`}
                >
                  Description
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Calculated
                </th>
                <th
                  className={`px-6 py-3 text-right text-sm font-semibold ${textPrimary}`}
                >
                  Limit
                </th>
                <th
                  className={`px-6 py-3 text-center text-sm font-semibold ${textPrimary}`}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${border}`}>
              {results.slsChecks.map((check, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "" : tableRowBg}>
                  <td className={`px-6 py-3 font-mono text-xs ${textPrimary}`}>
                    {check.clause}
                  </td>
                  <td className={`px-6 py-3 ${textSecondary}`}>
                    {check.description}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                  >
                    {check.calculated}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-medium ${textPrimary}`}
                  >
                    {check.limit}
                  </td>
                  <td className={`px-6 py-3 text-center`}>
                    <span
                      className={`px-3 py-1 rounded text-sm font-bold ${
                        check.status === "OK"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {check.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reinforcement Details */}
        <div
          className={`${tableBg} rounded-lg border ${border} overflow-hidden`}
        >
          <div className={`${tableHeaderBg} px-6 py-3 border-b ${border}`}>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>
              Reinforcement Design (EN 1992-1-1: Section 9)
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className={`text-sm ${textSecondary} mb-1`}>
                  Bottom Reinforcement (X-direction)
                </p>
                <p className={`text-lg font-mono font-semibold ${textPrimary}`}>
                  {results.reinforcement.bottomReinfX}
                </p>
                <p className={`text-xs ${textTertiary} mt-1`}>
                  Unity: {(results.reinforcement.utilizationX * 100).toFixed(0)}
                  %
                </p>
              </div>
              <div>
                <p className={`text-sm ${textSecondary} mb-1`}>
                  Bottom Reinforcement (Y-direction)
                </p>
                <p className={`text-lg font-mono font-semibold ${textPrimary}`}>
                  {results.reinforcement.bottomReinfY}
                </p>
                <p className={`text-xs ${textTertiary} mt-1`}>
                  Unity: {(results.reinforcement.utilizationY * 100).toFixed(0)}
                  %
                </p>
              </div>
              <div>
                <p className={`text-sm ${textSecondary} mb-1`}>
                  Top Reinforcement (Distribution)
                </p>
                <p className={`text-lg font-mono font-semibold ${textPrimary}`}>
                  {results.reinforcement.topReinf}
                </p>
              </div>
              <div>
                <p className={`text-sm ${textSecondary} mb-1`}>
                  Reinforcement Ratio
                </p>
                <p className={`text-lg font-semibold ${textPrimary}`}>
                  {results.reinforcement.providedReinf}
                </p>
                <p className={`text-xs ${textTertiary} mt-1`}>
                  Min required: {results.reinforcement.minimumReinf}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Eurocode References */}
        <div className={`${bgSecondary} p-6 rounded-lg border ${border}`}>
          <h4 className={`font-semibold ${textPrimary} mb-3`}>
            Eurocodes Referenced
          </h4>
          <ul className="space-y-2">
            {results.eurocodes.map((ref, idx) => (
              <li
                key={idx}
                className={`text-sm ${textSecondary} flex items-start gap-2`}
              >
                <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                <span>{ref}</span>
              </li>
            ))}
          </ul>
          <div className={`mt-4 pt-4 border-t ${border}`}>
            <p className={`text-xs ${textTertiary}`}>
              <span className="font-semibold">National Annex:</span>{" "}
              {results.nationalAnnex}
            </p>
          </div>
        </div>

        {/* 3D Visualization Component */}
        <Foundation3DVisualization
          inputs={inputs}
          results={results}
          theme={theme}
          foundationType={foundationType}
        />

        <div className="flex justify-end gap-3">
          <button className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Calculation Report
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate DXF Drawings
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Navigation Tabs */}
      <div className={`${bgSecondary} border-b ${border} mb-6`}>
        <div className="flex gap-1">
          <TabButton
            active={activeTab === "input"}
            onClick={() => setActiveTab("input")}
            icon={<Calculator className="w-5 h-5" />}
            theme={theme}
          >
            Design Input
          </TabButton>
          <TabButton
            active={activeTab === "results"}
            onClick={() => setActiveTab("results")}
            icon={<FileText className="w-5 h-5" />}
            disabled={!results}
            theme={theme}
          >
            Verification Results
          </TabButton>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === "input" && renderInputSection()}
      {activeTab === "results" && renderResults()}
    </div>
  );
};

const InputField = ({
  theme,
  label,
  name,
  value,
  onChange,
  unit,
  type = "number",
}) => {
  const isDark = theme === "dark";
  const inputBg = isDark
    ? "bg-gray-800 border-gray-600 text-gray-100"
    : "bg-white border-gray-300 text-gray-900";
  const textLabel = isDark ? "text-gray-300" : "text-gray-700";
  const textUnit = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div>
      <label className={`block text-sm font-medium ${textLabel} mb-1`}>
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          step="0.01"
          className={`w-full p-2 pr-12 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputBg}`}
        />
        {unit && (
          <span className={`absolute right-3 top-2 text-sm ${textUnit}`}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, children, icon, disabled, theme }) => {
  const isDark = theme === "dark";
  const activeClasses = active
    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
    : isDark
    ? "text-gray-300 hover:text-gray-100 hover:bg-gray-700"
    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${activeClasses} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {icon}
      {children}
    </button>
  );
};

export default EurocodeFoundationApp;
