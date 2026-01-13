import React, { useState } from "react";
import { Calculator, Eye, X } from 'lucide-react';
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const StaircaseTakeoffApp = () => {
    const API_BASE = `http://${window.location.hostname}:8001`;
    const [inputs, setInputs] = useState({
        clear_width: '1.20',
        wall_thick: '0.225',
        waist_thick: '0.150',
        landing_L: '1.50',
        landing_W: '1.20',
        tread: '0.275',
        rise: '0.175',
        num_risers_f1: '8',
        num_treads_f1: '7',
        num_risers_f2: '8',
        num_treads_f2: '8',
        rebar_spacing: '0.150',
        rebar_bend: '0.500',
        bal_spacing: '0.150',
        bal_height: '0.900',
        finish_type: 'terrazzo'
    });

    const [takeoffData, setTakeoffData] = useState([]);
    const [activeTab, setActiveTab] = useState("calculator");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleInputChange = (e) => {
        setInputs({
            ...inputs,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const validateInputs = () => {
        const rise = parseFloat(inputs.rise);
        const tread = parseFloat(inputs.tread);

        if (rise < 0.12 || rise > 0.22) {
            return "Riser height should be between 120mm and 220mm for safety compliance";
        }
        if (tread < 0.22 || tread > 0.35) {
            return "Tread depth should be between 220mm and 350mm for safety compliance";
        }

        const twiceRisePlusTread = (2 * rise) + tread;
        if (twiceRisePlusTread < 0.55 || twiceRisePlusTread > 0.70) {
            return "Going rule (2R + T) should be between 550mm and 700mm";
        }

        return null;
    };

    const calculateQuantities = async () => {
        const validationError = validateInputs();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload = {
                clear_width: parseFloat(inputs.clear_width),
                wall_thick: parseFloat(inputs.wall_thick),
                waist_thick: parseFloat(inputs.waist_thick),
                landing_L: parseFloat(inputs.landing_L),
                landing_W: parseFloat(inputs.landing_W),
                tread: parseFloat(inputs.tread),
                rise: parseFloat(inputs.rise),
                num_risers_f1: parseInt(inputs.num_risers_f1),
                num_treads_f1: parseInt(inputs.num_treads_f1),
                num_risers_f2: parseInt(inputs.num_risers_f2),
                num_treads_f2: parseInt(inputs.num_treads_f2),
                rebar_spacing: parseFloat(inputs.rebar_spacing),
                rebar_bend: parseFloat(inputs.rebar_bend),
                bal_spacing: parseFloat(inputs.bal_spacing),
                bal_height: parseFloat(inputs.bal_height),
                finish_type: inputs.finish_type
            };

            const response = await axios.post(`${API_BASE}/stairs_router/calculate`, payload);
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
                setActiveTab("sheet");
            }
        } catch (err) {
            setError('Calculation failed. Backend might be offline.');
            console.error('Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-slate-900 p-3 rounded-lg">
                            <Calculator className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Staircase Takeoff</h1>
                            <p className="text-xs font-black text-blue-600 uppercase tracking-widest mt-1">Manual Estimator - SMM7/CESMM4 Standards</p>
                        </div>
                    </div>

                    <UniversalTabs
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />

                    <div className="mt-6">
                        {activeTab === "calculator" && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Inputs Panel */}
                                <div className="lg:col-span-1 border rounded-2xl overflow-hidden bg-white shadow-sm h-fit">
                                    <div className="bg-slate-900 px-6 py-4">
                                        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Calculator size={14} className="text-blue-400" /> Manual Specifications
                                        </h2>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Clear Width (m)</label><input type="number" step="0.01" name="clear_width" value={inputs.clear_width} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Riser Height (m)</label><input type="number" step="0.01" name="rise" value={inputs.rise} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Tread Depth (m)</label><input type="number" step="0.01" name="tread" value={inputs.tread} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Waist Thick (m)</label><input type="number" step="0.01" name="waist_thick" value={inputs.waist_thick} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                                        </div>

                                        <div className="pt-4 border-t">
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Step Geometry</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Flight 1 Risers</label><input type="number" name="num_risers_f1" value={inputs.num_risers_f1} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                                                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">Flight 2 Risers</label><input type="number" name="num_risers_f2" value={inputs.num_risers_f2} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase">
                                                {error}
                                            </div>
                                        )}

                                        <button
                                            onClick={calculateQuantities}
                                            disabled={loading}
                                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                        >
                                            <Calculator className="w-4 h-4" />
                                            {loading ? 'Processing...' : 'Run Calculator'}
                                        </button>
                                    </div>
                                </div>

                                {/* Visualization Panel */}
                                <div className="lg:col-span-2 h-[600px] bg-slate-100 rounded-3xl border-4 border-white shadow-xl overflow-hidden relative flex flex-col items-center justify-center space-y-6">
                                    <div className="w-24 h-24 bg-white rounded-[2rem] shadow-lg flex items-center justify-center">
                                        <Eye className="w-12 h-12 text-slate-200" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manual Design Mode</h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 max-w-[300px] leading-relaxed">
                                            Automation features have been removed. Use the calculator to generate precise quantities.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "takeoff" && (
                            <div className="bg-white rounded-2xl shadow-sm border p-2">
                                <EnglishMethodTakeoffSheet
                                    initialItems={takeoffData}
                                    onChange={setTakeoffData}
                                    projectInfo={{
                                        projectName: "Staircase Project",
                                        clientName: "Manual Estimate",
                                        projectDate: new Date().toLocaleDateString()
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === "sheet" && (
                            <UniversalSheet items={takeoffData} />
                        )}

                        {activeTab === "boq" && (
                            <UniversalBOQ items={takeoffData} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaircaseTakeoffApp;