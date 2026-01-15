import React, { useState, Suspense } from "react";
import {
    Calculator,
    Plus,
    Trash2,
    Download,
    FileText,
    Zap,
    Droplets,
    Upload,
    Loader2,
    Eye,
    Box,
    Settings as SettingsIcon
} from "lucide-react";
import axios from "axios";
import { Canvas } from "@react-three/fiber";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';
import StructuralVisualizationComponent from '../Drawings/visualise_component';

const API_BASE = "http://localhost:8001";

// Ray-casting algorithm for point in polygon
function isPointInPoly(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let x = pt[0], y = pt[1];
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        let xi = poly[i][0], yi = poly[i][1];
        let xj = poly[j][0], yj = poly[j][1];
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}


const ElectricalPlumbingTakeoff = () => {
    const [activeTab, setActiveTab] = useState("calculator");
    const [calcSubTab, setCalcSubTab] = useState("params");
    const [loading, setLoading] = useState(false);

    // Automation State
    const [buildingData, setBuildingData] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [takeoffData, setTakeoffData] = useState([]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setProcessing(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
            const data = await res.json();
            await processFloorplan(data.file_id);
        } catch (err) { console.error("Upload error:", err); }
        setProcessing(false);
    };

    const processFloorplan = async (fid) => {
        const fd = new FormData();
        fd.append("file_id", fid);
        fd.append("use_yolo", "true");
        try {
            const res = await fetch(`${API_BASE}/arch_pro/api/process`, { method: "POST", body: fd });
            const data = await res.json();
            setBuildingData(data);
            if (data.floors && data.floors[0]) {
                calculateQuantities(data.floors[0]);
            }
        } catch (err) { console.error("Process error:", err); }
    };

    const calculateQuantities = async (floorData) => {
        try {
            const payload = {
                rooms: floorData.rooms ? floorData.rooms.map(r => ({
                    name: r.name,
                    room_type: r.type,
                    polygon: r.polygon,
                    detected_objects: floorData.furniture ? floorData.furniture.filter(f => isPointInPoly(f.position, r.polygon)).map(f => ({
                        class_name: f.type,
                        confidence: f.confidence || 1.0,
                        centroid: f.position,
                        bbox: [f.position[0] - 0.5, f.position[1] - 0.5, f.position[0] + 0.5, f.position[1] + 0.5] // Dummy bbox if missing
                    })) : []
                })) : [],
                walls: floorData.walls ? floorData.walls.map(w => ({
                    start: w.start,
                    end: w.end,
                    thickness: w.thickness,
                    type: w.is_external ? "external" : "internal"
                })) : [],
                doors: floorData.doors ? floorData.doors.map(d => ({
                    class_name: "door",
                    centroid: d.position,
                    bbox: [d.position[0] - d.width / 2, d.position[1] - 0.1, d.position[0] + d.width / 2, d.position[1] + 0.1]
                })) : [],
                windows: floorData.windows ? floorData.windows.map(w => ({
                    class_name: "window",
                    centroid: w.position,
                    bbox: [w.position[0] - w.width / 2, w.position[1] - 0.1, w.position[0] + w.width / 2, w.position[1] + 0.1]
                })) : [],
                global_objects: floorData.furniture ? floorData.furniture.map(f => ({
                    class_name: f.type,
                    centroid: f.position,
                    bbox: [f.position[0] - f.size[0] / 2, f.position[1] - f.size[1] / 2, f.position[0] + f.size[0] / 2, f.position[1] + f.size[1] / 2]
                })) : [],
                level_height: floorData.height || 3.0
            };
            const res = await axios.post(`${API_BASE}/electrical_plumbing_takeoff/api/calculate`, payload);
            setTakeoffData(res.data.items);

            // Update 3D Visualization Data
            if (res.data.visualization && buildingData) {
                const viz = res.data.visualization;
                const newFloor = { ...buildingData.floors[0] };

                // Map generated points to scene format
                const newElec = [];
                const newPlumb = [];

                if (viz.points) {
                    viz.points.forEach((p, i) => {
                        const pointObj = {
                            id: `gen_${i}`,
                            position: [p.pos.x, p.pos.y],
                            height: p.pos.z,
                            type: p.type
                        };

                        if (["sink", "shower", "water", "drain"].some(k => p.type.includes(k))) {
                            newPlumb.push(pointObj);
                        } else {
                            newElec.push(pointObj);
                        }
                    });
                }

                newFloor.electrical = newElec;
                newFloor.plumbing = newPlumb;

                // Map generated lines
                if (viz.lines) {
                    newFloor.conduits = viz.lines.map((l, i) => ({
                        id: `gen_line_${i}`,
                        type: (l.type.includes("water") || l.type.includes("plumb")) ? "plumbing" : "electrical",
                        path: l.path // Expecting [[x,y,z], ...]
                    }));
                }

                setBuildingData({ ...buildingData, floors: [newFloor] });
            }
        } catch (err) { console.error("Calculation error:", err); } // Added basic error logging recovery
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="text-amber-500 w-7 h-7" />
                            Electrical & Plumbing Takeoff
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Automated conduit routing and fixture extraction</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">
                            <Download className="w-4 h-4" /> Export Report
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6">
                <div className="max-w-7xl mx-auto">
                    <UniversalTabs
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        tabs={['calculator', 'takeoff', 'sheet', 'boq', '3d-view']}
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto h-full">

                    {activeTab === 'calculator' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                            {/* Left Panel: Automation & Config */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="flex border-b border-slate-200 bg-slate-50">
                                        {["automation", "params"].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setCalcSubTab(tab)}
                                                className={`flex-1 py-3 text-sm font-bold transition-all ${calcSubTab === tab ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                                            >
                                                {tab === 'automation' ? 'AI AUTO-PLACE' : 'MANUAL SETUP'}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-6">
                                        {calcSubTab === "automation" && (
                                            <div className="space-y-6">
                                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative group">
                                                    {processing ? (
                                                        <div className="flex flex-col items-center py-4">
                                                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                                                            <h3 className="text-slate-900 font-bold text-lg">Analyzing Building Systems</h3>
                                                            <p className="text-slate-500 text-sm">Identifying fixtures and routing conduits...</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center py-4">
                                                            <Upload className="w-12 h-12 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                                                            <h3 className="text-slate-900 font-bold text-lg">Extract MEP Data</h3>
                                                            <p className="text-slate-500 text-sm mb-6">Upload floor plan to auto-calculate conduits & pipes</p>
                                                            <input type="file" id="mep-upload" className="hidden" onChange={handleUpload} />
                                                            <label htmlFor="mep-upload" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all cursor-pointer inline-block">
                                                                Select Plan Image
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>

                                                {buildingData && (
                                                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                                        <h4 className="text-blue-800 font-bold text-xs uppercase tracking-wider mb-3">AI Detection Results</h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                                <span className="text-slate-500 text-[10px] block uppercase font-bold">Electrical</span>
                                                                <span className="text-xl font-black text-slate-800">{buildingData.metadata.electrical_count || 0}</span>
                                                                <span className="text-[10px] text-slate-400 block">Points Found</span>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                                <span className="text-slate-500 text-[10px] block uppercase font-bold">Plumbing</span>
                                                                <span className="text-xl font-black text-slate-800">{buildingData.metadata.plumbing_count || 0}</span>
                                                                <span className="text-[10px] text-slate-400 block">Fixtures Found</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {calcSubTab === "params" && (
                                            <div className="space-y-4">
                                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-xs">
                                                    Manual overrides for MEP systems coming soon.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Results Summary */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            MEP Takeoff Summary
                                        </h2>
                                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase">Ref: EN-0001</span>
                                    </div>

                                    <div className="flex-1 overflow-auto">
                                        {takeoffData.length > 0 ? (
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        <th className="py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Item No</th>
                                                        <th className="py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Description</th>
                                                        <th className="py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Unit</th>
                                                        <th className="py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-right">Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {takeoffData.map((item, i) => (
                                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                            <td className="py-4 text-sm font-bold text-slate-900">{item.item_no}</td>
                                                            <td className="py-4 text-sm text-slate-600">{item.description}</td>
                                                            <td className="py-4 text-sm text-slate-500">{item.unit}</td>
                                                            <td className="py-4 text-sm font-black text-slate-900 text-right">{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                                                <Calculator className="w-16 h-16 opacity-10" />
                                                <p className="text-slate-400 font-medium italic text-center max-w-xs">Use AI Automation to extract quantities or manually add items to the sheet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'takeoff' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <EnglishMethodTakeoffSheet initialItems={takeoffData} onChange={setTakeoffData} />
                        </div>
                    )}

                    {activeTab === 'sheet' && <UniversalSheet items={takeoffData} />}
                    {activeTab === 'boq' && <UniversalBOQ items={takeoffData} />}

                    {activeTab === '3d-view' && (
                        <div className="h-full bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-800 shadow-2xl">
                            {buildingData ? (
                                <>
                                    <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
                                        <div className="bg-slate-800/80 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-700/50 flex items-center gap-3 shadow-2xl">
                                            <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-tighter">System View</span>
                                                <span className="text-sm font-black text-slate-100">MEP Network Visualizer</span>
                                            </div>
                                        </div>
                                    </div>
                                    <StructuralVisualizationComponent
                                        componentType="electricalPlumbing"
                                        buildingData={buildingData}
                                    />
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center space-y-6 text-slate-500">
                                    <div className="relative">
                                        <Box className="w-24 h-24 opacity-10" />
                                        <Zap className="w-12 h-12 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-2xl font-black text-slate-200">No Building Context</h3>
                                        <p className="text-slate-500 max-w-xs mx-auto mt-2">Upload an architectural plan to visualize electrical conduits and plumbing lines in 3D space.</p>
                                    </div>
                                    <button
                                        onClick={() => { setActiveTab('calculator'); setCalcSubTab('automation'); }}
                                        className="px-10 py-4 bg-slate-800 text-slate-100 rounded-2xl text-sm font-bold border border-slate-700 hover:bg-slate-700 transition-all shadow-xl"
                                    >
                                        Go to Upload
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default ElectricalPlumbingTakeoff;
