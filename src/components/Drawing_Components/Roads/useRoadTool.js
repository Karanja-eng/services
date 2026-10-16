import { useState, useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from './useStore';
import { sampleElevation } from './terrainUtils';

/**
 * useRoadTool — manages click-to-draw road path in the 3D viewport.
 * Returns { isDrawing, currentPath, handleClick, finishRoad }
 */
export function useRoadTool() {
  const [currentPath, setCurrentPath] = useState([]);
  const { selectedTool, addElement, snapshot, toolOptions } = useStore();
  const isDrawing = selectedTool === 'road' || selectedTool === 'path' || selectedTool === 'driveway';

  const handleClick = useCallback((worldPos) => {
    if (!isDrawing) return;
    setCurrentPath(prev => [...prev, [worldPos.x, worldPos.z]]);
  }, [isDrawing]);

  const finishRoad = useCallback(() => {
    if (currentPath.length < 2) { setCurrentPath([]); return; }
    snapshot();
    addElement({
      type: selectedTool,
      path: currentPath,
      width: toolOptions.width || 7,
      material: toolOptions.material || 'asphalt',
      markings: toolOptions.markings || ['centre', 'edge'],
      kerb: toolOptions.kerb || 'upstand',
      verge: 0.5,
    });
    setCurrentPath([]);
  }, [currentPath, selectedTool, toolOptions, addElement, snapshot]);

  const cancelRoad = useCallback(() => setCurrentPath([]), []);

  return { isDrawing, currentPath, handleClick, finishRoad, cancelRoad };
}

/**
 * useTerrainSampler — raycast to terrain mesh to get world-space surface position.
 * Usage inside R3F canvas: const { getTerrainHeight } = useTerrainSampler(terrainMeshRef)
 */
export function useTerrainSampler(terrainMeshRef) {
  const { terrain } = useStore();
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  const getTerrainHeight = useCallback((screenX, screenY) => {
    if (!terrainMeshRef?.current) return 0;

    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(ndc, camera);
    const hits = raycaster.current.intersectObject(terrainMeshRef.current);
    return hits.length ? hits[0].point.y : 0;
  }, [camera, gl, terrainMeshRef]);

  const sampleAtWorld = useCallback((wx, wz) => {
    if (!terrain?.grid) return 0;
    const { grid, cellSize = 1 } = terrain;
    const rows = grid.length, cols = grid[0].length;
    const ox = -((cols - 1) * cellSize) / 2;
    const oz = -((rows - 1) * cellSize) / 2;
    return sampleElevation(grid, cellSize, wx - ox, wz - oz);
  }, [terrain]);

  return { getTerrainHeight, sampleAtWorld };
}

/**
 * useKeyboardShortcuts — global hotkeys for the app.
 */
export function useKeyboardShortcuts() {
  const { undo, redo, clearSelection, setSelectedTool } = useStore();

  const handler = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') clearSelection();
    if (e.ctrlKey && e.key === 'z') undo();
    if (e.ctrlKey && e.key === 'y') redo();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const { selectedIds, removeElement } = useStore.getState();
      selectedIds.forEach(id => removeElement(id));
    }
  }, [undo, redo, clearSelection]);

  return handler;
}

/**
 * useParkingGenerator — compute parking layout from a drawn rectangle.
 */
export function useParkingGenerator() {
  const { addElement, snapshot, toolOptions } = useStore();
  const [rect, setRect] = useState(null);

  const startRect = useCallback((origin) => {
    setRect({ origin, end: origin });
  }, []);

  const updateRect = useCallback((pos) => {
    setRect(r => r ? { ...r, end: pos } : null);
  }, []);

  const finishRect = useCallback(() => {
    if (!rect) return;
    const { origin, end } = rect;
    const ox = Math.min(origin[0], end[0]);
    const oz = Math.min(origin[1], end[1]);
    const width = Math.abs(end[0] - origin[0]);
    const depth = Math.abs(end[1] - origin[1]);

    if (width < 5 || depth < 5) { setRect(null); return; }

    const { bayAngle = 90, bayWidth = 2.5, bayDepth = 5, aisleWidth = 6, material = 'asphalt' } = toolOptions;
    const rows = Math.max(1, Math.floor(depth / (bayDepth + aisleWidth)));
    const baysPerRow = Math.max(1, Math.floor(width / bayWidth));

    snapshot();
    addElement({
      type: 'parking',
      origin: [ox, oz],
      width,
      depth,
      bayAngle,
      bayWidth,
      bayDepth,
      aisleWidth,
      rows,
      baysPerRow,
      totalBays: rows * baysPerRow,
      material,
      markings: ['bay_lines', 'bay_numbers'],
    });
    setRect(null);
  }, [rect, toolOptions, addElement, snapshot]);

  return { rect, startRect, updateRect, finishRect };
}