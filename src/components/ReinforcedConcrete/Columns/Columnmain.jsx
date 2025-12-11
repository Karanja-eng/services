import React, { useState } from "react";
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
} from "recharts";
import Column3DVisualization from "../../components/column_3d_helper";

function ColumnSection({ b, h, cover, tieDia, barDia, numBars }) {
  if (!b || !h || !numBars) return null;

  const widthPx = 300;
  const heightPx = 300;
  const margin = 40;

  // scaling mm → px
  const sx = (val) => (val / b) * (widthPx - 2 * margin);
  const sy = (val) => (val / h) * (heightPx - 2 * margin);

  // tie rectangle
  const tieRect = {
    x: margin + sx(cover + tieDia),
    y: margin + sy(cover + tieDia),
    w: sx(b - 2 * (cover + tieDia)),
    h: sy(h - 2 * (cover + tieDia)),
  };

  // -------------------
  // ✅ BAR DISTRIBUTION
  // -------------------
  const bars = [];
  const barRadiusPx = Math.max(2, sx(barDia / 2));

  // always place 4 corner bars
  const corners = [
    { x: cover, y: cover },
    { x: b - cover, y: cover },
    { x: cover, y: h - cover },
    { x: b - cover, y: h - cover },
  ];
  corners.forEach((c) => bars.push(c));

  // remaining bars
  let remaining = numBars - 4;
  const sides = ["top", "bottom", "left", "right"];
  let sideIdx = 0;

  while (remaining > 0) {
    const side = sides[sideIdx % 4];
    sideIdx++;

    if (side === "top") {
      const x =
        cover +
        (bars.filter((p) => p.y === cover).length * (b - 2 * cover)) /
          (remaining + 1);
      bars.push({ x, y: cover });
    }
    if (side === "bottom") {
      const x =
        cover +
        (bars.filter((p) => p.y === h - cover).length * (b - 2 * cover)) /
          (remaining + 1);
      bars.push({ x, y: h - cover });
    }
    if (side === "left") {
      const y =
        cover +
        (bars.filter((p) => p.x === cover).length * (h - 2 * cover)) /
          (remaining + 1);
      bars.push({ x: cover, y });
    }
    if (side === "right") {
      const y =
        cover +
        (bars.filter((p) => p.x === b - cover).length * (h - 2 * cover)) /
          (remaining + 1);
      bars.push({ x: b - cover, y });
    }

    remaining--;
  }

  return (
    <svg
      width={widthPx}
      height={heightPx}
      style={{ border: "1px solid #ccc", background: "#fff" }}
    >
      {/* column outline */}
      <rect
        x={margin}
        y={margin}
        width={sx(b)}
        height={sy(h)}
        stroke="#333"
        fill="#f8f8f8"
      />

      {/* tie rectangle */}
      <rect
        x={tieRect.x}
        y={tieRect.y}
        width={tieRect.w}
        height={tieRect.h}
        stroke="#666"
        strokeDasharray="6 4"
        fill="none"
      />

      {/* bars */}
      {bars.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.x) + margin}
          cy={sy(p.y) + margin}
          r={barRadiusPx}
          fill="red"
          stroke="darkred"
        />
      ))}

      {/* labels */}
      <text x={8} y={14} fontSize="12" fill="#333">
        b={b}mm, h={h}mm
      </text>
      <text x={8} y={30} fontSize="12" fill="#333">
        cover={cover}mm, tie Ø{tieDia}mm, bar Ø{barDia}mm
      </text>
      <text x={8} y={46} fontSize="12" fill="#333">
        bars drawn: {bars.length} (expected {numBars})
      </text>
    </svg>
  );
}

const ColumnApp = () => {
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
    const payload =
      mode === "uniaxial"
        ? {
            mode,
            b,
            h,
            N: N,
            M: M,
            cover,
            tie_dia: tieDia,
            max_agg: maxAgg,
            bar_diameter: barDiameter,
          }
        : {
            mode,
            b,
            h,
            N: N,
            Mx: Mx,
            My: My,
            alpha,
            cover,
            tie_dia: tieDia,
            max_agg: maxAgg,
            bar_diameter: barDiameter,
          };

    const res = await fetch(`${API}/design-column`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log("API ->", data);
    setResult(data);
    setChartVisible(false);
  };

  const fetchChart = async () => {
    const res = await fetch(`${API}/get-interaction-data`);
    const data = await res.json();
    setChartData(data.data || []);
    setChartVisible(true);
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
          scatterPoints.push({ name: "Target", M: dp.M, N: dp.N });
        if (cp?.N != null && cp?.M != null)
          scatterPoints.push({ name: "Chart", M: cp.M, N: cp.N });
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
      <LineChart
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
            name="Design points"
            data={scatterPoints}
            fill="red"
            shape="star"
          />
        )}
      </LineChart>
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
            <Settings className="w-8 h-8 text-gray-300 hover:text-white cursor-pointer" />
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
              onClick={() => fetchChart()}
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
                  <option value="uniaxial">Uniaxial</option>
                  <option value="biaxial">Biaxial</option>
                </select>
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

                {mode === "uniaxial" ? (
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
                  className={`p-4 rounded-lg mb-4 ${
                    result.status === "success"
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800"
                  }`}
                >
                  <p className="font-medium">Status: {result.status}</p>
                </div>
                {result.status === "success" ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Analysis Mode</p>
                      <p className="text-lg font-medium text-gray-800">
                        {result.mode}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Column Dimensions</p>
                      <p className="text-lg font-medium text-gray-800">
                        {result.dimensions?.b} × {result.dimensions?.h} mm
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Design Loads</p>
                      {result.mode === "uniaxial" ? (
                        <p className="text-lg font-medium text-gray-800">
                          N = {(result.loads.N / 1000).toFixed(1)} kN
                          <br />M = {(result.loads.M / 1e6).toFixed(2)} kNm
                        </p>
                      ) : (
                        <p className="text-lg font-medium text-gray-800">
                          N = {(result.loads.N / 1000).toFixed(1)} kN
                          <br />
                          Mx = {(result.loads.Mx / 1e6).toFixed(2)} kNm
                          <br />
                          My = {(result.loads.My / 1e6).toFixed(2)} kNm
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
                        <div className="mt-4">
                          <ColumnSection
                            b={b}
                            h={h}
                            barDia={serverDia ?? barDiameter}
                            numBars={serverNumBars ?? 4}
                            distribution={serverDistribution}
                            cover={cover}
                            tieDia={tieDia}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={fetchChart}
                        disabled={chartVisible}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-400"
                      >
                        {chartVisible ? (
                          <>
                            <FileText className="w-4 h-4" />
                            Chart Visible
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
    className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${
      active
        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
        : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {icon}
    {children}
  </button>
);

export default ColumnApp;
