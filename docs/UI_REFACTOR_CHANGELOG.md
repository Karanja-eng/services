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

- **`src/components/interop/compat/*`**  
  Safe compatibility shims (`cadSimpleViewer.js`, `webIfc.js`, `thatOpenComponents.js`, `thatOpenComponentsFront.js`) preventing Webpack compile failures in lightweight/mobile/Termux checkouts where heavy optional desktop CAD/BIM engines are omitted.

- **`docs/UI_REFACTOR_PROGRESS.md`** — session progress log.
- **`docs/UI_REFACTOR_DECISIONS.md`** — architecture decision record.
- **`docs/UI_REFACTOR_RISKS.md`** — risk register.
- **`docs/UI_REFACTOR_CHANGELOG.md`** — this file.

### Fixed
- **`src/ui-state/PanelRegistry.js`**:
  Added missing `toggle(id)`, `open(id)`, and `close(id)` method aliases for `togglePanel(id)`, resolving runtime `TypeError: panelRegistry.toggle is not a function` when clicking sidebar panel items in `ComponentsPanel.jsx`.
- **Termux / Mobile Build Errors**:
  Resolved `Can't resolve '@mlightcad/cad-simple-viewer'`, `'web-ifc'`, `'@thatopen/components'`, and `'@thatopen/components-front'` in `CadDxfViewer.jsx`, `IfcBimViewer.jsx`, and `ThatOpenBimViewer.jsx` via safe compatibility layer.
- **`scripts/copy-cad-bim-assets.js`**:
  Changed fatal `process.exit(1)` when optional third-party assets are missing to non-fatal warning so `npm install` does not abort in constrained environments.

### Responsive & Mobile Viewer Enhancements
- **`src/components/interop/InteropWorkbench.jsx`**:
  Added responsive toggle buttons in header and collapse buttons on sidebars for both the Generator panel (left) and the Elements / Reconcile panel (right). On mobile screens (`< 900px`), sidebars default to collapsed to allow full-screen 3D/CAD display.
- **`src/components/interop/IfcBimViewer.jsx`**:
  Added properties sidebar toggle button (`PanelRight`) and close button (`X`) so the 3D viewport can occupy 100% of the mobile screen.
- **`src/components/interop/ThatOpenBimViewer.jsx`**:
  Added details sidebar toggle button (`PanelRight`) and close button (`X`) with mobile-friendly overlay width.

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

---

## [Session 3] — Shared UI kit + responsive shell

### Added
- `src/components/shared/ui/` — `tokens.js`, `Fields.jsx`, `PageLayout.jsx`,
  `Status.jsx`, `Feedback.jsx`, `TableRegion.jsx`, `ViewerModal.jsx`, `index.js`.
- `src/components/shared/engineering/FrameInputs.jsx` — `StoreyGridFields`,
  `MaterialGradeFields`, `BuildingScopeSelector`, `FrameGeometrySection`.
- `src/navigation/toolRegistry.js` — route→tool metadata (title, group, parent,
  design standard) for the header, drawer, document title and mobile back control.
- `scripts/verify/jsx-parse.mjs` — Babel syntax gate for `*.jsx` / `*.tsx`.

### Changed
- **Shell** (`engineering_appp.jsx`): header/footer are now in flow and `<main>`
  owns scrolling; the old `pt-32 sm:pt-24` compensation is gone. Phones get a
  single-row header with the active tool name and a back control; the inline
  assistant input is desktop/tablet only and phones use the chat sheet. Chat
  overlay rebuilt with a pinned header/input, `100dvh`, scrollable transcript and
  safe-area padding. Skip-to-content link added.
- **Sidebar**: active route highlighting via `aria-current`, current-tool card,
  body-scroll lock while open.
- **RC beam**: reference refactor onto the shared kit (fields, sections, header,
  result banner, status badges, `ViewerModal` for the 2D and 3D viewers). The
  placeholder "Export PDF" button was replaced with an honest instruction.
- **Slabs / foundations / retaining**: duplicate inner navigation bars replaced by
  `PageHeader` + `DesignCodeToggle`; dead "settings" selects removed from slabs.
- **Columns**: responsive header, scrollable tab bar, padding scale.
- **Framed & tall**: shared header/code toggle; 288 px sidebar replaced on phones
  and tablets by a native module picker; the previously unreachable tall-building
  modules (`systems`, `ties`, `modelling`) are now in the module navigation under
  "Tall-building systems"; a `BuildingScopeSelector` states the Regular vs Tall
  boundary and jumps to the matching module.
