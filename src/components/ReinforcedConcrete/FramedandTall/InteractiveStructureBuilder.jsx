
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Plus, Trash2, Grid3x3, Move, Copy, Layers as LayersIcon, Eye, EyeOff, Settings, Save, FolderOpen, Play,
    MousePointer, Square, Minus, RotateCw, Maximize2, Minimize2, Box, Download, Upload, Zap, TrendingUp, Grid, Home, Columns,
    Edit2, Layout, Library, Calculator, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X
} from 'lucide-react';

import { exportStructureToCAD } from './builderCADExporter';
import CadDrawingApp from '../../Drawings/cad_drawing';
import Complete3DStructureView from './Multi_storey_structure';
import StructuralVisualizationComponent from '../../Drawings/visualise_component';
import { COMPONENT_TYPES } from '../../Drawings/componentRegistry';
import { BuildingLibraryBrowser, LoadAssignmentPanel } from './Building_library';

import { StructuralGrid, StructuralElement } from './StructuralClasses';
import { StructuralCanvas } from './StructuralCanvas';
import { Toolbar, PropertiesPanel, LayerControlPanel } from './StructuralUIComponents';

// ============================================================================
// MAIN APPLICATION
// ============================================================================

const InteractiveStructureBuilder = ({
    isFullScreen: propFullScreen,
    onFullScreenChange
}) => {
    // Override local isFullScreen if props are provided
    const [localFullScreen, setLocalFullScreen] = useState(false);
    const isFullScreen = propFullScreen !== undefined ? propFullScreen : localFullScreen;
    const setIsFullScreen = onFullScreenChange || setLocalFullScreen;

    const [elements, setElements] = useState([]);
    const [selectedElement, setSelectedElement] = useState(null);
    const [tool, setTool] = useState('select');
    const [showGrid, setShowGrid] = useState(true);
    const [showDiagrams, setShowDiagrams] = useState({ moment: false, shear: false });
    const [showForces, setShowForces] = useState(false);
    const [slabOpacity, setSlabOpacity] = useState(0.4);
    const [beamOpacity, setBeamOpacity] = useState(1.0);
    const [groundOpacity, setGroundOpacity] = useState(1.0);
    const [scale, setScale] = useState(25);
    const [layers, setLayers] = useState({
        'Floor 1': { visible: true, elements: [] },
        'Floor 2': { visible: true, elements: [] },
        'Floor 3': { visible: true, elements: [] }
    });
    const [activeLayer, setActiveLayer] = useState('Floor 1');
    const [view, setView] = useState('2d'); // '2d', '3d', or 'cad'

    // Grid State
    const [grid, setGrid] = useState(new StructuralGrid(5));

    const handleGridUpdate = useCallback((newGrid) => {
        // Create a new instance with the same properties to trigger re-render
        // Assuming newGrid is the modified instance from StructuralCanvas, we just need to force update if mutation happened
        // Or better, clone it:
        const updatedGrid = new StructuralGrid(newGrid.spacing);
        updatedGrid.xLines = [...newGrid.xLines];
        updatedGrid.yLines = [...newGrid.yLines];
        updatedGrid.idCounter = newGrid.idCounter;
        setGrid(updatedGrid);
    }, []);

    const handleAutoAlignGrid = useCallback((customElements = null) => {
        const targetElements = customElements || elements;
        const newGrid = new StructuralGrid(grid.spacing);
        newGrid.autoAlign(targetElements);
        setGrid(newGrid);

        // Auto-name columns based on new grid
        setElements(prev => prev.map(el => {
            if (el.type === 'column') {
                const newLabel = newGrid.getClosestIntersectionLabel(el.position.x, el.position.y);
                if (newLabel) {
                    return { ...el, id: newLabel };
                }
            }
            return el;
        }));
    }, [elements, grid.spacing]);

    // Override setTool to ensure we are in 2D mode when drawing
    const handleToolChange = (newTool) => {
        if (newTool !== 'select' && (view === '3d' || view === 'cad')) {
            setView('2d');
        }
        setTool(newTool);
    };

    const [showPropertiesPanel, setShowPropertiesPanel] = useState(true);
    const [showLibrary, setShowLibrary] = useState(false);
    // isFullScreen is now handled via props or local state above
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [collapsedSections, setCollapsedSections] = useState({
        layers: false,
        display: false
    });

    // Layer Visibility State
    const [layerVisibility, setLayerVisibility] = useState({
        gridLines: true,
        columns: true,
        beams: true,
        slabs: true,
        walls: true,
        voids: true,
        labels: true,
        dimensions: true
    });

    const toggleLayer = (layerName) => {
        setLayerVisibility(prev => ({
            ...prev,
            [layerName]: !prev[layerName]
        }));
    };

    const handleElementClick = useCallback((element) => {
        if (tool !== 'select') return;

        setElements(prev => prev.map(el => ({
            ...el,
            selected: el.id === element?.id
        })));
        setSelectedElement(element);
    }, [tool]);

    const handleElementsAdd = useCallback((newElements) => {
        setElements(prev => {
            const updated = [...prev, ...newElements];
            // Trigger grid update after adding elements
            setTimeout(() => handleAutoAlignGrid(updated), 0);
            return updated;
        });
        setTool('select');
    }, [handleAutoAlignGrid]);

    const handleElementDragEnd = useCallback((elementId, newPosition) => {
        setElements(prev => {
            const updated = prev.map(el => {
                if (el.id === elementId) {
                    return {
                        ...el,
                        position: newPosition
                    };
                }
                return el;
            });
            // Re-align grid after drag
            setTimeout(() => handleAutoAlignGrid(updated), 0);
            return updated;
        });
    }, [handleAutoAlignGrid]);

    const handlePropertyChange = useCallback((property, value) => {
        if (!selectedElement) return;

        // If changing ID, we need to update the element's ID directly, not in properties
        if (property === 'id') {
            setElements(prev => prev.map(el => {
                if (el.id === selectedElement.id) {
                    return { ...el, id: value };
                }
                return el;
            }));
            setSelectedElement(prev => ({ ...prev, id: value }));
            return;
        }

        setElements(prev => prev.map(el => {
            if (el.id === selectedElement.id) {
                return {
                    ...el,
                    properties: {
                        ...el.properties,
                        [property]: value
                    }
                };
            }
            return el;
        }));

        setSelectedElement(prev => ({
            ...prev,
            properties: {
                ...prev.properties,
                [property]: value
            }
        }));
    }, [selectedElement]);

    const handleSelectTemplate = useCallback((template) => {
        const { bay_config, floors } = template;
        const { x_bays, y_bays, x_spacing, y_spacing, floor_height } = bay_config;

        const newElements = [];
        const newLayers = {};

        // Create layers
        for (let i = 1; i <= floors; i++) {
            newLayers[`Floor ${i}`] = { visible: true, elements: [] };
        }

        // Generate elements for each floor
        for (let f = 1; f <= floors; f++) {
            const z = (f - 1) * floor_height;
            const floorName = `Floor ${f}`;

            // Columns
            for (let i = 0; i <= x_bays; i++) {
                for (let j = 0; j <= y_bays; j++) {
                    const x = i * x_spacing;
                    const y = j * y_spacing;
                    newElements.push(new StructuralElement(
                        'column',
                        `${String.fromCharCode(65 + j)}${i + 1}-F${f}`,
                        { x, y, z },
                        { width: 0.45, depth: 0.45, height: floor_height, layer: floorName }
                    ));
                }
            }

            // Beams (Horizontal - along X)
            for (let j = 0; j <= y_bays; j++) {
                for (let i = 0; i < x_bays; i++) {
                    newElements.push(new StructuralElement(
                        'beam',
                        `B-X-F${f}-${i}-${j}`,
                        {
                            start: { x: i * x_spacing, y: j * y_spacing, z: z + floor_height },
                            end: { x: (i + 1) * x_spacing, y: j * y_spacing, z: z + floor_height }
                        },
                        { layer: floorName }
                    ));
                }
            }

            // Beams (Vertical - along Y)
            for (let i = 0; i <= x_bays; i++) {
                for (let j = 0; j < y_bays; j++) {
                    newElements.push(new StructuralElement(
                        'beam',
                        `B-Y-F${f}-${i}-${j}`,
                        {
                            start: { x: i * x_spacing, y: j * y_spacing, z: z + floor_height },
                            end: { x: i * x_spacing, y: (j + 1) * y_spacing, z: z + floor_height }
                        },
                        { layer: floorName }
                    ));
                }
            }

            // Slabs
            for (let i = 0; i < x_bays; i++) {
                for (let j = 0; j < y_bays; j++) {
                    newElements.push(new StructuralElement(
                        'slab',
                        `S-F${f}-${i}-${j}`,
                        {
                            x: i * x_spacing,
                            y: j * y_spacing,
                            z: z + floor_height
                        },
                        {
                            width: x_spacing,
                            depth: y_spacing,
                            thickness: 0.2,
                            layer: floorName
                        }
                    ));
                }
            }
        }

        setElements(newElements);
        setLayers(newLayers);
        setActiveLayer(Object.keys(newLayers)[0]);
        setShowLibrary(false);

        // Auto-align grid to the new template
        setTimeout(() => handleAutoAlignGrid(newElements), 0);
    }, [handleAutoAlignGrid]);

    const handleAction = useCallback((action) => {
        switch (action) {
            case 'delete':
                setElements(prev => prev.filter(el => !el.selected));
                setSelectedElement(null);
                break;

            case 'copy':
                const selected = elements.find(el => el.selected);
                if (selected) {
                    const copy = new StructuralElement(
                        selected.type,
                        `${selected.type[0].toUpperCase()}${elements.length + 1}`,
                        selected.type === 'beam'
                            ? {
                                start: { x: selected.position.start.x + 2, y: selected.position.start.y + 2 },
                                end: { x: selected.position.end.x + 2, y: selected.position.end.y + 2 }
                            }
                            : { x: selected.position.x + 2, y: selected.position.y + 2, z: selected.position.z || 0 },
                        { ...selected.properties }
                    );
                    handleElementsAdd([copy]);
                }
                break;

            case 'analyze':
                runAnalysis();
                break;

            case 'library':
                setShowLibrary(true);
                break;

            case 'cad_view':
                setView('cad');
                break;

            case 'add_bay':
                handleGenerateBay();
                break;

            default:
                break;
        }
    }, [elements, handleElementsAdd]);

    const generateNodesFromElements = (elements) => {
        const nodes = [];
        const nodeMap = new Map();

        const getOrAddNode = (x, y, z) => {
            const key = `${Number(x).toFixed(3)},${Number(y).toFixed(3)},${Number(z).toFixed(3)}`;
            if (nodeMap.has(key)) return nodeMap.get(key);

            const nodeId = nodes.length + 1;
            nodes.push({ id: nodeId, x, y, z });
            nodeMap.set(key, nodeId);
            return nodeId;
        };

        elements.forEach(el => {
            if (el.type === 'column') {
                getOrAddNode(el.position.x, el.position.y, el.position.z || 0);
                getOrAddNode(el.position.x, el.position.y, (el.position.z || 0) + el.properties.height);
            } else if (el.type === 'beam') {
                getOrAddNode(el.position.start.x, el.position.start.y, el.position.start.z || 0);
                getOrAddNode(el.position.end.x, el.position.end.y, el.position.end.z || 0);
            }
        });

        return { nodes, nodeMap };
    };

    const generateMembersFromElements = (elements, nodeMap) => {
        const members = [];
        elements.forEach((el) => {
            if (el.type === 'column') {
                const n1 = nodeMap.get(`${Number(el.position.x).toFixed(3)},${Number(el.position.y).toFixed(3)},${(Number(el.position.z) || 0).toFixed(3)}`);
                const n2 = nodeMap.get(`${Number(el.position.x).toFixed(3)},${Number(el.position.y).toFixed(3)},${((Number(el.position.z) || 0) + Number(el.properties.height)).toFixed(3)}`);
                members.push({
                    id: el.id,
                    type: 'column',
                    node1: n1,
                    node2: n2,
                    properties: el.properties
                });
            } else if (el.type === 'beam') {
                const n1 = nodeMap.get(`${Number(el.position.start.x).toFixed(3)},${Number(el.position.start.y).toFixed(3)},${(Number(el.position.start.z) || 0).toFixed(3)}`);
                const n2 = nodeMap.get(`${Number(el.position.end.x).toFixed(3)},${Number(el.position.end.y).toFixed(3)},${(Number(el.position.end.z) || 0).toFixed(3)}`);
                members.push({
                    id: el.id,
                    type: 'beam',
                    node1: n1,
                    node2: n2,
                    properties: el.properties
                });
            }
        });
        return members;
    };

    const runAnalysis = useCallback(async () => {
        console.log('Preparing structural data for analysis...');
        const { nodes, nodeMap } = generateNodesFromElements(elements);
        const members = generateMembersFromElements(elements, nodeMap);

        const structuralData = {
            nodes,
            members,
            loads: elements.flatMap(el => el.loads || [])
        };

        console.log('Structural Data Prepared:', structuralData);

        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Add mock results
        setElements(prev => prev.map(el => ({
            ...el,
            analysisResults: {
                N: Math.random() * 1000 - 500,
                M: Math.random() * 200,
                V: Math.random() * 100,
                utilization: Math.random() * 1.2,
                sections: Array.from({ length: 21 }, (_, i) => ({
                    ratio: i / 20,
                    Mz: Math.sin(i / 10 * Math.PI) * 100,
                    Vy: Math.cos(i / 10 * Math.PI) * 50,
                    N: -300
                }))
            }
        })));

        setShowDiagrams({ moment: true, shear: false });
        setShowForces(true);
    }, []);

    const handleSave = useCallback(() => {
        const data = {
            elements: elements.map(el => ({
                type: el.type,
                id: el.id,
                position: el.position,
                properties: el.properties,
                layer: el.layer
            })),
            layers,
            metadata: {
                created: new Date().toISOString(),
                version: '1.0'
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `structure_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [elements, layers]);

    const handleLoad = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const loadedElements = data.elements.map(el =>
                    new StructuralElement(el.type, el.id, el.position, el.properties)
                );
                setElements(loadedElements);
                if (data.layers) setLayers(data.layers);
            } catch (error) {
                alert('Error loading file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }, []);

    const handleGenerateBay = useCallback(() => {
        // Generate a standard bay with columns at corners
        const bayWidth = 6;
        const bayDepth = 6;

        // Find the maximum X coordinate of existing elements to place the new bay beside it
        let maxX = 0;
        if (elements.length > 0) {
            elements.forEach(el => {
                let elMaxX = 0;
                if (el.type === 'column' || el.type === 'slab') {
                    elMaxX = el.position.x + (el.properties.width || 0);
                } else if (el.type === 'beam') {
                    elMaxX = Math.max(el.position.start.x, el.position.end.x);
                }
                if (elMaxX > maxX) maxX = elMaxX;
            });
        }

        const spacing = elements.length > 0 ? 1 : 0; // 1m gap if there are existing elements
        const baseX = elements.length > 0 ? Math.ceil(maxX) + spacing : 5;
        const baseY = 5;

        const newElements = [];

        // Four columns
        const columnPositions = [
            { x: baseX, y: baseY },
            { x: baseX + bayWidth, y: baseY },
            { x: baseX, y: baseY + bayDepth },
            { x: baseX + bayWidth, y: baseY + bayDepth }
        ];

        const beamConnections = [
            [0, 1], [1, 3], [3, 2], [2, 0]
        ];

        // Generate elements for EACH layer (floor)
        Object.keys(layers).forEach((layerName, floorIdx) => {
            const z = floorIdx * 3.5;
            const floorNum = floorIdx + 1;

            // Four columns
            columnPositions.forEach((pos, i) => {
                newElements.push(new StructuralElement(
                    'column',
                    `C-F${floorNum}-${elements.length + i + 1}`,
                    { ...pos, z },
                    { layer: layerName }
                ));
            });

            // Four beams connecting columns
            beamConnections.forEach(([startIdx, endIdx], i) => {
                newElements.push(new StructuralElement(
                    'beam',
                    `B-F${floorNum}-${elements.length + columnPositions.length + i + 1}`,
                    {
                        start: { ...columnPositions[startIdx], z: z + 3.5 },
                        end: { ...columnPositions[endIdx], z: z + 3.5 }
                    },
                    { layer: layerName }
                ));
            });

            // Slab for this floor
            newElements.push(new StructuralElement(
                'slab',
                `S-F${floorNum}-${elements.length + columnPositions.length + beamConnections.length + 1}`,
                { x: baseX, y: baseY, z: z + 3.5 },
                { width: bayWidth, depth: bayDepth, thickness: 0.2, layer: layerName }
            ));
        });

        handleElementsAdd(newElements);
    }, [elements, handleElementsAdd]);

    return (
        <div style={{
            width: isFullScreen ? '100vw' : '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fff',
            borderRadius: isFullScreen ? '0' : '8px',
            boxShadow: isFullScreen ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
            border: isFullScreen ? 'none' : '1px solid #ddd',
            position: isFullScreen ? 'fixed' : 'relative',
            top: isFullScreen ? '96px' : 'auto',
            left: isFullScreen ? 0 : 'auto',
            height: isFullScreen ? 'calc(100vh - 96px)' : '800px',
            zIndex: isFullScreen ? 40 : 1
        }}>

            {/* Toolbar */}
            <Toolbar
                tool={tool}
                onToolChange={handleToolChange}
                onAction={handleAction}
                disabled={false}
                view={view}
                onViewChange={setView}
                isFullScreen={isFullScreen}
                onFullScreenChange={setIsFullScreen}
                isSidebarVisible={isSidebarVisible}
                onSidebarToggle={() => setIsSidebarVisible(!isSidebarVisible)}
                onSave={handleSave}
                onLoad={handleLoad}
            />

            {/* Main content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left sidebar - Layers */}
                {isSidebarVisible && (
                    <div style={{
                        width: '250px',
                        background: '#fff',
                        borderRight: '1px solid #ddd',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div
                            onClick={() => setCollapsedSections(prev => ({ ...prev, layers: !prev.layers }))}
                            style={{
                                padding: '16px',
                                borderBottom: '1px solid #ddd',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#f5f5f5',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LayersIcon size={18} />
                                Layers & Floors
                            </div>
                            {collapsedSections.layers ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </div>


                        {!collapsedSections.layers && (
                            <>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                                    {Object.keys(layers).map(layerName => (
                                        <div
                                            key={layerName}
                                            style={{
                                                padding: '12px',
                                                background: activeLayer === layerName ? '#e3f2fd' : '#fff',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                marginBottom: '8px',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setActiveLayer(layerName)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{
                                                    fontSize: '13px',
                                                    fontWeight: activeLayer === layerName ? 'bold' : 'normal'
                                                }}>
                                                    {layerName}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setLayers(prev => ({
                                                            ...prev,
                                                            [layerName]: {
                                                                ...prev[layerName],
                                                                visible: !prev[layerName].visible
                                                            }
                                                        }));
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px'
                                                    }}
                                                >
                                                    {layers[layerName].visible ?
                                                        <Eye size={16} color="#4CAF50" /> :
                                                        <EyeOff size={16} color="#999" />
                                                    }
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                                {elements.filter(el => el.layer === layerName).length} elements
                                            </div>
                                        </div>
                                    ))}

                                    <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
                                </div>

                                <button
                                    onClick={() => {
                                        const newLayerName = `Floor ${Object.keys(layers).length + 1}`;
                                        setLayers(prev => ({
                                            ...prev,
                                            [newLayerName]: { visible: true, elements: [] }
                                        }));
                                        setActiveLayer(newLayerName);
                                    }}
                                    style={{
                                        margin: '0 12px 12px 12px',
                                        padding: '10px',
                                        background: '#f5f5f5',
                                        border: '1px dashed #ddd',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        fontSize: '13px',
                                        color: '#666'
                                    }}
                                >
                                    <Plus size={16} />
                                    Add Floor
                                </button>
                            </>
                        )}


                        {/* Display options */}
                        <div
                            onClick={() => setCollapsedSections(prev => ({ ...prev, display: !prev.display }))}
                            style={{
                                padding: '16px',
                                borderTop: '1px solid #ddd',
                                background: '#f9f9f9',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                color: '#666',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer'
                            }}
                        >
                            DISPLAY OPTIONS
                            {collapsedSections.display ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </div>

                        {!collapsedSections.display && (
                            <div style={{
                                padding: '16px',
                                background: '#f9f9f9',
                                borderTop: '1px solid #eee'
                            }}>
                                {/* Layers Visibility Panel */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '8px',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setCollapsedSections(prev => ({ ...prev, visibility: !prev.visibility }))}
                                    >
                                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <LayersIcon size={16} /> Visibility Layers
                                        </h4>
                                        {collapsedSections.visibility ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                    </div>

                                    {!collapsedSections.visibility && (
                                        <LayerControlPanel layers={layerVisibility} onToggleLayer={toggleLayer} />
                                    )}
                                </div>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                    marginBottom: '8px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={showGrid}
                                        onChange={(e) => setShowGrid(e.target.checked)}
                                    />
                                    Show Grid
                                </label>

                                <button
                                    onClick={handleAutoAlignGrid}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        background: '#2196F3',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        marginBottom: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Grid3x3 size={14} />
                                    Auto-Align Grid to Columns
                                </button>



                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                    marginBottom: '8px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={showDiagrams.moment}
                                        onChange={(e) => setShowDiagrams(prev => ({ ...prev, moment: e.target.checked }))}
                                    />
                                    Show BM Diagrams
                                </label>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                    marginBottom: '8px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={showDiagrams.shear}
                                        onChange={(e) => setShowDiagrams(prev => ({ ...prev, shear: e.target.checked }))}
                                    />
                                    Show SF Diagrams
                                </label>

                                <div style={{ height: '1px', background: '#eee', margin: '12px 0' }} />

                                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
                                    VISIBILITY CONTROLS
                                </div>

                                <button
                                    onClick={() => setShowGrid(!showGrid)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        width: '100%',
                                        background: showGrid ? '#E3F2FD' : '#f5f5f5',
                                        border: `1px solid ${showGrid ? '#2196F3' : '#ddd'}`,
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        color: showGrid ? '#2196F3' : '#666'
                                    }}
                                >
                                    {showGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                                    {showGrid ? 'Grid Visible' : 'Grid Hidden'}
                                </button>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={showForces}
                                        onChange={(e) => setShowForces(e.target.checked)}
                                    />
                                    Show Forces
                                </label>

                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                        Scale: {scale}x
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="50"
                                        value={scale}
                                        onChange={(e) => setScale(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                        Beam Opacity: {(beamOpacity * 100).toFixed(0)}%
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={beamOpacity}
                                        onChange={(e) => setBeamOpacity(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                        Slab Opacity: {(slabOpacity * 100).toFixed(0)}%
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={slabOpacity}
                                        onChange={(e) => setSlabOpacity(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                        Ground Opacity: {(groundOpacity * 100).toFixed(0)}%
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={groundOpacity}
                                        onChange={(e) => setGroundOpacity(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Canvas */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    {view === '2d' ? (
                        <StructuralCanvas
                            elements={elements}
                            onElementClick={handleElementClick}
                            onElementDragEnd={handleElementDragEnd}
                            onElementsAdd={handleElementsAdd}
                            tool={tool}
                            showGrid={showGrid}
                            showDiagrams={showDiagrams}
                            showForces={showForces}
                            scale={scale}
                            activeLayer={activeLayer}
                            layerVisibility={layerVisibility}
                            grid={grid}
                            onGridUpdate={handleGridUpdate}
                            beamOpacity={beamOpacity}
                        />
                    ) : view === 'cad' ? (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: '#fff' }}>
                            <CadDrawingApp
                                initialObjects={exportStructureToCAD(elements, grid)}
                                isFullScreen={isFullScreen}
                                onFullScreenToggle={() => setIsFullScreen(!isFullScreen)}
                            />
                        </div>
                    ) : (
                        <StructuralVisualizationComponent
                            componentType="tall_framed_analysis"
                            componentData={{
                                elements: elements,
                                floors: Object.keys(layers).length,
                                floorHeight: 3.5, // Changed from story_height to align with Complete3DStructureView props
                                selectedElement: selectedElement,
                                onElementClick: handleElementClick,
                                showForces: showForces,
                                showDiagrams: showDiagrams,
                                floorVisibility: Object.entries(layers).reduce((acc, [name, data]) => {
                                    acc[name] = data.visible;
                                    return acc;
                                }, {}),
                                componentVisibility: layerVisibility
                            }}
                            slabOpacity={slabOpacity}
                            setSlabOpacity={setSlabOpacity}
                            groundOpacity={groundOpacity}
                        />
                    )}

                    {view === '2d' && (
                        <>
                            {/* Properties Panel */}
                            {showPropertiesPanel && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    zIndex: 100
                                }}>
                                    <PropertiesPanel
                                        selectedElement={selectedElement}
                                        onPropertyChange={handlePropertyChange}
                                        onClose={() => setSelectedElement(null)}
                                    />
                                </div>
                            )}

                            {/* Library Modal */}
                            {showLibrary && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '80%',
                                    height: '80%',
                                    background: '#fff',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                    borderRadius: '8px',
                                    zIndex: 2000,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        padding: '16px',
                                        borderBottom: '1px solid #ddd',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <h3>Structure Library</h3>
                                        <button onClick={() => setShowLibrary(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <X size={24} />
                                        </button>
                                    </div>
                                    <div style={{ height: 'calc(100% - 60px)' }}>
                                        <BuildingLibraryBrowser onSelectTemplate={handleSelectTemplate} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div >
    );
};

export default InteractiveStructureBuilder;