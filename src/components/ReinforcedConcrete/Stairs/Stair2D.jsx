import React, { useState } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text, Group, Arrow } from 'react-konva';
import { X } from 'lucide-react';

const Stair2D = ({ isOpen, onClose, data, codeType, stairType, cantileverType, theme }) => {
    const [viewType, setViewType] = useState('section'); // 'section', 'elevation', 'plan'

    if (!isOpen) return null;

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const lineColor = isDark ? '#e2e8f0' : '#1f2937';
    const dimColor = isDark ? '#60a5fa' : '#2563eb';
    const rebarColor = '#ef4444';
    const concreteColor = isDark ? '#475569' : '#cbd5e1';
    const textColor = isDark ? '#f1f5f9' : '#111827';

    // Extract design parameters
    const inputs = data?.inputs || {};
    const results = data?.results || {};

    const span = inputs.span || 3.0;
    const width = inputs.width || 1.2;
    const waist = (inputs.waist_thickness || 150) / 1000; // Convert to meters
    const riser = (inputs.riser_height || 175) / 1000;
    const tread = (inputs.tread_length || 250) / 1000;
    const numRisers = inputs.num_risers || 14;
    const cover = (inputs.cover || 30) / 1000;

    // Reinforcement details from results
    const mainSteel = results.reinforcement?.main_steel || 'T12-200';
    const distributionSteel = results.reinforcement?.distribution_steel || 'T10-250';

    // Canvas dimensions
    const canvasWidth = 1000;
    const canvasHeight = 700;
    const padding = 60;

    // Scale calculation
    const availableWidth = canvasWidth - 2 * padding;
    const availableHeight = canvasHeight - 2 * padding;

    const scaleX = availableWidth / Math.max(span, width * 1.5);
    const scaleY = availableHeight / Math.max(span, numRisers * riser * 1.2);
    const scale = Math.min(scaleX, scaleY);

    // Helper function to convert real coordinates to canvas coordinates
    const toCanvasX = (x) => padding + x * scale;
    const toCanvasY = (y) => canvasHeight - padding - y * scale;

    // Section View (Side view showing stair profile)
    const renderSectionView = () => {
        const steps = [];
        const waistLine = [];
        const rebars = [];
        const dimensions = [];

        // Calculate stair angle
        const totalRise = numRisers * riser;
        const totalRun = (numRisers - 1) * tread;
        const angle = Math.atan(totalRise / totalRun);

        if (stairType === 'simply_supported' || stairType === 'supported') {
            // Simply supported stair section

            // Draw waist (inclined slab)
            for (let i = 0; i < numRisers; i++) {
                const x1 = i * tread;
                const y1 = i * riser;
                const x2 = (i + 1) * tread;
                const y2 = (i + 1) * riser;

                // Waist underside
                const waistOffsetX = waist * Math.sin(angle);
                const waistOffsetY = waist * Math.cos(angle);

                waistLine.push(
                    toCanvasX(x1),
                    toCanvasY(y1),
                    toCanvasX(x2),
                    toCanvasY(y2)
                );

                // Step treads and risers
                steps.push(
                    <Group key={`step-${i}`}>
                        {/* Riser */}
                        <Line
                            points={[
                                toCanvasX(i * tread),
                                toCanvasY(i * riser),
                                toCanvasX(i * tread),
                                toCanvasY((i + 1) * riser),
                            ]}
                            stroke={lineColor}
                            strokeWidth={2}
                        />
                        {/* Tread */}
                        <Line
                            points={[
                                toCanvasX(i * tread),
                                toCanvasY((i + 1) * riser),
                                toCanvasX((i + 1) * tread),
                                toCanvasY((i + 1) * riser),
                            ]}
                            stroke={lineColor}
                            strokeWidth={2}
                        />
                    </Group>
                );
            }

            // Draw waist slab
            const waistPoints = [];
            for (let i = 0; i <= numRisers; i++) {
                const x = i * tread;
                const y = i * riser;
                waistPoints.push(toCanvasX(x), toCanvasY(y - waist * Math.cos(angle)));
            }
            for (let i = numRisers; i >= 0; i--) {
                const x = i * tread;
                const y = i * riser;
                waistPoints.push(toCanvasX(x), toCanvasY(y));
            }

            steps.push(
                <Line
                    key="waist-fill"
                    points={waistPoints}
                    closed
                    fill={concreteColor}
                    opacity={0.3}
                />
            );

            // Draw main reinforcement bars (bottom - tension zone)
            const numBars = 5;
            const barSpacing = totalRun / (numBars + 1);
            for (let i = 1; i <= numBars; i++) {
                const x = i * barSpacing;
                const y = (x / totalRun) * totalRise;
                rebars.push(
                    <Circle
                        key={`main-bar-${i}`}
                        x={toCanvasX(x)}
                        y={toCanvasY(y - cover)}
                        radius={4}
                        fill={rebarColor}
                        stroke={rebarColor}
                        strokeWidth={1}
                    />
                );
            }

            // Draw distribution steel (perpendicular to main - shown as dashed line)
            rebars.push(
                <Line
                    key="distribution-steel"
                    points={[
                        toCanvasX(totalRun * 0.2),
                        toCanvasY(totalRise * 0.2 - waist + cover * 2),
                        toCanvasX(totalRun * 0.8),
                        toCanvasY(totalRise * 0.8 - waist + cover * 2),
                    ]}
                    stroke={rebarColor}
                    strokeWidth={2}
                    dash={[10, 5]}
                />
            );

            // Add dimensions
            dimensions.push(
                // Span dimension
                <Group key="span-dim">
                    <Arrow
                        points={[
                            toCanvasX(0),
                            toCanvasY(-0.3),
                            toCanvasX(totalRun),
                            toCanvasY(-0.3),
                        ]}
                        stroke={dimColor}
                        fill={dimColor}
                        strokeWidth={2}
                        pointerLength={8}
                        pointerWidth={8}
                    />
                    <Text
                        x={toCanvasX(totalRun / 2) - 40}
                        y={toCanvasY(-0.3) - 25}
                        text={`Span: ${span.toFixed(2)}m`}
                        fontSize={14}
                        fill={dimColor}
                        fontStyle="bold"
                    />
                </Group>,

                // Rise dimension
                <Group key="rise-dim">
                    <Arrow
                        points={[
                            toCanvasX(-0.3),
                            toCanvasY(0),
                            toCanvasX(-0.3),
                            toCanvasY(totalRise),
                        ]}
                        stroke={dimColor}
                        fill={dimColor}
                        strokeWidth={2}
                        pointerLength={8}
                        pointerWidth={8}
                    />
                    <Text
                        x={toCanvasX(-0.3) - 70}
                        y={toCanvasY(totalRise / 2) - 10}
                        text={`Rise: ${(totalRise).toFixed(2)}m`}
                        fontSize={14}
                        fill={dimColor}
                        fontStyle="bold"
                    />
                </Group>,

                // Waist thickness
                <Group key="waist-dim">
                    <Line
                        points={[
                            toCanvasX(totalRun * 0.5),
                            toCanvasY(totalRise * 0.5),
                            toCanvasX(totalRun * 0.5),
                            toCanvasY(totalRise * 0.5 - waist * Math.cos(angle)),
                        ]}
                        stroke={dimColor}
                        strokeWidth={2}
                        dash={[5, 5]}
                    />
                    <Text
                        x={toCanvasX(totalRun * 0.5) + 10}
                        y={toCanvasY(totalRise * 0.5 - waist * 0.5)}
                        text={`Waist: ${(waist * 1000).toFixed(0)}mm`}
                        fontSize={12}
                        fill={dimColor}
                    />
                </Group>
            );

        } else if (stairType === 'cantilever') {
            // Cantilever stair section

            if (cantileverType === 'side_support') {
                // Side wall/beam support - show wall and cantilevering steps
                const wallThickness = 0.25;

                // Draw support wall
                steps.push(
                    <Rect
                        key="support-wall"
                        x={toCanvasX(0)}
                        y={toCanvasY(totalRise + 0.5)}
                        width={wallThickness * scale}
                        height={(totalRise + 0.5) * scale}
                        fill={concreteColor}
                        stroke={lineColor}
                        strokeWidth={2}
                    />
                );

                // Draw cantilevering steps
                for (let i = 0; i < numRisers; i++) {
                    const y = i * riser;
                    const cantileverLength = width;

                    steps.push(
                        <Group key={`cant-step-${i}`}>
                            {/* Step slab */}
                            <Rect
                                x={toCanvasX(wallThickness)}
                                y={toCanvasY(y + riser)}
                                width={cantileverLength * scale}
                                height={riser * scale}
                                fill={concreteColor}
                                opacity={0.4}
                                stroke={lineColor}
                                strokeWidth={2}
                            />
                            {/* Riser face */}
                            <Line
                                points={[
                                    toCanvasX(wallThickness),
                                    toCanvasY(y),
                                    toCanvasX(wallThickness + cantileverLength),
                                    toCanvasY(y),
                                ]}
                                stroke={lineColor}
                                strokeWidth={2}
                            />
                        </Group>
                    );

                    // Reinforcement - top bars (tension in cantilever)
                    rebars.push(
                        <Circle
                            key={`cant-rebar-${i}`}
                            x={toCanvasX(wallThickness + cantileverLength * 0.5)}
                            y={toCanvasY(y + riser - cover)}
                            radius={4}
                            fill={rebarColor}
                            stroke={rebarColor}
                            strokeWidth={1}
                        />
                    );
                }

                dimensions.push(
                    <Group key="cantilever-dim">
                        <Arrow
                            points={[
                                toCanvasX(wallThickness),
                                toCanvasY(-0.3),
                                toCanvasX(wallThickness + width),
                                toCanvasY(-0.3),
                            ]}
                            stroke={dimColor}
                            fill={dimColor}
                            strokeWidth={2}
                            pointerLength={8}
                            pointerWidth={8}
                        />
                        <Text
                            x={toCanvasX(wallThickness + width / 2) - 50}
                            y={toCanvasY(-0.3) - 25}
                            text={`Cantilever: ${width.toFixed(2)}m`}
                            fontSize={14}
                            fill={dimColor}
                            fontStyle="bold"
                        />
                    </Group>
                );

            } else if (cantileverType === 'central_beam') {
                // Central spine beam with steps cantilevering both sides
                const beamWidth = 0.3;
                const cantileverLength = width / 2;

                // Draw central spine beam
                steps.push(
                    <Rect
                        key="spine-beam"
                        x={toCanvasX(-beamWidth / 2)}
                        y={toCanvasY(totalRise)}
                        width={beamWidth * scale}
                        height={totalRise * scale}
                        fill={concreteColor}
                        stroke={lineColor}
                        strokeWidth={3}
                    />
                );

                // Draw steps cantilevering from both sides
                for (let i = 0; i < numRisers; i++) {
                    const y = i * riser;

                    steps.push(
                        <Group key={`double-cant-${i}`}>
                            {/* Left side step */}
                            <Rect
                                x={toCanvasX(-beamWidth / 2 - cantileverLength)}
                                y={toCanvasY(y + riser)}
                                width={cantileverLength * scale}
                                height={riser * scale}
                                fill={concreteColor}
                                opacity={0.4}
                                stroke={lineColor}
                                strokeWidth={2}
                            />
                            {/* Right side step */}
                            <Rect
                                x={toCanvasX(beamWidth / 2)}
                                y={toCanvasY(y + riser)}
                                width={cantileverLength * scale}
                                height={riser * scale}
                                fill={concreteColor}
                                opacity={0.4}
                                stroke={lineColor}
                                strokeWidth={2}
                            />
                        </Group>
                    );

                    // Reinforcement both sides
                    rebars.push(
                        <Circle
                            key={`left-rebar-${i}`}
                            x={toCanvasX(-beamWidth / 2 - cantileverLength * 0.5)}
                            y={toCanvasY(y + riser - cover)}
                            radius={4}
                            fill={rebarColor}
                        />,
                        <Circle
                            key={`right-rebar-${i}`}
                            x={toCanvasX(beamWidth / 2 + cantileverLength * 0.5)}
                            y={toCanvasY(y + riser - cover)}
                            radius={4}
                            fill={rebarColor}
                        />
                    );
                }

                dimensions.push(
                    <Group key="both-cant-dim">
                        <Arrow
                            points={[
                                toCanvasX(-cantileverLength - beamWidth / 2),
                                toCanvasY(-0.3),
                                toCanvasX(cantileverLength + beamWidth / 2),
                                toCanvasY(-0.3),
                            ]}
                            stroke={dimColor}
                            fill={dimColor}
                            strokeWidth={2}
                            pointerLength={8}
                            pointerWidth={8}
                        />
                        <Text
                            x={toCanvasX(0) - 50}
                            y={toCanvasY(-0.3) - 25}
                            text={`Total Width: ${width.toFixed(2)}m`}
                            fontSize={14}
                            fill={dimColor}
                            fontStyle="bold"
                        />
                    </Group>
                );
            }
        }

        return (
            <Group>
                {steps}
                {rebars}
                {dimensions}
            </Group>
        );
    };

    // Plan View (Top view)
    const renderPlanView = () => {
        const elements = [];

        if (stairType === 'simply_supported' || stairType === 'supported') {
            // Simply supported - rectangular plan
            elements.push(
                <Rect
                    key="plan-outline"
                    x={toCanvasX(0)}
                    y={toCanvasY(width)}
                    width={span * scale}
                    height={width * scale}
                    fill={concreteColor}
                    opacity={0.3}
                    stroke={lineColor}
                    strokeWidth={3}
                />
            );

            // Draw rebar grid
            const numLongBars = Math.floor(width / 0.2) + 1;
            const numTransBars = Math.floor(span / 0.25) + 1;

            // Longitudinal bars (main steel)
            for (let i = 0; i < numLongBars; i++) {
                const y = (i * width) / (numLongBars - 1);
                elements.push(
                    <Line
                        key={`long-bar-${i}`}
                        points={[
                            toCanvasX(0),
                            toCanvasY(y),
                            toCanvasX(span),
                            toCanvasY(y),
                        ]}
                        stroke={rebarColor}
                        strokeWidth={2}
                    />
                );
            }

            // Transverse bars (distribution steel)
            for (let i = 0; i < numTransBars; i++) {
                const x = (i * span) / (numTransBars - 1);
                elements.push(
                    <Line
                        key={`trans-bar-${i}`}
                        points={[
                            toCanvasX(x),
                            toCanvasY(0),
                            toCanvasX(x),
                            toCanvasY(width),
                        ]}
                        stroke={rebarColor}
                        strokeWidth={1.5}
                        dash={[8, 4]}
                    />
                );
            }

        } else if (stairType === 'cantilever') {
            if (cantileverType === 'side_support') {
                // Side wall support
                const wallThickness = 0.25;

                elements.push(
                    <Rect
                        key="wall-plan"
                        x={toCanvasX(0)}
                        y={toCanvasY(span)}
                        width={wallThickness * scale}
                        height={span * scale}
                        fill={concreteColor}
                        stroke={lineColor}
                        strokeWidth={3}
                    />
                );

                // Steps in plan
                for (let i = 0; i < numRisers; i++) {
                    const y = i * (span / numRisers);
                    elements.push(
                        <Rect
                            key={`step-plan-${i}`}
                            x={toCanvasX(wallThickness)}
                            y={toCanvasY(y + span / numRisers)}
                            width={width * scale}
                            height={(span / numRisers) * scale}
                            fill={concreteColor}
                            opacity={0.2}
                            stroke={lineColor}
                            strokeWidth={1}
                        />
                    );
                }

            } else if (cantileverType === 'central_beam') {
                // Central beam
                const beamWidth = 0.3;
                const halfWidth = width / 2;

                elements.push(
                    <Rect
                        key="beam-plan"
                        x={toCanvasX(-beamWidth / 2)}
                        y={toCanvasY(span)}
                        width={beamWidth * scale}
                        height={span * scale}
                        fill={concreteColor}
                        stroke={lineColor}
                        strokeWidth={3}
                    />
                );

                // Steps both sides
                for (let i = 0; i < numRisers; i++) {
                    const y = i * (span / numRisers);
                    elements.push(
                        <Rect
                            key={`left-step-${i}`}
                            x={toCanvasX(-beamWidth / 2 - halfWidth)}
                            y={toCanvasY(y + span / numRisers)}
                            width={halfWidth * scale}
                            height={(span / numRisers) * scale}
                            fill={concreteColor}
                            opacity={0.2}
                            stroke={lineColor}
                            strokeWidth={1}
                        />,
                        <Rect
                            key={`right-step-${i}`}
                            x={toCanvasX(beamWidth / 2)}
                            y={toCanvasY(y + span / numRisers)}
                            width={halfWidth * scale}
                            height={(span / numRisers) * scale}
                            fill={concreteColor}
                            opacity={0.2}
                            stroke={lineColor}
                            strokeWidth={1}
                        />
                    );
                }
            }
        }

        return <Group>{elements}</Group>;
    };

    // Elevation View (Front view)
    const renderElevationView = () => {
        const elements = [];

        // Draw stair profile from front
        for (let i = 0; i < numRisers; i++) {
            elements.push(
                <Rect
                    key={`elev-step-${i}`}
                    x={toCanvasX(0)}
                    y={toCanvasY((i + 1) * riser)}
                    width={width * scale}
                    height={riser * scale}
                    fill={concreteColor}
                    opacity={0.3}
                    stroke={lineColor}
                    strokeWidth={2}
                />
            );
        }

        return <Group>{elements}</Group>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div
                className={`relative w-[95vw] h-[90vh] rounded-2xl shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'
                    }`}
            >
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'
                    }`}>
                    <div>
                        <h2 className={`text-2xl font-bold ${textColor}`}>
                            2D Stair Details - {codeType === 'eurocode' ? 'Eurocode' : 'BS 8110'}
                        </h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {stairType === 'simply_supported' || stairType === 'supported'
                                ? 'Simply Supported Stair'
                                : `Cantilever Stair - ${cantileverType === 'side_support' ? 'Side Support' : 'Central Beam'}`}
                        </p>
                    </div>

                    {/* View selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewType('section')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewType === 'section'
                                    ? isDark
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-teal-500 text-white'
                                    : isDark
                                        ? 'bg-slate-700 text-slate-300'
                                        : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            Section View
                        </button>
                        <button
                            onClick={() => setViewType('plan')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewType === 'plan'
                                    ? isDark
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-teal-500 text-white'
                                    : isDark
                                        ? 'bg-slate-700 text-slate-300'
                                        : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            Plan View
                        </button>
                        <button
                            onClick={() => setViewType('elevation')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewType === 'elevation'
                                    ? isDark
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-teal-500 text-white'
                                    : isDark
                                        ? 'bg-slate-700 text-slate-300'
                                        : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            Elevation
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark
                                ? 'hover:bg-slate-700 text-slate-300'
                                : 'hover:bg-gray-200 text-gray-700'
                            }`}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Canvas Area */}
                <div className="p-6 h-[calc(100%-180px)] flex items-center justify-center">
                    <Stage width={canvasWidth} height={canvasHeight}>
                        <Layer>
                            <Rect
                                x={0}
                                y={0}
                                width={canvasWidth}
                                height={canvasHeight}
                                fill={bgColor}
                            />

                            {viewType === 'section' && renderSectionView()}
                            {viewType === 'plan' && renderPlanView()}
                            {viewType === 'elevation' && renderElevationView()}

                            {/* Title */}
                            <Text
                                x={20}
                                y={20}
                                text={`${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`}
                                fontSize={20}
                                fontStyle="bold"
                                fill={textColor}
                            />
                        </Layer>
                    </Stage>
                </div>

                {/* Legend */}
                <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'
                    }`}>
                    <div className="flex gap-8 justify-center">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-400 border-2 border-gray-700"></div>
                            <span className={textColor}>Concrete</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-red-500"></div>
                            <span className={textColor}>Main Steel: {mainSteel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-red-500"></div>
                            <span className={textColor}>Distribution: {distributionSteel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-0 border-t-2 border-blue-500"></div>
                            <span className={textColor}>Dimensions</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Stair2D;