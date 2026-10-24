import React, { useState } from "react";
import {
    FileText,
    Zap,
    Upload,
    Loader2,
    Box,
} from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import StructuralVisualizationComponent from '../../Drawings/visualise_component';
import {
    WorkspacePage,
    PageHeader,
    Section,
    MetaChip,
    ErrorNotice,
    EmptyState,
    TableScrollRegion,
    action,
    text,
} from '../../shared/ui';

const API_BASE = `http://${window.location.hostname}:8001`;

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


/**
 * ElectricalPlumbingTakeoff — MEP conduit and fixture takeoff.
 *
 * UI cleanup:
 * - Shared page header, tabs, section and table treatment.
 * - Removed two placeholders: the "Export Report" button (no handler) and the
 *   "Manual setup — coming soon" tab (no implementation). The automation path
 *   and the editable taking-off sheet remain the two real ways to produce items.
 * - Failures now surface in an in-page error notice instead of being logged only.
 *
 * Preserved exactly: the upload/process endpoints, the calculation payload
 * (`rooms`, `walls`, `doors`, `windows`, `global_objects`, `level_height`), and
 * the visualization mapping into `buildingData`.
 */
const ElectricalPlumbingTakeoff = () => {
    const [activeTab, setActiveTab] = useState("calculator");
    const [loading, setLoading] = useState(false);
    const [calcError, setCalcError] = useState(null);

    // Automation State
    const [buildingData, setBuildingData] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [takeoffData, setTakeoffData] = useState([]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setProcessing(true);
        setCalcError(null);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
            const data = await res.json();
            // Note: MEP automation currently relies on image context for some rules,
            // but we allow CAD upload to extract basic geometry.
            await processFloorplan(data.file_id);
        } catch (err) {
            console.error("Upload error:", err);
            setCalcError("The plan could not be uploaded. Check that the architecture service is running.");
        }
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
        } catch (err) {
            console.error("Process error:", err);
            setCalcError("The uploaded plan could not be processed for MEP extraction.");
        }
    };

    const calculateQuantities = async (floorData) => {
        setLoading(true);
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
        } catch (err) {
            console.error("Calculation error:", err);
            setCalcError(
                err?.response?.data?.detail ||
                    err?.message ||
                    "MEP quantities could not be calculated."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <WorkspacePage width="wide">
            <PageHeader
                title="Electrical and plumbing takeoff"
                subtitle="Automated conduit routing, pipe runs and fixture extraction from plans."
                icon={<Zap size={22} aria-hidden="true" />}
                meta={
                    <>
                        <MetaChip tone="info">{takeoffData.length} item(s)</MetaChip>
                        {buildingData?.metadata && (
                            <MetaChip>
                                {buildingData.metadata.electrical_count || 0} electrical ·{' '}
                                {buildingData.metadata.plumbing_count || 0} plumbing
                            </MetaChip>
                        )}
                    </>
                }
            />

            <div className="mb-4 -mx-1 overflow-x-auto">
                <UniversalTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    tabs={['calculator', 'takeoff', 'sheet', 'boq', '3d-view']}
                />
            </div>

            {calcError && (
                <ErrorNotice
                    className="mb-4"
                    title="MEP takeoff failed"
                    message={calcError}
                />
            )}

            {activeTab === 'calculator' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
                    <div className="space-y-4 xl:col-span-1">
                        <Section
                            title="Plan automation"
                            description="Upload a floor plan or CAD export to detect fixtures and route conduits."
                            icon={<Upload size={18} aria-hidden="true" />}
                        >
                            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
                                {processing ? (
                                    <div className="flex flex-col items-center py-4">
                                        <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-600" aria-hidden="true" />
                                        <h3 className={`text-sm font-bold ${text.title}`}>Analysing building systems</h3>
                                        <p className={`text-xs ${text.subtitle}`}>Identifying fixtures and routing conduits…</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center py-2">
                                        <Upload className="mb-3 h-10 w-10 text-blue-500" aria-hidden="true" />
                                        <h3 className={`text-sm font-bold ${text.title}`}>Extract MEP data</h3>
                                        <p className={`mb-4 text-xs ${text.subtitle}`}>
                                            Upload a plan to calculate conduits and pipes.
                                        </p>
                                        <input type="file" id="mep-upload" className="sr-only" accept="image/*,.dxf,.ifc" onChange={handleUpload} />
                                        <label
                                            htmlFor="mep-upload"
                                            className={`${action.base} ${action.primary} cursor-pointer`}
                                        >
                                            Select plan (image / CAD)
                                        </label>
                                    </div>
                                )}
                            </div>

                            {buildingData?.metadata && (
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-900/20">
                                        <span className={`block text-[10px] font-bold uppercase ${text.helper}`}>Electrical</span>
                                        <span className={`block text-xl font-black ${text.title}`}>
                                            {buildingData.metadata.electrical_count || 0}
                                        </span>
                                        <span className={`block text-[10px] ${text.helper}`}>points found</span>
                                    </div>
                                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-900/20">
                                        <span className={`block text-[10px] font-bold uppercase ${text.helper}`}>Plumbing</span>
                                        <span className={`block text-xl font-black ${text.title}`}>
                                            {buildingData.metadata.plumbing_count || 0}
                                        </span>
                                        <span className={`block text-[10px] ${text.helper}`}>fixtures found</span>
                                    </div>
                                </div>
                            )}

                            {loading && (
                                <p className={`mt-3 text-xs ${text.subtitle}`} role="status">
                                    Calculating MEP quantities…
                                </p>
                            )}
                        </Section>
                    </div>

                    <div className="xl:col-span-2">
                        <Section
                            title="MEP takeoff summary"
                            description="Fixture and conduit rows generated from the current analysis."
                            icon={<FileText size={18} aria-hidden="true" />}
                            className="h-full"
                        >
                            {takeoffData.length > 0 ? (
                                <TableScrollRegion label="MEP takeoff summary" minWidth="34rem" hint={false}>
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-100 dark:bg-slate-800">
                                            <tr>
                                                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider sm:px-3">Item no</th>
                                                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider sm:px-3">Description</th>
                                                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider">Unit</th>
                                                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider sm:px-3">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {takeoffData.map((item, i) => (
                                                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                                    <td className="px-2 py-2 text-xs font-bold sm:px-3 sm:py-3">{item.item_no}</td>
                                                    <td className={`px-2 py-2 text-xs sm:px-3 sm:py-3 ${text.subtitle}`}>{item.description}</td>
                                                    <td className={`px-2 py-2 text-xs sm:py-3 ${text.subtitle}`}>{item.unit}</td>
                                                    <td className="px-2 py-2 text-right font-mono text-xs font-bold sm:px-3 sm:py-3">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableScrollRegion>
                            ) : (
                                <EmptyState
                                    compact
                                    title="No MEP items yet"
                                    description="Upload a plan to extract quantities, or add items directly in the taking-off sheet."
                                />
                            )}
                        </Section>
                    </div>
                </div>
            )}

            {activeTab === 'takeoff' && (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                    <EnglishMethodTakeoffSheet initialItems={takeoffData} onChange={setTakeoffData} />
                </div>
            )}

            {activeTab === 'sheet' && <UniversalSheet items={takeoffData} />}
            {activeTab === 'boq' && <UniversalBOQ items={takeoffData} />}

            {activeTab === '3d-view' && (
                <div className="relative h-[70vh] min-h-[360px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
                    {buildingData ? (
                        <>
                            <div className="absolute left-3 top-3 z-10 flex flex-col gap-3 sm:left-6 sm:top-6">
                                <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/80 px-3 py-2 shadow-2xl backdrop-blur-md sm:px-4 sm:py-3">
                                    <Zap className="h-5 w-5 text-amber-400" aria-hidden="true" />
                                    <div>
                                        <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-400">System view</span>
                                        <span className="text-xs font-black text-slate-100 sm:text-sm">MEP network visualiser</span>
                                    </div>
                                </div>
                            </div>
                            <StructuralVisualizationComponent
                                componentType="electricalPlumbing"
                                buildingData={buildingData}
                            />
                        </>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center text-slate-500">
                            <Box className="h-16 w-16 opacity-20" aria-hidden="true" />
                            <div>
                                <h3 className="text-base font-bold text-slate-200 sm:text-lg">No building context</h3>
                                <p className="mx-auto mt-2 max-w-xs text-xs sm:text-sm">
                                    Upload an architectural plan to visualise electrical conduits and plumbing lines in 3D.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('calculator')}
                                className={`${action.base} ${action.secondary}`}
                            >
                                Go to upload
                            </button>
                        </div>
                    )}
                </div>
            )}
        </WorkspacePage>
    );
};

export default ElectricalPlumbingTakeoff;
