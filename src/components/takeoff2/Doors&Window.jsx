import React, { useState } from 'react';
import { Calculator, Download, Plus, Trash2 } from 'lucide-react';

const DoorWindowTakeoff = () => {
    const [itemType, setItemType] = useState('door');
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

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
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

    const handleDescriptionChange = (id, text) => {
        setDescriptions(prev => prev.map(desc =>
            desc.id === id ? { ...desc, text } : desc
        ));
    };

    const addDescription = () => {
        setDescriptions(prev => [...prev, { id: Date.now(), text: '' }]);
    };

    const removeDescription = (id) => {
        setDescriptions(prev => prev.filter(desc => desc.id !== id));
    };

    const calculateQuantities = async () => {
        setLoading(true);
        try {
            // Simulate API call - Replace with actual FastAPI endpoint
            await new Promise(resolve => setTimeout(resolve, 500));

            // Convert inputs to numbers
            const opening_W = parseFloat(formData.opening_W);
            const opening_H = parseFloat(formData.opening_H);
            const wall_thick = parseFloat(formData.wall_thick);
            const frame_W = parseFloat(formData.frame_W) / 1000;
            const frame_thick = parseFloat(formData.frame_thick) / 1000;
            const horn_L = parseFloat(formData.horn_L) / 1000;
            const architrave_W = parseFloat(formData.architrave_W) / 1000;
            const architrave_thick = parseFloat(formData.architrave_thick) / 1000;
            const quadrant_size = parseFloat(formData.quadrant_size) / 1000;
            const lintel_bearing = parseFloat(formData.lintel_bearing);
            const lintel_H = parseFloat(formData.lintel_H);
            const lintel_W = wall_thick;
            const reinf_bar_diam = parseFloat(formData.reinf_bar_diam) / 1000;
            const num_reinf_bars = parseInt(formData.num_reinf_bars);
            const cover = parseFloat(formData.cover) / 1000;
            const reinf_extra = parseFloat(formData.reinf_extra);

            // Frame calculations
            const frame_H = opening_H + 2 * horn_L;
            const frame_total_L = 2 * frame_H + opening_W;

            // Architrave calculations
            const architrave_H = opening_H - 2 * (architrave_W / 2);
            const architrave_total_L = 2 * architrave_H + opening_W;

            // Quadrant calculations
            const quadrant_qty = architrave_total_L;

            // Lintel calculations
            const lintel_L = opening_W + 2 * lintel_bearing;
            const lintel_vol = lintel_L * lintel_W * lintel_H;

            // Reinforcement calculations
            const reinf_L_each = lintel_L - 2 * cover + 2 * lintel_bearing + reinf_extra;
            const reinf_total_L = num_reinf_bars * reinf_L_each;

            // Formwork calculations
            const form_soffit = lintel_L * lintel_W;
            const form_sides = 2 * lintel_L * lintel_H;
            const total_form = form_soffit + form_sides;

            // Deductions
            const opening_area = opening_W * opening_H;
            const deduct_wall = opening_area * wall_thick;
            const deduct_plaster_both = opening_area * 2 * 0.015; // 15mm plaster both sides

            let itemResults = [];

            if (itemType === 'door') {
                const leaf_thick = parseFloat(formData.leaf_thick) / 1000;
                const leaping_size = parseFloat(formData.leaping_size) / 1000;
                const num_doors = parseInt(formData.num_doors);

                const leaf_W = opening_W - 2 * frame_thick;
                const leaf_H = opening_H - frame_thick;
                const leaf_area = leaf_W * leaf_H;
                const total_leaf_area = leaf_area * num_doors;

                const leaping_perim = 2 * (leaf_W + leaf_H);
                const leaping_qty = leaping_perim * num_doors;

                itemResults = [
                    {
                        item: 'Hardwood door frame',
                        description: `${(frame_W * 1000).toFixed(0)}mm x ${(frame_thick * 1000).toFixed(0)}mm`,
                        dimensions: `2/${frame_H.toFixed(2)}/1/${opening_W.toFixed(2)}`,
                        quantity: frame_total_L.toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Door leaf',
                        description: `${formData.leaf_material}, ${(leaf_thick * 1000).toFixed(0)}mm thick`,
                        dimensions: `${num_doors}/${leaf_H.toFixed(2)}/${leaf_W.toFixed(2)}`,
                        quantity: total_leaf_area.toFixed(2),
                        unit: 'm²'
                    },
                    {
                        item: 'Door leaping/edging',
                        description: `${(leaping_size * 1000).toFixed(0)}mm hardwood edging`,
                        dimensions: `${num_doors}/${leaping_perim.toFixed(2)}`,
                        quantity: leaping_qty.toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Hardwood architrave',
                        description: `${(architrave_W * 1000).toFixed(0)}mm x ${(architrave_thick * 1000).toFixed(0)}mm`,
                        dimensions: `2/${architrave_H.toFixed(2)}/1/${opening_W.toFixed(2)}`,
                        quantity: architrave_total_L.toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Quadrant mould',
                        description: `${(quadrant_size * 1000).toFixed(0)}mm quadrant beading`,
                        dimensions: `2/${architrave_H.toFixed(2)}/1/${opening_W.toFixed(2)}`,
                        quantity: quadrant_qty.toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Door lock',
                        description: 'Mortice lock complete with keys',
                        dimensions: '',
                        quantity: (parseInt(formData.num_locks) * num_doors).toString(),
                        unit: 'No.'
                    },
                    {
                        item: 'Door hinges',
                        description: '100mm brass butt hinges',
                        dimensions: '',
                        quantity: (parseInt(formData.num_hinges) * num_doors).toString(),
                        unit: 'No.'
                    },
                    {
                        item: 'Door stopper',
                        description: 'Door stopper/buffer',
                        dimensions: '',
                        quantity: (parseInt(formData.num_stoppers) * num_doors).toString(),
                        unit: 'No.'
                    },
                    {
                        item: 'Tower bolts',
                        description: '150mm tower bolts',
                        dimensions: '',
                        quantity: (parseInt(formData.num_bolts) * num_doors).toString(),
                        unit: 'No.'
                    },
                    {
                        item: 'Door clamps',
                        description: 'Aldrop/door clamps',
                        dimensions: '',
                        quantity: (parseInt(formData.num_clamps) * num_doors).toString(),
                        unit: 'No.'
                    }
                ];
            } else {
                const glazing_thick = parseFloat(formData.glazing_thick) / 1000;
                const num_panes = parseInt(formData.num_panes);
                const num_windows = parseInt(formData.num_windows);

                const pane_W = opening_W / num_panes;
                const pane_area = pane_W * opening_H;
                const total_glazing = pane_area * num_panes * num_windows;

                itemResults = [
                    {
                        item: 'Hardwood window frame',
                        description: `${(frame_W * 1000).toFixed(0)}mm x ${(frame_thick * 1000).toFixed(0)}mm`,
                        dimensions: `2/${frame_H.toFixed(2)}/1/${opening_W.toFixed(2)}`,
                        quantity: frame_total_L.toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Glass panes',
                        description: `${(glazing_thick * 1000).toFixed(0)}mm clear float glass`,
                        dimensions: `${num_windows * num_panes}/${opening_H.toFixed(2)}/${pane_W.toFixed(2)}`,
                        quantity: total_glazing.toFixed(2),
                        unit: 'm²'
                    },
                    {
                        item: 'Glazing beads',
                        description: '12mm x 12mm glazing beads',
                        dimensions: `${num_windows * num_panes * 2}/${opening_H.toFixed(2)}/${num_windows * num_panes * 2}/${pane_W.toFixed(2)}`,
                        quantity: (2 * (opening_H + pane_W) * num_panes * num_windows).toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Hardwood architrave',
                        description: `${(architrave_W * 1000).toFixed(0)}mm x ${(architrave_thick * 1000).toFixed(0)}mm`,
                        dimensions: `2/${architrave_H.toFixed(2)}/1/${opening_W.toFixed(2)}`,
                        quantity: architrave_total_L.toFixed(2),
                        unit: 'm'
                    },
                    {
                        item: 'Window stays',
                        description: '200mm casement stays',
                        dimensions: '',
                        quantity: (num_windows * num_panes).toString(),
                        unit: 'No.'
                    },
                    {
                        item: 'Window fasteners',
                        description: 'Casement fasteners',
                        dimensions: '',
                        quantity: (num_windows * num_panes).toString(),
                        unit: 'No.'
                    }
                ];

                if (formData.has_mullions && formData.mullion_L) {
                    const mullion_L = parseFloat(formData.mullion_L);
                    const mullion_size = parseFloat(formData.mullion_size);
                    itemResults.push({
                        item: 'Vertical mullions',
                        description: `${(mullion_size * 1000).toFixed(0)}mm x ${(mullion_size * 1000).toFixed(0)}mm hardwood`,
                        dimensions: `${num_panes - 1}/${mullion_L.toFixed(2)}`,
                        quantity: ((num_panes - 1) * mullion_L * num_windows).toFixed(2),
                        unit: 'm'
                    });
                }

                if (formData.has_grills) {
                    itemResults.push({
                        item: 'Window grills',
                        description: '12mm dia. MS bars @ 150mm c/c',
                        dimensions: `${num_windows}/${opening_H.toFixed(2)}/${opening_W.toFixed(2)}`,
                        quantity: (opening_H * opening_W * num_windows).toFixed(2),
                        unit: 'm²'
                    });
                }

                if (formData.has_mesh) {
                    itemResults.push({
                        item: 'Mosquito mesh',
                        description: 'Aluminium wire mesh',
                        dimensions: `${num_windows}/${opening_H.toFixed(2)}/${opening_W.toFixed(2)}`,
                        quantity: (opening_H * opening_W * num_windows).toFixed(2),
                        unit: 'm²'
                    });
                }
            }

            // Add common items
            itemResults.push(
                {
                    item: 'RC lintel',
                    description: `Concrete lintel ${lintel_H.toFixed(2)}m x ${lintel_W.toFixed(2)}m`,
                    dimensions: `1/${lintel_H.toFixed(2)}/${lintel_W.toFixed(2)}/${lintel_L.toFixed(2)}`,
                    quantity: lintel_vol.toFixed(3),
                    unit: 'm³'
                },
                {
                    item: 'Reinforcement bars',
                    description: `Y${(reinf_bar_diam * 1000).toFixed(0)} bars`,
                    dimensions: `${num_reinf_bars}/${reinf_L_each.toFixed(2)}`,
                    quantity: reinf_total_L.toFixed(2),
                    unit: 'm'
                },
                {
                    item: 'Formwork to lintel',
                    description: `${formData.form_type} formwork`,
                    dimensions: `1/${lintel_L.toFixed(2)}/${lintel_W.toFixed(2)}/2/${lintel_L.toFixed(2)}/${lintel_H.toFixed(2)}`,
                    quantity: total_form.toFixed(2),
                    unit: 'm²'
                },
                {
                    item: 'Deduct blockwork',
                    description: 'Opening in wall',
                    dimensions: `1/${opening_H.toFixed(2)}/${opening_W.toFixed(2)}/${wall_thick.toFixed(2)}`,
                    quantity: deduct_wall.toFixed(3),
                    unit: 'm³'
                },
                {
                    item: 'Deduct plaster',
                    description: 'Both sides of opening',
                    dimensions: `2/${opening_H.toFixed(2)}/${opening_W.toFixed(2)}`,
                    quantity: deduct_plaster_both.toFixed(2),
                    unit: 'm²'
                }
            );

            setResults(itemResults);
        } catch (error) {
            console.error('Calculation error:', error);
            alert('Error calculating quantities. Please check your inputs.');
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!results) return;

        const headers = ['Item', 'Description', 'Dimensions', 'Quantity', 'Unit'];
        const rows = results.map(r => [
            r.item,
            r.description,
            r.dimensions,
            r.quantity,
            r.unit
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${itemType}_takeoff_${Date.now()}.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Calculator className="w-8 h-8 text-gray-700" />
                        <h1 className="text-3xl font-bold text-gray-800">Door & Window Quantity Takeoff</h1>
                    </div>
                    <p className="text-gray-600">Professional quantity surveying calculator for civil engineers</p>
                </div>

                {/* Item Type Selection */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Item Type</h2>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setItemType('door')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${itemType === 'door'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Internal Door
                        </button>
                        <button
                            onClick={() => setItemType('window')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${itemType === 'window'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Window
                        </button>
                    </div>
                </div>

                {/* Input Form */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Measurements & Specifications</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Common Inputs */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Opening Width (m) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                name="opening_W"
                                value={formData.opening_W}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                placeholder="e.g., 0.9"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Opening Height (m) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                name="opening_H"
                                value={formData.opening_H}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                placeholder="e.g., 2.1"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Wall Thickness (m)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                name="wall_thick"
                                value={formData.wall_thick}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Frame Width (mm)
                            </label>
                            <input
                                type="number"
                                name="frame_W"
                                value={formData.frame_W}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Frame Thickness (mm)
                            </label>
                            <input
                                type="number"
                                name="frame_thick"
                                value={formData.frame_thick}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Horn Length (mm)
                            </label>
                            <input
                                type="number"
                                name="horn_L"
                                value={formData.horn_L}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Architrave Width (mm)
                            </label>
                            <input
                                type="number"
                                name="architrave_W"
                                value={formData.architrave_W}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Architrave Thickness (mm)
                            </label>
                            <input
                                type="number"
                                name="architrave_thick"
                                value={formData.architrave_thick}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quadrant Size (mm)
                            </label>
                            <input
                                type="number"
                                name="quadrant_size"
                                value={formData.quadrant_size}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        {/* Door Specific Inputs */}
                        {itemType === 'door' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Doors
                                    </label>
                                    <input
                                        type="number"
                                        name="num_doors"
                                        value={formData.num_doors}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Leaf Thickness (mm)
                                    </label>
                                    <input
                                        type="number"
                                        name="leaf_thick"
                                        value={formData.leaf_thick}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Leaf Material
                                    </label>
                                    <input
                                        type="text"
                                        name="leaf_material"
                                        value={formData.leaf_material}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Locks
                                    </label>
                                    <input
                                        type="number"
                                        name="num_locks"
                                        value={formData.num_locks}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Hinges
                                    </label>
                                    <input
                                        type="number"
                                        name="num_hinges"
                                        value={formData.num_hinges}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Stoppers
                                    </label>
                                    <input
                                        type="number"
                                        name="num_stoppers"
                                        value={formData.num_stoppers}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Bolts
                                    </label>
                                    <input
                                        type="number"
                                        name="num_bolts"
                                        value={formData.num_bolts}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Clamps
                                    </label>
                                    <input
                                        type="number"
                                        name="num_clamps"
                                        value={formData.num_clamps}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>
                            </>
                        )}

                        {/* Window Specific Inputs */}
                        {itemType === 'window' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Windows
                                    </label>
                                    <input
                                        type="number"
                                        name="num_windows"
                                        value={formData.num_windows}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Panes
                                    </label>
                                    <input
                                        type="number"
                                        name="num_panes"
                                        value={formData.num_panes}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Glazing Thickness (mm)
                                    </label>
                                    <input
                                        type="number"
                                        name="glazing_thick"
                                        value={formData.glazing_thick}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="has_mullions"
                                        checked={formData.has_mullions}
                                        onChange={handleInputChange}
                                        className="w-4 h-4 text-gray-800 rounded focus:ring-gray-800"
                                    />
                                    <label className="text-sm font-medium text-gray-700">
                                        Include Mullions
                                    </label>
                                </div>

                                {formData.has_mullions && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Mullion Size (m)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                name="mullion_size"
                                                value={formData.mullion_size}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="has_grills"
                                        checked={formData.has_grills}
                                        onChange={handleInputChange}
                                        className="w-4 h-4 text-gray-800 rounded focus:ring-gray-800"
                                    />
                                    <label className="text-sm font-medium text-gray-700">
                                        Include Window Grills
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="has_mesh"
                                        checked={formData.has_mesh}
                                        onChange={handleInputChange}
                                        className="w-4 h-4 text-gray-800 rounded focus:ring-gray-800"
                                    />
                                    <label className="text-sm font-medium text-gray-700">
                                        Include Mosquito Mesh
                                    </label>
                                </div>
                            </>
                        )}

                        {/* Lintel & Reinforcement */}
                        <div className="col-span-full">
                            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-3">Lintel & Reinforcement</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Lintel Bearing Each Side (m)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                name="lintel_bearing"
                                value={formData.lintel_bearing}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Lintel Height (m)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                name="lintel_H"
                                value={formData.lintel_H}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reinforcement Bar Diameter (mm)
                            </label>
                            <input
                                type="number"
                                name="reinf_bar_diam"
                                value={formData.reinf_bar_diam}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Number of Reinforcement Bars
                            </label>
                            <input
                                type="number"
                                name="num_reinf_bars"
                                value={formData.num_reinf_bars}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Concrete Cover (mm)
                            </label>
                            <input
                                type="number"
                                name="cover"
                                value={formData.cover}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Formwork Type
                            </label>
                            <input
                                type="text"
                                name="form_type"
                                value={formData.form_type}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <button
                        onClick={calculateQuantities}
                        disabled={loading || !formData.opening_W || !formData.opening_H}
                        className="mt-6 px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        <Calculator className="w-5 h-5" />
                        {loading ? 'Calculating...' : 'Calculate Quantities'}
                    </button>
                </div>

                {/* Description Editor */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Descriptions</h2>
                    <div className="space-y-3">
                        {descriptions.map((desc, index) => (
                            <div key={desc.id} className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600 w-8">{index + 1}.</span>
                                <input
                                    type="text"
                                    value={desc.text}
                                    onChange={(e) => handleDescriptionChange(desc.id, e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                    placeholder="Enter description..."
                                />
                                <button
                                    onClick={() => removeDescription(desc.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addDescription}
                        className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Add Description
                    </button>
                </div>

                {/* Results Table */}
                {results && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Bill of Quantities</h2>
                            <button
                                onClick={exportToCSV}
                                className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 flex items-center gap-2 transition-colors"
                            >
                                <Download className="w-5 h-5" />
                                Export CSV
                            </button>
                        </div>

                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-semibold text-gray-800 mb-2">Project Description:</h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                {descriptions.filter(d => d.text).map((desc, idx) => (
                                    <li key={desc.id} className="text-sm">{desc.text}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-800 text-white">
                                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Item</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Description</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Dimensions</th>
                                        <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Quantity</th>
                                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-800">{row.item}</td>
                                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">{row.description}</td>
                                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600 font-mono">{row.dimensions}</td>
                                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-800 text-right font-semibold">{row.quantity}</td>
                                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 text-center">{row.unit}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                                <strong>Note:</strong> All quantities are net and do not include waste allowances.
                                Add appropriate waste factors as per project specifications.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DoorWindowTakeoff;