import { useState, useCallback, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import MaterialPicker from './ui/MaterialPicker.jsx';
import LightingPanel from './ui/LightingPanel.jsx';
import RenderPanel from './ui/RenderPanel.jsx';
import DemoScene from './rendering/DemoScene.jsx';
import { LightingRig } from './lighting/LightingSystem.jsx';
import {
  PostProcessingStack, CameraRig, RenderModeController,
  useScreenshot, useRenderStore,
} from './rendering/RenderingEngine.jsx';

function ScreenshotBridge({ triggerRef }) {
  const capture = useScreenshot();
  triggerRef.current = capture;
  return null;
}

function StatusBar({ selectedMesh, pendingMaterial }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-7 bg-zinc-950/90 border-t border-zinc-800 flex items-center px-4 gap-4">
      <span className="text-[9px] text-zinc-600 font-mono tracking-wider">ARCH·STUDIO · Material & Rendering Engine · R3F + Three.js</span>
      {pendingMaterial && (
        <span className="text-[9px] text-amber-400 font-mono">
          Loaded: <span className="text-amber-300">{pendingMaterial.id}</span> — click any mesh to apply
        </span>
      )}
      {selectedMesh && (
        <span className="text-[9px] text-emerald-400 font-mono ml-auto">
          Applied → {selectedMesh.elementId} · {selectedMesh.slot}
        </span>
      )}
    </div>
  );
}

const PANELS = [
  { id:'materials', label:'Materials', icon:'⬡' },
  { id:'lighting',  label:'Lighting',  icon:'☀' },
  { id:'render',    label:'Render',    icon:'◉' },
];

export default function App() {
  const [activePanel, setActivePanel] = useState('materials');
  const [pendingMaterial, setPendingMaterial] = useState(null);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const screenshotRef = useRef(null);
  const renderMode = useRenderStore(s => s.renderMode);

  const handleMaterialSelect = useCallback(({ id, spec, overrides }) => {
    setPendingMaterial({ id, spec, overrides });
  }, []);

  const handleMeshClick = useCallback((info) => {
    setSelectedMesh(info);
    setTimeout(() => setSelectedMesh(null), 3000);
  }, []);

  const handleScreenshot = useCallback(() => { screenshotRef.current?.(); }, []);

  return (
    <div className="relative w-screen h-screen bg-zinc-950 overflow-hidden select-none"
      style={{fontFamily:"'DM Mono','Courier New',monospace"}}
      onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('materialId');if(id)setPendingMaterial({id});}}
      onDragOver={e=>e.preventDefault()}>

      {/* 3D Viewport */}
      <div className="absolute inset-0">
        <Canvas
          shadows={{ type: THREE.PCFSoftShadowMap }}
          camera={{ position:[8,5,10], fov:45, near:0.1, far:1000 }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.0 }}>
          <Suspense fallback={null}>
            <LightingRig />
            <CameraRig />
            <RenderModeController />
            <DemoScene pendingMaterial={pendingMaterial} onMeshClick={handleMeshClick} />
            {renderMode==='realistic' && <PostProcessingStack />}
            <ScreenshotBridge triggerRef={screenshotRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-zinc-950/95 border-b border-zinc-800/80 flex items-center px-4 gap-3 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
            <span className="text-zinc-950 text-[10px] font-bold">A</span>
          </div>
          <span className="text-[11px] text-zinc-300 font-semibold tracking-widest uppercase">Arch·Studio</span>
        </div>
        <div className="w-px h-4 bg-zinc-700 mx-1"/>
        <span className="text-[9px] text-zinc-500 tracking-wider">Material & Rendering Engine</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded border font-mono uppercase tracking-wider
            ${renderMode==='realistic'?'text-amber-400 border-amber-500/40 bg-amber-500/10':
              renderMode==='wireframe'?'text-sky-400 border-sky-500/40 bg-sky-500/10':
              'text-zinc-400 border-zinc-600/40 bg-zinc-800/50'}`}>
            {renderMode}
          </span>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="absolute top-10 right-0 bottom-7 w-72 flex flex-col z-10 border-l border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex border-b border-zinc-800">
          {PANELS.map(p=>(
            <button key={p.id} onClick={()=>setActivePanel(p.id)}
              className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-medium flex items-center justify-center gap-1.5 transition-all
                ${activePanel===p.id?'text-amber-400 border-b-2 border-amber-500 bg-zinc-900/60':'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'}`}>
              <span>{p.icon}</span><span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {activePanel==='materials' && (
            <MaterialPicker onSelect={handleMaterialSelect} onDragStart={id=>setPendingMaterial({id})} className="h-full rounded-none border-0"/>
          )}
          {activePanel==='lighting' && <LightingPanel className="h-full rounded-none border-0"/>}
          {activePanel==='render'   && <RenderPanel onScreenshot={handleScreenshot} className="h-full rounded-none border-0"/>}
        </div>
      </div>

      {/* Instructions overlay */}
      <div className="absolute top-14 left-4 z-10 pointer-events-none">
        <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-lg px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 font-semibold">Controls</p>
          <div className="space-y-0.5 text-[9px] text-zinc-500">
            <p>🖱 Drag · Orbit · Scroll zoom</p>
            <p>⬡ Select material → click mesh to apply</p>
            <p>⬡ Drag swatch → drop on viewport</p>
          </div>
        </div>
      </div>

      <StatusBar selectedMesh={selectedMesh} pendingMaterial={pendingMaterial}/>
    </div>
  );
}
