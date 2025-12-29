import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text, Group, Arrow } from 'react-konva';

// 2D Professional CAD-style drawings for Septic Tank, Manhole, and Soakpit
export const SepticSystem2DDrawings = ({ config, darkMode = false }) => {
    const [scale, setScale] = useState(50); // pixels per meter
    const stageRef = useRef(null);

    const colors = darkMode ? {
        bg: '#1e293b',
        concrete: '#6b7280',
        soil: '#92400e',
        water: '#0ea5e9',
        text: '#f1f5f9',
        dimension: '#fbbf24',
        grid: '#334155',
        hatch: '#9ca3af'
    } : {
        bg: '#ffffff',
        concrete: '#94a3b8',
        soil: '#d97706',
        water: '#3b82f6',
        text: '#1e293b',
        dimension: '#ea580c',
        grid: '#e2e8f0',
        hatch: '#64748b'
    };

    // Default configuration
    const defaultConfig = {
        septicTank: {
            intL: 3.0,
            intW: 2.5,
            depth: 2.0,
            wallThick: 0.2,
            slabThick: 0.2,
            bedThick: 0.15,
            numBaffles: 2,
            baffleThick: 0.2,
            baffleHeights: [1.5, 1.3]
        },
        manhole: {
            intL: 0.7,
            intW: 0.6,
            depth: 0.7,
            wallThick: 0.2,
            coverL: 0.6,
            coverW: 0.45
        },
        soakpit: {
            diameter: 2.0,
            depth: 3.0,
            wallThick: 0.23,
            shape: 'circular' // 'circular' or 'rectangular'
        },
        connections: {
            septicToManhole: true,
            manholeToSoakpit: true,
            pipediameter: 0.15
        }
    };

    const cfg = {
        septicTank: { ...defaultConfig.septicTank, ...(config?.septicTank || {}) },
        manhole: { ...defaultConfig.manhole, ...(config?.manhole || {}) },
        soakpit: { ...defaultConfig.soakpit, ...(config?.soakpit || {}) },
        connections: { ...defaultConfig.connections, ...(config?.connections || {}) }
    };

    // Drawing helper functions
    const drawHatch = (x, y, w, h, angle = 45, spacing = 10) => {
        const lines = [];
        const diagonal = Math.sqrt(w * w + h * h);
        const numLines = Math.ceil(diagonal / spacing);

        for (let i = -numLines; i <= numLines; i++) {
            const offset = i * spacing;
            const rad = (angle * Math.PI) / 180;
            const x1 = x + offset * Math.cos(rad);
            const y1 = y + offset * Math.sin(rad);
            const x2 = x + w + offset * Math.cos(rad);
            const y2 = y + h + offset * Math.sin(rad);

            lines.push(
                <Line
                    key={`hatch-${i}`}
                    points={[x1, y1, x2, y2]}
                    stroke={colors.hatch}
                    strokeWidth={0.5}
                    opacity={0.3}
                />
            );
        }
        return lines;
    };

    const drawDimension = (x1, y1, x2, y2, label, offset = 30) => {
        const isHorizontal = Math.abs(y2 - y1) < 1;
        const isVertical = Math.abs(x2 - x1) < 1;

        if (isHorizontal) {
            const y = y1 - offset;
            return (
                <Group>
                    <Line points={[x1, y1, x1, y]} stroke={colors.dimension} strokeWidth={1} />
                    <Line points={[x2, y2, x2, y]} stroke={colors.dimension} strokeWidth={1} />
                    <Arrow
                        points={[x1, y, x2, y]}
                        stroke={colors.dimension}
                        fill={colors.dimension}
                        strokeWidth={1}
                        pointerLength={5}
                        pointerWidth={5}
                    />
                    <Text
                        x={(x1 + x2) / 2 - 20}
                        y={y - 20}
                        text={label}
                        fontSize={10}
                        fill={colors.dimension}
                        fontStyle="bold"
                    />
                </Group>
            );
        } else if (isVertical) {
            const x = x1 + offset;
            return (
                <Group>
                    <Line points={[x1, y1, x, y1]} stroke={colors.dimension} strokeWidth={1} />
                    <Line points={[x2, y2, x, y2]} stroke={colors.dimension} strokeWidth={1} />
                    <Arrow
                        points={[x, y1, x, y2]}
                        stroke={colors.dimension}
                        fill={colors.dimension}
                        strokeWidth={1}
                        pointerLength={5}
                        pointerWidth={5}
                    />
                    <Text
                        x={x + 5}
                        y={(y1 + y2) / 2 - 5}
                        text={label}
                        fontSize={10}
                        fill={colors.dimension}
                        fontStyle="bold"
                    />
                </Group>
            );
        }
    };

    // Septic Tank Plan View
    const SepticTankPlan = ({ x, y }) => {
        const st = cfg.septicTank;
        const extL = st.intL + 2 * st.wallThick;
        const extW = st.intW + 2 * st.wallThick;

        return (
            <Group x={x} y={y}>
                {/* Outer walls */}
                <Rect
                    x={0}
                    y={0}
                    width={extL * scale}
                    height={extW * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />

                {/* Inner cavity */}
                <Rect
                    x={st.wallThick * scale}
                    y={st.wallThick * scale}
                    width={st.intL * scale}
                    height={st.intW * scale}
                    fill={colors.water}
                    opacity={0.3}
                    stroke={colors.text}
                    strokeWidth={1}
                />

                {/* Baffles */}
                {Array.from({ length: st.numBaffles }).map((_, i) => {
                    const spacing = st.intL / (st.numBaffles + 1);
                    const baffleX = st.wallThick + spacing * (i + 1);
                    return (
                        <Rect
                            key={`baffle-${i}`}
                            x={baffleX * scale}
                            y={st.wallThick * scale}
                            width={st.baffleThick * scale}
                            height={st.intW * scale}
                            fill={colors.concrete}
                            stroke={colors.text}
                            strokeWidth={1}
                        />
                    );
                })}

                {/* Inlet/Outlet indicators */}
                <Circle
                    x={(st.wallThick + 0.2) * scale}
                    y={(st.wallThick + st.intW / 2) * scale}
                    radius={5}
                    fill={colors.text}
                />
                <Text
                    x={(st.wallThick - 0.3) * scale}
                    y={(st.wallThick + st.intW / 2 - 0.1) * scale}
                    text="IN"
                    fontSize={8}
                    fill={colors.text}
                />

                <Circle
                    x={(st.wallThick + st.intL - 0.2) * scale}
                    y={(st.wallThick + st.intW / 2) * scale}
                    radius={5}
                    fill={colors.text}
                />
                <Text
                    x={(st.wallThick + st.intL - 0.4) * scale}
                    y={(st.wallThick + st.intW / 2 - 0.1) * scale}
                    text="OUT"
                    fontSize={8}
                    fill={colors.text}
                />

                {/* Title */}
                <Text
                    x={0}
                    y={-30}
                    text="SEPTIC TANK - PLAN VIEW"
                    fontSize={14}
                    fontStyle="bold"
                    fill={colors.text}
                />

                {/* Dimensions */}
                {drawDimension(0, 0, extL * scale, 0, `${extL.toFixed(2)}m`, -40)}
                {drawDimension(0, 0, 0, extW * scale, `${extW.toFixed(2)}m`, -40)}
            </Group>
        );
    };

    // Septic Tank Section View
    const SepticTankSection = ({ x, y }) => {
        const st = cfg.septicTank;
        const extL = st.intL + 2 * st.wallThick;
        const totalDepth = st.depth + st.bedThick + st.slabThick;

        return (
            <Group x={x} y={y}>
                {/* Ground level */}
                <Line
                    points={[
                        -50, 0,
                        (extL * scale) + 50, 0
                    ]}
                    stroke={colors.soil}
                    strokeWidth={2}
                    dash={[5, 5]}
                />

                {/* Slab */}
                <Rect
                    x={0}
                    y={0}
                    width={extL * scale}
                    height={st.slabThick * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />
                {drawHatch(0, 0, extL * scale, st.slabThick * scale, 45, 15)}

                {/* Walls */}
                <Rect
                    x={0}
                    y={st.slabThick * scale}
                    width={st.wallThick * scale}
                    height={st.depth * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />
                {drawHatch(0, st.slabThick * scale, st.wallThick * scale, st.depth * scale, 45, 15)}

                <Rect
                    x={(extL - st.wallThick) * scale}
                    y={st.slabThick * scale}
                    width={st.wallThick * scale}
                    height={st.depth * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />
                {drawHatch((extL - st.wallThick) * scale, st.slabThick * scale, st.wallThick * scale, st.depth * scale, 45, 15)}

                {/* Water level */}
                <Rect
                    x={st.wallThick * scale}
                    y={(st.slabThick + 0.3) * scale}
                    width={st.intL * scale}
                    height={(st.depth - 0.5) * scale}
                    fill={colors.water}
                    opacity={0.3}
                />
                <Line
                    points={[
                        st.wallThick * scale, (st.slabThick + 0.3) * scale,
                        (st.wallThick + st.intL) * scale, (st.slabThick + 0.3) * scale
                    ]}
                    stroke={colors.water}
                    strokeWidth={2}
                    dash={[10, 5]}
                />

                {/* Baffle walls */}
                {Array.from({ length: st.numBaffles }).map((_, i) => {
                    const spacing = st.intL / (st.numBaffles + 1);
                    const baffleX = st.wallThick + spacing * (i + 1);
                    const baffleH = st.baffleHeights[i] || 1.5;
                    return (
                        <Group key={`baffle-sec-${i}`}>
                            <Rect
                                x={baffleX * scale}
                                y={(st.slabThick + st.depth - baffleH) * scale}
                                width={st.baffleThick * scale}
                                height={baffleH * scale}
                                fill={colors.concrete}
                                stroke={colors.text}
                                strokeWidth={1}
                            />
                            {drawHatch(baffleX * scale, (st.slabThick + st.depth - baffleH) * scale, st.baffleThick * scale, baffleH * scale, 45, 10)}
                        </Group>
                    );
                })}

                {/* Bed */}
                <Rect
                    x={0}
                    y={(st.slabThick + st.depth) * scale}
                    width={extL * scale}
                    height={st.bedThick * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />
                {drawHatch(0, (st.slabThick + st.depth) * scale, extL * scale, st.bedThick * scale, 45, 15)}

                {/* Title */}
                <Text
                    x={0}
                    y={-30}
                    text="SEPTIC TANK - SECTION A-A"
                    fontSize={14}
                    fontStyle="bold"
                    fill={colors.text}
                />

                {/* Dimensions */}
                {drawDimension((extL * scale) + 20, st.slabThick * scale, (extL * scale) + 20, (st.slabThick + st.depth) * scale, `${st.depth.toFixed(2)}m`, 20)}
            </Group>
        );
    };

    // Manhole Plan View
    const ManholePlan = ({ x, y }) => {
        const mh = cfg.manhole;
        const extL = mh.intL + 2 * mh.wallThick;
        const extW = mh.intW + 2 * mh.wallThick;

        return (
            <Group x={x} y={y}>
                {/* Outer walls */}
                <Rect
                    x={0}
                    y={0}
                    width={extL * scale}
                    height={extW * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />

                {/* Inner cavity */}
                <Rect
                    x={mh.wallThick * scale}
                    y={mh.wallThick * scale}
                    width={mh.intL * scale}
                    height={mh.intW * scale}
                    fill={colors.water}
                    opacity={0.2}
                    stroke={colors.text}
                    strokeWidth={1}
                />

                {/* Cover outline */}
                <Rect
                    x={(mh.wallThick + (mh.intL - mh.coverL) / 2) * scale}
                    y={(mh.wallThick + (mh.intW - mh.coverW) / 2) * scale}
                    width={mh.coverL * scale}
                    height={mh.coverW * scale}
                    stroke={colors.text}
                    strokeWidth={1}
                    dash={[5, 5]}
                />

                {/* Title */}
                <Text
                    x={0}
                    y={-30}
                    text="INSPECTION CHAMBER - PLAN"
                    fontSize={14}
                    fontStyle="bold"
                    fill={colors.text}
                />

                {drawDimension(0, 0, extL * scale, 0, `${extL.toFixed(2)}m`, -40)}
            </Group>
        );
    };

    // Soakpit Plan View
    const SoakpitPlan = ({ x, y }) => {
        const sp = cfg.soakpit;

        if (sp.shape === 'circular') {
            const extDia = sp.diameter + 2 * sp.wallThick;
            const radius = (extDia / 2) * scale;

            return (
                <Group x={x} y={y}>
                    {/* Outer wall */}
                    <Circle
                        x={radius}
                        y={radius}
                        radius={radius}
                        fill={colors.concrete}
                        stroke={colors.text}
                        strokeWidth={2}
                    />

                    {/* Inner cavity with perforations */}
                    <Circle
                        x={radius}
                        y={radius}
                        radius={(sp.diameter / 2) * scale}
                        fill={colors.soil}
                        opacity={0.3}
                        stroke={colors.text}
                        strokeWidth={1}
                        dash={[5, 5]}
                    />

                    {/* Perforation indicators */}
                    {Array.from({ length: 8 }).map((_, i) => {
                        const angle = (i * 45 * Math.PI) / 180;
                        const r = ((sp.diameter / 2) + sp.wallThick / 2) * scale;
                        return (
                            <Circle
                                key={`perf-${i}`}
                                x={radius + r * Math.cos(angle)}
                                y={radius + r * Math.sin(angle)}
                                radius={3}
                                fill={colors.text}
                            />
                        );
                    })}

                    {/* Title */}
                    <Text
                        x={0}
                        y={-30}
                        text="SOAKPIT - PLAN VIEW"
                        fontSize={14}
                        fontStyle="bold"
                        fill={colors.text}
                    />

                    {drawDimension(0, radius, extDia * scale, radius, `Ø${extDia.toFixed(2)}m`, -40)}
                </Group>
            );
        } else {
            // Rectangular soakpit
            const extL = sp.diameter + 2 * sp.wallThick;
            const extW = sp.diameter + 2 * sp.wallThick;

            return (
                <Group x={x} y={y}>
                    <Rect
                        x={0}
                        y={0}
                        width={extL * scale}
                        height={extW * scale}
                        fill={colors.concrete}
                        stroke={colors.text}
                        strokeWidth={2}
                    />

                    <Rect
                        x={sp.wallThick * scale}
                        y={sp.wallThick * scale}
                        width={sp.diameter * scale}
                        height={sp.diameter * scale}
                        fill={colors.soil}
                        opacity={0.3}
                        stroke={colors.text}
                        strokeWidth={1}
                        dash={[5, 5]}
                    />

                    <Text
                        x={0}
                        y={-30}
                        text="SOAKPIT - PLAN VIEW (RECTANGULAR)"
                        fontSize={14}
                        fontStyle="bold"
                        fill={colors.text}
                    />

                    {drawDimension(0, 0, extL * scale, 0, `${extL.toFixed(2)}m`, -40)}
                </Group>
            );
        }
    };

    // Soakpit Section
    const SoakpitSection = ({ x, y }) => {
        const sp = cfg.soakpit;
        const extDia = sp.diameter + 2 * sp.wallThick;

        return (
            <Group x={x} y={y}>
                {/* Ground line */}
                <Line
                    points={[-50, 0, (extDia * scale) + 50, 0]}
                    stroke={colors.soil}
                    strokeWidth={2}
                    dash={[5, 5]}
                />

                {/* Cover slab */}
                <Rect
                    x={0}
                    y={0}
                    width={extDia * scale}
                    height={0.2 * scale}
                    fill={colors.concrete}
                    stroke={colors.text}
                    strokeWidth={2}
                />

                {/* Walls (perforated) */}
                <Line
                    points={[
                        0, 0.2 * scale,
                        0, (0.2 + sp.depth) * scale
                    ]}
                    stroke={colors.text}
                    strokeWidth={2}
                />

                <Line
                    points={[
                        extDia * scale, 0.2 * scale,
                        extDia * scale, (0.2 + sp.depth) * scale
                    ]}
                    stroke={colors.text}
                    strokeWidth={2}
                />

                {/* Perforation marks on walls */}
                {Array.from({ length: 10 }).map((_, i) => {
                    const yPos = (0.2 + (i + 1) * (sp.depth / 11)) * scale;
                    return (
                        <Group key={`perf-wall-${i}`}>
                            <Circle x={sp.wallThick * scale / 2} y={yPos} radius={2} fill={colors.text} />
                            <Circle x={(extDia - sp.wallThick / 2) * scale} y={yPos} radius={2} fill={colors.text} />
                        </Group>
                    );
                })}

                {/* Fill material */}
                <Rect
                    x={sp.wallThick * scale}
                    y={0.2 * scale}
                    width={sp.diameter * scale}
                    height={sp.depth * scale}
                    fill={colors.soil}
                    opacity={0.2}
                />

                {/* Base (perforated) */}
                <Line
                    points={[
                        0, (0.2 + sp.depth) * scale,
                        extDia * scale, (0.2 + sp.depth) * scale
                    ]}
                    stroke={colors.text}
                    strokeWidth={2}
                    dash={[10, 10]}
                />

                {/* Title */}
                <Text
                    x={0}
                    y={-30}
                    text="SOAKPIT - SECTION"
                    fontSize={14}
                    fontStyle="bold"
                    fill={colors.text}
                />

                {drawDimension((extDia * scale) + 20, 0.2 * scale, (extDia * scale) + 20, (0.2 + sp.depth) * scale, `${sp.depth.toFixed(2)}m`, 20)}
            </Group>
        );
    };

    return (
        <div className="w-full h-full overflow-auto" style={{ backgroundColor: colors.bg }}>
            <Stage width={1400} height={2200} ref={stageRef}>
                <Layer>
                    {/* Grid background */}
                    {Array.from({ length: 40 }).map((_, i) => (
                        <Line
                            key={`grid-v-${i}`}
                            points={[i * 50, 0, i * 50, 2200]}
                            stroke={colors.grid}
                            strokeWidth={0.5}
                            opacity={0.3}
                        />
                    ))}
                    {Array.from({ length: 50 }).map((_, i) => (
                        <Line
                            key={`grid-h-${i}`}
                            points={[0, i * 50, 1400, i * 50]}
                            stroke={colors.grid}
                            strokeWidth={0.5}
                            opacity={0.3}
                        />
                    ))}

                    {/* Title Block */}
                    <Group x={50} y={30}>
                        <Text
                            text="SEPTIC TANK SYSTEM - CONSTRUCTION DRAWINGS"
                            fontSize={20}
                            fontStyle="bold"
                            fill={colors.text}
                        />
                        <Text
                            y={30}
                            text="SCALE: 1:50 | ALL DIMENSIONS IN METERS"
                            fontSize={12}
                            fill={colors.text}
                        />
                        <Line points={[0, 50, 600, 50]} stroke={colors.text} strokeWidth={2} />
                    </Group>

                    {/* Septic Tank Drawings */}
                    <SepticTankPlan x={100} y={150} />
                    <SepticTankSection x={100} y={450} />

                    {/* Manhole Drawing */}
                    <ManholePlan x={100} y={750} />

                    {/* Soakpit Drawings */}
                    <SoakpitPlan x={100} y={1050} />
                    <SoakpitSection x={100} y={1400} />

                    {/* Legend */}
                    <Group x={50} y={1750}>
                        <Text text="LEGEND" fontSize={14} fontStyle="bold" fill={colors.text} />
                        <Rect x={0} y={30} width={30} height={20} fill={colors.concrete} stroke={colors.text} strokeWidth={1} />
                        <Text x={40} y={35} text="Concrete" fontSize={10} fill={colors.text} />
                        <Rect x={0} y={60} width={30} height={20} fill={colors.water} opacity={0.3} stroke={colors.text} strokeWidth={1} />
                        <Text x={40} y={65} text="Water/Effluent" fontSize={10} fill={colors.text} />
                        <Rect x={0} y={90} width={30} height={20} fill={colors.soil} opacity={0.3} stroke={colors.text} strokeWidth={1} />
                        <Text x={40} y={95} text="Soil/Fill" fontSize={10} fill={colors.text} />
                    </Group>

                    {/* Notes */}
                    <Group x={50} y={1950}>
                        <Text text="NOTES:" fontSize={12} fontStyle="bold" fill={colors.text} />
                        <Text y={25} text="1. All concrete to be grade C25/30 unless noted otherwise" fontSize={10} fill={colors.text} />
                        <Text y={45} text="2. Walls to be 200mm thick reinforced concrete" fontSize={10} fill={colors.text} />
                        <Text y={65} text="3. Provide adequate ventilation pipes" fontSize={10} fill={colors.text} />
                        <Text y={85} text="4. Manholes to have gas-tight covers" fontSize={10} fill={colors.text} />
                        <Text y={105} text="5. Soakpit walls to be perforated for drainage" fontSize={10} fill={colors.text} />
                    </Group>
                </Layer>
            </Stage>
        </div>
    );
};

export default SepticSystem2DDrawings;