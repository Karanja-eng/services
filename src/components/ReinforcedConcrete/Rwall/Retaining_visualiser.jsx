import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text, Group, Arc, Path } from 'react-konva';

const RetainingWallVisualizer = ({ designData, viewType = 'section', scale = 0.5 }) => {
    const stageRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 1400, height: 800 });

    // Extract design data
    const geometry = designData?.geometry || {
        wall_thickness: 250,
        base_thickness: 300,
        base_width: 3.5,
        toe_width: 1.0,
        heel_width: 2.2,
    };

    const wallDesign = designData?.wall_design || {
        main_steel: { bar_diameter: 16, spacing: 200, notation: 'H16@200c/c' },
        distribution_steel: { bar_diameter: 10, spacing: 240, notation: 'H10@240c/c' },
    };

    const baseDesign = designData?.base_design || {
        main_steel: { bar_diameter: 12, spacing: 200, notation: 'H12@200c/c' },
    };

    const toeDesign = designData?.toe_design || {
        main_steel: { bar_diameter: 12, spacing: 200, notation: 'H12@200c/c' },
    };

    const H = (designData?.height || 4.0) * 1000; // Convert to mm
    const wallThick = geometry.wall_thickness;
    const baseThick = geometry.base_thickness;
    const baseWidth = geometry.base_width * 1000;
    const toeWidth = geometry.toe_width * 1000;
    const heelWidth = geometry.heel_width * 1000;

    // Cover values per BS codes
    const coverExternal = 40;
    const coverBuried = 50;

    // Colors matching AutoCAD layers
    const COLORS = {
        CONCRETE: '#FFFFFF',
        CONCRETE_FILL: '#E8E8E8',
        REBAR_MAIN: '#FF4444',
        REBAR_DIST: '#FFAA00',
        DIMENSIONS: '#00FF00',
        TEXT: '#FFFFFF',
        SOIL: '#8B7355',
        SOIL_PATTERN: '#6B5335',
        CENTER_LINE: '#FF00FF',
    };

    // Calculate offset to center the drawing
    const offsetX = 100;
    const offsetY = 100;

    // Render different views
    const renderSectionView = () => {
        return (
            <Group>
                {/* Title */}
                <Text
                    x={offsetX + baseWidth * scale / 2}
                    y={offsetY - 80}
                    text="SECTION VIEW"
                    fontSize={24}
                    fontStyle="bold"
                    fill={COLORS.TEXT}
                    align="center"
                    offsetX={100}
                />

                {/* Concrete outline */}
                <ConcreteSection
                    offsetX={offsetX}
                    offsetY={offsetY}
                    H={H}
                    wallThick={wallThick}
                    baseThick={baseThick}
                    baseWidth={baseWidth}
                    toeWidth={toeWidth}
                    heelWidth={heelWidth}
                    scale={scale}
                />

                {/* Soil hatching */}
                <SoilHatching
                    offsetX={offsetX}
                    offsetY={offsetY}
                    H={H}
                    wallThick={wallThick}
                    baseThick={baseThick}
                    toeWidth={toeWidth}
                    heelWidth={heelWidth}
                    baseWidth={baseWidth}
                    scale={scale}
                />

                {/* Wall reinforcement */}
                <WallReinforcement
                    offsetX={offsetX}
                    offsetY={offsetY}
                    H={H}
                    wallThick={wallThick}
                    baseThick={baseThick}
                    toeWidth={toeWidth}
                    wallDesign={wallDesign}
                    coverBuried={coverBuried}
                    coverExternal={coverExternal}
                    scale={scale}
                />

                {/* Base reinforcement */}
                <BaseReinforcement
                    offsetX={offsetX}
                    offsetY={offsetY}
                    baseThick={baseThick}
                    baseWidth={baseWidth}
                    toeWidth={toeWidth}
                    wallThick={wallThick}
                    baseDesign={baseDesign}
                    toeDesign={toeDesign}
                    coverBuried={coverBuried}
                    coverExternal={coverExternal}
                    scale={scale}
                />

                {/* Dimensions */}
                <Dimensions
                    offsetX={offsetX}
                    offsetY={offsetY}
                    H={H}
                    wallThick={wallThick}
                    baseThick={baseThick}
                    baseWidth={baseWidth}
                    toeWidth={toeWidth}
                    heelWidth={heelWidth}
                    scale={scale}
                />

                {/* Annotations */}
                <Annotations
                    offsetX={offsetX}
                    offsetY={offsetY}
                    H={H}
                    wallThick={wallThick}
                    baseThick={baseThick}
                    toeWidth={toeWidth}
                    wallDesign={wallDesign}
                    baseDesign={baseDesign}
                    coverBuried={coverBuried}
                    coverExternal={coverExternal}
                    scale={scale}
                />
            </Group>
        );
    };

    return (
        <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
            <Stage width={dimensions.width} height={dimensions.height} ref={stageRef}>
                <Layer>
                    {viewType === 'section' && renderSectionView()}
                </Layer>
            </Stage>

            {/* Legend */}
            <div style={{ marginTop: '20px', color: 'white', fontSize: '14px' }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '3px', backgroundColor: COLORS.CONCRETE }}></div>
                        <span>Concrete</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '3px', backgroundColor: COLORS.REBAR_MAIN }}></div>
                        <span>Main Reinforcement</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '3px', backgroundColor: COLORS.REBAR_DIST }}></div>
                        <span>Distribution Steel</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '3px', backgroundColor: COLORS.SOIL }}></div>
                        <span>Backfill Soil</span>
                    </div>
                </div>
            </div>

            {/* Export button */}
            <button
                onClick={() => {
                    const uri = stageRef.current.toDataURL();
                    const link = document.createElement('a');
                    link.download = 'retaining-wall.png';
                    link.href = uri;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }}
                style={{
                    marginTop: '20px',
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                }}
            >
                Export as PNG
            </button>
        </div>
    );
};

// Concrete Section Component
const ConcreteSection = ({ offsetX, offsetY, H, wallThick, baseThick, baseWidth, toeWidth, heelWidth, scale }) => {
    const points = [
        // Toe slab
        offsetX, offsetY * scale,
        (offsetX + toeWidth * scale), (offsetY),
        // Wall stem
        (offsetX + toeWidth * scale), (offsetY + baseThick * scale),
        (offsetX + (toeWidth + wallThick) * scale), (offsetY + baseThick * scale),
        (offsetX + (toeWidth + wallThick) * scale), (offsetY + (baseThick + H) * scale),
        (offsetX + toeWidth * scale), (offsetY + (baseThick + H) * scale),
        (offsetX + toeWidth * scale), (offsetY + baseThick * scale),
        // Heel slab
        (offsetX + (toeWidth + wallThick) * scale), (offsetY + baseThick * scale),
        (offsetX + baseWidth * scale), (offsetY + baseThick * scale),
        (offsetX + baseWidth * scale), offsetY,
        offsetX, offsetY,
    ];

    return (
        <>
            {/* Concrete fill */}
            <Line
                points={points}
                closed
                fill="#E8E8E8"
                stroke="#FFFFFF"
                strokeWidth={2}
            />

            {/* Concrete hatch pattern */}
            <ConcreteHatch
                offsetX={offsetX}
                offsetY={offsetY}
                baseWidth={baseWidth}
                baseThick={baseThick}
                H={H}
                toeWidth={toeWidth}
                wallThick={wallThick}
                scale={scale}
            />
        </>
    );
};

// Concrete hatching pattern
const ConcreteHatch = ({ offsetX, offsetY, baseWidth, baseThick, H, toeWidth, wallThick, scale }) => {
    const lines = [];
    const spacing = 20; // Pattern spacing
    const angle = 45; // Hatch angle

    // Generate diagonal lines for concrete pattern
    for (let i = 0; i < baseWidth * scale + H * scale; i += spacing) {
        lines.push(
            <Line
                key={`hatch-${i}`}
                points={[
                    offsetX + i - H * scale * Math.tan(angle * Math.PI / 180),
                    offsetY + H * scale + baseThick * scale,
                    offsetX + i,
                    offsetY,
                ]}
                stroke="#D0D0D0"
                strokeWidth={0.5}
                opacity={0.3}
            />
        );
    }

    return <Group>{lines}</Group>;
};

