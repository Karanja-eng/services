// src/components/interop/IfcBimViewer.jsx
//
// Browser-side IFC viewer for the interoperability workbench.
// Parsing is done by web-ifc (WASM) when available, rendering by Three.js.
// Safe fallback layer prevents Webpack compilation crashes in mobile / Termux.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IfcAPI, isAvailable, IFC_WASM_PATH, IFC_WASM_PATH_ABSOLUTE, webIfcStatus } from './compat/webIfc';
import { PanelRight, X } from 'lucide-react';

const WASM_PATH = IFC_WASM_PATH || `${process.env.PUBLIC_URL || ''}/web-ifc/`;
const ENGINE = webIfcStatus();

const CLASS_COLORS = {
  IFCWALL: 0x9aa5b1,
  IFCWALLSTANDARDCASE: 0x9aa5b1,
  IFCSLAB: 0x7d8b99,
  IFCPIPESEGMENT: 0x4a7de0,
  IFCCOVERING: 0xc2b280,
  IFCBUILDINGELEMENTPROXY: 0xb0b7c3,
};
const DEFAULT_COLOR = 0xb0b7c3;
const HIGHLIGHT_COLOR = 0xffb136;

function classOf(api, modelID, expressID) {
  try {
    const line = api.GetLine(modelID, expressID);
    return line?.constructor?.name || line?.type || 'IfcProduct';
  } catch {
    return 'IfcProduct';
  }
}

function globalIdOf(api, modelID, expressID) {
  try {
    const line = api.GetLine(modelID, expressID);
    const value = line?.GlobalId;
    return typeof value === 'string' ? value : value?.value ?? null;
  } catch {
    return null;
  }
}

function propertyOf(api, modelID, expressID, name) {
  try {
    const line = api.GetLine(modelID, expressID);
    const value = line?.[name];
    if (value === undefined || value === null) return null;
    return typeof value === 'object' ? value.value ?? null : value;
  } catch {
    return null;
  }
}

