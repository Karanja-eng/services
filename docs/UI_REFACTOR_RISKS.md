# Fundi Studio UI Refactor — Risk Register

**Branch:** `feature/cad-bim-ifc-integration`

---

## RISK-A — Calculation dispatch silently broken by state-value change

**Likelihood:** Medium if not careful | **Impact:** Critical  
**Mitigation:** `DesignCodeToggle` is controlled; `id` values in `options` are set by the consumer, not the component. The component never transforms them.  
**Status:** Mitigated — by design.

---

## RISK-B — `isDark` prop missing in some consumer contexts

**Likelihood:** Low | **Impact:** Low (cosmetic — toggle renders in wrong colour mode)  
**Mitigation:** `isDark` defaults to `false` in the component. All existing consumers already pass `isDark`.  
**Status:** Acceptable.

---

## RISK-C — Tall Frame P-Δ and drift logic accidentally generalised

**Likelihood:** Low (no changes made to Tall Frame) | **Impact:** Critical  
**Mitigation:** Tall Frame (`rc_structural_design.jsx` + `tall_framed_backend.py`) has not been touched. Its $P$-$\Delta$ 2nd-order analysis, $H/500$ drift limit, outrigger/core/tube logic, EN 1991-1-4 dynamic wind, and vertical tie checks remain isolated.  
**Status:** Not applicable to current session.

---

## RISK-D — SMM7 dimension paper / BOQ measurement replaced by generic UI

**Likelihood:** Low (no changes made to QS) | **Impact:** High  
**Mitigation:** `EnglishMethodTakeoffSheet`, `UniversalSheet`, `UniversalBOQ` not touched.  
**Status:** Not applicable to current session.

---

## RISK-E — `DesignCodeToggle` cards variant breaks wall's teal/blue branding

**Likelihood:** Low | **Impact:** Low-Medium (visual regression)  
**Mitigation:** Each option accepts `activeColor` (Tailwind gradient string). BS option uses `from-teal-500 to-teal-600`; Eurocode uses `from-blue-500 to-blue-600` — identical to the original hardcoded values.  
**Status:** Mitigated.

---

## RISK-F — Port 8000 vs 8001 confusion

**Likelihood:** Medium (existing code discrepancy) | **Impact:** Medium  
**Mitigation:** Port 8001 is the main backend (`main.py`). Port 8000 appears in `soil_mechanics.jsx` and `cad_drawing.jsx` AI copilot only. No ports were changed in this session.  
**Status:** Documented. Not fixed in this session.
