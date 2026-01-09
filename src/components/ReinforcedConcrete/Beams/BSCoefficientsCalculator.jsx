import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Calculator,
    AlertTriangle,
    CheckCircle,
    Zap,
    Plus,
    Minus,
    Play,
    ArrowRight
} from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from "recharts";

const API_BASE_URL = "http://localhost:8001/beam_analysis";

const BSCoefficientsCalculator = ({ isDark = false, onAnalysisComplete, initialParams }) => {
    const [spans, setSpans] = useState([
        { length: 5.0, g_k: 15.0, q_k: 10.0 },
        { length: 5.0, g_k: 15.0, q_k: 10.0 },
        { length: 5.0, g_k: 15.0, q_k: 10.0 },
    ]);

    // Initialize with passed props if available
    const [designParams, setDesignParams] = useState({
        beam_type: "Rectangular",
        support_condition: "Continuous",
        materials: {
            concrete_grade: "C30",
            steel_grade: "Grade 460",
            concrete_density: 25.0,
            steel_density: 78.5,
        },
        rectangular_geometry: {
            width: 300,
            depth: 500,
            cover: 25,
        },
        ...initialParams // Override with initialParams if provided
    });

    useEffect(() => {
        if (initialParams) {
            setDesignParams(prev => ({
                ...prev,
                ...initialParams,
                rectangular_geometry: { // Ensure geometry matches if flat params passed
                    width: initialParams.width || prev.rectangular_geometry.width,
                    depth: initialParams.depth || prev.rectangular_geometry.depth,
                    cover: initialParams.cover || prev.rectangular_geometry.cover
                },
                materials: {
                    ...prev.materials,
                    concrete_grade: initialParams.fcu ? `C${initialParams.fcu}` : prev.materials.concrete_grade,
                    steel_grade: initialParams.fy ? `Grade ${initialParams.fy}` : prev.materials.steel_grade
                }
            }));
        }
    }, [initialParams]);

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const addSpan = () => {
        if (spans.length < 5) {
            setSpans([...spans, { length: 5.0, g_k: 15.0, q_k: 10.0 }]);
        }
    };

    const removeSpan = () => {
        if (spans.length > 3) {
            setSpans(spans.slice(0, -1));
        }
    };

    const updateSpan = (index, field, value) => {
        const newSpans = [...spans];
        newSpans[index][field] = parseFloat(value) || 0;
        setSpans(newSpans);
    };

    const analyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const lengths = spans.map(s => s.length);
            const loads = spans.map(s => 1.4 * s.g_k + 1.6 * s.q_k); // ULS Load

            const analysisResponse = await axios.post(`${API_BASE_URL}/analyze_coefficients`, {
                spans_count: spans.length,
                loads: loads,
                span_lengths: lengths
            });

            setResults(analysisResponse.data);

            // Notify parent
            if (onAnalysisComplete) {
                onAnalysisComplete(analysisResponse.data);
            }

        } catch (err) {
            setError(err.response?.data?.detail || "Analysis failed. Ensure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`p-6 ${isDark ? "bg-slate-900 text-white" : "bg-gray-50 text-gray-900"}`}>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center mb-8">
                    <Calculator className="h-10 w-10 text-blue-600 mr-4" />
                    <div>
                        <h1 className="text-3xl font-bold">BS 8110 Coefficients Method</h1>
                        <p className="text-gray-500">Simplified Continuous Beam Design (Table 3.5)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Span Configurations</h3>
                            <div className="flex gap-2">
                                <button onClick={removeSpan} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                    <Minus className="h-4 w-4" />
                                </button>
                                <button onClick={addSpan} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {spans.map((span, idx) => (
                                <div key={idx} className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-700">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 block mb-1">Length (m)</label>
                                            <input type="number" value={span.length} onChange={(e) => updateSpan(idx, "length", e.target.value)} className="w-full bg-white dark:bg-slate-600 p-2 rounded border" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 block mb-1">Gk (kN/m)</label>
                                            <input type="number" value={span.g_k} onChange={(e) => updateSpan(idx, "g_k", e.target.value)} className="w-full bg-white dark:bg-slate-600 p-2 rounded border" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 block mb-1">Qk (kN/m)</label>
                                            <input type="number" value={span.q_k} onChange={(e) => updateSpan(idx, "q_k", e.target.value)} className="w-full bg-white dark:bg-slate-600 p-2 rounded border" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold mb-4">Design Parameters (Read-Only)</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 dark:bg-slate-700/50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500 block">Concrete</span>
                                        <span className="font-bold">{designParams?.materials?.concrete_grade || "C30"}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Steel</span>
                                        <span className="font-bold">{designParams?.materials?.steel_grade || "Grade 460"}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Section</span>
                                        <span className="font-bold">{designParams?.rectangular_geometry?.width}x{designParams?.rectangular_geometry?.depth} mm</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={analyze} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-blue-700 transition">
                                {loading ? "Calculating..." : <><Play className="h-5 w-5" /> Analyze Only</>}
                            </button>
                            {error && <p className="text-red-500 text-center text-sm">{error}</p>}
                        </div>
                    </div>
                </div>

                {results && (
                    <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-xl font-bold mb-4">Design Moment Summary</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={results.map((r, i) => ({ name: `Span ${i + 1}`, max_moment: Math.max(...Object.values(r.moments).map(Math.abs)) }))}>
                                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="max_moment" fill="#3B82F6" name="Design Moment (kNm)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BSCoefficientsCalculator;
