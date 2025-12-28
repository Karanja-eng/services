import React, { useState, useEffect } from 'react';
import { Calculator, FileText, Download, TrendingUp } from 'lucide-react';
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const BasementTakeoffApp = () => {
    const [activeTab, setActiveTab] = useState("calculator");
    const [inputs, setInputs] = useState({
        ext_L: 3.91,
        ext_W: 3.41,
        int_L: 3.0,
        int_W: 2.5,
        depth_below_gl: 2.5,
        veg_soil_depth: 0.15,
        working_space: 0.3,
        blinding_thick: 0.075,
        bed_thick: 0.1,
        found_L: 0.9,
        found_thick: 0.3,
        wall_thick: 0.225,
        rc_wall_thick: 0.15,
        horiz_tanking_thick: 0.03,
        vert_tanking_thick: 0.025,
        projection: 0.1,
        slab_thick: 0.15,
        excav_staged: false,
        stage_depth: 1.5,
        reinf_incl: true,
        reinf_density: 120,
        form_incl: true,
        backfill_incl: true,
        disposal_incl: true,
        hardcore_thick: 0.1,
        num_columns: 0,
        column_size: 0,
        column_base_size: 0,
        column_base_thick: 0,
        has_drain: false,
        has_tanking: false,
        has_waterbar: false
    });

    const [takeoffData, setTakeoffData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editorKey, setEditorKey] = useState(0);

    const handleInputChange = (field, value) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = {
                length: inputs.ext_L,
                width: inputs.ext_W,
                depth: inputs.depth_below_gl,
                wall_thick: inputs.wall_thick,
                slab_thick: inputs.slab_thick,
                blinding_thick: inputs.blinding_thick,
                hardcore_thick: inputs.hardcore_thick,
                working_space: inputs.working_space,
                veg_soil: inputs.veg_soil_depth,
                num_columns: inputs.num_columns,
                column_size: inputs.column_size,
                column_base_size: inputs.column_base_size,
                column_base_thick: inputs.column_base_thick,
                has_drain: inputs.has_drain,
                has_tanking: inputs.has_tanking,
                has_waterbar: inputs.has_waterbar
            };

            const response = await axios.post("http://localhost:8001/basement_router/api/calculate", payload);
            const data = response.data;

            if (data && data.items) {
                const formattedItems = data.items.map((item, index) => ({
                    id: index + 1,
                    billNo: item.item_no || `B.${index + 1}`,
                    itemNo: (index + 1).toString(),
                    description: item.description,
                    unit: item.unit,
                    quantity: item.quantity,
                    rate: 0,
                    amount: 0,
                    dimensions: [],
                    isHeader: false
                }));
                setTakeoffData(formattedItems);
                setEditorKey(prev => prev + 1);
            }
        } catch (err) {
            setError("Failed to calculate. Backend might be offline or input is invalid.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-calculate defaults on mount
    useEffect(() => {
        handleCalculate();
    }, []);

    return (
        <div className="flex h-screen bg-gray-50 flex-col">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-none">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-blue-700" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Basement Quantity Takeoff</h1>
                            <p className="text-sm text-gray-500">Civil Engineering Calculator</p>
                        </div>
                    </div>
                </div>
                <div className="mt-4">
                    <UniversalTabs
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        tabs={['calculator', 'takeoff', 'sheet', 'boq']}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
                {activeTab === "calculator" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Input Panel */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calculator className="w-5 h-5" /> Input Parameters
                                </h2>

                                <div className="space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                                    <div className="space-y-4">
                                        <h3 className="font-medium text-blue-800 border-b pb-1">Dimensions</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Ext L (m)" value={inputs.ext_L} onChange={(v) => handleInputChange('ext_L', v)} />
                                            <InputField label="Ext W (m)" value={inputs.ext_W} onChange={(v) => handleInputChange('ext_W', v)} />
                                            <InputField label="Int L (m)" value={inputs.int_L} onChange={(v) => handleInputChange('int_L', v)} />
                                            <InputField label="Int W (m)" value={inputs.int_W} onChange={(v) => handleInputChange('int_W', v)} />
                                            <InputField label="Depth (m)" value={inputs.depth_below_gl} onChange={(v) => handleInputChange('depth_below_gl', v)} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-medium text-blue-800 border-b pb-1">Excavation</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Veg Soil (m)" value={inputs.veg_soil_depth} onChange={(v) => handleInputChange('veg_soil_depth', v)} />
                                            <InputField label="Work Space (m)" value={inputs.working_space} onChange={(v) => handleInputChange('working_space', v)} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-medium text-blue-800 border-b pb-1">Structural Details</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Blinding (m)" value={inputs.blinding_thick} onChange={(v) => handleInputChange('blinding_thick', v)} />
                                            <InputField label="Bed Thk (m)" value={inputs.bed_thick} onChange={(v) => handleInputChange('bed_thick', v)} />
                                            <InputField label="Fdn L (m)" value={inputs.found_L} onChange={(v) => handleInputChange('found_L', v)} />
                                            <InputField label="Fdn Thk (m)" value={inputs.found_thick} onChange={(v) => handleInputChange('found_thick', v)} />
                                            <InputField label="Wall Thk (m)" value={inputs.wall_thick} onChange={(v) => handleInputChange('wall_thick', v)} />
                                            <InputField label="RC Wall (m)" value={inputs.rc_wall_thick} onChange={(v) => handleInputChange('rc_wall_thick', v)} />
                                            <InputField label="Slab Thk (m)" value={inputs.slab_thick} onChange={(v) => handleInputChange('slab_thick', v)} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="font-medium text-blue-800 border-b pb-1">Options</h3>
                                        <CheckboxField label="Include Reinforcement" checked={inputs.reinf_incl} onChange={(v) => handleInputChange('reinf_incl', v)} />
                                        {inputs.reinf_incl && (
                                            <InputField label="Reinf Density (kg/m³)" value={inputs.reinf_density} onChange={(v) => handleInputChange('reinf_density', v)} />
                                        )}
                                        <CheckboxField label="Include Formwork" checked={inputs.form_incl} onChange={(v) => handleInputChange('form_incl', v)} />
                                        <CheckboxField label="Include Backfill" checked={inputs.backfill_incl} onChange={(v) => handleInputChange('backfill_incl', v)} />
                                        <CheckboxField label="Include Disposal" checked={inputs.disposal_incl} onChange={(v) => handleInputChange('disposal_incl', v)} />
                                    </div>
                                </div>

                                <button
                                    onClick={handleCalculate}
                                    disabled={loading}
                                    className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg font-bold transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2 shadow-md"
                                >
                                    {loading ? "Calculating..." : "Calculate Takeoff"}
                                </button>
                                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                            </div>
                        </div>

                        {/* Results Panel */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-full">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">Calculation Summary</h3>
                                <p className="text-gray-600 mb-6">
                                    Review the calculated quantities and costs below. Switch to the <strong>Takeoff</strong> tab to edit descriptions or add manual items.
                                </p>

                                {takeoffData.length > 0 ? (
                                    <div className="flex-1 overflow-auto border rounded-md">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="py-2 px-4 text-left font-semibold">Description</th>
                                                    <th className="py-2 px-4 text-center font-semibold">Unit</th>
                                                    <th className="py-2 px-4 text-right font-semibold">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {takeoffData.map((item, idx) => (
                                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                                        <td className="py-2 px-4">{item.description}</td>
                                                        <td className="py-2 px-4 text-center">{item.unit}</td>
                                                        <td className="py-2 px-4 text-right font-mono">{typeof item.quantity === 'number' ? item.quantity.toFixed(2) : item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center flex-1 text-gray-400">
                                        No items calculated yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "takeoff" && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
                        <EnglishMethodTakeoffSheet
                            key={editorKey}
                            initialItems={takeoffData}
                            onChange={setTakeoffData}
                            projectInfo={{
                                projectName: "Basement Project",
                                clientName: "Client Name",
                                projectDate: new Date().toLocaleDateString()
                            }}
                        />
                    </div>
                )}

                {activeTab === "sheet" && (
                    <div className="h-full">
                        <UniversalSheet items={takeoffData} />
                    </div>
                )}

                {activeTab === "boq" && (
                    <div className="h-full">
                        <UniversalBOQ items={takeoffData} />
                    </div>
                )}
            </div>
        </div>
    );
};

const InputField = ({ label, value, onChange }) => (
    <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
    </div>
);

const CheckboxField = ({ label, checked, onChange }) => (
    <div className="flex items-center">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label className="ml-2 text-sm font-medium text-gray-700">{label}</label>
    </div>
);

export default BasementTakeoffApp;