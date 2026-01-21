import React from "react";
import { Group, Rect, Line, Circle, Text, Stage, Layer } from 'react-konva';

/**
 * BeamKonvaDrawer (2D)
 * Renders professional cross-sections of RC beams with AutoCAD-style detailing.
 */
const BeamKonvaGroup = ({
  config = {},
  section = "midspan", // "midspan", "support", or "both"
  showLabels = true,
  x = 0,
  y = 0,
  scale = 0.4
}) => {
  const {
    type = "t_beam",
    webWidth = 300,
    beamDepth = 500,
    flangeThk = 150,
    flangeWidth = 1000,
    linksDiameter = 10,
    linksSpacing = 200,
    cover = 30,
    saggingBarsCount = 3,
    saggingBarDiameter = 20,
    saggingCompCount = 2,
    saggingCompDia = 12,
    hoggingBarsCount = 3,
    hoggingBarDiameter = 20,
    hoggingCompCount = 2,
    hoggingCompDia = 20,
  } = config;

  // --- Detailing Helpers ---
  const DimensionLine = ({ x1, y1, x2, y2, text, vertical = false, offset = 30 }) => {
    const lineX1 = vertical ? x1 - offset : x1;
    const lineY1 = vertical ? y1 : y1 - offset;
    const lineX2 = vertical ? x2 - offset : x2;
    const lineY2 = vertical ? y2 : y2 - offset;
    return (
      <Group>
        <Line points={[lineX1, lineY1, lineX2, lineY2]} stroke="black" strokeWidth={0.8} />
        <Line points={[x1, y1, lineX1, lineY1]} stroke="#666" strokeWidth={0.5} />
        <Line points={[x2, y2, lineX2, lineY2]} stroke="#666" strokeWidth={0.5} />
        <Line points={[lineX1 - 4, lineY1 + 4, lineX1 + 4, lineY1 - 4]} stroke="black" strokeWidth={1.2} />
        <Line points={[lineX2 - 4, lineY2 + 4, lineX2 + 4, lineY2 - 4]} stroke="black" strokeWidth={1.2} />
        <Text
          x={vertical ? lineX1 - 25 : (lineX1 + lineX2) / 2 - 20}
          y={vertical ? (lineY1 + lineY2) / 2 - 10 : lineY1 - 15}
          text={text}
          fontSize={10}
          fontFamily="Arial"
          rotation={vertical ? -90 : 0}
          fill="#000"
          align="center"
        />
      </Group>
    );
  };

  const LeaderLine = ({ tx, ty, ex, ey, text }) => {
    const angle = Math.atan2(ey - ty, ex - tx);
    const arrowSize = 6;
    const arrowPoints = [
      tx, ty,
      tx + arrowSize * Math.cos(angle + 0.5), ty + arrowSize * Math.sin(angle + 0.5),
      tx + arrowSize * Math.cos(angle - 0.5), ty + arrowSize * Math.sin(angle - 0.5),
    ];
    return (
      <Group>
        <Line points={[tx, ty, ex, ey, ex + (ex > tx ? 20 : -20), ey]} stroke="#000" strokeWidth={0.8} />
        <Line points={arrowPoints} closed fill="#333" stroke="#000" strokeWidth={1} />
        <Text x={ex + (ex > tx ? 25 : -95)} y={ey - 5} text={text} fontSize={10} fontFamily="Arial" fill="#000" />
      </Group>
    );
  };

  const renderSection = (centerX, centerY, label, isSagging) => {
    const bw = webWidth;
    const bf = type === "rectangular" ? webWidth : flangeWidth;
    const h = beamDepth;
    const hf = flangeThk;

    const topCount = isSagging ? saggingCompCount : hoggingBarsCount;
    const topDia = isSagging ? saggingCompDia : hoggingBarDiameter;
    const botCount = isSagging ? saggingBarsCount : hoggingCompCount;
    const botDia = isSagging ? saggingBarDiameter : hoggingCompDia;

    let topY = centerY - (h * 0.5) * scale;
    let botY = centerY + (h * 0.5) * scale;
    let flangeBotY = topY + hf * scale;
    let webLX = centerX - (bw * 0.5) * scale;
    let webRX = centerX + (bw * 0.5) * scale;
    let flangeLX = centerX - (bf * 0.5) * scale;
    let flangeRX = centerX + (bf * 0.5) * scale;

    const elements = [];

    // 1. Concrete Shape
    let points = [];
    if (type === "t_beam") points = [flangeLX, topY, flangeRX, topY, flangeRX, flangeBotY, webRX, flangeBotY, webRX, botY, webLX, botY, webLX, flangeBotY, flangeLX, flangeBotY];
    else if (type === "l_beam") points = [flangeLX, topY, webRX, topY, webRX, botY, webLX, botY, webLX, flangeBotY, flangeLX, flangeBotY];
    else points = [webLX, topY, webRX, topY, webRX, botY, webLX, botY];

    elements.push(<Line key={`${label}-concrete`} points={points} closed stroke="#000" strokeWidth={2.5} />);

    // 2. Stirrups
    const sCover = (cover + linksDiameter / 2) * scale;
    const sLX = webLX + sCover;
    const sRX = webRX - sCover;
    const sTY = topY + sCover;
    const sBY = botY - sCover;
    elements.push(<Rect key={`${label}-stirrup`} x={sLX} y={sTY} width={sRX - sLX} height={sBY - sTY} stroke="#333" strokeWidth={1} cornerRadius={linksDiameter * scale} />);

    // 3. Bars
    const drawBars = (count, dia, isTop) => {
      const bars = [];
      if (!count || count <= 0) return bars;
      const dS = dia * scale;
      const barY = isTop ? sTY + dS * 0.5 + 1 : sBY - dS * 0.5 - 1;
      const availW = (sRX - sLX) - dS - 2;
      const spacing = count > 1 ? availW / (count - 1) : 0;
      for (let i = 0; i < count; i++) {
        const barX = sLX + dS * 0.5 + 1 + (count > 1 ? i * spacing : availW * 0.5);
        bars.push(<Circle key={`${label}-bar-${isTop ? 'top' : 'bot'}-${i}`} x={barX} y={barY} radius={Math.max(dS * 0.5, 2)} fill="#000" />);
      }
      return bars;
    };
    elements.push(...drawBars(topCount, topDia, true));
    elements.push(...drawBars(botCount, botDia, false));

    // 4. Detailing
    if (showLabels) {
      elements.push(<DimensionLine key={`${label}-dim-w`} x1={webLX} y1={botY} x2={webRX} y2={botY} text={`${bw}`} offset={-30} />);
      elements.push(<DimensionLine key={`${label}-dim-h`} x1={webRX} y1={topY} x2={webRX} y2={botY} text={`${h}`} vertical offset={-30} />);
      if (type !== "rectangular") elements.push(<DimensionLine key={`${label}-dim-fw`} x1={flangeLX} y1={topY} x2={flangeRX} y2={topY} text={`${bf}`} offset={25} />);

      elements.push(<LeaderLine key={`${label}-lead-top`} tx={sLX + 8} ty={sTY + 5} ex={centerX - 80} ey={topY - 30} text={`${topCount}T${topDia}`} />);
      elements.push(<LeaderLine key={`${label}-lead-bot`} tx={sRX - 8} ty={sBY - 5} ex={centerX + 80} ey={botY + 30} text={`${botCount}T${botDia}`} />);
      elements.push(<LeaderLine key={`${label}-lead-link`} tx={webRX - sCover} ty={(sTY + sBY) / 2} ex={webRX + 50} ey={(sTY + sBY) / 2 - 10} text={`R${linksDiameter}@${linksSpacing}`} />);

      elements.push(<Text key={`${label}-title`} x={centerX - 100} y={botY + 55} width={200} text={label} align="center" fontSize={13} fontStyle="bold" fill="#000" />);
    }
    return elements;
  };

  return (
    <Group x={x} y={y}>
      {section === "midspan" && renderSection(0, 0, "SECTION A-A (MIDSPAN)", true)}
      {section === "support" && renderSection(0, 0, "SECTION B-B (SUPPORT)", false)}
      {section === "both" && (
        <>
          {renderSection(-180, 0, "SECTION A-A", true)}
          {renderSection(180, 0, "SECTION B-B", false)}
        </>
      )}
    </Group>
  );
};

