import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Download, Grid, Eye, EyeOff } from 'lucide-react';

const Staircase2DViewer = ({ staircaseData }) => {
    const canvasRef = useRef(null);
    const [scale, setScale] = useState(50);
    const [showDimensions, setShowDimensions] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [viewType, setViewType] = useState('plan'); // plan, section, elevation

    useEffect(() => {
        if (!canvasRef.current || !staircaseData) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw based on view type
        if (showGrid) {
            drawGrid(ctx, canvas.width, canvas.height, scale);
        }

        switch (viewType) {
            case 'plan':
                drawPlanView(ctx, staircaseData, scale, canvas.width, canvas.height);
                break;
            case 'section':
                drawSectionView(ctx, staircaseData, scale, canvas.width, canvas.height);
                break;
            case 'elevation':
                drawElevationView(ctx, staircaseData, scale, canvas.width, canvas.height);
                break;
        }

    }, [staircaseData, scale, showDimensions, showGrid, viewType]);

    const drawGrid = (ctx, width, height, scale) => {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;

        // Grid spacing (1 meter = scale pixels)
        const gridSize = scale;

        // Vertical lines
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Major grid lines (every 5 meters)
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth = 1;

        for (let x = 0; x < width; x += gridSize * 5) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 0; y < height; y += gridSize * 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    };

    const drawPlanView = (ctx, data, scale, width, height) => {
        const {
            staircase_type = 'straight',
            clear_width = 1.2,
            tread = 0.275,
            risers_per_flight = [8, 8],
            landing_lengths = [1.5],
            landing_widths = [1.2],
            wall_thick = 0.225
        } = data;

        // Offset to center drawing
        const offsetX = width / 2 - (clear_width * scale) / 2;
        const offsetY = 100;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Set drawing style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#f5f5f5';

        switch (staircase_type) {
            case 'straight':
                drawStraightPlan(ctx, data, scale);
                break;
            case 'l_shaped':
                drawLShapedPlan(ctx, data, scale);
                break;
            case 'u_shaped':
                drawUShapedPlan(ctx, data, scale);
                break;
            case 'spiral':
                drawSpiralPlan(ctx, data, scale);
                break;
            case 'cantilever':
                drawCantileverPlan(ctx, data, scale);
                break;
            default:
                drawStraightPlan(ctx, data, scale);
        }

        ctx.restore();

        // Draw title block
        drawTitleBlock(ctx, width, height, viewType, data);
    };

    const drawStraightPlan = (ctx, data, scale) => {
        const { clear_width, tread, risers_per_flight, landing_lengths, landing_widths, wall_thick } = data;

        let currentY = 0;

        // Draw flights
        risers_per_flight.forEach((numRisers, flightIdx) => {
            const flightLength = numRisers * tread * scale;
            const width = clear_width * scale;

            // Outer rectangle
            ctx.strokeRect(0, currentY, width, flightLength);

            // Draw treads
            for (let i = 0; i <= numRisers; i++) {
                const y = currentY + (i * tread * scale);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Draw direction arrow
            drawArrow(ctx, width / 2, currentY + flightLength / 2, width / 2, currentY + flightLength - 20, '#ff0000');

            // Draw "UP" text
            ctx.save();
            ctx.fillStyle = '#ff0000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('UP', width / 2, currentY + flightLength - 30);
            ctx.restore();

            currentY += flightLength;

            // Draw landing if not last flight
            if (flightIdx < risers_per_flight.length - 1 && landing_lengths[flightIdx]) {
                const landingLength = landing_lengths[flightIdx] * scale;
                const landingWidth = landing_widths[flightIdx] * scale;

                ctx.fillStyle = '#e8e8e8';
                ctx.fillRect(0, currentY, landingWidth, landingLength);
                ctx.strokeRect(0, currentY, landingWidth, landingLength);

                // Hatching for landing
                drawHatching(ctx, 0, currentY, landingWidth, landingLength, 10);

                currentY += landingLength;
            }
        });

        // Draw walls
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = wall_thick * scale;
        const totalLength = currentY;

        // Left wall
        ctx.beginPath();
        ctx.moveTo(-(wall_thick * scale) / 2, 0);
        ctx.lineTo(-(wall_thick * scale) / 2, totalLength);
        ctx.stroke();

        // Right wall
        ctx.beginPath();
        ctx.moveTo(clear_width * scale + (wall_thick * scale) / 2, 0);
        ctx.lineTo(clear_width * scale + (wall_thick * scale) / 2, totalLength);
        ctx.stroke();

        // Draw dimensions if enabled
        if (showDimensions) {
            drawDimension(ctx, 0, -30, clear_width * scale, -30, `${clear_width.toFixed(2)}m`);
            drawDimension(ctx, clear_width * scale + 50, 0, clear_width * scale + 50, totalLength,
                `${(totalLength / scale).toFixed(2)}m`);
        }
    };

    const drawLShapedPlan = (ctx, data, scale) => {
        const { clear_width, tread, risers_per_flight, wall_thick } = data;
        const width = clear_width * scale;

        // First flight
        const flight1Length = risers_per_flight[0] * tread * scale;
        ctx.strokeRect(0, 0, width, flight1Length);

        for (let i = 0; i <= risers_per_flight[0]; i++) {
            const y = i * tread * scale;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        drawArrow(ctx, width / 2, flight1Length / 2, width / 2, flight1Length - 20, '#ff0000');

        // Landing
        const landingSize = width;
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(0, flight1Length, landingSize, landingSize);
        ctx.strokeRect(0, flight1Length, landingSize, landingSize);
        drawHatching(ctx, 0, flight1Length, landingSize, landingSize, 10);

        // Second flight (perpendicular)
        const flight2Length = (risers_per_flight[1] || risers_per_flight[0]) * tread * scale;
        ctx.strokeRect(landingSize, flight1Length, flight2Length, width);

        for (let i = 0; i <= (risers_per_flight[1] || risers_per_flight[0]); i++) {
            const x = landingSize + (i * tread * scale);
            ctx.beginPath();
            ctx.moveTo(x, flight1Length);
            ctx.lineTo(x, flight1Length + width);
            ctx.stroke();
        }
        drawArrow(ctx, landingSize + flight2Length / 2, flight1Length + width / 2,
            landingSize + flight2Length - 20, flight1Length + width / 2, '#ff0000');
    };

    const drawUShapedPlan = (ctx, data, scale) => {
        const { clear_width, tread, risers_per_flight, wall_thick } = data;
        const width = clear_width * scale;
        const gap = width;

        // First flight (going up)
        const flight1Length = risers_per_flight[0] * tread * scale;
        ctx.strokeRect(0, 0, width, flight1Length);

        for (let i = 0; i <= risers_per_flight[0]; i++) {
            const y = i * tread * scale;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        drawArrow(ctx, width / 2, flight1Length / 2, width / 2, flight1Length - 20, '#ff0000');

        // Landing
        const landingLength = width + gap + width;
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(0, flight1Length, landingLength, width);
        ctx.strokeRect(0, flight1Length, landingLength, width);
        drawHatching(ctx, 0, flight1Length, landingLength, width, 10);

        // Second flight (going down - return)
        const flight2Length = (risers_per_flight[1] || risers_per_flight[0]) * tread * scale;
        ctx.strokeRect(width + gap, flight1Length + width, width, -flight2Length);

        for (let i = 0; i <= (risers_per_flight[1] || risers_per_flight[0]); i++) {
            const y = flight1Length + width - (i * tread * scale);
            ctx.beginPath();
            ctx.moveTo(width + gap, y);
            ctx.lineTo(width + gap + width, y);
            ctx.stroke();
        }
        drawArrow(ctx, width + gap + width / 2, flight1Length + width - flight2Length / 2,
            width + gap + width / 2, flight1Length + width - flight2Length + 20, '#ff0000');
    };

    const drawSpiralPlan = (ctx, data, scale) => {
        const { risers_per_flight, rise, spiral_radius = 1.0, spiral_center_column_dia = 0.2 } = data;
        const totalRisers = risers_per_flight.reduce((a, b) => a + b, 0);
        const radius = spiral_radius * scale;
        const centerRadius = (spiral_center_column_dia / 2) * scale;
        const anglePerStep = (Math.PI * 2) / totalRisers;

        // Draw center column
        ctx.beginPath();
        ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#cccccc';
        ctx.fill();
        ctx.stroke();

        // Draw steps
        for (let i = 0; i < totalRisers; i++) {
            const startAngle = anglePerStep * i - Math.PI / 2;
            const endAngle = startAngle + anglePerStep;

            ctx.beginPath();
            ctx.arc(0, 0, radius, startAngle, endAngle);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.stroke();

            // Draw radial lines
            ctx.beginPath();
            ctx.moveTo(centerRadius * Math.cos(startAngle), centerRadius * Math.sin(startAngle));
            ctx.lineTo(radius * Math.cos(startAngle), radius * Math.sin(startAngle));
            ctx.stroke();
        }

        // Draw direction arrow (spiral)
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.7, -Math.PI / 2, Math.PI / 2, false);
        ctx.stroke();

        // Arrow head
        const arrowAngle = Math.PI / 2;
        const arrowX = radius * 0.7 * Math.cos(arrowAngle);
        const arrowY = radius * 0.7 * Math.sin(arrowAngle);
        drawArrowHead(ctx, arrowX, arrowY, arrowAngle + Math.PI / 2);
    };

    const drawCantileverPlan = (ctx, data, scale) => {
        const { clear_width, tread, risers_per_flight, wall_thick } = data;
        const totalRisers = risers_per_flight.reduce((a, b) => a + b, 0);
        const width = clear_width * scale;
        const flightLength = totalRisers * tread * scale;

        // Draw wall (support)
        ctx.fillStyle = '#888888';
        ctx.fillRect(-wall_thick * scale, 0, wall_thick * scale, flightLength);
        ctx.strokeRect(-wall_thick * scale, 0, wall_thick * scale, flightLength);

        // Draw treads (no risers)
        for (let i = 0; i < totalRisers; i++) {
            const y = i * tread * scale;
            const treadDepth = tread * scale;

            // Tread outline
            ctx.strokeRect(0, y + 2, width, treadDepth - 4);

            // Support indication (dashed line to wall)
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(-wall_thick * scale / 2, y + treadDepth / 2);
            ctx.lineTo(width / 2, y + treadDepth / 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        drawArrow(ctx, width / 2, flightLength / 2, width / 2, flightLength - 20, '#ff0000');
    };

    const drawSectionView = (ctx, data, scale, width, height) => {
        const {
            clear_width = 1.2,
            tread = 0.275,
            rise = 0.175,
            risers_per_flight = [8, 8],
            waist_thick = 0.15,
            wall_thick = 0.225
        } = data;

        const offsetX = 100;
        const offsetY = height - 100;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;

        let currentX = 0;
        let currentY = 0;

        // Draw each flight
        risers_per_flight.forEach((numRisers, idx) => {
            // Draw steps
            for (let i = 0; i < numRisers; i++) {
                const x = currentX + (i * tread * scale);
                const y = currentY - (i * rise * scale);

                // Waist slab
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + tread * scale, y - rise * scale);
                ctx.lineTo(x + tread * scale, y - rise * scale + waist_thick * scale);
                ctx.lineTo(x, y + waist_thick * scale);
                ctx.closePath();
                ctx.fillStyle = '#d0d0d0';
                ctx.fill();
                ctx.stroke();

                // Riser
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y - rise * scale);
                ctx.lineTo(x + tread * scale, y - rise * scale);
                ctx.stroke();

                // Tread surface (thick line)
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, y - rise * scale);
                ctx.lineTo(x + tread * scale, y - rise * scale);
                ctx.stroke();
                ctx.lineWidth = 2;
            }

            currentX += numRisers * tread * scale;
            currentY -= numRisers * rise * scale;
        });

        // Draw dimensions
        if (showDimensions) {
            const totalRise = risers_per_flight.reduce((sum, r) => sum + r, 0) * rise;
            const totalGoing = risers_per_flight.reduce((sum, r) => sum + r, 0) * tread;

            // Height dimension
            drawDimension(ctx, -50, 0, -50, -totalRise * scale, `${totalRise.toFixed(2)}m`);

            // Going dimension
            drawDimension(ctx, 0, 30, totalGoing * scale, 30, `${totalGoing.toFixed(2)}m`);
        }

        ctx.restore();

        drawTitleBlock(ctx, width, height, viewType, data);
    };

    const drawElevationView = (ctx, data, scale, width, height) => {
        const {
            clear_width = 1.2,
            rise = 0.175,
            risers_per_flight = [8, 8],
            waist_thick = 0.15
        } = data;

        const offsetX = 100;
        const offsetY = height - 100;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;

        let currentY = 0;
        const stairWidth = clear_width * scale;

        // Draw side view
        risers_per_flight.forEach((numRisers) => {
            for (let i = 0; i < numRisers; i++) {
                const y = currentY - (i * rise * scale);

                // Side profile of step
                ctx.strokeRect(0, y - rise * scale, stairWidth, rise * scale + waist_thick * scale);

                // Fill
                ctx.fillStyle = '#e0e0e0';
                ctx.fillRect(0, y - rise * scale, stairWidth, rise * scale + waist_thick * scale);
            }

            currentY -= numRisers * rise * scale;
        });

        // Draw handrail
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0 - 0.9 * scale);
        ctx.lineTo(stairWidth, currentY - 0.9 * scale);
        ctx.stroke();

        ctx.restore();

        drawTitleBlock(ctx, width, height, viewType, data);
    };

    const drawArrow = (ctx, x1, y1, x2, y2, color) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        // Line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        drawArrowHead(ctx, x2, y2, angle);

        ctx.restore();
    };

    const drawArrowHead = (ctx, x, y, angle) => {
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - headLength * Math.cos(angle - Math.PI / 6),
            y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - headLength * Math.cos(angle + Math.PI / 6),
            y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    };

    const drawHatching = (ctx, x, y, width, height, spacing) => {
        ctx.save();
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([]);

        for (let i = -height; i < width; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + height, y + height);
            ctx.stroke();
        }

        ctx.restore();
    };

    const drawDimension = (ctx, x1, y1, x2, y2, text) => {
        ctx.save();
        ctx.strokeStyle = '#0000ff';
        ctx.fillStyle = '#0000ff';
        ctx.lineWidth = 1;
        ctx.font = '12px Arial';

        // Extension lines
        const extension = 10;
        const isVertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);

        if (isVertical) {
            ctx.beginPath();
            ctx.moveTo(x1 - extension, y1);
            ctx.lineTo(x1 + extension, y1);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x2 - extension, y2);
            ctx.lineTo(x2 + extension, y2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(x1, y1 - extension);
            ctx.lineTo(x1, y1 + extension);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x2, y2 - extension);
            ctx.lineTo(x2, y2 + extension);
            ctx.stroke();
        }

        // Dimension line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Arrow heads
        const angle = Math.atan2(y2 - y1, x2 - x1);
        drawArrowHead(ctx, x1, y1, angle + Math.PI);
        drawArrowHead(ctx, x2, y2, angle);

        // Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Background for text
        const metrics = ctx.measureText(text);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(midX - metrics.width / 2 - 2, midY - 8, metrics.width + 4, 16);

        ctx.fillStyle = '#0000ff';
        ctx.fillText(text, midX, midY);

        ctx.restore();
    };

    const drawTitleBlock = (ctx, width, height, viewType, data) => {
        const blockHeight = 80;
        const blockWidth = 300;
        const x = width - blockWidth - 20;
        const y = height - blockHeight - 20;

        ctx.save();

        // Border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, blockWidth, blockHeight);

        // Title
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('STAIRCASE DRAWING', x + 10, y + 20);

        // Details
        ctx.font = '12px Arial';
        ctx.fillText(`View: ${viewType.toUpperCase()}`, x + 10, y + 40);
        ctx.fillText(`Type: ${(data.staircase_type || 'straight').replace('_', ' ').toUpperCase()}`, x + 10, y + 55);
        ctx.fillText(`Scale: 1:${Math.round(100 / scale)}`, x + 10, y + 70);

        // Date
        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleDateString(), x + blockWidth - 10, y + 70);

        ctx.restore();
    };

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `staircase_${viewType}_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    return (
        <div className="w-full h-full min-h-[600px] bg-white rounded-lg overflow-hidden relative">
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ cursor: 'crosshair' }}
            />

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
                <div className="bg-white rounded-lg shadow-lg p-2 space-y-2">
                    <div className="text-sm font-semibold text-gray-700 px-2">View</div>
                    <select
                        value={viewType}
                        onChange={(e) => setViewType(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                        <option value="plan">Plan View</option>
                        <option value="section">Section View</option>
                        <option value="elevation">Elevation View</option>
                    </select>
                </div>

                <button
                    onClick={() => setShowGrid(!showGrid)}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title={showGrid ? "Hide grid" : "Show grid"}
                >
                    <Grid className={`w-5 h-5 ${showGrid ? 'text-blue-600' : 'text-gray-600'}`} />
                </button>

                <button
                    onClick={() => setShowDimensions(!showDimensions)}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title={showDimensions ? "Hide dimensions" : "Show dimensions"}
                >
                    {showDimensions ? (
                        <Eye className="w-5 h-5 text-blue-600" />
                    ) : (
                        <EyeOff className="w-5 h-5 text-gray-600" />
                    )}
                </button>

                <button
                    onClick={handleDownload}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title="Download drawing"
                >
                    <Download className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Scale control */}
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3">
                <div className="text-sm font-semibold text-gray-700 mb-2">Scale</div>
                <input
                    type="range"
                    min="20"
                    max="100"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-32"
                />
                <div className="text-xs text-gray-600 mt-1">1:{Math.round(100 / scale)}</div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
                <div className="font-semibold mb-2">Legend</div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-black"></div>
                        <span>Walls & Structure</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-red-600"></div>
                        <span>Direction of Travel</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-blue-600"></div>
                        <span>Dimensions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #999 5px, #999 6px)' }}></div>
                        <span>Landings</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Staircase2DViewer;