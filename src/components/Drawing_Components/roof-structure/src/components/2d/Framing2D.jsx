// ─────────────────────────────────────────────────────────────
//  Framing2D.jsx
//  React Konva — roof framing plan view.
//  Includes: footprint, ridge, common rafters, truss centres,
//            hip/valley lines, purlin dots, section marks,
//            dimension annotations.
//
//  Props:
//    footprint     { w, d }  (building width × depth, metres)
//    pitch         number   (degrees)
//    rafterSpacing number   (metres, default 0.6)
//    trussBays     number   (truss count)
//    trussSpacing  number   (metres)
//    roofType      'gable'|'hip'|'valley'
//    material      'timber'|'steel'
//    width         number   (canvas px)
//    height        number   (canvas px)
//    margin        number   (px)
//    showRafters   bool
//    showTrusses   bool
//    showPurlins   bool
//    showDimensions bool
//    showSectionMarks bool
//
//  Usage:
//    <Framing2D footprint={{ w:8, d:12 }} pitch={30}
//               roofType="hip" trussBays={5} trussSpacing={0.6} />
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react';
import Konva from 'konva';
import { MEMBER_COLORS, DEG } from '../constants/roofStructureTypes.js';

export default function Framing2D({
  footprint      = { w: 8, d: 12 },
  pitch          = 30,
  rafterSpacing  = 0.6,
  trussBays      = 5,
  trussSpacing   = 0.6,
  roofType       = 'gable',
  material       = 'timber',
  width          = 700,
  height         = 500,
  margin         = 50,
  showRafters    = true,
  showTrusses    = true,
  showPurlins    = true,
  showDimensions = true,
  showSectionMarks = true,
}) {
  const containerRef = useRef(null);
  const stageRef     = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

    const stage = new Konva.Stage({ container: containerRef.current, width, height });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    const { w, d }   = footprint;
    const usableW    = width  - margin * 2;
    const usableH    = height - margin * 2;
    const scale      = Math.min(usableW / w, usableH / d);
    const originX    = (width  - w * scale) / 2;
    const originY    = (height - d * scale) / 2;

    const toX = x => originX + x * scale;
    const toY = z => originY + z * scale;

    // ── Background ────────────────────────────────────────────
    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#f0efe8' }));

    // ── Footprint ─────────────────────────────────────────────
    layer.add(new Konva.Rect({
      x: toX(0), y: toY(0),
      width: w * scale, height: d * scale,
      fill: 'rgba(220,215,200,0.55)',
      stroke: '#444', strokeWidth: 1.5,
    }));

    // ── Hip geometry ─────────────────────────────────────────
    const hipInset = roofType === 'hip' ? Math.min(w / 2, d / 2) : 0;
    const ridgeZ0  = roofType === 'hip' ? hipInset : 0;
    const ridgeZ1  = roofType === 'hip' ? d - hipInset : d;

    // ── Ridge line ─────────────────────────────────────────────
    const ridgeX = toX(w / 2);
    layer.add(new Konva.Line({
      points: [ridgeX, toY(ridgeZ0), ridgeX, toY(ridgeZ1)],
      stroke: MEMBER_COLORS.ridge,
      strokeWidth: 2.0,
      dash: [10, 5],
    }));
    layer.add(new Konva.Text({ x: ridgeX + 5, y: toY(ridgeZ0) + 3, text: 'Ridge', fill: MEMBER_COLORS.ridge, fontSize: 10, fontStyle: 'bold' }));

    // ── Hip corner lines ──────────────────────────────────────
    if (roofType === 'hip') {
      const corners = [[0,0],[w,0],[0,d],[w,d]];
      const ridgeEnds = [[w/2,ridgeZ0],[w/2,ridgeZ1]];
      corners.forEach(([cx,cz]) => {
        const nearRidge = cz < d/2 ? ridgeEnds[0] : ridgeEnds[1];
        layer.add(new Konva.Line({
          points: [toX(cx), toY(cz), toX(nearRidge[0]), toY(nearRidge[1])],
          stroke: MEMBER_COLORS.hip,
          strokeWidth: 1.8,
        }));
      });
    }

    // ── Valley lines ──────────────────────────────────────────
    if (roofType === 'valley') {
      layer.add(new Konva.Line({
        points: [toX(0), toY(d/2), toX(w/2), toY(d/2)],
        stroke: MEMBER_COLORS.valley, strokeWidth: 1.5, dash: [5,3],
      }));
    }

    // ── Common rafters ────────────────────────────────────────
    if (showRafters) {
      const numR = Math.floor(d / rafterSpacing) + 2;
      for (let r = 0; r <= numR; r++) {
        const rz = r * rafterSpacing;
        if (rz > d + 0.01) break;
        const ry = toY(rz);
        layer.add(new Konva.Line({
          points: [toX(0), ry, toX(w), ry],
          stroke: MEMBER_COLORS.rafter,
          strokeWidth: 0.9,
          opacity: 0.55,
        }));
      }
    }

    // ── Truss centre lines ────────────────────────────────────
    if (showTrusses) {
      const totalTrussLen = (trussBays - 1) * trussSpacing;
      const startZ = (d - totalTrussLen) / 2;
      for (let b = 0; b < trussBays; b++) {
        const tz = startZ + b * trussSpacing;
        const ty = toY(tz);
        layer.add(new Konva.Line({
          points: [toX(0), ty, toX(w), ty],
          stroke: MEMBER_COLORS.chord,
          strokeWidth: 1.6,
        }));
        // Truss number label
        layer.add(new Konva.Text({ x: toX(0) - 24, y: ty - 7, text: `T${b + 1}`, fontSize: 9, fill: MEMBER_COLORS.chord }));
      }
    }

    // ── Purlin marks (dots on slope) ──────────────────────────
    if (showPurlins) {
      [0.25, 0.55, 0.80].forEach(frac => {
        const px = w * frac / 2;
        const numR = Math.floor(d / rafterSpacing) + 2;
        // Mark every 4th rafter position with a purlin dot
        for (let r = 0; r <= numR; r += 4) {
          const rz = r * rafterSpacing;
          if (rz > d + 0.01) break;
          // Left slope
          layer.add(new Konva.Circle({ x: toX(px), y: toY(rz), radius: 3, fill: MEMBER_COLORS.purlin }));
          // Right slope mirror
          layer.add(new Konva.Circle({ x: toX(w - px), y: toY(rz), radius: 3, fill: MEMBER_COLORS.purlin }));
        }
      });
    }

    // ── Slope direction arrows ────────────────────────────────
    const arrowPts = [
      [w * 0.25, d / 2, -1, 0],  // left slope: arrow pointing left
      [w * 0.75, d / 2,  1, 0],  // right slope: arrow pointing right
    ];
    arrowPts.forEach(([ax, az, dx]) => {
      const sx = toX(ax);
      const sy = toY(az);
      layer.add(new Konva.Arrow({
        points: [sx, sy, sx + dx * scale * 0.8, sy],
        pointerLength: 8, pointerWidth: 6,
        fill: '#555', stroke: '#555', strokeWidth: 1.2,
      }));
    });
    layer.add(new Konva.Text({ x: toX(w * 0.25) - 10, y: toY(d / 2) - 16, text: `${pitch}°`, fill: '#555', fontSize: 10, fontStyle: 'bold' }));
    layer.add(new Konva.Text({ x: toX(w * 0.75) - 10, y: toY(d / 2) - 16, text: `${pitch}°`, fill: '#555', fontSize: 10, fontStyle: 'bold' }));

    // ── Section marks ─────────────────────────────────────────
    if (showSectionMarks) {
      const smZ = d / 3;
      const smY = toY(smZ);
      const smX0 = toX(-0.6), smX1 = toX(w + 0.6);
      // Section line
      layer.add(new Konva.Line({
        points: [smX0, smY, smX1, smY],
        stroke: '#333', strokeWidth: 0.8, dash: [3, 2],
      }));
      // End symbols
      [smX0, smX1].forEach((sx, i) => {
        layer.add(new Konva.Circle({ x: sx, y: smY, radius: 6, fill: '#333' }));
        layer.add(new Konva.Text({ x: sx - 4, y: smY - 17, text: i === 0 ? 'A' : "A'", fill: '#333', fontSize: 10, fontStyle: 'bold' }));
      });
    }

    // ── Dimension lines ───────────────────────────────────────
    if (showDimensions) {
      const dimOffset = 30;
      // Width
      const wy = toY(d) + dimOffset;
      layer.add(new Konva.Line({ points: [toX(0), toY(d) + 2, toX(0), wy + 5], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [toX(w), toY(d) + 2, toX(w), wy + 5], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [toX(0), wy, toX(w), wy], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Text({ x: (toX(0) + toX(w)) / 2 - 18, y: wy + 4, text: `${w.toFixed(1)} m`, fill: '#555', fontSize: 10 }));

      // Depth
      const dx = toX(w) + dimOffset;
      layer.add(new Konva.Line({ points: [toX(w) + 2, toY(0), dx + 5, toY(0)], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [toX(w) + 2, toY(d), dx + 5, toY(d)], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [dx, toY(0), dx, toY(d)], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Text({ x: dx + 4, y: (toY(0) + toY(d)) / 2 - 7, text: `${d.toFixed(1)} m`, fill: '#555', fontSize: 10 }));

      // Rafter spacing annotation
      if (showRafters) {
        const rs0 = toY(0), rs1 = toY(rafterSpacing);
        layer.add(new Konva.Line({ points: [toX(w) + 60, rs0, toX(w) + 60, rs1], stroke: '#999', strokeWidth: 0.7 }));
        layer.add(new Konva.Text({ x: toX(w) + 63, y: (rs0 + rs1) / 2 - 6, text: `${Math.round(rafterSpacing * 1000)}`, fill: '#777', fontSize: 9 }));
        layer.add(new Konva.Text({ x: toX(w) + 63, y: (rs0 + rs1) / 2 + 2, text: 'mm', fill: '#777', fontSize: 9 }));
      }
    }

    // ── Legend ────────────────────────────────────────────────
    const lx = 12, ly = height - 95;
    layer.add(new Konva.Rect({ x: lx - 6, y: ly - 5, width: 160, height: 88, fill: 'rgba(255,255,255,0.88)', cornerRadius: 5, stroke: '#ccc', strokeWidth: 0.5 }));
    [
      [MEMBER_COLORS.ridge,   2.0, [10,5],  'Ridge beam'],
      [MEMBER_COLORS.chord,   1.6, [],      'Truss centres'],
      [MEMBER_COLORS.rafter,  0.9, [],      'Common rafters'],
      [MEMBER_COLORS.hip,     1.8, [],      'Hip / valley'],
      [MEMBER_COLORS.purlin,  0,   [],      '● Purlin position'],
    ].forEach(([col, sw, dash, lbl], i) => {
      if (sw > 0) {
        layer.add(new Konva.Line({ points: [lx, ly + i * 16 + 8, lx + 20, ly + i * 16 + 8], stroke: col, strokeWidth: sw, dash, lineCap: 'round' }));
      } else {
        layer.add(new Konva.Circle({ x: lx + 10, y: ly + i * 16 + 8, radius: 3.5, fill: col }));
      }
      layer.add(new Konva.Text({ x: lx + 25, y: ly + i * 16 + 1, text: lbl, fontSize: 10, fill: '#444' }));
    });

    // ── Title ─────────────────────────────────────────────────
    layer.add(new Konva.Text({
      x: 12, y: 12,
      text: `Framing plan — ${w.toFixed(1)} m × ${d.toFixed(1)} m · ${pitch}° · ${roofType}`,
      fontSize: 12, fontStyle: 'bold', fill: '#222',
    }));
    layer.add(new Konva.Text({
      x: 12, y: 27,
      text: `${material} · rafters @ ${Math.round(rafterSpacing * 1000)} mm · ${trussBays} trusses @ ${Math.round(trussSpacing * 1000)} mm`,
      fontSize: 10, fill: '#666',
    }));

    layer.draw();
    return () => { stage.destroy(); stageRef.current = null; };
  }, [footprint, pitch, rafterSpacing, trussBays, trussSpacing, roofType, material,
      width, height, margin, showRafters, showTrusses, showPurlins,
      showDimensions, showSectionMarks]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, borderRadius: 8, overflow: 'hidden' }}
    />
  );
}
