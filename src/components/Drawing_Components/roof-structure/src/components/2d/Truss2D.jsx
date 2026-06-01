// ─────────────────────────────────────────────────────────────
//  Truss2D.jsx
//  React Konva — precise truss elevation diagram.
//  Includes: member stick lines, node circles, support symbols,
//            dimension lines (span, rise, panel points),
//            compression/tension colour coding, member labels.
//
//  Props:
//    type          'king'|'queen'|'howe'|'pratt'|'fan'|'attic'|'mono'
//    span          number  (metres)
//    pitch         number  (degrees)
//    width         number  (canvas px, default 700)
//    height        number  (canvas px, default 400)
//    margin        number  (px padding, default 72)
//    material      'timber'|'steel'
//    bays          number  (shown as annotation)
//    spacing       number  (m, shown as annotation)
//    showLabels    bool
//    showDimensions bool
//    showLegend    bool
//
//  Usage:
//    <Truss2D type="queen" span={9} pitch={35} width={700} height={380} />
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react';
import Konva from 'konva';

import {
  trussTopology,
  TRUSS_TYPES,
  MEMBER_COLORS,
  DEG,
} from '../../constants/roofStructureTypes.js';

export default function Truss2D({
  type           = 'king',
  span           = 8,
  pitch          = 30,
  width          = 700,
  height         = 400,
  margin         = 72,
  material       = 'timber',
  bays           = 5,
  spacing        = 0.6,
  showLabels     = true,
  showDimensions = true,
  showLegend     = true,
}) {
  const containerRef = useRef(null);
  const stageRef     = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous stage
    if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

    const stage = new Konva.Stage({ container: containerRef.current, width, height });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    const { nodes, members, supports } = trussTopology(type, span, pitch);
    const rise  = (span / 2) * Math.tan(pitch * DEG);

    // Scale so truss fits within margins
    const usableW = width  - margin * 2;
    const usableH = height - margin * 2 - 40; // room for dims below
    const scale   = Math.min(usableW / span, usableH / (rise + 0.2));
    const originX = margin;
    const originY = height - margin - 30;

    // Helpers
    const toSx = x => originX + x * scale;
    const toSy = y => originY - y * scale;
    const toS  = ([x, y]) => [toSx(x), toSy(y)];

    // ── Background ────────────────────────────────────────────
    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#f8f7f4' }));

    // ── Ground line ───────────────────────────────────────────
    layer.add(new Konva.Line({
      points: [margin / 2, originY, width - margin / 2, originY],
      stroke: '#aaa', strokeWidth: 0.8, dash: [5, 5],
    }));

    // ── Members ───────────────────────────────────────────────
    members.forEach(([aKey, bKey, mType], idx) => {
      const [x0, y0] = toS(nodes[aKey]);
      const [x1, y1] = toS(nodes[bKey]);
      const isChord  = mType === 'chord';
      layer.add(new Konva.Line({
        points: [x0, y0, x1, y1],
        stroke: isChord ? MEMBER_COLORS.chord : MEMBER_COLORS.web,
        strokeWidth: isChord ? 3.5 : 2.2,
        lineCap: 'round',
      }));

      // Member label (C=compression, T=tension) at midpoint
      if (showLabels) {
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const labelText = isChord ? `C${Math.floor(idx / 2) + 1}` : `T${idx + 1}`;
        const angle = Math.atan2(y1 - y0, x1 - x0) * (180 / Math.PI);
        layer.add(new Konva.Text({
          x: mx - 8, y: my - 16,
          text: labelText,
          fontSize: 9, fill: isChord ? '#1a46aa' : '#b02020',
          rotation: 0,
        }));
      }
    });

    // ── Node circles ──────────────────────────────────────────
    Object.entries(nodes).forEach(([key, pos]) => {
      const [sx, sy] = toS(pos);
      const isSupport = supports.includes(key);

      layer.add(new Konva.Circle({
        x: sx, y: sy, radius: isSupport ? 7 : 5.5,
        fill:   isSupport ? MEMBER_COLORS.web : '#fff',
        stroke: isSupport ? '#900' : MEMBER_COLORS.chord,
        strokeWidth: 1.8,
      }));

      // Node key label
      layer.add(new Konva.Text({
        x: sx - 7, y: sy - 20,
        text: key, fontSize: 10,
        fill: '#444', fontStyle: 'bold',
      }));
    });

    // ── Support triangles ─────────────────────────────────────
    supports.forEach(key => {
      const [sx, sy] = toS(nodes[key]);
      // Filled triangle below support
      layer.add(new Konva.RegularPolygon({
        x: sx, y: sy + 14,
        sides: 3, radius: 11,
        fill: '#E24B4A', stroke: '#900', strokeWidth: 1.2,
      }));
      // Ground hash marks
      layer.add(new Konva.Line({
        points: [sx - 14, sy + 24, sx + 14, sy + 24],
        stroke: '#888', strokeWidth: 1.2,
      }));
    });

    // ── Dimension lines ───────────────────────────────────────
    if (showDimensions) {
      const dimY = originY + 36;
      const leftX  = toSx(0);
      const rightX = toSx(span);

      // Span dimension
      layer.add(new Konva.Line({ points: [leftX, originY + 2, leftX, dimY + 6], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [rightX, originY + 2, rightX, dimY + 6], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [leftX, dimY, rightX, dimY], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Text({ x: (leftX + rightX) / 2 - 26, y: dimY + 6, text: `Span: ${span.toFixed(1)} m`, fontSize: 10, fill: '#555' }));

      // Rise dimension (right side)
      const riseX  = toSx(span) + 30;
      const eaveY  = toSy(0);
      const apexY  = toSy(rise);
      layer.add(new Konva.Line({ points: [toSx(span), eaveY, riseX + 4, eaveY], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [toSx(span), apexY, riseX + 4, apexY], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [riseX, eaveY, riseX, apexY], stroke: '#666', strokeWidth: 0.8 }));
      layer.add(new Konva.Text({ x: riseX + 5, y: (eaveY + apexY) / 2 - 7, text: `Rise: ${rise.toFixed(2)} m`, fontSize: 10, fill: '#555' }));

      // Half-span annotation
      const midX = toSx(span / 2);
      layer.add(new Konva.Line({ points: [leftX, dimY - 14, midX, dimY - 14], stroke: '#aaa', strokeWidth: 0.6, dash: [3, 3] }));
      layer.add(new Konva.Text({ x: (leftX + midX) / 2 - 20, y: dimY - 25, text: `${(span / 2).toFixed(2)} m`, fontSize: 9, fill: '#777' }));
    }

    // ── Legend ────────────────────────────────────────────────
    if (showLegend) {
      const lx = width - 175, ly = 12;
      layer.add(new Konva.Rect({ x: lx - 8, y: ly - 5, width: 168, height: 56, fill: 'rgba(255,255,255,0.9)', cornerRadius: 5, stroke: '#ddd', strokeWidth: 0.5 }));
      [
        [MEMBER_COLORS.chord, 3.5, 'Chord (compression)'],
        [MEMBER_COLORS.web,   2.2, 'Web (tension)'],
        [MEMBER_COLORS.web,   0,   '● Node / joint'],
      ].forEach(([col, sw, lbl], i) => {
        if (sw > 0) {
          layer.add(new Konva.Line({ points: [lx, ly + i * 17 + 8, lx + 22, ly + i * 17 + 8], stroke: col, strokeWidth: sw, lineCap: 'round' }));
        } else {
          layer.add(new Konva.Circle({ x: lx + 11, y: ly + i * 17 + 8, radius: 5, fill: '#fff', stroke: MEMBER_COLORS.chord, strokeWidth: 1.8 }));
        }
        layer.add(new Konva.Text({ x: lx + 28, y: ly + i * 17, text: lbl, fontSize: 10, fill: '#444' }));
      });
    }

    // ── Title ─────────────────────────────────────────────────
    const typeInfo = TRUSS_TYPES.find(t => t.id === type);
    layer.add(new Konva.Text({
      x: 12, y: 12,
      text: `${typeInfo?.label || ''} Truss — ${span.toFixed(1)} m span · ${pitch}° pitch`,
      fontSize: 13, fontStyle: 'bold', fill: '#222',
    }));
    layer.add(new Konva.Text({
      x: 12, y: 28,
      text: `${material.charAt(0).toUpperCase() + material.slice(1)} · ${bays} bays @ ${Math.round(spacing * 1000)} mm c/c`,
      fontSize: 10, fill: '#666',
    }));

    layer.draw();
    return () => { stage.destroy(); stageRef.current = null; };
  }, [type, span, pitch, width, height, margin, material,
      bays, spacing, showLabels, showDimensions, showLegend]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, borderRadius: 8, overflow: 'hidden' }}
    />
  );
}
