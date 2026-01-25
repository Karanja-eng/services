import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Transformer } from 'react-konva';
import {
    Building2,
    Plus,
    Trash2,
    Grid3x3,
    Move,
    Copy,
    Layers as LayersIcon,
    Eye,
    EyeOff,
    Settings,
    Save,
    FolderOpen,
    Play,
    MousePointer,
    Square,
    Minus,
    RotateCw,
    Maximize2,
    Minimize2,
    Box,
    Download,
    Upload,
    Zap,
    TrendingUp,
    Grid,
    Home,
    Columns,
    Calculator,
    Library,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Edit2
} from 'lucide-react';

import Complete3DStructureView from './Multi_storey_structure';
import { BuildingLibraryBrowser, LoadAssignmentPanel } from './Building_library';

// ============================================================================
// STRUCTURAL ELEMENT CLASSES
// ============================================================================

class StructuralGrid {
    constructor(spacing = 5) {
        this.spacing = spacing;
        this.lines = {
            horizontal: [],
            vertical: []
        };
    }

    generateGrid(width, height, originX = 0, originY = 0) {
        const lines = [];

        // Vertical grid lines
        for (let x = originX; x <= width; x += this.spacing) {
            lines.push({
                id: `v-${x}`,
                x1: x,
                y1: originY,
                x2: x,
                y2: height,
                type: 'vertical',
                label: String.fromCharCode(65 + Math.floor(x / this.spacing))
            });
        }

        // Horizontal grid lines
        for (let y = originY; y <= height; y += this.spacing) {
            lines.push({
                id: `h-${y}`,
                x1: originX,
                y1: y,
                x2: width,
                y2: y,
                type: 'horizontal',
                label: String(Math.floor(y / this.spacing) + 1)
            });
        }

        return lines;
    }

    getGridIntersections(width, height) {
        const intersections = [];
        const cols = Math.floor(width / this.spacing) + 1;
        const rows = Math.floor(height / this.spacing) + 1;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                intersections.push({
                    id: `grid-${i}-${j}`,
                    x: i * this.spacing,
                    y: j * this.spacing,
                    gridX: i,
                    gridY: j,
                    label: `${String.fromCharCode(65 + i)}${j + 1}`
                });
            }
        }

        return intersections;
    }
}

class StructuralElement {
    constructor(type, id, position, properties = {}) {
        this.type = type; // 'column', 'beam', 'slab', 'wall', 'foundation'
        this.id = id;
        this.position = position; // { x, y, z } or { start, end }
        this.properties = {
            width: 0.45,    // default 450mm
            depth: 0.45,    // default 450mm
            height: 3.5,    // default 3.5m
            thickness: 0.2, // default 200mm
            material: 'C30',
            ...properties
        };
        this.layer = this.properties.layer || 'Floor 1';
        this.selected = false;
        this.visible = true;
        this.loads = [];
        this.reinforcement = null;
        this.analysisResults = null;
    }

    getBounds() {
        switch (this.type) {
            case 'column':
                return {
                    x: this.position.x - (this.properties.width / 2),
                    y: this.position.y - (this.properties.depth / 2),
                    width: this.properties.width,
                    height: this.properties.depth
                };

            case 'beam':
                const dx = this.position.end.x - this.position.start.x;
                const dy = this.position.end.y - this.position.start.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                return {
                    x: this.position.start.x,
                    y: this.position.start.y,
                    width: length,
                    height: this.properties.depth
                };

            case 'slab':
                return {
                    x: this.position.x,
                    y: this.position.y,
                    width: this.properties.width,
                    height: this.properties.depth
                };

            default:
                return { x: 0, y: 0, width: 0, height: 0 };
        }
    }

    containsPoint(x, y) {
        const bounds = this.getBounds();
        return (
            x >= bounds.x &&
            x <= bounds.x + bounds.width &&
            y >= bounds.y &&
            y <= bounds.y + bounds.height
        );
    }
}

// ============================================================================
// KONVA COMPONENTS FOR STRUCTURAL ELEMENTS
// ============================================================================

