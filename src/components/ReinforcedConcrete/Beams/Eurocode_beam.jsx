import React, { useState, useEffect } from "react";
import {
    Calculator,
    Save,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Download,
    Maximize2,
    Box,
    Layers,
    Ruler
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    ReferenceLine,
} from "recharts";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { MultiSpanBeam3D } from "./Beam_THree";

// API Configuration
const API_BASE_URL = "http://127.0.0.1:8001/eurocode_beam";

const EurocodeBeamDesign = () => {
    const [activeTab, setActiveTab] = useState("input"); // input, results, 3d, 2d
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);

    // Input State
    const [beamData, setBeamData] = useState({
        span: 6,
        width: 300,
        depth: 500,
        cover: 30,
        fck: 30,
        fyk: 500,
        beam_type: "rectangular",
        flange_width: 1000,
        flange_thickness: 150,
        support_type: "simply_supported",
        exposure_class: "XC1",
    });

    const [loads, setLoads] = useState([
        { id: 1, type: "udl", magnitude: 15, start: 0, end: 6 },
        { id: 2, type: "point", magnitude: 50, position: 3 },
    ]);

    // Handle Input Changes
    const handleInputChange = (field, value) => {
        setBeamData((prev) => ({ ...prev, [field]: value }));
    };

    const handleLoadChange = (id, field, value) => {
        setLoads((prev) =>
            prev.map((load) => (load.id === id ? { ...load, [field]: value } : load))
        );
    };

    const addLoad = () => {
        const newId = Math.max(...loads.map((l) => l.id), 0) + 1;
        setLoads([...loads, { id: newId, type: "point", magnitude: 0, position: 0 }]);
    };

    const removeLoad = (id) => {
        setLoads(loads.filter((l) => l.id !== id));
    };

    // Perform Design
    const performDesign = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...beamData,
                loads: loads.map(({ id, ...rest }) => rest),
            };

            const response = await fetch(`${API_BASE_URL}/design`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Design calculation failed");
            }

            const data = await response.json();
            setResults(data);
            setActiveTab("results");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Generate DXF
    const generateDXF = async () => {
        if (!results) return;
        try {
            // Map Eurocode results to AutoCad Drawer format
            const dxfPayload = {
                span: beamData.span, // m
                width: beamData.width, // mm
                depth: beamData.depth, // mm
                // Extract reinforcement from detailing
                top_reinforcement: {
                    bar_count: 2, // Minimal top steel
                    bar_diameter: 12
                },
                bottom_reinforcement: {
                    bar_count: results.detailing.main_steel.bottom_bars.count,
                    bar_diameter: results.detailing.main_steel.bottom_bars.size
                },
                links: {
                    diameter: results.detailing.shear_links.size,
                    spacing: results.detailing.shear_links.spacing,
                    legs: results.detailing.shear_links.legs
                },
                beam_type: beamData.beam_type,
                flange_width: beamData.flange_width,
                flange_thickness: beamData.flange_thickness,
                standard: "Eurocode 2"
            };

            const response = await fetch("http://127.0.0.1:8001/api/export-dxf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dxfPayload),
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Eurocode_Beam_${beamData.beam_type}.dxf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert("Failed to generate DXF");
            }
        } catch (e) {
            console.error(e);
            alert("Error generating DXF");
        }
    };

    // Prepare Data for 3D Visualization
    const get3DData = () => {
        if (!results) return null;

        // Map Eurocode detailing to visualization format
        const spanDesign = {
            id: 1,
            name: "Span 1",
            length: beamData.span * 1000, // mm
            section: {
                width: beamData.width,
                depth: beamData.depth,
                bw: beamData.width, // assuming rectangular for now updates if T/L
                hf: beamData.flange_thickness,
                bf: beamData.flange_width,
                type: beamData.beam_type === "rectangular" ? "Rectangular" : beamData.beam_type
            },
            reinforcement: {
                main_top: {
                    count: 2,
                    diameter: 12,
                    layers: [{ count: 2, size: 12 }]
                }, // Min top steel
                main_bottom: {
                    count: results.detailing.main_steel.bottom_bars.count,
                    diameter: results.detailing.main_steel.bottom_bars.size,
                    layers: [{ count: results.detailing.main_steel.bottom_bars.count, size: results.detailing.main_steel.bottom_bars.size }]
                },
                shear_links: {
                    diameter: results.detailing.shear_links.size,
                    spacing: results.detailing.shear_links.spacing,
                    legs: results.detailing.shear_links.legs
                }
            }
        };

        return {
            spans: [spanDesign],
            supports: [
                { type: beamData.support_type === "simply_supported" ? "pinned" : "fixed", position: 0 },
                { type: beamData.support_type === "simply_supported" ? "roller" : "fixed", position: beamData.span * 1000 }
            ]
        };
    };

    // Rendering Helpers (Charts etc.)
    const renderCharts = () => {
        if (!results) return null;

        const chartData = results.analysis.x_points.map((x, i) => ({
            x: x.toFixed(2),
            moment: results.analysis.moment[i]?.toFixed(2) || 0,
            shear: results.analysis.shear[i]?.toFixed(2) || 0,
        }));

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-4 text-center">Bending Moment (kNm)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
                            <YAxis />
                            <Tooltip />
                            <ReferenceLine y={0} stroke="#000" />
                            <Area type="monotone" dataKey="moment" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-4 text-center">Shear Force (kN)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
                            <YAxis />
                            <Tooltip />
                            <ReferenceLine y={0} stroke="#000" />
                            <Area type="monotone" dataKey="shear" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm mb-6">
                {["input", "results", "3d"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 rounded-lg font-bold transition-all ${activeTab === tab
                            ? "bg-blue-600 text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {activeTab === "input" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Ruler className="text-blue-500" /> Geometry</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Span (m)</label>
                                        <input type="number" value={beamData.span} onChange={(e) => handleInputChange("span", parseFloat(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-700" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Cover (mm)</label>
                                        <input type="number" value={beamData.cover} onChange={(e) => handleInputChange("cover", parseFloat(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-700" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Width (mm)</label>
                                        <input type="number" value={beamData.width} onChange={(e) => handleInputChange("width", parseFloat(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-700" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Depth (mm)</label>
                                        <input type="number" value={beamData.depth} onChange={(e) => handleInputChange("depth", parseFloat(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Concrete Strength (MPa)</label>
                                    <select value={beamData.fck} onChange={(e) => handleInputChange("fck", parseFloat(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-700">
                                        <option value="20">C20/25</option>
                                        <option value="25">C25/30</option>
                                        <option value="30">C30/37</option>
                                        <option value="35">C35/45</option>
                                        <option value="40">C40/50</option>
                                        <option value="45">C45/55</option>
                                        <option value="50">C50/60</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Layers className="text-green-500" /> Loads</h3>
                            {loads.map((load, index) => (
                                <div key={load.id} className="mb-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl relative">
                                    <button onClick={() => removeLoad(load.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <select value={load.type} onChange={(e) => handleLoadChange(load.id, "type", e.target.value)} className="p-1 rounded text-sm">
                                            <option value="udl">UDL (kN/m)</option>
                                            <option value="point">Point (kN)</option>
                                        </select>
                                        <input type="number" placeholder="Magnitude" value={load.magnitude} onChange={(e) => handleLoadChange(load.id, "magnitude", parseFloat(e.target.value))} className="p-1 rounded text-sm w-full" />
                                    </div>
                                    {load.type === "point" && (
                                        <input type="number" placeholder="Position (m)" value={load.position} onChange={(e) => handleLoadChange(load.id, "position", parseFloat(e.target.value))} className="p-1 rounded text-sm w-full" />
                                    )}
                                </div>
                            ))}
                            <button onClick={addLoad} className="w-full py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 font-bold text-sm">+ Add Load</button>
                        </div>
                    </div>

                    <button onClick={performDesign} disabled={loading} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition hover:scale-[1.01] text-lg flex items-center justify-center gap-2">
                        {loading ? <RefreshCw className="animate-spin" /> : <Calculator />} Perform Eurocode Design
                    </button>

                    {error && (
                        <div className="p-4 bg-red-100 text-red-700 rounded-xl flex items-center gap-2">
                            <AlertTriangle /> {error}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "results" && results && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex justify-end gap-2">
                        <button onClick={generateDXF} className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2 hover:bg-purple-700"><Download size={18} /> Export AutoCAD DXF</button>
                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700"><CheckCircle size={18} /> Save Report</button>
                    </div>

                    {renderCharts()}

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Design Summary</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-gray-500 uppercase text-xs mb-3">Flexural Design</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded">
                                        <span>Bottom Steel</span>
                                        <span className="font-bold">{results.detailing.main_steel.bottom_bars.count} H{results.detailing.main_steel.bottom_bars.size}</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded">
                                        <span>Method</span>
                                        <span className="font-bold">{results.flexural_design.type}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-500 uppercase text-xs mb-3">Shear Design</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded">
                                        <span>Links</span>
                                        <span className="font-bold">H{results.detailing.shear_links.size} @ {results.detailing.shear_links.spacing}mm</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded">
                                        <span>Legs</span>
                                        <span className="font-bold">{results.detailing.shear_links.legs}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <h3 className="font-bold text-gray-500 uppercase text-xs mb-3">Checks</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-3 rounded-lg border ${results.deflection.status === "OK" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                                    <strong>Deflection:</strong> {results.deflection.status} (L/d = {results.deflection.actual_span_depth_ratio.toFixed(2)})
                                </div>
                                <div className={`p-3 rounded-lg border ${results.cracking.status === "OK" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                                    <strong>Cracking:</strong> {results.cracking.status}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "3d" && results && (
                <div className="h-[600px] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
                    <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
                        <color attach="background" args={["#0f172a"]} />
                        <Stage environment="city" intensity={0.6}>
                            <MultiSpanBeam3D beamData={get3DData()} isDark={true} />
                        </Stage>
                        <OrbitControls makeDefault />
                    </Canvas>
                    <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded backdrop-blur-sm">
                        <p className="text-xs font-mono">Use mouse to rotate/zoom</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EurocodeBeamDesign;