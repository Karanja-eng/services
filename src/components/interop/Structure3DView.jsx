// src/components/interop/Structure3DView.jsx
//
// React Three Fiber viewport for the unified workbench.
//
// What it shows (and why it is not a placeholder)
// ----------------------------------------------
// * The accepted canonical engineering model, drawn as member boxes derived by
//   `modelGeometry.js` from the backend's own `dimensions`/`placement` data.
// * When verified solver results are attached: the deformed shape, the moment /
//   shear / axial diagram, support symbols and reactions, all in the canonical
//   Z-up frame through `src/analysis/viewModel3D.mjs`.
// * Selection that is shared with the other views: clicking a member calls
//   `onSelect(id)` with the canonical element id, and a selection made elsewhere
//   highlights the same member here.
//
// What it never does
// ------------------
// * It never invents a result. Without solver output it draws the undeformed
//   structure only and says so.
// * It never presents stale results as current: `analysisState` is rendered as a
//   visible badge, and stale results are drawn dimmed with an explicit label.
// * It does not replace the Framed & Tall builder: that workflow keeps its own R3F
//   scene and is reachable unchanged from the workspace.
//
// The existing R3F stack (@react-three/fiber + drei) is reused; no second renderer
// is introduced.

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
} from 'lucide-react';

import { boxesBounds, boxTransform, buildCanonicalBoxes } from './modelGeometry';
import { buildViewModel3D, unwrapAnalysisResults } from '../../analysis/viewModel3D.mjs';

const CLASS_COLORS = {
  IfcBeam: '#8fa3ad',
  IfcColumn: '#9db4c0',
  IfcSlab: '#7e8b96',
  IfcWall: '#a9b3ba',
  IfcFooting: '#8c8478',
  IfcStair: '#a3a08f',
  IfcStairFlight: '#a3a08f',
};
const DEFAULT_COLOR = '#8b949e';
const SELECTED_COLOR = '#409eff';

/** Metric label for a value in the solver's units. */
function formatForce(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'N*m' || unit === 'N·m') {
    return `${(value / 1000).toFixed(1)} kN·m`;
  }
  if (unit === 'N') return `${(value / 1000).toFixed(1)} kN`;
  return `${value.toFixed(1)} ${unit || ''}`.trim();
}

/* ------------------------------------------------------------------ camera rig */

function CameraRig({ bounds, resetKey }) {
  const { camera, controls } = useThree();
  const initialised = useRef(false);

  useEffect(() => {
    // The canonical frame is Z-up. three.js defaults to Y-up, so the camera's up
    // vector has to be set explicitly or every elevation is rolled 90°.
    camera.up.set(0, 0, 1);
    const [cx, cy, cz] = bounds.center;
    const distance = Math.max(bounds.radius * 2.6, 4);
    camera.position.set(cx + distance * 0.7, cy - distance * 0.9, cz + distance * 0.75);
    camera.lookAt(new THREE.Vector3(cx, cy, cz));
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target?.set?.(cx, cy, cz);
      controls.update?.();
    }
    initialised.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, camera, controls]);

  return null;
}

/* ------------------------------------------------------------- model geometry */

function MemberBox({ box, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const transform = boxTransform(box);
  const color = selected ? SELECTED_COLOR : hovered ? '#c8d2da' : CLASS_COLORS[box.ifcClass] || DEFAULT_COLOR;

  return (
    <group>
      <mesh
        position={transform.position}
        rotation={transform.rotation}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(box.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={transform.args} />
        <meshStandardMaterial
          color={color}
          roughness={0.62}
          metalness={0.05}
          transparent
          opacity={0.92}
        />
      </mesh>
      <lineSegments position={transform.position} rotation={transform.rotation}>
        <edgesGeometry args={[new THREE.BoxGeometry(...transform.args)]} />
        <lineBasicMaterial color={selected ? '#ffffff' : '#2b3138'} />
      </lineSegments>
    </group>
  );
}

/* --------------------------------------------------------------- analysis draw */

function AnalysisOverlay({ viewModel, showUndeformed, showDeformed, showDiagram, stale }) {
  if (!viewModel) return null;
  const opacity = stale ? 0.45 : 1;

  return (
    <group>
      {showUndeformed &&
        viewModel.undeformed.map((member) => (
          <Line
            key={`und-${member.memberId}`}
            points={member.points.map((point) => [point.x, point.y, point.z])}
            color="#6b7785"
            lineWidth={1}
            dashed
            dashSize={0.15}
            gapSize={0.1}
            transparent
            opacity={0.9 * opacity}
          />
        ))}

      {showDeformed &&
        viewModel.deformed.map((member) => (
          <Line
            key={`def-${member.memberId}`}
            points={member.points.map((point) => [point.x, point.y, point.z])}
            color="#ffb136"
            lineWidth={2.5}
            transparent
            opacity={opacity}
          />
        ))}

      {showDiagram &&
        (viewModel.diagrams[viewModel.activeDiagram] || []).map((entry) =>
          entry.geometry ? (
            <group key={`dia-${entry.memberId}`}>
              <Line
                points={entry.geometry.map((point) => [point.x, point.y, point.z])}
                color="#4ade80"
                lineWidth={2}
                transparent
                opacity={opacity}
              />
              <Line
                points={entry.polygon.map((point) => [point.x, point.y, point.z])}
                color="#22c55e"
                lineWidth={1}
                transparent
                opacity={0.35 * opacity}
              />
            </group>
          ) : null
        )}

      {showDiagram &&
        viewModel.reactions.map((reaction) => (
          <Line
            key={`rea-${reaction.nodeId}`}
            points={[
              [reaction.origin.x, reaction.origin.y, reaction.origin.z],
              [reaction.tip.x, reaction.tip.y, reaction.tip.z],
            ]}
            color="#f472b6"
            lineWidth={2}
            transparent
            opacity={opacity}
          />
        ))}
    </group>
  );
}

/* ---------------------------------------------------------------------- view */

export default function Structure3DView({
  model,
  analysis,
  analysisState = 'none',
  selectedId = null,
  onSelect,
  onStatus,
}) {
  const [showUndeformed, setShowUndeformed] = useState(true);
  const [showDeformed, setShowDeformed] = useState(true);
  const [showDiagram, setShowDiagram] = useState(true);
  const [diagram, setDiagram] = useState('moment');
  const [deformationScale, setDeformationScale] = useState(50);
  const [resetKey, setResetKey] = useState(0);
  const [showPanel, setShowPanel] = useState(true);

  const geometry = useMemo(() => buildCanonicalBoxes(model), [model]);
  const bounds = useMemo(() => boxesBounds(geometry.boxes), [geometry.boxes]);

  const stale = analysisState === 'stale';

  // Only real solver output is displayed. The adapter throws on anything else, and
  // the error is surfaced rather than swallowed.
  const viewModel = useMemo(() => {
    if (!analysis) return null;
    try {
      const results = unwrapAnalysisResults(analysis);
      return buildViewModel3D(results, {
        caseId: analysis.caseId,
        deformationScale: Number(deformationScale) || 1,
        diagram,
      });
    } catch (error) {
      if (onStatus) onStatus({ message: `Analysis display refused: ${error.message}` });
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, deformationScale, diagram]);

  useEffect(() => {
    if (onStatus && viewModel) {
      onStatus({
        message:
          `Showing ${viewModel.activeDiagram} for case ${viewModel.caseId}` +
          ` (${viewModel.dimensionality}D, ${viewModel.diagramUnits?.[viewModel.activeDiagram] || 'unit?'})` +
          `${stale ? ' (STALE — the model changed after this analysis)' : ''}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModel, stale]);

  // Diagram choices come from the result itself, so a 2D document never offers the
  // 3D-only components (moments about both local axes, torsion) and vice versa.
  const diagramOptions = useMemo(() => {
    const units = viewModel?.diagramUnits || { moment: 'N*m', shear: 'N', axial: 'N' };
    const labels = {
      moment: 'bending moment',
      momentY: 'bending moment (local y)',
      shear: 'shear force',
      shearZ: 'shear force (local z)',
      axial: 'axial force',
      torsion: 'torsion',
    };
    return Object.keys(units).map((key) => ({
      key,
      label: `${labels[key] || key} [${units[key]}]`,
    }));
  }, [viewModel]);

  // Keep the selection valid when the result dimensionality changes.
  useEffect(() => {
    if (!viewModel) return;
    if (!viewModel.diagramUnits?.[diagram]) {
      setDiagram(Object.keys(viewModel.diagramUnits || { moment: 'N*m' })[0] || 'moment');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModel]);

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center bg-[#141414] p-6 text-center text-[12px] text-[#909399]">
        Generate a model to populate the 3D view.
      </div>
    );
  }

  const diagramUnit = viewModel?.diagramUnits?.[diagram] || (diagram === 'moment' ? 'N*m' : 'N');
  const diagramMax = viewModel?.diagramScale?.maxAbs ?? null;

  return (
    <div className="relative h-full min-h-0 w-full bg-[#141414]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center gap-2 text-[12px] text-[#909399]">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Building the scene…
          </div>
        }
      >
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.05, far: 5000, position: [10, -12, 10], up: [0, 0, 1] }}
          onPointerMissed={() => onSelect?.(null)}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#141414']} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[12, -14, 18]} intensity={1.5} />
          <directionalLight position={[-10, 12, 6]} intensity={0.5} />
          <gridHelper
            args={[Math.max(bounds.radius * 8, 20), 20, '#2b3138', '#1d2024']}
            position={[bounds.center[0], bounds.center[1], 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <CameraRig bounds={bounds} resetKey={resetKey} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={bounds.center} />
          {geometry.boxes.map((box) => (
            <MemberBox
              key={box.id}
              box={box}
              selected={selectedId === box.id}
              onSelect={onSelect}
            />
          ))}
          <AnalysisOverlay
            viewModel={viewModel}
            showUndeformed={showUndeformed}
            showDeformed={showDeformed && Boolean(viewModel)}
            showDiagram={showDiagram && Boolean(viewModel)}
            stale={stale}
          />
        </Canvas>
      </Suspense>

      {/* ---------------- controls (top-left, collapsible) ---------------- */}
      <div className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-lg border border-[#4c4d4f] bg-[#1a1b1c]/95 text-[11px] text-[#e5eaf3] shadow-lg">
        <button
          type="button"
          onClick={() => setShowPanel((value) => !value)}
          className="flex w-full items-center justify-between gap-2 px-2 py-1.5"
          aria-expanded={showPanel}
        >
          <span className="flex items-center gap-1.5">
            <Boxes size={13} className="text-[#409eff]" aria-hidden="true" /> Structure 3D
          </span>
          {showPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showPanel && (
          <div className="space-y-2 border-t border-[#4c4d4f] px-2 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-wide text-[#909399]">Members</span>
              <span>{geometry.boxes.length}</span>
            </div>

            <label className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                {showUndeformed ? <Eye size={12} /> : <EyeOff size={12} />} undeformed
              </span>
              <input
                type="checkbox"
                checked={showUndeformed}
                onChange={(event) => setShowUndeformed(event.target.checked)}
                className="accent-[#409eff]"
              />
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                {showDeformed ? <Eye size={12} /> : <EyeOff size={12} />} deformed
              </span>
              <input
                type="checkbox"
                checked={showDeformed}
                onChange={(event) => setShowDeformed(event.target.checked)}
                disabled={!viewModel}
                className="accent-[#409eff]"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-[#909399]">
                deformation scale ×
              </span>
              <input
                type="number"
                min="1"
                step="10"
                value={deformationScale}
                onChange={(event) => setDeformationScale(event.target.value)}
                disabled={!viewModel}
                className="mt-0.5 w-full rounded border border-[#4c4d4f] bg-[#141414] px-1.5 py-1 text-[11px] text-[#e5eaf3] disabled:opacity-40"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-[#909399]">diagram</span>
              <select
                value={diagram}
                onChange={(event) => setDiagram(event.target.value)}
                disabled={!viewModel}
                className="mt-0.5 w-full rounded border border-[#4c4d4f] bg-[#141414] px-1.5 py-1 text-[11px] text-[#e5eaf3] disabled:opacity-40"
              >
                {diagramOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span>diagram visible</span>
              <input
                type="checkbox"
                checked={showDiagram}
                onChange={(event) => setShowDiagram(event.target.checked)}
                disabled={!viewModel}
                className="accent-[#409eff]"
              />
            </label>

            <button
              type="button"
              onClick={() => setResetKey((value) => value + 1)}
              className="flex w-full items-center justify-center gap-1 rounded border border-[#4c4d4f] bg-[#262727] px-2 py-1 text-[11px] hover:bg-[#303030]"
            >
              <RotateCcw size={12} aria-hidden="true" /> Reset view
            </button>
          </div>
        )}
      </div>

      {/* ---------------- legend (bottom-left) ---------------- */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] rounded-lg border border-[#4c4d4f] bg-[#1a1b1c]/95 px-2.5 py-2 text-[10px] leading-relaxed text-[#c8c9cc]">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#e5eaf3]">Results</span>
          {viewModel ? (
            <span
              className={
                stale
                  ? 'rounded bg-amber-900/50 px-1 text-amber-200'
                  : 'rounded bg-emerald-900/40 px-1 text-emerald-200'
              }
            >
              {stale ? 'STALE' : 'CURRENT'} · rev {viewModel.caseId}
            </span>
          ) : (
            <span className="rounded bg-neutral-800 px-1 text-[#909399]">no solver results</span>
          )}
        </div>

        {viewModel ? (
          <>
            <div>
              case <span className="font-mono">{viewModel.caseId}</span> ·{' '}
              {viewModel.diagramUnits?.[viewModel.activeDiagram] || diagramUnit} · deformation ×
              {viewModel.deformation.scale}
              {viewModel.deformation.exaggerated ? ' (exaggerated)' : ''}
            </div>
            <div className="text-[#909399]">
              diagram scale: {viewModel.diagramScale.displayOnly ? 'display only' : 'actual'} · max{' '}
              {formatForce(diagramMax, diagramUnit)}
            </div>
            <div className="text-[#909399]">
              {viewModel.warnings.length
                ? `${viewModel.warnings.length} diagram warning(s) — end values only`
                : 'diagram from sampled solver values where available'}
            </div>
            {viewModel.reactions.length > 0 && (
              <div className="mt-1">
                reactions:{' '}
                {viewModel.reactions
                  .map((reaction) => `${reaction.nodeId.replace(/^.*#/, '')} ${reaction.label}`)
                  .join(' · ')}
              </div>
            )}
          </>
        ) : (
          <div className="text-[#909399]">
            Geometry only. Run the analysis to show deformed shape and force diagrams.
          </div>
        )}
      </div>

      {/* ---------------- model warnings (bottom-right) ---------------- */}
      {geometry.warnings.length > 0 && (
        <div className="absolute bottom-2 right-2 z-10 max-w-[45%] rounded border border-amber-800 bg-amber-950/80 px-2 py-1 text-[10px] text-amber-200">
          <div className="flex items-start gap-1">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{geometry.warnings[0]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