// Soil hatching
const SoilHatching = ({ offsetX, offsetY, H, wallThick, toeWidth, baseWidth, baseThick, heelWidth, scale }) => {
    const soilPoints = [
        (offsetX + (toeWidth + wallThick) * scale), (offsetY + (H + baseThick) * scale),
        (offsetX + (baseWidth + 500) * scale), (offsetY + (H + baseThick) * scale),
        (offsetX + (baseWidth + 500) * scale), offsetY,
        (offsetX + baseWidth * scale), offsetY,
        (offsetX + baseWidth * scale), (offsetY + H * scale),
        (offsetX + (toeWidth + wallThick) * scale), (offsetY + H * scale),
    ];

    return (
        <>
            <Line
                points={soilPoints}
                closed
                fill="#8B7355"
                stroke="#6B5335"
                strokeWidth={1}
            />

            {/* Earth pattern - dots */}
            {Array.from({ length: 30 }, (_, i) => (
                <Circle
                    key={`soil-${i}`}
                    x={offsetX + (toeWidth + wallThick + Math.random() * heelWidth) * scale}
                    y={offsetY + Math.random() * H * scale}
                    radius={2}
                    fill="#4B3325"
                    opacity={0.4}
                />
            ))}

            {/* Label */}
            <Text
                x={offsetX + (toeWidth + wallThick + heelWidth / 2) * scale}
                y={offsetY + H * scale / 2}
                text="GRANULAR FILL"
                fontSize={14}
                fill="#FFFFFF"
                align="center"
                offsetX={50}
            />
        </>
    );
};

// Wall reinforcement
const WallReinforcement = ({ offsetX, offsetY, H, wallThick, baseThick, toeWidth, wallDesign, coverBuried, coverExternal, scale }) => {
    const mainSteel = wallDesign.main_steel;
    const distSteel = wallDesign.distribution_steel;

    const barDia = mainSteel.bar_diameter;
    const spacing = mainSteel.spacing;

    const xInner = offsetX + (toeWidth + wallThick - coverBuried - barDia / 2) * scale;
    const yStart = offsetY + (baseThick + coverExternal + barDia / 2) * scale;
    const yEnd = offsetY + (baseThick + H - coverExternal - barDia / 2) * scale;

    const numBars = Math.floor(1000 / spacing);

    return (
        <Group>
            {/* Main vertical bars */}
            {Array.from({ length: numBars }, (_, i) => {
                const yBar = yStart + (i * spacing * scale * H / 1000);
                if (yBar > yEnd) return null;

                return (
                    <LBar
                        key={`main-${i}`}
                        x={xInner}
                        y={offsetY + (baseThick - coverExternal) * scale}
                        height={(H - coverExternal) * scale}
                        barDia={barDia}
                        bendDirection="down"
                        color="#FF4444"
                        scale={scale}
                    />
                );
            })}

            {/* Distribution steel (horizontal) */}
            {distSteel && Array.from({ length: Math.floor(H / distSteel.spacing) }, (_, i) => {
                if (i % 3 !== 0) return null; // Show every 3rd bar

                const yBar = offsetY + (baseThick + i * distSteel.spacing) * scale;
                const xOuter = offsetX + (toeWidth + coverExternal) * scale;

                return (
                    <Line
                        key={`dist-${i}`}
                        points={[
                            xOuter,
                            yBar,
                            xOuter + (wallThick - 2 * coverExternal) * scale,
                            yBar,
                        ]}
                        stroke="#FFAA00"
                        strokeWidth={2}
                    />
                );
            })}

            {/* Annotation for main steel */}
            <RebarLabel
                x={xInner - 100}
                y={yEnd + 50}
                text={mainSteel.notation}
                mark="B1"
            />

            {/* Annotation for distribution steel */}
            {distSteel && (
                <RebarLabel
                    x={offsetX + (toeWidth - 150) * scale}
                    y={offsetY + (baseThick + H / 2) * scale}
                    text={distSteel.notation}
                    mark="B2"
                />
            )}
        </Group>
    );
};

