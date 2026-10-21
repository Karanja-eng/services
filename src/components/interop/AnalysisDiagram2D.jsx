// src/components/interop/AnalysisDiagram2D.jsx
//
// 2D renderer for validated analysis results.
//
// This is the view layer of Task E: it draws **only** what
// `src/analysis/viewModel.mjs` derives from a `fundi.analysis.results/1` document. It
// performs no engineering calculation and keeps no copy of the results, so changing the
// deformation scale, the load case or which diagrams are shown cannot alter a stored
// value.
//
// Honesty rules carried through the UI:
//   * the deformed shape is labelled "exaggerated ×N" whenever the scale is not 1;
//   * a member whose moment diagram is end-forces-only is drawn dashed and the view-model
//     warning is displayed, rather than drawn as if the interior were known;
//   * a 2D analysis is labelled 2D — this renderer is not a 3D result view.
//
// SVG is used deliberately: no canvas, no WebGL, no effect on the existing Konva drawing
// page or the React Three Fiber scene, both of which are untouched.

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Activity, Box, Eye, EyeOff } from 'lucide-react';

import { buildViewModel } from '../../analysis/viewModel.mjs';

const DIAGRAM_STYLES = {
  shear: { label: 'Shear V', colour: '#38bdf8' },
  moment: { label: 'Moment M', colour: '#f472b6' },
  axial: { label: 'Axial N', colour: '#facc15' },
};

