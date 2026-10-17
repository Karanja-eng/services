// src/components/interop/IfcBimViewer.jsx
//
// Browser-side IFC viewer for the interoperability workbench.
//
// Parsing is done by web-ifc (WASM) and rendering by three.js, which is already
// a Fundi Studio dependency. This keeps the viewer inside the project's existing
// renderer version (three 0.172) instead of forcing a global three upgrade.
//
// Why not That Open Components here: every published @thatopen/components
// release declares a peer dependency of three >= 0.175 (>= 0.182 from 3.4.x),
// while this repo is pinned to three 0.172 by @react-three/fiber 9.4,
// @react-three/drei 10.7 and @mlightcad/three-renderer 1.7.5 (peer ^0.172.0).
// Installing it would mean upgrading three for the whole application, which the
// integration must not do without validating every existing 3D screen. See
// docs/CAD_BIM_IFC_INTEGRATION.md for the upgrade path.
//
// It is a viewer, not a modeller: it can select, inspect, clip and measure
// nothing but can add clip planes. No geometry editing is claimed.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IfcAPI } from 'web-ifc';

// The WASM binary is served from public/web-ifc. PUBLIC_URL keeps this correct
// when the app is deployed under a sub-path (package.json "homepage").
const WASM_PATH = `${process.env.PUBLIC_URL || ''}/web-ifc/`;

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
  const [status, setStatus] = useState('Initializing IFC viewer…');
  const [info, setInfo] = useState(null);
  const [clipping, setClipping] = useState(false);
  const [clipLevel, setClipLevel] = useState(0.5);
  const [selection, setSelection] = useState(null);
  const [elementCount, setElementCount] = useState(0);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      mount.removeChild(renderer.domElement);
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

        publish('Parsing IFC (web-ifc)…');
        const api = new IfcAPI();
        api.SetWasmPath(WASM_PATH, true);
        await api.Init();
        const modelID = api.OpenModel(buffer, { COORDINATE_TO_ORIGIN: true });
        const flatMeshes = api.LoadAllGeometry(modelID);

        const { root, meshesByGuid } = stateRef.current;
        // Clear any previous model.
        while (root.children.length) {
          const child = root.children.pop();
          child.geometry?.dispose?.();
          child.material?.dispose?.();
        }
        meshesByGuid.clear();

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
            globalId,
            ifcClass,
            name: propertyOf(api, modelID, expressID, 'Name'),
            tag: propertyOf(api, modelID, expressID, 'Tag'),
            predefinedType: propertyOf(api, modelID, expressID, 'PredefinedType'),
          };
          root.add(mesh);
          meshes.push(mesh);
          if (globalId) {
            const list = meshesByGuid.get(globalId) ?? [];
            list.push(mesh);
            meshesByGuid.set(globalId, list);
          }
        }

        stateRef.current.meshes = meshes;
        setElementCount(meshes.length);
        setInfo({ modelID, api, flatMeshCount: flatMeshes.size });

        // Frame the model.
        const box = new THREE.Box3().setFromObject(root);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const radius = Math.max(size.x, size.y, size.z) || 1;
          const { camera, controls } = stateRef.current;
          controls.target.copy(center);
          camera.position.set(center.x + radius * 1.3, center.y + radius * 1.1, center.z + radius * 1.3);
          camera.near = radius / 100;
          camera.far = radius * 100;
          camera.updateProjectionMatrix();
          controls.update();
        }

        publish(`Loaded IFC: ${meshes.length} meshes from ${flatMeshes.size} geometry items`);
      } catch (error) {
        console.error('[Fundi BIM] IFC load failed:', error);
        publish(`IFC load failed: ${error.message}`);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifcUrl]);

  // --- external selection ---------------------------------------------------
  useEffect(() => {
    if (!selectedGuid) {
      applyHighlight(null);
      return;
    }
    applyHighlight(selectedGuid);
    const mesh = stateRef.current.meshesByGuid?.get(selectedGuid)?.[0];
    if (mesh && stateRef.current.controls) {
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      stateRef.current.controls.target.copy(center);
      stateRef.current.controls.update();
    }
  }, [selectedGuid, applyHighlight]);

  // --- clipping -------------------------------------------------------------
  useEffect(() => {
    const { meshes, clipPlane, root } = stateRef.current;
    if (!meshes) return;
    const box = new THREE.Box3().setFromObject(root);
    const minY = box.isEmpty() ? 0 : box.min.y;
    const maxY = box.isEmpty() ? 1 : box.max.y;
    const level = minY + (maxY - minY) * (1 - clipLevel);
    clipPlane.constant = level;
    meshes.forEach((mesh) => {
      mesh.material.clippingPlanes = clipping ? [clipPlane] : [];
      mesh.material.needsUpdate = true;
    });
  }, [clipping, clipLevel, elementCount]);

  return (
    <div className="flex flex-col w-full h-full bg-[#141414] overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#909399]">Model:</span>
          <span className="text-[11px] text-[#e5eaf3] truncate max-w-[220px]">
            {ifcUrl ? ifcUrl.split('/').pop() : 'none'}
          </span>
          <span className="text-[10px] text-[#909399]">({elementCount} meshes)</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-[#e5eaf3]">
            <input
              type="checkbox"
              checked={clipping}
              onChange={(event) => setClipping(event.target.checked)}
            />
            Clip Y
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={clipLevel}
            disabled={!clipping}
            onChange={(event) => setClipLevel(Number(event.target.value))}
            className="w-28"
            title="Clip plane height"
          />
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div ref={mountRef} style={{ flex: 1, minWidth: 0, position: 'relative' }} />

        <aside className="w-[260px] shrink-0 border-l border-[#4c4d4f] bg-[#1a1b1c] text-[11px] text-[#cdd3dd] overflow-auto">
          <div className="px-3 py-2 border-b border-[#333] text-[#909399] uppercase tracking-wide text-[10px]">
            Element properties
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
              Click a mesh to inspect it. Properties come from the IFC file via web-ifc.
            </div>
          )}
          <div className="px-3 py-2 border-t border-[#333] text-[#7d838d]">
            Orbit: drag · Pan: right-drag · Zoom: wheel
          </div>
        </aside>
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