const GridComponent = ({ grid, visible, scale }) => {
    if (!visible) return null;

    const gridLines = grid.generateGrid(100, 100);

    return (
        <Group>
            {gridLines.map(line => (
                <Group key={line.id}>
                    <Line
                        points={[line.x1 * scale, line.y1 * scale, line.x2 * scale, line.y2 * scale]}
                        stroke="#ddd"
                        strokeWidth={0.5}
                        dash={[5, 5]}
                    />
                    {line.type === 'vertical' && line.y1 === 0 && (
                        <Text
                            x={line.x1 * scale - 10}
                            y={-20}
                            text={line.label}
                            fontSize={12}
                            fill="#666"
                        />
                    )}
                    {line.type === 'horizontal' && line.x1 === 0 && (
                        <Text
                            x={-25}
                            y={line.y1 * scale - 8}
                            text={line.label}
                            fontSize={12}
                            fill="#666"
                        />
                    )}
                </Group>
            ))}
        </Group>
    );
};

const ColumnComponent = ({ element, scale, onClick, onDragEnd, showForces }) => {
    const shapeRef = useRef();
    const trRef = useRef();
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (element.selected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [element.selected]);

    const width = element.properties.width / 1000 * scale; // Convert mm to m, then scale
    const depth = element.properties.depth / 1000 * scale;

    let fillColor = '#888';
    if (element.selected) fillColor = '#4CAF50';
    else if (isDragging) fillColor = '#2196F3';

    // Show axial force color if analysis results available
    if (showForces && element.analysisResults) {
        const axial = element.analysisResults.N || 0;
        if (axial > 0) fillColor = '#ff6b6b'; // Tension
        else if (axial < 0) fillColor = '#4ecdc4'; // Compression
    }

    return (
        <Group>
            <Rect
                ref={shapeRef}
                x={element.position.x * scale - width / 2}
                y={element.position.y * scale - depth / 2}
                width={width}
                height={depth}
                fill={fillColor}
                stroke="#333"
                strokeWidth={2}
                draggable
                onClick={() => onClick(element)}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={(e) => {
                    setIsDragging(false);
                    onDragEnd(element.id, {
                        x: e.target.x() / scale + width / (2 * scale),
                        y: e.target.y() / scale + depth / (2 * scale)
                    });
                }}
                shadowBlur={element.selected ? 10 : 0}
                shadowColor="#4CAF50"
            />

            {/* Column label */}
            <Text
                x={element.position.x * scale - 15}
                y={element.position.y * scale - 8}
                text={element.id}
                fontSize={10}
                fill="#fff"
                fontStyle="bold"
                listening={false}
            />

            {/* Analysis results overlay */}
            {showForces && element.analysisResults && (
                <Text
                    x={element.position.x * scale + width / 2 + 5}
                    y={element.position.y * scale - depth / 2}
                    text={`N=${element.analysisResults.N?.toFixed(0)}kN\nM=${element.analysisResults.M?.toFixed(0)}kNm`}
                    fontSize={9}
                    fill="#000"
                    listening={false}
                />
            )}

            {element.selected && <Transformer ref={trRef} />}
        </Group>
    );
};

const BeamComponent = ({ element, scale, onClick, onDragEnd, showDiagrams }) => {
    const { start, end } = element.position;
    const depth = element.properties.depth / 1000 * scale;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    let strokeColor = element.selected ? '#4CAF50' : '#666';

    // BM diagram overlay
    const bmPoints = [];
    if (showDiagrams.moment && element.analysisResults?.sections) {
        const sections = element.analysisResults.sections;
        sections.forEach(section => {
            const t = section.ratio;
            const x = start.x + t * dx;
            const y = start.y + t * dy;
            const offset = (section.Mz || 0) * 0.02; // Scale factor

            // Perpendicular offset
            const perpX = -Math.sin(angle * Math.PI / 180) * offset;
            const perpY = Math.cos(angle * Math.PI / 180) * offset;

            bmPoints.push(x * scale + perpX, y * scale + perpY);
        });
    }

    return (
        <Group>
            {/* Main beam line */}
            <Line
                points={[start.x * scale, start.y * scale, end.x * scale, end.y * scale]}
                stroke={strokeColor}
                strokeWidth={depth}
                lineCap="round"
                onClick={() => onClick(element)}
                draggable
                onDragEnd={(e) => {
                    const deltaX = e.target.x() / scale;
                    const deltaY = e.target.y() / scale;
                    onDragEnd(element.id, {
                        start: { x: start.x + deltaX, y: start.y + deltaY },
                        end: { x: end.x + deltaX, y: end.y + deltaY }
                    });
                    e.target.position({ x: 0, y: 0 });
                }}
            />

            {/* BM diagram */}
            {bmPoints.length > 0 && (
                <Line
                    points={[start.x * scale, start.y * scale, ...bmPoints, end.x * scale, end.y * scale]}
                    stroke="#ff0000"
                    strokeWidth={2}
                    fill="#ff000033"
                    closed
                    listening={false}
                />
            )}

            {/* Beam label */}
            <Text
                x={(start.x + end.x) / 2 * scale}
                y={(start.y + end.y) / 2 * scale - 10}
                text={element.id}
                fontSize={10}
                fill="#333"
                listening={false}
            />
        </Group>
    );
};

