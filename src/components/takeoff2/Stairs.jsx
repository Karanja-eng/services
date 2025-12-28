import React, { useState } from 'react';
import { Calculator, AlertCircle } from 'lucide-react';
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const StaircaseTakeoffApp = () => {
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

    // Shared state for the takeoff items
    const [takeoffData, setTakeoffData] = useState([]);

    // UI state
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

            const response = await axios.post("http://localhost:8001/stairs_router/calculate", payload);
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

    // Client-side calculation
    const calculateClientSide = (data) => {
        const horiz_f1 = data.num_treads_f1 * data.tread;
        const vert_f1 = data.num_risers_f1 * data.rise;
        const hypo_f1 = Math.sqrt(horiz_f1 ** 2 + vert_f1 ** 2);

        const horiz_f2 = data.num_treads_f2 * data.tread;
        const vert_f2 = data.num_risers_f2 * data.rise;
        const hypo_f2 = Math.sqrt(horiz_f2 ** 2 + vert_f2 ** 2);

        const total_risers = data.num_risers_f1 + data.num_risers_f2;
        // const total_treads = data.num_treads_f1 + data.num_treads_f2; // Unused
        const conc_width = data.clear_width + data.wall_thick / 2;
        const form_width = data.clear_width;

        const form_landing_w = data.landing_W - data.tread < data.landing_W ?
            data.landing_W - data.tread : data.landing_W;

        const form_soffit_landing = data.landing_L * form_landing_w;
        const form_soffit_f1 = hypo_f1 * form_width;
        const form_soffit_f2 = hypo_f2 * form_width;
        const form_soffit_total = form_soffit_landing + form_soffit_f1 + form_soffit_f2;

        const form_riser_edges = total_risers * data.clear_width;
        const form_string_lm = hypo_f1 + hypo_f2;

        const conc_landing = data.landing_L * data.landing_W * data.waist_thick;
        const conc_waist_f1 = hypo_f1 * conc_width * data.waist_thick;
        const conc_waist_f2 = hypo_f2 * conc_width * data.waist_thick;
        const conc_steps = total_risers * (0.5 * data.tread * data.rise) * conc_width;
        const conc_total = conc_landing + conc_waist_f1 + conc_waist_f2 + conc_steps;

        const num_main_bars = Math.floor(conc_width / data.rebar_spacing) + 1;
        const rebar_len_landing = data.landing_L + 2 * data.rebar_bend;
        const rebar_len_f1 = hypo_f1 + 2 * data.rebar_bend;
        const rebar_len_f2 = hypo_f2 + 2 * data.rebar_bend;
        const rebar_main_total = num_main_bars * (rebar_len_landing + rebar_len_f1 + rebar_len_f2);

        const dist_bars_total = total_risers * 2 * (conc_width + 0.30);
        const fabric_mesh = form_soffit_total * 1.10;

        const rail_len = hypo_f1 + hypo_f2 + data.landing_W;
        const num_balusters = Math.floor(rail_len / data.bal_spacing);
        const bal_total_len = num_balusters * data.bal_height;
        const num_standards = Math.floor(num_balusters / 2) + 2;

        const finish_landing = data.landing_L * data.landing_W;
        const finish_treads = total_risers * data.tread * data.clear_width;
        const finish_risers = total_risers * data.rise * data.clear_width;
        const finish_total = finish_landing + finish_treads + finish_risers;

        const plaster_soffit = form_soffit_total;
        const plaster_strings = form_string_lm * 0.25;
        const paint_area = plaster_soffit + plaster_strings;

        const nonslip_lm = total_risers * data.clear_width;
        const skirting = form_string_lm * 2;
        const waterproofing = finish_total * 1.05;
        const excavation = conc_total * 1.15;
        const blinding = form_soffit_total * 0.075;

        const finishName = data.finish_type.charAt(0).toUpperCase() + data.finish_type.slice(1);

        const rawItems = [
            {
                billNo: 'A',
                description: 'Excavation and earthwork for staircase foundation',
                unit: 'm³',
                quantity: excavation
            },
            {
                billNo: 'B',
                description: 'Plain concrete blinding Grade 15 (75mm thick)',
                unit: 'm³',
                quantity: blinding
            },
            {
                billNo: 'C',
                description: 'Formwork to soffit of staircase and landing',
                unit: 'm²',
                quantity: form_soffit_total
            },
            {
                billNo: 'D',
                description: 'Formwork to riser edges',
                unit: 'm',
                quantity: form_riser_edges
            },
            {
                billNo: 'E',
                description: 'Formwork to string/outer edges of flights',
                unit: 'm',
                quantity: form_string_lm
            },
            {
                billNo: 'F',
                description: 'Reinforced concrete Grade 30 in staircase structure',
                unit: 'm³',
                quantity: conc_total
            },
            {
                billNo: 'G',
                description: 'High yield steel reinforcement 12mm dia. main bars',
                unit: 'm',
                quantity: rebar_main_total
            },
            {
                billNo: 'H',
                description: 'High yield steel reinforcement 10mm dia. distribution bars',
                unit: 'm',
                quantity: dist_bars_total
            },
            {
                billNo: 'I',
                description: 'Fabric reinforcement A252 mesh with 150mm laps',
                unit: 'm²',
                quantity: fabric_mesh
            },
            {
                billNo: 'J',
                description: `${finishName} finish 25mm thick to treads`,
                unit: 'm²',
                quantity: finish_treads
            },
            {
                billNo: 'K',
                description: `${finishName} finish 20mm thick to risers`,
                unit: 'm²',
                quantity: finish_risers
            },
            {
                billNo: 'L',
                description: `${finishName} finish 25mm thick to landing`,
                unit: 'm²',
                quantity: finish_landing
            },
            {
                billNo: 'M',
                description: 'Cement/sand plaster (1:4) 12mm thick to soffit',
                unit: 'm²',
                quantity: plaster_soffit
            },
            {
                billNo: 'N',
                description: 'Cement/sand plaster (1:4) 12mm thick to strings',
                unit: 'm²',
                quantity: plaster_strings
            },
            {
                billNo: 'O',
                description: 'Emulsion paint two coats to plastered surfaces',
                unit: 'm²',
                quantity: paint_area
            },
            {
                billNo: 'P',
                description: 'Metal balustrade standards 40x40mm MS at centres',
                unit: 'nr',
                quantity: num_standards
            },
            {
                billNo: 'Q',
                description: 'Metal handrail 50mm dia. fixed to standards',
                unit: 'm',
                quantity: rail_len
            },
            {
                billNo: 'R',
                description: 'Mild steel balusters 25mm dia. at specified centres',
                unit: 'm',
                quantity: bal_total_len
            },
            {
                billNo: 'S',
                description: 'Non-slip nosing inserts to treads',
                unit: 'm',
                quantity: nonslip_lm
            },
            {
                billNo: 'T',
                description: 'PVC skirting 100mm high fixed to strings',
                unit: 'm',
                quantity: skirting
            },
            {
                billNo: 'U',
                description: 'Waterproofing membrane to exposed surfaces',
                unit: 'm²',
                quantity: waterproofing
            },
            {
                billNo: 'V',
                description: 'Make good and prepare surfaces for finishes',
                unit: 'm²',
                quantity: finish_total
            },
            {
                billNo: 'W',
                description: 'Curing of concrete for 7 days',
                unit: 'm²',
                quantity: form_soffit_total + finish_total
            },
            {
                billNo: 'X',
                description: 'Temporary works and falsework to staircase',
                unit: 'item',
                quantity: 1
            }
        ];

        // Format for Universal Components
        return rawItems.map((item, index) => ({
            id: index + 1,
            billNo: item.billNo,
            itemNo: (index + 1).toString(),
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            rate: 0,
            amount: 0,
            dimensions: [], // Empty initially, can be added in Editor
            isHeader: false
        }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gray-700 p-3 rounded-lg">
                            <Calculator className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Staircase Quantity Takeoff</h1>
                            <p className="text-sm text-gray-600">Bill of Quantities - SMM7/CESMM4 Standards</p>
                        </div>
                    </div>

                    {/* Universal Tabs */}
                    <UniversalTabs
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />

                    {/* Tab Content */}
                    <div className="mt-6">
                        {activeTab === "calculator" && (
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-lg font-semibold text-gray-700 mb-4">Input Parameters</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                    {/* Input Fields */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Clear Stair Width (m) *</label>
                                        <input type="number" step="0.01" name="clear_width" value={inputs.clear_width} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Wall Thickness (m) *</label>
                                        <input type="number" step="0.01" name="wall_thick" value={inputs.wall_thick} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Waist/Slab Thickness (m) *</label>
                                        <input type="number" step="0.01" name="waist_thick" value={inputs.waist_thick} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Landing Length (m) *</label>
                                        <input type="number" step="0.01" name="landing_L" value={inputs.landing_L} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Landing Width (m) *</label>
                                        <input type="number" step="0.01" name="landing_W" value={inputs.landing_W} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tread/Going (m) *</label>
                                        <input type="number" step="0.01" name="tread" value={inputs.tread} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Riser Height (m) *</label>
                                        <input type="number" step="0.01" name="rise" value={inputs.rise} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Risers in Flight 1 *</label>
                                        <input type="number" name="num_risers_f1" value={inputs.num_risers_f1} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Treads in Flight 1 *</label>
                                        <input type="number" name="num_treads_f1" value={inputs.num_treads_f1} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Risers in Flight 2 *</label>
                                        <input type="number" name="num_risers_f2" value={inputs.num_risers_f2} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Treads in Flight 2 *</label>
                                        <input type="number" name="num_treads_f2" value={inputs.num_treads_f2} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Rebar Spacing (m) *</label>
                                        <input type="number" step="0.01" name="rebar_spacing" value={inputs.rebar_spacing} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Rebar Bend Length (m) *</label>
                                        <input type="number" step="0.01" name="rebar_bend" value={inputs.rebar_bend} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Baluster Spacing (m) *</label>
                                        <input type="number" step="0.01" name="bal_spacing" value={inputs.bal_spacing} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Balustrade Height (m) *</label>
                                        <input type="number" step="0.01" name="bal_height" value={inputs.bal_height} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Finish Type *</label>
                                        <select name="finish_type" value={inputs.finish_type} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500">
                                            <option value="terrazzo">Terrazzo</option>
                                            <option value="ceramic tiles">Ceramic Tiles</option>
                                            <option value="porcelain tiles">Porcelain Tiles</option>
                                            <option value="granite">Granite</option>
                                            <option value="marble">Marble</option>
                                            <option value="timber">Timber/Wood</option>
                                            <option value="polished concrete">Polished Concrete</option>
                                            <option value="natural stone">Natural Stone</option>
                                        </select>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={calculateQuantities}
                                    disabled={loading}
                                    className="w-full md:w-auto px-8 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                                >
                                    <Calculator className="w-5 h-5" />
                                    {loading ? 'Calculating...' : 'Calculate Quantities'}
                                </button>
                            </div>
                        )}

                        {activeTab === "takeoff" && (
                            <div className="mt-6 overflow-x-auto border-t border-gray-200 pt-6">
                                <EnglishMethodTakeoffSheet
                                    initialItems={takeoffData.length > 0 ? takeoffData : undefined}
                                    onChange={setTakeoffData}
                                    projectInfo={{
                                        projectName: "Staircase Project",
                                        clientName: "Client Name",
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
        </div >
    );
};

export default StaircaseTakeoffApp;