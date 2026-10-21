# Fundi Studio UI Refactor — Changelog

**Branch:** `feature/cad-bim-ifc-integration`

---

## [Unreleased] — 2026-10-21

### Added
- **`src/components/shared/primitives/DesignCodeToggle.jsx`**  
  New shared, controlled design-standard selector. Supports three variants:
  `default` (segmented pill), `compact` (smaller pill), `cards` (rich card grid).
  Keyboard-accessible (arrow navigation), ARIA-labelled, dark/light mode aware.

- **`src/components/shared/primitives/index.js`**  
  Named re-export barrel for the `primitives` directory.

- **`docs/UI_REFACTOR_PROGRESS.md`** — session progress log.
- **`docs/UI_REFACTOR_DECISIONS.md`** — architecture decision record.
- **`docs/UI_REFACTOR_RISKS.md`** — risk register.
- **`docs/UI_REFACTOR_CHANGELOG.md`** — this file.

### Changed
- **`src/components/ReinforcedConcrete/Beams/StructuralEngineeeringSuite.jsx`**  
  Replaced inline two-button segmented toggle with `<DesignCodeToggle>`.  
  *State:* `activeCode` (`"BS8110"` / `"Eurocode"`) — **unchanged**.  
  *Calculation dispatch, API payloads, backend endpoints:* — **unchanged**.

- **`src/components/ReinforcedConcrete/Walls/main_wall_app.jsx`**  
  Replaced inline two-card toggle with `<DesignCodeToggle variant="cards">`.  
  Added `import DesignCodeToggle from "../../shared/primitives/DesignCodeToggle"`.  
  Removed `BookOpen` and `Euro` from the toggle JSX (they are now passed as option `icon` props).  
  *State:* `activeStandard` (`"bs"` / `"eurocode"`) — **unchanged**.  
  *Calculation dispatch, API payloads, backend endpoints:* — **unchanged**.
  *Info banner and calculator routing below the toggle:* — **unchanged**.

### Not Changed
- Engineering calculation formulas (BS 8110, Eurocode 2, BS 5950, etc.)
- Python backend modules or FastAPI routers
- Request payloads or response schemas
- CAD/BIM serialization, IFC mappings, DXF export
- SMM7/CESMM4 measurement logic
- Any other UI components, routes, or engineering modules
- User-modified `package.json` and `package-lock.json`
