# Fix: Missing HDR Environment Asset

**Date:** 2026-10-23  
**Issue:** `@react-three/drei` `Environment preset="city"` fetches `potsdamer_platz_1k.hdr` remotely. No HDR assets exist in the project, causing network errors and repeated console errors in all affected 3D viewers.

---

## Root Cause

`Environment` from `@react-three/drei` maps preset names (e.g. `"city"`) to remote `.hdr` URLs via its internal asset map. With no local HDR files and potentially no network access, every render attempt logs a failed fetch.

---

## Affected Files

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/Drawing_Components/roof-structure/src/components/RoofStructureApp.jsx` | 67 | `<Environment preset="city" />` in `SceneSetup()` |
| `src/components/ReinforcedConcrete/Beams/RCBeamDesigner.jsx` | 553, 557 | `<Environment preset="city" />` + `<Stage environment="city">` |
| `src/components/Drawing_Components/Materials/lighting/LightingSystem.jsx` | 87 | `<Environment preset={envPreset} background={false} />` (configurable) |

---

## Changes Made

### 1. `RoofStructureApp.jsx`

- **Removed** `Environment` from the import of `@react-three/drei`.
- **Replaced** `<Environment preset="city" />` in `SceneSetup()` with `<hemisphereLight args={['#c0d8ff', '#1a1a1a', 0.5]} />`.
- The scene already had a strong `ambientLight` (0.45) and two `directionalLight` sources; the hemisphere light adds the sky/ground colour gradient that `city` HDR would have provided.
- Shadows, `Grid`, `OrbitControls`, and all geometry are **unchanged**.

### 2. `RCBeamDesigner.jsx`

- **Removed** `Environment` from the import of `@react-three/drei`.
- **Removed** standalone `<Environment preset="city" />` from the 3D Canvas.
- **Changed** `<Stage intensity={0.5} environment="city">` → `<Stage intensity={0.5}>` (Stage without an `environment` prop uses its own internal ambient/directional rig which doesn't load HDR).
- **Added** `<hemisphereLight args={['#ddeeff', '#222222', 0.6]} />` for sky/ground gradient.
- Existing `ambientLight` + `directionalLight` (already present above the change) are preserved.

### 3. `LightingSystem.jsx`

- **Added** `Suspense` to the import (from React).
- **Added** `HemisphereFallback` component: renders a `<hemisphereLight>` keyed to sky/ground colours approximating the requested preset.
- **Added** `SKY_COLORS` map matching each preset name to appropriate sky/ground hex colours.
- **Added** `EnvironmentPreset` thin wrapper component (needed so Suspense can catch the async HDR load).
- **Wrapped** `<EnvironmentPreset>` in `<Suspense fallback={<HemisphereFallback>}>` inside `LightingRig`.
- **Behaviour:** While HDR loads → hemisphere light renders immediately. If HDR loads successfully → Environment takes over. If HDR never resolves → hemisphere light persists silently. No crash, no repeated errors.
- All existing lighting controls (`LIGHTING_MODES`, `ambientLight`, `directionalLight`, `Sky`, `InteriorLight`, `useLightingStore`, `setLighting`) are **unchanged**.

---

## Verification

Build run with `npm run build` — result recorded below.

> **Build status: ✅ SUCCESS** — `npm run build` exited with code 0. Compiled with warnings only (pre-existing `no-unused-vars` ESLint issues in unrelated files). No errors. Output: `build/static/js/main.976f2279.js` (1.16 MB gzipped).

### What to Check at Runtime

1. Open the Roof Structure 3D view → no `potsdamer_platz_1k.hdr` network error in DevTools.
2. Open the RC Beam 3D reinforcement modal → renders without HDR-related console errors.
3. Switch lighting modes in any scene using `LightingSystem` → no crash; hemisphere fallback visible until HDR loads (or permanently if offline).

---

## Files NOT Changed

- `node_modules/` — untouched.
- Any CAD/BIM geometry, hook, 2D drawing, or analysis component.
- `package.json` / `package-lock.json`.