export { BeamKonvaGroup };

/**
 * Returns an array of CAD objects (lines, circles, text) representing the beam design.
 * Used for "exploding" members in the universal CAD drawer.
 */
export const getBeamCADPrimitives = (config, x = 0, y = 0, scale = 0.5) => {
  const {
    type = "rectangular",
    webWidth = 300,
    beamDepth = 500,
    flangeThk = 150,
    flangeWidth = 1000,
    cover = 30,
    saggingBarsCount = 3,
    saggingBarDiameter = 20,
    saggingCompCount = 2,
    saggingCompDia = 16,
    linksDiameter = 10,
  } = config;

  const bw = webWidth * scale;
  const h = beamDepth * scale;
  const bf = (type === "rectangular" ? webWidth : flangeWidth) * scale;
  const hf = flangeThk * scale;
  const topY = y - h / 2;
  const botY = y + h / 2;
  const webLX = x - bw / 2;
  const webRX = x + bw / 2;
  const flangeLX = x - bf / 2;
  const flangeRX = x + bf / 2;

  const primitives = [];
  const layerId = "structural";

  // 1. Concrete Outline (Lines)
  let pts = [];
  if (type === "t_beam") pts = [flangeLX, topY, flangeRX, topY, flangeRX, topY + hf, webRX, topY + hf, webRX, botY, webLX, botY, webLX, topY + hf, flangeLX, topY + hf, flangeLX, topY];
  else pts = [webLX, topY, webRX, topY, webRX, botY, webLX, botY, webLX, topY];

  for (let i = 0; i < pts.length - 2; i += 2) {
    primitives.push({ id: Math.random().toString(), type: 'line', start: { x: pts[i], y: pts[i + 1] }, end: { x: pts[i + 2], y: pts[i + 3] }, color: '#000', layerId });
  }

  // 2. Stirrup (Rectangle-ish)
  const sc = (cover + linksDiameter / 2) * scale;
  const sLX = webLX + sc;
  const sRX = webRX - sc;
  const sTY = topY + sc;
  const sBY = botY - sc;
  primitives.push({ id: Math.random().toString(), type: 'rectangle', start: { x: sLX, y: sTY }, end: { x: sRX, y: sBY }, color: '#333', layerId });

  // 3. Bars (Circles)
  const drawBars = (count, dia, isTop) => {
    if (!count) return;
    const dS = dia * scale;
    const barY = isTop ? sTY + dS / 2 + 1 : sBY - dS / 2 - 1;
    const availW = (sRX - sLX) - dS;
    const spacing = count > 1 ? availW / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
      const barX = sLX + dS / 2 + (count > 1 ? i * spacing : availW / 2);
      primitives.push({ id: Math.random().toString(), type: 'circle', center: { x: barX, y: barY }, radius: dS / 2, color: '#000', layerId });
    }
  };
  drawBars(saggingCompCount, saggingCompDia, true);
  drawBars(saggingBarsCount, saggingBarDiameter, false);

  // 4. Detailing (Dimensions)
  const addDim = (x1, y1, x2, y2, text, vertical = false, offset = 30) => {
    const lineX1 = vertical ? x1 - offset : x1;
    const lineY1 = vertical ? y1 : y1 - offset;
    const lineX2 = vertical ? x2 - offset : x2;
    const lineY2 = vertical ? y2 : y2 - offset;
    // Main line
    primitives.push({ id: Math.random().toString(), type: 'line', start: { x: lineX1, y: lineY1 }, end: { x: lineX2, y: lineY2 }, color: '#666', layerId });
    // Extension lines
    primitives.push({ id: Math.random().toString(), type: 'line', start: { x: x1, y: y1 }, end: { x: lineX1, y: lineY1 }, color: '#999', layerId });
    primitives.push({ id: Math.random().toString(), type: 'line', start: { x: x2, y: y2 }, end: { x: lineX2, y: lineY2 }, color: '#999', layerId });
    // Text
    primitives.push({
      id: Math.random().toString(),
      type: 'text',
      position: { x: vertical ? lineX1 - 15 : (lineX1 + lineX2) / 2, y: vertical ? (lineY1 + lineY2) / 2 : lineY1 - 10 },
      text,
      size: 0.8,
      color: '#000',
      layerId
    });
  };

  addDim(webLX, botY, webRX, botY, `${webWidth}`, false, -30);
  addDim(webRX, topY, webRX, botY, `${beamDepth}`, true, -30);
  if (type !== "rectangular") addDim(flangeLX, topY, flangeRX, topY, `${flangeWidth}`, false, 25);

  // 5. Leader Lines (Simplified as lines and text)
  const addLeader = (tx, ty, ex, ey, text) => {
    primitives.push({ id: Math.random().toString(), type: 'line', start: { x: tx, y: ty }, end: { x: ex, y: ey }, color: '#333', layerId });
    primitives.push({ id: Math.random().toString(), type: 'line', start: { x: ex, y: ey }, end: { x: ex + (ex > tx ? 20 : -20), y: ey }, color: '#333', layerId });
    primitives.push({
      id: Math.random().toString(),
      type: 'text',
      position: { x: ex + (ex > tx ? 25 : -80), y: ey - 5 },
      text,
      size: 0.8,
      color: '#000',
      layerId
    });
  };

  const sc_off = sc * 0.8;
  addLeader(sLX + sc_off, sTY + sc_off, x - 100, topY - 50, `${saggingCompCount}T${saggingCompDia}`);
  addLeader(sRX - sc_off, sBY - sc_off, x + 100, botY + 50, `${saggingBarsCount}T${saggingBarDiameter}`);

  // 6. Section Title
  primitives.push({ id: Math.random().toString(), type: 'text', position: { x: x - 50, y: botY + 80 }, text: "SECTION A-A", size: 1.2, color: '#000', layerId });

  return primitives;
};

const BeamKonvaDrawer = (props) => {
  const width = props.canvasWidth || 500;
  const height = props.canvasHeight || 400;
  return (
    <Stage width={width} height={height}>
      <Layer>
        <BeamKonvaGroup {...props} x={width / 2} y={height / 2} />
      </Layer>
    </Stage>
  );
};

export default BeamKonvaDrawer;
