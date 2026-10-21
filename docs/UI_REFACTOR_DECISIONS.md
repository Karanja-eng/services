# Fundi Studio UI Refactor — Decision Log

**Branch:** `feature/cad-bim-ifc-integration`

---

## DEC-001 — DesignCodeToggle: Controlled prop design

**Date:** 2026-10-21  
**Decision:** The component is a pure controlled component. It accepts `value`, `onChange`, `options`, `variant`, `isDark`, `disabled`.  
**Rationale:** The state identifiers (`"BS8110"`, `"Eurocode"`, `"bs"`, `"eurocode"`) differ between consumers. Hard-coding them inside the component would either force uniformity across the codebase (breaking existing API payloads) or require separate component variants. Controlled props allow each consumer to keep its own domain identifiers unchanged.  
**Consequence:** Zero-risk migration — no calculation dispatch, backend endpoint, or payload is touched.

---

## DEC-002 — DesignCodeToggle: Three visual variants

**Date:** 2026-10-21  
**Decision:** Added `variant` prop: `"default"` (segmented pill), `"compact"` (smaller pill), `"cards"` (rich card grid with icon+sublabel).  
**Rationale:**  
- RC Beam uses a narrow pill in the header — `default` is appropriate.  
- RC Wall uses large full-width cards with icons — `cards` is appropriate.  
- A single multi-variant component avoids two separate components that would diverge over time.

---

## DEC-003 — DesignCodeToggle: `activeColor` per option

**Date:** 2026-10-21  
**Decision:** Each option in the `cards` variant accepts an optional `activeColor` Tailwind gradient string (e.g., `"from-teal-500 to-teal-600"`).  
**Rationale:** Wall's BS tab uses teal; Eurocode tab uses blue. These brand colours must be preserved per the existing design. Forcing a single global active colour would change the visual identity of the wall module.

---

## DEC-004 — Do not touch calculation-dispatch state

**Date:** 2026-10-21  
**Decision:** The `id` values passed in the `options` array must match **exactly** the values already held in each consumer's state. The component must not transform, normalise, or alias them.  
**Rationale:** These strings are compared inside `if (activeCode === "BS8110")` branches and forwarded to backend payloads and API endpoint paths. Any alteration would silently change calculation routing.
