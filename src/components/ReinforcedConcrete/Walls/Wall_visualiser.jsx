import React, { useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arrow, Shape } from 'react-konva';

/**
 * RC Wall Detailed Drawing Component - BS 8110 / EC2 Compliant
 * Professional visualization of reinforced concrete wall details
 */

const WallDetailedDrawing = ({ design, inputs }) => {
    const [activeView, setActiveView] = useState('section');

    // Extract parameters
    const t = inputs.thickness; // mm
    const h = inputs.height * 1000; // Convert m to mm
    const length = inputs.length * 1000; // Convert m to mm
    const cover = inputs.coverDepth;

    const vertDia = design.reinforcement.vertical.diameter;
    const vertSpacing = design.reinforcement.vertical.spacing;
    const horizDia = design.reinforcement.horizontal.diameter;
    const horizSpacing = design.reinforcement.horizontal.spacing;

    const concreteGrade = inputs.concreteGrade;
    const steelGrade = inputs.steelGrade;
    const exposureClass = inputs.exposureClass;

    // Calculated values
    const lapLength = 40 * vertDia; // 40φ per BS 8110
    const kickerHeight = 75;

    // Drawing scales
    const sectionScale = 1.2;
    const elevationScale = 0.15;
    const detailScale = 2.0;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">
                    Detailed RC Wall Drawings - BS 8110 / EC2
                </h3>
                <div className="flex gap-2">
                    {['section', 'elevation', 'details'].map(view => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${activeView === view
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {view.charAt(0).toUpperCase() + view.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {activeView === 'section' && (
                <SectionView
                    t={t}
                    h={h}
                    cover={cover}
                    vertDia={vertDia}
                    vertSpacing={vertSpacing}
                    horizDia={horizDia}
                    horizSpacing={horizSpacing}
                    scale={sectionScale}
                    kickerHeight={kickerHeight}
                />
            )}

            {activeView === 'elevation' && (
                <ElevationView
                    length={length}
                    h={h}
                    vertSpacing={vertSpacing}
                    horizSpacing={horizSpacing}
                    scale={elevationScale}
                    lapLength={lapLength}
                    kickerHeight={kickerHeight}
                />
            )}

            {activeView === 'details' && (
                <DetailViews
                    t={t}
                    vertDia={vertDia}
                    horizDia={horizDia}
                    cover={cover}
                    kickerHeight={kickerHeight}
                    lapLength={lapLength}
                    scale={detailScale}
                />
            )}

            {/* Legend and Notes */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                    <h4 className="font-semibold text-sm mb-2 text-blue-900">Material Specifications</h4>
                    <ul className="text-xs space-y-1 text-gray-700">
                        <li>• Concrete: C{concreteGrade} (fck = {concreteGrade} MPa)</li>
                        <li>• Steel: Grade {steelGrade} (fy = {steelGrade} MPa)</li>
                        <li>• Cover: {cover}mm for {exposureClass}</li>
                        <li>• Vertical: T{vertDia} @ {vertSpacing}mm c/c</li>
                        <li>• Horizontal: T{horizDia} @ {horizSpacing}mm c/c</li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold text-sm mb-2 text-blue-900">Design Standards</h4>
                    <ul className="text-xs space-y-1 text-gray-700">
                        <li>• BS EN 1992-1-1:2004 (Eurocode 2)</li>
                        <li>• BS 8110-1:1997</li>
                        <li>• Lap length: {lapLength}mm (40φ)</li>
                        <li>• Kicker height: {kickerHeight}mm</li>
                        <li>• Status: <span className={design.designStatus === 'PASS' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{design.designStatus}</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// Section View Component
const SectionView = ({ t, h, cover, vertDia, vertSpacing, horizDia, horizSpacing, scale, kickerHeight }) => {
    const drawHeight = Math.min(h, 3000); // Show max 3m
    const width = 1200;
    const height = 800;
    const offsetX = 200;
    const offsetY = 100;

    const tScaled = t * scale;
    const hScaled = drawHeight * scale;
    const coverScaled = cover * scale;

    return (
        <Stage width={width} height={height}>
            <Layer>
                {/* Title */}
                <Text
                    x={offsetX + tScaled / 2}
                    y={offsetY - 60}
                    text="SECTION A-A"
                    fontSize={20}
                    fontStyle="bold"
                    fill="#000"
                    align="center"
                    offsetX={60}
                />

                {/* Kicker */}
                <Rect
                    x={offsetX - 50 * scale}
                    y={offsetY}
                    width={tScaled + 100 * scale}
                    height={kickerHeight * scale}
                    fill="#d0d0d0"
                    stroke="#000"
                    strokeWidth={2}
                />

                {/* Main wall outline */}
                <Rect
                    x={offsetX}
                    y={offsetY + kickerHeight * scale}
                    width={tScaled}
                    height={hScaled}
                    fill="#e8e8e8"
                    stroke="#000"
                    strokeWidth={3}
                />

                {/* Cover zone (dashed) */}
                <Rect
                    x={offsetX + coverScaled}
                    y={offsetY + kickerHeight * scale + coverScaled}
                    width={tScaled - 2 * coverScaled}
                    height={hScaled - 2 * coverScaled}
                    stroke="#ff6b6b"
                    strokeWidth={1.5}
                    dash={[10, 5]}
                />

                {/* Vertical reinforcement bars */}
                {Array.from({ length: Math.floor(drawHeight / vertSpacing) + 1 }).map((_, i) => {
                    const y = offsetY + kickerHeight * scale + coverScaled + i * vertSpacing * scale;
                    if (y > offsetY + kickerHeight * scale + hScaled - coverScaled) return null;

                    return (
                        <React.Fragment key={`vert-${i}`}>
                            {/* Front face bars */}
                            <Circle
                                x={offsetX + coverScaled + vertDia / 2 * scale + 10}
                                y={y}
                                radius={vertDia / 2 * scale}
                                fill="#2c3e50"
                                stroke="#1a252f"
                                strokeWidth={1.5}
                            />
                            <Line
                                points={[
                                    offsetX + coverScaled + 10, y - vertDia / 2 * scale,
                                    offsetX + coverScaled + vertDia * scale + 10, y + vertDia / 2 * scale
                                ]}
                                stroke="#fff"
                                strokeWidth={1}
                            />
                            <Line
                                points={[
                                    offsetX + coverScaled + 10, y + vertDia / 2 * scale,
                                    offsetX + coverScaled + vertDia * scale + 10, y - vertDia / 2 * scale
                                ]}
                                stroke="#fff"
                                strokeWidth={1}
                            />

                            {/* Back face bars */}
                            <Circle
                                x={offsetX + tScaled - coverScaled - vertDia / 2 * scale - 10}
                                y={y}
                                radius={vertDia / 2 * scale}
                                fill="#2c3e50"
                                stroke="#1a252f"
                                strokeWidth={1.5}
                            />
                            <Line
                                points={[
                                    offsetX + tScaled - coverScaled - vertDia * scale - 10, y - vertDia / 2 * scale,
                                    offsetX + tScaled - coverScaled - 10, y + vertDia / 2 * scale
                                ]}
                                stroke="#fff"
                                strokeWidth={1}
                            />
                            <Line
                                points={[
                                    offsetX + tScaled - coverScaled - vertDia * scale - 10, y + vertDia / 2 * scale,
                                    offsetX + tScaled - coverScaled - 10, y - vertDia / 2 * scale
                                ]}
                                stroke="#fff"
                                strokeWidth={1}
                            />
                        </React.Fragment>
                    );
                })}

                {/* Horizontal reinforcement */}
                {Array.from({ length: Math.floor(drawHeight / horizSpacing) + 1 }).map((_, i) => {
                    const y = offsetY + kickerHeight * scale + coverScaled + i * horizSpacing * scale;
                    if (y > offsetY + kickerHeight * scale + hScaled - coverScaled) return null;

                    return (
                        <React.Fragment key={`horiz-${i}`}>
                            {/* Front face */}
                            <Rect
                                x={offsetX + coverScaled + 5}
                                y={y - horizDia / 2 * scale}
                                width={tScaled / 2 - coverScaled - 15}
                                height={horizDia * scale}
                                fill="#7f8c8d"
                                stroke="#5d6d7e"
                                strokeWidth={1}
                                cornerRadius={horizDia / 2 * scale}
                            />
                            {/* Back face */}
                            <Rect
                                x={offsetX + tScaled / 2 + 10}
                                y={y - horizDia / 2 * scale}
                                width={tScaled / 2 - coverScaled - 15}
                                height={horizDia * scale}
                                fill="#7f8c8d"
                                stroke="#5d6d7e"
                                strokeWidth={1}
                                cornerRadius={horizDia / 2 * scale}
                            />
                        </React.Fragment>
                    );
                })}

                {/* Dimensions */}
                {/* Thickness dimension */}
                <Arrow
                    points={[
                        offsetX, offsetY - 40,
                        offsetX + tScaled, offsetY - 40
                    ]}
                    stroke="#000"
                    strokeWidth={2}
                    pointerLength={8}
                    pointerWidth={8}
                    pointerAtBeginning
                />
                <Text
                    x={offsetX + tScaled / 2}
                    y={offsetY - 70}
                    text={`t = ${t}mm`}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#000"
                    align="center"
                    offsetX={40}
                />

                {/* Height dimension */}
                <Arrow
                    points={[
                        offsetX - 80, offsetY + kickerHeight * scale,
                        offsetX - 80, offsetY + kickerHeight * scale + hScaled
                    ]}
                    stroke="#000"
                    strokeWidth={2}
                    pointerLength={8}
                    pointerWidth={8}
                    pointerAtBeginning
                />
                <Text
                    x={offsetX - 120}
                    y={offsetY + kickerHeight * scale + hScaled / 2}
                    text={`h = ${drawHeight}mm`}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#000"
                    rotation={-90}
                    offsetX={50}
                />

                {/* Cover dimension */}
                <Arrow
                    points={[
                        offsetX, offsetY + kickerHeight * scale + hScaled + 50,
                        offsetX + coverScaled, offsetY + kickerHeight * scale + hScaled + 50
                    ]}
                    stroke="#ff6b6b"
                    strokeWidth={2}
                    pointerLength={6}
                    pointerWidth={6}
                    pointerAtBeginning
                />
                <Text
                    x={offsetX + coverScaled / 2}
                    y={offsetY + kickerHeight * scale + hScaled + 65}
                    text={`c = ${cover}mm`}
                    fontSize={14}
                    fontStyle="bold"
                    fill="#ff6b6b"
                    align="center"
                    offsetX={30}
                />

                {/* Labels for reinforcement */}
                <Text
                    x={offsetX + tScaled + 40}
                    y={offsetY + kickerHeight * scale + 100}
                    text={`T${vertDia} @ ${vertSpacing}mm c/c`}
                    fontSize={13}
                    fill="#000"
                />
                <Text
                    x={offsetX + tScaled + 40}
                    y={offsetY + kickerHeight * scale + 130}
                    text="(Vertical - Both faces)"
                    fontSize={11}
                    fill="#666"
                />

                <Text
                    x={offsetX + tScaled + 40}
                    y={offsetY + kickerHeight * scale + 200}
                    text={`T${horizDia} @ ${horizSpacing}mm c/c`}
                    fontSize={13}
                    fill="#000"
                />
                <Text
                    x={offsetX + tScaled + 40}
                    y={offsetY + kickerHeight * scale + 230}
                    text="(Horizontal - Both faces)"
                    fontSize={11}
                    fill="#666"
                />
            </Layer>
        </Stage>
    );
};

// Elevation View Component
const ElevationView = ({ length, h, vertSpacing, horizSpacing, scale, lapLength, kickerHeight }) => {
    const drawHeight = Math.min(h, 3000);
    const width = 1400;
    const height = 700;
    const offsetX = 100;
    const offsetY = 100;

    const lengthScaled = length * scale;
    const hScaled = drawHeight * scale;

    return (
        <Stage width={width} height={height}>
            <Layer>
                {/* Title */}
                <Text
                    x={offsetX + lengthScaled / 2}
                    y={offsetY - 60}
                    text="WALL ELEVATION"
                    fontSize={20}
                    fontStyle="bold"
                    fill="#000"
                    align="center"
                    offsetX={80}
                />

                {/* Wall outline */}
                <Rect
                    x={offsetX}
                    y={offsetY}
                    width={lengthScaled}
                    height={hScaled}
                    fill="#f5f5f5"
                    stroke="#000"
                    strokeWidth={3}
                />

                {/* Kicker line */}
                {kickerHeight > 0 && (
                    <>
                        <Line
                            points={[offsetX, offsetY, offsetX + lengthScaled, offsetY]}
                            stroke="#000"
                            strokeWidth={4}
                        />
                        <Line
                            points={[
                                offsetX - 50, offsetY - kickerHeight * scale,
                                offsetX + lengthScaled + 50, offsetY - kickerHeight * scale
                            ]}
                            stroke="#666"
                            strokeWidth={1}
                            dash={[8, 4]}
                        />
                    </>
                )}

                {/* Vertical reinforcement pattern (simplified) */}
                {Array.from({ length: Math.floor(drawHeight / (vertSpacing * 2)) }).map((_, i) => {
                    const y = offsetY + i * vertSpacing * 2 * scale;
                    return (
                        <React.Fragment key={`vert-line-${i}`}>
                            <Line
                                points={[offsetX + 30, y, offsetX + 30, offsetY + hScaled]}
                                stroke="#2c3e50"
                                strokeWidth={1.5}
                            />
                            <Line
                                points={[offsetX + lengthScaled - 30, y, offsetX + lengthScaled - 30, offsetY + hScaled]}
                                stroke="#2c3e50"
                                strokeWidth={1.5}
                            />
                        </React.Fragment>
                    );
                })}

                {/* Horizontal reinforcement pattern */}
                {Array.from({ length: Math.floor(drawHeight / horizSpacing) + 1 }).map((_, i) => {
                    const y = offsetY + i * horizSpacing * scale;
                    if (y > offsetY + hScaled) return null;
                    return (
                        <Line
                            key={`horiz-line-${i}`}
                            points={[offsetX, y, offsetX + lengthScaled, y]}
                            stroke="#7f8c8d"
                            strokeWidth={1}
                            dash={[6, 3]}
                        />
                    );
                })}

                {/* Starter bars (showing projection) */}
                {[offsetX + 50, offsetX + lengthScaled / 2, offsetX + lengthScaled - 50].map((x, idx) => {
                    const starterTop = offsetY - lapLength * scale;
                    return (
                        <React.Fragment key={`starter-${idx}`}>
                            <Line
                                points={[x, offsetY, x, starterTop]}
                                stroke="#e74c3c"
                                strokeWidth={3}
                            />
                            {/* Arrow at top */}
                            <Line
                                points={[
                                    x - 10, starterTop + 20,
                                    x, starterTop,
                                    x + 10, starterTop + 20
                                ]}
                                stroke="#e74c3c"
                                strokeWidth={3}
                                lineCap="round"
                                lineJoin="round"
                            />
                        </React.Fragment>
                    );
                })}

                {/* Floor level line */}
                <Line
                    points={[
                        offsetX - 100, offsetY - kickerHeight * scale - 50,
                        offsetX + lengthScaled + 100, offsetY - kickerHeight * scale - 50
                    ]}
                    stroke="#000"
                    strokeWidth={2}
                    dash={[15, 10, 5, 10]}
                />
                <Text
                    x={offsetX + lengthScaled + 120}
                    y={offsetY - kickerHeight * scale - 60}
                    text="STRUCTURAL FLOOR LEVEL"
                    fontSize={12}
                    fill="#000"
                />

                {/* Dimensions */}
                <Arrow
                    points={[
                        offsetX, offsetY + hScaled + 80,
                        offsetX + lengthScaled, offsetY + hScaled + 80
                    ]}
                    stroke="#000"
                    strokeWidth={2}
                    pointerLength={10}
                    pointerWidth={10}
                    pointerAtBeginning
                />
                <Text
                    x={offsetX + lengthScaled / 2}
                    y={offsetY + hScaled + 95}
                    text={`Length = ${(length / 1000).toFixed(1)}m (${length.toFixed(0)}mm)`}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#000"
                    align="center"
                    offsetX={120}
                />

                <Arrow
                    points={[
                        offsetX - 80, offsetY,
                        offsetX - 80, offsetY + hScaled
                    ]}
                    stroke="#000"
                    strokeWidth={2}
                    pointerLength={10}
                    pointerWidth={10}
                    pointerAtBeginning
                />
                <Text
                    x={offsetX - 100}
                    y={offsetY + hScaled / 2}
                    text={`H = ${(drawHeight / 1000).toFixed(1)}m`}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#000"
                    rotation={-90}
                    offsetX={50}
                />

                {/* Lap length annotation */}
                <Arrow
                    points={[
                        offsetX + 50 + 30, offsetY,
                        offsetX + 50 + 30, offsetY - lapLength * scale
                    ]}
                    stroke="#e74c3c"
                    strokeWidth={1.5}
                    pointerLength={6}
                    pointerWidth={6}
                    pointerAtBeginning
                />
                <Text
                    x={offsetX + 50 + 50}
                    y={offsetY - lapLength * scale / 2}
                    text={`Lap = ${lapLength}mm`}
                    fontSize={12}
                    fill="#e74c3c"
                    fontStyle="bold"
                />
            </Layer>
        </Stage>
    );
};

// Detail Views Component
const DetailViews = ({ t, vertDia, horizDia, cover, kickerHeight, lapLength, scale }) => {
    const width = 1400;
    const height = 900;

    return (
        <Stage width={width} height={height}>
            <Layer>
                {/* Detail A: Starter Bars */}
                <Group x={50} y={50}>
                    <StarterBarDetail
                        t={t}
                        vertDia={vertDia}
                        cover={cover}
                        kickerHeight={kickerHeight}
                        lapLength={lapLength}
                        scale={scale}
                    />
                </Group>

                {/* Detail B: Corner Connection */}
                <Group x={700} y={50}>
                    <CornerDetail
                        t={t}
                        vertDia={vertDia}
                        horizDia={horizDia}
                        cover={cover}
                        scale={scale}
                    />
                </Group>

                {/* Detail C: U-bar Detail */}
                <Group x={50} y={500}>
                    <UBarDetail
                        t={t}
                        uDia={12}
                        vertDia={vertDia}
                        cover={cover}
                        scale={scale}
                    />
                </Group>
            </Layer>
        </Stage>
    );
};

// Starter Bar Detail
const StarterBarDetail = ({ t, vertDia, cover, kickerHeight, lapLength, scale }) => {
    const tScaled = t * scale;
    const kickerScaled = kickerHeight * scale;
    const lapScaled = lapLength * scale;
    const coverScaled = cover * scale;

    return (
        <>
            {/* Detail label circle */}
            <Circle x={-80} y={kickerScaled + lapScaled / 2} radius={50} stroke="#000" strokeWidth={3} />
            <Text x={-110} y={kickerScaled + lapScaled / 2 - 15} text="DETAIL" fontSize={14} fontStyle="bold" />
            <Text x={-100} y={kickerScaled + lapScaled / 2 + 5} text="'A'" fontSize={18} fontStyle="bold" />

            {/* Foundation */}
            <Rect
                x={-50}
                y={0}
                width={tScaled + 100}
                height={150}
                fill="#c0c0c0"
                stroke="#000"
                strokeWidth={2}
            />

            {/* Kicker */}
            <Rect
                x={-25}
                y={-kickerScaled}
                width={tScaled + 50}
                height={kickerScaled}
                fill="#d8d8d8"
                stroke="#000"
                strokeWidth={2}
            />

            {/* Wall above */}
            <Rect
                x={0}
                y={-kickerScaled - lapScaled - 100}
                width={tScaled}
                height={lapScaled + 100}
                fill="#e8e8e8"
                stroke="#000"
                strokeWidth={3}
            />

            {/* Starter bars */}
            {[coverScaled + 10, tScaled - coverScaled - 10].map((x, idx) => (
                <React.Fragment key={`starter-${idx}`}>
                    <Line
                        points={[x, 75, x, -kickerScaled - lapScaled]}
                        stroke="#e74c3c"
                        strokeWidth={4}
                    />
                    <Circle x={x} y={90} radius={vertDia * scale / 2} fill="#e74c3c" stroke="#000" strokeWidth={1} />
                </React.Fragment>
            ))}

            {/* Wall vertical bars (lapping) */}
            {[coverScaled + 25, tScaled - coverScaled + 5].map((x, idx) => (
                <Line
                    key={`wall-bar-${idx}`}
                    points={[x, -kickerScaled, x, -kickerScaled - lapScaled - 80]}
                    stroke="#2c3e50"
                    strokeWidth={4}
                />
            ))}

            {/* Dimension for lap */}
            <Arrow
                points={[
                    tScaled + 80, -kickerScaled,
                    tScaled + 80, -kickerScaled - lapScaled
                ]}
                stroke="#000"
                strokeWidth={2}
                pointerLength={8}
                pointerWidth={8}
                pointerAtBeginning
            />
            <Text
                x={tScaled + 95}
                y={-kickerScaled - lapScaled / 2 - 10}
                text={`LAP =`}
                fontSize={14}
                fontStyle="bold"
            />
            <Text
                x={tScaled + 95}
                y={-kickerScaled - lapScaled / 2 + 8}
                text={`${lapLength}mm`}
                fontSize={14}
                fontStyle="bold"
            />

            {/* Title */}
            <Text
                x={tScaled / 2 - 100}
                y={-kickerScaled - lapScaled - 150}
                text="STARTER BARS & KICKER DETAIL"
                fontSize={16}
                fontStyle="bold"
                fill="#000"
            />
        </>
    );
};

// Corner Detail - Typical L-Junction
const CornerDetail = ({ t, vertDia, horizDia, cover, scale }) => {
    const tScaled = t * scale;
    const coverScaled = cover * scale;

    return (
        <Group>
            {/* Detail label */}
            <Circle x={-80} y={-50} radius={50} stroke="#000" strokeWidth={3} />
            <Text x={-110} y={-65} text="DETAIL" fontSize={14} fontStyle="bold" />
            <Text x={-100} y={-45} text="'B'" fontSize={18} fontStyle="bold" />

            {/* Corner geometry */}
            <Rect
                x={0}
                y={0}
                width={tScaled + 300}
                height={tScaled}
                fill="#e8e8e8"
                stroke="#000"
                strokeWidth={3}
            />
            <Rect
                x={0}
                y={0}
                width={tScaled}
                height={tScaled + 300}
                fill="#e8e8e8"
                stroke="#000"
                strokeWidth={3}
            />

            {/* Corner reinforcement (L-bars) */}
            <Line
                points={[
                    coverScaled, tScaled + 250,
                    coverScaled, coverScaled,
                    tScaled + 250, coverScaled
                ]}
                stroke="#e74c3c"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
            />
            <Line
                points={[
                    tScaled - coverScaled, tScaled + 250,
                    tScaled - coverScaled, tScaled - coverScaled,
                    tScaled + 250, tScaled - coverScaled
                ]}
                stroke="#e74c3c"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
            />

            {/* Horizontal bars inside corner */}
            {[50, 100, 150, 200].map((pos, i) => (
                <Circle
                    key={`corner-h-${i}`}
                    x={tScaled + pos}
                    y={tScaled / 2}
                    radius={horizDia * scale / 2}
                    fill="#34495e"
                />
            ))}

            <Text
                x={0}
                y={tScaled + 320}
                text="CORNER JUNCTION DETAIL"
                fontSize={16}
                fontStyle="bold"
                fill="#000"
            />
        </Group>
    );
};

// U-Bar Detail
const UBarDetail = ({ t, uDia, vertDia, cover, scale }) => {
    const tScaled = t * scale;
    const coverScaled = cover * scale;
    const uWidth = tScaled - (2 * coverScaled);
    const uHeight = 150 * scale;

    return (
        <>
            {/* Detail label */}
            <Circle x={-80} y={-100} radius={50} stroke="#000" strokeWidth={3} />
            <Text x={-110} y={-115} text="DETAIL" fontSize={14} fontStyle="bold" />
            <Text x={-100} y={-95} text="'C'" fontSize={18} fontStyle="bold" />

            {/* Wall section */}
            <Rect
                x={0}
                y={0}
                width={tScaled}
                height={-500}
                fill="#e8e8e8"
                stroke="#000"
                strokeWidth={3}
            />

            {/* U-bar shape */}
            <Line
                points={[
                    coverScaled, -150,
                    coverScaled, -150 - uHeight,
                    coverScaled + uWidth, -150 - uHeight,
                    coverScaled + uWidth, -150
                ]}
                stroke="#9b59b6"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
            />

            {/* Vertical bars inside U */}
            {[25, uWidth - 25].map((xOffset, idx) => (
                <React.Fragment key={`inside-bar-${idx}`}>
                    <Line
                        points={[
                            coverScaled + xOffset, -100,
                            coverScaled + xOffset, -450
                        ]}
                        stroke="#2c3e50"
                        strokeWidth={4}
                    />
                    <Circle
                        x={coverScaled + xOffset}
                        y={-275}
                        radius={vertDia * scale / 2}
                        fill="#2c3e50"
                        stroke="#000"
                        strokeWidth={1.5}
                    />
                </React.Fragment>
            ))}

            {/* Dimension */}
            <Arrow
                points={[
                    coverScaled, -150 - uHeight - 60,
                    coverScaled + uWidth, -150 - uHeight - 60
                ]}
                stroke="#000"
                strokeWidth={2}
                pointerLength={8}
                pointerWidth={8}
                pointerAtBeginning
            />
            <Text
                x={coverScaled + uWidth / 2 - 60}
                y={-150 - uHeight - 90}
                text={`U-BAR WIDTH = ${((uWidth) / scale).toFixed(0)}mm`}
                fontSize={13}
                fontStyle="bold"
                fill="#000"
            />

            {/* Labels */}
            <Text
                x={-200}
                y={-200}
                text="TWO FIXING BARS ARE"
                fontSize={12}
                fill="#000"
                align="right"
            />
            <Text
                x={-200}
                y={-180}
                text="PLACED INSIDE 'U' BARS"
                fontSize={12}
                fill="#000"
                align="right"
            />

            <Text
                x={tScaled / 2 - 80}
                y={20}
                text="U-BAR DETAIL FOR SHEAR WALLS"
                fontSize={16}
                fontStyle="bold"
                fill="#000"
            />

            <Text
                x={0}
                y={50}
                text={`Typical spacing: 300mm c/c`}
                fontSize={11}
                fill="#666"
            />
        </>
    );
};

export default WallDetailedDrawing; 