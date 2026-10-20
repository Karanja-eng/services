# Agent-first Fundi Studio home — execution journal

- **Date:** 2026-10-18
- **Branch:** feature/cad-bim-ifc-integration
- **Baseline commit:** 497ea33
- **Scope:** `ChatPage` home redesign + minimal shell/chat-safety fixes. No changes to
  calculation engines, formulas, module editing logic, route tree shape, or the
  `FloatingPalette` used by drawing modules.

## 1. Inspection findings

### Repository / build
- Create React App (`react-scripts` 5.0.1), React 19, React Router 7, Tailwind 3.4
  with `darkMode: "class"`. No TypeScript.
- Scripts: `start`, `build` (`react-scripts build`), `test` (`react-scripts test`).
  No `*.test.*` / `*.spec.*` files exist in `src`; no `setupTests` file.
- Working tree before edits: no tracked file modifications; only untracked `build/`
  output. No stashes. `build/` is intentionally allowed by `.gitignore`.
- `.gitignore` ignores everything (`*`) with allow-list exceptions; `chats/` was not
  allowed before this task, so an exception was added for the journal only.

### Shell (`src/components/engineering_appp.jsx`)
- `AppLayout` (inside `engineering_appp.jsx`) owns: left/right drawer state, chat input,
  messages, loading state, `chatOpen` overlay, attachment handling, shared takeoff data,
  the top bar, the route table, and both sidebars. `EngineeringApp` owns `isDark` /
  `toggleTheme` and wraps everything in `BrowserRouter`.
- Home route (`/`) renders `ChatPage` and passes `renderSearch` so the home page can place
  the same chat input component. Every other route gets the input in the top bar.
- Top bar is `absolute` over the layout, becomes opaque on non-home routes, and is
  single-row on all sizes (mobile squeeze at narrow widths).
- Chat has no error handling beyond a `catch` that injects a hard-coded **mock AI
  analysis** and a fake "AI Generated Preview" block for messages containing
  "structural". Both are misleading and were flagged for replacement/removal.
- `isAiLive` was hard-coded `false` (the status polling effect is commented out), so the
  overlay always displayed "AI Offline" regardless of the real service state.
- Sidebars: `Sidebar` is a translated drawer with mock history only; `RightSidebar` is the
  settings drawer with the dark-mode toggle and a backdrop. Both remain separate.
- Route table contains 51 non-home destinations (structural, quantity, surveying, drawing,
  visualisation and the additive `/interop/cad-bim` workbench).

### Theme
- `EngineeringApp` holds `isDark` state, applies the `dark` class to the layout root, and
  `RightSidebar` calls `toggleTheme`. `src/index.css` defines CSS variables for both
  themes; Tailwind `dark:` classes are used throughout. The theme is **not** persisted to
  `localStorage` or `document.documentElement` (pre-existing behaviour, unchanged).
- `ChatPage` uses `isDark` only to pick its background overlay gradient.

### FloatingPalette
- `src/components/FloatingPalette.jsx` is a draggable `react-draggable` panel whose position
  is persisted per title in `localStorage`. It is a real in-canvas tool/properties panel,
  imported by Columns & Beams, Dimensions, Materials, Roads, Roof Structure, Slabs,
  Electrical and Plumbing. The old three-panel home used no palette at all.
  **Left untouched** (usage understood; not part of home navigation).
- `src/components/shared/ui/FloatingPalette.jsx` is a separate dockable palette
  implementation used by other (non-home) tooling; also untouched.

### Home (`src/components/components/ChatPage.jsx`)
- Hero + chat input + three oversized panel cards (Structural, Surveying, CAD) whose
  bodies are `max-h-[50vh]` nested accordions. Missing home entries for
  `/quantity/manual/documents` and `/interop/cad-bim`. Also contained a duplicate,
  mislabelled "Precast / PreStressed" group pointing at steel design routes.
- No projects section, no quick actions, no tool-directory affordance, no responsive
  refinement below `lg`.

## 2. Plan

1. Add the `chats/` allow-list exception and keep this journal updated.
2. Rewrite `ChatPage` as an agent-first engineering home:
   - Keep the existing `renderSearch` input as the primary, most prominent element.
   - Add four real quick actions: structural design, drawing measurement, BOQ creation,
     CAD/3D inspection — each navigates to an existing route.
   - Replace the three oversized accordion panels with three compact category cards.
   - Add an accessible "All tools" dialog (search, category filter, keyboard/Esc support,
     focus trap and focus return) that lists **all 51** non-home routes, including
     `/quantity/manual/documents` and `/interop/cad-bim`.
   - Keep a data-driven projects area; the source array is empty and shows an honest empty
     state (no invented projects / persistence).
   - Keep the `isDark`-driven background/theme styling and add responsive layouts.
