import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, FileText, Settings, Download, Save } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
  ComposedChart,
} from "recharts";
import Column3DVisualization from "../../components/column_3d_helper";
import ColumnDrawer from "./ColumnDrawer";

const ColumnApp = () => {
  const navigate = useNavigate();
  // geometry / loads
  const [mode, setMode] = useState("uniaxial");
  const [b, setB] = useState(300);
  const [h, setH] = useState(300);
  const [N, setN] = useState(1480); // kN
  const [M, setM] = useState(54); // kNm (uniaxial)
  const [Mx, setMx] = useState(40); // kNm (biaxial)
  const [My, setMy] = useState(20); // kNm (biaxial)
  const [alpha, setAlpha] = useState(1.0);

  // cover / tie / aggregate
  const [cover, setCover] = useState(40);
  const [tieDia, setTieDia] = useState(8);
  const [maxAgg, setMaxAgg] = useState(20);

  // structural / slenderness
  const [braced, setBraced] = useState(true);
  const [endTop, setEndTop] = useState(1);
  const [endBottom, setEndBottom] = useState(1);
  const [lo, setLo] = useState(3500); // mm
  const [inclination, setInclination] = useState(0); // degrees
  const [fireRes, setFireRes] = useState(1.5); // hours

  // bar diameter input (user selectable)
  const barDiameterOptions = [6, 8, 10, 12, 16, 20, 25, 32, 40];
  const [barDiameter, setBarDiameter] = useState(16);

  // UI state
  const [result, setResult] = useState(null);
  const [chartVisible, setChartVisible] = useState(false);
  const [chartData, setChartData] = useState([]);

  // backend API base for column interaction endpoints (mounted in FastAPI as /column_interaction)
  const API = "http://127.0.0.1:8001/column_interaction";

  // Submit design request
  const handleSubmit = async (e) => {
    e.preventDefault();
    let payload = {
      mode,
      b,
      h,
      N,
      cover,
      tie_dia: tieDia,
      max_agg: maxAgg,
      bar_diameter: barDiameter,
      braced,
      end_top: endTop,
      end_bottom: endBottom,
      lo,
      inclination,
      fire_res: fireRes,
    };

    if (mode === "uniaxial") {
      payload.M = M;
    } else if (mode === "biaxial") {
      payload.Mx = Mx;
      payload.My = My;
      payload.alpha = alpha;
    }

    try {
      const res = await fetch(`${API}/design-column`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("API ->", data);
      setResult(data);

      // Chart data is now included in the response
      if (data.chart_data) {
        setChartData(data.chart_data);
      } else {
        setChartData([]);
      }

      setChartVisible(false);
    } catch (err) {
      console.error("API Error:", err);
      setResult({ status: "error", message: "Failed to connect to design API" });
    }
  };

  const randColor = () =>
    `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`;

  // Helper to safely extract bar selection regardless of server key names
  const getBarSelection = (resp) => {
    if (!resp) return null;
    return (
      resp.bar_selection ??
      resp.barSelection ??
      resp.bars ??
      resp.bars_selection ??
      null
    );
  };

  // Chart renderer (x-axis projection)
  const renderChart = (axis = "x") => {
    if (!chartVisible || !chartData.length) return null;
    const scatterPoints = [];
    if (result?.status === "success") {
      if (result.mode === "uniaxial") {
        const dp = result.design_point;
        const cp = result.chart_point;
        if (dp?.N != null && dp?.M != null)
          scatterPoints.push({ name: "Design Load", M: dp.M, N: dp.N });
        if (cp?.N != null && cp?.M != null)
          scatterPoints.push({ name: "Provided Capacity", M: cp.M, N: cp.N });
      } else {
        const dp = result.design_point;
        const cp = result.chart_point;
        if (axis === "x") {
          if (dp?.N != null && dp?.Mx != null)
            scatterPoints.push({ name: "TargetX", M: dp.Mx, N: dp.N });
          if (cp?.N != null && cp?.Mux != null)
            scatterPoints.push({ name: "ChartX", M: cp.Mux, N: cp.N });
        } else {
          if (dp?.N != null && dp?.My != null)
            scatterPoints.push({ name: "TargetY", M: dp.My, N: dp.N });
          if (cp?.N != null && cp?.Muy != null)
            scatterPoints.push({ name: "ChartY", M: cp.Muy, N: cp.N });
        }
      }
    }

    return (
      <ComposedChart
        width={800}
        height={400}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="M"
          type="number"
          domain={["auto", "auto"]}
          label={{ value: "M/bh² (N/mm²)", position: "bottom" }}
        />
        <YAxis
          dataKey="N"
          type="number"
          label={{ value: "N/bh (N/mm²)", angle: -90, position: "insideLeft" }}
          domain={["auto", "auto"]}
        />
        <Tooltip />
        <Legend verticalAlign="middle" align="right" layout="vertical" />
        {chartData.map((dataset, idx) => (
          <Line
            key={idx}
            data={dataset.points}
            dataKey="N"
            name={`${dataset.steelPercentage}%`}
            stroke={randColor()}
            strokeWidth={1}
            dot={false}
          />
        ))}
        {scatterPoints.length > 0 && (
          <Scatter
            name="Analysis Points"
            data={scatterPoints}
            fill="#e11d48"
          />
        )}
      </ComposedChart>
    );
  };

  // UI helpers to read server bar data reliably
  const barSel = getBarSelection(result);
  const serverNumBars = barSel
    ? barSel.num_bars ??
    barSel.numBars ??
    barSel.num_bars ??
    barSel.num_bars ??
    null
    : null;
  const serverDia = barSel
    ? barSel.bar_dia ?? barSel.barDia ?? barSel.diameter ?? barSel.diam ?? null
    : null;
  const serverTotalArea = barSel
    ? barSel.total_area ??
    barSel.totalArea ??
    barSel.total_area ??
    barSel.provided_area ??
    null
    : null;
  const serverDistribution = barSel
    ? barSel.distribution ?? barSel.dist ?? null
    : null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Column Design System</h1>
              <p className="text-gray-300 mt-1">
                Professional BS EN 1992-1-1 Compliant Tool
              </p>
            </div>

          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <TabButton
              active={!chartVisible}
              onClick={() => setChartVisible(false)}
              icon={<Calculator className="w-5 h-5" />}
            >
              Design Input
            </TabButton>
            <TabButton
              active={chartVisible}
              onClick={() => setChartVisible(true)}
              icon={<FileText className="w-5 h-5" />}
              disabled={!result}
            >
              Results & Charts
            </TabButton>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-lg shadow-sm flex-1 space-y-6"
          >
            {/* Analysis Mode */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Analysis Mode
              </h3>
              <div>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="axial">Axial</option>
                  <option value="uniaxial">Uniaxial</option>
                  <option value="biaxial">Biaxial</option>
                </select>
              </div>
            </div>

            {/* Structural Parameters */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Structural Parameters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Stability</label>
                  <select
                    value={braced ? "braced" : "unbraced"}
                    onChange={(e) => setBraced(e.target.value === "braced")}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="braced">Braced</option>
                    <option value="unbraced">Unbraced</option>
                  </select>
                </div>
                <InputField
                  label="Clear Height (lo)"
                  value={lo}
                  onChange={(e) => setLo(+e.target.value)}
                  unit="mm"
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">End Condition Top</label>
                  <select
                    value={endTop}
                    onChange={(e) => setEndTop(+e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>Condition 1 (Fixed)</option>
                    <option value={2}>Condition 2 (Partial)</option>
                    <option value={3}>Condition 3 (Simple)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">End Condition Bottom</label>
                  <select
                    value={endBottom}
                    onChange={(e) => setEndBottom(+e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>Condition 1 (Fixed)</option>
                    <option value={2}>Condition 2 (Partial)</option>
                    <option value={3}>Condition 3 (Simple)</option>
                  </select>
                </div>
                <InputField
                  label="Inclination"
                  value={inclination}
                  onChange={(e) => setInclination(+e.target.value)}
                  unit="deg"
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Fire Resistance</label>
                  <select
                    value={fireRes}
                    onChange={(e) => setFireRes(+e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={0.5}>0.5 Hours</option>
                    <option value={1}>1 Hour</option>
                    <option value={1.5}>1.5 Hours</option>
                    <option value={2}>2 Hours</option>
                    <option value={3}>3 Hours</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Column Dimensions */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Column Dimensions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Width b"
                  name="width"
                  value={b}
                  onChange={(e) => setB(+e.target.value)}
                  unit="mm"
                />
                <InputField
                  label="Depth h"
                  name="depth"
                  value={h}
                  onChange={(e) => setH(+e.target.value)}
                  unit="mm"
                />
              </div>
            </div>

            {/* Design Loads */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Design Loads
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Axial Load (N)"
                  name="axialLoad"
                  value={N}
                  onChange={(e) => setN(+e.target.value)}
                  unit="kN"
                />

                {mode === "axial" ? null : mode === "uniaxial" ? (
                  <InputField
                    label="Moment (M)"
                    name="moment"
                    value={M}
                    onChange={(e) => setM(+e.target.value)}
                    unit="kNm"
                  />
                ) : (
                  <>
                    <InputField
                      label="Moment X (Mx)"
                      name="momentX"
                      value={Mx}
                      onChange={(e) => setMx(+e.target.value)}
                      unit="kNm"
                    />
                    <InputField
                      label="Moment Y (My)"
                      name="momentY"
                      value={My}
                      onChange={(e) => setMy(+e.target.value)}
                      unit="kNm"
                    />
                    <InputField
                      label="α (Power)"
                      name="alpha"
                      value={alpha}
                      onChange={(e) => setAlpha(+e.target.value)}
                      step="0.1"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Construction Details */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Construction Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InputField
                  label="Cover"
                  name="cover"
                  value={cover}
                  onChange={(e) => setCover(+e.target.value)}
                  unit="mm"
                />
                <InputField
                  label="Tie Ø"
                  name="tieDia"
                  value={tieDia}
                  onChange={(e) => setTieDia(+e.target.value)}
                  unit="mm"
                />
                <InputField
                  label="Max Aggregate"
                  name="maxAgg"
                  value={maxAgg}
                  onChange={(e) => setMaxAgg(+e.target.value)}
                  unit="mm"
                />
              </div>
            </div>

            {/* Reinforcement Details */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Reinforcement Details
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bar Diameter
                </label>
                <select
                  value={barDiameter}
                  onChange={(e) => setBarDiameter(+e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {barDiameterOptions.map((d) => (
                    <option key={d} value={d}>
                      {d} mm
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Design
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                Design Column
              </button>
            </div>
          </form>

          {/* Right Column - Results */}
          <div className="bg-white p-6 rounded-lg shadow-sm lg:w-96">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Design Results
            </h3>
            {result ? (
              <>
                <div
                  className={`p-4 rounded-lg mb-4 ${result.status === "success"
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                    }`}
                >
                  <p className="font-medium">Status: {result.status}</p>
                </div>
                {result.status === "success" ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Classification</p>
                      <p className="text-lg font-bold text-blue-900">
                        {result.is_inclined ? `Inclined (${result.classification})` : result.classification}
                      </p>
                    </div>

                    {result.slenderness && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Slenderness Check</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>le,x: <span className="font-medium">{result.slenderness.le_x} mm</span></div>
                          <div>le,y: <span className="font-medium">{result.slenderness.le_y} mm</span></div>
                          <div>λx: <span className="font-medium">{result.slenderness.slend_x}</span></div>
                          <div>λy: <span className="font-medium">{result.slenderness.slend_y}</span></div>
                        </div>
                        {result.slenderness.is_slender && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-red-600 font-medium">Slender Column detected.</p>
                            <p className="text-xs text-gray-600">Additional Moments:</p>
                            <p className="text-sm font-medium">Madd,x: {result.slenderness.Madd_x} kNm</p>
                            <p className="text-sm font-medium">Madd,y: {result.slenderness.Madd_y} kNm</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Column Dimensions</p>
                      <p className="text-lg font-medium text-gray-800">
                        {result.dimensions?.b} × {result.dimensions?.h} mm
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Design Loads</p>
                      {result.mode === "axial" ? (
                        <p className="text-lg font-medium text-gray-800">
                          N = {result.loads.N.toFixed(1)} kN
                        </p>
                      ) : result.mode === "uniaxial" ? (
                        <p className="text-lg font-medium text-gray-800">
                          N = {result.loads.N.toFixed(1)} kN
                          <br />M = {result.loads.Mx.toFixed(2)} kNm
                        </p>
                      ) : (
                        <p className="text-lg font-medium text-gray-800">
                          N = {result.loads.N.toFixed(1)} kN
                          <br />
                          Mx = {result.loads.Mx.toFixed(2)} kNm
                          <br />
                          My = {result.loads.My.toFixed(2)} kNm
                        </p>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Steel Requirement</p>
                      <div className="text-lg font-medium text-gray-800">
                        <p>
                          Steel ratio: {result.steel_percentage?.toFixed?.(2)}%
                        </p>
                        <p>Area required: {result.steel_area.toFixed(1)} mm²</p>
                      </div>
                    </div>

                    {/* Bar Selection Section */}
                    {barSel && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Bar Arrangement</p>
                        <p className="text-lg font-medium text-gray-800">
                          {serverNumBars ?? "-"} × Ø{serverDia ?? barDiameter}{" "}
                          mm
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Total area: {serverTotalArea ?? "-"} mm²
                        </p>
                      </div>
                    )}

                    {/* 2D Column Visualization */}
                    <div className="mt-6 space-y-4">
                      <div className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detailing Preview</span>
                        <button
                          onClick={() => {
                            const memberData = {
                              memberType: "column",
                              config: {
                                width: b,
                                depth: h,
                                cover: cover,
                                barDia: serverDia ?? barDiameter,
                                numBars: serverNumBars ?? 4,
                                tieDia: tieDia
                              },
                              x: 0,
                              y: 0
                            };
                            window.CAD_PENDING_MEMBER = memberData;
                            navigate("/drawing");
                          }}
                          className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition"
                        >
                          Send to CAD
                        </button>
                      </div>
                      <ColumnDrawer
                        width={b}
                        depth={h}
                        cover={cover}
                        barDia={serverDia ?? barDiameter}
                        numBars={serverNumBars ?? 4}
                        tieDia={tieDia}
                        scale={0.8}
                      />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={() => setChartVisible(!chartVisible)}
                        disabled={!chartData || chartData.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-400"
                      >
                        {chartVisible ? (
                          <>
                            <FileText className="w-4 h-4" />
                            Hide Interaction Diagram
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            View Interaction Diagram
                          </>
                        )}
                      </button>
                    </div>

                    {/* 3D Visualization Component */}
                    <Column3DVisualization
                      inputs={{
                        b: b,
                        h: h,
                        N: N,
                        M: mode === "uniaxial" ? M : undefined,
                        Mx: mode === "biaxial" ? Mx : undefined,
                        My: mode === "biaxial" ? My : undefined,
                        cover: cover,
                        tieDia: tieDia,
                      }}
                      results={result}
                      theme="light"
                      columnType={
                        mode === "uniaxial" ? "rectangular" : "rectangular"
                      }
                    />
                  </div>
                ) : (
                  <p className="text-red-600">{result.message}</p>
                )}
              </>
            ) : (
              <p className="text-gray-500">
                Enter design parameters and click "Design Column" to see results
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Chart Section */}
      {chartVisible && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Interaction Diagram
            </h3>
            {renderChart("x")}
          </div>
        </div>
      )}
    </div>
  );
};

const InputField = ({
  label,
  name,
  value,
  onChange,
  unit,
  type = "number",
  step = "any",
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <div className="relative">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        step={step}
        className="w-full p-2 pr-12 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {unit && (
        <span className="absolute right-3 top-2 text-sm text-gray-500">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const TabButton = ({ active, onClick, children, icon, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${active
      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {icon}
    {children}
  </button>
);

export default ColumnApp;