function extentOf(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export default function AnalysisDiagram2D({ results, onStatus, height = 420 }) {
  const [caseId, setCaseId] = useState(results?.cases?.[0]?.case_id ?? null);
  const [scale, setScale] = useState(1);
  const [show, setShow] = useState({ deformed: true, shear: true, moment: true, axial: false });

  const cases = results?.cases ?? [];

  const view = useMemo(() => {
    if (!results) return { error: null, model: null };
    try {
      return { error: null, model: buildViewModel(results, { caseId, deformationScale: scale }) };
    } catch (error) {
      return { error: error.message, model: null };
    }
  }, [results, caseId, scale]);

  if (!results) {
    return (
      <div className="flex w-full h-full items-center justify-center text-[12px] text-[#909399]">
        No analysis results. Run an analysis to display a deformed shape, reactions and
        diagrams.
      </div>
    );
  }
  if (view.error) {
    return (
      <div className="p-4 text-[12px] text-rose-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{view.error}</span>
        </div>
      </div>
    );
  }

  const model = view.model;

  // Geometry extents across undeformed and deformed nodes, in metres.
  const allPoints = model.nodes.flatMap((node) => [node.position, node.display]);
  const extent = extentOf(allPoints.map((point) => ({ x: point.x, y: point.y })));
  const spanX = Math.max(extent.maxX - extent.minX, 1e-6);
  const spanY = Math.max(extent.maxY - extent.minY, 1e-6);
  const pad = Math.max(spanX, spanY) * 0.18;
  const viewBox = [
    extent.minX - pad,
    -(extent.maxY + pad), // SVG y-axis points down; analysis y points up
    spanX + 2 * pad,
    spanY + 2 * pad,
  ].join(' ');

  // Diagram ordinates are drawn as a fraction of the model size so they stay legible.
  const diagramAmplitude = spanY * 0.35;
  const shownKeys = Object.keys(DIAGRAM_STYLES).filter((key) => show[key]);
  const globalMax = Math.max(
    ...shownKeys.flatMap((key) => model.diagrams[key].map((entry) => entry.maxAbs)),
    0,
  );
  const ordinate = (value) => (globalMax > 0 ? (value / globalMax) * diagramAmplitude : 0);

  const toggle = (key) => setShow((previous) => ({ ...previous, [key]: !previous[key] }));

  return (
    <div className="flex flex-col w-full h-full bg-[#141414] text-[#e5eaf3] overflow-hidden">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0 text-[11px]">
        <label className="flex items-center gap-1">
          <span className="text-[#909399]">Case</span>
          <select
            value={caseId ?? ''}
            onChange={(event) => {
              setCaseId(event.target.value);
              if (onStatus) onStatus({ message: `Load case ${event.target.value}` });
            }}
            className="px-1.5 py-0.5 bg-[#141414] border border-[#4c4d4f] rounded"
          >
            {cases.map((entry) => (
              <option key={entry.case_id} value={entry.case_id}>
                {entry.case_id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1">
          <span className="text-[#909399]">Deformation ×</span>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            className="w-28 accent-[#409eff]"
          />
          <span className="w-8 text-right tabular-nums">{scale}</span>
        </label>

        {Object.entries(DIAGRAM_STYLES).map(([key, style]) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
              show[key]
                ? 'border-[#409eff] bg-[#1f2b3a]'
                : 'border-[#4c4d4f] bg-[#262727] opacity-70'
            }`}
          >
            <span className="w-2 h-2 rounded-sm" style={{ background: style.colour }} />
            {style.label}
          </button>
        ))}

        <button
          onClick={() => toggle('deformed')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#4c4d4f] bg-[#262727]"
        >
          {show.deformed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {show.deformed ? 'Undeformed + deformed' : 'Undeformed only'}
        </button>

        <span className="ml-auto flex items-center gap-1 text-[10px] text-[#909399]">
          <Box className="w-3 h-3" />
          2D · {model.analysisFormulation}
        </span>
      </div>

      {/* drawing */}
      <div className="flex-1 min-h-0">
        <svg
          viewBox={viewBox}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: '#111213', display: 'block', height: '100%' }}
        >
          {/* undeformed geometry */}
          {model.members.map((member) =>
            member.undeformed ? (
              <polyline
                key={`u-${member.id}`}
                points={member.undeformed.map((point) => `${point.x},${-point.y}`).join(' ')}
                fill="none"
                stroke="#6b7280"
                strokeWidth={Math.max(spanX, spanY) * 0.004}
                strokeDasharray={`${spanX * 0.02} ${spanX * 0.012}`}
              />
            ) : null,
          )}

          {/* deformed geometry, coloured by the selected result */}
          {show.deformed &&
            model.members.map((member) =>
              member.deformed ? (
                <polyline
                  key={`d-${member.id}`}
                  points={member.deformed.map((point) => `${point.x},${-point.y}`).join(' ')}
                  fill="none"
                  stroke={model.colouring.byMember[member.id]?.colour ?? '#22c55e'}
                  strokeWidth={Math.max(spanX, spanY) * 0.008}
                  strokeLinecap="round"
                />
              ) : null,
            )}

          {/* diagrams: offset above the member, ordinates positive upward */}
          {shownKeys.map((key) =>
            model.diagrams[key].map((diagram) => {
              const member = model.members.find((entry) => entry.id === diagram.memberId);
              if (!member?.undeformed) return null;
              const start = member.undeformed[0];
              const end = member.undeformed[1];
              const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
              const nx = -(end.y - start.y) / length;
              const ny = (end.x - start.x) / length;
              const back = { x: -nx * diagramAmplitude * 0.6, y: -ny * diagramAmplitude * 0.6 };
              const points = diagram.points
                .map((point) => {
                  const t = point.x / member.length;
                  const px = start.x + (end.x - start.x) * t;
                  const py = start.y + (end.y - start.y) * t;
                  const offset = ordinate(point.value);
                  return `${px + back.x + nx * offset},${-(py + back.y + ny * offset)}`;
                })
                .join(' ');
              const style = DIAGRAM_STYLES[key];
              return (
                <polyline
                  key={`${key}-${diagram.memberId}`}
                  points={points}
                  fill="none"
                  stroke={style.colour}
                  strokeWidth={Math.max(spanX, spanY) * 0.0035}
                  strokeDasharray={diagram.interpolation === 'none' ? `${spanX * 0.02} ${spanX * 0.012}` : undefined}
                  opacity={0.9}
                />
              );
            }),
          )}

          {/* supports and reactions */}
          {model.nodes.map((node) => {
            const support = (model.supports || []).find((entry) => entry.node === node.tag);
            const reaction = model.reactions.find((entry) => entry.nodeId === node.id);
            if (!support && !reaction) return null;
            const r = Math.max(spanX, spanY) * 0.012;
            return (
              <g key={`s-${node.id}`}>
                <circle cx={node.position.x} cy={-node.position.y} r={r} fill="#e5eaf3" />
                {/* fixed (rz restrained) vs pin/roller marker */}
                <polygon
                  points={[
                    `${node.position.x - r * 1.6},${-node.position.y + r * 2.2}`,
                    `${node.position.x + r * 1.6},${-node.position.y + r * 2.2}`,
                    `${node.position.x},${-node.position.y + r}`,
                  ].join(' ')}
                  fill={support?.rz ? '#e5eaf3' : 'none'}
                  stroke="#e5eaf3"
                  strokeWidth={r * 0.35}
                />
                {reaction && reaction.magnitude > 0 && (
                  (() => {
                    const length = Math.max(spanX, spanY) * 0.09;
                    const tipX = node.position.x + reaction.direction.x * length;
                    const tipY = -(node.position.y + reaction.direction.y * length);
                    return (
                      <g>
                        <line
                          x1={node.position.x}
                          y1={-node.position.y}
                          x2={tipX}
                          y2={tipY}
                          stroke="#f97316"
                          strokeWidth={Math.max(spanX, spanY) * 0.005}
                          markerEnd="url(#arrow)"
                        />
                        <text
                          x={tipX}
                          y={tipY - r}
                          fill="#f97316"
                          fontSize={Math.max(spanX, spanY) * 0.045}
                          textAnchor="middle"
                        >
                          {reaction.magnitude.toFixed(0)} {model.units?.force}
                        </text>
                      </g>
                    );
                  })()
                )}
              </g>
            );
          })}

          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#f97316" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* legend and warnings */}
      <div className="px-3 py-1.5 border-t border-[#4c4d4f] bg-[#1d1e1f] shrink-0 text-[10px]">
        <div className="flex items-center gap-3">
          <span className="text-[#909399]">
            {model.colouring.key} · max {model.colouring.max.toFixed(1)} {model.colouring.unit}
          </span>
          <span className="flex items-center gap-1">
            {model.colouring.legend.stops.map((stop) => (
              <span
                key={stop.value}
                className="w-6 h-2 inline-block"
                style={{ background: stop.colour }}
                title={`${(stop.value * model.colouring.max).toFixed(0)}`}
              />
            ))}
          </span>
          {model.deformation.exaggerated && (
            <span className="text-amber-300">
              <Activity className="w-3 h-3 inline mr-1" />
              deformed shape exaggerated ×{model.deformation.scale} (display only)
            </span>
          )}
          <span className="ml-auto text-[#909399]">{model.deformation.note}</span>
        </div>
        {model.warnings.length > 0 && (
          <div className="mt-1 text-amber-300 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              {model.warnings.length} diagram warning(s): {model.warnings[0]}
              {model.warnings.length > 1 ? ` (+${model.warnings.length - 1} more)` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
