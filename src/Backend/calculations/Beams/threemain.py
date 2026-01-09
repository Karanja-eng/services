"""
Three-Moment Theorem Analysis Module
Pure structural analysis, decoupled from material-specific design logic.
"""

from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import numpy as np
import math

router = APIRouter()

# ============================================================================
# ANALYSIS MODELS
# ============================================================================

class SupportType(Enum):
    FIXED = "Fixed"
    PINNED = "Pinned"
    SIMPLY_SUPPORTED = "Simply Supported"
    FREE = "Free"


class LoadType(Enum):
    POINT = "Point Load"
    UDL = "Uniformly Distributed Load"
    PARTIAL_UDL = "Partial Uniformly Distributed Load"
    TRIANGULAR = "Triangular Load"
    TRAPEZOIDAL = "Trapezoidal Load"


class Load(BaseModel):
    load_type: LoadType
    magnitude: float
    position: float = 0.0
    length: float = 0.0
    magnitude2: float = 0.0


class Support(BaseModel):
    support_type: SupportType
    position: float


class Span(BaseModel):
    length: float
    E: float = 200e9
    I: float = 1e-6
    loads: List[Load] = Field(default_factory=list)


class BeamModel(BaseModel):
    spans: List[Span]
    supports: List[Support]


# ============================================================================
# THREE-MOMENT THEOREM SOLVER
# ============================================================================

