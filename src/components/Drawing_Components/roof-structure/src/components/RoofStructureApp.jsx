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

import React, { Suspense, useRef, useState } from 'react';
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
import FloatingPalette            from '../../../../FloatingPalette.jsx';

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
export default function RoofStructureApp({ initialSpec = {}, isDark = false }) {
  const roofTheme = {
    '--color-text-primary': 'var(--text-primary)',
    '--color-text-secondary': 'var(--text-secondary)',
    '--color-background-primary': 'var(--bg-secondary)',
    '--color-background-secondary': 'var(--bg-primary)',
    '--color-background-tertiary': 'var(--bg-primary)',
    '--color-border-tertiary': 'var(--border-primary)',
    '--color-border-secondary': 'rgba(255,255,255,0.1)',
  };

  const {
    state, derived,
    set, setElement, setSpan,
    toggleVisibility, generateRoofStructure, applyJSONString,
  } = useRoofStructure(initialSpec);

  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(true);

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
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
      color: 'var(--color-text-primary)',
      background: 'var(--color-background-tertiary)',
      ...roofTheme,
    }}>
      {/* ── Header Ribbon ─────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#161b27',
        borderBottom: '1px solid #2a3144',
        zIndex: 50
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 'bold', color: '#4a9eff', letterSpacing: '0.05em' }}>ROOF STRUCTURE</span>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {VIEW_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => set({ view: id })}
                style={{
                  padding: '4px 12px', border: 'none', cursor: 'pointer', borderRadius: '4px',
                  background: state.view === id ? '#4a9eff' : 'transparent',
                  color: state.view === id ? '#fff' : 'rgba(255,255,255,0.7)',
                  fontSize: 11, fontWeight: 'bold', transition: 'all .12s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ width: '1px', height: '16px', background: '#2a3144' }} />
          <button
            onClick={() => setShowControls(!showControls)}
            style={{
              padding: '4px 12px', border: 'none', cursor: 'pointer', borderRadius: '4px',
              background: showControls ? '#4a6fa5' : 'transparent',
              color: showControls ? '#fff' : '#4a6fa5',
              fontSize: 11, fontWeight: 'bold', transition: 'all .12s',
            }}
          >
            STRUCTURE CONTROLS
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{
              padding: '4px 12px', border: 'none', cursor: 'pointer', borderRadius: '4px',
              background: showInfo ? '#4a6fa5' : 'transparent',
              color: showInfo ? '#fff' : '#4a6fa5',
              fontSize: 11, fontWeight: 'bold', transition: 'all .12s',
            }}
          >
            INFO & EXPORT
          </button>
        </div>
        <div style={{
          background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)',
          padding: '4px 10px', borderRadius: '4px', fontSize: 11, letterSpacing: '0.05em',
        }}>
          {typeLabel.toUpperCase()} · {state.span.toFixed(1)}m · {state.pitch}°
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* ── Left panel ─────────────────────────────── */}
        {showControls && (
          <FloatingPalette title="Structure Controls" onClose={() => setShowControls(false)} width={260}>
            <StructureControlPanel
              state={state}
              derived={derived}
              onSet={set}
              onSetElement={setElement}
              onSetSpan={setSpan}
              onToggleVis={toggleVisibility}
            />
          </FloatingPalette>
        )}

        {/* ── Centre canvas ──────────────────────────── */}
        <div ref={canvasAreaRef} style={{ flex: 1, position: 'relative', background: '#0f1117', overflow: 'hidden' }}>
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
                width={820}
                height={560}
              />
            </div>
          )}
        </div>

        {/* ── Right panel ────────────────────────────── */}
        {showInfo && (
          <FloatingPalette title="Info & Export" onClose={() => setShowInfo(false)} width={310}>
            <StructureInfoPanel
              state={state}
              derived={derived}
              onApplyJSON={applyJSONString}
            />
          </FloatingPalette>
        )}
      </div>
    </div>
  );
}