export default function IfcBimViewer({ ifcUrl, selectedGuid, onSelect, onStatus }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [status, setStatus] = useState(
    isAvailable
      ? 'Initializing IFC viewer…'
      : '3D WebGL viewport active. (web-ifc parser is optional/omitted on mobile)'
  );
  const [info, setInfo] = useState(null);
  const [clipping, setClipping] = useState(false);
  const [clipLevel, setClipLevel] = useState(0.5);
  const [selection, setSelection] = useState(null);
  const [elementCount, setElementCount] = useState(0);
  const [showProperties, setShowProperties] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 768 : false
  );

  const publish = useCallback(
    (message, extra = {}) => {
      setStatus(message);
      if (onStatus) onStatus({ message, ...extra });
    },
    [onStatus]
  );

  const applyHighlight = useCallback((guid) => {
    const { meshesByGuid } = stateRef.current;
    if (!meshesByGuid) return;
    meshesByGuid.forEach((meshes, key) => {
      const active = guid && key === guid;
      meshes.forEach((mesh) => {
        mesh.material.emissive.setHex(active ? HIGHLIGHT_COLOR : 0x000000);
        mesh.material.emissiveIntensity = active ? 0.55 : 0;
      });
    });
  }, []);

  // --- three.js scene -------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141414);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 5000);
    camera.position.set(9, 7, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(10, 18, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-12, 6, -10);
    scene.add(fill);

    const grid = new THREE.GridHelper(40, 40, 0x333333, 0x242424);
    scene.add(grid);

    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const root = new THREE.Group();
    // IFC is Z-up, three.js is Y-up.
    root.rotation.x = -Math.PI / 2;
    scene.add(root);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const { meshes } = stateRef.current;
      if (!meshes?.length) return;
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) {
        setSelection(null);
        applyHighlight(null);
        if (onSelect) onSelect(null);
        return;
      }
      const mesh = hits[0].object;
      const picked = mesh.userData;
      setSelection(picked);
      applyHighlight(picked.globalId);
      if (onSelect) onSelect(picked);
    };
    renderer.domElement.addEventListener('click', handleClick);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    stateRef.current = { scene, camera, renderer, controls, root, clipPlane, meshes: [], meshesByGuid: new Map() };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
      if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      stateRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- IFC load -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!ifcUrl) return undefined;

    async function load() {
      try {
        publish(`Fetching ${ifcUrl}…`);
        const response = await fetch(ifcUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${ifcUrl}`);
        const buffer = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;

        if (!isAvailable) {
          publish(
            `web-ifc is unavailable (${ENGINE.reason || 'IfcAPI missing'}). The three.js ` +
              'viewport is running but cannot parse IFC without the WASM parser.'
          );
          return;
        }

        publish('Parsing IFC (web-ifc)…');
        const api = new IfcAPI();
        api.SetWasmPath(WASM_PATH, IFC_WASM_PATH_ABSOLUTE);
        await api.Init();
        const modelID = api.OpenModel(buffer, { COORDINATE_TO_ORIGIN: true });
        const flatMeshes = api.LoadAllGeometry(modelID);

        const { root, meshesByGuid } = stateRef.current;
        if (!root) return;
        while (root.children.length) {
          const child = root.children.pop();
          child.geometry?.dispose?.();
          child.material?.dispose?.();
        }
        meshesByGuid?.clear();

        const meshes = [];
        const materialCache = new Map();

        for (let i = 0; i < flatMeshes.size(); i += 1) {
          const flat = flatMeshes.get(i);
          const expressID = flat.expressID;
          const ifcClass = classOf(api, modelID, expressID);
          const globalId = globalIdOf(api, modelID, expressID);

          const geometry = api.GetGeometry(modelID, flat.geometryExpressID);
          const verts = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
          const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());

          const positions = new Float32Array((verts.length / 6) * 3);
          const normals = new Float32Array((verts.length / 6) * 3);
          for (let v = 0; v < verts.length / 6; v += 1) {
            positions[v * 3] = verts[v * 6];
            positions[v * 3 + 1] = verts[v * 6 + 1];
            positions[v * 3 + 2] = verts[v * 6 + 2];
            normals[v * 3] = verts[v * 6 + 3];
            normals[v * 3 + 1] = verts[v * 6 + 4];
            normals[v * 3 + 2] = verts[v * 6 + 5];
          }

          const bufferGeometry = new THREE.BufferGeometry();
          bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
          bufferGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

          let material = materialCache.get(ifcClass);
          if (!material) {
            material = new THREE.MeshStandardMaterial({
              color: CLASS_COLORS[ifcClass] ?? DEFAULT_COLOR,
              roughness: 0.72,
              metalness: 0.05,
              side: THREE.DoubleSide,
            });
            materialCache.set(ifcClass, material);
          }

          const mesh = new THREE.Mesh(bufferGeometry, material.clone());
          mesh.userData = {
            expressID,
            ifcClass,
            globalId,
            name: propertyOf(api, modelID, expressID, 'Name'),
            predefinedType: propertyOf(api, modelID, expressID, 'PredefinedType'),
            tag: propertyOf(api, modelID, expressID, 'Tag'),
          };

          root.add(mesh);
          meshes.push(mesh);
          if (globalId) {
            const list = meshesByGuid.get(globalId) || [];
            list.push(mesh);
            meshesByGuid.set(globalId, list);
          }
        }

        stateRef.current.meshes = meshes;
        setElementCount(meshes.length);

        // Compute model bounding box and frame it.
        const box = new THREE.Box3().setFromObject(root);
        if (!box.isEmpty()) {
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const { camera, controls } = stateRef.current;
          if (camera && controls) {
            controls.target.copy(sphere.center);
            camera.position.set(
              sphere.center.x + sphere.radius * 1.8,
              sphere.center.y + sphere.radius * 1.4,
              sphere.center.z + sphere.radius * 1.8
            );
            camera.near = Math.max(sphere.radius / 100, 0.05);
            camera.far = sphere.radius * 20;
            camera.updateProjectionMatrix();
            controls.update();
          }
          setInfo({
            radius: Math.round(sphere.radius * 100) / 100,
            classes: [...materialCache.keys()],
          });
        }

        api.CloseModel(modelID);
        publish(`Loaded ${meshes.length} IFC meshes from ${ifcUrl.split('/').pop()}`);
      } catch (error) {
        console.error('[Fundi IFC] load error:', error);
        publish(`IFC load failed: ${error.message}`);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ifcUrl, publish]);

  // --- External selection synchronization -----------------------------------
  useEffect(() => {
    applyHighlight(selectedGuid);
  }, [applyHighlight, selectedGuid]);

  // --- Clipping toggle ------------------------------------------------------
  useEffect(() => {
    const { scene, clipPlane, root } = stateRef.current;
    if (!scene || !clipPlane || !root) return;
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;

    if (clipping) {
      const y = box.min.y + (box.max.y - box.min.y) * clipLevel;
      clipPlane.constant = y;
      const { meshes } = stateRef.current;
      meshes?.forEach((mesh) => {
        mesh.material.clippingPlanes = [clipPlane];
        mesh.material.clipShadows = true;
      });
    } else {
      const { meshes } = stateRef.current;
      meshes?.forEach((mesh) => {
        mesh.material.clippingPlanes = [];
      });
    }
  }, [clipping, clipLevel]);

  return (
    <div className="relative w-full h-full min-h-[300px] flex flex-col bg-[#141414] overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#909399]">Model:</span>
          <span className="text-[11px] text-[#e5eaf3] truncate max-w-[180px]">
            {ifcUrl ? ifcUrl.split('/').pop() : 'none'}
          </span>
          <span className="text-[10px] text-[#909399]">({elementCount} meshes)</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-[#e5eaf3]">
            <input
              type="checkbox"
              checked={clipping}
              onChange={(event) => setClipping(event.target.checked)}
            />
            <span>Clip</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={clipLevel}
            disabled={!clipping}
            onChange={(event) => setClipLevel(Number(event.target.value))}
            className="w-20"
            title="Clip plane height"
          />
          <button
            onClick={() => setShowProperties((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
              showProperties
                ? 'bg-[#409eff]/20 text-[#409eff] border-[#409eff]/50'
                : 'bg-[#262727] text-[#909399] border-[#4c4d4f] hover:text-[#e5eaf3]'
            }`}
            title={showProperties ? 'Hide properties sidebar' : 'Show properties sidebar'}
          >
            <PanelRight className="w-3 h-3" />
            <span className="hidden sm:inline">Properties</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <div ref={mountRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }} />

        {showProperties && (
          <aside className="w-[260px] max-w-[80vw] shrink-0 border-l border-[#4c4d4f] bg-[#1a1b1c] text-[11px] text-[#cdd3dd] overflow-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] text-[#909399] uppercase tracking-wide text-[10px]">
              <span>Element properties</span>
              <button
                onClick={() => setShowProperties(false)}
                className="text-[#909399] hover:text-[#e5eaf3] p-1"
                title="Hide properties"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {selection ? (
              <div className="px-3 py-2 space-y-1">
                <Row label="Ifc class" value={selection.ifcClass} />
                <Row label="GlobalId" value={selection.globalId} mono />
                <Row label="Name" value={selection.name} />
                <Row label="Predefined" value={selection.predefinedType} />
                <Row label="Tag" value={selection.tag} mono />
                <Row label="expressID" value={selection.expressID} mono />
              </div>
            ) : (
              <div className="px-3 py-3 text-[#7d838d]">
                Click a mesh in the 3D view to inspect it.
              </div>
            )}
            <div className="px-3 py-2 border-t border-[#333] text-[#7d838d] text-[10px]">
              Orbit: drag · Pan: right-drag · Zoom: pinch / wheel
            </div>
          </aside>
        )}
      </div>

      <footer className="px-3 py-1 bg-[#1d1e1f] border-t border-[#4c4d4f] text-[10px] text-[#909399] truncate shrink-0">
        {status}
      </footer>
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#7d838d] shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? 'font-mono' : ''}`}>
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </span>
    </div>
  );
}
