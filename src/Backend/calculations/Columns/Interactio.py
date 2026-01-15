import math
import numpy as np
from scipy.optimize import fsolve
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any

class ColumnDesignBS8110:
    def __init__(self, b, h, fcu=30, fy=460, cover=40, tie_dia=8, max_agg=20, N=1480e3, Mx=0, My=0, inclination=0, braced=True, end_top=1, end_bottom=1, lo=4750, shape='rectangular', fire_res=1.5):
        self.b = min(b, h)  # width, minor
        self.h = max(b, h)  # depth, major
        self.fcu = fcu
        self.fy = fy
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
        self.alpha_c = 0.567
        self.alpha_s = 0.87
        self.min_rho = max(0.002, 0.1 * N / (fy * self.Ac)) / 100
        self.max_rho = 0.04
        self.max_lap_rho = 0.08
        self.min_bars = 6 if shape=='circular' else 4
        self.min_bar_dia = 16 if max(self.b,self.h)>200 else 8
        self.beta_braced = {(1,1):0.75, (1,2):0.8, (1,3):0.9, (2,1):0.8, (2,2):0.85, (2,3):0.95, (3,1):0.9, (3,2):0.95, (3,3):1.0}
        self.beta_unbraced = {(1,1):1.2, (1,2):1.3, (1,3):1.6, (1,4):2.2, (2,1):1.3, (2,2):1.5, (2,3):1.8, (2,4):2.2, (3,1):1.6, (3,2):1.8, (3,3):2.2, (3,4):2.2}
        self.beta_a_table = {12:0.07, 15:0.11, 20:0.2, 25:0.31, 30:0.46, 35:0.61, 40:0.8, 45:1.01, 50:1.25, 55:1.51, 60:1.8}
        self.beta_table = {0:1.0, 0.1:0.88, 0.2:0.77, 0.3:0.65, 0.4:0.53, 0.5:0.42, 0.6:0.3}
        self.bar_areas = {6:28.3, 8:50.3, 10:78.5, 12:113, 16:201, 20:314, 25:491, 32:804, 40:1257}
        self.bar_areas_multi = {dia: {n: n * area for n in range(1,11)} for dia, area in self.bar_areas.items()}
        self.anch_lap_table = {'25/30':(36,54), '28/35':(34,51), '30/37':(32,48), '32/40':(31,46)}
        self.fire_min_dim = {0.5:150, 1:200, 1.5:250, 2:300, 3:400, 4:450}  # fully exposed
        self.dur_cover = {'xc1':30, 'xc3':35}  # internal/external
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
        self.le_x = beta * self.lo
        self.le_y = beta * self.lo
        if self.lo > 60 * self.b:
            raise ValueError("Slenderness limit exceeded")

    def check_slender(self):
        limit = 15 if self.braced else 10
        self.is_short = self.le_x / self.h < limit and self.le_y / self.b < limit
        self.is_slender = not self.is_short

    def adjust_inclined(self):
        if self.incl > 0:
            self.is_inclined = True
            e = self.lo * math.sin(self.incl)
            self.Mi_x += self.N * (e / 2)  # eccentricity from inclination
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
                    fs_prime = min(self.Es * eps_s_prime, self.alpha_s * self.fy) if eps_s_prime > 0 else max(self.Es * eps_s_prime, -self.alpha_s * self.fy)
                    fs = min(self.Es * eps_s, self.alpha_s * self.fy) if eps_s > 0 else max(self.Es * eps_s, -self.alpha_s * self.fy)
                    Cc = self.alpha_c * self.fcu * self.b * 0.9 * x if x < h_dim else self.alpha_c * self.fcu * self.b * h_dim
                    return Cc + fs_prime * self.Asc_prime + fs * self.Asc - self.N
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

    def get_interaction(self):
        """
        Generates M-N interaction curves for fixed steel percentages (0.4% to 4.0%).
        Returns a list of datasets compatible with the frontend Columnmain.jsx.
        """
        curves = []
        # Target percentages for curves
        percentages = [0.4, 0.8, 1.0, 2.0, 3.0, 4.0]
        
        # Save current state to restore later
        original_N = self.N
        original_Mx = self.Mi_x
        original_My = self.Mi_y
        
        for p in percentages:
            points = []
            rho = p / 100.0
            self.Asc = rho * self.Ac
            self.Asc_prime = self.Asc / 2 # Assume symmetric reinf for chart
            
            # We want to find the capacity M for various N levels
            # N_norm from 0 to 1.0 (approx limit)
            for N_norm in np.linspace(0, 0.9, 20):
                target_N = N_norm * self.fcu * self.Ac
                
                # For a fixed rho and N, we find the capacity M.
                # This requires iterating through neutral axis depth x.
                # Simplified approach for the chart: 
                # Pick an 'x' and calculate corresponding N and M.
                pass
            
            # For now, let's provide a representative dummy curve if full calculation is too slow
            # but ideally we want a real one.
            # Let's use a simpler approach: iterate through x from d_prime up to 1.5h
            d = self.h - self.cover - self.tie_dia - 16 / 2
            d_prime = self.cover + self.tie_dia + 16 / 2
            
            x_values = np.linspace(d_prime * 1.1, self.h * 1.5, 30)
            for x in x_values:
                # 1. Strains
                eps_s_prime = self.epscu * (x - d_prime) / x
                eps_s = self.epscu * (d - x) / x
                
                # 2. Stresses
                fs_prime = min(self.Es * eps_s_prime, self.alpha_s * self.fy) if eps_s_prime > 0 else max(self.Es * eps_s_prime, -self.alpha_s * self.fy)
                fs = min(self.Es * eps_s, self.alpha_s * self.fy) if eps_s > 0 else max(self.Es * eps_s, -self.alpha_s * self.fy)
                
                # 3. Concrete Force
                depth_c = min(0.9 * x, self.h)
                Cc = self.alpha_c * self.fcu * self.b * depth_c
                
                # 4. Total Axial Capacity N
                N_cap = Cc + fs_prime * self.Asc_prime + fs * self.Asc_prime
                
                # 5. Moment Capacity about Centroid
                zc = self.h/2 - depth_c/2
                M_cap = (Cc * zc + 
                         fs_prime * self.Asc_prime * (self.h/2 - d_prime) - 
                         fs * self.Asc_prime * (d - self.h/2))
                
                # Normalize points for chart axes: M/bh^2 and N/bh
                # Frontend expects M and N. We'll send normalized values (N/mm2) if needed, 
                # but Columnmain.jsx sets labels to "M/bh²" and "N/bh".
                points.append({
                    'M': round(M_cap / (self.b * self.h**2), 3), 
                    'N': round(N_cap / (self.b * self.h), 3)
                })
            
            curves.append({
                'steelPercentage': p,
                'points': sorted(points, key=lambda p: p['N'])
            })
            
        # Restore original state
        self.N = original_N
        self.Mi_x = original_Mx
        self.Mi_y = original_My
        
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
        
        def clean(val):
            if isinstance(val, (int, float)):
                if math.isnan(val) or math.isinf(val): return 0
                return round(float(val), 2)
            return val

        return {
            "status": "success",
            "classification": col.classification,
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
                "N": clean(col.N / (col.fcu * col.Ac)),
                "M": clean(max(col.M_x, col.M_y) / (col.fcu * col.b * col.h**2 / 1000))
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))