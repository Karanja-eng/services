import React, { useRef, useEffect } from "react";

/**
 * SlabDrawer (2D)
 * Renders professional cross-sections of RC slabs
 * Based on BeamDrawer pattern with slab-specific adaptations
 * AutoCAD-style clean lines, dimensions, and callouts
 * 
 * Supports: One-way, Two-way, Ribbed, Waffle, Cantilever slabs
 */
const SlabDrawer = ({
    config = {},
    section = "midspan", // "midspan", "support", or "both"
    showLabels = true,
    slabType = "one-way" // "one-way", "two-way", "ribbed", "waffle", "cantilever"
}) => {
    const canvasRef = useRef(null);
    const SCALE = 0.4; // Pixels per mm

    const {
        slabDepth = 200,
        effectiveDepth = 170,
        cover = 25,

        // One-way / Cantilever
        mainBarDiameter = 12,
        mainBarSpacing = 200,
        distributionBarDiameter = 8,
        distributionBarSpacing = 250,

        // Two-way
        xBarDiameter = 12,
        xBarSpacing = 200,
        yBarDiameter = 12,
        yBarSpacing = 200,

        // Ribbed/Waffle
        ribWidth = 125,
        ribSpacing = 500,
        toppingThickness = 50,
        ribBarCount = 2,
        ribBarDiameter = 16,

        // Cantilever specific
        topBarDiameter = 12,
        topBarSpacing = 150,
        bottomBarDiameter = 10,
        bottomBarSpacing = 200,

        width = 1000, // Display width for section
    } = config;

    useEffect(() => {
        draw();
    }, [config, section, slabType]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (slabType === "ribbed" || slabType === "waffle") {
            drawRibbedSection(ctx, canvas.width / 2, canvas.height / 2);
        } else if (section === "midspan") {
            drawSlabSection(ctx, canvas.width / 2, canvas.height / 2, "SECTION A-A (MID-SPAN)", true);
        } else if (section === "support") {
            drawSlabSection(ctx, canvas.width / 2, canvas.height / 2, "SECTION B-B (SUPPORT)", false);
        } else if (section === "both") {
            drawSlabSection(ctx, 220, canvas.height / 2, "SECTION A-A (MID-SPAN)", true);
            drawSlabSection(ctx, 580, canvas.height / 2, "SECTION B-B (SUPPORT)", false);
        }
    };

    const drawLine = (ctx, x1, y1, x2, y2, width = 1, dash = []) => {
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.lineWidth = width;
        ctx.strokeStyle = "#000000";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    const drawDimension = (ctx, x1, y1, x2, y2, text, offset, vertical = false) => {
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#000000";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";

        if (vertical) {
            const dx = offset;
            drawLine(ctx, x1, y1, x1 + dx * 1.2, y1, 0.5);
            drawLine(ctx, x2, y2, x2 + dx * 1.2, y2, 0.5);

            const dimX = x1 + dx;
            drawLine(ctx, dimX, y1, dimX, y2, 0.8);

            drawLine(ctx, dimX - 4, y1 + 4, dimX + 4, y1 - 4, 1);
            drawLine(ctx, dimX - 4, y2 + 4, dimX + 4, y2 - 4, 1);

            ctx.save();
            ctx.translate(dimX - 10, (y1 + y2) / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        } else {
            const dy = offset;
            drawLine(ctx, x1, y1, x1, y1 + dy * 1.2, 0.5);
            drawLine(ctx, x2, y2, x2, y2 + dy * 1.2, 0.5);

            const dimY = y1 + dy;
            drawLine(ctx, x1, dimY, x2, dimY, 0.8);

            drawLine(ctx, x1 - 4, dimY + 4, x1 + 4, dimY - 4, 1);
            drawLine(ctx, x2 - 4, dimY + 4, x2 + 4, dimY - 4, 1);

            ctx.fillText(text, (x1 + x2) / 2, dimY - 5);
        }
    };

    const drawLeader = (ctx, targetX, targetY, endX, endY, text) => {
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "#000000";
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(endX, endY);
        const horizontalEnd = endX > targetX ? endX + 30 : endX - 30;
        ctx.lineTo(horizontalEnd, endY);
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = endX > targetX ? "left" : "right";
        ctx.fillText(text, horizontalEnd + (endX > targetX ? 5 : -5), endY + 4);
    };

    const drawSlabSection = (ctx, centerX, centerY, label, isMidspan) => {
        const h = slabDepth;
        const w = width;

        const x0 = centerX;
        const y0 = centerY;

        const topY = y0 - (h / 2) * SCALE;
        const botY = y0 + (h / 2) * SCALE;
        const leftX = x0 - (w / 2) * SCALE;
        const rightX = x0 + (w / 2) * SCALE;

        // 1. Concrete slab
        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#000000";
        ctx.rect(leftX, topY, (rightX - leftX), (botY - topY));
        ctx.stroke();

        // 2. Reinforcement based on slab type
        if (slabType === "one-way") {
            drawOneWayReinforcement(ctx, leftX, rightX, topY, botY, isMidspan);
        } else if (slabType === "two-way") {
            drawTwoWayReinforcement(ctx, leftX, rightX, topY, botY);
        } else if (slabType === "cantilever") {
            drawCantileverReinforcement(ctx, leftX, rightX, topY, botY);
        }

        // 3. Dimensions
        if (showLabels) {
            // Slab depth
            drawDimension(ctx, rightX, topY, rightX, botY, h.toString(), 40, true);

            // Width
            drawDimension(ctx, leftX, botY, rightX, botY, w.toString(), 30);

            // Effective depth
            const effDepthY = botY - cover * SCALE - mainBarDiameter * SCALE / 2;
            drawLine(ctx, leftX - 20, effDepthY, rightX + 20, effDepthY, 0.5, [5, 5]);
            drawDimension(ctx, leftX, topY, leftX, effDepthY, `d=${effectiveDepth}`, -40, true);

            // Cover
            const coverLine = botY - cover * SCALE;
            drawLine(ctx, leftX - 15, coverLine, rightX + 15, coverLine, 0.5, [3, 3]);
            ctx.font = "9px sans-serif";
            ctx.fillStyle = "#666666";
            ctx.textAlign = "right";
            ctx.fillText(`cover=${cover}mm`, leftX - 20, coverLine + 3);

            // Title
            ctx.fillStyle = "#000000";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(label, centerX, botY + 100);

            ctx.font = "italic 11px sans-serif";
            const subtitle = slabType === "cantilever" ? "(Cantilever Section)" :
                slabType === "two-way" ? "(Two-Way Slab)" :
                    isMidspan ? "(Span Section)" : "(Support Section)";
            ctx.fillText(subtitle, centerX, botY + 115);
        }
    };

    const drawOneWayReinforcement = (ctx, leftX, rightX, topY, botY, isMidspan) => {
        const coverY = cover * SCALE;

        if (isMidspan) {
            // Bottom main bars
            const numMainBars = Math.floor(width / mainBarSpacing) + 1;
            const barY = botY - coverY - mainBarDiameter * SCALE / 2;

            for (let i = 0; i < numMainBars; i++) {
                const barX = leftX + (i * mainBarSpacing * SCALE);
                if (barX <= rightX) {
                    ctx.beginPath();
                    ctx.fillStyle = "#000000";
                    ctx.arc(barX, barY, Math.max(mainBarDiameter * SCALE / 2, 2), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            }

            // Leader for main bars
            drawLeader(ctx, leftX + mainBarSpacing * SCALE, barY,
                leftX - 80, barY - 30, `H${mainBarDiameter} @ ${mainBarSpacing}`);

            // Top distribution bars
            const numDistBars = 3; // Show a few for illustration
            const distBarY = topY + coverY + distributionBarDiameter * SCALE / 2;

            for (let i = 0; i < numDistBars; i++) {
                const barX = leftX + (i * distributionBarSpacing * SCALE);
                if (barX <= rightX) {
                    ctx.beginPath();
                    ctx.fillStyle = "#666666";
                    ctx.arc(barX, distBarY, Math.max(distributionBarDiameter * SCALE / 2, 1.5), 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            drawLeader(ctx, leftX + distributionBarSpacing * SCALE, distBarY,
                leftX - 80, distBarY + 30, `H${distributionBarDiameter} @ ${distributionBarSpacing}`);
        } else {
            // Support section - top main bars
            const numMainBars = Math.floor(width / mainBarSpacing) + 1;
            const barY = topY + coverY + mainBarDiameter * SCALE / 2;

            for (let i = 0; i < numMainBars; i++) {
                const barX = leftX + (i * mainBarSpacing * SCALE);
                if (barX <= rightX) {
                    ctx.beginPath();
                    ctx.fillStyle = "#000000";
                    ctx.arc(barX, barY, Math.max(mainBarDiameter * SCALE / 2, 2), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            }

            drawLeader(ctx, leftX + mainBarSpacing * SCALE, barY,
                leftX - 80, barY - 30, `H${mainBarDiameter} @ ${mainBarSpacing}`);
        }
    };

    const drawTwoWayReinforcement = (ctx, leftX, rightX, topY, botY) => {
        const coverY = cover * SCALE;

        // Bottom X-direction bars (lower layer)
        const numXBars = Math.floor(width / xBarSpacing) + 1;
        const xBarY = botY - coverY - xBarDiameter * SCALE / 2;

        for (let i = 0; i < numXBars; i++) {
            const barX = leftX + (i * xBarSpacing * SCALE);
            if (barX <= rightX) {
                ctx.beginPath();
                ctx.fillStyle = "#cc3333";
                ctx.arc(barX, xBarY, Math.max(xBarDiameter * SCALE / 2, 2), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawLeader(ctx, leftX + xBarSpacing * SCALE, xBarY,
            leftX - 100, xBarY - 40, `X-dir: H${xBarDiameter} @ ${xBarSpacing}`);

        // Bottom Y-direction bars (upper layer)
        const numYBars = 3; // Show a few for illustration
        const yBarY = botY - coverY - xBarDiameter * SCALE - yBarDiameter * SCALE / 2;

        for (let i = 0; i < numYBars; i++) {
            const barX = leftX + (i * yBarSpacing * SCALE);
            if (barX <= rightX) {
                ctx.beginPath();
                ctx.fillStyle = "#3333cc";
                ctx.arc(barX, yBarY, Math.max(yBarDiameter * SCALE / 2, 2), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawLeader(ctx, leftX + yBarSpacing * SCALE, yBarY,
            leftX - 100, yBarY + 40, `Y-dir: H${yBarDiameter} @ ${yBarSpacing}`);
    };

    const drawCantileverReinforcement = (ctx, leftX, rightX, topY, botY) => {
        const coverY = cover * SCALE;

        // Top bars (main reinforcement)
        const numTopBars = Math.floor(width / topBarSpacing) + 1;
        const topBarY = topY + coverY + topBarDiameter * SCALE / 2;

        for (let i = 0; i < numTopBars; i++) {
            const barX = leftX + (i * topBarSpacing * SCALE);
            if (barX <= rightX) {
                ctx.beginPath();
                ctx.fillStyle = "#cc3333";
                ctx.arc(barX, topBarY, Math.max(topBarDiameter * SCALE / 2, 2), 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        drawLeader(ctx, leftX + topBarSpacing * SCALE, topBarY,
            leftX - 100, topBarY - 30, `Top: H${topBarDiameter} @ ${topBarSpacing}`);

        // Bottom bars (50% for shrinkage/temperature)
        const numBottomBars = Math.floor(width / bottomBarSpacing) + 1;
        const bottomBarY = botY - coverY - bottomBarDiameter * SCALE / 2;

        for (let i = 0; i < numBottomBars; i++) {
            const barX = leftX + (i * bottomBarSpacing * SCALE);
            if (barX <= rightX) {
                ctx.beginPath();
                ctx.fillStyle = "#666666";
                ctx.arc(barX, bottomBarY, Math.max(bottomBarDiameter * SCALE / 2, 1.5), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawLeader(ctx, leftX + bottomBarSpacing * SCALE, bottomBarY,
            leftX - 100, bottomBarY + 30, `Bottom: H${bottomBarDiameter} @ ${bottomBarSpacing} (50% top)`);
    };

    const drawRibbedSection = (ctx, centerX, centerY) => {
        const h = slabDepth;
        const totalWidth = ribSpacing * 3; // Show 3 ribs

        const x0 = centerX;
        const y0 = centerY;

        const topY = y0 - (h / 2) * SCALE;
        const botY = y0 + (h / 2) * SCALE;
        const toppingBotY = topY + toppingThickness * SCALE;

        // Draw 3 ribs
        for (let i = 0; i < 3; i++) {
            const ribCenterX = x0 - ribSpacing * SCALE + i * ribSpacing * SCALE;
            const ribLeftX = ribCenterX - (ribWidth / 2) * SCALE;
            const ribRightX = ribCenterX + (ribWidth / 2) * SCALE;

            // Rib outline
            ctx.beginPath();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "#000000";
            ctx.moveTo(ribLeftX, toppingBotY);
            ctx.lineTo(ribLeftX, botY);
            ctx.lineTo(ribRightX, botY);
            ctx.lineTo(ribRightX, toppingBotY);
            ctx.stroke();

            // Rib reinforcement
            const barY = botY - cover * SCALE - ribBarDiameter * SCALE / 2;
            const barSpacing = ribWidth / (ribBarCount + 1);

            for (let j = 1; j <= ribBarCount; j++) {
                const barX = ribLeftX + j * barSpacing * SCALE;
                ctx.beginPath();
                ctx.fillStyle = "#cc3333";
                ctx.arc(barX, barY, Math.max(ribBarDiameter * SCALE / 2, 2), 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Leader for first rib
            if (i === 1) {
                drawLeader(ctx, ribCenterX, barY, ribCenterX + 80, barY - 40,
                    `${ribBarCount}H${ribBarDiameter}`);
            }
        }

        // Topping slab
        const toppingLeftX = x0 - (totalWidth / 2) * SCALE;
        const toppingRightX = x0 + (totalWidth / 2) * SCALE;

        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.rect(toppingLeftX, topY, toppingRightX - toppingLeftX, toppingThickness * SCALE);
        ctx.stroke();

        // Topping mesh (simplified - show a few bars)
        const meshBarY = topY + toppingThickness * SCALE / 2;
        for (let i = 0; i < 5; i++) {
            const barX = toppingLeftX + (i * 100 * SCALE);
            if (barX <= toppingRightX) {
                ctx.beginPath();
                ctx.fillStyle = "#666666";
                ctx.arc(barX, meshBarY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Dimensions
        if (showLabels) {
            // Total depth
            drawDimension(ctx, toppingRightX, topY, toppingRightX, botY, h.toString(), 40, true);

            // Topping thickness
            drawDimension(ctx, toppingRightX, topY, toppingRightX, toppingBotY,
                toppingThickness.toString(), 20, true);

            // Rib spacing
            const rib1X = x0 - ribSpacing * SCALE;
            const rib2X = x0;
            drawDimension(ctx, rib1X, botY, rib2X, botY, ribSpacing.toString(), 30);

            // Rib width
            const ribLeftX = x0 - (ribWidth / 2) * SCALE;
            const ribRightX = x0 + (ribWidth / 2) * SCALE;
            drawDimension(ctx, ribLeftX, botY, ribRightX, botY, ribWidth.toString(), 50);

            // Title
            ctx.fillStyle = "#000000";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("RIBBED SLAB SECTION", centerX, botY + 120);

            ctx.font = "italic 11px sans-serif";
            ctx.fillText(`(${slabType === "waffle" ? "Waffle" : "Ribbed"} Construction)`,
                centerX, botY + 135);
        }
    };

    return (
        <div className="flex flex-col items-center w-full p-6 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="w-full flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    2D Slab Detailing View
                </h3>
                <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200 uppercase">
                    BS 8110 / EC2 Detailing
                </span>
            </div>

            <div className="relative w-full aspect-[8/5] bg-[#fdfdfd] rounded-lg border border-slate-200 flex items-center justify-center p-4">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={500}
                    className="max-w-full h-auto drop-shadow-sm"
                />
            </div>

            <div className="grid grid-cols-3 gap-4 w-full mt-6">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Slab Type</p>
                    <p className="text-sm font-semibold text-slate-700 capitalize">{slabType.replace('-', ' ')}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Depth</p>
                    <p className="text-sm font-semibold text-slate-700">{slabDepth} mm</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Cover</p>
                    <p className="text-sm font-semibold text-slate-700">{cover} mm (Nominal)</p>
                </div>
            </div>
        </div>
    );
};

export default SlabDrawer;
