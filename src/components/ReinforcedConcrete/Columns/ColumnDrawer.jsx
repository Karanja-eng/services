
import React, { useRef, useEffect } from "react";

/**
 * ColumnDrawer (2D)
 * Renders professional cross-sections of RC columns.
 * AutoCAD-style clean lines, black theme/white bg, dimensions, and callouts.
 */
const ColumnDrawer = ({
    width = 300,
    depth = 300,
    cover = 40,
    barDia = 16,
    numBars = 4,
    tieDia = 8,
    distribution = "equal", // 'equal' | 'sides'
    showLabels = true,
    scale = 0.8 // Pixels per mm
}) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        draw();
    }, [width, depth, cover, barDia, numBars, tieDia, scale]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        // Dynamic sizing of canvas
        // Add padding for labels
        const padding = 100;
        const drawWidth = width * scale;
        const drawDepth = depth * scale;

        // Auto-fit if too big
        let currentScale = scale;
        if (drawWidth > canvas.width - 200 || drawDepth > canvas.height - 200) {
            currentScale = Math.min((canvas.width - 200) / width, (canvas.height - 200) / depth);
        }

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Helpers
        const drawLine = (x1, y1, x2, y2, width = 1, dashed = false) => {
            ctx.beginPath();
            ctx.lineWidth = width;
            ctx.strokeStyle = "#000000";
            if (dashed) ctx.setLineDash([5, 3]);
            else ctx.setLineDash([]);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.setLineDash([]);
        };

        const drawDim = (x1, y1, x2, y2, text, offset, vertical = false) => {
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = "#000000";
            ctx.fillStyle = "#000000";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";

            if (vertical) {
                // Vertical dimension (measure height)
                const dx = offset;
                drawLine(x1, y1, x1 + dx * 1.2, y1, 0.5);
                drawLine(x2, y2, x2 + dx * 1.2, y2, 0.5);
                const dimX = x1 + dx;
                drawLine(dimX, y1, dimX, y2, 0.8);

                // Ticks
                drawLine(dimX - 3, y1 + 3, dimX + 3, y1 - 3, 1);
                drawLine(dimX - 3, y2 + 3, dimX + 3, y2 - 3, 1);

                ctx.save();
                ctx.translate(dimX - 12, (y1 + y2) / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(text, 0, 0);
                ctx.restore();
            } else {
                // Horizontal dimension (measure width)
                const dy = offset;
                drawLine(x1, y1, x1, y1 + dy * 1.2, 0.5);
                drawLine(x2, y2, x2, y2 + dy * 1.2, 0.5);
                const dimY = y1 + dy;
                drawLine(x1, dimY, x2, dimY, 0.8);

                // Ticks
                drawLine(x1 - 3, dimY + 3, x1 + 3, dimY - 3, 1);
                drawLine(x2 - 3, dimY + 3, x2 + 3, dimY - 3, 1);

                ctx.fillText(text, (x1 + x2) / 2, dimY - 5);
            }
        };

        const drawLeader = (tx, ty, ex, ey, text) => {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(ex, ey);
            const hEnd = ex > tx ? ex + 20 : ex - 20;
            ctx.lineTo(hEnd, ey);
            ctx.stroke();

            ctx.fillStyle = "#000000";
            ctx.textAlign = ex > tx ? "left" : "right";
            ctx.fillText(text, hEnd + (ex > tx ? 4 : -4), ey + 3);
        };

        // --- DRAWING ---
        const w = width * currentScale;
        const h = depth * currentScale;
        const tlX = centerX - w / 2;
        const tlY = centerY - h / 2;
        const brX = centerX + w / 2;
        const brY = centerY + h / 2;

        // 1. Column Outline
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(tlX, tlY, w, h);

        // 2. Tie (Link)
        // Inset by cover
        const c = cover * currentScale;
        const t = tieDia * currentScale;
        // Tie centerline box
        const tieL = tlX + c + t / 2;
        const tieT = tlY + c + t / 2;
        const tieW = w - 2 * c - t;
        const tieH = h - 2 * c - t;

        // Draw rounded rect for tie
        const rad = 2 * t; // Bend radius
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.roundRect(tieL - t / 2, tieT - t / 2, tieW + t, tieH + t, rad);
        ctx.stroke();

        // 3. Bars
        const bDia = barDia * currentScale;
        const positions = [];

        // Calculate bar positions
        // This replicates the logic in Columnmain but simplified and robust
        // 4 corners always
        // Remainder distributed equally
        const coreW = tieW;
        const coreH = tieH;

        // Always corners
        // TL
        positions.push({ x: tieL, y: tieT });
        // TR
        positions.push({ x: tieL + coreW, y: tieT });
        // BR
        positions.push({ x: tieL + coreW, y: tieT + coreH });
        // BL
        positions.push({ x: tieL, y: tieT + coreH });

        const rem = Math.max(0, numBars - 4);
        if (rem > 0) {
            // Equal distribution on 4 sides logic
            // Total perimeter logic is complex, usually we split by side
            // Rectangular columns usually have bars on sides

            // Simple heuristic: distribute rem bars on sides.
            // top/bottom get more if width > depth
            const totalLen = 2 * (width + depth);
            const topRatio = width / (width + depth);

            // Simplified: Split remaining by 4, add to sides
            // If odd, add to long side
            // This is a VISUALIZER, exact placement might differ from BS logic but should resemble correct layout
            const barsX = Math.round(rem * (width / (width + depth)) / 2); // per face
            const barsY = Math.ceil((rem - 2 * barsX) / 2);

            // Top Face (between corners)
            if (barsX > 0) {
                const gap = coreW / (barsX + 1);
                for (let i = 1; i <= barsX; i++) positions.push({ x: tieL + gap * i, y: tieT });
                // Bottom Face
                for (let i = 1; i <= barsX; i++) positions.push({ x: tieL + gap * i, y: tieT + coreH });
            }

            // Left Face (between corners)
            if (barsY > 0) {
                // Recalculate barsY from actual remainder to be exact
                const remY = (numBars - 4) - (barsX * 2);
                // Split remY into left/right
                const leftCount = Math.ceil(remY / 2);
                const rightCount = remY - leftCount;

                if (leftCount > 0) {
                    const gap = coreH / (leftCount + 1);
                    for (let i = 1; i <= leftCount; i++) positions.push({ x: tieL, y: tieT + gap * i });
                }
                if (rightCount > 0) {
                    const gap = coreH / (rightCount + 1);
                    for (let i = 1; i <= rightCount; i++) positions.push({ x: tieL + coreW, y: tieT + gap * i });
                }
            }
        }

        // Draw Bars
        positions.forEach(p => {
            ctx.beginPath();
            ctx.fillStyle = "#000000"; // Solid black fit
            ctx.arc(p.x, p.y, bDia / 2, 0, 2 * Math.PI);
            ctx.fill();
            // ctx.stroke();
        });

        if (showLabels) {
            // Dimensions
            drawDim(tlX, brY, brX, brY, `${width}`, 30);
            drawDim(brX, tlY, brX, brY, `${depth}`, 30, true);

            // Callouts
            // Main Bars
            if (positions.length > 0) {
                const p = positions[0];
                drawLeader(p.x - 5, p.y - 5, tlX - 40, tlY - 20, `${numBars}H${barDia}`);
            }

            // Links
            const linkText = `R${tieDia} links`;
            drawLeader(brX - c, centerY, brX + 40, centerY, linkText);

            // Section Title
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";
            ctx.fillText("SECTION A-A", centerX, brY + 60);
        }

    };

    return (
        <div className="flex flex-col items-center w-full p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-full flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Column Section</span>
            </div>
            <canvas
                ref={canvasRef}
                width={400}
                height={400}
                className="max-w-full h-auto"
            />
        </div>
    );
};

export default ColumnDrawer;
