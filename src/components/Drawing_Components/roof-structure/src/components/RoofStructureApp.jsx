// ─────────────────────────────────────────────────────────────
//  RoofStructureApp.jsx
//  Top-level assembly component.
//  Wires: useRoofStructure hook → StructureControlPanel
//                              → R3F Canvas (RoofTruss3D / RoofFraming3D / PortalFrame3D)
//                              → Truss2D / Framing2D  (Konva)
//                              → StructureInfoPanel
//
//  Install deps:
//    npm install three @react-three/fiber @react-three/drei konva react-konva
//
//  Usage (standalone page):
//    import RoofStructureApp from './components/RoofStructureApp';
//    <RoofStructureApp />
//
//  Usage (embedded, specific truss):
//    <RoofStructureApp
//      initialSpec={{ elementType:'truss', subType:'fan', span:14, pitch:22, bays:8, material:'steel' }}
//    />
// ─────────────────────────────────────────────────────────────

import React, { Suspense, useRef } from 'react';
import { Canvas }          from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';

import { useRoofStructure }       from '../hooks/useRoofStructure.js';
import RoofTruss3D                from './3d/RoofTruss3D.jsx';
import RoofFraming3D              from './3d/RoofFraming3D.jsx';
import PortalFrame3D              from './3d/PortalFrame3D.jsx';
import Truss2D                    from './2d/Truss2D.jsx';
import Framing2D                  from './2d/Framing2D.jsx';
import StructureControlPanel      from './ui/StructureControlPanel.jsx';
import StructureInfoPanel         from './ui/StructureInfoPanel.jsx';

// ── Scene helper: floor + ambient environment ─────────────────
function SceneSetup() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#c0d8ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={0x161922} roughness={0.95} />
      </mesh>
      <Grid
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.3}
        sectionSize={5}
        sectionThickness={0.6}
        sectionColor="#2a3040"
        cellColor="#1e2330"
        fadeDistance={30}
        position={[0, 0.002, 0]}
      />
      <Environment preset="city" />
    </>
  );
}

// ── 3D structural content switcher ───────────────────────────
function StructuralContent({ state }) {
  const { element, subType, span, pitch, spacing, bays, material,
          eaveHeight, haunchLen, baseType,
          footprint, rafterSpacing, visibility } = state;

  const yOffset = [0, 3, 0]; // lift structure above floor

  if (element === 'truss') {
    return (
      <RoofTruss3D
        type={subType}
        span={span}
        pitch={pitch}
        spacing={spacing}
        bays={bays}
        material={material}
        showChords={visibility.chords}
        showWebs={visibility.webs}
        showPurlins={visibility.purlins}
        showCollar={visibility.collar}
        showBracing={visibility.bracing}
        showGussets={visibility.gussets}
        position={yOffset}
      />
    );
  }

  if (element === 'rafters') {
    return (
      <RoofFraming3D
        pitch={pitch}
        footprint={footprint}
        rafterSpacing={rafterSpacing}
        material={material}
        type={subType}
        showRafters={visibility.rafters}
        showPurlins={visibility.purlins}
        showCollar={visibility.collar}
        showRidge={visibility.chords}
        showHip={subType === 'hip'}
        showBracing={visibility.bracing}
        position={yOffset}
      />
    );
  }

  if (element === 'portal') {
    return (
      <PortalFrame3D
        span={span}
        pitch={pitch}
        eaveHeight={eaveHeight}
        spacing={spacing}
        bays={bays}
        baseType={baseType || subType}
        haunchLen={haunchLen}
        showPurlins={visibility.purlins}
        showBracing={visibility.bracing}
        position={[0, 0, 0]}
      />
    );
  }

  return null;
}

// ── 2D view switcher ─────────────────────────────────────────
function TwoDView({ state, width, height }) {
  if (state.element === 'truss' || state.view === 'elev') {
    return (
      <Truss2D
        type={state.subType}
        span={state.span}
        pitch={state.pitch}
        width={width}
        height={height}
        material={state.material}
        bays={state.bays}
        spacing={state.spacing}
        showLabels
        showDimensions
        showLegend
      />
    );
  }

  return (
    <Framing2D
      footprint={state.footprint}
      pitch={state.pitch}
      rafterSpacing={state.rafterSpacing}
      trussBays={state.bays}
      trussSpacing={state.spacing}
      roofType={state.subType === 'hip' ? 'hip' : 'gable'}
      material={state.material}
      width={width}
      height={height}
      showRafters={state.visibility.rafters}
      showTrusses={state.visibility.chords}
      showPurlins={state.visibility.purlins}
      showDimensions
      showSectionMarks
    />
  );
}

// ── Root app ─────────────────────────────────────────────────
export default function RoofStructureApp({ initialSpec = {} }) {
  const {
    state, derived,
    set, setElement, setSpan,
    toggleVisibility, generateRoofStructure, applyJSONString,
  } = useRoofStructure(initialSpec);

  const canvasAreaRef = useRef(null);

  const VIEW_TABS = [
    { id: '3d',   label: '3D Frame' },
    { id: 'elev', label: 'Elevation' },
    { id: 'plan', label: 'Plan' },
  ];

  const typeLabel =
    state.element === 'truss'   ? state.subType.charAt(0).toUpperCase() + state.subType.slice(1) + ' Truss' :
    state.element === 'portal'  ? (state.subType === 'fixed' ? 'Fixed' : 'Pinned') + ' Portal' :
    state.subType.charAt(0).toUpperCase() + state.subType.slice(1) + ' Rafters';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '210px 1fr 290px',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
      color: 'var(--color-text-primary)',
      background: 'var(--color-background-tertiary)',
    }}>
      {/* ── Left panel ─────────────────────────────── */}
      <StructureControlPanel
        state={state}
        derived={derived}
        onSet={set}
        onSetElement={setElement}
        onSetSpan={setSpan}
        onToggleVis={toggleVisibility}
      />

      {/* ── Centre canvas ──────────────────────────── */}
      <div ref={canvasAreaRef} style={{ position: 'relative', background: '#0f1117', overflow: 'hidden' }}>
        {/* View tabs */}
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 3,
          background: 'rgba(0,0,0,0.55)', borderRadius: 7, padding: 3, zIndex: 10,
        }}>
          {VIEW_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => set({ view: id })}
              style={{
                padding: '3px 12px', border: 'none', cursor: 'pointer', borderRadius: 5,
                background: state.view === id ? 'rgba(255,255,255,0.15)' : 'none',
                color: state.view === id ? '#fff' : 'rgba(255,255,255,0.55)',
                fontSize: 11, fontWeight: 500, transition: 'all .12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Info badge */}
        <div style={{
          position: 'absolute', top: 9, right: 9, zIndex: 10,
          background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)',
          padding: '3px 9px', borderRadius: 5, fontSize: 10, letterSpacing: '0.05em',
        }}>
          {typeLabel.toUpperCase()} · {state.span.toFixed(1)}m · {state.pitch}°
        </div>

        {/* 3D R3F canvas */}
        {state.view === '3d' && (
          <Canvas
            shadows
            camera={{ position: [8, 6, 14], fov: 45, near: 0.05, far: 200 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <SceneSetup />
              <StructuralContent state={state} />
              <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.05}
                minDistance={5}
                maxDistance={45}
                maxPolarAngle={Math.PI / 2.05}
              />
            </Suspense>
          </Canvas>
        )}

        {/* 2D Konva view */}
        {(state.view === 'elev' || state.view === 'plan') && (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0efe8' }}>
            <TwoDView
              state={state}
              width={Math.min(window.innerWidth - 210 - 290 - 20, 820)}
              height={Math.min(window.innerHeight - 40, 560)}
            />
          </div>
        )}
      </div>

      {/* ── Right panel ────────────────────────────── */}
      <StructureInfoPanel
        state={state}
        derived={derived}
        onApplyJSON={applyJSONString}
      />
    </div>
  );
}
