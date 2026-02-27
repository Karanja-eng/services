
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Transformer } from 'react-konva';
import { StructuralGrid, StructuralElement } from './StructuralClasses';
import { ISectionColumn, ISectionBeam, RectangularSection, CircularSection, getSteelSectionColor } from '../../SteelDesign/SteelSectionKonva';

// ============================================================================
// KONVA COMPONENTS FOR STRUCTURAL ELEMENTS
// ============================================================================

const GridComponent = ({ grid, visible, scale, onGridLineDragEnd, width, height }) => {
    if (!visible) return null;

    // Use dynamic width/height if provided, else defaults
    const gridLines = grid.getGridLines(100, 100);

    return (
        <Group>
            {gridLines.map(line => (
                <Group
                    key={line.id}
                    draggable
                    onDragStart={(e) => {
                        // constrain drag to axis
                        if (line.type === 'vertical') {
                            e.target.dragBoundFunc(function (pos) {
                                return { x: pos.x, y: this.getAbsolutePosition().y };
                            });
                        } else {
                            e.target.dragBoundFunc(function (pos) {
                                return { x: this.getAbsolutePosition().x, y: pos.y };
                            });
                        }
                    }}
                    onDragEnd={(e) => {
                        // Calculate new value based on drag delta
                        const newPos = line.type === 'vertical' ? e.target.x() / scale : e.target.y() / scale;
                        const absoluteVal = line.val + newPos; // line.val is the base, newPos is the delta
                        onGridLineDragEnd(line.id, absoluteVal, line.type === 'vertical' ? 'x' : 'y');

                        // Reset position after drag because we update the model which re-renders
                        e.target.position({ x: 0, y: 0 });
                    }}
                >
                    <Line
                        points={[line.x1 * scale, line.y1 * scale, line.x2 * scale, line.y2 * scale]}
                        stroke="#000000"
                        strokeWidth={0.5} // Thin line as requested
                        dash={[10, 2, 2, 2]} // Center-line style dash-dot
                        opacity={0.6}
                    />

                    {/* Grid bubbles for X-axis (1, 2, 3...) at Top */}
                    {line.type === 'vertical' && line.y1 <= 0 && (
                        <Group x={line.x1 * scale} y={-30}>
                            <Circle radius={12} stroke="#000000" strokeWidth={1} fill="#ffffff" />
                            <Text
                                x={-10}
                                y={-5}
                                width={20}
                                align="center"
                                text={line.label}
                                fontSize={11}
                                fontStyle="bold"
                                fill="#000000"
                            />
                        </Group>
                    )}

                    {/* Grid bubbles for Y-axis (A, B, C...) at Left */}
                    {line.type === 'horizontal' && line.x1 <= 0 && (
                        <Group x={-30} y={line.y1 * scale}>
                            <Circle radius={12} stroke="#000000" strokeWidth={1} fill="#ffffff" />
                            <Text
                                x={-10}
                                y={-5}
                                width={20}
                                align="center"
                                text={line.label}
                                fontSize={11}
                                fontStyle="bold"
                                fill="#000000"
                            />
                        </Group>
                    )}
                </Group>
            ))}
        </Group>
    );
};