// Base reinforcement
const BaseReinforcement = ({ offsetX, offsetY, baseThick, baseWidth, toeWidth, wallThick, baseDesign, toeDesign, coverBuried, coverExternal, scale }) => {
    const heelSteel = baseDesign.main_steel;
    const toeSteel = toeDesign.main_steel;

    const heelBarDia = heelSteel.bar_diameter;
    const heelSpacing = heelSteel.spacing;

    const heelWidth = baseWidth - toeWidth - wallThick;

    // Heel slab reinforcement (top)
    const yTop = offsetY + (baseThick - coverBuried - heelBarDia / 2) * scale;
    const xStart = offsetX + (toeWidth + wallThick + coverBuried) * scale;
    const xEnd = offsetX + (baseWidth - coverBuried) * scale;

    const numHeelBars = Math.floor(heelWidth / heelSpacing);

    // Toe slab reinforcement (bottom)
    const toeBarDia = toeSteel.bar_diameter;
    const toeSpacing = toeSteel.spacing;
    const yBottom = offsetY + (coverExternal + toeBarDia / 2) * scale;
    const xToeStart = offsetX + (coverExternal) * scale;
    const xToeEnd = offsetX + (toeWidth - coverExternal) * scale;

    const numToeBars = Math.floor(toeWidth / toeSpacing);

    return (
        <Group>
            {/* Heel bars (top of slab) */}
            {Array.from({ length: numHeelBars }, (_, i) => {
                if (i % 2 !== 0) return null; // Show every other bar

                const xBar = xStart + (i * heelSpacing) * scale;
                if (xBar > xEnd) return null;

                return (
                    <Line
                        key={`heel-${i}`}
                        points={[xBar, yTop, xBar, yTop - (baseThick - 2 * coverBuried) * scale]}
                        stroke="#FF4444"
                        strokeWidth={2}
                    />
                );
            })}

            {/* Toe bars (bottom of slab - L-shaped) */}
            {Array.from({ length: numToeBars }, (_, i) => {
                if (i % 2 !== 0) return null;

                const xBar = xToeStart + (i * toeSpacing) * scale;
                if (xBar > xToeEnd) return null;

                return (
                    <LBar
                        key={`toe-${i}`}
                        x={xBar}
                        y={yBottom}
                        height={(baseThick - 2 * coverExternal) * scale}
                        barDia={toeBarDia}
                        bendDirection="up"
                        color="#FF4444"
                        scale={scale}
                    />
                );
            })}

            {/* Labels */}
            <RebarLabel
                x={xEnd + 30}
                y={yTop}
                text={heelSteel.notation}
                mark="B3"
            />

            <RebarLabel
                x={xToeStart}
                y={yBottom - 30}
                text={toeSteel.notation}
                mark="B4"
            />
        </Group>
    );
};

// L-shaped bar component
const LBar = ({ x, y, height, barDia, bendDirection, color, scale }) => {
    const bendRadius = barDia * 2;
    const extension = barDia * 12;

    if (bendDirection === 'up') {
        const points = [
            x, y,
            x, y + height - bendRadius * scale,
        ];

        return (
            <Group>
                <Line points={points} stroke={color} strokeWidth={2} />
                <Arc
                    x={x + bendRadius * scale}
                    y={y + height - bendRadius * scale}
                    innerRadius={0}
                    outerRadius={bendRadius * scale}
                    angle={90}
                    rotation={180}
                    stroke={color}
                    strokeWidth={2}
                />
                <Line
                    points={[
                        x + bendRadius * scale, y + height,
                        x + extension * scale, y + height,
                    ]}
                    stroke={color}
                    strokeWidth={2}
                />
            </Group>
        );
    } else {
        // Down direction
        const points = [
            x - extension * scale, y,
            x - bendRadius * scale, y,
        ];

        return (
            <Group>
                <Line points={points} stroke={color} strokeWidth={2} />
                <Arc
                    x={x - bendRadius * scale}
                    y={y + bendRadius * scale}
                    innerRadius={0}
                    outerRadius={bendRadius * scale}
                    angle={90}
                    rotation={90}
                    stroke={color}
                    strokeWidth={2}
                />
                <Line
                    points={[x, y + bendRadius * scale, x, y + height]}
                    stroke={color}
                    strokeWidth={2}
                />
            </Group>
        );
    }
};

// Rebar label component
const RebarLabel = ({ x, y, text, mark }) => {
    return (
        <Group>
            <Line
                points={[x, y, x - 80, y + 40]}
                stroke="#00FF00"
                strokeWidth={1}
            />
            <Text
                x={x - 90}
                y={y + 45}
                text={`${mark}: ${text}`}
                fontSize={10}
                fill="#FFFFFF"
                align="right"
            />
        </Group>
    );
};