3. Minimal shell fixes in `engineering_appp.jsx`:
   - Replace the mock AI fallback with an explicit service-error message; remove the fake
     "AI Generated Preview"; derive the AI status badge from real request outcomes.
   - Wrap/stack the top bar on mobile without duplicating the page UI; add Escape handling
     and ARIA labels for drawer/chat controls.
   - Keep all routes, state, and `renderSearch` behaviour intact.
4. `Sidebar`: keep navigation/history responsibility, add a small real navigation block,
   label the history entries as samples, add a backdrop and dialog semantics.
   `RightSidebar`: keep settings responsibility; add switch semantics/ARIA only.
5. Verify: production build, available tests (none present), route/data consistency check,
   headless-browser render/screenshot checks for `/` plus the six required routes, theme
   toggle and drawers, mobile viewport, console errors.

## 3. Files changed

| File | Change |
| --- | --- |
| `chats/2026-10-18-agent-first-home.md` | This execution journal. |
| `.gitignore` | Allow-list `chats/` and `chats/*.md` so journals can be committed. |
| `src/components/components/ChatPage.jsx` | Reworked home: agent input first, four quick actions, three compact category cards, accessible all-tools dialog, data-driven empty projects state, responsive layout, theme-aware background. |
| `src/components/engineering_appp.jsx` | Replaced mock AI fallback + fake "AI Generated Preview" with explicit service errors; real AI status badge; wrapped mobile top bar; Escape handling; ARIA labels; mobile main padding. Route table untouched. |
| `src/components/components/Sidebar.jsx` | Navigation block (real routes) + sample-labelled history, backdrop, dialog semantics, inert when closed. |
| `src/components/components/RightSidebar.jsx` | Dialog/switch ARIA only; settings responsibility unchanged. |

Deliberately **not** changed: `src/components/FloatingPalette.jsx`,
`src/components/shared/ui/FloatingPalette.jsx`, `floatingPalette.css`, the route
table semantics, theme state ownership, any calculation or module component,
`package.json`, dependencies.

### Route parity
The new home lists every non-home route from `engineering_appp.jsx`:

- route table entries: **51** (unique 51)
- home data paths: **55** entries (51 tool routes + 4 quick actions reusing 4 of
  those routes), unique **51**
- missing from home: **none**
- home paths with no matching route: **none**

The old home omitted `/quantity/manual/documents` and `/interop/cad-bim`; both are
now in the directory. The old duplicate "Precast / PreStressed" group (which only
pointed at steel routes) was replaced by the real "Timber, masonry & ground" group;
no route was lost.

## 4. Tests and verification

Environment: Windows, Node 23.5.0, npm 11.1.0, 8.5 GB RAM, 4 logical CPUs.
No backend was running during verification, so the AI service was intentionally
exercised in its offline path.

### Production build

```powershell
$env:CI='false'; $env:GENERATE_SOURCEMAP='false'; $env:DISABLE_ESLINT_PLUGIN='true'
npm run build
```

- Result: **exit 0**, final bundle `build/static/js/main.e8965b83.js`
  (2.54 MB gzip) plus the existing lazy chunks and CSS. CRA reports
  "Compiled with warnings."
- Source maps were disabled only to keep the build tractable on this machine; the
  app source is unchanged by the flag. The ESLint webpack plugin was disabled for
  the same reason (and because its cache was stale); the four changed files were
  linted directly instead (below).
- Warnings are pre-existing across untouched modules. The build also reports the
  existing `@mlightcad/cad-simple-viewer` export-path warnings used by the
  additive `/interop/cad-bim` route; they predate this task.
- Earlier build attempts with source maps on ran for over an hour without
  emitting output on this hardware and were stopped. This is a resource
  constraint, not a compilation error. The final build above completed.

### Lint on changed files

```powershell
node_modules\.bin\eslint.cmd --no-cache ^
  src/components/components/ChatPage.jsx ^
  src/components/engineering_appp.jsx ^
  src/components/components/Sidebar.jsx ^
  src/components/components/RightSidebar.jsx
```

Result: **0 errors, 0 warnings**.

### Automated tests

```powershell
$env:CI='true'; npm test -- --watchAll=false --passWithNoTests --runInBand
```

- The repository has **no test files**: Jest reports `0 matches` for both
  `testMatch` and `testRegex` across 398 checked files and exits 1 with
  "No tests found". There is no existing suite to run; this task added none and
  introduced no test dependencies.
- Under the workspace sandbox Jest first failed with `spawn EPERM` from
  `jest-haste-map`'s worker; it was rerun once with a one-shot wider sandbox
  permission. The "no tests found" result came from that rerun.

### Headless-browser verification (final production build, served locally)

The build was served through a small local static server (SPA fallback for
routes, assets under the configured `/services` prefix) and driven with Chrome +
the DevTools Protocol. Chrome's IPC is blocked by the workspace sandbox, so the
browser run used a one-shot wider sandbox permission. Headless Chrome defaults to
`prefers-color-scheme: dark`, which activates the stylesheet's system-preference
variables; the run emulated `light` for representative screenshots and tested the
explicit in-app dark toggle separately.

