
from __future__ import annotations
import sys, os, math

# ── Ensure bs5628 module is importable ────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_OUTPUTS = os.path.join(_HERE, ".")
for _p in [_HERE, _OUTPUTS]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    import masonry_design as _m
except ModuleNotFoundError:
    raise RuntimeError(
        "bs5628_masonry_design.py not found. "
        "Place masonry_api.py in the same directory as bs5628_masonry_design.py."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Helper: unit conversion — API accepts kN/m, N/mm² etc.; module works in N,mm
# ─────────────────────────────────────────────────────────────────────────────

def _kN_per_m_to_N_per_mm(v: float) -> float:
    """kN/m → N/mm  (per mm run of wall, same thing)"""
    return v * 1000.0 / 1000.0   # kN/m = 1 N/mm

def _kN_per_m2_to_N_per_mm2(v: float) -> float:
    """kN/m² → N/mm²  (wind pressure conversion)"""
    return v / 1000.0             # 1 kN/m² = 0.001 N/mm²

def _N_per_mm2_to_kN_per_m2(v: float) -> float:
    return v * 1000.0


# ─────────────────────────────────────────────────────────────────────────────
# Core design wrappers — called by both FastAPI and Flask routes
# ─────────────────────────────────────────────────────────────────────────────

def run_vertical_wall(d: dict) -> dict:
    """
    Design a vertically loaded unreinforced masonry wall.

    Input dict keys (all required unless noted):
      wall_type          : "single_leaf" | "cavity"
      t_mm               : leaf / inner leaf thickness (mm)
      clear_height_mm    : clear height between lateral supports (mm)
      resistance_type    : "enhanced" | "simple"
      unit_category      : "I" | "II"
      construction_control: "special" | "normal"
      eccentricity       : 0.05 | 0.1 | 0.2 | 0.3  (fraction of t)
      wall_length_mm     : wall length for plan area calc (mm)
      Gk_kN_per_m        : characteristic dead load (kN/m run of wall)
      Qk_kN_per_m        : characteristic imposed load (kN/m run of wall)
      is_brick_wall      : true/false
      has_piers          : true/false
      K                  : stiffness coefficient (default 1.0)
      t2_mm              : outer leaf for cavity walls (mm, default 0)
    """
    try:
        wt     = d.get("wall_type", "single_leaf")
        t      = float(d["t_mm"])
        h      = float(d["clear_height_mm"])
        res    = d.get("resistance_type", "enhanced")
        ucat   = d.get("unit_category", "II")
        cc     = d.get("construction_control", "normal")
        ex     = float(d.get("eccentricity", 0.05))
        wlen   = float(d.get("wall_length_mm", 3000))
        Gk     = float(d["Gk_kN_per_m"])
        Qk     = float(d["Qk_kN_per_m"])
        brick  = bool(d.get("is_brick_wall", True))
        piers  = bool(d.get("has_piers", False))
        K      = float(d.get("K", 1.0))
        t2     = float(d.get("t2_mm", 0.0))
        is_cav = wt == "cavity"

        # ULS load (kN/m = N/mm)
        N_ult = _m.ultimate_design_load_dead_imposed(Gk, Qk)  # kN/m run = N/mm

        result = _m.design_vertical_wall(
            N_ultimate           = N_ult,
            t_mm                 = t,
            clear_height_mm      = h,
            resistance_type      = res,
            unit_category        = ucat,
            construction_control = cc,
            ex_fraction_of_t     = ex,
            wall_length_mm       = wlen,
            is_brick_wall        = brick,
            has_piers            = piers,
            K                    = K,
            t2_mm                = t2,
            is_cavity            = is_cav,
        )

        # Enrich with input echo and pass/fail narrative
        result["inputs"] = {
            "wall_type": wt, "t_mm": t, "clear_height_mm": h,
            "resistance_type": res, "unit_category": ucat,
            "construction_control": cc, "eccentricity": ex,
            "Gk_kN_per_m": Gk, "Qk_kN_per_m": Qk,
            "N_ultimate_N_per_mm": round(N_ult, 3),
            "has_piers": piers, "K": K, "is_cavity": is_cav,
        }
        result["SR_limit"] = 27
        result["SR_pass"]  = result["SR"] <= 27
        result["load_combination"] = "1.4Gk + 1.6Qk  (BS 5628 Eq.5.3)"
        result["design_standard"] = "BS 5628: Part 1"
        return result

    except (KeyError, TypeError) as e:
        return {"error": f"Missing or invalid input: {e}"}
    except ValueError as e:
        return {"error": str(e)}


def run_lateral_panel(d: dict) -> dict:
    """
    Design a laterally loaded unreinforced masonry panel.

    Input dict keys:
      panel_height_mm    : panel height h (mm)
      panel_length_mm    : panel length L (mm)
      wall_thickness_mm  : wall thickness t (mm)
      mortar_designation : "i" | "ii" | "iii" | "iv"
      unit_type          : "clay" | "calcium_silicate" | "concrete_block"
      water_absorption   : "lt7" | "7to12" | "gt12"  (clay bricks only)
      panel_type         : "A" | "C" | "E"
      num_supported_edges: 3 | 4
      continuous_edges   : number of continuous edges (int)
      Wk_kN_per_m2       : characteristic wind pressure (kN/m²)
      gamma_f            : load partial factor (default 1.4)
      unit_category      : "I" | "II"
      construction_control: "special" | "normal"
      block_thickness_mm : (blockwork only, for fkx lookup)
      block_strength     : (blockwork only, N/mm²)
    """
    try:
        ph    = float(d["panel_height_mm"])
        pl    = float(d["panel_length_mm"])
        t     = float(d["wall_thickness_mm"])
        mort  = d.get("mortar_designation", "ii")
        utype = d.get("unit_type", "clay")
        wa    = d.get("water_absorption", "lt7")
        ptype = d.get("panel_type", "A")
        nsup  = int(d.get("num_supported_edges", 4))
        cont  = int(d.get("continuous_edges", 1))
        Wk_kN = float(d["Wk_kN_per_m2"])
        gf    = float(d.get("gamma_f", 1.4))
        ucat  = d.get("unit_category", "II")
        cc    = d.get("construction_control", "normal")

        Wk = _kN_per_m2_to_N_per_mm2(Wk_kN)

        # γm for flexure (flexure γm does not depend on unit_category in BS 5628)
        gm = _m.gamma_m_flexure(cc)

        # Flexural strengths
        if utype == "clay":
            fkx_par, fkx_perp = _m.fkx_clay_brick(wa, mort)
        elif utype == "calcium_silicate":
            fkx_par, fkx_perp = _m.fkx_calcium_silicate_brick(mort)
        else:  # concrete_block
            bt  = float(d.get("block_thickness_mm", t))
            bst = float(d.get("block_strength", 7.3))
            fkx_par, fkx_perp = _m.fkx_concrete_block(bst, mort, bt)

        mu    = _m.orthogonal_ratio(fkx_par, fkx_perp)
        alpha = _m.bending_moment_coefficient_alpha(mu, ph / pl, ptype)

        result = _m.design_lateral_panel(
            panel_height_mm     = ph,
            panel_length_mm     = pl,
            wall_thickness_mm   = t,
            fkx_par             = fkx_par,
            fkx_perp            = fkx_perp,
            mu                  = mu,
            alpha               = alpha,
            Wk                  = Wk,
            gamma_f             = gf,
            gamma_m             = gm,
            panel_type          = ptype,
            num_supported_edges = nsup,
            continuous_edges    = cont,
        )

        # Augment with human-readable values
        result["inputs"] = {
            "panel_height_mm": ph, "panel_length_mm": pl,
            "wall_thickness_mm": t, "mortar": mort,
            "unit_type": utype, "panel_type": ptype,
            "Wk_kN_per_m2": Wk_kN, "gamma_f": gf, "gamma_m": gm,
        }
        result["fkx_par_N_mm2"]  = fkx_par
        result["fkx_perp_N_mm2"] = fkx_perp
        result["mu"]             = round(mu, 4)
        result["alpha"]          = round(alpha, 5)
        result["h_over_L"]       = round(ph / pl, 4)
        result["Mperp_kNm_per_m"] = round(result["Mperp_N_mm_per_mm_run"] / 1000.0, 4)
        result["Mpar_kNm_per_m"]  = round(result["Mpar_N_mm_per_mm_run"]  / 1000.0, 4)
        result["Mk_perp_kNm_per_m"] = round(result["Mk_perp_N_mm_per_mm_run"] / 1000.0, 4)
        result["Mk_par_kNm_per_m"]  = round(result["Mk_par_N_mm_per_mm_run"]  / 1000.0, 4)
        result["overall_pass"] = bool(result["perp_OK"] and result["par_OK"])
        result["design_standard"] = "BS 5628: Part 1"
        return result

    except (KeyError, TypeError) as e:
        return {"error": f"Missing or invalid input: {e}"}
    except ValueError as e:
        return {"error": str(e)}


def run_max_wind(d: dict) -> dict:
    """
    Back-calculate the maximum wind pressure a panel can resist.
    Same inputs as lateral_panel (excluding Wk).
    """
    try:
        ph    = float(d["panel_height_mm"])
        pl    = float(d["panel_length_mm"])
        t     = float(d["wall_thickness_mm"])
        mort  = d.get("mortar_designation", "ii")
        utype = d.get("unit_type", "clay")
        wa    = d.get("water_absorption", "lt7")
        ptype = d.get("panel_type", "A")
        nsup  = int(d.get("num_supported_edges", 4))
        cont  = int(d.get("continuous_edges", 1))
        gf    = float(d.get("gamma_f", 1.4))
        ucat  = d.get("unit_category", "II")
        cc    = d.get("construction_control", "normal")

        gm = _m.gamma_m_flexure(cc)

        if utype == "clay":
            fkx_par, fkx_perp = _m.fkx_clay_brick(wa, mort)
        elif utype == "calcium_silicate":
            fkx_par, fkx_perp = _m.fkx_calcium_silicate_brick(mort)
        else:
            bt  = float(d.get("block_thickness_mm", t))
            bst = float(d.get("block_strength", 7.3))
            fkx_par, fkx_perp = _m.fkx_concrete_block(bst, mort, bt)

        mu    = _m.orthogonal_ratio(fkx_par, fkx_perp)
        alpha = _m.bending_moment_coefficient_alpha(mu, ph / pl, ptype)

        res = _m.max_wind_pressure_two_way_panel(
            alpha, mu, fkx_par, fkx_perp,
            t, pl, gf, gm,
            use_perp_direction=True,
        )
        return {
            "Wk_max_N_per_mm2":  res,
            "Wk_max_kN_per_m2":  round(_N_per_mm2_to_kN_per_m2(res), 4),
            "fkx_par":  fkx_par,
            "fkx_perp": fkx_perp,
            "mu":       round(mu, 4),
            "alpha":    round(alpha, 5),
            "gamma_m":  gm,
            "design_standard": "BS 5628: Part 1",
        }
    except (KeyError, TypeError) as e:
        return {"error": f"Missing or invalid input: {e}"}
    except ValueError as e:
        return {"error": str(e)}


def lookup_fk_brickwork(unit_strength: float, mortar: str) -> dict:
    try:
        fk = _m.fk_brickwork(unit_strength, mortar)
        return {"fk_N_per_mm2": fk, "unit_strength": unit_strength, "mortar": mortar}
    except Exception as e:
        return {"error": str(e)}


def lookup_fk_blockwork(
    block_height_mm: float,
    block_least_dim_mm: float,
    unit_strength: float,
    mortar: str,
    formed_voids_pct: float = 0.0,
) -> dict:
    try:
        fk = _m.fk_blockwork(block_height_mm, block_least_dim_mm,
                              unit_strength, mortar, formed_voids_pct)
        return {
            "fk_N_per_mm2": fk,
            "ht_ratio": round(block_height_mm / block_least_dim_mm, 3),
            "unit_strength": unit_strength,
            "mortar": mortar,
            "formed_voids_pct": formed_voids_pct,
        }
    except Exception as e:
        return {"error": str(e)}


def lookup_fkx(
    unit_type: str,
    mortar: str,
    direction: str,
    water_absorption: str = "lt7",
    block_thickness_mm: float = 100,
    block_strength: float = 7.3,
    block_type: str = "solid",
) -> dict:
    try:
        if unit_type == "clay":
            par, perp = _m.fkx_clay_brick(water_absorption, mortar)
        elif unit_type == "calcium_silicate":
            par, perp = _m.fkx_calcium_silicate_brick(mortar)
        else:
            par, perp = _m.fkx_concrete_block(block_strength, mortar, block_thickness_mm)
        v = perp if direction == "perp" else par
        return {"fkx_N_per_mm2": v, "direction": direction, "unit_type": unit_type}
    except Exception as e:
        return {"error": str(e)}


def lookup_alpha(mu: float, h_over_L: float, panel_type: str) -> dict:
    try:
        a = _m.bending_moment_coefficient_alpha(mu, h_over_L, panel_type)
        return {"alpha": a, "mu": mu, "h_over_L": h_over_L, "panel_type": panel_type}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────
try:
    from fastapi import FastAPI, HTTPException, Query,APIRouter
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
    from typing import Optional, Literal as Lit

    router = APIRouter()

    class VerticalWallRequest(BaseModel):
        wall_type:            str   = Field("single_leaf",  description="single_leaf | cavity")
        t_mm:                 float = Field(..., gt=0,       description="Wall / inner-leaf thickness (mm)")
        clear_height_mm:      float = Field(..., gt=0,       description="Clear storey height (mm)")
        resistance_type:      str   = Field("enhanced",     description="enhanced | simple")
        unit_category:        str   = Field("II",            description="I | II")
        construction_control: str   = Field("normal",       description="special | normal")
        eccentricity:         float = Field(0.05,           description="Eccentricity fraction (0.05/0.1/0.2/0.3)")
        wall_length_mm:       float = Field(3000, gt=0,     description="Wall length (mm)")
        Gk_kN_per_m:          float = Field(..., ge=0,       description="Characteristic dead load (kN/m run)")
        Qk_kN_per_m:          float = Field(..., ge=0,       description="Characteristic imposed load (kN/m run)")
        is_brick_wall:        bool  = Field(True)
        has_piers:            bool  = Field(False)
        K:                    float = Field(1.0, gt=0,      description="Pier stiffness coefficient")
        t2_mm:                float = Field(0.0,            description="Outer leaf thickness for cavity (mm)")

    class LateralPanelRequest(BaseModel):
        panel_height_mm:     float = Field(..., gt=0)
        panel_length_mm:     float = Field(..., gt=0)
        wall_thickness_mm:   float = Field(..., gt=0)
        mortar_designation:  str   = Field("ii",  description="i | ii | iii | iv")
        unit_type:           str   = Field("clay",description="clay | calcium_silicate | concrete_block")
        water_absorption:    str   = Field("lt7", description="lt7 | 7to12 | gt12  (clay only)")
        panel_type:          str   = Field("A",   description="A | C | E")
        num_supported_edges: int   = Field(4,     description="3 or 4")
        continuous_edges:    int   = Field(1)
        Wk_kN_per_m2:        float = Field(..., ge=0, description="Characteristic wind pressure (kN/m²)")
        gamma_f:             float = Field(1.4)
        unit_category:       str   = Field("II")
        construction_control:str   = Field("normal")
        block_thickness_mm:  float = Field(100.0)
        block_strength:      float = Field(7.3,  description="Block compressive strength (N/mm²)")
        block_type:          str   = Field("solid", description="solid | hollow")

    class MaxWindRequest(BaseModel):
        panel_height_mm:     float = Field(..., gt=0)
        panel_length_mm:     float = Field(..., gt=0)
        wall_thickness_mm:   float = Field(..., gt=0)
        mortar_designation:  str   = Field("ii")
        unit_type:           str   = Field("clay")
        water_absorption:    str   = Field("lt7")
        panel_type:          str   = Field("A")
        num_supported_edges: int   = Field(4)
        continuous_edges:    int   = Field(1)
        gamma_f:             float = Field(1.4)
        unit_category:       str   = Field("II")
        construction_control:str   = Field("normal")
        block_thickness_mm:  float = Field(100.0)
        block_strength:      float = Field(7.3)
        block_type:          str   = Field("solid")

    @router.post("/design/vertical_wall", summary="BS 5628 §5.5 — Vertical wall design")
    def api_vertical(req: VerticalWallRequest):
        r = run_vertical_wall(req.dict())
        if "error" in r:
            raise HTTPException(status_code=422, detail=r["error"])
        return r

    @router.post("/design/lateral_panel", summary="BS 5628 §5.6 — Lateral panel design")
    def api_lateral(req: LateralPanelRequest):
        r = run_lateral_panel(req.dict())
        if "error" in r:
            raise HTTPException(status_code=422, detail=r["error"])
        return r

    @router.post("/design/max_wind", summary="BS 5628 §5.6 — Maximum wind pressure back-calculation")
    def api_max_wind(req: MaxWindRequest):
        r = run_max_wind(req.dict())
        if "error" in r:
            raise HTTPException(status_code=422, detail=r["error"])
        return r

    @router.get("/lookup/fk_brickwork")
    def api_fk_brick(
        unit_strength: float = Query(..., description="Brick unit compressive strength (N/mm²)"),
        mortar: str          = Query(..., description="Mortar designation i | ii | iii | iv"),
    ):
        return lookup_fk_brickwork(unit_strength, mortar)

    @router.get("/lookup/fk_blockwork")
    def api_fk_block(
        block_height_mm:   float = Query(...),
        block_least_dim_mm:float = Query(...),
        unit_strength:     float = Query(...),
        mortar:            str   = Query(...),
        formed_voids_pct:  float = Query(0.0),
    ):
        return lookup_fk_blockwork(block_height_mm, block_least_dim_mm,
                                   unit_strength, mortar, formed_voids_pct)

    @router.get("/lookup/fkx")
    def api_fkx(
        unit_type:          str   = Query("clay"),
        mortar:             str   = Query("ii"),
        direction:          str   = Query("perp",  description="perp | par"),
        water_absorption:   str   = Query("lt7"),
        block_thickness_mm: float = Query(100.0),
        block_strength:     float = Query(7.3),
        block_type:         str   = Query("solid"),
    ):
        return lookup_fkx(unit_type, mortar, direction,
                          water_absorption, block_thickness_mm, block_strength, block_type)

    @router.get("/lookup/alpha")
    def api_alpha(
        mu:         float = Query(..., description="Orthogonal ratio µ"),
        h_over_L:   float = Query(..., description="Panel h/L ratio"),
        panel_type: str   = Query("A", description="Panel type A | C | E"),
    ):
        return lookup_alpha(mu, h_over_L, panel_type)

    @router.get("/health")
    def api_health():
        return {"status": "ok", "service": "bs5628-masonry-api", "version": "1.0.0"}

except ImportError:
    app = None   # FastAPI not installed — Flask fallback below



# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