// Dimensions component
const Dimensions = ({ offsetX, offsetY, H, wallThick, baseThick, baseWidth, toeWidth, heelWidth, scale }) => {
    const dimOffset = 150;

    return (
        <Group>
            {/* Base width */}
            <DimensionLine
                x1={offsetX}
                y1={offsetY - dimOffset}
                x2={offsetX + baseWidth * scale}
                y2={offsetY - dimOffset}
                text={`${(baseWidth / 1000).toFixed(2)}m`}
                vertical={false}
            />

            {/* Wall height */}
            <DimensionLine
                x1={offsetX + baseWidth * scale + dimOffset}
                y1={offsetY + baseThick * scale}
                x2={offsetX + baseWidth * scale + dimOffset}
                y2={offsetY + (baseThick + H) * scale}
                text={`${(H / 1000).toFixed(2)}m`}
                vertical={true}
            />

            {/* Wall thickness */}
            <DimensionLine
                x1={offsetX + toeWidth * scale}
                y1={offsetY + (baseThick + H) * scale + 100}
                x2={offsetX + (toeWidth + wallThick) * scale}
                y2={offsetY + (baseThick + H) * scale + 100}
                text={`${wallThick}mm`}
                vertical={false}
            />

            {/* Base thickness */}
            <DimensionLine
                x1={offsetX - dimOffset}
                y1={offsetY}
                x2={offsetX - dimOffset}
                y2={offsetY + baseThick * scale}
                text={`${baseThick}mm`}
                vertical={true}
            />
        </Group>
    );
};

// Dimension line component
const DimensionLine = ({ x1, y1, x2, y2, text, vertical }) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return (
        <Group>
            <Line
                points={[x1, y1, x2, y2]}
                stroke="#00FF00"
                strokeWidth={1}
            />
            <Line
                points={[x1, y1 - 10, x1, y1 + 10]}
                stroke="#00FF00"
                strokeWidth={1}
            />
            <Line
                points={[x2, y2 - 10, x2, y2 + 10]}
                stroke="#00FF00"
                strokeWidth={1}
            />
            <Text
                x={midX}
                y={vertical ? midY : midY - 20}
                text={text}
                fontSize={11}
                fill="#00FF00"
                align="center"
                offsetX={20}
            />
        </Group>
    );
};

// Annotations component
const Annotations = ({ offsetX, offsetY, H, wallThick, baseThick, toeWidth, wallDesign, baseDesign, coverBuried, coverExternal, scale }) => {
    return (
        <Group>
            {/* Cover annotations */}
            <Text
                x={offsetX + toeWidth * scale + 10}
                y={offsetY + baseThick * scale + 20}
                text={`${coverExternal}mm cover (external)`}
                fontSize={9}
                fill="#FFFF00"
            />

            <Text
                x={offsetX + (toeWidth + wallThick) * scale - 150}
                y={offsetY + baseThick * scale + 20}
                text={`${coverBuried}mm cover (buried)`}
                fontSize={9}
                fill="#FFFF00"
            />

            {/* Kicker annotation */}
            <Group>
                <Rect
                    x={offsetX + toeWidth * scale}
                    y={offsetY + baseThick * scale - 30}
                    width={wallThick * scale}
                    height={30}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                    dash={[5, 5]}
                />
                <Text
                    x={offsetX + (toeWidth + wallThick / 2) * scale}
                    y={offsetY + baseThick * scale - 50}
                    text="KICKER: 150mm"
                    fontSize={9}
                    fill="#FFFFFF"
                    align="center"
                    offsetX={40}
                />
            </Group>

            {/* Tension lap notation */}
            <Text
                x={offsetX + (toeWidth - 100) * scale}
                y={offsetY + (baseThick + 100) * scale}
                text="TENSION LAP"
                fontSize={9}
                fill="#FFFF00"
                rotation={-90}
            />
        </Group>
    );
};

export default RetainingWallVisualizer;

/**
 * Returns an array of CAD objects (lines, circles, text) representing the retaining wall design.
 * Used for "exploding" members in the universal CAD drawer.
 */
