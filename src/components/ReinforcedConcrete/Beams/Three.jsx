import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts";
import {
  Plus,
  Minus,
  Play,
  Download,
  BookOpen,
  Settings,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Calculator,
  FileText,
  Award,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8001/three_analysis";

const EnhancedThreeMomentCalculator = ({ isDark = false, onAnalysisComplete }) => {
  const [spans, setSpans] = useState([
    { length: 6.0, E: 200e9, I: 8.33e-6, loads: [] },
  ]);
  const [supports, setSupports] = useState([
    { support_type: "Pinned", position: 0.0 },
    { support_type: "Pinned", position: 6.0 },
  ]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("input");

  // Update support positions when spans change
  useEffect(() => {
    let position = 0;
    const newSupports = [{ support_type: "Pinned", position: 0.0 }];

    spans.forEach((span, index) => {
      position += span.length;
      newSupports.push({
        support_type: index === spans.length - 1 ? "Pinned" : "Pinned",
        position: position,
      });
    });

    setSupports(newSupports);
  }, [spans.length, spans.map((s) => s.length).join(",")]);

  const addSpan = () => {
    setSpans([...spans, { length: 6.0, E: 200e9, I: 8.33e-6, loads: [] }]);
  };

  const removeSpan = (index) => {
    if (spans.length > 1) {
      const newSpans = spans.filter((_, i) => i !== index);
      setSpans(newSpans);
    }
  };

  const updateSpan = (index, field, value) => {
    const newSpans = [...spans];
    newSpans[index][field] = parseFloat(value) || 0;
    setSpans(newSpans);
  };

  const addLoad = (spanIndex) => {
    const newSpans = [...spans];
    newSpans[spanIndex].loads.push({
      load_type: "Point Load",
      magnitude: 50.0,
      position: 0.0,
      length: 0.0,
      magnitude2: 0.0,
    });
    setSpans(newSpans);
  };

  const updateLoad = (spanIndex, loadIndex, field, value) => {
    const newSpans = [...spans];
    newSpans[spanIndex].loads[loadIndex][field] =
      field === "load_type" ? value : parseFloat(value) || 0;
    setSpans(newSpans);
  };

  const removeLoad = (spanIndex, loadIndex) => {
    const newSpans = [...spans];
    newSpans[spanIndex].loads.splice(loadIndex, 1);
    setSpans(newSpans);
  };

  const updateSupport = (index, field, value) => {
    const newSupports = [...supports];
    newSupports[index][field] = value;
    setSupports(newSupports);
  };

  const analyzeBeam = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/analyze`, {
        spans,
        supports,
      });
      setResults(response.data);
      setActiveTab("results");

      if (onAnalysisComplete) {
        onAnalysisComplete({ ...response.data, inputs: { spans, supports } });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const loadExample = async (exampleName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/examples`);
      const example = response.data.find((ex) => ex.name === exampleName);
      if (example) {
        setSpans(example.spans);
        setSupports(example.supports);
      }
    } catch (err) {
      setError("Failed to load example");
    }
  };

  const BeamSchematic = ({ spans, supports, results }) => {
    const totalLength = spans.reduce((sum, span) => sum + span.length, 0);
    const scale = 800 / totalLength;
    const beamHeight = 20;
    let currentPos = 0;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Beam Configuration</h3>
        <svg width="900" height="200" viewBox="0 0 900 200">
          {/* Draw spans */}
          {spans.map((span, index) => {
            const spanWidth = span.length * scale;
            const x = currentPos * scale + 50;
            const rect = (
              <g key={`span-${index}`}>
                {/* Beam segment */}
                <rect
                  x={x}
                  y={90}
                  width={spanWidth}
                  height={beamHeight}
                  fill="#4A5568"
                  stroke="#2D3748"
                  strokeWidth="2"
                />
                {/* Span label */}
                <text
                  x={x + spanWidth / 2}
                  y={85}
                  textAnchor="middle"
                  className="text-sm fill-gray-700"
                >
                  Span {index + 1}: {span.length}m
                </text>

                {/* Draw loads */}
                {span.loads.map((load, loadIndex) => {
                  const loadX = x + load.position * scale;
                  if (load.load_type === "Point Load") {
                    return (
                      <g key={`load-${index}-${loadIndex}`}>
                        <line
                          x1={loadX}
                          y1={60}
                          x2={loadX}
                          y2={90}
                          stroke="red"
                          strokeWidth="3"
                          markerEnd="url(#arrowhead)"
                        />
                        <text
                          x={loadX}
                          y={55}
                          textAnchor="middle"
                          className="text-xs fill-red-600"
                        >
                          {load.magnitude}kN
                        </text>
                      </g>
                    );
                  } else if (load.load_type === "Uniformly Distributed Load") {
                    const arrows = [];
                    for (let i = 0; i < 10; i++) {
                      const arrowX = x + (i * spanWidth) / 9;
                      arrows.push(
                        <line
                          key={i}
                          x1={arrowX}
                          y1={70}
                          x2={arrowX}
                          y2={90}
                          stroke="blue"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead-small)"
                        />
                      );
                    }
                    return (
                      <g key={`load-${index}-${loadIndex}`}>
                        {arrows}
                        <text
                          x={x + spanWidth / 2}
                          y={65}
                          textAnchor="middle"
                          className="text-xs fill-blue-600"
                        >
                          {load.magnitude}kN/m
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            );
            currentPos += span.length;
            return rect;
          })}

          {/* Draw supports */}
          {supports.map((support, index) => {
            const x = support.position * scale + 50;
            return (
              <g key={`support-${index}`}>
                {support.support_type === "Fixed" ? (
                  <g>
                    <rect
                      x={x - 5}
                      y={110}
                      width={10}
                      height={15}
                      fill="#2D3748"
                    />
                    <line
                      x1={x - 10}
                      y1={125}
                      x2={x + 10}
                      y2={125}
                      stroke="#2D3748"
                      strokeWidth="3"
                    />
                    {[...Array(5)].map((_, i) => (
                      <line
                        key={i}
                        x1={x - 8 + i * 4}
                        y1={125}
                        x2={x - 6 + i * 4}
                        y2={130}
                        stroke="#2D3748"
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                ) : (
                  <g>
                    <polygon
                      points={`${x - 10},125 ${x + 10},125 ${x},110`}
                      fill="#4A5568"
                      stroke="#2D3748"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {results &&
                  Math.abs(results.support_reactions[index]) > 0.01 && (
                    <g>
                      <line
                        x1={x}
                        y1={140}
                        x2={x}
                        y2={results.support_reactions[index] > 0 ? 155 : 125}
                        stroke="purple"
                        strokeWidth="3"
                        markerEnd="url(#arrowhead-purple)"
                      />
                      <text
                        x={x}
                        y={170}
                        textAnchor="middle"
                        className="text-xs fill-purple-600"
                      >
                        R={results.support_reactions[index].toFixed(1)}kN
                      </text>
                    </g>
                  )}

                {results && Math.abs(results.support_moments[index]) > 0.01 && (
                  <text
                    x={x}
                    y={45}
                    textAnchor="middle"
                    className="text-xs fill-orange-600 font-semibold"
                  >
                    M={results.support_moments[index].toFixed(1)}kN⋅m
                  </text>
                )}
              </g>
            );
          })}

          {/* Arrow markers */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="red" />
            </marker>
            <marker
              id="arrowhead-small"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" fill="blue" />
            </marker>
            <marker
              id="arrowhead-purple"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="purple" />
            </marker>
          </defs>
        </svg>
      </div>
    );
  };

  const DiagramsPanel = ({ results }) => {
    if (!results) return null;

    const combinedMomentData = results.moment_data.map((point, index) => ({
      x: point.x,
      total: point.y,
      loads: results.moment_due_to_loads_data[index]?.y || 0,
      supports: results.moment_due_to_supports_data[index]?.y || 0,
    }));

    return (
      <div className="space-y-6">
        {/* Shear Force Diagram */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-600">
            Shear Force Diagram (SFD)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={results.shear_force_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                label={{
                  value: "Distance (m)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Shear Force (kN)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value) => [`${value.toFixed(2)} kN`, "Shear Force"]}
              />
              <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
              <Area
                type="monotone"
                dataKey="y"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 text-sm text-gray-600">
            Max: {results.critical_values.max_shear.toFixed(2)} kN | Min:{" "}
            {results.critical_values.min_shear.toFixed(2)} kN
          </div>
        </div>

        {/* Combined Bending Moment Diagram */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-red-600">
            Bending Moment Diagram (BMD) - Combined View
          </h3>
          <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="font-semibold text-yellow-800 mb-2">
              Three-Moment Theorem Components:
            </h4>
            <div className="text-sm text-yellow-700">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-2 bg-green-500 opacity-70"></div>
                <span>Moments due to vertical loads (simple beam moments)</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-2 bg-purple-500 opacity-70"></div>
                <span>Moments due to support moments (continuity effect)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 bg-red-500"></div>
                <span>Total moments (superposition)</span>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={combinedMomentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                label={{
                  value: "Distance (m)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Bending Moment (kN⋅m)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value, name) => {
                  const labels = {
                    loads: "Due to Loads",
                    supports: "Due to Supports",
                    total: "Total Moment",
                  };
                  return [`${value.toFixed(2)} kN⋅m`, labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />

              <Area
                type="monotone"
                dataKey="loads"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.4}
                strokeWidth={2}
              />

              <Area
                type="monotone"
                dataKey="supports"
                stackId="2"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.4}
                strokeWidth={2}
              />

              <Line
                type="monotone"
                dataKey="total"
                stroke="#EF4444"
                strokeWidth={3}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-2 text-sm text-gray-600">
            Max: {results.critical_values.max_moment.toFixed(2)} kN⋅m | Min:{" "}
            {results.critical_values.min_moment.toFixed(2)} kN⋅m
          </div>
        </div>

        {/* Separate BMD Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-green-600">
              BMD - Due to Vertical Loads Only
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={results.moment_due_to_loads_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    `${value.toFixed(2)} kN⋅m`,
                    "Moment (Loads)",
                  ]}
                />
                <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-purple-600">
              BMD - Due to Support Moments
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={results.moment_due_to_supports_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    `${value.toFixed(2)} kN⋅m`,
                    "Moment (Supports)",
                  ]}
                />
                <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="#8B5CF6"
                  fill="#8B5CF6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Three-Moment Theorem Analysis
                </h1>
                <p className="text-sm text-gray-600">
                  Professional Continuous Beam Analysis
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadExample("Two-Span Continuous Beam")}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                <BookOpen className="h-4 w-4 inline mr-1" />
                Example 1
              </button>
              <button
                onClick={() => loadExample("UDL Three-Span Beam")}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                <BookOpen className="h-4 w-4 inline mr-1" />
                Example 2
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("input")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${activeTab === "input"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Input Configuration
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${activeTab === "results"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
              disabled={!results}
            >
              <Calculator className="h-4 w-4 inline mr-2" />
              Analysis Results
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "input" && (
          <div className="space-y-6">
            {/* Span Configuration */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Span Configuration</h2>
                <button
                  onClick={addSpan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Span
                </button>
              </div>

              <div className="space-y-4">
                {spans.map((span, spanIndex) => (
                  <div
                    key={spanIndex}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium">
                        Span {spanIndex + 1}
                      </h3>
                      {spans.length > 1 && (
                        <button
                          onClick={() => removeSpan(spanIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* Span Properties */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          value={span.length}
                          onChange={(e) =>
                            updateSpan(spanIndex, "length", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          E (Pa)
                        </label>
                        <input
                          type="number"
                          value={span.E}
                          onChange={(e) =>
                            updateSpan(spanIndex, "E", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="1e9"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          I (m⁴)
                        </label>
                        <input
                          type="number"
                          value={span.I}
                          onChange={(e) =>
                            updateSpan(spanIndex, "I", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="1e-6"
                        />
                      </div>
                    </div>

                    {/* Loads */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-700">Loads</h4>
                        <button
                          onClick={() => addLoad(spanIndex)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          <Plus className="h-4 w-4 inline mr-1" />
                          Add Load
                        </button>
                      </div>

                      {span.loads.map((load, loadIndex) => (
                        <div
                          key={loadIndex}
                          className="bg-gray-50 p-3 rounded mb-2"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h5 className="text-sm font-medium text-gray-600">
                              Load {loadIndex + 1}
                            </h5>
                            <button
                              onClick={() => removeLoad(spanIndex, loadIndex)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Load Type
                              </label>
                              <select
                                value={load.load_type}
                                onChange={(e) =>
                                  updateLoad(
                                    spanIndex,
                                    loadIndex,
                                    "load_type",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="Point Load">Point Load</option>
                                <option value="Uniformly Distributed Load">
                                  UDL
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Magnitude{" "}
                                {load.load_type === "Point Load"
                                  ? "(kN)"
                                  : "(kN/m)"}
                              </label>
                              <input
                                type="number"
                                value={load.magnitude}
                                onChange={(e) =>
                                  updateLoad(
                                    spanIndex,
                                    loadIndex,
                                    "magnitude",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                step="0.1"
                              />
                            </div>
                            {load.load_type === "Point Load" && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Position (m)
                                </label>
                                <input
                                  type="number"
                                  value={load.position}
                                  onChange={(e) =>
                                    updateLoad(
                                      spanIndex,
                                      loadIndex,
                                      "position",
                                      e.target.value
                                    )
                                  }
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                  step="0.1"
                                  max={span.length}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {span.loads.length === 0 && (
                        <div className="text-gray-500 text-sm text-center py-4">
                          No loads defined for this span
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <BeamSchematic spans={spans} supports={supports} results={results} />

            {/* Analyze Button */}
            <div className="flex justify-center">
              <button
                onClick={analyzeBeam}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-lg font-semibold"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <Play className="h-5 w-5 mr-3" />
                )}
                {loading ? "Analyzing..." : "Analyze Beam"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "results" && results && (
          <div className="space-y-6">
            <BeamSchematic spans={spans} supports={supports} results={results} />
            <DiagramsPanel results={results} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Three-Moment Theorem Calculator</p>
          <p className="mt-1">© 2024 - Professional Structural Analysis Tool</p>
        </div>
      </div>
    </div>
  );
};

export default EnhancedThreeMomentCalculator;