const SlabComponent = ({ element, scale, onClick, opacity = 0.3 }) => {
    const bounds = element.getBounds();

    return (
        <Rect
            x={bounds.x * scale}
            y={bounds.y * scale}
            width={element.properties.width * scale}
            height={element.properties.depth * scale}
            fill={element.selected ? '#4CAF5066' : '#88888844'}
            stroke="#333"
            strokeWidth={1}
            onClick={() => onClick(element)}
            opacity={opacity}
        />
    );
};

// ============================================================================
// MAIN CANVAS COMPONENT
// ============================================================================

const StructuralCanvas = ({
    elements,
    onElementClick,
    onElementDragEnd,
    onElementsAdd,
    tool,
    showGrid,
    showDiagrams,
    showForces,
    scale,
    activeLayer
}) => {
    const stageRef = useRef();
    const [drawing, setDrawing] = useState(null);
    const [tempLine, setTempLine] = useState(null);
    const [grid] = useState(new StructuralGrid(5));

    const handleStageClick = (e) => {
        if (e.target === e.target.getStage()) {
            onElementClick(null); // Deselect all
        }
    };

    const handleStageMouseDown = (e) => {
        if (tool === 'select' || tool === null) return;

        const pos = e.target.getStage().getPointerPosition();
        const x = pos.x / scale;
        const y = pos.y / scale;

        if (tool === 'column') {
            const newColumn = new StructuralElement(
                'column',
                `C${elements.length + 1}`,
                { x, y, z: 0 },
                { layer: activeLayer || 'Floor 1' }
            );
            onElementsAdd([newColumn]);
        } else if (tool === 'beam') {
            setDrawing({ start: { x, y } });
        } else if (tool === 'slab') {
            setDrawing({ start: { x, y } });
        }
    };

    const handleStageMouseMove = (e) => {
        if (!drawing) return;

        const pos = e.target.getStage().getPointerPosition();
        const x = pos.x / scale;
        const y = pos.y / scale;

        if (tool === 'beam') {
            setTempLine({ start: drawing.start, end: { x, y } });
        } else if (tool === 'slab') {
            setTempLine({
                x: Math.min(drawing.start.x, x),
                y: Math.min(drawing.start.y, y),
                width: Math.abs(x - drawing.start.x),
                height: Math.abs(y - drawing.start.y)
            });
        }
    };

    const handleStageMouseUp = (e) => {
        if (!drawing) return;

        const pos = e.target.getStage().getPointerPosition();
        const x = pos.x / scale;
        const y = pos.y / scale;

        if (tool === 'beam') {
            const newBeam = new StructuralElement('beam', `B${elements.length + 1}`, {
                start: drawing.start,
                end: { x, y }
            }, {
                layer: activeLayer
            });
            onElementsAdd([newBeam]);
        } else if (tool === 'slab') {
            const newSlab = new StructuralElement('slab', `S${elements.length + 1}`, {
                x: Math.min(drawing.start.x, x),
                y: Math.min(drawing.start.y, y)
            }, {
                width: Math.abs(x - drawing.start.x),
                depth: Math.abs(y - drawing.start.y),
                layer: activeLayer
            });
            onElementsAdd([newSlab]);
        }

        setDrawing(null);
        setTempLine(null);
    };

    return (
        <Stage
            ref={stageRef}
            width={window.innerWidth - 400}
            height={window.innerHeight - 60}
            onClick={handleStageClick}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            style={{ background: '#f5f5f5' }}
        >
            <Layer>
                {/* Grid */}
                {showGrid && <GridComponent grid={grid} visible={showGrid} scale={scale} />}

                {/* Slabs (render first, behind everything) */}
                {elements.filter(el => el.type === 'slab' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <SlabComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                    />
                ))}

                {/* Beams */}
                {elements.filter(el => el.type === 'beam' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <BeamComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                        onDragEnd={onElementDragEnd}
                        showDiagrams={showDiagrams}
                    />
                ))}

                {/* Columns */}
                {elements.filter(el => el.type === 'column' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <ColumnComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                        onDragEnd={onElementDragEnd}
                        showForces={showForces}
                    />
                ))}

                {/* Temporary drawing */}
                {tempLine && tool === 'beam' && (
                    <Line
                        points={[
                            tempLine.start.x * scale,
                            tempLine.start.y * scale,
                            tempLine.end.x * scale,
                            tempLine.end.y * scale
                        ]}
                        stroke="#2196F3"
                        strokeWidth={3}
                        dash={[5, 5]}
                    />
                )}

                {tempLine && tool === 'slab' && (
                    <Rect
                        x={tempLine.x * scale}
                        y={tempLine.y * scale}
                        width={tempLine.width * scale}
                        height={tempLine.height * scale}
                        stroke="#2196F3"
                        strokeWidth={2}
                        dash={[5, 5]}
                        fill="#2196F333"
                    />
                )}
            </Layer>
        </Stage>
    );
};