- **Roof takeoff**: shared fields/sections, labelled sliders, placeholder
  Save/Import buttons removed.
- **Septic takeoff**: shared fields/sections, responsive tab strip, no nested
  scroll trap, payload fields without inputs exposed in a disclosure, honest
  error/loading states.
- **Surveying**: responsive header, 44 px scrollable tab bar, padding scale.
- **Soil mechanics**: responsive header, API base env-overridable
  (`REACT_APP_SOIL_API_URL`, default unchanged at `:8000`).
- **Timber**: removed the inline `1fr 450px` grid that overflowed phones; header
  and tab bar made responsive.
- **Masonry**: responsive header and compact unit chip.

### Fixed
- **Pre-existing build blocker:** `src/components/interop/InteropWorkbench.jsx`
  contained two unmatched `</div>` tags (generator panel and canonical-elements
  panel) and could not compile at all on this branch. The stray closing tags were
  removed; the file now parses. No engine, endpoint, layout intent or data flow
  was changed.
- **Pre-existing build blocker:** `src/components/interop/compat/thatOpenComponents.js`
  did not export `FragmentsManager`, which `ThatOpenBimViewer.jsx` resolves via
  the component container, producing a hard bundler import error. A stub export
  was added so the graph compiles. This does not enable the That Open renderer —
  the compat shim still supplies stubs and the viewer's fallback state is
  unchanged.
- `src/components/Drawings/cad_drawing.jsx` and
  `src/components/Drawings/visualise_component.jsx` used `h-screen`, which
  overflowed the new shell; both now use `h-full min-h-0` so the canvas fills the
  workspace scroll region.

### Not Changed
- Every engineering formula, endpoint, request/response schema, default value and
  unit (including the beam `fcu` string option and the septic
  `parseFloat(value) || value` parsing).
- Downstream QS documents (`EnglishMethodTakeoffSheet`, `UniversalSheet`,
  `UniversalBOQ`).
- CAD/BIM engines, the interop workbench's viewers, IFC/DXF generation and all
  backend code.
- Existing routes: no route was added, removed or redirected.

---

## [Session 4] — Finish remaining cleanup

### Added
- `src/state/takeoffBridge.js` — pure merge helpers for the specialised → global
  taking-off hand-off (`publishSourceBatch`, `clearSourceBatch`,
  `countSourceBatch`, `batchFingerprint`).
- `src/state/TakeoffBridgeContext.jsx` — provider/hook mounted by `AppLayout`.
- `src/state/recentTools.js` — validated, capped `localStorage` recent-tools
  history.
- `src/setupTests.js` — lucide ESM mock + React act environment flag.
- Tests: `shared/ui/__tests__/Fields.test.jsx`,
  `shared/ui/__tests__/StatusAndLayout.test.jsx`,
  `shared/engineering/__tests__/FrameInputs.test.jsx`,
  `state/__tests__/takeoffBridge.test.js`, `state/__tests__/recentTools.test.js`
  (5 suites / 47 tests).

### Changed (quantity surveying)
- Basement, swimming pool, underground tank, internal finishes, staircase
  takeoff, doors & windows and electrical & plumbing input forms migrated to the
  shared kit (sections, fields, action bars, states).
- Drainage, external works, substructure and both superstructure tools: page
  shell, tabs and action/error areas migrated; substructure's ~40 fields upgraded
  through a local adapter over the shared fields.
- Roof takeoff: header/tabs rebuilt, placeholder "Save Project" removed.
- External works/electrical: placeholder buttons with no handlers removed.

### Changed (structural)
- Steel design: shared page header, sidebar in-flow only from `lg` with a mobile
  module picker, placeholder "Save Project" removed.
- Stairs: shared page header + `DesignCodeToggle` (state ids unchanged).
- Walls: shared page header; existing cards-style toggle preserved.

### Changed (surveying & soil)
- Soil mechanics: local `InputField` now adapts the shared `NumberField`
  (caller still receives `parseFloat(value) || 0`); form grids collapse to one
  column on phones; `ErrorAlert` uses `ErrorNotice`.
- Surveying: levelling method/benchmark fields use shared components.

### Changed (shell & state)
- `AppLayout` records recent tool visits and provides the takeoff bridge around
  the route table.
- Sidebar renders real "Recent tools" (with clear control) instead of the static
  sample history.
- Roof and septic tools publish generated rows to the global taking-off workflow
  and show a confirmation with a link to the sheet.

### Removed
- Unused `calculateMockResults()` in `slab_calculator_frontend.jsx`.
- `src/components/Drawings/detailing_3d.jsx` (no references anywhere, including
  dynamic imports).


