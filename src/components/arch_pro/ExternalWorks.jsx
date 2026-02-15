import React, { useState, useRef, useEffect } from 'react';
import { Play, Download, AlertCircle, CheckCircle, FileText, Layers, MapPin, Road, Square, Trees, Droplet, Ruler } from 'lucide-react';

// Civil Engineering External Works Designer
// Interactive BIM tool for site infrastructure

const ExternalWorksDesigner = () => {
    const canvasRef = useRef(null);
    const [activeTab, setActiveTab] = useState('site');
    const [siteData, setSiteData] = useState({
        name: 'Commercial Building Site',
        bounds: { width: 60, depth: 80 },
        buildingPosition: { x: 0, z: 0 },
        buildingSize: { width: 20, depth: 16 },
        plinthLevel: 100.50
    });

    const [infrastructure, setInfrastructure] = useState({
        drainage: [],
        roads: [],
        parking: [],
        pavements: [],
        trees: [],
        grassAreas: []
    });

    const [validationResults, setValidationResults] = useState({
        valid: true,
        errors: [],
        warnings: []
    });

    const [selectedElement, setSelectedElement] = useState(null);
    const [viewMode, setViewMode] = useState('2d'); // 2d or 3d
    const [isGenerating, setIsGenerating] = useState(false);

    // Drawing state
    const [drawMode, setDrawMode] = useState(null);
    const [drawPoints, setDrawPoints] = useState([]);

    // Canvas rendering
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();

        // Set canvas size
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        // Clear canvas
        ctx.fillStyle = '#f0f4f0';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Calculate scale
        const scale = Math.min(
            (rect.width - 80) / siteData.bounds.width,
            (rect.height - 80) / siteData.bounds.depth
        );

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Helper to convert site coords to canvas coords
        const toCanvas = (x, z) => ({
            x: centerX + x * scale,
            y: centerY + z * scale
        });

        // Draw grid
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 0.5;
        for (let i = -30; i <= 30; i += 5) {
            const start = toCanvas(i, -40);
            const end = toCanvas(i, 40);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        for (let i = -40; i <= 40; i += 5) {
            const start = toCanvas(-30, i);
            const end = toCanvas(30, i);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }

        // Draw site boundary
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const tl = toCanvas(-siteData.bounds.width / 2, -siteData.bounds.depth / 2);
        const br = toCanvas(siteData.bounds.width / 2, siteData.bounds.depth / 2);
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.setLineDash([]);

        // Draw building
        ctx.fillStyle = '#8b7355';
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        const building = {
            x: siteData.buildingPosition.x - siteData.buildingSize.width / 2,
            z: siteData.buildingPosition.z - siteData.buildingSize.depth / 2,
            w: siteData.buildingSize.width,
            d: siteData.buildingSize.depth
        };
        const btl = toCanvas(building.x, building.z);
        const bbr = toCanvas(building.x + building.w, building.z + building.d);
        ctx.fillRect(btl.x, btl.y, bbr.x - btl.x, bbr.y - btl.y);
        ctx.strokeRect(btl.x, btl.y, bbr.x - btl.x, bbr.y - btl.y);

        // Draw drainage
        infrastructure.drainage.forEach((drain, idx) => {
            if (drain.type === 'channel') {
                ctx.strokeStyle = '#0066cc';
                ctx.lineWidth = 4;
                ctx.beginPath();
                const start = toCanvas(drain.start.x, drain.start.z);
                const end = toCanvas(drain.end.x, drain.end.z);
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();

                // Arrow showing flow direction
                const angle = Math.atan2(end.y - start.y, end.x - start.x);
                ctx.fillStyle = '#0066cc';
                ctx.beginPath();
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(
                    end.x - 10 * Math.cos(angle - Math.PI / 6),
                    end.y - 10 * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    end.x - 10 * Math.cos(angle + Math.PI / 6),
                    end.y - 10 * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
            } else if (drain.type === 'catchpit') {
                const pos = toCanvas(drain.position.x, drain.position.z);
                ctx.fillStyle = '#003d7a';
                ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(pos.x - 5, pos.y - 5, 10, 10);
            }
        });

        // Draw roads
        infrastructure.roads.forEach(road => {
            ctx.strokeStyle = '#2d2d2d';
            ctx.lineWidth = road.width * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            road.centerline.forEach((point, idx) => {
                const pos = toCanvas(point.x, point.z);
                if (idx === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();

            // Center line
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            road.centerline.forEach((point, idx) => {
                const pos = toCanvas(point.x, point.z);
                if (idx === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw parking
        infrastructure.parking.forEach(area => {
            const pos = toCanvas(area.origin.x, area.origin.z);
            const size = {
                w: area.baysPerRow * 2.4 * scale,
                h: area.rows * 11 * scale
            };

            ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.fillRect(pos.x, pos.y, size.w, size.h);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;

            // Draw bay lines
            for (let i = 0; i <= area.baysPerRow; i++) {
                ctx.beginPath();
                ctx.moveTo(pos.x + i * 2.4 * scale, pos.y);
                ctx.lineTo(pos.x + i * 2.4 * scale, pos.y + size.h);
                ctx.stroke();
            }
        });

        // Draw trees
        infrastructure.trees.forEach(tree => {
            const pos = toCanvas(tree.position.x, tree.position.z);

            // Canopy
            ctx.fillStyle = '#2d5016';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, tree.canopyRadius * scale, 0, Math.PI * 2);
            ctx.fill();

            // Trunk
            ctx.fillStyle = '#654321';
            ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);

            // Clearance zone (if selected)
            if (selectedElement?.type === 'tree' && selectedElement?.id === tree.id) {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, tree.rootRadius * scale, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Draw grass areas
        infrastructure.grassAreas.forEach(area => {
            ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2;
            ctx.beginPath();
            area.boundary.forEach((point, idx) => {
                const pos = toCanvas(point.x, point.z);
                if (idx === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // Draw current drawing points
        if (drawPoints.length > 0) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            drawPoints.forEach((point, idx) => {
                const pos = toCanvas(point.x, point.z);
                if (idx === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw points
            drawPoints.forEach(point => {
                const pos = toCanvas(point.x, point.z);
                ctx.fillStyle = '#ff6b6b';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

    }, [infrastructure, siteData, selectedElement, drawPoints]);

    // Canvas click handler
    const handleCanvasClick = (e) => {
        if (!drawMode) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to site coordinates
        const scale = Math.min(
            (rect.width - 80) / siteData.bounds.width,
            (rect.height - 80) / siteData.bounds.depth
        );
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const siteX = (x - centerX) / scale;
        const siteZ = (y - centerY) / scale;

        const newPoint = { x: siteX, z: siteZ };
        setDrawPoints([...drawPoints, newPoint]);
    };

    // Add element based on draw mode
    const finishDrawing = () => {
        if (drawPoints.length < 2) {
            alert('Need at least 2 points');
            return;
        }

        let newElement;

        switch (drawMode) {
            case 'drainage':
                newElement = {
                    type: 'channel',
                    id: `drain_${Date.now()}`,
                    start: drawPoints[0],
                    end: drawPoints[drawPoints.length - 1],
                    width: 0.3,
                    startInvert: siteData.plinthLevel - 0.2,
                    endInvert: siteData.plinthLevel - 0.4
                };
                setInfrastructure({
                    ...infrastructure,
                    drainage: [...infrastructure.drainage, newElement]
                });
                break;

            case 'road':
                newElement = {
                    id: `road_${Date.now()}`,
                    centerline: drawPoints.map(p => ({ x: p.x, z: p.z, y: siteData.plinthLevel })),
                    width: 7.0,
                    surfaceType: 'asphalt',
                    camber: 2.5
                };
                setInfrastructure({
                    ...infrastructure,
                    roads: [...infrastructure.roads, newElement]
                });
                break;

            case 'grass':
                newElement = {
                    id: `grass_${Date.now()}`,
                    boundary: drawPoints
                };
                setInfrastructure({
                    ...infrastructure,
                    grassAreas: [...infrastructure.grassAreas, newElement]
                });
                break;
        }

        setDrawPoints([]);
        setDrawMode(null);
    };

    const cancelDrawing = () => {
        setDrawPoints([]);
        setDrawMode(null);
    };

    // Add quick elements
    const addCatchPit = () => {
        const newPit = {
            type: 'catchpit',
            id: `pit_${Date.now()}`,
            position: { x: 10, z: -10, y: siteData.plinthLevel },
            size: 0.6,
            depth: 0.9
        };
        setInfrastructure({
            ...infrastructure,
            drainage: [...infrastructure.drainage, newPit]
        });
    };

    const addParking = () => {
        const newParking = {
            id: `parking_${Date.now()}`,
            origin: { x: 5, z: 5 },
            rows: 2,
            baysPerRow: 8,
            layout: 'perpendicular'
        };
        setInfrastructure({
            ...infrastructure,
            parking: [...infrastructure.parking, newParking]
        });
    };

    const addTree = () => {
        const newTree = {
            id: `tree_${Date.now()}`,
            position: { x: -20, z: 15, y: siteData.plinthLevel },
            species: 'medium',
            canopyRadius: 2.5,
            rootRadius: 3.75
        };
        setInfrastructure({
            ...infrastructure,
            trees: [...infrastructure.trees, newTree]
        });
    };

    // Validation
    const validateSite = () => {
        const errors = [];
        const warnings = [];

        // Check drainage slopes
        infrastructure.drainage.forEach(drain => {
            if (drain.type === 'channel') {
                const dx = drain.end.x - drain.start.x;
                const dz = drain.end.z - drain.start.z;
                const length = Math.sqrt(dx * dx + dz * dz);
                const drop = drain.startInvert - drain.endInvert;
                const slope = (drop / length) * 100;

                if (slope < 0.5) {
                    errors.push(`${drain.id}: Slope ${slope.toFixed(2)}% below minimum 0.5%`);
                }
                if (drop <= 0) {
                    errors.push(`${drain.id}: No gravity flow - outlet higher than inlet`);
                }
            }
        });

        // Check road camber
        infrastructure.roads.forEach(road => {
            if (road.camber < 1.5) {
                warnings.push(`${road.id}: Camber ${road.camber}% below recommended 2.5%`);
            }
        });

        // Check tree clearances
        const buildingCenter = { x: 0, z: 0 };
        infrastructure.trees.forEach(tree => {
            const distToBuilding = Math.sqrt(
                Math.pow(tree.position.x - buildingCenter.x, 2) +
                Math.pow(tree.position.z - buildingCenter.z, 2)
            );
            if (distToBuilding < 3.0 + siteData.buildingSize.width / 2) {
                errors.push(`${tree.id}: Too close to building (${distToBuilding.toFixed(1)}m)`);
            }
        });

        setValidationResults({
            valid: errors.length === 0,
            errors,
            warnings
        });
    };

    // Generate report
    const generateReport = () => {
        validateSite();

        const report = {
            site: siteData,
            infrastructure: {
                drainage_count: infrastructure.drainage.length,
                roads_count: infrastructure.roads.length,
                parking_capacity: infrastructure.parking.reduce((sum, p) => sum + (p.rows * p.baysPerRow * 2), 0),
                trees_count: infrastructure.trees.length,
                grass_areas: infrastructure.grassAreas.length
            },
            validation: validationResults
        };

        console.log('Engineering Report:', report);

        // Download JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${siteData.name.replace(/\s+/g, '_')}_report.json`;
        a.click();
    };

    return (
        <div className="w-full h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Layers className="w-7 h-7" />
                            Civil Engineering External Works Designer
                        </h1>
                        <p className="text-emerald-100 text-sm mt-1">Constructible, drainage-correct site infrastructure</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={validateSite}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <AlertCircle className="w-4 h-4" />
                            Validate
                        </button>
                        <button
                            onClick={generateReport}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Tools */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 border-b border-slate-200">
                        <h2 className="font-bold text-lg mb-3">Site Information</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
                                <input
                                    type="text"
                                    value={siteData.name}
                                    onChange={(e) => setSiteData({ ...siteData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Width (m)</label>
                                    <input
                                        type="number"
                                        value={siteData.bounds.width}
                                        onChange={(e) => setSiteData({ ...siteData, bounds: { ...siteData.bounds, width: Number(e.target.value) } })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Depth (m)</label>
                                    <input
                                        type="number"
                                        value={siteData.bounds.depth}
                                        onChange={(e) => setSiteData({ ...siteData, bounds: { ...siteData.bounds, depth: Number(e.target.value) } })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Plinth Level (m)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={siteData.plinthLevel}
                                    onChange={(e) => setSiteData({ ...siteData, plinthLevel: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-b border-slate-200">
                        <h2 className="font-bold text-lg mb-3">Draw Tools</h2>
                        <div className="space-y-2">
                            <button
                                onClick={() => {
                                    setDrawMode('drainage');
                                    setDrawPoints([]);
                                }}
                                disabled={drawMode !== null}
                                className={`w-full px-4 py-3 rounded-lg font-medium flex items-center gap-3 transition-colors ${drawMode === 'drainage'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    } disabled:opacity-50`}
                            >
                                <Droplet className="w-5 h-5" />
                                Draw Drainage Channel
                            </button>

                            <button
                                onClick={() => {
                                    setDrawMode('road');
                                    setDrawPoints([]);
                                }}
                                disabled={drawMode !== null}
                                className={`w-full px-4 py-3 rounded-lg font-medium flex items-center gap-3 transition-colors ${drawMode === 'road'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    } disabled:opacity-50`}
                            >
                                <Road className="w-5 h-5" />
                                Draw Road
                            </button>

                            <button
                                onClick={() => {
                                    setDrawMode('grass');
                                    setDrawPoints([]);
                                }}
                                disabled={drawMode !== null}
                                className={`w-full px-4 py-3 rounded-lg font-medium flex items-center gap-3 transition-colors ${drawMode === 'grass'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    } disabled:opacity-50`}
                            >
                                <Trees className="w-5 h-5" />
                                Draw Grass Area
                            </button>

                            {drawMode && (
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={finishDrawing}
                                        className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm"
                                    >
                                        Finish
                                    </button>
                                    <button
                                        onClick={cancelDrawing}
                                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-b border-slate-200">
                        <h2 className="font-bold text-lg mb-3">Quick Add</h2>
                        <div className="space-y-2">
                            <button
                                onClick={addCatchPit}
                                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-sm text-slate-700 flex items-center gap-2 transition-colors"
                            >
                                <Square className="w-4 h-4" />
                                Add Catch Pit
                            </button>
                            <button
                                onClick={addParking}
                                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-sm text-slate-700 flex items-center gap-2 transition-colors"
                            >
                                <Square className="w-4 h-4" />
                                Add Parking Area
                            </button>
                            <button
                                onClick={addTree}
                                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-sm text-slate-700 flex items-center gap-2 transition-colors"
                            >
                                <Trees className="w-4 h-4" />
                                Add Tree
                            </button>
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        <h2 className="font-bold text-lg mb-3">Infrastructure Summary</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between p-2 bg-blue-50 rounded">
                                <span className="text-slate-600">Drainage Elements</span>
                                <span className="font-bold text-blue-700">{infrastructure.drainage.length}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded">
                                <span className="text-slate-600">Roads</span>
                                <span className="font-bold text-slate-700">{infrastructure.roads.length}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-purple-50 rounded">
                                <span className="text-slate-600">Parking Bays</span>
                                <span className="font-bold text-purple-700">
                                    {infrastructure.parking.reduce((sum, p) => sum + (p.rows * p.baysPerRow * 2), 0)}
                                </span>
                            </div>
                            <div className="flex justify-between p-2 bg-green-50 rounded">
                                <span className="text-slate-600">Trees</span>
                                <span className="font-bold text-green-700">{infrastructure.trees.length}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-emerald-50 rounded">
                                <span className="text-slate-600">Grass Areas</span>
                                <span className="font-bold text-emerald-700">{infrastructure.grassAreas.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col bg-slate-100">
                    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                        <div className="flex gap-2">
                            <button
                                className={`px-3 py-1.5 rounded ${viewMode === '2d' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'} text-sm font-medium`}
                                onClick={() => setViewMode('2d')}
                            >
                                2D Plan
                            </button>
                            <button
                                className={`px-3 py-1.5 rounded ${viewMode === '3d' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'} text-sm font-medium opacity-50 cursor-not-allowed`}
                                disabled
                            >
                                3D View (Coming Soon)
                            </button>
                        </div>
                        {drawMode && (
                            <div className="text-sm text-slate-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                                <strong>Drawing {drawMode}:</strong> Click to add points, then click "Finish"
                            </div>
                        )}
                    </div>

                    <div className="flex-1 p-4">
                        <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            className="w-full h-full bg-white rounded-lg shadow-lg cursor-crosshair"
                        />
                    </div>
                </div>

                {/* Right Sidebar - Validation */}
                <div className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 border-b border-slate-200">
                        <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                            {validationResults.valid ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                            Validation Status
                        </h2>

                        {validationResults.valid && validationResults.errors.length === 0 && validationResults.warnings.length === 0 ? (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                All systems valid - ready for export
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {validationResults.errors.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-red-700 mb-2 text-sm">Errors ({validationResults.errors.length})</h3>
                                        <div className="space-y-1">
                                            {validationResults.errors.map((error, idx) => (
                                                <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                                                    {error}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {validationResults.warnings.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-amber-700 mb-2 text-sm">Warnings ({validationResults.warnings.length})</h3>
                                        <div className="space-y-1">
                                            {validationResults.warnings.map((warning, idx) => (
                                                <div key={idx} className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                                    {warning}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-b border-slate-200">
                        <h2 className="font-bold text-lg mb-3">Engineering Rules</h2>
                        <div className="space-y-2 text-xs">
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                <strong className="text-blue-900">Drainage:</strong>
                                <div className="text-slate-700 mt-1">Min 0.5% slope, gravity flow required</div>
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                <strong className="text-slate-900">Roads:</strong>
                                <div className="text-slate-700 mt-1">2.5% camber for drainage</div>
                            </div>
                            <div className="p-2 bg-green-50 border border-green-200 rounded">
                                <strong className="text-green-900">Trees:</strong>
                                <div className="text-slate-700 mt-1">3m from buildings, 2m from drains</div>
                            </div>
                            <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                                <strong className="text-purple-900">Parking:</strong>
                                <div className="text-slate-700 mt-1">Standard bay: 5.0m × 2.4m</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 flex-1">
                        <h2 className="font-bold text-lg mb-3">Legend</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-amber-900 rounded"></div>
                                <span>Building</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-blue-600"></div>
                                <span>Drainage Channel</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-900 border-2 border-white"></div>
                                <span>Catch Pit</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-slate-700"></div>
                                <span>Road</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-slate-400 opacity-50"></div>
                                <span>Parking</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-800 rounded-full"></div>
                                <span>Tree</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-500 opacity-50 border-2 border-green-600"></div>
                                <span>Grass Area</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExternalWorksDesigner;