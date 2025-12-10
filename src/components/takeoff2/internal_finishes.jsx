import React, { useState } from 'react';
import { Calculator, Plus, Trash2, Download, FileText } from 'lucide-react';

const InternalFinishesTakeoff = () => {
    const [rooms, setRooms] = useState([{
        id: 1,
        length: '',
        width: '',
        height: '',
        doors: 1,
        doorHeight: 2.1,
        doorWidth: 0.9,
        windows: 1,
        windowHeight: 1.2,
        windowWidth: 1.5
    }]);

    const [materials, setMaterials] = useState({
        plasterThickness: 15,
        screedThickness: 25,
        tileSize: 300,
        skirtingHeight: 100,
        paintCoats: 3,
        ceilingFinish: 'gypsum',
        wallTiling: 'partial'
    });

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [projectDetails, setProjectDetails] = useState({
        projectName: '',
        clientName: '',
        date: new Date().toISOString().split('T')[0]
    });

    const addRoom = () => {
        setRooms([...rooms, {
            id: rooms.length + 1,
            length: '',
            width: '',
            height: '',
            doors: 1,
            doorHeight: 2.1,
            doorWidth: 0.9,
            windows: 1,
            windowHeight: 1.2,
            windowWidth: 1.5
        }]);
    };

    const removeRoom = (id) => {
        if (rooms.length > 1) {
            setRooms(rooms.filter(room => room.id !== id));
        }
    };

    const updateRoom = (id, field, value) => {
        setRooms(rooms.map(room =>
            room.id === id ? { ...room, [field]: parseFloat(value) || value } : room
        ));
    };

    const calculateQuantities = async () => {
        setLoading(true);
        try {
            // Simulate API call to FastAPI backend
            const payload = {
                rooms: rooms.map(r => ({
                    length: parseFloat(r.length) || 0,
                    width: parseFloat(r.width) || 0,
                    height: parseFloat(r.height) || 0,
                    doors: parseInt(r.doors) || 0,
                    door_height: parseFloat(r.doorHeight) || 2.1,
                    door_width: parseFloat(r.doorWidth) || 0.9,
                    windows: parseInt(r.windows) || 0,
                    window_height: parseFloat(r.windowHeight) || 1.2,
                    window_width: parseFloat(r.windowWidth) || 1.5
                })),
                materials: {
                    plaster_thickness: parseFloat(materials.plasterThickness) || 15,
                    screed_thickness: parseFloat(materials.screedThickness) || 25,
                    tile_size: parseFloat(materials.tileSize) || 300,
                    skirting_height: parseFloat(materials.skirtingHeight) || 100,
                    paint_coats: parseInt(materials.paintCoats) || 3,
                    ceiling_finish: materials.ceilingFinish,
                    wall_tiling: materials.wallTiling
                }
            };

            // In production, this would be:
            // const response = await axios.post('http://localhost:8000/api/calculate', payload);
            // const data = response.data;

            // Simulated calculation (you'll replace with actual API call)
            const data = simulateCalculation(payload);
            setResults(data);
        } catch (error) {
            console.error('Calculation error:', error);
            alert('Error calculating quantities. Please check your inputs.');
        } finally {
            setLoading(false);
        }
    };

    const simulateCalculation = (payload) => {
        let totalFloor = 0, totalWall = 0, totalCeiling = 0, totalPerim = 0;
        let totalDoorArea = 0, totalWindowArea = 0;

        payload.rooms.forEach(r => {
            const floor = r.length * r.width;
            const wall = 2 * (r.length + r.width) * r.height;
            const doorArea = r.doors * r.door_height * r.door_width;
            const winArea = r.windows * r.window_height * r.window_width;

            totalFloor += floor;
            totalWall += wall - doorArea - winArea;
            totalCeiling += floor;
            totalPerim += 2 * (r.length + r.width);
            totalDoorArea += doorArea;
            totalWindowArea += winArea;
        });

        const plasterThick = payload.materials.plaster_thickness / 1000;
        const screedThick = payload.materials.screed_thickness / 1000;
        const tileSize = payload.materials.tile_size / 1000;
        const skirtHeight = payload.materials.skirting_height / 1000;

        const wallTilingFactor = payload.materials.wall_tiling === 'full' ? 1.0 :
            payload.materials.wall_tiling === 'partial' ? 0.3 : 0;

        return {
            summary: {
                total_floor_area: totalFloor,
                total_wall_area: totalWall,
                total_ceiling_area: totalCeiling,
                total_perimeter: totalPerim
            },
            items: [
                {
                    item_no: '1.0',
                    description: 'WALL FINISHES',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '1.1',
                    description: 'Cement sand plaster (1:4) 15mm thick to internal walls including finishing',
                    unit: 'm²',
                    quantity: totalWall.toFixed(2),
                    rate: '450.00',
                    amount: (totalWall * 450).toFixed(2)
                },
                {
                    item_no: '1.2',
                    description: `300x300mm ceramic wall tiles ${wallTilingFactor > 0 ? 'to bathroom/kitchen areas' : '(not applicable)'}`,
                    unit: 'no.',
                    quantity: Math.ceil(totalWall * wallTilingFactor / (tileSize * tileSize)),
                    rate: '85.00',
                    amount: (Math.ceil(totalWall * wallTilingFactor / (tileSize * tileSize)) * 85).toFixed(2)
                },
                {
                    item_no: '1.3',
                    description: 'Emulsion paint (3 coats) to internal plastered walls',
                    unit: 'm²',
                    quantity: (totalWall * payload.materials.paint_coats).toFixed(2),
                    rate: '180.00',
                    amount: (totalWall * payload.materials.paint_coats * 180).toFixed(2)
                },
                {
                    item_no: '',
                    description: '',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '2.0',
                    description: 'CEILING FINISHES',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '2.1',
                    description: payload.materials.ceiling_finish === 'gypsum'
                        ? '12.5mm gypsum board ceiling on metal framework'
                        : 'Cement sand plaster (1:4) 15mm thick to ceiling',
                    unit: 'm²',
                    quantity: totalCeiling.toFixed(2),
                    rate: payload.materials.ceiling_finish === 'gypsum' ? '1200.00' : '450.00',
                    amount: (totalCeiling * (payload.materials.ceiling_finish === 'gypsum' ? 1200 : 450)).toFixed(2)
                },
                {
                    item_no: '2.2',
                    description: 'Emulsion paint (3 coats) to ceiling',
                    unit: 'm²',
                    quantity: (totalCeiling * payload.materials.paint_coats).toFixed(2),
                    rate: '180.00',
                    amount: (totalCeiling * payload.materials.paint_coats * 180).toFixed(2)
                },
                {
                    item_no: '',
                    description: '',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '3.0',
                    description: 'FLOOR FINISHES',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '3.1',
                    description: 'Cement sand screed (1:3) 25mm thick to floors',
                    unit: 'm²',
                    quantity: totalFloor.toFixed(2),
                    rate: '350.00',
                    amount: (totalFloor * 350).toFixed(2)
                },
                {
                    item_no: '3.2',
                    description: '300x300mm ceramic floor tiles including grouting',
                    unit: 'no.',
                    quantity: Math.ceil(totalFloor / (tileSize * tileSize)),
                    rate: '95.00',
                    amount: (Math.ceil(totalFloor / (tileSize * tileSize)) * 95).toFixed(2)
                },
                {
                    item_no: '3.3',
                    description: '100mm high timber/PVC skirting board',
                    unit: 'm',
                    quantity: totalPerim.toFixed(2),
                    rate: '280.00',
                    amount: (totalPerim * 280).toFixed(2)
                },
                {
                    item_no: '',
                    description: '',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '4.0',
                    description: 'DOORS AND WINDOWS',
                    unit: '',
                    quantity: '',
                    rate: '',
                    amount: ''
                },
                {
                    item_no: '4.1',
                    description: 'Oil paint (3 coats) to doors both sides',
                    unit: 'm²',
                    quantity: (totalDoorArea * 2 * payload.materials.paint_coats).toFixed(2),
                    rate: '220.00',
                    amount: (totalDoorArea * 2 * payload.materials.paint_coats * 220).toFixed(2)
                },
                {
                    item_no: '4.2',
                    description: 'Oil paint (3 coats) to window frames',
                    unit: 'm²',
                    quantity: (totalWindowArea * payload.materials.paint_coats).toFixed(2),
                    rate: '220.00',
                    amount: (totalWindowArea * payload.materials.paint_coats * 220).toFixed(2)
                }
            ]
        };
    };

    const exportResults = () => {
        if (!results) return;

        let csv = 'BILL OF QUANTITIES - INTERNAL FINISHES\n\n';
        csv += `Project: ${projectDetails.projectName}\n`;
        csv += `Client: ${projectDetails.clientName}\n`;
        csv += `Date: ${projectDetails.date}\n\n`;
        csv += 'Item No.,Description,Unit,Quantity,Rate (KES),Amount (KES)\n';

        results.items.forEach(item => {
            csv += `${item.item_no},"${item.description}",${item.unit},${item.quantity},${item.rate},${item.amount}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `internal_finishes_takeoff_${projectDetails.date}.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Calculator className="w-8 h-8 text-gray-700" />
                        <h1 className="text-3xl font-bold text-gray-800">Internal Finishes Quantity Takeoff</h1>
                    </div>

                    {/* Project Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <input
                            type="text"
                            placeholder="Project Name"
                            value={projectDetails.projectName}
                            onChange={(e) => setProjectDetails({ ...projectDetails, projectName: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                        <input
                            type="text"
                            placeholder="Client Name"
                            value={projectDetails.clientName}
                            onChange={(e) => setProjectDetails({ ...projectDetails, clientName: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                        <input
                            type="date"
                            value={projectDetails.date}
                            onChange={(e) => setProjectDetails({ ...projectDetails, date: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel - Inputs */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Rooms */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">Room Dimensions</h2>
                                <button
                                    onClick={addRoom}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Room
                                </button>
                            </div>

                            <div className="space-y-4">
                                {rooms.map((room, idx) => (
                                    <div key={room.id} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-medium text-gray-700">Room {idx + 1}</h3>
                                            {rooms.length > 1 && (
                                                <button
                                                    onClick={() => removeRoom(room.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 mb-3">
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Length (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={room.length}
                                                    onChange={(e) => updateRoom(room.id, 'length', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                                    placeholder="4.5"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Width (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={room.width}
                                                    onChange={(e) => updateRoom(room.id, 'width', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                                    placeholder="3.6"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Height (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={room.height}
                                                    onChange={(e) => updateRoom(room.id, 'height', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                                    placeholder="2.7"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <label className="block text-sm text-gray-600">Doors</label>
                                                <input
                                                    type="number"
                                                    value={room.doors}
                                                    onChange={(e) => updateRoom(room.id, 'doors', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={room.doorHeight}
                                                        onChange={(e) => updateRoom(room.id, 'doorHeight', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        placeholder="H: 2.1m"
                                                    />
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={room.doorWidth}
                                                        onChange={(e) => updateRoom(room.id, 'doorWidth', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        placeholder="W: 0.9m"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-sm text-gray-600">Windows</label>
                                                <input
                                                    type="number"
                                                    value={room.windows}
                                                    onChange={(e) => updateRoom(room.id, 'windows', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={room.windowHeight}
                                                        onChange={(e) => updateRoom(room.id, 'windowHeight', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        placeholder="H: 1.2m"
                                                    />
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={room.windowWidth}
                                                        onChange={(e) => updateRoom(room.id, 'windowWidth', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        placeholder="W: 1.5m"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Material Specifications */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Material Specifications</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Plaster Thickness (mm)</label>
                                    <input
                                        type="number"
                                        value={materials.plasterThickness}
                                        onChange={(e) => setMaterials({ ...materials, plasterThickness: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Screed Thickness (mm)</label>
                                    <input
                                        type="number"
                                        value={materials.screedThickness}
                                        onChange={(e) => setMaterials({ ...materials, screedThickness: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Tile Size (mm)</label>
                                    <input
                                        type="number"
                                        value={materials.tileSize}
                                        onChange={(e) => setMaterials({ ...materials, tileSize: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Skirting Height (mm)</label>
                                    <input
                                        type="number"
                                        value={materials.skirtingHeight}
                                        onChange={(e) => setMaterials({ ...materials, skirtingHeight: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Paint Coats</label>
                                    <input
                                        type="number"
                                        value={materials.paintCoats}
                                        onChange={(e) => setMaterials({ ...materials, paintCoats: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Ceiling Finish</label>
                                    <select
                                        value={materials.ceilingFinish}
                                        onChange={(e) => setMaterials({ ...materials, ceilingFinish: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    >
                                        <option value="gypsum">Gypsum Board</option>
                                        <option value="plaster">Plaster</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Wall Tiling</label>
                                    <select
                                        value={materials.wallTiling}
                                        onChange={(e) => setMaterials({ ...materials, wallTiling: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
                                    >
                                        <option value="none">None</option>
                                        <option value="partial">Partial (30%)</option>
                                        <option value="full">Full Height</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={calculateQuantities}
                                disabled={loading}
                                className="w-full mt-6 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                <Calculator className="w-5 h-5" />
                                {loading ? 'Calculating...' : 'Calculate Quantities'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                {results && (
                    <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Bill of Quantities</h2>
                            <button
                                onClick={exportResults}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                                        <th className="text-left p-3 text-sm font-semibold text-gray-700 border border-gray-300">Item No.</th>
                                        <th className="text-left p-3 text-sm font-semibold text-gray-700 border border-gray-300">Description</th>
                                        <th className="text-center p-3 text-sm font-semibold text-gray-700 border border-gray-300">Unit</th>
                                        <th className="text-right p-3 text-sm font-semibold text-gray-700 border border-gray-300">Quantity</th>
                                        <th className="text-right p-3 text-sm font-semibold text-gray-700 border border-gray-300">Rate (KES)</th>
                                        <th className="text-right p-3 text-sm font-semibold text-gray-700 border border-gray-300">Amount (KES)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.items.map((item, idx) => (
                                        <tr
                                            key={idx}
                                            className={`${item.item_no.endsWith('.0')
                                                ? 'bg-gray-50 font-semibold'
                                                : 'hover:bg-gray-50'
                                                } ${item.description === '' ? 'h-2' : ''}`}
                                        >
                                            <td className="p-3 text-sm border border-gray-300">{item.item_no}</td>
                                            <td className="p-3 text-sm border border-gray-300">{item.description}</td>
                                            <td className="p-3 text-sm text-center border border-gray-300">{item.unit}</td>
                                            <td className="p-3 text-sm text-right border border-gray-300">{item.quantity}</td>
                                            <td className="p-3 text-sm text-right border border-gray-300">{item.rate}</td>
                                            <td className="p-3 text-sm text-right border border-gray-300">{item.amount}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                                        <td colSpan="5" className="p-3 text-right border border-gray-300">TOTAL</td>
                                        <td className="p-3 text-right border border-gray-300">
                                            {results.items
                                                .filter(item => item.amount && !isNaN(parseFloat(item.amount)))
                                                .reduce((sum, item) => sum + parseFloat(item.amount), 0)
                                                .toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Total Floor Area</p>
                                <p className="text-lg font-semibold text-gray-800">{results.summary.total_floor_area.toFixed(2)} m²</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Total Wall Area</p>
                                <p className="text-lg font-semibold text-gray-800">{results.summary.total_wall_area.toFixed(2)} m²</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Total Ceiling Area</p>
                                <p className="text-lg font-semibold text-gray-800">{results.summary.total_ceiling_area.toFixed(2)} m²</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Total Perimeter</p>
                                <p className="text-lg font-semibold text-gray-800">{results.summary.total_perimeter.toFixed(2)} m</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InternalFinishesTakeoff;