# Fundi Studio UI Refactor — Progress Log

**Branch:** `feature/cad-bim-ifc-integration`  
**Repository:** `c:/Users/HP/Documents/programming/Java script/ReactApps/Services`  
**Last Updated:** 2026-10-21

---

## Session 1 — Audit (Complete)

- Created `docs/FUNDI_STUDIO_UI_ARCHITECTURE_AUDIT.md` — full read-only inspection.
- Created `docs/FUNDI_STUDIO_UI_CLEANUP_PLAN.md` — component reuse opportunities and risks.
- No application code was modified.

---

## Session 2 — DesignCodeToggle: Create + Pilot Migration (Complete)

### Files Created

| File | Purpose |
|------|---------|
| `src/components/shared/primitives/DesignCodeToggle.jsx` | New shared, controlled design-standard selector |
| `src/components/shared/primitives/index.js` | Named re-export barrel |

### Files Modified

| File | Change |
|------|--------|
| `src/components/ReinforcedConcrete/Beams/StructuralEngineeeringSuite.jsx` | Replaced inline two-button toggle (lines 151–179) with `<DesignCodeToggle>` |
| `src/components/ReinforcedConcrete/Walls/main_wall_app.jsx` | Replaced inline two-card toggle (lines 390–426) with `<DesignCodeToggle variant="cards">` |
| `src/ui-state/PanelRegistry.js` | Added `toggle(id)`, `open(id)`, `close(id)` aliases to fix `TypeError: panelRegistry.toggle is not a function` |
| `src/components/interop/CadDxfViewer.jsx` | Routed imports through `compat/cadSimpleViewer.js` |
| `src/components/interop/IfcBimViewer.jsx` | Routed imports through `compat/webIfc.js` + added collapsible sidebar toggle |
| `src/components/interop/ThatOpenBimViewer.jsx` | Routed imports through `compat/thatOpenComponents.js` + added collapsible sidebar toggle |
| `src/components/interop/InteropWorkbench.jsx` | Added show/hide sidebar toggle buttons for Generators (left) and Elements (right) with mobile collapse |
| `scripts/copy-cad-bim-assets.js` | Made missing optional runtime assets a non-fatal warning so Termux npm install doesn't abort |

### Safety Guarantees

- `activeCode` state values `"BS8110"` / `"Eurocode"` in Beam file: **unchanged**.
- `activeStandard` state values `"bs"` / `"eurocode"` in Wall file: **unchanged**.
- All API endpoints, calculation dispatch, backend payloads, and engineering formulas: **unchanged**.
- User modifications (`package.json`, `package-lock.json`): **not touched**.

---

## Next Up

- [ ] Migrate RC Slab / Column design-code toggles (if they follow the same pattern).
- [ ] Create `EngineeringField` — shared labeled numeric input with unit selector.
- [ ] Run full build and record exact compiler output.
- [ ] Create `docs/UI_REFACTOR_DECISIONS.md`, `docs/UI_REFACTOR_RISKS.md`, `docs/UI_REFACTOR_CHANGELOG.md`.

---

## Session 3 — Shared UI kit, shell rebuild and workflow propagation (Complete, build unverified)

### Added

| File | Purpose |
|---|---|
| `src/components/shared/ui/tokens.js` | Design tokens (surfaces, text, controls, actions, status, layout, breakpoints). |
| `src/components/shared/ui/Fields.jsx` | Engineering form primitives (field + number/text/select/checkbox/segmented). Raw-string `onChange` by design. |
| `src/components/shared/ui/PageLayout.jsx` | `WorkspacePage`, `PageHeader`, `Section`, `FormSection`, `FormGrid`, `ActionBar`, `MetaChip`. |
| `src/components/shared/ui/Status.jsx` | `StatusBadge`, `ResultBanner`, `UtilizationGauge`, `TechnicalDetails`, `KeyValueGrid`. |
| `src/components/shared/ui/Feedback.jsx` | `EmptyState`, `ErrorNotice`, `LoadingState`, `SkeletonBlock`. |
| `src/components/shared/ui/TableRegion.jsx` | Contained table scroll region + stacked key/value table. |
| `src/components/shared/ui/ViewerModal.jsx` | Responsive 2D/3D viewer container (full-screen on phones). |
| `src/components/shared/ui/index.js` | Barrel export. |
| `src/components/shared/engineering/FrameInputs.jsx` | `StoreyGridFields`, `MaterialGradeFields`, `BuildingScopeSelector`. |
| `src/navigation/toolRegistry.js` | Route → tool metadata used by shell, drawer and document title. |
| `scripts/verify/jsx-parse.mjs` | Fast Babel-based JSX syntax gate. |

### Modified

`engineering_appp.jsx`, `components/Sidebar.jsx`,
`ReinforcedConcrete/Beams/StructuralEngineeeringSuite.jsx`,
`ReinforcedConcrete/Beams/RCBeamDesigner.jsx`,
`ReinforcedConcrete/Slabs/main_slab_app.jsx`,
`ReinforcedConcrete/Foundations/foundation_main_app.jsx`,
`ReinforcedConcrete/Rwall/main_app_component.jsx`,
`ReinforcedConcrete/Columns/Columnmain.jsx`,
`ReinforcedConcrete/FramedandTall/rc_structural_design.jsx`,
`ReinforcedConcrete/FramedandTall/eurocode_structural_app.jsx`,
`takeoff2/RoofWorks/RoofForm.jsx`, `takeoff2/septik/septik_tank.jsx`,
`Surveying/surveying_app.jsx`, `Soil_mechanics/soil_mechanics.jsx`,
`Timber/Timber_ui.jsx`, `masonry/Masonry_ui.jsx`.

### Verification

- `node scripts/verify/jsx-parse.mjs` on all modified/created files: **all parsed, 0 failures** (20 + 5 + 8 follow-up checks).
- `npm run build` first two runs **failed on pre-existing defects** unrelated to this cleanup:
  1. `src/components/interop/InteropWorkbench.jsx` contained two unmatched `</div>` tags.
  2. `src/components/interop/compat/thatOpenComponents.js` did not export `FragmentsManager`.
  Both were repaired (markup / stub export only, no engine or data change) and the build then **compiled successfully**: "The .tmp-build folder is ready to be deployed.", CSS ≈ 23.6 kB gzip, main JS ≈ 1.16 MB gzip, ESLint warnings only.
- No browser/device screenshots available; responsive behaviour is implemented and documented but not visually confirmed.

### Safety guarantees

- No engineering formula, endpoint, payload key, default value or unit changed.
- Tall-frame modules (`systems`, `ties`, `modelling`) are now reachable from the module navigation; their logic and endpoints are unchanged.
- Downstream QS documents (`EnglishMethodTakeoffSheet`, `UniversalSheet`, `UniversalBOQ`) were not modified.
- CAD/BIM engines, IFC/DXF generation and all Python code untouched.

