import { Calculator, Download, Plus, Trash2, FileText, DoorOpen, Upload, Loader2, Eye, Box, X, Layers, Ruler } from 'lucide-react';
import React, { Suspense, useState, useEffect } from "react";
import descriptionsData from "../descriptions";

import axios from "axios";
import { Canvas } from "@react-three/fiber";
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import StructuralVisualizationComponent from '../../Drawings/visualise_component';
import {
    PageHeader,
    Section,
    MetaChip,
    NumberField,
    TextField,
    SegmentedField,
    CheckboxField,
    TechnicalDetails,
    ErrorNotice,
    EmptyState,
    TableScrollRegion,
    ActionBar,
    action,
    layout,
    text,
} from '../../shared/ui';

const API_BASE = `http://${window.location.hostname}:8001`;


const DoorWindowTakeoff = () => {
    const [itemType, setItemType] = useState('door');
    const [activeTab, setActiveTab] = useState("calculator");
    const [formData, setFormData] = useState({
        opening_W: '',
        opening_H: '',
        wall_thick: '0.2',
        frame_W: '100',
        frame_thick: '50',
        horn_L: '150',
        architrave_W: '38',
        architrave_thick: '14',
        quadrant_size: '25',
        lintel_bearing: '0.2',
        lintel_H: '0.2',
        reinf_bar_diam: '12',
        num_reinf_bars: '4',
        cover: '25',
        reinf_extra: '0.05',
        form_type: 'timber',
        // Door specific
        leaf_thick: '45',
        leaf_material: 'flush with plywood',
        leaping_size: '10',
        num_doors: '1',
        num_locks: '1',
        num_stoppers: '1',
        num_bolts: '2',
        num_clamps: '5',
        num_hinges: '3',
        // Window specific
        glazing_thick: '5',
        num_panes: '2',
        has_mullions: false,
        mullion_L: '',
        mullion_size: '',
        num_windows: '1',
        has_grills: false,
        has_mesh: false,
    });

    const [takeoffData, setTakeoffData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [calcError, setCalcError] = useState(null);
    const [editorKey, setEditorKey] = useState(0);
    const [calcSubTab, setCalcSubTab] = useState("automation");

    // Automation State
    const [buildingData, setBuildingData] = useState(null);
    const [fileId, setFileId] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [planImageUrl, setPlanImageUrl] = useState("");
    const [activeSegment, setActiveSegment] = useState("all");

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setProcessing(true);

        const isImage = file.type.startsWith("image/");
        if (isImage) {
            setPlanImageUrl(URL.createObjectURL(file));
        } else {
            setPlanImageUrl("cad_placeholder");
        }

        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
            const data = await res.json();
            setFileId(data.file_id);
            await processFloorplan(data.file_id);
        } catch (err) { console.error(err); }
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
            // After process, we could pre-fill the first door/window
        } catch (err) { console.error(err); }
    };

    const selectExtractedItem = (item, type) => {
        setItemType(type);
        setFormData(prev => ({
            ...prev,
            opening_W: item.width.toFixed(2),
            opening_H: item.height.toFixed(2),
            [type === 'door' ? 'num_doors' : 'num_windows']: 1,
            leaf_material: item.type || prev.leaf_material
        }));
    };

    const [descriptions, setDescriptions] = useState([
        { id: 1, text: 'Supply, cut, prepare and fix' },
        { id: 2, text: 'Include all labour and materials' },
        { id: 3, text: 'As per specification' },
        { id: 4, text: 'Fix in position including waste' },
        { id: 5, text: 'Complete as shown on drawings' }
    ]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Value-based setter used by the shared fields. Same storage contract as
    // `handleInputChange`: the raw value is kept as-is and parsed at payload time.
    const setField = (name) => (value) =>
        setFormData(prev => ({ ...prev, [name]: value }));

    const handleDescriptionChange = (id, text) => {
        setDescriptions(prev => prev.map(desc =>
            desc.id === id ? { ...desc, text } : desc
        ));
    };

    // Auto-calculate when itemType changes to reset/refresh defaults
    useEffect(() => {
        // Optional: Could trigger calculation or reset here
        // calculateQuantities(); 
    }, [itemType]);

    const calculateQuantities = async () => {
        setLoading(true);
        setCalcError(null);
        try {
            const payload = {
                opening_W: parseFloat(formData.opening_W) || 0,
                opening_H: parseFloat(formData.opening_H) || 0,
                wall_thick: parseFloat(formData.wall_thick) || 0.2,
                frame_W: parseFloat(formData.frame_W) || 100,
                frame_thick: parseFloat(formData.frame_thick) || 50,
                horn_L: parseFloat(formData.horn_L) || 150,
                architrave_W: parseFloat(formData.architrave_W) || 38,
                architrave_thick: parseFloat(formData.architrave_thick) || 14,
                quadrant_size: parseFloat(formData.quadrant_size) || 25,
                lintel_bearing: parseFloat(formData.lintel_bearing) || 0.2,
                lintel_H: parseFloat(formData.lintel_H) || 0.2,
                reinf_bar_diam: parseFloat(formData.reinf_bar_diam) || 12,
                num_reinf_bars: parseInt(formData.num_reinf_bars) || 4,
                cover: parseFloat(formData.cover) || 25,
                reinf_extra: parseFloat(formData.reinf_extra) || 0.05,
                form_type: formData.form_type,
                // Door specific
                leaf_thick: parseFloat(formData.leaf_thick) || 45,
                leaf_material: formData.leaf_material,
                leaping_size: parseFloat(formData.leaping_size) || 10,
                num_doors: parseInt(formData.num_doors) || 1,
                num_locks: parseInt(formData.num_locks) || 1,
                num_stoppers: parseInt(formData.num_stoppers) || 1,
                num_bolts: parseInt(formData.num_bolts) || 2,
                num_clamps: parseInt(formData.num_clamps) || 5,
                num_hinges: parseInt(formData.num_hinges) || 3,
                // Window specific
                glazing_thick: parseFloat(formData.glazing_thick) || 5,
                num_panes: parseInt(formData.num_panes) || 1,
                has_mullions: formData.has_mullions,
                mullion_L: parseFloat(formData.mullion_L) || 0,
                mullion_size: parseFloat(formData.mullion_size) || 0,
                num_windows: parseInt(formData.num_windows) || 1,
                has_grills: formData.has_grills,
                has_mesh: formData.has_mesh
            };

            const endpoint = itemType === 'door' ? "door" : "window";
            const response = await axios.post(`http://localhost:8001/Door_window_router/api/calculate/${endpoint}`, payload);
            const data = response.data;

            if (data && Array.isArray(data)) {
                const formattedItems = data.map((item, index) => ({
                    id: index + 1,
                    billNo: item.billNo || (index + 1).toString(),
                    itemNo: (index + 1).toString(),
                    description: item.description,
                    unit: item.unit,
                    quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0,
                    rate: 0,
                    amount: 0,
                    dimensions: [],
                    isHeader: false
                }));

                setTakeoffData(formattedItems);
                setEditorKey(prev => prev + 1);
            }
        } catch (error) {
            console.error('Calculation error:', error);
            // Replaces the previous alert(); failures are reported inline.
            setCalcError(
                error?.response?.data?.detail ||
                    error?.message ||
                    "Calculation failed. The backend may be offline."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-gray-50">
            <div className="mx-auto w-full max-w-7xl px-3 pt-4 sm:px-5">
                <PageHeader
                    title="Door and window takeoff"
                    subtitle="Openings, frames, lintels, ironmongery and glazing quantities."
                    icon={<DoorOpen size={22} aria-hidden="true" />}
                    meta={
                        <>
                            <MetaChip tone="info">{itemType === 'door' ? 'Internal door' : 'Window'}</MetaChip>
                            <MetaChip>{takeoffData.length} item(s) generated</MetaChip>
                        </>
                    }
                />
                <div className="-mx-1 mb-4 overflow-x-auto">
                    <UniversalTabs
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        tabs={['calculator', 'takeoff', 'sheet', 'boq', '3d-view']}
                    />
                </div>
            </div>

            <main className="mx-auto w-full max-w-7xl px-3 pb-8 sm:px-5">
                {activeTab === 'calculator' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Configuration */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
                                <div className="flex border-b border-gray-200 bg-gray-50">
                                    {["automation", "params"].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setCalcSubTab(tab)}
                                            className={`flex-1 py-3 text-sm font-medium transition-colors ${calcSubTab === tab ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                                        >
                                            {tab === 'automation' ? 'AI Detection' : 'Manual Settings'}
                                        </button>
                                    ))}
                                </div>
                                {calcSubTab === "automation" && (
                                    <div className="p-4 space-y-4">
                                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                                            {processing ? (
                                                <div className="flex flex-col items-center py-4">
                                                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                                                    <span className="text-xs text-gray-500 font-medium">Extracting Openings...</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <Upload className="w-8 h-8 text-blue-400 mb-2" />
                                                    <p className="text-xs text-gray-500 mb-3">Upload plan to list all doors & windows</p>
                                                    <input type="file" id="dw-upload" className="hidden" accept="image/*,.dxf,.ifc" onChange={handleUpload} />
                                                    <label htmlFor="dw-upload" className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer hover:bg-blue-700">Upload Plan (Img/CAD)</label>
                                                    {buildingData && (
                                                        <button
                                                            onClick={() => setShowPlanModal(true)}
                                                            className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-white rounded text-xs font-bold hover:bg-black transition-colors shadow-md mt-2"
                                                        >
                                                            <Eye size={14} />
                                                            View Plan
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {buildingData && (
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Detected Items</h3>
                                                {buildingData.floors[0].doors.map((d, i) => (
                                                    <div key={`d-${i}`} onClick={() => selectExtractedItem(d, 'door')} className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <DoorOpen className="w-3 h-3 text-orange-600" />
                                                            <span className="text-[11px] font-medium">Door {i + 1} ({d.width.toFixed(1)}x{d.height.toFixed(1)}m)</span>
                                                        </div>
                                                        <span className="text-[10px] bg-orange-200 text-orange-700 px-1.5 rounded italic">Pick</span>
                                                    </div>
                                                ))}
                                                {buildingData.floors[0].windows.map((w, i) => (
                                                    <div key={`w-${i}`} onClick={() => selectExtractedItem(w, 'window')} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <Box className="w-3 h-3 text-blue-600" />
                                                            <span className="text-[11px] font-medium">Window {i + 1} ({w.width.toFixed(1)}x{w.height.toFixed(1)}m)</span>
                                                        </div>
                                                        <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 rounded italic">Pick</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Section
                                title="Opening type"
                                description="Doors and windows use different quantity rules."
                                icon={<DoorOpen size={18} aria-hidden="true" />}
                            >
                                <SegmentedField
                                    label="Type"
                                    value={itemType}
                                    onChange={(value) => setItemType(value)}
                                    options={[
                                        { value: 'door', label: 'Internal door' },
                                        { value: 'window', label: 'Window' },
                                    ]}
                                />
                            </Section>

                            <Section
                                title="Measurements"
                                description="Opening, frame and lining dimensions."
                                icon={<Ruler size={18} aria-hidden="true" />}
                            >
                                <div className={layout.formGrid}>
                                    <NumberField label="Opening width" unit="m" step="0.01" min={0} value={formData.opening_W} onChange={setField('opening_W')} />
                                    <NumberField label="Opening height" unit="m" step="0.01" min={0} value={formData.opening_H} onChange={setField('opening_H')} />
                                    <NumberField label="Wall thickness" unit="m" step="0.01" min={0} value={formData.wall_thick} onChange={setField('wall_thick')} />
                                    <NumberField label="Frame width" unit="mm" step="1" min={0} value={formData.frame_W} onChange={setField('frame_W')} />
                                </div>

                                {itemType === 'door' ? (
                                    <>
                                        <div className={`${layout.formGrid} mt-3 border-t border-gray-200 pt-3 dark:border-slate-800`}>
                                            <NumberField label="Number of doors" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_doors} onChange={setField('num_doors')} />
                                            <NumberField label="Leaf thickness" unit="mm" step="1" min={0} value={formData.leaf_thick} onChange={setField('leaf_thick')} />
                                            <div className="sm:col-span-2">
                                                <TextField label="Leaf material" value={formData.leaf_material} onChange={setField('leaf_material')} />
                                            </div>
                                            <NumberField label="Locks per door" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_locks} onChange={setField('num_locks')} />
                                            <NumberField label="Hinges per door" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_hinges} onChange={setField('num_hinges')} />
                                            <NumberField label="Bolts per door" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_bolts} onChange={setField('num_bolts')} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={`${layout.formGrid} mt-3 border-t border-gray-200 pt-3 dark:border-slate-800`}>
                                            <NumberField label="Number of windows" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_windows} onChange={setField('num_windows')} />
                                            <NumberField label="Number of panes" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_panes} onChange={setField('num_panes')} />
                                            <NumberField label="Glazing thickness" unit="mm" step="1" min={0} value={formData.glazing_thick} onChange={setField('glazing_thick')} />
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                            <CheckboxField label="Include grills" checked={formData.has_grills} onChange={setField('has_grills')} />
                                            <CheckboxField label="Include mesh" checked={formData.has_mesh} onChange={setField('has_mesh')} />
                                        </div>
                                    </>
                                )}

                                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 dark:border-slate-800 sm:grid-cols-2">
                                    <NumberField label="Lintel bearing" unit="m" step="0.01" min={0} value={formData.lintel_bearing} onChange={setField('lintel_bearing')} />
                                    <NumberField label="Lintel height" unit="m" step="0.01" min={0} value={formData.lintel_H} onChange={setField('lintel_H')} />
                                </div>

                                <TechnicalDetails summary="Frame, architrave, lintel reinforcement and winder details" className="mt-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <NumberField label="Frame thickness" unit="mm" step="1" min={0} value={formData.frame_thick} onChange={setField('frame_thick')} />
                                        <NumberField label="Horn length" unit="mm" step="1" min={0} value={formData.horn_L} onChange={setField('horn_L')} />
                                        <NumberField label="Architrave width" unit="mm" step="1" min={0} value={formData.architrave_W} onChange={setField('architrave_W')} />
                                        <NumberField label="Architrave thickness" unit="mm" step="1" min={0} value={formData.architrave_thick} onChange={setField('architrave_thick')} />
                                        <NumberField label="Quadrant size" unit="mm" step="1" min={0} value={formData.quadrant_size} onChange={setField('quadrant_size')} />
                                        <NumberField label="Lintel bar diameter" unit="mm" step="1" min={0} value={formData.reinf_bar_diam} onChange={setField('reinf_bar_diam')} />
                                        <NumberField label="Lintel bars" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_reinf_bars} onChange={setField('num_reinf_bars')} />
                                        <NumberField label="Lintel cover" unit="mm" step="1" min={0} value={formData.cover} onChange={setField('cover')} />
                                        <NumberField label="Reinforcement extra" unit="m" step="0.01" min={0} value={formData.reinf_extra} onChange={setField('reinf_extra')} />
                                        <TextField label="Form type" value={formData.form_type} onChange={setField('form_type')} />
                                        <NumberField label="Leaping size" unit="mm" step="1" min={0} value={formData.leaping_size} onChange={setField('leaping_size')} />
                                        <NumberField label="Stoppers" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_stoppers} onChange={setField('num_stoppers')} />
                                        <NumberField label="Clamps" unit="no." step="1" min={0} inputMode="numeric" value={formData.num_clamps} onChange={setField('num_clamps')} />
                                        <NumberField label="Mullion length" unit="m" step="0.01" min={0} value={formData.mullion_L} onChange={setField('mullion_L')} />
                                        <NumberField label="Mullion size" unit="mm" step="1" min={0} value={formData.mullion_size} onChange={setField('mullion_size')} />
                                    </div>
                                    <div className="mt-2">
                                        <CheckboxField label="Include mullions" checked={formData.has_mullions} onChange={setField('has_mullions')} />
                                    </div>
                                </TechnicalDetails>

                                <ActionBar sticky={false} hint="Opening width is required before calculating.">
                                    <button
                                        type="button"
                                        onClick={calculateQuantities}
                                        disabled={loading || !formData.opening_W}
                                        className={`${action.base} ${action.primary}`}
                                    >
                                        <Calculator size={16} aria-hidden="true" />
                                        {loading ? 'Calculating…' : 'Calculate quantities'}
                                    </button>
                                </ActionBar>

                                {calcError && (
                                    <ErrorNotice
                                        className="mt-3"
                                        title="Door/window takeoff failed"
                                        message={calcError}
                                        onRetry={calculateQuantities}
                                    />
                                )}
                            </Section>
                        </div>

                        {/* Summary / Preview */}
                        <div className="lg:col-span-2">
                            <Section
                                title="Calculation summary"
                                description="Quantities from the current opening definition."
                                icon={<FileText size={18} aria-hidden="true" />}
                                className="h-full"
                            >
                                <p className={`mb-3 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed dark:bg-slate-800/60 ${text.subtitle}`}>
                                    Fill in the measurements and calculate. Switch to <strong>Takeoff sheet</strong> to edit
                                    descriptions and values, and to the <strong>Dimension paper</strong> for measurement breakdowns.
                                </p>

                                {takeoffData.length > 0 ? (
                                    <TableScrollRegion label="Door and window takeoff summary" minWidth="32rem" hint={false}>
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-100 dark:bg-slate-800">
                                                <tr>
                                                    <th className="px-2 py-2 text-left font-semibold sm:px-3">Description</th>
                                                    <th className="px-2 py-2 text-center font-semibold">Unit</th>
                                                    <th className="px-2 py-2 text-right font-semibold sm:px-3">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {takeoffData.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                                        <td className="px-2 py-2 text-xs sm:px-3 sm:text-sm">{item.description}</td>
                                                        <td className="px-2 py-2 text-center text-xs">{item.unit}</td>
                                                        <td className="px-2 py-2 text-right font-mono text-xs sm:px-3 sm:text-sm">
                                                            {item.quantity?.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </TableScrollRegion>
                                ) : (
                                    <EmptyState
                                        compact
                                        title="No items calculated yet"
                                        description="Enter the opening width and height, then calculate to generate the schedule."
                                    />
                                )}
                            </Section>
                        </div>
                    </div>
                )}

                {activeTab === 'takeoff' && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
                        <EnglishMethodTakeoffSheet
                            key={editorKey}
                            initialItems={takeoffData}
                            onChange={setTakeoffData}
                            projectInfo={{
                                projectName: "Door & Window Schedule",
                                clientName: "Client Name",
                                projectDate: new Date().toLocaleDateString()
                            }}
                        />
                    </div>
                )}

                {activeTab === 'sheet' && (
                    <div className="h-full">
                        <UniversalSheet items={takeoffData} />
                    </div>
                )}

                {activeTab === 'boq' && (
                    <div className="h-full">
                        <UniversalBOQ items={takeoffData} />
                    </div>
                )}

                {activeTab === '3d-view' && (
                    <div className="h-full bg-slate-900 rounded-lg overflow-hidden relative border border-slate-800 shadow-2xl">
                        {buildingData ? (
                            <StructuralVisualizationComponent
                                componentType="doorWindow"
                                buildingData={buildingData}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-400">
                                <DoorOpen className="w-16 h-16 opacity-20" />
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-slate-200">No Openings Visual</h3>
                                    <p className="text-sm">Upload a plan to see all doors and windows in 3D.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveTab('calculator'); setCalcSubTab('automation'); }}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"
                                >
                                    Start Detection
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Plan Image Modal */}
            {
                showPlanModal && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10">
                        <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
                            <div className="p-4 border-b flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-600 p-2 rounded-lg">
                                        <Layers className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Opening Detection Visualization</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">AutoCAD Standard Layer Inspection</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center relative min-h-[500px]">
                                <div className="relative inline-block border-4 border-white shadow-2xl rounded-lg overflow-hidden">
                                    {planImageUrl === "cad_placeholder" ? (
                                        <div className="w-[600px] h-[400px] bg-slate-900 flex flex-col items-center justify-center text-white p-8 space-y-4">
                                            <Box size={64} className="text-blue-400" />
                                            <h3 className="text-xl font-bold">CAD File Render</h3>
                                            <p className="text-sm text-slate-400 text-center">AutoCAD/Revit/ArchiCAD data extracted successfully. Close this view to see calculated results in the forms.</p>
                                        </div>
                                    ) : (
                                        <img
                                            src={planImageUrl}
                                            alt="Floor Plan"
                                            className={`max-w-full h-auto transition-all duration-500 ${activeSegment !== 'all' ? 'opacity-0 grayscale-[70%]' : 'opacity-100'}`}
                                        />
                                    )}
                                    {activeSegment !== 'all' && planImageUrl !== "cad_placeholder" && (
                                        <img
                                            src={`${API_BASE}/opencv/${activeSegment}?file_id=${buildingData?.project_id}`}
                                            alt={`${activeSegment} Layer`}
                                            className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply transition-all duration-300 contrast-125 brightness-110"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Layer Switcher:</span>
                                    {[
                                        { id: 'all', label: 'Plan', color: 'bg-gray-600' },
                                        { id: 'rooms', label: 'Rooms (Heatmap)', color: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' },
                                        { id: 'walls', label: 'Walls', color: 'bg-black' },
                                        { id: 'slabs', label: 'Slab Contours', color: 'bg-black' },
                                        { id: 'beams', label: 'Beams', color: 'bg-black' },
                                        { id: 'columns', label: 'Columns', color: 'bg-black' },
                                        { id: 'stairs', label: 'Stairs', color: 'bg-black' },
                                        { id: 'contours', label: 'Structural Contours', color: 'bg-black' }
                                    ].map(layer => (
                                        <button
                                            key={layer.id}
                                            onClick={() => setActiveSegment(layer.id)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${activeSegment === layer.id ? `${layer.color} text-white shadow-lg scale-105` : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${activeSegment === layer.id ? 'bg-white animate-pulse' : layer.color}`} />
                                            {layer.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowPlanModal(false)}
                                    className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors text-xs uppercase tracking-widest"
                                >
                                    Exit View
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// Helper Icon Component if needed, otherwise use lucide-react default
function BuildingIcon({ className }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
}

export default DoorWindowTakeoff;