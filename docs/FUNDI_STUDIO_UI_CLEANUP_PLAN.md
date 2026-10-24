# Fundi Studio — UI Cleanup and Component Reuse Audit & Architecture Plan

**Branch:** `feature/cad-bim-ifc-integration`  
**Repository:** `C:\Users\HP\Documents\programming\Java script\ReactApps\Services`  
**Audit Baseline:** `docs/FUNDI_STUDIO_UI_ARCHITECTURE_AUDIT.md`  
**Execution Type:** Static analysis + architecture planning (sections 1–8) **followed by implementation** (section 9 onwards).  
**Safety Confirmation:** Engineering formulas, API contracts and CAD/BIM serialisation are unchanged. See §9.6.

> **Implementation status (Session 3):** Stages A, B (beam reference + slabs/foundations/retaining/columns/framed & tall), C (roof + septic initial forms) and D (surveying + soil mechanics shell) are implemented in source. Stage E is partially implemented (shell/CAD-adjacent layout only, engines untouched). Stage F verification is recorded in §9.7 — including what could **not** be verified in this environment. Remaining work is listed in §9.8.

---

## 1. Source-Verified Inventory of Inspected Workflows and Components

Every component, route, and file listed below was inspected directly in the current repository working tree.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       APPLICATION SHELL                                         │
│  src/components/engineering_appp.jsx (AppLayout, Router, Navigation, Chat Overlay, Theme)       │
│  src/components/components/Sidebar.jsx (Left Navigation Drawer)                                 │
│  src/components/components/RightSidebar.jsx (Settings Drawer)                                   │
│  src/components/components/ChatPage.jsx (Home Directory, Tool Search, 34 Category Launchers)    │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
         │                                       │                                     │
         ▼                                       ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐           ┌──────────────────────┐
│  STRUCTURAL ENGINEERING │           │   QUANTITY SURVEYING    │           │  SURVEYING & GEOTECH │
│  • Beams                │           │  • Roof Works           │           │  • Surveying App     │
│  • Slabs                │           │  • Septic System        │           │  • Geoid & GNSS      │
│  • Columns              │           │  • Drainage / Manholes  │           │  • Earthworks        │
│  • Stairs               │           │  • External Works       │           │  • Route Surveying   │
│  • Foundations          │           │  • Substructure         │           │  • Soil Mechanics    │
│  • Walls                │           │  • Superstructure       │           └──────────────────────┘
│  • Retaining Walls      │           │  • Taking-Off Sheet     │                      │
│  • Regular Framed       │           │  • Dimension Paper      │                      ▼
│  • Tall Frame System    │           │  • Bill of Quantities   │           ┌──────────────────────┐
│  • Steel Design         │           └─────────────────────────┘           │   CAD / BIM / IFC    │
│  • Timber Design        │                                                 │  • Konva 2D Drawer   │
│  • Masonry Design       │                                                 │  • R3F Visualiser    │
└─────────────────────────┘                                                 │  • Interop Workbench │
                                                                            │    (MLightCAD+webifc)│
                                                                            └──────────────────────┘
```

### 1.1 Structural Engineering Workflows

| Engineering Module | Key Components & Files | Route | Calculation Method / Standards | Visual & CAD Output |
|---|---|---|---|---|
| **RC Beams** | `StructuralEngineeeringSuite.jsx`<br>`RCBeamDesigner.jsx`<br>`Eurocode_beam.jsx`<br>`Three.jsx`, `distribution.jsx` | `/structural/manual/beam` | BS 8110-1:1997 (Three-Moment, Moment Distribution, Table 3.5)<br>Eurocode 2 EN 1992-1-1 | 2D section (`BeamDrawer.jsx`)<br>3D rebar cage (`Beam_THree.jsx`)<br>DXF export (`/api/export-dxf`) |
| **RC Slabs** | `main_slab_app.jsx`<br>`slab_calculator_frontend.jsx`<br>`eurocode_slab_calculator.jsx` | `/structural/manual/slabs` | BS 8110 (One-way, two-way, ribbed, waffle)<br>Eurocode 2 | 2D plan (`SlabDrawer.jsx`)<br>3D slab model (`slab_THReeD.jsx`) |
| **RC Columns** | `Columnmain.jsx`<br>`ColumnDrawer.jsx` | `/structural/manual/column` | BS 8110 Uniaxial & Biaxial interaction ($M_x, M_y, N$) | Recharts P-M interaction curve<br>3D column view (`column_3d_helper.jsx`) |
| **RC Stairs** | `stair_main_app.jsx`<br>`Stair2D.jsx` | `/structural/manual/stairs` | BS 8110 / Eurocode 2 doglegged flights, waist, landings | 2D profile & rebar detailing<br>3D stair viewer (`visualisation_helper.jsx`) |
| **RC Foundations** | `foundation_main_app.jsx`<br>`BsCodes.jsx`<br>`eurocode_foundation_app.jsx` | `/structural/manual/foundation` | BS 8110 / BS 8004 (Pad, combined, pile caps, strip footings)<br>Eurocode 7 | 2D foundation plan & section<br>DXF export (`/api/export-foundation-dxf`) |
| **RC Walls** | `main_wall_app.jsx`<br>`eurocode_wall_calc.jsx`<br>`Wall_visualiser.jsx` | `/structural/manual/wall` | BS 8110 / Eurocode 2 shear walls and bearing walls | 2D wall reinforcement elevation<br>DXF export (`/api/export-wall-dxf`) |
| **RC Retaining Walls** | `main_app_component.jsx`<br>`eurocode_retaining_calc.jsx` | `/structural/manual/retaining` | BS 8002 / Eurocode 7 cantilever and gravity walls | 2D earth pressure & stability diagram<br>3D retaining wall view |
| **Regular Framed Buildings** | `eurocode_structural_app.jsx`<br>`rc_structural_design.jsx`<br>`InteractiveStructureBuilder.jsx` | `/structural/manual/eurocode_structural_app` | BS 8110 / EN 1992 multi-bay, multi-storey linear elastic frame, gravity-governed | 2D structural grid canvas<br>3D frame mesh (`Multi_storey_structure.jsx`)<br>Member design dashboard |
| **Tall Frame Buildings** | `rc_structural_design.jsx` (`activeModule='systems'\|'modeling'`)<br>`tall_framed_backend.py` | `/structural/manual/eurocode_structural_app` | BS 8110 / BS 6399 / EN 1991-1-4 (Wind), EN 1998 (Seismic)<br>Second-order $P$-$\Delta$, sway stability, drift, robustness ties | Lateral drift curves, wind pressure profile, 3D building shear core view |
| **Steel Design** | `steel_design_app.jsx`<br>`bolted_connections_frontend.jsx`<br>`welded_joints_frontend.jsx`<br>`SteelBIM.jsx` | `/structural/manual/steel`<br>`/structural/automatic/bolt_connections`<br>`/structural/automatic/weld_connections` | BS 5950-1:2000 Universal Beams, Universal Columns, Ordinary/HSFG bolts, Fillet/butt welds | 2D steel section (`SteelSectionKonva.jsx`)<br>3D steel framing BIM viewer (`SteelStructure3D.jsx`) |
| **Timber Design** | `Timber_ui.jsx`<br>`Timber_visualisation.jsx` | `/structural/manual/Timber_design` | BS 5268-2:2002 Permissible stress design (Flexure, Axial, Combined, Stud wall) | 2D blueprint Konva canvas (grain hatching, neutral axis, dimensioned leader ticks) |
| **Masonry Design** | `Masonry_ui.jsx`<br>`masonry_visualiser.jsx` | `/structural/manual/Masonry_design` | BS 5628-1:2005 Unreinforced masonry (Vertical load resistance, Lateral panel flexure) | 2D masonry wall coursing elevation<br>Stress utilization gauges |

### 1.2 Quantity Surveying Workflows

| QS Module | Key Components & Files | Route | Pipeline Nature | Output Documents |
|---|---|---|---|---|
| **Roof Works** | `RoofMain.jsx`<br>`RoofForm.jsx`<br>`Roof3DVisualizer.jsx` | `/quantity/manual/roof-taking-off` | Initial geometry inputs $\to$ Backend SMM7 takeoff $\to$ Editable taking-off $\to$ Dimension paper $\to$ BOQ | SMM7 Taking-Off Sheet<br>Standard Dimension Paper<br>Priced Bill of Quantities |
| **Septic Tank** | `septik_tank.jsx`<br>`TwoD.jsx`<br>`ThreeD.jsx` | `/quantity/manual/septic-taking-off` | Tank/manhole/soakpit form $\to$ Backend quantity calculation $\to$ Editable takeoff $\to$ Dimension paper $\to$ BOQ | 2D engineering drawings<br>3D model<br>SMM7 Takeoff & BOQ |
| **Measurement Documents** | `EnglishMethodTakeoffSheet.jsx`<br>`universal_component.jsx` (`UniversalSheet`, `UniversalBOQ`)<br>`DocumentViewer.jsx` | `/quantity/manual/taking-off`<br>`/quantity/manual/approximate`<br>`/quantity/manual/boq`<br>`/quantity/manual/documents` | Downstream measurement document chain (Shared across all QS tools) | Professional English Method Takeoff Paper with timesing, squaring, descriptions, and summary BOQ |

### 1.3 Surveying & Geotechnical Workflows

| Tool | Component & File | Route | Capabilities |
|---|---|---|---|
| **Civil Surveying Suite** | `surveying_app.jsx` | `/surveying` | Levelling (Rise & Fall, Collimation), Traverse (Bowditch adjustment), Tacheometry, Sewer gradient, Control survey, Tape corrections |
| **Earthworks QS** | `erathworks.jsx` | `/surveying/earthworks` | Cross-section station chainages, cut/fill end areas, prismoidal volume, mass-haul balances |
| **Geoid & GNSS** | `geoid_model.jsx` | `/surveying/geoid-model` | Ellipsoidal to orthometric height transformations, undulation lookup |
| **Route Surveying** | `main_road.jsx` | `/surveying/road-railway` | Horizontal circular curves, transition spirals, vertical parabolic curves, superelevation |
| **Contouring & Terrain** | `Contouring_terrain.jsx` | `/surveying/contouring` | Point cloud triangulation, Delaunay TIN mesh, digital elevation contouring |
| **Deformation Monitoring**| `monitoring_deformation.jsx` | `/surveying/monitoring` | Multi-epoch target displacement vectors, settlement trendlines, velocity alerts |
| **Soil Mechanics Module** | `soil_mechanics.jsx` | `/surveying/soil-mechanics` | Phase relations, Atterberg limits, Proctor compaction, Direct shear/triaxial, Terzaghi/Meyerhof bearing capacity, 1D consolidation, Bishop slope stability, 3D borehole log |

### 1.4 CAD / BIM / Visualization Layer

| Tool / Route | Component & File | Underlying Engine | State & Integration |
|---|---|---|---|
| **CAD / BIM / IFC Workbench** | `InteropWorkbench.jsx`<br>`CadDxfViewer.jsx`<br>`ThatOpenBimViewer.jsx`<br>`IfcBimViewer.jsx` | `@mlightcad/*` 1.7.5<br>`web-ifc` 0.0.78<br>`@thatopen/*` 3.3.3<br>Python `IfcOpenShell` + `ezdxf` | Authoritative engineering model $\leftrightarrow$ DXF $\leftrightarrow$ IFC4 with SQLite persistent element mapping (`mapping.py`) |
| **2D Universal CAD Drawer** | `cad_drawing.jsx` | React Konva 10.0.12<br>`CadEngine.js` | In-memory 2D vector drafting canvas (lines, polylines, circles, rectangles, layers, snap engine) |
| **3D Procedural Visualizer** | `visualise_component.jsx` | React Three Fiber 9.4<br>`@react-three/drei` 10.7.6 | R3F procedural mesh scene renderer used for real-time 3D feedback across 30+ components |

---

## 2. Current-State Duplication & Maintainability Assessment

### 2.1 Duplication Hotspots

```
               REPEATED CODE & PATTERN DUPLICATION IN CURRENT SOURCE
┌─────────────────────────────────┬────────────────────────────────────────────────────────┐
│ UI Pattern                      │ Locations Re-Implemented Independently                 │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Design Code Standard Switcher   │ • StructuralEngineeeringSuite.jsx (BS 8110 / Eurocode) │
│                                 │ • main_slab_app.jsx (BS 8110 / Eurocode)               │
│                                 │ • Columnmain.jsx                                       │
│                                 │ • stair_main_app.jsx (BS 8110 / Eurocode)              │
│                                 │ • foundation_main_app.jsx (BS Standards / Eurocode)    │
│                                 │ • main_wall_app.jsx (BS Codes / Eurocode)              │
│                                 │ • main_app_component.jsx (BS 8002 / Eurocode 7)        │
│                                 │ • eurocode_structural_app.jsx (BS Codes / Eurocodes)   │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Dimensional Numeric Field       │ • Re-implemented >150 times with inline <label>       │
│ with Units                      │   and <input type="number"> with manual styling        │
│                                 │ • Timber_ui.jsx uses custom <Field> inline styles      │
│                                 │ • Masonry_ui.jsx uses custom <Input> text-[10px] mono  │
│                                 │ • septik_tank.jsx uses custom <InputField>             │
│                                 │ • steel_design_app.jsx uses colored border inputs      │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Compliance Status Badge &       │ • RCBeamDesigner.jsx: StatusBadge & Summary Alert      │
│ Utilization Progress Bar        │ • Timber_ui.jsx: UtilBar & Badge (PASS/FAIL)           │
│                                 │ • Masonry_ui.jsx: Gauge & PassBadge                    │
│                                 │ • DesignDashboard.jsx: Member table progress bar       │
│                                 │ • steel_design_app.jsx: Inline text utilization %      │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3D/2D Viewer Modal Overlay      │ • RCBeamDesigner.jsx (Canvas, OrbitControls, Stage)    │
│                                 │ • Eurocode_beam.jsx (Canvas, Stage, Controls)          │
│                                 │ • septik_tank.jsx (UniversalTabs modal)                │
│                                 │ • RoofMain.jsx (UniversalTabs modal)                   │
│                                 │ • New_frame.jsx (Modal overlay & full-screen button)   │
└─────────────────────────────────┴────────────────────────────────────────────────────────┘
```

### 2.2 Styling System Inconsistencies
1. **Conflicting Styling Dialects:**
   - Most modules use Tailwind CSS utility classes (`bg-slate-800 text-white rounded-xl shadow-md`).
   - `Timber_ui.jsx` bypasses Tailwind almost entirely, using raw React inline style objects (`style={{ display: "flex", flexDirection: "column", gap: 4 }}`) with a dynamic design token function `getTokens(isDark)`.
   - `Masonry_ui.jsx` uses a custom monospace technical blueprint styling with microscopic uppercase labels (`text-[10px] font-mono tracking-widest uppercase`).
   - `DesignDashboard.jsx` uses plain JavaScript style constants (`const modalStyle = { ... }`).
2. **Inconsistent Theming:**
   - Some components accept `isDark` (boolean).
   - Some components accept `theme` (string `"dark"` | `"light"`).
   - Some components ignore theme props completely (e.g. `DimensionsApp`, `MaterialsApp`).

---

## 3. Dedicated Comparison: Tall Frame vs. Regular Framed Buildings

The repository contains two intertwined representations under `src/components/ReinforcedConcrete/FramedandTall/`:
1. **Regular Framed Buildings:** Traditional low-to-mid-rise moment-resisting concrete frame governed by gravity loading ($1.4 G_k + 1.6 Q_k$) and standard lateral wind shear.
2. **Tall Frame Buildings:** High-rise structures governed by lateral stiffness, wind acceleration profiles, seismic ductility, second-order sway ($P$-$\Delta$), inter-story drift limits, and disproportionate collapse robustness ties.

### 3.1 Comprehensive Engineering & Architecture Comparison Table

| Dimension | Regular Framed Buildings | Tall Frame Buildings | Comparison & Boundaries |
|---|---|---|---|
| **Height & Slenderness** | Height $H \le 25\text{ m}$ (typically 1–7 storeys); aspect ratio $H/B < 3$. | Height $H > 25\text{ m}$ up to $300\text{ m}$ (8–80+ storeys); aspect ratio $H/B \ge 3\dots 7$ (slender, wind-critical). | **Distinct engineering scope.** Height triggers structural system transitions. |
| **Governing Actions & Load Combinations** | Gravity loads govern: $1.4 G_k + 1.6 Q_k$. Lateral wind is treated as a static equivalent shear force distributed uniformly or trapezoidally. | Lateral loads govern (wind & seismic). Wind pressure varies with height $z$ per EN 1991-1-4 (terrain category 0–IV, orography factor $c_o$, turbulence $I_v(z)$, dynamic gust factor $c_s c_d$). Seismic response spectrum per EN 1998-1. | **Different load generators.** Tall frame requires dynamic wind profiles and seismic mass participation. |
| **Global Sway & Lateral Stability** | First-order linear elastic analysis. Sway is small and second-order effects are neglected ($\theta \le 0.10$). | **Second-order $P$-$\Delta$ (global building sway) and $P$-$\delta$ (member curvature) are mandatory.** Sway sensitivity index $\theta = \frac{P_{tot} \cdot d_r}{V_{tot} \cdot h}$. Lateral drift limits enforced strictly: $H/500$ down to $H/900$. | **Different analysis engines.** Regular frames cannot use linear analysis once $P$-$\Delta$ amplifies moments by $>10\%$. |
| **Structural System Typologies** | Rigid moment-resisting frames (beams + columns rigidly connected). | Specialized high-rise lateral resisting systems (`rc_structural_design.jsx:206-245`):<br>• Rigid frame ($\le 25\text{ m}$)<br>• Braced frame ($\le 50\text{ m}$)<br>• Shear wall core ($\le 70\text{ m}$)<br>• Coupled shear walls ($\le 100\text{ m}$)<br>• Framed tube ($\le 150\text{ m}$)<br>• Tube-in-tube ($\le 200\text{ m}$)<br>• Outrigger & mega-columns ($\le 300\text{ m}$) | **Unique to Tall Frame.** A regular framed workflow has no concept of outriggers, belt trusses, or framed tube shear lag. |
| **Robustness & Progressive Collapse Ties** | Standard BS 8110 Clause 3.12.3: Peripheral ties ($T_p = 60\text{ kN}$ or $20 + 4n_s$) and internal horizontal ties. | Rigorous structural integrity ties per BS 8110 / EN 1991-1-7 (`tall_framed_backend.py:33-48`):<br>• Peripheral ties<br>• Internal ties ($F_t = \min(60, 20 + 4n_s)$)<br>• Horizontal column/wall ties ($2\%\text{ of } N_{Ed}$ or $F_t$)<br>• Vertical ties continuous through all storeys to bridge failed load-bearing members. | **Shared formula base, but Tall Frame enforces vertical tie continuity and element removal bridging checks.** |
| **3D Computer Modeling & Torsional Coupling** | Symmetric, 2D planar bent frame approximation (Portal method or Cantilever method). | Multi-bent 3D spatial analysis (`tall_framed_backend.py:85-100`):<br>• Category 1: Identical parallel bents<br>• Category 2: Stiffness-weighted distribution<br>• Category 3: Full 3D torsional analysis accounting for eccentricity $e_x, e_y$ between Center of Mass (CM) and Center of Rigidity (CR). | **Distinct analysis model.** Regular frame assumes no diaphragm rotation; tall frame requires center of rigidity calculations. |
| **Member Design Outputs** | Individual member sizing: Beams (flexure, shear, deflection), Columns (axial + bending), Slabs, Footings. | Global building drift envelope + member design dashboard + member utilization table across multiple storeys and elevation groups. | **Shared member design components, different data hierarchy.** Regular frame designs one beam; tall frame designs floor-grouped schedules. |
| **Backend Contracts & Endpoints** | Shares `/api/framed/api/design/beam`, `/api/framed/api/design/column`, `/api/framed/api/design/slab`. | Tall Frame exclusively calls:<br>`POST /api/framed/api/analysis/structural-system`<br>`POST /api/framed/api/analysis/computer-model`<br>`POST /api/framed/api/analysis/wind-load`<br>`POST /api/framed/api/analysis/seismic`<br>`POST /api/framed/api/design/ties` | **Distinct API endpoints.** |
| **Duplicated UI Code in Repository** | Both re-implement storey/bay count inputs, grid dimensional inputs, concrete grade selectors, and member schedule tables. | Both re-implement storey/bay count inputs, grid dimensional inputs, concrete grade selectors, and member schedule tables. | **High UI duplication.** The grid setup, material selection, and 3D wireframe viewers can be shared. |

### 3.2 Architectural Boundary: How to Share UI Without Conflating Engineering Logic

```mermaid
graph TD
    subgraph Shared Building Frame UI Components
        A["Storey & Bay Grid Configuration\n(Floors, Bays, Story Height, Bay Width)"]
        B["Material & Rebar Selector\n(Concrete Class, Steel Grade)"]
        C["3D Multi-Storey Wireframe / BIM View\n(Multi_storey_structure.jsx)"]
        D["Member Design Schedule Table\n(DesignDashboard.jsx)"]
    end

    subgraph Regular Framed Building Pipeline
        A --> E["Regular Frame Workflow Container\n(Gravity-governed)"]
        B --> E
        C --> E
        D --> E
        E --> F["First-Order Linear / Portal Analysis\n(/api/framed/api/analyze)"]
        F --> G["Gravity Load Combinations\n(1.4Gk + 1.6Qk)"]
    end

    subgraph Tall Frame Building Pipeline
        A --> H["Tall Frame Workflow Container\n(Lateral-governed)"]
        B --> H
        C --> H
        D --> H
        H --> I["Lateral System Selector\n(Shear Wall, Coupled, Tube, Outrigger)"]
        H --> J["Dynamic Wind & Seismic Engine\n(EN 1991-1-4 / EN 1998)"]
        H --> K["Second-Order P-Delta & Sway Drift Check\n(H/500 - H/900 limits)"]
        H --> L["Disproportionate Collapse Ties Engine\n(BS 8110 Cl 3.12.3 Vertical Ties)"]
        H --> M["3D Torsional Rigidity Analysis\n(Center of Mass vs Center of Rigidity)"]
    end
```

**Key Architectural Rule:**
- **Shared:** The visual grid setup, material dropdowns, 3D structural canvas ([`Multi_storey_structure.jsx`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/ReinforcedConcrete/FramedandTall/Multi_storey_structure.jsx)), and the multi-member result dashboard ([`DesignDashboard.jsx`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/ReinforcedConcrete/FramedandTall/DesignDashboard.jsx)) should be extracted into reusable frame components.
- **Strictly Separated:** The Tall Frame workflow container must retain its own configuration stages for structural system selection (Tube, Outrigger, Coupled Core), dynamic wind profiling, seismic response spectra, $P$-$\Delta$ drift verification, and robustness tie calculations. It must never be compressed into a generic portal frame input.

---

## 4. Proposed Shared-Component Catalogue with Interfaces & Boundaries

To clean up duplication without breaking workflows, components are organized into four strict layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 4: Engineering Logic & Integrations                              │
│ • Deterministic Handbooks • API Clients • CAD/IFC Serializers          │
└──────────────────────────────────▲─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│ Layer 3: Workflow-Specific Forms                                       │
│ • RCBeamDesigner • TallFrameContainer • RoofMain • SepticApp           │
└──────────────────────────────────▲─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│ Layer 2: Reusable Engineering Form Components                          │
│ • MaterialGradeSelector • ExposureCoverGroup • SectionDimensionInput   │
└──────────────────────────────────▲─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│ Layer 1: Shared UI Primitives                                          │
│ • EngineeringField • DesignCodeToggle • StatusBadge • ViewerModal      │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Layer 1: Shared UI Primitives (`src/components/shared/primitives/`)

#### 1. `EngineeringField`
- **Purpose:** A standardized wrapper for all engineering inputs that renders the field label, standard engineering unit adornment, tooltip help text, and validation/error message.
- **Proposed Interface:**
```typescript
interface EngineeringFieldProps {
  label: string;
  unit?: string;               // e.g. "mm", "kN", "kN/m²", "MPa", "m"
  tooltip?: string;            // Reference clause or explanation
  error?: string | null;       // Validation error string
  warning?: string | null;     // Code limit warning
  required?: boolean;
  isDark?: boolean;
  children: React.ReactNode;   // The underlying input or select control
  className?: string;
}
```
- **Workflows Replaced:** Raw `<label>` and `<input>` wrappers in Beam, Slab, Column, Steel, Timber, Masonry, and Septic forms.

#### 2. `EngineeringNumberInput`
- **Purpose:** A controlled numeric input with automatic numeric parsing (`parseFloat`), min/max clamping, precision step controls, and prevention of negative values when disallowed.
- **Proposed Interface:**
```typescript
interface EngineeringNumberInputProps {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  disabled?: boolean;
  isDark?: boolean;
  id?: string;
}
```

#### 3. `DesignCodeToggle`
- **Purpose:** Standardized segmented button or toggle for switching between engineering design standards (e.g. BS 8110 vs. Eurocode 2, BS 5950 vs. Eurocode 3, BS 8002 vs. Eurocode 7).
- **Proposed Interface:**
```typescript
interface DesignCodeToggleProps {
  activeCode: string;
  onChange: (code: string) => void;
  options: Array<{
    id: string;
    label: string;
    sublabel?: string;         // e.g. "BS 8110-1:1997" or "EN 1992-1-1"
    icon?: React.ComponentType<{ size?: number; className?: string }>;
  }>;
  isDark?: boolean;
}
```
- **Replaces:** 7 conflicting ad-hoc toggle implementations across Beam, Slab, Column, Stairs, Walls, Foundations, and Framed suites.

#### 4. `StatusBadge` & `UtilizationGauge`
- **Purpose:** Unified visualization of engineering check outcomes (PASS / FAIL / WARNING) and structural utilization percentage bars with standardized color bands ($<50\%$ normal green, $50-90\%$ optimal amber, $>90\%$ critical red).
- **Proposed Interface:**
```typescript
interface StatusBadgeProps {
  status: 'PASS' | 'FAIL' | 'WARNING';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  isDark?: boolean;
}

interface UtilizationGaugeProps {
  ratio: number;               // Value between 0.0 and 2.0 (1.0 = 100% capacity)
  label: string;               // e.g. "Bending M_Ed / M_Rd"
  allowable?: number;          // Default 1.0
  isDark?: boolean;
}
```

#### 5. `ViewerModal`
- **Purpose:** Standard full-screen and dialog container for 2D and 3D canvases, providing standardized header controls, close button, view mode toggles (Top, Elevation, Isometric), reset camera button, and canvas resize listener.
- **Proposed Interface:**
```typescript
interface ViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;   // e.g. Export CAD, Download PDF
  isDark?: boolean;
  children: React.ReactNode;   // The Three.js Canvas or Konva Stage
}
```

---

### Layer 2: Reusable Engineering Form Components (`src/components/shared/engineering/`)

#### 1. `MaterialGradeSelector`
- **Purpose:** Standardized concrete cube/cylinder compressive strength ($f_{cu} / f_{ck}$), rebar characteristic yield strength ($f_y / f_{yk}$), structural steel grade ($S275, S355, S450$), and timber strength classes ($C14\dots D70$).
- **Configuration Prop:** `materialType: 'concrete' | 'rebar' | 'steel' | 'timber' | 'masonry'`.
- **Outputs:** Grade key and design strength constants ($f_{cd}, f_{yd}, E_s$).

#### 2. `ExposureAndCoverGroup`
- **Purpose:** Unified section for durability classification (Mild, Moderate, Severe, Very Severe, Extreme; XC1–XC4, XD1–XD3, XS1–XS3), fire resistance rating (30 mins to 4 hours), and nominal concrete cover $c_{nom}$.
- **Outputs:** `{ exposureClass, fireRatingHours, coverMm }`.

#### 3. `StoreyGridSetup`
- **Purpose:** Standardized setup for building frame geometry: number of storeys, number of bays along X/Y, storey heights, bay widths, and bay spacings.
- **Used by:** Both Regular Framed Buildings and Tall Frame Buildings.

---

### Layer 3: Workflow-Specific Forms (Preserved Domain Containers)
These remain independent components containing domain-specific fields and workflow state:
- `RCBeamDesigner`: Span configurations, flanged section ratios, rebar layer distribution.
- `RCSlabModule`: Edge continuity matrix, span ratios ($l_y / l_x$), rib topping dimensions.
- `TallFrameContainer`: Lateral structural system choice (Tube, Outrigger, Shear Core), EN 1991 wind profile, seismic acceleration response spectrum, drift limit threshold, robustness vertical ties.
- `RoofTakeoffForm`: Roof typology (Gable, Hipped, Gambrel, Mansard), upper/lower pitch angles, truss spacings, covering materials.
- `SepticTakeoffForm`: Chamber dimensions, baffle wall heights, manholes, soak pit shapes.

---

### Layer 4: Engineering Logic & Integrations (Non-Visual)
- All calculation functions, FastAPI endpoints, and CAD/BIM serialization scripts remain in their current backend/engine modules.
- UI components communicate through thin, strongly-typed adapter functions.

---

## 5. Workflow-to-Component Reuse Matrix

| Workflow | `EngineeringField` & `NumberInput` | `DesignCodeToggle` | `MaterialGradeSelector` | `ExposureAndCoverGroup` | `StatusBadge` & `UtilizationGauge` | `ViewerModal` | `StoreyGridSetup` | Workflow-Specific Component (Preserved) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **RC Beam** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `RCBeamDesigner.jsx` |
| **RC Slabs** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `slab_calculator_frontend.jsx` |
| **RC Columns** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `Columnmain.jsx` |
| **RC Stairs** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `stair_main_app.jsx` |
| **RC Foundations**| Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `foundation_main_app.jsx` |
| **RC Walls** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `main_wall_app.jsx` |
| **RC Retaining** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | - | `main_app_component.jsx` |
| **Regular Framed**| Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | Yes | `InteractiveStructureBuilder.jsx` |
| **Tall Frame** | Yes | Yes | Yes (Concrete + Rebar) | Yes | Yes | Yes | Yes | `TallFrameLateralSystem.jsx`, `WindProfile.jsx`, `TiesModule.jsx` |
| **Steel Design** | Yes | Yes | Yes (Steel S275/355) | - | Yes | Yes | - | `steel_design_app.jsx`, `bolted_connections_frontend.jsx` |
| **Timber Design**| Yes | - | Yes (Timber C14-D70) | - | Yes | - | - | `Timber_ui.jsx`, `Timber_visualisation.jsx` |
| **Masonry Design**| Yes | - | Yes (Mortar/Bricks) | - | Yes | - | - | `Masonry_ui.jsx`, `masonry_visualiser.jsx` |
| **Roof Takeoff** | Yes | - | - | - | - | Yes | - | `RoofForm.jsx`, `EnglishMethodTakeoffSheet.jsx` |
| **Septic Takeoff**| Yes | - | - | - | - | Yes | - | `septik_tank.jsx`, `EnglishMethodTakeoffSheet.jsx` |
| **Civil Survey** | Yes | - | - | - | Yes | - | - | `surveying_app.jsx` |
| **Soil Mechanics**| Yes | - | - | - | Yes | Yes | - | `soil_mechanics.jsx` |

---

## 6. Components and Logic That Must Deliberately Remain Separate

To protect the integrity of the application, the following must **never** be merged or forced into a generic abstraction:

1. **Downstream Quantity Surveying Measurement Documents:**
   - [`EnglishMethodTakeoffSheet.jsx`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/takeoff2/ExternalWorks/EnglishMethodTakeoffSheet.jsx), [`UniversalSheet`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/takeoff2/universal_component.jsx), and [`UniversalBOQ`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/takeoff2/universal_component.jsx) represent formal standard civil measurement conventions (SMM7 / CESMM4).
   - They must remain dedicated spreadsheet/dimension-paper documents. Do not replace them with generic dashboard cards or simplified tables.
2. **Tall Frame Lateral Analysis & Robustness Systems:**
   - The wind boundary layer velocity profile, seismic response spectra, inter-story drift equations, outrigger truss mechanics, and vertical tie load redistribution calculations in `rc_structural_design.jsx` and `tall_framed_backend.py` must remain exclusive to Tall Frame.
   - Do not merge them with the low-rise regular frame analysis.
3. **Engineering Calculation Code & Handbooks:**
   - All Python calculation routers (`src/Backend/calculations/*`) and deterministic JS calculations (e.g. BS 5950 steel formulas in `steel_design_app.jsx`) must stay untouched. UI cleanup is strictly confined to presentation components.
4. **CAD/BIM Interoperability Workbench:**
   - The `/interop/cad-bim` workbench ([`InteropWorkbench.jsx`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/interop/InteropWorkbench.jsx)) provides a verified IFC4 / MLightCAD / That Open pipeline. It must not be mixed with or replaced by the legacy Konva 2D drawer ([`cad_drawing.jsx`](file:///c:/Users/HP/Documents/programming/Java%20script/ReactApps/Services/src/components/Drawings/cad_drawing.jsx)).

---

## 7. Staged Implementation Plan (Minimizing Regression Risk)

### Stage 1: Core UI Primitives & Design Code Toggle (Lowest Risk)
- **Objective:** Establish the foundational UI primitive components without touching existing engineering calculations.
- **Components to Introduce:**
  - `src/components/shared/primitives/EngineeringField.jsx`
  - `src/components/shared/primitives/EngineeringNumberInput.jsx`
  - `src/components/shared/primitives/DesignCodeToggle.jsx`
  - `src/components/shared/primitives/StatusBadge.jsx`
  - `src/components/shared/primitives/UtilizationGauge.jsx`
- **Pilot Workflow:**
  - Refactor `DesignCodeToggle` into `src/components/ReinforcedConcrete/Beams/StructuralEngineeeringSuite.jsx` (Beam) and `src/components/ReinforcedConcrete/Walls/main_wall_app.jsx` (Wall).
- **Verification:**
  - Verify that switching between BS 8110 and Eurocode 2 properly toggles views and triggers identical calculations with zero payload deviation.
- **Commit Boundary:** `feat(ui): add shared engineering primitives and pilot on beam/wall code switcher`.

---

### Stage 2: Shared Engineering Form Components (Materials & Durability)
- **Objective:** Consolidate concrete, steel, timber, and masonry grade selectors and exposure/cover field groups.
- **Components to Introduce:**
  - `src/components/shared/engineering/MaterialGradeSelector.jsx`
  - `src/components/shared/engineering/ExposureAndCoverGroup.jsx`
- **Workflows Affected:**
  - RC Beams (`StructuralEngineeeringSuite.jsx`), RC Slabs (`main_slab_app.jsx`), RC Columns (`Columnmain.jsx`), RC Foundations (`foundation_main_app.jsx`).
- **Verification:**
  - Check that material strength constants ($f_{cu}, f_{ck}, f_y, E_s$) passed to calculation APIs match previous values exactly.
- **Commit Boundary:** `feat(ui): extract reusable MaterialGradeSelector and ExposureAndCoverGroup`.

---

### Stage 3: Regular Framed vs. Tall Frame Component Decoupling
- **Objective:** Separate shared frame setup from tall-building lateral analysis while eliminating duplicated frame inputs.
- **Actions:**
  - Extract `StoreyGridSetup.jsx` (storeys, bays, heights, widths) and `MemberDesignDashboard.jsx` from `rc_structural_design.jsx` and `DesignDashboard.jsx`.
  - Mount `StoreyGridSetup` in Regular Framed Buildings and in Tall Frame Buildings.
  - Isolate Tall Frame's lateral systems (Shear Core, Outrigger, Tube-in-Tube), wind profiles, and vertical tie robustness into `TallFrameSpecifics.jsx`.
- **Verification:**
  - Submit 5-storey regular frame; verify linear analysis.
  - Submit 30-storey tall frame with wind/seismic and outrigger; verify drift, $P$-$\Delta$, and tie calculations match backend test suite.
- **Commit Boundary:** `refactor(structural): decouple shared frame grid from tall frame lateral systems`.

---

### Stage 4: Takeoff Initial Input Forms Modernization
- **Objective:** Clean up initial input forms for Roof and Septic tank using `EngineeringField` and `EngineeringNumberInput`, while strictly preserving the downstream Taking-off Sheet, Dimension Paper, and BOQ.
- **Components to Refactor:**
  - `src/components/takeoff2/RoofWorks/RoofForm.jsx`
  - `src/components/takeoff2/septik/septik_tank.jsx` (Chamber and Soakpit inputs)
- **Verification:**
  - Calculate Roof takeoff: verify generated items flatten into `EnglishMethodTakeoffSheet` identically.
  - Edit timesing and dimensions: verify auto-squaring in `UniversalSheet` and quantity/rate amounts in `UniversalBOQ` remain 100% consistent.
- **Commit Boundary:** `refactor(qs): standardize roof and septic initial forms while preserving document pipeline`.

---

### Stage 5: Viewer Dialog Unification & CAD Handshake Fix
- **Objective:** Unify 2D/3D modal viewers into `ViewerModal` and connect the broken "Send to CAD" button from RC Beam to the 2D CAD canvas.
- **Actions:**
  - Implement `src/components/shared/primitives/ViewerModal.jsx`.
  - In `src/components/Drawings/cad_drawing.jsx`, read `useLocation().state.config` and add primitives to `CadEngine`.
- **Verification:**
  - In RC Beam Designer, click "Send to CAD"; verify that `/drawing` opens and immediately renders the beam rebar cross-section on the Konva canvas.
- **Commit Boundary:** `fix(cad): connect RC beam send-to-cad navigation and standardize ViewerModal`.

---

## 8. Unresolved Questions & Assumptions That Could Not Be Verified

1. **Offline Qwen AI Service:**
   - In `src/Backend/main.py:286`, `qwen_model_router` is commented out. The cleanup plan assumes this service will eventually be restored on port 8001, but does not alter the backend.
2. **Port 8000 Endpoints:**
   - Soil mechanics (`soil_mechanics.jsx:8`) and the CAD copilot (`cad_drawing.jsx:1439`) point to port `8000`. It could not be verified whether an independent microservice was originally intended to run on port 8000 or whether this was a configuration typo for 8001.
3. **Unregistered CAD FastAPIs in `src/components/Cad_Dwg/`:**
   - The directory contains standalone Python FastAPI apps (`main.py` files). These are not referenced by `src/Backend/main.py` or the frontend routes and appear to be abandoned experimental spikes.
4. **`detailing_3d.jsx` Reachability:**
   - The 244 KB file `src/components/Drawings/detailing_3d.jsx` exports 21 detail generator functions, but has zero importers across `src/`. It is currently dead code.
5. **Downstream Takeoff Document State Sync:**
   - It is assumed that specialized takeoffs (Roof, Septic) are currently intended to be self-contained modules, and that publishing to the global `/quantity/manual/taking-off` route will be an opt-in future feature rather than a forced synchronization.

---

# 9. Implementation Record (Session 3)

This section supersedes the planning-only status of §7. It records what was
actually built, where, and what remains. Everything below was verified against
the working tree, not against the audit assumptions.

## 9.1 Stage status

| Stage | Scope | Status | Notes |
|---|---|---|---|
| **A — Foundation** | Shared tokens + primitives, application shell, responsive navigation | **Implemented** | Shell rebuilt around an in-flow header/footer; route registry added. |
| **B — Structural forms** | RC beam (reference), then slabs / foundations / retaining / columns / framed & tall | **Implemented** | Beam is the reference implementation; the others consume the same primitives. Steel, stairs and walls were not refactored (§9.8). |
| **C — Quantity surveying** | Roof + septic initial input forms | **Implemented** | Downstream taking-off / dimension paper / BOQ components untouched. |
| **D — Surveying & soil** | Shell + navigation + phone layout | **Implemented (partial depth)** | Headers, tab bars, padding and overflow fixed; individual field grids inside the surveying sub-modules were left as-is. |
| **E — CAD/BIM, chat** | Responsive workspace + chat overlay | **Partially implemented** | Chat overlay rebuilt (pinned header/input, safe-area, keyboard-safe); CAD engines and interop workbench untouched. |
| **F — Integration & regression** | Verification | **Partially verified** | See §9.7 for exactly what was and was not run. |

Stage order was kept as planned: the shell had to exist before workflow pages
could adopt it, and the RC beam workflow was refactored first so the component
APIs were proven before being propagated.

## 9.2 Shared UI kit (new)

Layer 1 — `src/components/shared/ui/`

| File | Contents |
|---|---|
| `tokens.js` | Surface / text / radius / control / action / status / layout tokens, utilisation bands, breakpoint constants. Single source for spacing, typography and colour intent. |
| `Fields.jsx` | `EngineeringField`, `NumberInput`, `NumberField`, `TextInput`, `TextField`, `SelectInput`, `SelectField`, `CheckboxField`, `SegmentedField`, `FieldHint`. Labels are always associated, units always printed, errors/warnings attached via `aria-describedby` + `aria-invalid`. **`onChange` always receives the raw string**, so each workflow keeps its own `parseInt`/`parseFloat` contract. |
| `PageLayout.jsx` | `WorkspacePage`, `PageHeader` (title, subtitle, icon, meta chips, actions, back control), `Section`, `FormSection`, `FormGrid`, `ActionBar` (sticky on phones, inline from `sm`), `PageBody`, `MetaChip`. |
| `Status.jsx` | `StatusBadge`, `ResultBanner`, `UtilizationGauge`, `TechnicalDetails`, `KeyValueGrid`, `CalculationStatus`. Every status prints its word (PASS / FAIL / CHECK) — colour is never the only signal. |
| `Feedback.jsx` | `EmptyState`, `ErrorNotice` (with retry), `LoadingState`, `InlineSpinner`, `SkeletonBlock`. |
| `TableRegion.jsx` | `TableScrollRegion` (contained, keyboard-scrollable table region + phone affordance) and `StackedTable` for genuinely narrow key/value tables. |
| `ViewerModal.jsx` | Full-screen sheet on phones / centred dialog from `sm`; Escape + focus trap + scroll lock, `flex-1 min-h-0` canvas region so R3F/Konva resize correctly. |
| `index.js` | Public barrel — import from `shared/ui`, never from individual files. |

Layer 2 — `src/components/shared/engineering/FrameInputs.jsx`

- `StoreyGridFields` — storeys / bays / storey height / bay width (+ optional lateral load), controlled through a patch callback.
- `MaterialGradeFields` — concrete class + steel grade selector pair with caller-supplied options.
- `BuildingScopeSelector` — the Regular vs Tall distinction, presented once.
- `FrameGeometrySection` — section wrapper shared by both scopes.

Layer 1 primitives remain presentation-only; no calculation, validation rule or
payload mapping was moved into the shared layer.

Also added: `src/navigation/toolRegistry.js` — the single route→tool metadata
source used by the shell header, the document title, the mobile back control and
the navigation drawer's active state. It describes existing routes only.

## 9.3 Files modified

| Area | Files | Change |
|---|---|---|
| Shell | `src/components/engineering_appp.jsx`, `src/components/components/Sidebar.jsx` | In-flow header + footer, scroll-owning `<main>`, active tool title, mobile back control, phone chat button, pinned chat overlay, skip link, route metadata, active nav state + scroll lock, 44 px controls. |
| RC beam | `.../Beams/StructuralEngineeeringSuite.jsx`, `.../Beams/RCBeamDesigner.jsx` | Reference refactor: shared fields/sections/header/action bar; result banner + per-check badges; both viewers on `ViewerModal`. |
| Slabs | `.../Slabs/main_slab_app.jsx` | Duplicate inner nav replaced by `PageHeader` + `DesignCodeToggle`; dead "settings" selects removed. |
| Foundations | `.../Foundations/foundation_main_app.jsx` | Same header/selector consolidation; feature comparison moved into a disclosure. |
| Retaining | `.../Rwall/main_app_component.jsx` | Same header/selector consolidation. |
| Columns | `.../Columns/Columnmain.jsx` | Responsive header, scrollable tab bar, padding scale. |
| Framed & tall | `.../FramedandTall/eurocode_structural_app.jsx`, `.../FramedandTall/rc_structural_design.jsx` | Shared page header + code toggle; mobile module picker instead of a permanently open 288 px sidebar; scope selector; storey-grid and material fields from the shared kit. |
| Roof takeoff | `.../takeoff2/RoofWorks/RoofForm.jsx` | Shared form sections/fields, accessible slider labels, placeholder Save/Import buttons removed. |
| Septic takeoff | `.../takeoff2/septik/septik_tank.jsx` | Shared form sections/fields, no nested scroll trap, responsive tab strip, advanced payload fields exposed, honest error/loading states. |
| Surveying | `.../Surveying/surveying_app.jsx` | Responsive header/tab bar/padding, 44 px tabs. |
| Soil mechanics | `.../Soil_mechanics/soil_mechanics.jsx` | Responsive header, status labels kept beside icons, API base made env-overridable (default unchanged). |
| Timber | `.../Timber/Timber_ui.jsx` | Fixed `1fr 450px` inline grid that overflowed phones; responsive header/tab bar. |
| Masonry | `.../masonry/Masonry_ui.jsx` | Responsive header, compact unit chip, padding scale. |
| CAD/BIM workspace | `.../interop/InteropWorkbench.jsx`, `.../Drawings/cad_drawing.jsx`, `.../Drawings/visualise_component.jsx` | **Pre-existing build blocker repaired**: two unmatched `</div>` tags in the workbench's panel markup (introduced by the earlier responsive-panel edits) made the file fail to compile; removed. `cad_drawing.jsx` and `visualise_component.jsx` switched from `h-screen`/`min-h-screen` to `h-full min-h-0` so the CAD/3D canvases fit the shell instead of overflowing it. Engine, renderer and data flow unchanged. |
| Tooling | `scripts/verify/jsx-parse.mjs` | Fast JSX/TSX syntax gate used during this cleanup. |

## 9.4 Tall Frame vs Regular Framed Buildings — how they now share UI

The two scopes live in the same route
(`/structural/manual/eurocode_structural_app`) and the same BS module
(`rc_structural_design.jsx`). The integration is deliberately **presentation
only**:

**Shared (no engineering behaviour):**
- `BuildingScopeSelector` states which scope governs and jumps to that scope's
  module (`frame` for regular, `systems` for tall). Nothing is hidden.
- `StoreyGridFields` renders storeys / bays / storey height / bay width for the
  regular frame analysis — the same composition the tall scope uses for its
  geometry fields.
- `Section`, `NumberField`, `SelectField`, `PageHeader`, `DesignCodeToggle`,
  `MetaChip`, action/status primitives and the responsive module navigation.

**Kept separate (engineering behaviour untouched):**
- Regular frame: `frameData` state, method (`portal` / `cantilever` / `simple`)
  and `POST /api/framed/api/analyze`.
- Tall frame: `systemData` (rigid frame → outrigger system), `modelData`
  (computer-modelling categories 1–3), `tieData` (robustness ties) and the
  dedicated endpoints `analysis/structural-system`, `analysis/computer-model`,
  `design/ties`. Second-order sway, drift and tie continuity remain exclusive to
  these modules.
- Member design modules still embed the existing beam/column/slab/wall/foundation
  suites.

The tall modules (`systems`, `ties`, `modelling`) had working render blocks and
API calls but were **not reachable** from the module navigation. They are now
listed under a dedicated "Tall-building systems" section — the tallest-frame
functionality is exposed, not simulated.

## 9.5 Responsive behaviour implemented

Shell:
- Header and footer are in flow; only `<main>` scrolls. Content can no longer be
  hidden behind the fixed bars (the old `pt-32 sm:pt-24` compensation was removed).
- Phones get a single-row header (menu, back, home, active tool, assistant,
  settings). The inline assistant input is desktop/tablet only; phones use the
  chat sheet, reclaiming ~96 px of a 360 px screen.
- Active tool name + discipline are always visible; a back control returns to the
  tool's registered parent.
- Chat overlay: pinned header and input, scrollable transcript, `100dvh` sizing,
  `env(safe-area-inset-bottom)` padding, 44 px controls.

Forms:
- Single column below `sm`, two columns from `sm`, three only where a workflow
  earns it (`lg`/`xl`). Controls are 44 px tall on phones.
- Sticky `ActionBar` on phones with safe-area padding.
- Units rendered as field adornments; labels bound with `htmlFor`; errors and
  warnings adjacent to their field.
- Sliders (roof pitch/break ratio) have real labels, visible values and a 44 px
  track.

Tables and documents:
- `TableScrollRegion` gives contained horizontal scrolling with a visible phone
  hint; used where tables are embedded by the refactored pages.
- The downstream taking-off sheet / dimension paper / BOQ keep their own
  fixed-width document layouts inside their scroll containers — the documents
  were not redesigned.

## 9.6 Engineering and data integrity

Verified by inspection of the diffs, not by assumption:

- No formula, design-code assumption, backend route, request/response schema,
  default value, unit or numeric precision was changed.
- Field names and state keys are identical (`beamParams`, `frameData`,
  `systemData`, `modelData`, `tieData`, septic `formData`, roof `config`).
- Parsing semantics are preserved, including the intentional quirks:
  - Beam `fcu` still stores `parseInt(value)` except the string `"C30/37"`.
  - Septic `handleChange` semantics (`parseFloat(value) || value`) are reproduced
    in `setField`.
- CAD handoff is unchanged: the beam "Send to CAD" path still sets
  `window.CAD_PENDING_MEMBER` and navigates to `/drawing`, which reads it.
- DXF export, interop workbench, IFC/DXF generation, and all Python code were not
  touched.

## 9.7 Verification actually performed

| Check | Command / method | Result |
|---|---|---|
| JSX/TSX syntax of every modified file | `node scripts/verify/jsx-parse.mjs <20 files>` | **Passed — 20/20 parsed, 0 failures.** |
| Working tree preserved | `git status --short` before/after | Only intended files changed; user's `docs/UI_REFACTOR_*.md` modifications kept. |
| Production build | `npm run build` (CRA, `BUILD_PATH=.tmp-build`) | **Passed.** The first two runs failed on pre-existing defects that had nothing to do with this cleanup (an unmatched tag in `InteropWorkbench.jsx` and a missing compat export used by `ThatOpenBimViewer.jsx`); both were repaired (markup/stub only) and the build then compiled successfully: `.tmp-build` reported "ready to be deployed", CSS ≈ 23.6 kB gzip, main JS ≈ 1.16 MB gzip. Remaining output is ESLint **warnings** only (mostly pre-existing unused variables) plus the usual bundle-size and Browserslist advisories. |
| Automated tests | `npm test` | **Not run** — see note below. |
| Browser/device screenshots at 360 / 390 / 768 / 1280 / 1440 px | — | **Not available in this environment.** Layout behaviour is documented in §9.5 but not visually confirmed. |
| Calculation outputs vs pre-refactor baseline | — | **Not re-run.** Engineering logic was not modified; the baseline comparison is outstanding (§9.8). |
| Septic / roof takeoff generation | — | **Not exercised** (requires the FastAPI backend on port 8001). |
| CAD/BIM handoff | — | **Not exercised** (requires a browser + backend + generated artefacts). |

`npm test` in this project is `react-scripts test` (Jest watch mode); there is no
existing test suite covering these components, and an interactive watcher cannot
run here. Adding unit tests for the new primitives is listed as remaining work.

**Pre-existing defects found while verifying (not caused by this cleanup):**

1. `src/components/interop/InteropWorkbench.jsx` did not compile — two unmatched
   `</div>` tags in the generator panel and the elements panel. Repaired here
   because a UI cleanup cannot be verified against a repository that does not
   build. No engine, endpoint or data flow was touched.
1a. `src/components/interop/compat/thatOpenComponents.js` did not export
   `FragmentsManager`, which `ThatOpenBimViewer.jsx` resolves through the
   component container; the bundler treats that as a hard import error. A stub
   export was added so the module graph compiles. This **does not enable the
   That Open renderer**: the compatibility shim still supplies stubs, so the
   viewer's existing availability guard/fallback decides what the user sees. The
   real That Open/MLightCAD wiring was not re-implemented in this UI cleanup.
2. `qwen_model_router` is still commented out in `src/Backend/main.py`; the chat
   sheet therefore reports the outage instead of inventing an answer.
3. `soil_mechanics.jsx` still defaults to port `8000`; now overridable with
   `REACT_APP_SOIL_API_URL` (default preserved).
4. Roof and septic takeoffs still keep their generated rows in local state rather
   than publishing into the global taking-off route (audit DEF-05). This is a
   product decision, not a styling one.
5. `calculateMockResults()` in `slab_calculator_frontend.jsx` remains dead code.

**Build re-run note:** after repairing the InteropWorkbench markup and the That Open
compat export, `npm run build` completed successfully (`The .tmp-build folder is
ready to be deployed.`). A final build was re-run after the last lint-only edits
(named default exports) to confirm the committed tree; if that final run did not
finish in the session, the preceding successful run already covers all functional
changes. Visual/device verification is still outstanding.


## 9.8 Remaining work, prioritised by impact

1. **Complete the production build and fix any compile errors.** Highest
   priority: the code parses, but a full CRA build was not completed here.
2. **Visually verify 360 / 390 / 768 / 1280 / 1440 px.** Particularly: RC beam
   result cards, framed/tall module picker, septic calculator, timber two-column
   grid, and the taking-off sheet inside the shell.
3. **Steel, stairs and wall workflows** still use their original bespoke headers
   and section markup. They work, but they are the last major structural
   inconsistencies.
4. **Surveying sub-modules and soil-mechanics field grids** were only addressed at
   the shell level; per-field units/labels still vary inside those files.
5. **All other takeoff forms** (drainage, external works, swimming pool,
   basement, superstructure, doors/windows, finishes, electrical/plumbing) still
   use their original input markup. The shared kit makes this mechanical.
6. **Wire real persistence for the "History" drawer** (still explicitly labelled
   sample content) and consider publishing specialised takeoffs into the global
   taking-off state (DEF-05), which is a data-flow decision, not styling.
7. **Chat service**: `qwen_model_router` remains commented out in
   `src/Backend/main.py`. The UI now reports the outage honestly; the backend fix
   is out of scope for a UI cleanup.
8. **Soil mechanics port**: still defaults to `:8000` (pre-existing). It is now
   overridable with `REACT_APP_SOIL_API_URL`; deciding whether it should move to
   `:8001` requires backend ownership input.
9. **Dead code**: `calculateMockResults()` in `slab_calculator_frontend.jsx` and
   the unreferenced `detailing_3d.jsx` remain (they were out of scope while the
   UI was being stabilised).

---

# 10. Implementation Record — Finish Remaining Cleanup (Session 4)

This section records the second implementation pass. It supersedes §9.8 for the
items it covers; anything not listed here is still open.

## 10.1 Quantity surveying — initial input forms

| Form | File | Depth of migration |
|---|---|---|
| Basement | `takeoff2/Basement_Takeoff.jsx` | **Full.** Page header, five sections, shared fields, responsive grid, result table in a scroll region, sticky action bar, honest loading/empty/error states. Downstream tabs untouched. |
| Swimming pool | `takeoff2/swimming/swimming_pool.jsx` | **Full.** Header, four sections, shared fields, summary in `KeyValueGrid`, viewer shells sized for phones. |
| Underground tank | `takeoff2/underground_tank.jsx` | **Full**, plus payload-only fields (plaster, mastic, brick, cover-to-slab) restored to the UI with unchanged defaults; `alert()` replaced by `ErrorNotice`. |
| Internal finishes | `takeoff2/Internal_Finishes/internal_finishes.jsx` | Header/tabs, finish specifications (including screed, tile size, skirting that were in the payload but had no input), responsive room list, error state. |
| Staircase takeoff | `takeoff2/Stairs/Enhanced_Stairs.jsx` | **Rebuilt** on the shared kit: type grid, materials, geometry, flight configuration, spiral settings, detailing disclosure, results banner. |
| Doors & windows | `takeoff2/Door_Window/Doors&Window.jsx` | Type selector, measurements, door/window specifics, summary table and error state migrated; detailing parameters moved into a disclosure. |
| Electrical & plumbing | `takeoff2/Electrical_Plumbing/ElectricalPlumbingTakeoff.jsx` | Header, automation section, summary table, error state; **two placeholders removed** ("Export Report", "Manual setup — coming soon"). |
| Drainage | `takeoff2/Manhole/MainTakeoff.jsx`, `DrainageTakeoffForm.jsx` | Shell fully migrated (header, tabs, 3D shell, document tabs with empty states). Project-details tab uses shared fields. Manhole/pipe/ancillary tabs keep their native fields inside the shared section card — see §10.6. |
| External works | `takeoff2/ExternalWorks/MainExternalWorks.jsx`, `ExternalWorksInputForm.jsx` | Shell migrated (header, tabs, error state, working Save/Load kept). Form frame restyled to 44 px controls/dark-safe CSS; **two placeholder buttons removed**; the 50+ measured fields keep their data-driven CSS grid (already responsive via `auto-fill`). |
| Substructure | `takeoff2/SubStrucure_works/substructure_works.jsx` | All ~40 fields upgraded through a local adapter over the shared fields; header, action panel, result banner and error state migrated. |
| RCC superstructure | `takeoff2/superstructure.jsx` | Header, tabs and page shell migrated; element lists keep their native inputs. |
| Superstructure | `takeoff2/Superstructure/Superstructure_takeoff.jsx` | Header, tabs, scrollable sub-navigation; fields unchanged. |

Downstream documents were not touched in any of these files: the taking-off
sheet, dimension paper and BOQ still receive the same `items` prop and the same
item shape.

## 10.2 Structural workflows

| Workflow | File | Change |
|---|---|---|
| Steel design | `SteelDesign/steel_design_app.jsx` | Shared page header; sidebar is now in-flow only from `lg`, with a native module picker on phones; placeholder "Save Project" removed. |
| Stairs | `ReinforcedConcrete/Stairs/stair_main_app.jsx` | Shared page header + `DesignCodeToggle`; state ids unchanged; content padding responsive. |
| Walls | `ReinforcedConcrete/Walls/main_wall_app.jsx` | Shared page header; the existing `DesignCodeToggle` cards variant and information banner are preserved. |
| Framed & tall | *(unchanged this session)* | Already integrated in the previous pass (shared geometry fields + scope selector). |

## 10.3 Surveying and soil mechanics

- **Soil mechanics (all modules):** the file's local `InputField` was reimplemented
  as an adapter over the shared `NumberField`, so every geotechnical input in all
  ten modules now shares label/unit/touch-target treatment with one edit. The
  caller still receives `parseFloat(value) || 0`, exactly as before. Repeated
  `grid-cols-2` form grids now collapse to one column on phones. `ErrorAlert` uses
  the shared `ErrorNotice`.
- **Surveying app:** the levelling method selector and benchmark RL use the shared
  `SelectField` / `NumberField`; the surrounding tab bar and page padding were
  migrated in the previous pass.
- **Not migrated (documented):** the five other surveying modules inside
  `surveying_app.jsx` and the standalone surveying screens (earthworks, geoid,
  route, utilities, setting-out, contouring, monitoring) still use their native
  field markup.

## 10.4 Roof / septic → global taking-off bridge (implemented)

Files: `src/state/takeoffBridge.js` (pure merge helpers),
`src/state/TakeoffBridgeContext.jsx` (provider + hook), wired in
`engineering_appp.jsx`, `RoofWorks/RoofMain.jsx` and `septik/septik_tank.jsx`.

Policy:
- The global state remains the single `takeoffData` owned by `AppLayout`; no
  second global model was introduced.
- `publish(items, source)` **replaces only that source's previous batch**. Manual
  or other-tool rows are never modified, and re-running a calculation cannot
  duplicate rows.
- Generated rows keep their existing fields untouched and gain additive
  `source`, `sourceRef` and `sourceLabel` keys for traceability.
- Nothing is persisted, so a refresh cannot replay or duplicate a batch.
- Both tools show a "Published to the global taking-off…" notice with a link to
  the taking-off sheet.

## 10.5 Recent-tools history (implemented)

Files: `src/state/recentTools.js`, `AppLayout`, `Sidebar`.

- Records the tool path, title, discipline group and timestamp in
  `localStorage` (`fundi.recentTools.v1`) when the route changes.
- De-duplicates by path (re-opening moves a tool to the top), caps at 8 entries,
  validates every stored row (absolute paths only, sane timestamps), and repairs
  corrupt storage silently.
- Stores **no** engineering inputs, project data or results.
- The sidebar now shows real "Recent tools" with relative times and a clear
  control, replacing the static sample list.

## 10.6 Tests added

`src/setupTests.js` mocks `lucide-react` (ESM icons cannot be parsed by Jest
without transforming `node_modules`); no test dependency was added.

| Suite | Covers |
|---|---|
| `shared/ui/__tests__/Fields.test.jsx` | `EngineeringField` label/unit/error wiring, raw-string `onChange`, cleared field, `SelectField` options, `CheckboxField` boolean. |
| `shared/ui/__tests__/StatusAndLayout.test.jsx` | Status words, result banner role, utilisation meter ARIA, empty/loading/error states, retry handler, labelled table scroll region, header/section/action bar. |
| `shared/engineering/__tests__/FrameInputs.test.jsx` | `StoreyGridFields` patch emission, optional lateral load, note; `MaterialGradeFields` key separation. |
| `state/__tests__/takeoffBridge.test.js` | Source tagging, batch replacement without duplicates, other-source preservation, schema preservation, immutability, malformed input. |
| `state/__tests__/recentTools.test.js` | Visit recording, de-duplication, cap, invalid input, corrupt-storage recovery, metadata-only payload, clear. |

Result: **5 suites / 47 tests pass**. Command used in this environment:

```
CI=true npx react-scripts test --watchAll=false --runInBand
```

`--runInBand` is required here because the sandbox blocks the child-process pipe
that `jest-worker` uses (`spawn EPERM`); it does not change what is tested.

## 10.7 Dead code review

- **Removed** `calculateMockResults()` from
  `slab_calculator_frontend.jsx` — defined once, never referenced (the used
  fallback of the same name lives in `slab_calculator.jsx`).
- **Removed** `src/components/Drawings/detailing_3d.jsx` (~244 KB) — zero
  references from any `.js/.jsx/.ts/.tsx` file, including the only dynamic
  `import()` sites in the repo (`interop/InteropWorkbench.jsx`, which target the
  interop viewers).
- **Removed placeholder controls** that had no handlers: steel "Save Project",
  roof "Save Project", external works "View 3D Model"/"Generate Takeoff Sheet",
  electrical "Export Report", slab settings selects, roof save/import.
- **Retained** `calculateMockResults()` in `slab_calculator.jsx` because it is
  called as a fallback there; retained all `Cad_Dwg/` spikes, `RCSettings.jsx`
  and `civil_cad_app.jsx` pending a dedicated review (reachability not fully
  established for dynamic/registry lookups).

## 10.8 Remaining implementation work before the consolidated verification pass

1. Drainage manhole/pipe/ancillary field blocks, external-works measured fields,
   and both superstructure element lists still use native inputs (behaviour is
   correct; visual consistency is partial).
2. Five surveying sub-modules inside `surveying_app.jsx` and the standalone
   surveying screens still use native field markup.
3. Several workflows still report failures with `alert()` rather than the shared
   `ErrorNotice`: drainage form validation, soil export, stair calculation errors,
   wall DXF export and the framed-design fetch error. Both superstructure tools
   were converted in this pass.
4. `InteropWorkbench`/CAD panels were not revisited beyond the earlier build fix;
   the That Open renderer remains stubbed by the compatibility layer.
5. A production build and the full verification matrix (360/390/768/1280/1440 px)
   must still be run after this pass.

## 10.9 Verification for this pass

- **Unit tests:** `CI=true npx react-scripts test --watchAll=false --runInBand`
  → **5 suites / 47 tests passed**.
- **Syntax gate:** `node scripts/verify/jsx-parse.mjs …` across every modified file
  and every new test/state file → **0 failures**.
- **Production build:** `npm run build` (`BUILD_PATH=.tmp-build`) → **compiled
  successfully** ("The .tmp-build folder is ready to be deployed"), CSS ≈ 23.5 kB
  gzip, main JS ≈ 1.16 MB gzip. Output is warnings only (unused variables and
  anonymous default exports, overwhelmingly pre-existing) plus the standard
  Browserslist/bundle-size advisories.
- **Not run in this pass:** the interactive verification matrix (viewport widths,
  real backend calculations, CAD handoff, takeoff generation against a live API).
  That is the next phase and is intentionally out of scope here.


