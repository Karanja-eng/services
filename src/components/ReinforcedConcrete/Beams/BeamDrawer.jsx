import React, { useRef, useEffect } from "react";

/**
 * BeamColumnDrawer (2D)
 * Renders professional cross-sections of RC beams/columns.
 * AutoCAD-style clean lines, black theme, dimensions, and callouts.
 */
const BeamColumnDrawer = ({
  config = {},
  section = "midspan", // "midspan", "support", or "both"
  showLabels = true
}) => {
  const canvasRef = useRef(null);
  const SCALE = 0.4; // Pixels per mm - slightly smaller to fit labels

  const {
    type = "t_beam",
    webWidth = 300,
    beamDepth = 500,
    flangeThk = 150,
    flangeWidth = 1000,

    saggingBarsCount = 3,
    saggingBarDiameter = 20,
    saggingCompCount = 2,
    saggingCompDia = 12,

    hoggingBarsCount = 3,
    hoggingBarDiameter = 20,
    hoggingCompCount = 2,
    hoggingCompDia = 20,

    linksDiameter = 10,
    linksSpacing = 200,
    cover = 30,
  } = config;

  useEffect(() => {
    draw();
  }, [config, section]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (section === "midspan") {
      drawSection(ctx, canvas.width / 2, canvas.height / 2, "SECTION A-A (MID-SPAN)", true);
    } else if (section === "support") {
      drawSection(ctx, canvas.width / 2, canvas.height / 2, "SECTION B-B (SUPPORT)", false);
    } else if (section === "both") {
      drawSection(ctx, 220, canvas.height / 2, "SECTION A-A (MID-SPAN)", true);
      drawSection(ctx, 580, canvas.height / 2, "SECTION B-B (SUPPORT)", false);
    }
  };

  const drawSection = (ctx, centerX, centerY, label, isSagging) => {
    const bw = webWidth;
    const bf = type === "rectangular" ? webWidth : flangeWidth;
    const h = beamDepth;
    const hf = flangeThk;

    // Reinforcement logic
    const topCount = isSagging ? saggingCompCount : hoggingBarsCount;
    const topDia = isSagging ? saggingCompDia : hoggingBarDiameter;
    const botCount = isSagging ? saggingBarsCount : hoggingCompCount;
    const botDia = isSagging ? saggingBarDiameter : hoggingCompDia;

    // Origin is the center of the beam vertically, and center of web horizontally
    const x0 = centerX;
    const y0 = centerY;

    const drawLine = (x1, y1, x2, y2, width = 1, dash = []) => {
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.strokeStyle = "#000000";
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawDimension = (x1, y1, x2, y2, text, offset, vertical = false) => {
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "#000000";
      ctx.fillStyle = "#000000";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";

      if (vertical) {
        const dx = offset;
        drawLine(x1, y1, x1 + dx * 1.2, y1, 0.5); // Extension lines
        drawLine(x2, y2, x2 + dx * 1.2, y2, 0.5);

        // Dim line
        const dimX = x1 + dx;
        drawLine(dimX, y1, dimX, y2, 0.8);

        // Ticks (45 deg)
        drawLine(dimX - 4, y1 + 4, dimX + 4, y1 - 4, 1);
        drawLine(dimX - 4, y2 + 4, dimX + 4, y2 - 4, 1);

        // Text
        ctx.save();
        ctx.translate(dimX - 10, (y1 + y2) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        const dy = offset;
        drawLine(x1, y1, x1, y1 + dy * 1.2, 0.5);
        drawLine(x2, y2, x2, y2 + dy * 1.2, 0.5);

        const dimY = y1 + dy;
        drawLine(x1, dimY, x2, dimY, 0.8);

        // Ticks
        drawLine(x1 - 4, dimY + 4, x1 + 4, dimY - 4, 1);
        drawLine(x2 - 4, dimY + 4, x2 + 4, dimY - 4, 1);

        ctx.fillText(text, (x1 + x2) / 2, dimY - 5);
      }
    };

    const drawLeader = (targetX, targetY, endX, endY, text) => {
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

    // 1. Concrete Shape
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#000000";

    let topY = y0 - (h / 2) * SCALE;
    let botY = y0 + (h / 2) * SCALE;
    let flangeBotY = topY + hf * SCALE;
    let webLX = x0 - (bw / 2) * SCALE;
    let webRX = x0 + (bw / 2) * SCALE;
    let flangeLX = x0 - (bf / 2) * SCALE;
    let flangeRX = x0 + (bf / 2) * SCALE;

    if (type === "t_beam") {
      ctx.moveTo(flangeLX, topY);
      ctx.lineTo(flangeRX, topY);
      ctx.lineTo(flangeRX, flangeBotY);
      ctx.lineTo(webRX, flangeBotY);
      ctx.lineTo(webRX, botY);
      ctx.lineTo(webLX, botY);
      ctx.lineTo(webLX, flangeBotY);
      ctx.lineTo(flangeLX, flangeBotY);
      ctx.closePath();
    } else if (type === "l_beam") {
      ctx.moveTo(flangeLX, topY);
      ctx.lineTo(webRX, topY);
      ctx.lineTo(webRX, botY);
      ctx.lineTo(webLX, botY);
      ctx.lineTo(webLX, flangeBotY);
      ctx.lineTo(flangeLX, flangeBotY);
      ctx.closePath();
    } else {
      ctx.rect(webLX, topY, (webRX - webLX), (botY - topY));
    }
    ctx.stroke();

    // 2. Stirrups (Links)
    ctx.beginPath();
    ctx.lineWidth = 1.0;
    const sCover = cover * SCALE;
    const sLX = webLX + sCover;
    const sRX = webRX - sCover;
    const sTY = topY + sCover;
    const sBY = botY - sCover;
    ctx.rect(sLX, sTY, sRX - sLX, sBY - sTY);
    ctx.stroke();

    // 3. Reinforcement Bars
    const drawBars = (count, dia, isTop) => {
      if (!count || count <= 0) return;
      const dS = dia * SCALE;
      // Fixed position slightly inside stirrup corners
      const barY = isTop ? sTY + dS / 2 + 1 : sBY - dS / 2 - 1;
      const availW = (sRX - sLX) - dS - 2;
      const spacing = count > 1 ? availW / (count - 1) : 0;

      for (let i = 0; i < count; i++) {
        const barX = sLX + dS / 2 + 1 + (count > 1 ? i * spacing : availW / 2);
        ctx.beginPath();
        ctx.fillStyle = "#000000";
        ctx.arc(barX, barY, Math.max(dS / 2, 1.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Leader for the first group of bars
        if (i === 0) {
          const leaderText = `${count}T${dia}`;
          const isLeft = centerX < 400; // Heuristic for side to place callouts
          const endX = isLeft ? centerX - 120 : centerX + 120;
          const endY = isTop ? topY - 50 : botY + 50;
          drawLeader(barX, barY, endX, endY, leaderText);
        }
      }
    };

    drawBars(topCount, topDia, true);
    drawBars(botCount, botDia, false);

    // Leader for Stirrups
    const stirrupText = `R${linksDiameter} @ ${linksSpacing}`;
    drawLeader(sLX, (sTY + sBY) / 2, centerX - 130, centerY, stirrupText);

    // 4. Dimensions
    if (showLabels) {
      // Depth
      drawDimension(webRX, topY, webRX, botY, h.toString(), 40, true);

      // Web Width
      drawDimension(webLX, botY, webRX, botY, bw.toString(), 30);

      if (type !== "rectangular") {
        // Flange Width
        drawDimension(flangeLX, topY, flangeRX, topY, bf.toString(), -30);
        // Flange Thickness
        drawDimension(flangeRX, topY, flangeRX, flangeBotY, hf.toString(), 20, true);
      }

      // Title/Label
      ctx.fillStyle = "#000000";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, centerX, botY + 100);

      ctx.font = "italic 11px sans-serif";
      ctx.fillText(isSagging ? "(Span Section)" : "(Support Section)", centerX, botY + 115);
    }
  };

  return (
    <div className="flex flex-col items-center w-full p-6 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="w-full flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          2D Detailing View
        </h3>
        <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200 uppercase">
          AutoCAD Detailing Mode
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
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Beam Type</p>
          <p className="text-sm font-semibold text-slate-700 capitalize">{type.replace('_', ' ')}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Dimensions</p>
          <p className="text-sm font-semibold text-slate-700">{webWidth} × {beamDepth} mm</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Cover</p>
          <p className="text-sm font-semibold text-slate-700">{cover} mm (Nominal)</p>
        </div>
      </div>
    </div>
  );
};

export default BeamColumnDrawer;