class ThreeMomentSolver:
    """Complete Three-Moment Theorem solver"""

    def __init__(self, spans: List[Span], supports: List[Support]):
        self.spans = [self._convert_span(span) for span in spans]
        self.supports = [self._convert_support(support) for support in supports]
        self.n_spans = len(spans)
        self.support_moments = [0.0] * (self.n_spans + 1)
        self.reactions = [0.0] * (self.n_spans + 1)
        self.equations_used = []

    def _convert_span(self, span: Span):
        internal_span = type("Span", (), {})()
        internal_span.length = span.length
        internal_span.E = span.E
        internal_span.I = span.I
        internal_span.EI = span.E * span.I
        internal_span.loads = [self._convert_load(load) for load in span.loads]
        return internal_span

    def _convert_load(self, load: Load):
        internal_load = type("Load", (), {})()
        internal_load.load_type = load.load_type
        internal_load.magnitude = load.magnitude
        internal_load.position = load.position
        internal_load.length = load.length if load.load_type != LoadType.UDL else 0
        internal_load.magnitude2 = load.magnitude2
        return internal_load

    def _convert_support(self, support: Support):
        internal_support = type("Support", (), {})()
        internal_support.support_type = support.support_type
        internal_support.position = support.position
        return internal_support

    def solve(self):
        self._solve_three_moment_equations()
        self._calculate_reactions()

    def _solve_three_moment_equations(self):
        self.equations_used.append(
            "Three-Moment Theorem: M_i*L_i + 2*M_{i+1}*(L_i + L_{i+1}) + M_{i+2}*L_{i+1} = -6*(A_i/L_i + A_{i+1}/L_{i+1})"
        )

        for i, support in enumerate(self.supports):
            if support.support_type in [SupportType.PINNED, SupportType.SIMPLY_SUPPORTED]:
                self.support_moments[i] = 0.0

        if self.n_spans == 1:
            self._solve_single_span()
        else:
            self._solve_multi_span()

    def _solve_single_span(self):
        left_support = self.supports[0]
        right_support = self.supports[1]

        if left_support.support_type == SupportType.FIXED and right_support.support_type == SupportType.FIXED:
            M_left, M_right = self._calculate_fixed_end_moments(self.spans[0])
            self.support_moments[0] = M_left
            self.support_moments[1] = M_right
        elif left_support.support_type == SupportType.FIXED:
            M_left, _ = self._calculate_fixed_end_moments(self.spans[0])
            self.support_moments[0] = M_left / 2
        elif right_support.support_type == SupportType.FIXED:
            _, M_right = self._calculate_fixed_end_moments(self.spans[0])
            self.support_moments[1] = M_right / 2

    def _solve_multi_span(self):
        unknowns = []
        for i in range(1, self.n_spans):
            if self.supports[i].support_type != SupportType.FIXED:
                unknowns.append(i)

        if not unknowns: return

        n_eq = self.n_spans - 1
        A_matrix = np.zeros((n_eq, len(unknowns)))
        b_vector = np.zeros(n_eq)

        for eq in range(n_eq):
            i = eq
            L_i = self.spans[i].length
            L_i1 = self.spans[i + 1].length
            A_i = self._calculate_area_term(self.spans[i])
            A_i1 = self._calculate_area_term(self.spans[i + 1])

            b_vector[eq] = -6 * (A_i + A_i1)

            for j, unknown_idx in enumerate(unknowns):
                if unknown_idx == i: A_matrix[eq, j] += L_i
                elif unknown_idx == i + 1: A_matrix[eq, j] += 2 * (L_i + L_i1)
                elif unknown_idx == i + 2: A_matrix[eq, j] += L_i1

        try:
            if len(unknowns) > 0:
                solution = np.linalg.solve(A_matrix, b_vector)
                for j, unknown_idx in enumerate(unknowns):
                    self.support_moments[unknown_idx] = solution[j]
        except np.linalg.LinAlgError:
            pass

    def _calculate_fixed_end_moments(self, span) -> Tuple[float, float]:
        M_left = 0.0
        M_right = 0.0
        L = span.length
        for load in span.loads:
            if load.load_type == LoadType.POINT:
                P, a, b = load.magnitude, load.position, L - load.position
                M_left += -P * a * b**2 / L**2
                M_right += P * a**2 * b / L**2
            elif load.load_type == LoadType.UDL:
                w = load.magnitude
                M_left += -w * L**2 / 12
                M_right += w * L**2 / 12
        return M_left, M_right

    def _calculate_area_term(self, span) -> float:
        A = 0.0
        L = span.length
        for load in span.loads:
            if load.load_type == LoadType.POINT:
                P, a, b = load.magnitude, load.position, L - load.position
                A += P * a * b * (L**2 - a**2 - b**2) / (6 * L)
            elif load.load_type == LoadType.UDL:
                w = load.magnitude
                A += w * L**4 / 24
        return A / (span.EI * L)

    def _calculate_reactions(self):
        for i in range(len(self.supports)):
            reaction = 0.0
            if i > 0:
                span = self.spans[i - 1]
                L, M_left, M_right = span.length, self.support_moments[i - 1], self.support_moments[i]
                reaction += (M_right - M_left) / L
                for load in span.loads:
                    if load.load_type == LoadType.POINT: reaction += load.magnitude * (L - load.position) / L
                    elif load.load_type == LoadType.UDL: reaction += load.magnitude * L / 2
            if i < len(self.spans):
                span = self.spans[i]
                L, M_left, M_right = span.length, self.support_moments[i], self.support_moments[i + 1]
                reaction += (M_left - M_right) / L
                for load in span.loads:
                    if load.load_type == LoadType.POINT: reaction += load.magnitude * load.position / L
                    elif load.load_type == LoadType.UDL: reaction += load.magnitude * L / 2
            self.reactions[i] = reaction

    def calculate_shear_force(self, span_idx: int, x: float) -> float:
        span = self.spans[span_idx]
        V = self.reactions[span_idx]
        for load in span.loads:
            if load.load_type == LoadType.POINT:
                if load.position <= x: V -= load.magnitude
            elif load.load_type == LoadType.UDL:
                if x > load.position:
                    length_covered = min(x - load.position, span.length - load.position)
                    V -= load.magnitude * length_covered
        return V

    def calculate_moment_due_to_loads(self, span_idx: int, x: float) -> float:
        span, L = self.spans[span_idx], self.spans[span_idx].length
        total_load, moment_about_left = 0.0, 0.0
        for load in span.loads:
            if load.load_type == LoadType.POINT:
                total_load += load.magnitude
                moment_about_left += load.magnitude * load.position
            elif load.load_type == LoadType.UDL:
                total_load += load.magnitude * L
                moment_about_left += load.magnitude * L * L / 2
        R_left = (total_load * L - moment_about_left) / L if L > 0 else 0
        M = R_left * x
        for load in span.loads:
            if load.load_type == LoadType.POINT and load.position <= x: M -= load.magnitude * (x - load.position)
            elif load.load_type == LoadType.UDL and x > 0: M -= load.magnitude * x**2 / 2
        return M

    def calculate_moment_due_to_supports(self, span_idx: int, x: float) -> float:
        L = self.spans[span_idx].length
        return self.support_moments[span_idx] * (1 - x / L) + self.support_moments[span_idx + 1] * (x / L)

    def calculate_total_moment(self, span_idx: int, x: float) -> float:
        return self.calculate_moment_due_to_loads(span_idx, x) + self.calculate_moment_due_to_supports(span_idx, x)

    def get_analysis_data(self) -> dict:
        all_x, all_V, all_M_total, all_M_loads, all_M_supports = [], [], [], [], []
        current_pos = 0

        for span_idx, span in enumerate(self.spans):
            n_points = 100
            x_local = np.linspace(0, span.length, n_points)
            x_global = x_local + current_pos
            V_local = [self.calculate_shear_force(span_idx, x) for x in x_local]
            M_total_local = [self.calculate_total_moment(span_idx, x) for x in x_local]
            M_loads_local = [self.calculate_moment_due_to_loads(span_idx, x) for x in x_local]
            M_supports_local = [self.calculate_moment_due_to_supports(span_idx, x) for x in x_local]

            all_x.extend(x_global.tolist())
            all_V.extend(V_local)
            all_M_total.extend(M_total_local)
            all_M_loads.extend(M_loads_local)
            all_M_supports.extend(M_supports_local)
            current_pos += span.length

        return {
            "support_moments": self.support_moments,
            "support_reactions": self.reactions,
            "shear_force_data": [{"x": x, "y": V} for x, V in zip(all_x, all_V)],
            "moment_data": [{"x": x, "y": M} for x, M in zip(all_x, all_M_total)],
            "moment_positions": all_x,
            "shear_positions": all_x,
            "moment_due_to_loads_data": [{"x": x, "y": M} for x, M in zip(all_x, all_M_loads)],
            "moment_due_to_supports_data": [{"x": x, "y": M} for x, M in zip(all_x, all_M_supports)],
            "beam_configuration": {
                "spans": [{"length": span.length, "loads": len(span.loads)} for span in self.spans],
                "supports": [{"type": s.support_type.value, "position": s.position} for s in self.supports],
                "total_length": sum(span.length for span in self.spans),
            },
            "critical_values": {
                "max_moment": max(all_M_total) if all_M_total else 0,
                "min_moment": min(all_M_total) if all_M_total else 0,
                "max_shear": max(all_V) if all_V else 0,
                "min_shear": min(all_V) if all_V else 0,
            },
            "equations_used": self.equations_used,
        }

# ----------------------
# FastAPI endpoints
# ----------------------

@router.post("/analyze", response_model=Optional[dict])
def analyze_beam(model: BeamModel):
    """Run three-moment analysis."""
    try:
        solver = ThreeMomentSolver(model.spans, model.supports)
        solver.solve()
        return solver.get_analysis_data()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis failed: {e}")

@router.get("/examples")
def get_examples():
    return [
        {
            "name": "Two-Span Continuous Beam",
            "spans": [{"length": 6.0, "loads": []}, {"length": 6.0, "loads": []}],
            "supports": [{"support_type": "Pinned", "position": 0.0}, {"support_type": "Pinned", "position": 6.0}, {"support_type": "Pinned", "position": 12.0}],
        },
        {
            "name": "UDL Three-Span Beam",
            "spans": [
                {"length": 4.0, "loads": [{"load_type": "Uniformly Distributed Load", "magnitude": 10.0, "position": 0.0, "length": 4.0}]},
                {"length": 5.0, "loads": [{"load_type": "Uniformly Distributed Load", "magnitude": 8.0, "position": 0.0, "length": 5.0}]},
                {"length": 4.0, "loads": [{"load_type": "Uniformly Distributed Load", "magnitude": 12.0, "position": 0.0, "length": 4.0}]}
            ],
            "supports": [{"support_type": "Pinned", "position": 0.0}, {"support_type": "Pinned", "position": 4.0}, {"support_type": "Pinned", "position": 9.0}, {"support_type": "Pinned", "position": 13.0}],
        }
    ]

def add_three_moment_endpoints(app: FastAPI):
    app.include_router(router, prefix="/three_moment")