const ColumnComponent = ({ element, scale, onClick, onDragEnd, showForces, layerVisibility, sectionDisplayType = 'rectangle' }) => {

    const shapeRef = useRef();
    const trRef = useRef();
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (element.selected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [element.selected]);

    const width = element.properties.width * scale; // already in meters
    const depth = element.properties.depth * scale;

    const x = element.position.x * scale;
    const y = element.position.y * scale;

    // Use steel color if analyzing steel (could enhance this logic)
    const fillColor = sectionDisplayType === 'I-section' ? '#708090' : '#000000';
    const strokeColor = sectionDisplayType === 'I-section' ? '#2F4F4F' : '#000000';

    return (
        <Group>
            {/* Background for selection/hover */}
            <Rect
                x={x - width / 2 - 2}
                y={y - depth / 2 - 2}
                width={width + 4}
                height={depth + 4}
                fill={element.selected ? '#4CAF5033' : 'transparent'}
                cornerRadius={2}
            />

            {sectionDisplayType === 'I-section' ? (
                <ISectionColumn
                    x={x}
                    y={y}
                    width={width}
                    depth={depth}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={0.5}
                />
            ) : sectionDisplayType === 'circle' ? (
                <CircularSection
                    x={x}
                    y={y}
                    diameter={Math.max(width, depth)}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={0.5}
                />
            ) : (
                /* ORIGINAL RC RENDERING (PRESERVED) */
                <Rect
                    ref={shapeRef}
                    x={x}
                    y={y}
                    offsetX={width / 2}
                    offsetY={depth / 2}
                    width={width}
                    height={depth}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={0}
                    draggable
                    onClick={() => onClick(element)}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={(e) => {
                        setIsDragging(false);
                        onDragEnd(element.id, {
                            x: e.target.x() / scale,
                            y: e.target.y() / scale
                        });
                        // Reset position to let element position drive the render
                        e.target.position({ x: 0, y: 0 });
                    }}
                />
            )}

            {/* Invisible hit area for dragging non-rect shapes */}
            {(sectionDisplayType !== 'rectangle') && (
                <Rect
                    x={x - width / 2}
                    y={y - depth / 2}
                    width={width}
                    height={depth}
                    fill="transparent"
                    draggable
                    onClick={() => onClick(element)}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={(e) => {
                        setIsDragging(false);
                        // Convert center-based coordinates back to model coordinates
                        const newX = (e.target.x() + width / 2) / scale;
                        const newY = (e.target.y() + depth / 2) / scale;

                        // For transform/drag logic, keep it simple: just use center position
                        onDragEnd(element.id, {
                            x: e.target.x() / scale, // Elements store center position
                            y: e.target.y() / scale
                        });
                        e.target.position({ x: x, y: y }); // Reset to current pos, let parent update
                    }}
                />
            )}

            {/* Column label tag */}
            {layerVisibility.labels && (
                <Group x={x + width + 5} y={y}>
                    <Text
                        text={element.id}
                        fontSize={11}
                        fontStyle="bold"
                        fill="#000000"
                        listening={false}
                    />
                    <Text
                        y={14}
                        text={`${(element.properties.width * 1000).toFixed(0)}x${(element.properties.depth * 1000).toFixed(0)}`}
                        fontSize={9}
                        fill="#666"
                        listening={false}
                    />
                </Group>
            )}

            {/* Analysis results overlay */}
            {showForces && element.analysisResults && layerVisibility.labels && (
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

const BeamComponent = ({ element, scale, onClick, onDragEnd, showDiagrams, layerVisibility, opacity = 1.0, sectionDisplayType = 'rectangle' }) => {

    const { start, end } = element.position;
    const depth = element.properties.depth * scale; // Width of beam in plan view (or actual depth if I-section)

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // BM diagram overlay points calculations...
    const bmPoints = [];
    const sfPoints = [];
    const diagramScale = 0.5;

    // ... diagram calculations ...
    if (showDiagrams.moment && element.analysisResults?.sections) {
        // ... existing logic
        const sections = element.analysisResults.sections;
        sections.forEach(section => {
            const t = section.ratio;
            const x = start.x + t * dx;
            const y = start.y + t * dy;
            const offset = (section.Mz || 0) * (diagramScale / scale); // Adjusted for global scale

            // Perpendicular offset
            const perpX = -Math.sin(angle * Math.PI / 180) * offset * scale;
            const perpY = Math.cos(angle * Math.PI / 180) * offset * scale;

            bmPoints.push(x * scale + perpX, y * scale + perpY);
        });
    }

    if (showDiagrams.shear && element.analysisResults?.sections) {
        // ... existing logic
        const sections = element.analysisResults.sections;
        sections.forEach(section => {
            const t = section.ratio;
            const x = start.x + t * dx;
            const y = start.y + t * dy;
            const offset = (section.Vy || 0) * (diagramScale / scale);

            // Perpendicular offset
            const perpX = -Math.sin(angle * Math.PI / 180) * offset * scale;
            const perpY = Math.cos(angle * Math.PI / 180) * offset * scale;

            sfPoints.push(x * scale + perpX, y * scale + perpY);
        });
    }

    const halfDepth = depth / 2;

    // Determine colors
    const fillColor = sectionDisplayType === 'I-section' ? '#708090' : '#ffffff';
    const strokeColor = sectionDisplayType === 'I-section' ? '#2F4F4F' : '#000000';

    return (
        <Group opacity={opacity}>
            {sectionDisplayType === 'I-section' ? (
                <ISectionBeam
                    x={start.x * scale}
                    y={start.y * scale}
                    length={length * scale}
                    depth={depth}
                    rotation={angle}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={1}
                    opacity={1.0}
                />
            ) : sectionDisplayType === 'circle' ? (
                <CircularSection
                    x={(start.x + dx / 2) * scale}
                    y={(start.y + dy / 2) * scale}
                    diameter={depth}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={1}
                />
            ) : (
                /* ORIGINAL RC RENDERING (PRESERVED) */
                /* White Filled Rectangle (Mask) for RC */
                <Rect
                    x={start.x * scale}
                    y={start.y * scale}
                    offsetY={halfDepth}
                    width={length * scale}
                    height={depth}
                    fill={fillColor} // White fill to mask grid lines
                    stroke={strokeColor} // Black outline
                    strokeWidth={1.5}
                    rotation={angle}
                    onClick={() => onClick(element)}
                    draggable
                    onDragEnd={(e) => {
                        // Calc relative movement
                        const deltaX = e.target.x() / scale - start.x;
                        const deltaY = e.target.y() / scale - start.y;
                        onDragEnd(element.id, {
                            start: { x: start.x + deltaX, y: start.y + deltaY },
                            end: { x: end.x + deltaX, y: end.y + deltaY }
                        });
                        e.target.position({ x: 0, y: 0 });
                    }}
                />
            )}

            {/* Invisible hit/drag area for I-section */}
            {sectionDisplayType !== 'rectangle' && (
                <Rect
                    x={start.x * scale}
                    y={start.y * scale}
                    offsetY={halfDepth}
                    width={length * scale}
                    height={depth}
                    fill="transparent"
                    rotation={angle}
                    onClick={() => onClick(element)}
                    draggable
                    onDragEnd={(e) => {
                        // Calc relative movement
                        const deltaX = e.target.x() / scale - start.x;
                        const deltaY = e.target.y() / scale - start.y;
                        onDragEnd(element.id, {
                            start: { x: start.x + deltaX, y: start.y + deltaY },
                            end: { x: end.x + deltaX, y: end.y + deltaY }
                        });
                        e.target.position({ x: 0, y: 0 });
                    }}
                />
            )}

            {/* BM diagram */}
            {bmPoints.length > 0 && (
                <Line
                    points={[start.x * scale, start.y * scale, ...bmPoints, end.x * scale, end.y * scale]}
                    stroke="#ff0000"
                    strokeWidth={1.5}
                    fill="#ff000033"
                    closed
                    listening={false}
                />
            )}

            {/* SF diagram */}
            {sfPoints.length > 0 && (
                <Line
                    points={[start.x * scale, start.y * scale, ...sfPoints, end.x * scale, end.y * scale]}
                    stroke="#0000ff"
                    strokeWidth={1.5}
                    fill="#0000ff33"
                    closed
                    listening={false}
                />
            )}

            {/* Beam label */}
            {layerVisibility.labels && (
                <Text
                    x={(start.x + end.x) / 2 * scale}
                    y={(start.y + end.y) / 2 * scale - 12}
                    text={`${element.id} ${(element.properties.width * 1000).toFixed(0)}x${(element.properties.depth * 1000).toFixed(0)}`}
                    fontSize={8}
                    fontStyle="bold"
                    fill="#000000"
                    listening={false}
                    rotation={angle}
                />
            )}
        </Group>
    );
};

const ConnectionComponent = ({ connection, scale, onClick }) => {
    const x = connection.position.x * scale;
    const y = connection.position.y * scale;

    // Convert mm to pixels/meters-scaled
    const plateW = (connection.plateW / 1000) * scale;
    const plateH = (connection.plateH / 1000) * scale;

    return (
        <Group x={x} y={y} onClick={() => onClick(connection)}>
            {/* Plate */}
            <Rect
                x={-plateW / 2}
                y={-plateH / 2}
                width={plateW}
                height={plateH}
                fill={connection.selected ? '#e67e22' : '#bdc3c7'}
                stroke="#2c3e50"
                strokeWidth={1}
                cornerRadius={2}
            />

            {/* Bolts */}
            {Array.from({ length: connection.boltRows || 0 }).map((_, r) => (
                Array.from({ length: connection.boltCols || 0 }).map((_, c) => {
                    const bx = (-plateW / 2) + (plateW / (connection.boltCols + 1)) * (c + 1);
                    const by = (-plateH / 2) + (plateH / (connection.boltRows + 1)) * (r + 1);
                    return (
                        <Circle
                            key={`${r}-${c}`}
                            x={bx}
                            y={by}
                            radius={(connection.boltDia / 1000) * scale / 2}
                            fill="#333"
                        />
                    );
                })
            ))}

            {/* Cross Indicator */}
            <Group>
                <Line points={[-5, 0, 5, 0]} stroke="#e74c3c" strokeWidth={1} />
                <Line points={[0, -5, 0, 5]} stroke="#e74c3c" strokeWidth={1} />
            </Group>
        </Group>
    );
};

const VoidComponent = ({ element, scale, onClick, layerVisibility }) => {
    const bounds = element.getBounds();
    return (
        <Group>
            <Rect
                x={bounds.x * scale}
                y={bounds.y * scale}
                width={element.properties.width * scale}
                height={element.properties.depth * scale}
                stroke="#000000"
                strokeWidth={1.5}
                fill="transparent"
                onClick={() => onClick(element)}
            />
            {/* Cross Lines */}
            <Line
                points={[
                    bounds.x * scale, bounds.y * scale,
                    (bounds.x + element.properties.width) * scale, (bounds.y + element.properties.depth) * scale
                ]}
                stroke="#000000"
                strokeWidth={1}
            />
            <Line
                points={[
                    (bounds.x + element.properties.width) * scale, bounds.y * scale,
                    bounds.x * scale, (bounds.y + element.properties.depth) * scale
                ]}
                stroke="#000000"
                strokeWidth={1}
            />
            {layerVisibility.labels && (
                <Text
                    x={bounds.x * scale + 5}
                    y={bounds.y * scale + 5}
                    text="OPENING"
                    fontSize={8}
                    fill="#000000"
                />
            )}
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

export const StructuralCanvas = ({
    elements,
    onElementClick,
    onElementDragEnd,
    onElementsAdd,
    tool,
    showGrid,
    showDiagrams,
    showForces,
    scale,
    activeLayer,
    layerVisibility,
    grid, // Passed from parent
    connections = [], // NEW: BIM Connections
    onGridUpdate, // Callback to update grid in parent
    beamOpacity, // Added opacity for beams
    sectionDisplayType = 'rectangle' // NEW: 'rectangle', 'I-section', 'circle'
}) => {
    const stageRef = useRef();
    const [drawing, setDrawing] = useState(null);
    const [tempLine, setTempLine] = useState(null);
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });

    const handleGridDragEnd = (id, newVal, axis) => {
        if (grid && onGridUpdate) {
            // Modify grid directly or treat as immutable based on implementation
            // Since grid is an instance of class, we can call method then trigger update
            grid.moveLine(id, newVal, axis);
            onGridUpdate(grid); // Signal parent to re-render
        }
    };

    const handleWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;

        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };

        stage.position(newPos);
        setViewTransform({ x: newPos.x, y: newPos.y, scale: newScale });
    };

    const handleStageClick = (e) => {
        if (e.target === e.target.getStage()) {
            onElementClick(null); // Deselect all
        }
    };

    // Helper to get logical position considering zoom/pan
    const getLogicalPos = (stage) => {
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = stage.getPointerPosition();
        const logicalPos = transform.point(pos);
        return { x: logicalPos.x / scale, y: logicalPos.y / scale };
    };

    const handleStageMouseDown = (e) => {
        if (tool === 'select' || tool === null) return;

        const { x, y } = getLogicalPos(e.target.getStage());

        const getZ = (layerName) => {
            const level = parseInt((layerName || 'Floor 1').replace('Floor ', '')) || 1;
            return (level - 1) * 3.5;
        };
        const z = getZ(activeLayer);

        if (tool === 'column') {
            const newColumn = new StructuralElement(
                'column',
                `C${elements.length + 1}`,
                { x, y, z },
                { layer: activeLayer || 'Floor 1' }
            );
            onElementsAdd([newColumn]);
        } else if (tool === 'beam') {
            setDrawing({ start: { x, y } });
        } else if (tool === 'slab') {
            setDrawing({ start: { x, y } });
        } else if (tool === 'void') {
            setDrawing({ start: { x, y } });
        }
    };

    const handleStageMouseMove = (e) => {
        if (!drawing) return;

        const { x, y } = getLogicalPos(e.target.getStage());

        if (tool === 'beam') {
            setTempLine({ start: drawing.start, end: { x, y } });
        } else if (tool === 'slab' || tool === 'void') {
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

        const { x, y } = getLogicalPos(e.target.getStage());

        const getZ = (layerName) => {
            const level = parseInt((layerName || 'Floor 1').replace('Floor ', '')) || 1;
            return (level - 1) * 3.5;
        };
        const z = getZ(activeLayer);

        if (tool === 'beam') {
            const newBeam = new StructuralElement('beam', `B${elements.length + 1}`, {
                start: { ...drawing.start, z },
                end: { x, y, z }
            }, {
                layer: activeLayer
            });
            onElementsAdd([newBeam]);
        } else if (tool === 'slab') {
            const newSlab = new StructuralElement('slab', `S${elements.length + 1}`, {
                x: Math.min(drawing.start.x, x),
                y: Math.min(drawing.start.y, y),
                z
            }, {
                width: Math.abs(x - drawing.start.x),
                depth: Math.abs(y - drawing.start.y),
                layer: activeLayer
            });
            onElementsAdd([newSlab]);
        } else if (tool === 'void') {
            const newVoid = new StructuralElement('void', `V${elements.length + 1}`, {
                x: Math.min(drawing.start.x, x),
                y: Math.min(drawing.start.y, y),
                z
            }, {
                width: Math.abs(x - drawing.start.x),
                depth: Math.abs(y - drawing.start.y),
                layer: activeLayer
            });
            onElementsAdd([newVoid]);
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
            onWheel={handleWheel}
            draggable={tool === 'select' || tool === null}
            style={{ background: '#f5f5f5', cursor: tool === 'select' ? 'grab' : 'crosshair' }}
        >
            <Layer>
                {/* Grid - Rendered BEHIND everything else */}
                {showGrid && layerVisibility.gridLines && grid && (
                    <GridComponent
                        grid={grid}
                        visible={showGrid}
                        scale={scale}
                        onGridLineDragEnd={handleGridDragEnd}
                    />
                )}

                {/* Slabs (render first, behind everything but grid) */}
                {layerVisibility.slabs && elements.filter(el => el.type === 'slab' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <SlabComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                        layerVisibility={layerVisibility}
                    />
                ))}

                {/* Voids */}
                {layerVisibility.voids && elements.filter(el => el.type === 'void' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <VoidComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                        layerVisibility={layerVisibility}
                    />
                ))}

                {/* Beams - NOW HAVE WHITE FILL TO MASK GRID */}
                {layerVisibility.beams && elements.filter(el => el.type === 'beam' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <BeamComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                        onDragEnd={onElementDragEnd}
                        showDiagrams={showDiagrams}
                        layerVisibility={layerVisibility}
                        opacity={beamOpacity}
                        sectionDisplayType={sectionDisplayType}
                    />
                ))}

                {/* Columns */}
                {layerVisibility.columns && elements.filter(el => el.type === 'column' && el.visible && (!activeLayer || el.layer === activeLayer)).map(element => (
                    <ColumnComponent
                        key={element.id}
                        element={element}
                        scale={scale}
                        onClick={onElementClick}
                        onDragEnd={onElementDragEnd}
                        showForces={showForces}
                        layerVisibility={layerVisibility}
                        sectionDisplayType={sectionDisplayType}
                    />
                ))}

                {/* Connections (BIM) */}
                {connections.map(conn => (
                    <ConnectionComponent
                        key={conn.id}
                        connection={conn}
                        scale={scale}
                        onClick={onElementClick}
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

                {tempLine && (tool === 'slab' || tool === 'void') && (
                    <Rect
                        x={tempLine.x * scale}
                        y={tempLine.y * scale}
                        width={tempLine.width * scale}
                        height={tempLine.height * scale}
                        stroke={tool === 'void' ? '#f44336' : '#2196F3'}
                        strokeWidth={2}
                        dash={[5, 5]}
                        fill={tool === 'void' ? '#f4433633' : '#2196F333'}
                    />
                )}
            </Layer>
        </Stage>
    );
};