Results:

| Check | Result |
| --- | --- |
| `/` renders | Heading "What are we engineering today?", agent textarea visible, background image loaded, no horizontal overflow |
| Agent input | First and dominant interaction (existing `renderSearch` input; send/attach/expand behaviour unchanged) |
| Quick actions | 4 cards: Structural design, Drawing measurement, BOQ creation, CAD/3D inspection; 4 columns at 1440 px, 2 columns at 390 px |
| Category cards | 3 compact cards (Structural 14, Quantity & surveying 26, CAD & 3D 11); 3 columns desktop, 1 column mobile |
| Projects | Data-driven empty state ("No saved projects"); no invented projects |
| Theme toggle | Settings drawer opens, `role="switch"` toggles `dark` on the layout root, dark styles applied, drawer closes; toggled back to light afterwards |
| Sidebar | Opens/closes, real navigation destinations listed, history explicitly labelled sample, Escape closes; settings remain only in the right sidebar |
| All tools directory | 51 items; tabs All/Structural/Quantity/CAD; search "boq" → Bill of Quantities; no-match state; CAD filter → 11; Escape closes |
| Chat offline path | Overlay shows "Fundi service unavailable" and "No engineering analysis was generated"; badge "AI Offline"; **no "Mock"/"AI Analysis (Mock)" text**; the only console error is the intentional `Fundi AI service error` |
| `/structural/manual/beam` | Renders "RC Beam Designer", renderer present, no console errors |
| `/quantity/manual/taking-off` | Renders "Quantity Takeoff (English Method)" sheet, no console errors |
| `/quantity/manual/approximate` | Renders "Dimension Paper", no console errors |
| `/quantity/manual/boq` | Renders "Bill of Quantities", no console errors |
| `/drawing` | Renders the CAD drawer, renderer present, no console errors |
| `/visualise` | Renders "Visualization"/"Properties", renderer present, no console errors |
| Mobile home (390×844) | No horizontal overflow, heading and input visible, logo text hidden, 2-column quick actions, 1-column categories |
| Mobile module (390×844) | Top bar wraps to two rows, chat input visible on its own row, module content starts below the bar, no horizontal overflow |
| Route parity | 51 route-table entries ↔ 51 unique home paths; no route missing, no path without a route (`.probe/verify-routes.js`) |

### Verification limitations

- The Fundi backend at `127.0.0.1:8001` was not running, so live streaming and
  successful AI responses were **not** exercised. The explicit offline/error path was.
- Visual checks were made at 1440×1000 and 390×844 only; intermediate tablet
  widths were not screenshot-tested.
- The app scrolls inside `<main>`, so Chrome's full-page screenshot captures only
  the viewport; below-the-fold content was checked through the DOM assertions.
- Theme persistence is unchanged: `isDark` is not written to `localStorage` or
  `document.documentElement` (pre-existing behaviour).
- Headless Chrome IPC and Jest workers require permissions outside
  `workspace-write`; those steps used a one-shot wider sandbox permission. No other
  verification step needed it.
- Verification artifacts (screenshots, harness scripts, logs) live in the
  gitignored `.probe/` folder and are not part of the committed change.

## 5. Final outcome

- `ChatPage` is now a clean, responsive, agent-first engineering home: the existing
  agent input is the primary element, four quick actions open real modules, three
  compact category cards replace the oversized accordion panels, and an accessible
  all-tools directory exposes **every** existing route.
- React/React Router architecture, route definitions, chat state ownership, the
  theme toggle, the Sidebar (navigation/history) / RightSidebar (settings)
  separation, and all engineering modules are preserved. `AppLayout` was patched,
  not rewritten.
- Engineering safety: the mock "Fundi AI Analysis (Mock)" fallback and the fake
  "AI Generated Preview" were removed. Failures now state that the service is
  unreachable and that **no engineering analysis was generated**. The AI status
  badge only claims live/offline after a real request outcome.
- No calculation engine, formula, module editing logic, dependency, or
  `FloatingPalette` usage was changed. Project data is not persisted or invented.

Residual risks / follow-ups:

1. The assistant still depends on a local backend; users see an explicit service
   error when it is down. No retry/backoff or health check was added (status
   polling was already disabled in the baseline).
2. The production build is warning-heavy across the application, and the CAD viewer
   package emits export-path warnings. Neither was introduced here and both were
   left untouched to keep the change scoped.
3. There are no automated tests, so home/shell regressions are not guarded by CI.
   The verification harness is in gitignored `.probe/` and is not committed.
4. The home tool directory and the route table are two data definitions. They are
   in sync (51/51) but must be updated together; `.probe/verify-routes.js` re-checks
   parity.
5. Theme choice is still not persisted across reloads (pre-existing); the dark-mode
   styling itself is preserved and verified.
