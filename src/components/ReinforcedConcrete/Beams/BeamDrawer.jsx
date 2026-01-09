import React, { useRef, useEffect } from "react";

/**
 * BeamColumnDrawer (2D)
 * Renders cross-sections of RC beams/columns.
 * Can render a specific section or multiple sections side-by-side.
 */
const BeamColumnDrawer = ({
  config = {},
  section = "midspan", // "midspan", "support", or "both"
  showLabels = true
}) => {
  const canvasRef = useRef(null);
  const SCALE = 0.5; // Pixels per mm

  // Destructure config with defaults
  const {
    type = "t_beam",
    webWidth = 300,
    beamDepth = 500,
    flangeThk = 150,
    flangeWidth = 1000,

    // Reinforcement - Midspan (Bottom heavy)
    saggingBarsCount = 3,
    saggingBarDiameter = 20,
    saggingCompCount = 2,
    saggingCompDia = 12,

    // Reinforcement - Support (Top heavy)
    hoggingBarsCount = 3,
    hoggingBarDiameter = 20,
    hoggingCompCount = 2,
    hoggingCompDia = 20,

    linksDiameter = 10, // Stirrups
    cover = 30,
    sideBars = 0 // Side face reinforcement
  } = config;

  useEffect(() => {
    draw();
  }, [config, section]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calc Dimensions
    // Max Width needed?
    const sectionWidth = (type === "t_beam" ? flangeWidth : webWidth) * SCALE + 100;

    // Draw Logic
    if (section === "midspan") {
      drawSection(ctx, canvas.width / 2 - sectionWidth / 2, "Section A-A (Mid-span)", true);
    } else if (section === "support") {
      drawSection(ctx, canvas.width / 2 - sectionWidth / 2, "Section B-B (Support)", false);
    } else if (section === "both") {
      // Draw side by side
      // Scale down if needed? 
      // 800px canvas. Two sections.
      drawSection(ctx, 50, "Section A-A (Mid-span)", true);
      drawSection(ctx, 450, "Section B-B (Support)", false);
    }
  };

  const drawSection = (ctx, xOffset, label, isSagging) => {
    // isSagging = true -> Midspan (Show sagging bottom bars, and top hangers/comp)
    // isSagging = false -> Support (Show hogging top bars, and bottom comp)

    const flipY = (y) => 200 - y * SCALE + 100; // Center vertically somewhat

    const bottomCount = isSagging ? saggingBarsCount : hoggingCompCount;
    const bottomDia = isSagging ? saggingBarDiameter : hoggingCompDia;

    const topCount = isSagging ? saggingCompCount : hoggingBarsCount;
    const topDia = isSagging ? saggingCompDia : hoggingBarDiameter;

    // If sagging comp count is 0, define min hangers? Usually 2.
    // But we follow props.
    const actualTopCount = topCount < 2 ? 2 : topCount;
    const actualTopDia = topDia || 12;

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#333";
    ctx.fillStyle = "#ddd"; // Concrete gray

    // 1. Draw Concrete Outline
    let x0 = xOffset + 50; // Padding
    let y0 = flipY(0); // Top local

    const wStirrup = webWidth - 2 * cover;
    const hStirrup = beamDepth - 2 * cover;

    // Draw Shape
    ctx.beginPath();
    if (type === "t_beam" || type === "l_beam") {
      // Simplified T shape drawing
      const bf = flangeWidth;
      const hf = flangeThk;
      const bw = webWidth;
      const h = beamDepth;

      const xCenter = x0 + (bf * SCALE) / 2;
      // Top Left
      const xTL = xCenter - (bf * SCALE) / 2;
      const yTop = flipY(0);
      const yFlangeBot = flipY(-hf);
      const yBot = flipY(-h);

      // Vertices
      ctx.moveTo(xTL, yTop);
      ctx.lineTo(xTL + bf * SCALE, yTop);
      ctx.lineTo(xTL + bf * SCALE, yFlangeBot);
      ctx.lineTo(xCenter + bw * SCALE / 2, yFlangeBot);
      ctx.lineTo(xCenter + bw * SCALE / 2, yBot);
      ctx.lineTo(xCenter - bw * SCALE / 2, yBot);
      ctx.lineTo(xCenter - bw * SCALE / 2, yFlangeBot);
      ctx.lineTo(xTL, yFlangeBot);
      ctx.closePath();

    } else {
      // Rectangular
      const w = webWidth;
      const h = beamDepth;
      const xCenter = x0 + w * SCALE / 2;

      ctx.rect(x0, flipY(-h), w * SCALE, h * SCALE);
    }
    ctx.fill();
    ctx.stroke();

    // 2. Draw Stirrup
    // Always rectangular in web approx
    const xWebLeft = x0 + (type === "t_beam" ? (flangeWidth - webWidth) / 2 : 0) * SCALE;
    const xStirL = xWebLeft + cover * SCALE;
    const yStirTop = flipY(-cover);
    const wS = (webWidth - 2 * cover) * SCALE;
    const hS = (beamDepth - 2 * cover) * SCALE;

    ctx.beginPath();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.rect(xStirL, yStirTop + hS, wS, -hS); // Rect draws from top-left usually? 
    // yStirTop is top Y. hS is height.
    // Canvas rect(x, y, w, h). y is top-left.
    // flipY returns canvas Y. 
    // yStirTop is the higher Y value (visually top).
    // We want to draw down. h needs to be positive.
    // But y coordinate grows down. 
    // flipY(-cover) -> e.g. 200 - (-30)*0.5 = 215. 
    // flipY(-h-cover) -> 200 - (-500)*0.5 = 450.
    // So yStirTop is smaller value (UP).
    // Wait flipY: 200 - y*SCALE. 
    // y=0 -> 200. y=-500 -> 450. 
    // So 0 is "Top" visually if canvas 0 is top.

    const yS_Top = flipY(-cover); // 215
    const yS_Bot = flipY(-beamDepth + cover); // 435
    // Height = yS_Bot - yS_Top = 220.

    ctx.rect(xStirL, yS_Top, wS, yS_Bot - yS_Top);
    ctx.stroke();

    // 3. Draw Bars
    // Helper
    const drawBars = (count, dia, isTop, color) => {
      if (count < 1) return;
      const y = isTop ? yS_Top + dia * SCALE : yS_Bot - dia * SCALE; // Located inside stirrup
      const availW = wS - dia * SCALE; // Center-to-center span available
      const spacing = count > 1 ? availW / (count - 1) : 0;

      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const cx = xStirL + dia * SCALE / 2 + i * spacing;
        const cy = y;
        ctx.beginPath();
        ctx.arc(cx, cy, dia * SCALE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    };

    // Top Bars
    // If Sagging: Top = Compression/Hanger (Red/Gray).
    // If Hogging: Top = Main Tension (Red).
    const topColor = isSagging ? "#888" : "#d32f2f";
    const botColor = isSagging ? "#d32f2f" : "#888";

    // Draw Top
    drawBars(actualTopCount, actualTopDia, true, topColor);

    // Draw Bottom
    drawBars(bottomCount, bottomDia, false, botColor);

    // 4. Label
    if (showLabels) {
      ctx.fillStyle = "#000";
      ctx.font = "bold 16px Sans-Serif";
      ctx.textAlign = "center";
      // Center label below section
      const xLabel = xWebLeft + (webWidth * SCALE) / 2;
      ctx.fillText(label, xLabel, yS_Bot + 50);

      // Zoning Label
      ctx.font = "italic 12px Sans-Serif";
      ctx.fillText(isSagging ? "(Bottom Tension)" : "(Top Tension)", xLabel, yS_Bot + 70);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="bg-white"
        style={{ maxWidth: '100%' }}
      />
    </div>
  );
};

export default BeamColumnDrawer;