export const getRetainingCADPrimitives = (designData, x = 0, y = 0, scale = 0.5) => {
    if (!designData) return [];

    const geometry = designData.geometry;
    const wallDesign = designData.wall_design;
    const baseDesign = designData.base_design;
    const toeDesign = designData.toe_design;

    const H = (designData.height || 4.0) * 1000;
    const wallThick = geometry.wall_thickness;
    const baseThick = geometry.base_thickness;
    const baseWidth = geometry.base_width * 1000;
    const toeWidth = geometry.toe_width * 1000;
    const heelWidth = geometry.heel_width * 1000;

    // Scale for CAD
    const s = scale;

    // Adjust origin to center-bottom of wall
    const offsetX = x - (baseWidth / 2) * s;
    const offsetY = y + (H / 2) * s;

    const primitives = [];
    const layerId = "structural";

    // Helper to add line
    const addLine = (x1, y1, x2, y2, color = '#000', width = 1) => {
        primitives.push({
            id: Math.random().toString(),
            type: 'line',
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            color,
            layerId
        });
    };

    // Helper to add circle
    const addCircle = (cx, cy, radius, color = '#000') => {
        primitives.push({
            id: Math.random().toString(),
            type: 'circle',
            center: { x: cx, y: cy },
            radius,
            color,
            layerId
        });
    };

    // Helper to add text
    const addText = (tx, ty, text, size = 1.0) => {
        primitives.push({
            id: Math.random().toString(),
            type: 'text',
            position: { x: tx, y: ty },
            text,
            size,
            color: '#000',
            layerId
        });
    };

    // 1. Concrete Points
    const pts = [
        offsetX, offsetY, // Bottom Left
        offsetX + baseWidth * s, offsetY, // Bottom Right
        offsetX + baseWidth * s, offsetY - baseThick * s, // Heel Top Right
        offsetX + (toeWidth + wallThick) * s, offsetY - baseThick * s, // Heel Top Left
        offsetX + (toeWidth + wallThick) * s, offsetY - (baseThick + H) * s, // Wall Top Right
        offsetX + toeWidth * s, offsetY - (baseThick + H) * s, // Wall Top Left
        offsetX + toeWidth * s, offsetY - baseThick * s, // Toe Top Right
        offsetX, offsetY - baseThick * s, // Toe Top Left
        offsetX, offsetY // Close loop
    ];

    for (let i = 0; i < pts.length - 2; i += 2) {
        addLine(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], '#000', 2);
    }

    // 2. Main Wall Reinforcement
    const barDia = wallDesign.main_steel.bar_diameter;
    const barSpacing = wallDesign.main_steel.spacing;
    const coverExternal = 40;
    const coverBuried = 50;

    const xInner = offsetX + (toeWidth + wallThick - coverBuried - barDia / 2) * s;
    const yStart = offsetY - (baseThick + coverExternal) * s;
    const yEnd = offsetY - (baseThick + H - coverExternal) * s;

    // Draw representative bars (vertical)
    const numBars = 5; // Simplified for view
    for (let i = 0; i < numBars; i++) {
        // Just draw one vertical line representing the layer
        if (i === 0) addLine(xInner, yStart, xInner, yEnd, '#FF0000', 2);
    }

    // L-bend at bottom
    addLine(xInner, yStart, xInner - (12 * barDia) * s, yStart, '#FF0000', 2);


    // 3. Base Reinforcement (Heel)
    const heelDia = baseDesign.main_steel.bar_diameter;
    const heelY = offsetY - (baseThick - coverBuried - heelDia / 2) * s;
    addLine(offsetX + (toeWidth + wallThick) * s, heelY, offsetX + (baseWidth - coverBuried) * s, heelY, '#FF0000', 2);

    // 4. Toe Reinforcement
    const toeDia = toeDesign?.main_steel?.bar_diameter || 12;
    const toeY = offsetY - (coverExternal + toeDia / 2) * s;
    addLine(offsetX + coverExternal * s, toeY, offsetX + (toeWidth) * s, toeY, '#FF0000', 2);

    // 5. Annotations
    addText(offsetX + baseWidth / 2 * s, offsetY + 50 * s, "RETAINING WALL SECTION", 2.0);
    addText(xInner - 20 * s, yEnd - 20 * s, wallDesign.main_steel.notation, 1.2);

    return primitives;
};