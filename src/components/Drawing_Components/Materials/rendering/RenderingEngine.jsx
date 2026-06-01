import { useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  EffectComposer, SSAO, Bloom, FXAA, ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { create } from 'zustand';

export const useRenderStore = create((set) => ({
  renderMode: 'realistic',
  fov: 45,
  resolution: 1,
  postProcessing: true,
  bloomIntensity: 0.15,
  ssaoRadius: 0.05,
  ssaoIntensity: 20,
  setRenderMode: (m) => set({ renderMode: m }),
  setFOV:        (f) => set({ fov: f }),
  setResolution: (r) => set({ resolution: r }),
  togglePostProcessing: () => set(s => ({ postProcessing: !s.postProcessing })),
  setBloom: (i) => set({ bloomIntensity: i }),
}));

export function RenderModeController() {
  const { scene } = useThree();
  const renderMode = useRenderStore(s => s.renderMode);
  useEffect(() => {
    scene.traverse(obj => {
      if (!obj.isMesh) return;
      if (renderMode === 'wireframe') {
        obj.material.wireframe = true;
      } else if (renderMode === 'xray') {
        obj.material.wireframe = false;
        obj.material.transparent = true;
        obj.material.opacity = 0.15;
        obj.material.side = THREE.DoubleSide;
      } else if (renderMode === 'conceptual') {
        obj.material.wireframe = false;
        obj.material.roughness = 1;
        obj.material.metalness = 0;
      } else {
        obj.material.wireframe = false;
      }
    });
  }, [scene, renderMode]);
  return null;
}

export function CameraRig() {
  const fov = useRenderStore(s => s.fov);
  const { camera } = useThree();
  useEffect(() => {
    if (camera.isPerspectiveCamera) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }, [fov, camera]);
  return (
    <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={1} maxDistance={500} />
  );
}

export function PostProcessingStack() {
  const { renderMode, postProcessing, bloomIntensity, ssaoRadius, ssaoIntensity } = useRenderStore();
  if (!postProcessing || renderMode !== 'realistic') return null;
  return (
    <EffectComposer multisampling={4}>
      <SSAO radius={ssaoRadius} intensity={ssaoIntensity} luminanceInfluence={0.6} color="black" blendFunction={BlendFunction.MULTIPLY} />
      <Bloom intensity={bloomIntensity} luminanceThreshold={0.8} luminanceSmoothing={0.025} blendFunction={BlendFunction.ADD} />
      <FXAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export function useScreenshot() {
  const { gl, scene, camera } = useThree();
  const { resolution } = useRenderStore();
  return useCallback((options={}) => {
    const scale = options.resolution ?? resolution;
    const w = gl.domElement.width, h = gl.domElement.height;
    gl.setSize(w*scale, h*scale);
    gl.render(scene, camera);
    const url = gl.domElement.toDataURL('image/png');
    gl.setSize(w, h);
    const a = document.createElement('a');
    a.download = options.filename || `render_${Date.now()}.png`;
    a.href = url; a.click();
    return url;
  }, [gl, scene, camera, resolution]);
}

export function renderScene(options={}) {
  const s = useRenderStore.getState();
  if (options.mode)       s.setRenderMode(options.mode);
  if (options.resolution) s.setResolution(options.resolution);
  if (typeof options.postProcessing==='boolean' && options.postProcessing!==s.postProcessing) s.togglePostProcessing();
  return { success: true };
}