// ============================================================================
// TOOLBAR COMPONENT
// ============================================================================

const Toolbar = ({ tool, onToolChange, onAction, disabled, view, onViewChange, isFullScreen, onFullScreenChange }) => {
    const tools = [
        { id: 'select', icon: MousePointer, label: 'Select', color: '#333' },
        { id: 'column', icon: Square, label: 'Column', color: '#2196F3' },
        { id: 'beam', icon: Minus, label: 'Beam', color: '#4CAF50' },
        { id: 'slab', icon: Grid, label: 'Slab', color: '#FF9800' },
        { id: 'wall', icon: Box, label: 'Wall', color: '#9C27B0' },
        { id: 'add_bay', icon: Plus, label: 'Add Bay', color: '#FF5722', action: true },
    ];

    return (
        <div style={{
            height: '60px',
            background: '#fff',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 10,
            position: 'relative'
        }}>
            {/* Drawing tools */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                background: '#f5f5f5',
                borderRadius: '8px'
            }}>
                {tools.map(t => (
                    <button
                        key={t.id}
                        onClick={() => t.action ? onAction(t.id) : onToolChange(t.id)}
                        disabled={disabled}
                        style={{
                            padding: '8px 16px',
                            background: tool === t.id ? t.color : '#fff',
                            color: tool === t.id ? '#fff' : '#333',
                            border: `1px solid ${tool === t.id ? t.color : '#ddd'}`,
                            borderRadius: '6px',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            opacity: disabled ? 0.5 : 1,
                            transition: 'all 0.2s',
                            boxShadow: tool === t.id ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            <div style={{ width: '1px', height: '40px', background: '#ddd' }} />

            {/* Actions */}
            <button
                onClick={() => onAction('delete')}
                disabled={disabled}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    color: '#f44336',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                <Trash2 size={16} />
                Delete
            </button>

            <button
                onClick={() => onAction('copy')}
                disabled={disabled}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                <Copy size={16} />
                Copy
            </button>

            <button
                onClick={() => onAction('library')}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px'
                }}
            >
                <Library size={16} />
                Library
            </button>

            <div style={{ flex: 1 }} />

            {/* View toggle */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                background: '#f5f5f5',
                borderRadius: '8px'
            }}>
                <button
                    onClick={() => onViewChange(view === '2d' ? '3d' : '2d')}
                    style={{
                        padding: '8px 16px',
                        background: '#fff',
                        color: view === '3d' ? '#9C27B0' : '#333',
                        border: `1px solid ${view === '3d' ? '#9C27B0' : '#ddd'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '500'
                    }}
                >
                    {view === '2d' ? <Grid3x3 size={16} /> : <Box size={16} />}
                    {view === '2d' ? '3D View' : '2D View'}
                </button>

                {view === '3d' && (
                    <button
                        onClick={() => onFullScreenChange(!isFullScreen)}
                        style={{
                            padding: '8px 16px',
                            background: isFullScreen ? '#333' : '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        {isFullScreen ? 'Exit FS' : 'Full Screen'}
                    </button>
                )}
            </div>

            <div style={{ width: '1px', height: '40px', background: '#ddd' }} />

            {/* Analysis */}
            <button
                onClick={() => onAction('analyze')}
                style={{
                    padding: '10px 20px',
                    background: '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
            >
                <Play size={18} />
                Run Analysis
            </button>
        </div>
    );
};

// ============================================================================
// PROPERTIES PANEL
// ============================================================================

const PropertiesPanel = ({ selectedElement, onPropertyChange, onClose }) => {
    if (!selectedElement) {
        return (
            <div style={{
                width: '350px',
                background: '#fff',
                borderLeft: '1px solid #ddd',
                padding: '20px',
                overflowY: 'auto'
            }}>
                <div style={{ textAlign: 'center', color: '#999', marginTop: '100px' }}>
                    <Settings size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <div>No Element Selected</div>
                    <div style={{ fontSize: '12px', marginTop: '8px' }}>
                        Click on an element to view properties
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            width: '350px',
            background: '#fff',
            borderLeft: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f5f5f5'
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    {selectedElement.type.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Properties */}
            <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
                        DIMENSIONS & IDENTITY
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            ID / Name
                        </label>
                        <input
                            type="text"
                            value={selectedElement.id}
                            onChange={(e) => onPropertyChange('id', e.target.value)} // Note: Requires handling ID change in parent if ID is used as key
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666', marginTop: '16px' }}>
                        DIMENSIONS
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            Width (mm)
                        </label>
                        <input
                            type="number"
                            value={selectedElement.properties.width}
                            onChange={(e) => onPropertyChange('width', Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            Depth (mm)
                        </label>
                        <input
                            type="number"
                            value={selectedElement.properties.depth}
                            onChange={(e) => onPropertyChange('depth', Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    {selectedElement.type === 'column' && (
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                Height (mm)
                            </label>
                            <input
                                type="number"
                                value={selectedElement.properties.height}
                                onChange={(e) => onPropertyChange('height', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '13px'
                                }}
                            />
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
                        MATERIAL
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            Concrete Grade
                        </label>
                        <select
                            value={selectedElement.properties.material}
                            onChange={(e) => onPropertyChange('material', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        >
                            <option value="C25">C25</option>
                            <option value="C30">C30</option>
                            <option value="C35">C35</option>
                            <option value="C40">C40</option>
                            <option value="C50">C50</option>
                        </select>
                    </div>
                </div>

                {/* Analysis Results */}
                {selectedElement.analysisResults && (
                    <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        background: '#f9f9f9',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                    }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
                            ANALYSIS RESULTS
                        </div>

                        <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={{ color: '#888' }}>Axial Force:</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {selectedElement.analysisResults.N?.toFixed(1)} kN
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#888' }}>Moment:</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {selectedElement.analysisResults.M?.toFixed(1)} kNm
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#888' }}>Shear:</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {selectedElement.analysisResults.V?.toFixed(1)} kN
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#888' }}>Utilization:</div>
                                <div style={{ fontWeight: 'bold', color: selectedElement.analysisResults.utilization > 1 ? '#f44336' : '#4CAF50' }}>
                                    {(selectedElement.analysisResults.utilization * 100)?.toFixed(0)}%
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {/* Open design details */ }}
                            style={{
                                width: '100%',
                                marginTop: '12px',
                                padding: '10px',
                                background: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <Calculator size={16} />
                            View Design Details
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

const InteractiveStructureBuilder = () => {
    const [elements, setElements] = useState([]);
    const [selectedElement, setSelectedElement] = useState(null);
    const [tool, setTool] = useState('select');
    const [showGrid, setShowGrid] = useState(true);
    const [showDiagrams, setShowDiagrams] = useState({ moment: false, shear: false });
    const [showForces, setShowForces] = useState(false);
    const [scale, setScale] = useState(25);
    const [layers, setLayers] = useState({
        'Floor 1': { visible: true, elements: [] },
        'Floor 2': { visible: true, elements: [] },
        'Floor 3': { visible: true, elements: [] }
    });
    const [activeLayer, setActiveLayer] = useState('Floor 1');
    const [view, setView] = useState('2d'); // '2d' or '3d'

    // Override setTool to ensure we are in 2D mode when drawing
    const handleToolChange = (newTool) => {
        if (newTool !== 'select' && view === '3d') {
            setView('2d');
        }
        setTool(newTool);
    };
    const [showPropertiesPanel, setShowPropertiesPanel] = useState(true);
    const [showLibrary, setShowLibrary] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [collapsedSections, setCollapsedSections] = useState({
        layers: false,
        display: false
    });

    const handleElementClick = useCallback((element) => {
        if (tool !== 'select') return;

        setElements(prev => prev.map(el => ({
            ...el,
            selected: el.id === element?.id
        })));
        setSelectedElement(element);
    }, [tool]);

    const handleElementsAdd = useCallback((newElements) => {
        setElements(prev => [...prev, ...newElements]);
        setTool('select');
    }, []);

    const handleElementDragEnd = useCallback((elementId, newPosition) => {
        setElements(prev => prev.map(el => {
            if (el.id === elementId) {
                return {
                    ...el,
                    position: newPosition
                };
            }
            return el;
        }));
    }, []);

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
                        `C-F${f}-${i}-${j}`,
                        { x, y, z },
                        { depth: 0.45, height: floor_height, layer: floorName }
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
    }, []);

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

            case 'library':
                setShowLibrary(true);
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
            height: isFullScreen ? '100vh' : '800px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fff',
            borderRadius: isFullScreen ? '0' : '8px',
            boxShadow: isFullScreen ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
            border: isFullScreen ? 'none' : '1px solid #ddd',
            position: isFullScreen ? 'fixed' : 'relative',
            top: isFullScreen ? 0 : 'auto',
            left: isFullScreen ? 0 : 'auto',
            zIndex: isFullScreen ? 5000 : 1
        }}>
            {/* Header */}
            <div style={{
                height: '60px',
                background: '#fff',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1002, // Ensure header is above everything
                position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {!isFullScreen && (
                        <Building2 size={32} color="#2196F3" />
                    )}

                    {/* Exit full screen remains here if needed or removed */}

                    <button
                        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                        style={{
                            padding: '8px',
                            background: '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: isFullScreen ? '10px' : '0',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                        title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
                    >
                        {isSidebarVisible ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>

                    {!isFullScreen && (
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                Interactive Structure Builder
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                                Professional Structural Modeler
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* File operations */}
                    <label style={{
                        padding: '8px 16px',
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px'
                    }}>
                        <FolderOpen size={16} />
                        Open
                        <input type="file" accept=".json" onChange={handleLoad} style={{ display: 'none' }} />
                    </label>

                    <button
                        onClick={handleSave}
                        style={{
                            padding: '8px 16px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px'
                        }}
                    >
                        <Save size={16} />
                        Save
                    </button>

                    <div style={{ width: '1px', height: '30px', background: '#ddd' }} />

                    {/* Quick actions */}



                </div>
            </div>

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
                        />
                    ) : (
                        <Complete3DStructureView
                            elements={elements}
                            selectedElement={selectedElement}
                            onElementClick={handleElementClick}
                            floors={Object.keys(layers).length}
                            floorHeight={3.5}
                            showDiagrams={showDiagrams}
                            showForces={showForces}
                            layerVisibility={Object.entries(layers).reduce((acc, [name, data]) => {
                                acc[name] = data.visible;
                                return acc;
                            }, {})}
                        />
                    )}

                    {/* Stats overlay */}
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '20px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        fontSize: '12px',
                        display: 'flex',
                        gap: '16px'
                    }}>
                        <div>
                            <div style={{ color: '#888' }}>Columns</div>
                            <div style={{ fontWeight: 'bold' }}>
                                {elements.filter(el => el.type === 'column').length}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: '#888' }}>Beams</div>
                            <div style={{ fontWeight: 'bold' }}>
                                {elements.filter(el => el.type === 'beam').length}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: '#888' }}>Slabs</div>
                            <div style={{ fontWeight: 'bold' }}>
                                {elements.filter(el => el.type === 'slab').length}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: '#888' }}>Total</div>
                            <div style={{ fontWeight: 'bold' }}>
                                {elements.length}
                            </div>
                        </div>
                    </div>
                </div>

                {showPropertiesPanel ? (
                    <PropertiesPanel
                        selectedElement={selectedElement}
                        onPropertyChange={handlePropertyChange}
                        onClose={() => setShowPropertiesPanel(false)}
                    />
                ) : (
                    <button
                        onClick={() => setShowPropertiesPanel(true)}
                        style={{
                            position: 'absolute',
                            right: '20px',
                            top: '80px',
                            padding: '10px',
                            background: '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            zIndex: 10
                        }}
                    >
                        <Settings size={20} />
                    </button>
                )}

                {showLibrary && (
                    <BuildingLibraryBrowser
                        onSelectTemplate={handleSelectTemplate}
                        onClose={() => setShowLibrary(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default InteractiveStructureBuilder;