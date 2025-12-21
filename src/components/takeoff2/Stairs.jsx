import React, { useState } from 'react';
import { Calculator, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';

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

    const [results, setResults] = useState(null);
    const [summary, setSummary] = useState(null);
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
            // In production, replace with actual API endpoint
            const API_URL = 'http://localhost:8001/calculate';

            const requestData = {
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

            // Fallback to client-side calculation if API is not available
            // In production, this should be removed and only API calls used
            const calculatedResults = calculateClientSide(requestData);
            setResults(calculatedResults.items);
            setSummary(calculatedResults.summary);

        } catch (err) {
            setError('Calculation failed. Please check your inputs and try again.');
            console.error('Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Client-side calculation (fallback - actual logic should be in Python backend)
    const calculateClientSide = (data) => {
        const horiz_f1 = data.num_treads_f1 * data.tread;
        const vert_f1 = data.num_risers_f1 * data.rise;
        const hypo_f1 = Math.sqrt(horiz_f1 ** 2 + vert_f1 ** 2);

        const horiz_f2 = data.num_treads_f2 * data.tread;
        const vert_f2 = data.num_risers_f2 * data.rise;
        const hypo_f2 = Math.sqrt(horiz_f2 ** 2 + vert_f2 ** 2);

        const total_risers = data.num_risers_f1 + data.num_risers_f2;
        const total_treads = data.num_treads_f1 + data.num_treads_f2;
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

        const items = [
            {
                item: 'A',
                description: 'Excavation and earthwork for staircase foundation',
                unit: 'm³',
                quantity: excavation.toFixed(3)
            },
            {
                item: 'B',
                description: 'Plain concrete blinding Grade 15 (75mm thick)',
                unit: 'm³',
                quantity: blinding.toFixed(3)
            },
            {
                item: 'C',
                description: 'Formwork to soffit of staircase and landing',
                unit: 'm²',
                quantity: form_soffit_total.toFixed(2)
            },
            {
                item: 'D',
                description: 'Formwork to riser edges',
                unit: 'm',
                quantity: form_riser_edges.toFixed(2)
            },
            {
                item: 'E',
                description: 'Formwork to string/outer edges of flights',
                unit: 'm',
                quantity: form_string_lm.toFixed(2)
            },
            {
                item: 'F',
                description: 'Reinforced concrete Grade 30 in staircase structure',
                unit: 'm³',
                quantity: conc_total.toFixed(3)
            },
            {
                item: 'G',
                description: 'High yield steel reinforcement 12mm dia. main bars',
                unit: 'm',
                quantity: rebar_main_total.toFixed(2)
            },
            {
                item: 'H',
                description: 'High yield steel reinforcement 10mm dia. distribution bars',
                unit: 'm',
                quantity: dist_bars_total.toFixed(2)
            },
            {
                item: 'I',
                description: 'Fabric reinforcement A252 mesh with 150mm laps',
                unit: 'm²',
                quantity: fabric_mesh.toFixed(2)
            },
            {
                item: 'J',
                description: `${finishName} finish 25mm thick to treads`,
                unit: 'm²',
                quantity: finish_treads.toFixed(2)
            },
            {
                item: 'K',
                description: `${finishName} finish 20mm thick to risers`,
                unit: 'm²',
                quantity: finish_risers.toFixed(2)
            },
            {
                item: 'L',
                description: `${finishName} finish 25mm thick to landing`,
                unit: 'm²',
                quantity: finish_landing.toFixed(2)
            },
            {
                item: 'M',
                description: 'Cement/sand plaster (1:4) 12mm thick to soffit',
                unit: 'm²',
                quantity: plaster_soffit.toFixed(2)
            },
            {
                item: 'N',
                description: 'Cement/sand plaster (1:4) 12mm thick to strings',
                unit: 'm²',
                quantity: plaster_strings.toFixed(2)
            },
            {
                item: 'O',
                description: 'Emulsion paint two coats to plastered surfaces',
                unit: 'm²',
                quantity: paint_area.toFixed(2)
            },
            {
                item: 'P',
                description: 'Metal balustrade standards 40x40mm MS at centres',
                unit: 'nr',
                quantity: num_standards.toString()
            },
            {
                item: 'Q',
                description: 'Metal handrail 50mm dia. fixed to standards',
                unit: 'm',
                quantity: rail_len.toFixed(2)
            },
            {
                item: 'R',
                description: 'Mild steel balusters 25mm dia. at specified centres',
                unit: 'm',
                quantity: bal_total_len.toFixed(2)
            },
            {
                item: 'S',
                description: 'Non-slip nosing inserts to treads',
                unit: 'm',
                quantity: nonslip_lm.toFixed(2)
            },
            {
                item: 'T',
                description: 'PVC skirting 100mm high fixed to strings',
                unit: 'm',
                quantity: skirting.toFixed(2)
            },
            {
                item: 'U',
                description: 'Waterproofing membrane to exposed surfaces',
                unit: 'm²',
                quantity: waterproofing.toFixed(2)
            },
            {
                item: 'V',
                description: 'Make good and prepare surfaces for finishes',
                unit: 'm²',
                quantity: finish_total.toFixed(2)
            },
            {
                item: 'W',
                description: 'Curing of concrete for 7 days',
                unit: 'm²',
                quantity: (form_soffit_total + finish_total).toFixed(2)
            },
            {
                item: 'X',
                description: 'Temporary works and falsework to staircase',
                unit: 'item',
                quantity: '1'
            }
        ];

        const summary = {
            total_concrete_m3: conc_total.toFixed(3),
            total_formwork_m2: form_soffit_total.toFixed(2),
            total_rebar_m: (rebar_main_total + dist_bars_total).toFixed(2),
            total_finishes_m2: finish_total.toFixed(2),
            total_height_m: (vert_f1 + vert_f2).toFixed(2),
            total_going_m: (horiz_f1 + horiz_f2 + data.landing_L).toFixed(2),
            total_risers: total_risers,
            total_treads: total_treads
        };

        return { items, summary };
    };

    const exportToCSV = () => {
        if (!results) return;

        let csv = 'PROJECT: STAIRCASE QUANTITY TAKEOFF\n';
        csv += 'STANDARD: SMM7 / CESMM4\n\n';
        csv += 'Item,Description,Unit,Quantity\n';

        results.forEach(row => {
            csv += `${row.item},"${row.description}",${row.unit},${row.quantity}\n`;
        });

        if (summary) {
            csv += '\n\nSUMMARY\n';
            csv += `Total Concrete,m³,${summary.total_concrete_m3}\n`;
            csv += `Total Formwork,m²,${summary.total_formwork_m2}\n`;
            csv += `Total Reinforcement,m,${summary.total_rebar_m}\n`;
            csv += `Total Finishes,m²,${summary.total_finishes_m2}\n`;
            csv += `Total Height,m,${summary.total_height_m}\n`;
            csv += `Total Going,m,${summary.total_going_m}\n`;
            csv += `Total Risers,nr,${summary.total_risers}\n`;
            csv += `Total Treads,nr,${summary.total_treads}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `staircase_boq_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
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

                    {/* Input Form */}
                    <div className="border-t border-gray-200 pt-6">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Input Parameters</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Clear Stair Width (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="clear_width"
                                    value={inputs.clear_width}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                    placeholder="1.20"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Wall Thickness (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="wall_thick"
                                    value={inputs.wall_thick}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.225"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Waist/Slab Thickness (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="waist_thick"
                                    value={inputs.waist_thick}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.150"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Landing Length (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="landing_L"
                                    value={inputs.landing_L}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="1.50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Landing Width (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="landing_W"
                                    value={inputs.landing_W}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="1.20"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tread/Going (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="tread"
                                    value={inputs.tread}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.275"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Riser Height (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="rise"
                                    value={inputs.rise}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.175"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Risers in Flight 1 *
                                </label>
                                <input
                                    type="number"
                                    name="num_risers_f1"
                                    value={inputs.num_risers_f1}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="8"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Treads in Flight 1 *
                                </label>
                                <input
                                    type="number"
                                    name="num_treads_f1"
                                    value={inputs.num_treads_f1}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="7"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Risers in Flight 2 *
                                </label>
                                <input
                                    type="number"
                                    name="num_risers_f2"
                                    value={inputs.num_risers_f2}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="8"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Treads in Flight 2 *
                                </label>
                                <input
                                    type="number"
                                    name="num_treads_f2"
                                    value={inputs.num_treads_f2}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="8"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rebar Spacing (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="rebar_spacing"
                                    value={inputs.rebar_spacing}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.150"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rebar Bend Length (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="rebar_bend"
                                    value={inputs.rebar_bend}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Baluster Spacing (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="bal_spacing"
                                    value={inputs.bal_spacing}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.150"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Balustrade Height (m) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="bal_height"
                                    value={inputs.bal_height}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    placeholder="0.900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Finish Type *
                                </label>
                                <select
                                    name="finish_type"
                                    value={inputs.finish_type}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
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
                </div>

                {/* Results Section */}
                {results && (
                    <>
                        {/* Summary Cards */}
                        {summary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-lg shadow p-4">
                                    <p className="text-xs text-gray-600 mb-1">Total Concrete</p>
                                    <p className="text-2xl font-bold text-gray-800">{summary.total_concrete_m3}</p>
                                    <p className="text-xs text-gray-500">m³</p>
                                </div>
                                <div className="bg-white rounded-lg shadow p-4">
                                    <p className="text-xs text-gray-600 mb-1">Total Formwork</p>
                                    <p className="text-2xl font-bold text-gray-800">{summary.total_formwork_m2}</p>
                                    <p className="text-xs text-gray-500">m²</p>
                                </div>
                                <div className="bg-white rounded-lg shadow p-4">
                                    <p className="text-xs text-gray-600 mb-1">Total Rebar</p>
                                    <p className="text-2xl font-bold text-gray-800">{summary.total_rebar_m}</p>
                                    <p className="text-xs text-gray-500">m</p>
                                </div>
                                <div className="bg-white rounded-lg shadow p-4">
                                    <p className="text-xs text-gray-600 mb-1">Total Finishes</p>
                                    <p className="text-2xl font-bold text-gray-800">{summary.total_finishes_m2}</p>
                                    <p className="text-xs text-gray-500">m²</p>
                                </div>
                            </div>
                        )}

                        {/* BOQ Table */}
                        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-6 h-6 text-gray-700" />
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800">Bill of Quantities</h2>
                                        <p className="text-sm text-gray-600">Measured according to SMM7/CESMM4</p>
                                    </div>
                                </div>
                                <button
                                    onClick={exportToCSV}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-200">
                                            <th className="border border-gray-300 px-4 py-3 text-left text-sm font-bold text-gray-700 w-16">Item</th>
                                            <th className="border border-gray-300 px-4 py-3 text-left text-sm font-bold text-gray-700">Description</th>
                                            <th className="border border-gray-300 px-4 py-3 text-center text-sm font-bold text-gray-700 w-20">Unit</th>
                                            <th className="border border-gray-300 px-4 py-3 text-right text-sm font-bold text-gray-700 w-32">Quantity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((row, index) => (
                                            <tr key={index} className={index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                                                <td className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-center">{row.item}</td>
                                                <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">{row.description}</td>
                                                <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 text-center font-medium">{row.unit}</td>
                                                <td className="border border-gray-300 px-4 py-3 text-sm text-gray-800 text-right font-mono font-semibold">{row.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-6 p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                                <div className="flex items-start gap-2 mb-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 mb-2">Calculation Standards & Notes</p>
                                        <ul className="text-sm text-gray-700 space-y-1">
                                            <li>• Quantities calculated per SMM7 (Standard Method of Measurement) and CESMM4 (Civil Engineering Standard Method)</li>
                                            <li>• Concrete volumes include structural tolerances and design allowances</li>
                                            <li>• Reinforcement lengths include laps, bends, and anchorage as per BS 8666</li>
                                            <li>• Formwork measurements based on contact surface areas</li>
                                            <li>• Finishes measured separately for treads, risers, and landing surfaces</li>
                                            <li>• Waste allowances: Concrete 5%, Reinforcement 10%, Finishes 5%, Mesh 10%</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default StaircaseTakeoffApp;