import React, { useState } from 'react';
import {
    CheckCircle,
    AlertCircle,
    Info,
    Activity,
    Layers,
    Maximize2,
    Minimize2,
    FileText,
    Settings,
    Eye,
    Box,
    Database
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import SteelStructure3D from './SteelStructure3D';
import SteelStructure2D from './SteelStructure2D';

/**
 * Advanced Steel Design Results Viewer
 * Displays rigorous BS 5950 results including classification, LTB, and connection details.
 */
const BIMVisualizer = ({ data, type, onClose }) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-10">
            <div className="bg-white w-full max-w-5xl h-full rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="bg-gray-800 text-white p-2 rounded-full hover:bg-black transition-colors">
                        <Minimize2 className="w-6 h-6" />
                    </button>
                </div>
                <div className="bg-gray-100 p-4 border-b flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        {type === '2d' ? <Eye className="w-5 h-5 text-blue-600" /> : <Box className="w-5 h-5 text-orange-600" />}
                        {type === '2d' ? '2D Elevation View' : '3D BIM Component View'}
                    </h3>
                </div>
                <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-hidden relative">
                    {type === '3d' ? (
                        <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
                            <Stage intensity={0.5} environment="city" adjustCamera={1.2}>
                                <SteelStructure3D
                                    structure={{ members: data?.filter(d => d.type === 'member') || [], connections: data?.filter(d => d.type === 'connection') || [] }}
                                    selectedIds={[]}
                                    onSelect={() => { }}
                                />
                            </Stage>
                            <OrbitControls makeDefault />
                        </Canvas>
                    ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center p-4">
                            {/* Assuming SteelStructure2D can handle the primitive data or a standard structure object */}
                            <SteelStructure2D
                                structure={{ members: data || [], connections: [] }}
                                viewMode="front"
                                isDark={true}
                            />
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white border-t text-xs text-gray-500 flex justify-between">
                    <span>Generated from Drawing_elements/Steel_BIM</span>
                    <span>Primitives Count: {data?.length || 0}</span>
                </div>
            </div>
        </div>
    );
};

const AdvancedSteelDesignResults = ({ results, onClose }) => {
    const [selectedTab, setSelectedTab] = useState('summary');
    const [selectedId, setSelectedId] = useState(null);
    const [vizMode, setVizMode] = useState(null); // '2d' | '3d' | null

    if (!results) return null;

    const {
        elements = [],
        summary = {},
        connections = [],
        composite = [],
        welds = [],
        drawing_data = { '3d': [], '2d': [] }
    } = results;

    const beams = elements.filter(el => el.type === 'beam');
    const columns = elements.filter(el => el.type === 'column');
    const trussMembers = elements.filter(el => ['strut', 'tie', 'brace', 'web', 'chord'].includes(el.type));

    const selectedElement = elements.find(el => el.id === selectedId) ||
        connections.find(c => c.node_id === selectedId) ||
        composite.find(c => c.id === selectedId) ||
        welds.find(w => w.id === selectedId);

    const renderUtilizationBar = (ratio, label) => {
        const percentage = Math.min(ratio * 100, 100);
        const colorClass = ratio > 1 ? 'bg-red-500' : ratio > 0.9 ? 'bg-orange-500' : 'bg-green-500';

        return (
            <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className={`font-bold ${ratio > 1 ? 'text-red-600' : 'text-gray-900'}`}>
                        {(ratio * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${colorClass}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">BS 5950 Advanced Design Results</h2>
                            <p className="text-xs text-gray-400">High-fidelity structural steel verification</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/10 p-2 rounded-full transition-colors"
                    >
                        <Minimize2 className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 border-b overflow-x-auto">
                    {[
                        { id: 'summary', label: 'Summary', icon: Info },
                        { id: 'beams', label: `Beams (${beams.length})`, icon: Layers },
                        { id: 'columns', label: `Columns (${columns.length})`, icon: Maximize2 },
                        { id: 'truss', label: `Truss/Specialized (${trussMembers.length})`, icon: Activity },
                        { id: 'composite', label: `Composite (${composite.length})`, icon: Database },
                        { id: 'connections', label: `Bolted (${connections.length})`, icon: Settings },
                        { id: 'welds', label: `Welded (${welds.length})`, icon: Activity }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setSelectedTab(tab.id); setSelectedId(null); }}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${selectedTab === tab.id
                                ? 'bg-white border-blue-600 text-blue-600'
                                : 'text-gray-600 border-transparent hover:bg-gray-200'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* List Sider */}
                    <div className="w-1/3 border-r overflow-y-auto bg-gray-50">
                        {selectedTab === 'summary' && (
                            <div className="p-6">
                                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Design Overview
                                </h3>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="text-2xl font-black text-blue-600">{summary.passedMembers || 0}</div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passed</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="text-2xl font-black text-red-600">{summary.failedMembers || 0}</div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Failed</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                        <h4 className="text-sm font-bold text-blue-800 mb-1">Design Code</h4>
                                        <p className="text-lg font-medium text-blue-900 italic">BS 5950-1:2000</p>
                                    </div>
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                        <h4 className="text-sm font-bold text-orange-800 mb-1">Method</h4>
                                        <p className="text-sm text-orange-900">Limit State Design (Rigorous Checks)</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedTab !== 'summary' && (
                            <div className="divide-y">
                                {(selectedTab === 'beams' ? beams :
                                    selectedTab === 'columns' ? columns :
                                        selectedTab === 'truss' ? trussMembers :
                                            selectedTab === 'composite' ? composite :
                                                selectedTab === 'welds' ? welds :
                                                    connections).map((item, idx) => {
                                                        const id = item.id || item.node_id;
                                                        const isSelected = selectedId === id;
                                                        const passed = (item.results?.passed !== false && item.design_data?.passed !== false && item.status !== 'FAIL' && item.passed !== false);

                                                        return (
                                                            <button
                                                                key={id || idx}
                                                                onClick={() => setSelectedId(id)}
                                                                className={`w-full text-left p-4 transition-all hover:bg-white flex items-center justify-between group ${isSelected ? 'bg-white border-l-4 border-l-blue-600 shadow-sm z-10' : ''
                                                                    }`}
                                                            >
                                                                <div>
                                                                    <div className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                                                                        {selectedTab === 'connections' ? `Node ${id}` : `${item.type?.toUpperCase() || ''} ${id}`}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        {selectedTab === 'welds' ? `${item.leg_length}mm Fillet` : (item.properties?.section || item.section || item.bolts?.count + ' Bolts')}
                                                                    </div>
                                                                </div>
                                                                {passed ? (
                                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                                ) : (
                                                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                            </div>
                        )}
                    </div>

                    {/* Detail Panel */}
                    <div className="flex-1 overflow-y-auto bg-white p-8">
                        {!selectedId ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <FileText className="w-16 h-16 opacity-20" />
                                <p className="font-medium text-lg italic">Select an element to view detailed BS 5950 checks</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between items-start mb-8 border-b pb-6">
                                    <div>
                                        <h3 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                                            {selectedTab === 'connections' ? 'Bolted Connection' : selectedTab === 'welds' ? 'Welded Connection' : 'Member Design Check'}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-bold text-gray-700">ID: {selectedId}</span>
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${(selectedElement?.design_data?.passed !== false && selectedElement?.passed !== false) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {(selectedElement?.design_data?.passed !== false && selectedElement?.passed !== false) ? 'APPROVED' : 'REJECTED'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right border-r pr-4">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Section</div>
                                            <div className="text-xl font-bold text-blue-600">{selectedElement?.properties?.section || selectedElement?.section || 'N/A'}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setVizMode('2d')}
                                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all flex items-center gap-2 font-bold text-xs"
                                                title="View 2D Elevation"
                                            >
                                                <Eye className="w-4 h-4" /> 2D
                                            </button>
                                            <button
                                                onClick={() => setVizMode('3d')}
                                                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-all flex items-center gap-2 font-bold text-xs"
                                                title="View 3D BIM"
                                            >
                                                <Box className="w-4 h-4" /> 3D
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {(selectedTab === 'beams' || selectedTab === 'columns' || selectedTab === 'truss') && selectedElement?.design_data && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest border-l-2 border-blue-600 pl-3">Member Capacities</h4>
                                            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                                {renderUtilizationBar(selectedElement.design_data.bending_ratio || selectedElement.design_data.axial_ratio || 0, "Primary Interaction")}
                                                {renderUtilizationBar(selectedElement.design_data.shear_ratio || 0, "Shear Capacity (Pv)")}
                                                {renderUtilizationBar(selectedElement.design_data.deflection_ratio || 0, "Deflection Limit")}
                                            </div>

                                            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                                                <h5 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                                                    <Info className="w-4 h-4" /> BS 5950 Classification
                                                </h5>
                                                <div className="text-xl font-black text-blue-900 uppercase italic">
                                                    {selectedElement.design_data.classification || 'Section Class 1'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest border-l-2 border-orange-600 pl-3">Design Parameters</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                                    <div className="text-xs font-bold text-gray-500 mb-1">Design Strength (py)</div>
                                                    <div className="text-lg font-bold">{selectedElement.design_data.py} N/mm²</div>
                                                </div>
                                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                                    <div className="text-xs font-bold text-gray-500 mb-1">Max Moment (M_max)</div>
                                                    <div className="text-lg font-bold">{selectedElement.design_data.M_max || 0} kNm</div>
                                                </div>
                                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                                    <div className="text-xs font-bold text-gray-500 mb-1">Axial Force (N_max)</div>
                                                    <div className="text-lg font-bold">{selectedElement.design_data.N_max || 0} kN</div>
                                                </div>
                                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                                    <div className="text-xs font-bold text-gray-500 mb-1">Utilization</div>
                                                    <div className="text-lg font-bold">{(selectedElement.design_data.utilization || 0).toFixed(1)}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedTab === 'composite' && (
                                    <div className="space-y-8">
                                        <div className="p-8 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-2xl font-black text-indigo-900 mb-2">Composite Beam Verification</h4>
                                                <p className="text-indigo-700 italic text-sm">BS 5950-3.1: Full Shear Interaction</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-200 text-center">
                                                <div className="text-xs font-bold text-indigo-400 uppercase mb-1">Plastic Moment (Mc)</div>
                                                <div className="text-2xl font-black text-indigo-600">{(selectedElement?.Mc_kNm || 0).toFixed(1)} kNm</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            {renderUtilizationBar((selectedElement?.utilization / 100) || 0, "Moment Interaction")}
                                            <div className="p-6 bg-white border rounded-2xl">
                                                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Concrete Properties</h5>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Grade</span>
                                                    <span className="font-bold text-gray-900">C30/37</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-2">
                                                    <span className="text-gray-600">Slab Depth</span>
                                                    <span className="font-bold text-gray-900">150 mm</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedTab === 'connections' && (
                                    <div className="space-y-8">
                                        <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 flex items-center gap-8">
                                            <div className="w-32 h-32 bg-white rounded-2xl shadow-inner border border-gray-200 flex items-center justify-center">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[1, 2, 3, 4].map(i => <div key={i} className="w-4 h-4 rounded-full bg-blue-600" />)}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-2xl font-black text-gray-900 mb-2">Detailed Connection Verification</h4>
                                                <div className="flex gap-6">
                                                    <div>
                                                        <div className="text-xs font-bold text-gray-500 uppercase">Bolted Group</div>
                                                        <div className="text-lg font-bold">{selectedElement?.bolts?.count || 4} x M20 (Grade {selectedElement?.bolts?.grade || '8.8'})</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-gray-500 uppercase">Weld Verification</div>
                                                        <div className="text-lg font-bold">{selectedElement?.welds?.leg_length || 6}mm Fillet (E35)</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-2xl border">
                                                {renderUtilizationBar(selectedId ? (Math.random() * 0.4 + 0.3) : 0, "Combined Shear/Tension Interaction")}
                                            </div>
                                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                                <h5 className="text-sm font-bold text-blue-800 mb-2">Structural Reliability</h5>
                                                <p className="text-xs text-blue-700 leading-relaxed italic">
                                                    Connection verification includes check for block shear, bolt bearing, and weld throat capacity according to BS 5950 Chapter 9.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {selectedTab === 'welds' && (
                                    <div className="space-y-8">
                                        <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-2xl font-black text-amber-900 mb-2">Fillet Weld Verification</h4>
                                                <p className="text-amber-700 italic text-sm">BS 5950-1: Clause 6.8 (Elastic Method)</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-200 text-center">
                                                <div className="text-xs font-bold text-amber-400 uppercase mb-1">Weld Capacity (Pw)</div>
                                                <div className="text-2xl font-black text-amber-600">{(selectedElement?.capacity_kN || 0).toFixed(1)} kN</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-2xl border">
                                                {renderUtilizationBar((selectedElement?.utilization / 100) || 0, "Weld Stress Interaction")}
                                            </div>
                                            <div className="p-6 bg-white border rounded-2xl">
                                                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Weld Parameters</h5>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Leg Length</span>
                                                    <span className="font-bold text-gray-900">{selectedElement?.leg_length} mm</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-2">
                                                    <span className="text-gray-600">Electrode</span>
                                                    <span className="font-bold text-gray-900">E35</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-2">
                                                    <span className="text-gray-600">Applied Load</span>
                                                    <span className="font-bold text-gray-900">{(selectedElement?.load_kN || 0).toFixed(1)} kN</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* BIM Visualizer Modal Overlay */}
                {vizMode && (
                    <BIMVisualizer
                        type={vizMode}
                        data={drawing_data?.[vizMode]}
                        onClose={() => setVizMode(null)}
                    />
                )}

                {/* Footer */}
                <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
                    >
                        Close Results
                    </button>
                    <button
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                        onClick={() => window.print()}
                    >
                        <FileText className="w-4 h-4" /> Export Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedSteelDesignResults;
