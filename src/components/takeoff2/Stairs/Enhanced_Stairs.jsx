import React, { useState } from 'react';
import { Calculator, Box, Eye, FileText, Settings, Download, Edit3, Table } from 'lucide-react';
import Staircase2DViewer from './2DViewer';
import EnglishMethodTakeoffSheet from '../ExternalWorks/EnglishMethodTakeoffSheet';
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import StructuralVisualizationComponent from '../../Drawings/visualise_component';

const EnhancedStaircaseApp = () => {
    const [activeTab, setActiveTab] = useState("config");
    const [staircaseType, setStaircaseType] = useState("straight");
    const [materialType, setMaterialType] = useState("concrete");
    const [finishType, setFinishType] = useState("terrazzo");
    const [balType, setBalType] = useState("metal");

    const [inputs, setInputs] = useState({
        clear_width: 1.2,
        tread: 0.275,
        rise: 0.175,
        wall_thick: 0.225,
        waist_thick: 0.150,
        num_flights: 2,
        risers_per_flight: [8, 8],
        treads_per_flight: [7, 8],
        landing_lengths: [1.5],
        landing_widths: [1.2],
        // Specialty parameters
        spiral_radius: 1.0,
        spiral_center_column_dia: 0.2,
        total_rotation: 360,
        turn_angle: 90,
        num_winders: 0,
        winder_inner_radius: 0.3,
        // Materials
        rebar_main_dia: 12,
        rebar_dist_dia: 10,
        rebar_spacing: 0.150,
        rebar_bend: 0.500,
        bal_height: 0.900,
        bal_spacing: 0.150,
        handrail_dia: 0.050,
        glass_thickness: 0.012,
        timber_tread_thick: 0.040,
        timber_species: "hardwood",
        // Features
        include_lighting: false,
        waterproofing_required: false
    });

    const [boqData, setBoqData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    // Dynamic API Base URL
    const API_BASE = `http://${window.location.hostname}:8001`;

    const handleCalculate = async () => {
        setLoading(true);
        try {
            const payload = {
                staircase_type: staircaseType,
                material_type: materialType,
                finish_type: finishType,
                balustrade_type: balType,
                ...inputs,
                risers_per_flight: inputs.risers_per_flight.map(Number),
                treads_per_flight: inputs.treads_per_flight.map(Number),
                landing_lengths: inputs.landing_lengths.map(Number),
                landing_widths: inputs.landing_widths.map(Number)
            };

            const response = await fetch(`${API_BASE}/stairs_router/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Format data for Universal Components
            const formattedItems = (data.items || []).map((item, index) => ({
                id: index + 1,
                billNo: item.billNo || (index + 1).toString(),
                itemNo: (index + 1).toString(),
                description: item.description,
                unit: item.unit,
                quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0,
                rate: 0,
                amount: 0,
                dimensions: item.dimensions || [],
                isHeader: false
            }));

            setBoqData(formattedItems);
            setSummary(data.summary || {});
            setActiveTab("sheet"); // Switch to sheet view on success
        } catch (error) {
            console.error('Calculation error:', error);
            alert('Calculation failed. Check backend connection.');
        } finally {
            setLoading(false);
        }
    };

    const updateInput = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    // Helper to update array inputs
    const updateArrayInput = (key, index, value) => {
        setInputs(prev => {
            const newArray = [...prev[key]];
            newArray[index] = value;
            return { ...prev, [key]: newArray };
        });
    };

    const tabs = [
        { id: "config", label: "Design", icon: Settings },
        { id: "2d", label: "2D Plans", icon: Box },
        { id: "3d", label: "3D View", icon: Eye },
        { id: "takeoff", label: "Takeoff Editor", icon: Edit3 },
        { id: "sheet", label: "Bill Sheet", icon: Table },
        { id: "boq", label: "Final BOQ", icon: FileText }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6 transition-all hover:shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-slate-900 p-3 rounded-lg shadow-md">
                                <Calculator className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Staircase Estimator Pro</h1>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Advanced 3D Modeling & Takeoff System</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCalculate}
                            disabled={loading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-3 font-bold uppercase tracking-wider text-sm shadow-lg active:scale-95 transition-all"
                        >
                            <Calculator className="w-5 h-5" />
                            {loading ? 'Processing...' : 'Calculate Quantities'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                    <div className="flex flex-wrap border-b border-gray-100">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 min-w-[120px] px-6 py-4 flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-wide transition-all ${activeTab === tab.id
                                        ? 'bg-slate-50 text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-2xl shadow-xl min-h-[600px] border border-gray-100">
                    {activeTab === "config" && (
                        <div className="p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Panel: Type Selection */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Staircase Type</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['straight', 'l_shaped', 'u_shaped', 'spiral', 'winder', 'curved', 'bifurcated', 'cantilever', 'helical', 'open_newel'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setStaircaseType(type)}
                                                    className={`p-3 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all ${staircaseType === type
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                                                        : 'border-white bg-white text-gray-500 hover:border-gray-200'
                                                        }`}
                                                >
                                                    {type.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Materials</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Structure Material</label>
                                                <select
                                                    value={materialType}
                                                    onChange={(e) => setMaterialType(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="concrete">Reinforced Concrete</option>
                                                    <option value="timber">Structural Timber</option>
                                                    <option value="steel">Structural Steel</option>
                                                    <option value="glass">Structural Glass</option>
                                                    <option value="combination">Composite / Mixed</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Finish Type</label>
                                                <select
                                                    value={finishType}
                                                    onChange={(e) => setFinishType(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="terrazzo">Terrazzo</option>
                                                    <option value="ceramic_tiles">Ceramic Tiles</option>
                                                    <option value="porcelain_tiles">Porcelain Tiles</option>
                                                    <option value="granite">Granite</option>
                                                    <option value="marble">Marble</option>
                                                    <option value="timber">Timber Flooring</option>
                                                    <option value="polished_concrete">Polished Concrete</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Balustrade System</label>
                                                <select
                                                    value={balType}
                                                    onChange={(e) => setBalType(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="metal">Metal Railings</option>
                                                    <option value="timber">Timber Posts</option>
                                                    <option value="glass">Frameless Glass</option>
                                                    <option value="cable">Cable System</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Parameters */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Geometric Parameters</h3>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Clear Width (m)</label>
                                                <input type="number" step="0.01" value={inputs.clear_width} onChange={(e) => updateInput('clear_width', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Going/Tread (m)</label>
                                                <input type="number" step="0.005" value={inputs.tread} onChange={(e) => updateInput('tread', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Rise (m)</label>
                                                <input type="number" step="0.005" value={inputs.rise} onChange={(e) => updateInput('rise', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Waist Thickness (m)</label>
                                                <input type="number" step="0.01" value={inputs.waist_thick} onChange={(e) => updateInput('waist_thick', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700" />
                                            </div>
                                        </div>
                                    </div>

                                    {(staircaseType === 'straight' || staircaseType === 'l_shaped' || staircaseType === 'u_shaped') && (
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Flight Configuration</h3>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <label className="text-sm font-bold text-gray-600">Number of Flights:</label>
                                                    <div className="flex bg-white rounded-lg p-1 border">
                                                        {[1, 2, 3, 4].map(n => (
                                                            <button
                                                                key={n}
                                                                onClick={() => updateInput('num_flights', n)}
                                                                className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${inputs.num_flights === n ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-600'}`}
                                                            >
                                                                {n}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    {Array.from({ length: inputs.num_flights }).map((_, idx) => (
                                                        <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100">
                                                            <div className="text-xs font-black text-blue-600 uppercase mb-2">Flight {idx + 1}</div>
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-400 block">Risers</label>
                                                                    <input type="number" value={inputs.risers_per_flight[idx] || 8} onChange={(e) => updateArrayInput('risers_per_flight', idx, parseInt(e.target.value))} className="w-full px-2 py-1 border rounded text-sm" />
                                                                </div>
                                                                {idx < inputs.num_flights - 1 && (
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-gray-400 block mt-2">Landing Length (m)</label>
                                                                        <input type="number" step="0.1" value={inputs.landing_lengths[idx] || 1.5} onChange={(e) => updateArrayInput('landing_lengths', idx, parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded text-sm" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {staircaseType === 'spiral' && (
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Spiral Settings</h3>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Outer Radius (m)</label>
                                                    <input type="number" step="0.1" value={inputs.spiral_radius} onChange={(e) => updateInput('spiral_radius', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Center Column Dia (m)</label>
                                                    <input type="number" step="0.05" value={inputs.spiral_center_column_dia} onChange={(e) => updateInput('spiral_center_column_dia', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Total Rotation (°)</label>
                                                    <input type="number" step="45" value={inputs.total_rotation} onChange={(e) => updateInput('total_rotation', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Additional Features</h3>
                                        <div className="flex gap-6">
                                            <label className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors">
                                                <input type="checkbox" checked={inputs.include_lighting} onChange={(e) => updateInput('include_lighting', e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-0" />
                                                <span className="text-sm font-bold text-gray-700">LED Lighting System</span>
                                            </label>
                                            <label className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors">
                                                <input type="checkbox" checked={inputs.waterproofing_required} onChange={(e) => updateInput('waterproofing_required', e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-0" />
                                                <span className="text-sm font-bold text-gray-700">Waterproofing</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "2d" && (
                        <div className="p-4 h-[700px]">
                            <Staircase2DViewer staircaseData={{ staircase_type: staircaseType, ...inputs }} />
                        </div>
                    )}

                    {activeTab === "3d" && (
                        <div className="h-[700px] bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-800 shadow-2xl">
                            <StructuralVisualizationComponent
                                componentType="staircase"
                                buildingData={{ staircase_type: staircaseType, ...inputs }}
                            />
                        </div>
                    )}

                    {activeTab === "takeoff" && (
                        <div className="p-4">
                            <EnglishMethodTakeoffSheet
                                initialItems={boqData}
                                onChange={setBoqData}
                                projectInfo={{
                                    projectName: "Staircase Project",
                                    clientName: "Auto-Generated",
                                    projectDate: new Date().toLocaleDateString()
                                }}
                            />
                        </div>
                    )}

                    {activeTab === "sheet" && (
                        <div className="p-4">
                            <UniversalSheet items={boqData} />
                        </div>
                    )}

                    {activeTab === "boq" && (
                        <div className="p-4">
                            <UniversalBOQ items={boqData} />

                            {/* Summary Cards */}
                            {summary && (
                                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <div className="text-xs font-black text-blue-400 uppercase tracking-widest">Total Height</div>
                                        <div className="text-2xl font-bold text-blue-700">{summary.total_height_m}m</div>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                        <div className="text-xs font-black text-green-400 uppercase tracking-widest">Concrete Vol</div>
                                        <div className="text-2xl font-bold text-green-700">{boqData.find(i => i.description.includes('Reinforced concrete'))?.quantity || 0}m³</div>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                        <div className="text-xs font-black text-purple-400 uppercase tracking-widest">Total Steps</div>
                                        <div className="text-2xl font-bold text-purple-700">{summary.total_risers}</div>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                        <div className="text-xs font-black text-orange-400 uppercase tracking-widest">Rebar Weight</div>
                                        <div className="text-2xl font-bold text-orange-700">{((boqData.find(i => i.description.includes('main bars'))?.quantity || 0) * 0.888).toFixed(1)}kg</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnhancedStaircaseApp;