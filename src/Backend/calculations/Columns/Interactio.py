import math
import numpy as np
from scipy.optimize import fsolve
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
from ..Beams.datasets import table_3_27_anchorage
from ..datasets import data_table_3_10

class ColumnDesignBS8110:
    def __init__(self, b, h, fcu=30, fy=460, cover=40, tie_dia=8, max_agg=20, N=1480e3, Mx=0, My=0, inclination=0, braced=True, end_top=1, end_bottom=1, lo=4750, shape='rectangular', fire_res=1.5, bar_dia_pref=16):
        # 1. Basic properties
        self.b = min(b, h)  # width, minor
        self.h = max(b, h)  # depth, major
        self.fcu = fcu
        self.fy = fy
        self.bar_dia_pref = bar_dia_pref
        
        # 2. Lookup tables (initialized early because used in methods)
        self.beta_braced = {(1,1):0.75, (1,2):0.8, (1,3):0.9, (2,1):0.8, (2,2):0.85, (2,3):0.95, (3,1):0.9, (3,2):0.95, (3,3):1.0}
        self.beta_unbraced = {(1,1):1.2, (1,2):1.3, (1,3):1.6, (1,4):2.2, (2,1):1.3, (2,2):1.5, (2,3):1.8, (2,4):2.2, (3,1):1.6, (3,2):1.8, (3,3):2.2, (3,4):2.2}
        self.beta_a_table = {12:0.07, 15:0.11, 20:0.2, 25:0.31, 30:0.46, 35:0.61, 40:0.8, 45:1.01, 50:1.25, 55:1.51, 60:1.8}
        self.beta_table = {0:1.0, 0.1:0.88, 0.2:0.77, 0.3:0.65, 0.4:0.53, 0.5:0.42, 0.6:0.3}
        self.bar_areas = {6:28.3, 8:50.3, 10:78.5, 12:113, 16:201, 20:314, 25:491, 32:804, 40:1257}
        self.bar_areas_multi = {dia: {n: n * area for n in range(1,11)} for dia, area in self.bar_areas.items()}
        self.anch_lap_table = {'25/30':(36,54), '28/35':(34,51), '30/37':(32,48), '32/40':(31,46)}
        self.fire_min_dim = {0.5:150, 1:200, 1.5:250, 2:300, 3:400, 4:450}  # fully exposed
        self.dur_cover = {'xc1':30, 'xc3':35}  # internal/external
        
        # 3. Derived properties
        self.cover = max(cover, self.get_durability_cover(), self.get_fire_cover(fire_res))
        self.tie_dia = tie_dia
        self.max_agg = max_agg
        self.N = N  # N
        self.Mi_x = Mx  # initial M major
        self.Mi_y = My  # initial M minor
        self.incl = math.radians(inclination)
        self.braced = braced
        self.end_top = end_top
        self.end_bottom = end_bottom
        self.lo = lo
        self.shape = shape
        self.Ac = math.pi * (self.h/2)**2 if shape=='circular' else self.b * self.h
        self.Asc = 0
        self.Asc_prime = 0
        self.Es = 200e3
        self.epscu = 0.0035
        self.alpha_c = 0.45
        self.alpha_s = 0.87
        self.min_rho = max(0.002, 0.1 * N / (fy * self.Ac)) / 100
        self.max_rho = 0.04
        self.max_lap_rho = 0.08
        self.min_bars = 6 if shape=='circular' else 4
        self.min_bar_dia = 16 if max(self.b,self.h)>200 else 8
        
        # 4. Calculations
        self.calc_le()
        self.check_slender()
        self.adjust_inclined()
        self.calc_Madd()
        self.M1_x, self.M2_x = sorted([self.Mi_x, self.Mi_x + self.Madd_x])
        self.M1_y, self.M2_y = sorted([self.Mi_y, self.Mi_y + self.Madd_y])
        self.M_x = max(self.M2_x, self.N * 0.05 * self.h, self.M1_x + 0.5 * self.Madd_x if not self.is_short else self.Mi_x)
        self.M_y = max(self.M2_y, self.N * 0.05 * self.b, self.M1_y + 0.5 * self.Madd_y if not self.is_short else self.Mi_y)
        self.is_axial = self.M_x == 0 and self.M_y == 0
        self.is_uniaxial = (self.M_x > 0 and self.M_y == 0) or (self.M_y > 0 and self.M_x == 0)
        self.is_biaxial = self.M_x > 0 and self.M_y > 0
        self.is_plain = self.check_plain()
        self.rho = self.min_rho if self.is_plain else self.calc_rho()
        self.Asc_req = self.rho * self.Ac if not self.is_plain else 0
        self.select_bars_links()
        self.calc_laps_anch()

    def get_durability_cover(self):
        return self.dur_cover['xc1']  # assume internal

    def get_fire_cover(self, period):
        return self.fire_min_dim.get(period, 250)  # min dim, but for cover approx 25-55

    def calc_le(self):
        key = tuple(sorted([self.end_top, self.end_bottom]))
        beta = self.beta_braced.get(key, 1.0) if self.braced else self.beta_unbraced.get(key, 2.2)
        # For inclined columns, le is beta * inclined_length (lo)
        self.le_x = beta * self.lo
        self.le_y = beta * self.lo
        if self.lo > 60 * min(self.b, self.h):
            raise ValueError("Slenderness limit exceeded")

    def check_slender(self):
        limit = 15 if self.braced else 10
        self.slend_x = self.le_x / self.h
        self.slend_y = self.le_y / self.b
        self.is_short = self.slend_x < limit and self.slend_y < limit
        self.is_slender = not self.is_short
        self.classification = "Short" if self.is_short else "Slender"

    def adjust_inclined(self):
        if self.incl > 0:
            self.is_inclined = True
            # Eccentricity at midpoint for inclined column: (L/2) * sin(theta) if theta is from vertical
            # Or (L/2) * cos(theta_horizontal) as in Inclined.py
            e = (self.lo / 2) * math.sin(self.incl)
            self.Mi_x += self.N * e # Moment = N * e
        else:
            self.is_inclined = False

    def calc_Madd(self):
        if self.is_short:
            self.Madd_x = self.Madd_y = 0
            return
        le_b_x = self.le_x / self.h
        le_b_y = self.le_y / self.b
        beta_a_x = np.interp(le_b_x, list(self.beta_a_table.keys()), list(self.beta_a_table.values()))
        beta_a_y = np.interp(le_b_y, list(self.beta_a_table.keys()), list(self.beta_a_table.values()))
        au_x = beta_a_x * self.h
        au_y = beta_a_y * self.b
        Nuz = self.alpha_c * self.fcu * self.Ac + self.alpha_s * self.fy * self.max_rho * self.Ac
        Nbal = 0.25 * self.fcu * self.b * 0.9 * self.h
        Kx = min(1, (Nuz - self.N) / (Nuz - Nbal))
        Ky = Kx  # assume
        self.Madd_x = self.N * au_x * Kx
        self.Madd_y = self.N * au_y * Ky

    def check_plain(self):
        return self.N <= 0.45 * self.fcu * self.Ac + 0.1 * self.fcu * self.Ac  # approx no reinf

    def calc_rho(self):
        d = self.h - self.cover - self.tie_dia - 16 / 2  # assume dia
        d_prime = self.cover + self.tie_dia + 16 / 2
        if self.is_axial:
            return self.min_rho
        elif self.is_uniaxial:
            M = self.M_x if self.M_x > self.M_y else self.M_y
            h_dim = self.h if self.M_x > self.M_y else self.b
            def eq(rho):
                self.Asc = rho * self.Ac
                self.Asc_prime = self.Asc / 2
                def find_x(x):
                    eps_s_prime = self.epscu * (x - d_prime) / x
                    eps_s = self.epscu * (d - x) / x
                    fs_prime = np.clip(self.Es * eps_s_prime, -self.alpha_s * self.fy, self.alpha_s * self.fy)
                    fs = np.clip(self.Es * eps_s, -self.alpha_s * self.fy, self.alpha_s * self.fy)
                    Cc = self.alpha_c * self.fcu * self.b * 0.9 * x if x < h_dim else self.alpha_c * self.fcu * self.b * h_dim
                    return Cc + fs_prime * self.Asc_prime - fs * self.Asc - self.N
                x = fsolve(find_x, h_dim / 2)[0]
                zc = h_dim / 2 - 0.45 * min(x, h_dim)
                Mc = Cc * zc + fs_prime * self.Asc_prime * (h_dim / 2 - d_prime) + fs * self.Asc * (d - h_dim / 2)
                return Mc - M
            rho = fsolve(eq, 0.01)[0]
            return min(self.max_rho, max(self.min_rho, rho))
        elif self.is_biaxial:
            N_norm = self.N / (self.fcu * self.Ac)
            beta = np.interp(N_norm, list(self.beta_table.keys()), list(self.beta_table.values()))
            if self.M_x / self.h > self.M_y / self.b:
                Mx_prime = self.M_x + beta * (self.h / self.b) * self.M_y
                My_prime = 0
            else:
                My_prime = self.M_y + beta * (self.b / self.h) * self.M_x
                Mx_prime = 0
            # Design as uniaxial with max(Mx_prime, My_prime)
            M_eq = max(Mx_prime, My_prime)
            # Call uniaxial calc with M_eq, h
            return self.calc_rho()  # recursive, but adjust

    def select_bars_links(self):
        # 1. Main Reinforcement
        # Try preferred bar diameter first
        target_area = self.Asc_req
        self.num_bars = 0
        self.bar_dia = self.bar_dia_pref
        
        # Simple selection: find min number of bars >= min_bars providing target_area
        bars_data = data_table_3_10.get(self.bar_dia, [])
        found = False
        for n, area in bars_data:
            if n >= self.min_bars and area >= target_area:
                self.num_bars = n
                self.provided_area = area
                found = True
                break
        
        if not found:
            # If preferred dia not enough (unlikely with 10 bars), try larger diameters
            for dia in [20, 25, 32, 40]:
                if dia <= self.bar_dia: continue
                bars_data = data_table_3_10.get(dia, [])
                for n, area in bars_data:
                    if n >= self.min_bars and area >= target_area:
                        self.num_bars = n
                        self.bar_dia = dia
                        self.provided_area = area
                        found = True
                        break
                if found: break
        
        # 2. Links / Ties
        # Dia: max(6mm, bar_dia / 4)
        self.links_dia = max(8 if self.bar_dia > 25 else 6, self.bar_dia / 4)
        # Round links_dia to standard (6, 8, 10, 12)
        link_options = [6, 8, 10, 12]
        self.links_dia = next((d for d in link_options if d >= self.links_dia), 12)
        
        # Spacing: min(12 * bar_dia, b, h)
        # BS 8110 Clause 3.12.7.1: Shall not exceed 12 x bar_dia
        self.links_spacing = min(12 * self.bar_dia, self.b, self.h)
        # Round spacing down to nearest 25mm
        self.links_spacing = math.floor(self.links_spacing / 25) * 25
        self.links_spacing = max(75, min(300, self.links_spacing)) # Practical limits

    def calc_laps_anch(self):
        # table_3_27_anchorage expects fcu keys like fcu_25, fcu_30
        fcu_key = f"fcu_{min(40, max(25, self.fcu))}"
        # We need to know if it's tension or compression. Columns are usually compression.
        anch_multiplier = table_3_27_anchorage['compression'][f'grade_{self.fy}'].get(fcu_key, 32)
        self.anch_len = anch_multiplier * self.bar_dia
        self.lap_len = 1.25 * self.anch_len # Simplified lap factor
        self.lap_perc = 50 # Assume 50% laps for calc if not provided

    def get_capacity(self, rho_half):
        """Calculates M capacity for current N and given steel ratio per face."""
        def eq(M_val):
            # Using find_x logic but for fixed rho
            def find_x(x):
                eps_sp = self.epscu * (x - (self.cover + self.tie_dia + self.bar_dia/2)) / x if x > 0 else 0
                eps_s = self.epscu * ((self.h - self.cover - self.tie_dia - self.bar_dia/2) - x) / x if x > 0 else 0
                fs_limit = self.alpha_s * self.fy
                fsp = np.clip(self.Es * eps_sp, -fs_limit, fs_limit)
                fs = np.clip(self.Es * eps_s, -fs_limit, fs_limit)
                # Concrete force
                depth_c = min(0.9 * x, self.h)
                Cc = self.alpha_c * self.fcu * self.b * depth_c
                # Equilibrium: N = Cc + Fs' - Fs
                return Cc + (fsp - fs) * (rho_half * self.b * self.h) - self.N
            x_sol = fsolve(find_x, self.h/2)[0]
            depth_c = min(0.9 * x_sol, self.h)
            Cc = self.alpha_c * self.fcu * self.b * depth_c
            eps_sp = self.epscu * (x_sol - (self.cover + self.tie_dia + self.bar_dia/2)) / x_sol if x_sol > 0 else 0
            eps_s = self.epscu * ((self.h - self.cover - self.tie_dia - self.bar_dia/2) - x_sol) / x_sol if x_sol > 0 else 0
            fsp = np.clip(self.Es * eps_sp, -self.alpha_s * self.fy, self.alpha_s * self.fy)
            fs = np.clip(self.Es * eps_s, -self.alpha_s * self.fy, self.alpha_s * self.fy)
            zc = self.h/2 - depth_c/2
            M_cap = (Cc * zc + 
                     fsp * (rho_half * self.b * self.h) * (self.h/2 - (self.cover + self.tie_dia + self.bar_dia/2)) + 
                     fs * (rho_half * self.b * self.h) * ((self.h - self.cover - self.tie_dia - self.bar_dia/2) - self.h/2))
            return M_cap
        return eq(0)

    def get_interaction(self):
        """
        Generates M-N interaction curves for fixed steel percentages (0.4% to 4.0%).
        Returns a list of datasets compatible with the frontend Columnmain.jsx.
        """
        if self.is_axial:
            return []
            
        curves = []
        # Target percentages for curves
        percentages = [0.4, 0.8, 1.0, 2.0, 3.0, 4.0]
        
        # Symmetrical reinforcement assumptions
        d_norm = (self.h - self.cover - self.tie_dia - self.bar_dia/2) / self.h
        dp_norm = (self.cover + self.tie_dia + self.bar_dia/2) / self.h
        
        # Capture the whole curve from tension to compression
        x_values = np.linspace(0.01, 10.0, 200)
        
        for p in percentages:
            points = []
            rho_half = (p / 2.0) / 100.0 # Ratio per face
            
            for x_norm in x_values:
                # 1. Concrete (Simplified BS 8110 block)
                if x_norm <= 1.1111: # 0.9 * x_norm <= 1.0
                    a_norm = 0.9 * x_norm
                    Cc_norm = self.alpha_c * self.fcu * a_norm
                    x_bar_norm = a_norm / 2.0
                else:
                    Cc_norm = self.alpha_c * self.fcu * 1.0
                    x_bar_norm = 0.5
                
                # 2. Steel Strains
                eps_sp = self.epscu * (x_norm - dp_norm) / x_norm if x_norm > 0 else 0
                eps_s = self.epscu * (d_norm - x_norm) / x_norm if x_norm > 0 else 0
                
                # 3. Steel Stresses (alpha_s = 0.87)
                fs_limit = self.alpha_s * self.fy
                fsp = np.clip(self.Es * eps_sp, -fs_limit, fs_limit)
                fs = np.clip(self.Es * eps_s, -fs_limit, fs_limit)
                
                # 4. Normalized N and M (N/bh and M/bh^2)
                N_norm = Cc_norm + fsp * rho_half - fs * rho_half
                M_norm = (Cc_norm * (0.5 - x_bar_norm) + 
                          fsp * rho_half * (0.5 - dp_norm) + 
                          fs * rho_half * (d_norm - 0.5))
                
                if N_norm >= 0:
                    points.append({
                        'M': round(float(M_norm), 3),
                        'N': round(float(N_norm), 3)
                    })
            
            curves.append({
                'steelPercentage': p,
                'points': sorted(points, key=lambda p: p['N'])
            })
            
        return curves

# JSX: Update to include inclined, braced/unbraced, short/slender options in form, display type in results

router = APIRouter()

@router.post("/design-column")
async def calculate_column(data: dict):
    try:
        col = ColumnDesignBS8110(
            b=data['b'], h=data['h'], fcu=data.get('fcu', 30), fy=data.get('fy', 460),
            cover=data.get('cover', 40), tie_dia=data.get('tie_dia', 8),
            max_agg=data.get('max_agg', 20), N=data['N'] * 1000,
            Mx=data.get('Mx', 0) * 1e6 if data.get('mode') == 'biaxial' else data.get('M', 0) * 1e6,
            My=data.get('My', 0) * 1e6, inclination=data.get('inclination', 0),
            braced=data.get('braced', True), end_top=data.get('end_top', 1),
            end_bottom=data.get('end_bottom', 1), lo=data.get('lo', 4750),
            shape=data.get('shape', 'rectangular'), fire_res=data.get('fire_res', 1.5),
            bar_dia_pref=data.get('bar_diameter', 16)
        )

        if data.get('mode') == 'axial':
            col.is_axial = True
            col.is_uniaxial = False
            col.is_biaxial = False
            col.M_x = col.N * 0.05 * col.h
            col.M_y = col.N * 0.05 * col.b
            col.rho = col.min_rho
            col.Asc_req = col.rho * col.Ac
            col.select_bars_links()
            col.calc_laps_anch()
        
        def clean(val):
            if isinstance(val, (int, float)):
                if math.isnan(val) or math.isinf(val): return 0
                return round(float(val), 2)
            return val

        return {
            "status": "success",
            "classification": col.classification,
            "is_inclined": col.is_inclined,
            "mode": data.get('mode', 'uniaxial'),
            "dimensions": {"b": col.b, "h": col.h},
            "loads": {"N": clean(col.N / 1000), "Mx": clean(col.M_x / 1e6), "My": clean(col.M_y / 1e6)},
            "slenderness": {
                "le_x": clean(col.le_x), "le_y": clean(col.le_y),
                "slend_x": clean(col.slend_x), "slend_y": clean(col.slend_y),
                "is_slender": col.is_slender,
                "Madd_x": clean(col.Madd_x / 1e6), "Madd_y": clean(col.Madd_y / 1e6)
            },
            "steel_area": clean(col.Asc_req),
            "steel_percentage": clean(col.rho * 100),
            "bar_selection": {
                "num_bars": col.num_bars,
                "bar_dia": col.bar_dia,
                "total_area": clean(col.provided_area),
                "links_dia": col.links_dia,
                "links_spacing": col.links_spacing
            },
            "achorage": {
                "anch_len": clean(col.anch_len),
                "lap_len": clean(col.lap_len)
            },
            "chart_data": col.get_interaction(),
            "design_point": {
                "N": clean(col.N / (col.b * col.h)),
                "M": clean(max(col.M_x, col.M_y) / (col.b * col.h**2)),
                "Mx": clean(col.M_x / (col.b * col.h**2)),
                "My": clean(col.M_y / (col.b * col.h**2))
            },
            "chart_point": {
                "N": clean(col.N / (col.b * col.h)),
                "M": clean(col.get_capacity(col.provided_area / (2 * col.b * col.h)) / (col.b * col.h**2)),
                "Mux": clean(col.get_capacity(col.provided_area / (2 * col.b * col.h)) / (col.b * col.h**2)),
                "Muy": clean(col.get_capacity(col.provided_area / (2 * col.b * col.h)) / (col.b * col.h**2))
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))