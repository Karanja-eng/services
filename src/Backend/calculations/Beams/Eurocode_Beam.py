import math
import numpy as np
from typing import Dict, List, Tuple, Optional

class BeamCalculator:
    """
    Comprehensive beam calculator based on Eurocode 2 (BS EN 1992-1-1)
    Implements all calculations from the provided PDF documents
    """
    
    def __init__(self, input_data: dict):
        self.input = input_data
        self.warnings = []
        self.recommendations = []
        
        # Basic properties
        self.span = input_data['span'] * 1000  # Convert to mm
        self.width = input_data['width']
        self.depth = input_data['depth']
        self.cover = input_data.get('cover', 30)
        
        # Material properties
        self.fck = input_data['fck']
        self.fyk = input_data['fyk']
        self.gamma_c = 1.5
        self.gamma_s = 1.15
        
        # Calculated material properties
        self.fcd = self.fck / self.gamma_c
        self.fyd = self.fyk / self.gamma_s
        self.fctm = self._calculate_fctm()
        self.fctd = 0.7 * self.fctm / self.gamma_c
        
        # Effective depth
        self.d = self._calculate_effective_depth()
        
        # Lambda and eta factors (Table 4.4)
        self.lambda_factor, self.eta_factor = self._get_lambda_eta()
        
        # Load factors
        self.gamma_g = input_data.get('load_factors', {}).get('dead', 1.35)
        self.gamma_q = input_data.get('load_factors', {}).get('live', 1.5)
        
    def _calculate_fctm(self) -> float:
        """Calculate mean tensile strength (Eq 3.16)"""
        if self.fck <= 50:
            return 0.3 * (self.fck ** 0.667)
        else:
            return 2.12 * math.log(1.8 + 0.1 * self.fck)
    
    def _calculate_effective_depth(self) -> float:
        """Calculate effective depth accounting for cover and reinforcement"""
        # Assuming 8mm links and 25mm main bars
        link_dia = 8
        bar_dia = 25
        d = self.depth - self.cover - link_dia - bar_dia/2
        return d
    
    def _get_lambda_eta(self) -> Tuple[float, float]:
        """Get lambda and eta factors based on fck (Table 4.4)"""
        if self.fck <= 50:
            return 0.8, 1.0
        elif self.fck <= 55:
            return 0.7875, 0.975
        elif self.fck <= 60:
            return 0.775, 0.95
        elif self.fck <= 70:
            return 0.750, 0.90
        elif self.fck <= 80:
            return 0.725, 0.85
        else:
            return 0.70, 0.80
    
    def analyze_beam(self) -> Dict:
        """
        Perform structural analysis to get shear forces and bending moments
        Returns BMD and SFD data points
        """
        loads = self.input['loads']
        span_m = self.span / 1000
        
        # Initialize arrays for analysis
        num_points = 100
        x_coords = np.linspace(0, span_m, num_points)
        
        # Calculate reactions
        reactions = self._calculate_reactions(loads, span_m)
        
        # Calculate shear force and bending moment at each point
        shear_forces = []
        bending_moments = []
        
        for x in x_coords:
            sf = self._calculate_shear_at_x(x, loads, reactions, span_m)
            bm = self._calculate_moment_at_x(x, loads, reactions, span_m)
            shear_forces.append(sf)
            bending_moments.append(bm)
        
        # Find maximum values and their positions
        max_moment = max(bending_moments)
        max_moment_pos = x_coords[bending_moments.index(max_moment)]
        max_shear = max(abs(sf) for sf in shear_forces)
        
        # Ultimate design values
        ult_moment = max_moment  # Already factored in loads
        ult_shear = max_shear
        
        return {
            "reactions": reactions,
            "max_moment": round(max_moment, 2),
            "max_moment_position": round(max_moment_pos, 2),
            "max_shear": round(max_shear, 2),
            "x_points": x_coords.tolist(),
            "moment": bending_moments,
            "shear": shear_forces,
            "ultimate_moment": round(ult_moment, 2),
            "ultimate_shear": round(ult_shear, 2)
        }
    
    def _calculate_reactions(self, loads: List[dict], span: float) -> Dict:
        """Calculate support reactions"""
        total_moment_about_left = 0
        total_vertical_load = 0
        
        for load in loads:
            magnitude = load['magnitude']
            if load['type'] == 'point':
                position = load.get('position', 0)
                total_moment_about_left += magnitude * position
                total_vertical_load += magnitude
            elif load['type'] == 'udl':
                start = load.get('start', 0)
                end = load.get('end', span)
                length = end - start
                total_load = magnitude * length
                centroid = start + length/2
                total_moment_about_left += total_load * centroid
                total_vertical_load += total_load
        
        # For simply supported beam
        R_right = total_moment_about_left / span if span > 0 else 0
        R_left = total_vertical_load - R_right
        
        return {
            "left": round(R_left, 2),
            "right": round(R_right, 2),
            "total_load": round(total_vertical_load, 2)
        }
    
    def _calculate_shear_at_x(self, x: float, loads: List[dict], 
                              reactions: Dict, span: float) -> float:
        """Calculate shear force at position x"""
        shear = reactions['left']
        
        for load in loads:
            if load['type'] == 'point':
                pos = load.get('position', 0)
                if x >= pos:
                    shear -= load['magnitude']
            elif load['type'] == 'udl':
                start = load.get('start', 0)
                end = load.get('end', span)
                if x >= start:
                    active_length = min(x - start, end - start)
                    shear -= load['magnitude'] * active_length
        
        return shear
    
    def _calculate_moment_at_x(self, x: float, loads: List[dict], 
                               reactions: Dict, span: float) -> float:
        """Calculate bending moment at position x"""
        moment = reactions['left'] * x
        
        for load in loads:
            if load['type'] == 'point':
                pos = load.get('position', 0)
                if x >= pos:
                    moment -= load['magnitude'] * (x - pos)
            elif load['type'] == 'udl':
                start = load.get('start', 0)
                end = load.get('end', span)
                if x >= start:
                    active_length = min(x - start, end - start)
                    centroid_dist = x - (start + active_length/2)
                    moment -= load['magnitude'] * active_length * centroid_dist
        
        return moment
    
    def design_flexure(self) -> Dict:
        """
        Design flexural reinforcement according to Eurocode 2
        Section 4.4 from PDF
        """
        analysis = self.analyze_beam()
        M_Ed = analysis['ultimate_moment'] * 1e6  # Convert to Nmm
        
        b = self.width
        d = self.d
        
        # Calculate k factor
        k = M_Ed / (b * d**2 * self.fck)
        
        # Maximum k for singly reinforced section (delta=1.0, Table 4.8)
        k_max = 0.196 if self.fck <= 50 else self._get_k_max()
        
        compression_steel_required = k > k_max
        
        if compression_steel_required:
            return self._design_doubly_reinforced(M_Ed, b, d, k_max)
        else:
            return self._design_singly_reinforced(M_Ed, b, d, k)
    
    def _get_k_max(self) -> float:
        """Get maximum k value based on fck (Table 4.8)"""
        k_values = {
            50: 0.196, 55: 0.154, 60: 0.145, 70: 0.130,
            80: 0.117, 90: 0.107
        }
        for fck_limit in sorted(k_values.keys()):
            if self.fck <= fck_limit:
                return k_values[fck_limit]
        return 0.107
    
    def _design_singly_reinforced(self, M_Ed: float, b: float, 
                                   d: float, k: float) -> Dict:
        """Design singly reinforced rectangular section"""
        # Calculate lever arm z (Eq from Section 4.4.2)
        z_over_d = 0.5 * (1 + math.sqrt(max(0, 1 - 3*k/self.eta_factor)))
        z = z_over_d * d
        
        # Ensure z is within limits
        z = min(z, 0.95 * d)
        
        # Calculate required steel area
        A_s_req = M_Ed / (0.87 * self.fyk * z) if z > 0 else 0
        
        # Check minimum steel (Eq 9.1N)
        A_s_min = max(
            0.26 * (self.fctm / self.fyk) * b * d,
            0.0013 * b * d
        )
        
        A_s_prov = max(A_s_req, A_s_min)
        
        # Select bars
        bar_arrangement = self._select_bars(A_s_prov, "tension")
        
        # Calculate actual neutral axis depth
        x = A_s_prov * self.fyd / (self.eta_factor * self.fcd * b * self.lambda_factor) if (self.eta_factor * self.fcd * b * self.lambda_factor) > 0 else 0
        
        return {
            "type": "singly_reinforced",
            "k_factor": round(k, 4),
            "lever_arm_z": round(z, 2),
            "steel_required": round(A_s_req, 2),
            "steel_minimum": round(A_s_min, 2),
            "steel_provided": round(A_s_prov, 2),
            "bar_arrangement": bar_arrangement,
            "neutral_axis_depth": round(x, 2),
            "steel_ratio": round(100 * A_s_prov / (b * d), 3) if (b * d) > 0 else 0,
            "compression_steel_required": False
        }
    
    def _design_doubly_reinforced(self, M_Ed: float, b: float, 
                                    d: float, k_max: float) -> Dict:
        """Design doubly reinforced section (Section 4.5)"""
        d_prime = self.cover + 8 + 12.5  # Cover + link + bar radius
        
        # Maximum moment as singly reinforced
        M_sr = k_max * b * d**2 * self.fck
        
        # Additional moment to be resisted by compression steel
        M_additional = M_Ed - M_sr
        
        # Check if compression steel yields (Table 4.10)
        d_prime_over_d = d_prime / d
        max_ratio = self._get_max_d_prime_ratio()
        
        compression_steel_yields = d_prime_over_d < max_ratio
        
        if compression_steel_yields:
            fs_prime = 0.87 * self.fyk
        else:
            # Calculate strain and stress in compression steel
            xu_over_d = 0.448 if self.fck <= 50 else self._get_xu_over_d()
            xu = xu_over_d * d
            epsilon_cu3 = 0.0035 if self.fck <= 50 else self._get_epsilon_cu3()
            epsilon_sc = epsilon_cu3 * (xu - d_prime) / xu if xu > 0 else 0
            fs_prime = min(epsilon_sc * 200000, 0.87 * self.fyk)  # Es = 200 GPa
        
        # Compression steel area
        A_s_prime = M_additional / (fs_prime * (d - d_prime)) if (fs_prime * (d - d_prime)) > 0 else 0
        
        # Tension steel area
        kc = 0.2401 if self.fck <= 50 else self._get_kc()
        C_sr = kc * b * d * self.fck
        
        A_s_req = (C_sr + A_s_prime * fs_prime) / (0.87 * self.fyk)
        
        # Select bars
        tension_bars = self._select_bars(A_s_req, "tension")
        compression_bars = self._select_bars(A_s_prime, "compression")
        
        return {
            "type": "doubly_reinforced",
            "k_factor": round(M_Ed / (b * d**2 * self.fck), 4),
            "compression_steel_required": True,
            "compression_steel_yields": compression_steel_yields,
            "tension_steel_required": round(A_s_req, 2),
            "tension_steel_provided": round(tension_bars['total_area'], 2),
            "tension_bar_arrangement": tension_bars,
            "compression_steel_required_area": round(A_s_prime, 2),
            "compression_steel_provided": round(compression_bars['total_area'], 2),
            "compression_bar_arrangement": compression_bars,
            "d_prime": round(d_prime, 2)
        }
    
    def _get_max_d_prime_ratio(self) -> float:
        """Get maximum d'/d ratio for yielding compression steel (Table 4.10)"""
        ratios = {
            50: 0.1664, 55: 0.1016, 60: 0.0820, 70: 0.0609,
            80: 0.0497, 90: 0.0497
        }
        for fck_limit in sorted(ratios.keys()):
            if self.fck <= fck_limit:
                return ratios[fck_limit]
        return 0.0497
    
    def _get_xu_over_d(self) -> float:
        """Get xu/d ratio (Table 4.5)"""
        values = {
            50: 0.448, 55: 0.350, 60: 0.340, 70: 0.329,
            80: 0.323, 90: 0.323
        }
        for fck_limit in sorted(values.keys()):
            if self.fck <= fck_limit:
                return values[fck_limit]
        return 0.323
    
    def _get_epsilon_cu3(self) -> float:
        """Get ultimate concrete strain (Table 4.4)"""
        values = {
            50: 0.0035, 55: 0.0031, 60: 0.0029, 70: 0.0027,
            80: 0.0026, 90: 0.0026
        }
        for fck_limit in sorted(values.keys()):
            if self.fck <= fck_limit:
                return values[fck_limit]
        return 0.0026
    
    def _get_kc(self) -> float:
        """Get kc value (Table 4.7)"""
        values = {
            50: 0.2401, 55: 0.1800, 60: 0.1677, 70: 0.1488,
            80: 0.1335, 90: 0.1213
        }
        for fck_limit in sorted(values.keys()):
            if self.fck <= fck_limit:
                return values[fck_limit]
        return 0.1213
    
    def _select_bars(self, area_required: float, bar_type: str) -> Dict:
        """Select appropriate bar arrangement"""
        bar_sizes = [40, 32, 25, 20, 16, 12, 10, 8]
        bar_areas = {
            8: 50, 10: 79, 12: 113, 16: 201, 20: 314,
            25: 491, 32: 804, 40: 1257
        }
        
        # Try different combinations
        for num_bars in range(2, 9):
            for size in bar_sizes:
                area = num_bars * bar_areas[size]
                if area >= area_required * 0.98:  # 98% threshold
                    return {
                        "size": size,
                        "count": num_bars,
                        "total_area": area,
                        "description": f"{num_bars}H{size}"
                    }
        
        # Fallback: use maximum bars
        size = bar_sizes[0]
        num_bars = math.ceil(area_required / bar_areas[size]) if bar_areas[size] > 0 else 0
        return {
            "size": size,
            "count": num_bars,
            "total_area": num_bars * bar_areas[size],
            "description": f"{num_bars}H{size}"
        }
    
    def design_shear(self) -> Dict:
        """
        Design shear reinforcement according to Eurocode 2
        Section 5.1 from PDF
        """
        analysis = self.analyze_beam()
        V_Ed = analysis['ultimate_shear'] * 1000  # Convert to N
        
        # Shear at d from support
        d_m = self.d / 1000  # Convert to meters
        V_Ed_at_d = self._calculate_shear_at_d(V_Ed, d_m)
        
        # Calculate VRd,c (shear capacity without reinforcement)
        V_Rd_c = self._calculate_v_rd_c()
        
        shear_reinforcement_required = V_Ed_at_d > V_Rd_c
        
        if not shear_reinforcement_required:
            # Provide minimum shear reinforcement
            min_links = self._calculate_minimum_links()
            return {
                "shear_reinforcement_required": False,
                "v_ed": round(V_Ed_at_d / 1000, 2),
                "v_rd_c": round(V_Rd_c / 1000, 2),
                "link_design": min_links,
                "shear_links": min_links,
                "recommendation": "Minimum shear reinforcement provided"
            }
        
        # Check section capacity
        V_Rd_max = self._calculate_v_rd_max()
        
        if V_Ed_at_d > V_Rd_max:
            self.warnings.append("Section inadequate for shear - increase section size")
            return {
                "shear_reinforcement_required": True,
                "section_adequate": False,
                "v_ed": round(V_Ed_at_d / 1000, 2),
                "v_rd_max": round(V_Rd_max / 1000, 2),
                "error": "Section size inadequate"
            }
        
        # Design shear links
        link_design = self._design_shear_links(V_Ed_at_d)
        
        return {
            "shear_reinforcement_required": True,
            "section_adequate": True,
            "v_ed": round(V_Ed_at_d / 1000, 2),
            "v_rd_c": round(V_Rd_c / 1000, 2),
            "v_rd_max": round(V_Rd_max / 1000, 2),
            "link_design": link_design,
            "shear_links": link_design
        }
    
    def _calculate_shear_at_d(self, V_Ed: float, d_m: float) -> float:
        """Calculate shear force at distance d from support"""
        # Simplified: assume uniform load, reduce by load in distance d
        # For more complex loading, would need detailed analysis
        span_m = self.span / 1000
        reduction_factor = max(0, 1 - (d_m / span_m)) if span_m > 0 else 0
        return V_Ed * reduction_factor
    
    def _calculate_v_rd_c(self) -> float:
        """Calculate shear resistance without reinforcement (Eq 6.2a, 6.2b)"""
        bw = self.width
        d = self.d
        
        # Get flexural reinforcement area
        flexural = self.design_flexure()
        if flexural['type'] == 'singly_reinforced':
            A_sl = flexural['steel_provided']
        else:
            A_sl = flexural['tension_steel_provided']
        
        # Calculate factors
        k = min(1 + math.sqrt(200 / d), 2.0) if d > 0 else 2.0
        rho_1 = min(A_sl / (bw * d), 0.02) if (bw * d) > 0 else 0
        
        # CRd,c from National Annex (default 0.18/gamma_c)
        C_Rd_c = 0.18 / self.gamma_c
        
        # Calculate V_Rd,c
        V_Rd_c = max(
            C_Rd_c * k * (100 * rho_1 * self.fck)**(1/3) * bw * d,
            0.035 * k**(3/2) * self.fck**0.5 * bw * d
        )
        
        return V_Rd_c
    
    def _calculate_v_rd_max(self) -> float:
        """Calculate maximum shear capacity (Eq 6.9)"""
        bw = self.width
        d = self.d
        z = 0.9 * d
        
        # Strength reduction factor
        nu = 0.6 * (1 - self.fck / 250)
        
        # Alpha_cw = 1 for non-prestressed
        alpha_cw = 1
        
        # Assuming cot(theta) = 2.5 for maximum capacity
        cot_theta = 2.5
        
        V_Rd_max = alpha_cw * bw * z * nu * self.fcd / (cot_theta + 1/cot_theta)
        
        return V_Rd_max
    
    def _design_shear_links(self, V_Ed: float) -> Dict:
        """Design shear link reinforcement"""
        # Using cot(theta) = 2.5 for minimum reinforcement
        cot_theta = 2.5
        z = 0.9 * self.d
        
        # Link diameter options
        link_sizes = [8, 10, 12]
        link_areas = {8: 50, 10: 79, 12: 113}  # 2-leg links
        
        for link_size in link_sizes:
            A_sw = 2 * link_areas[link_size]  # 2-leg links
            
            # Calculate required spacing (Eq 6.8)
            s_required = (A_sw * self.fyd * z * cot_theta) / V_Ed if V_Ed > 0 else 300
            
            # Maximum spacing
            s_max = min(0.75 * self.d if self.d > 0 else 300, 300)
            
            # Minimum steel check (Eq 9.4)
            rho_w_min = 0.08 * math.sqrt(self.fck) / self.fyk
            s_min = A_sw / (rho_w_min * self.width) if (rho_w_min * self.width) > 0 else 300
            
            s_provided = min(s_required, s_max, s_min)
            
            if s_provided >= 75:  # Practical minimum spacing
                # Round down to practical spacing
                practical_spacings = [300, 275, 250, 225, 200, 175, 150, 125, 100, 75]
                s_final = 75
                for spacing in practical_spacings:
                    if spacing <= s_provided:
                        s_final = spacing
                        break
                
                return {
                    "size": link_size,
                    "legs": 2,
                    "spacing": s_final,
                    "description": f"H{link_size} @ {s_final}mm c/c",
                    "area_provided": A_sw,
                    "cot_theta": cot_theta
                }
        
        # Fallback
        return {
            "size": 12,
            "legs": 2,
            "spacing": 150,
            "description": "H12 @ 150mm c/c",
            "area_provided": 2 * 113,
            "cot_theta": cot_theta
        }
    
    def _calculate_minimum_links(self) -> Dict:
        """Calculate minimum shear reinforcement (Eq 9.4, 9.5N)"""
        bw = self.width
        
        # Minimum steel ratio
        rho_w_min = 0.08 * math.sqrt(self.fck) / self.fyk
        
        # Using H8 links
        A_sw = 2 * 50  # 2-leg H8
        
        s_max = min(0.75 * self.d if self.d > 0 else 300, 300)
        s_min = A_sw / (rho_w_min * bw) if (rho_w_min * bw) > 0 else 300
        
        spacing = min(s_max, s_min, 250)
        
        return {
            "size": 8,
            "legs": 2,
            "spacing": round(spacing, 0),
            "description": f"H8 @ {round(spacing, 0)}mm c/c"
        }
    
    def check_deflection(self) -> Dict:
        """
        Check deflection using span/depth ratio method
        Section 6.2 from PDF
        """
        span_m = self.span / 1000
        d = self.d
        
        # Calculate rho and rho_0
        flexural = self.design_flexure()
        if flexural['type'] == 'singly_reinforced':
            A_s = flexural['steel_provided']
            A_s_prime = 0
        else:
            A_s = flexural['tension_steel_provided']
            A_s_prime = flexural['compression_steel_provided']
        
        rho = A_s / (self.width * d) if (self.width * d) > 0 else 0
        rho_0 = 1e-3 * math.sqrt(self.fck)
        
        # Get K factor based on support type (Table 6.1)
        support_type = self.input.get('support_type', 'simply_supported')
        K_values = {
            'simply_supported': 1.0,
            'continuous': 1.5,  # Interior span
            'cantilever': 0.4
        }
        K = K_values.get(support_type, 1.0)
        
        # Calculate basic L/d ratio (Eq 7.16b)
        if rho > rho_0:
            if A_s_prime > 0:
                rho_prime = A_s_prime / (self.width * d)
                L_over_d = 11 + 1.5 * math.sqrt(self.fck) * rho_0 / rho + \
                           (5/12) * math.sqrt(rho_prime / rho)
            else:
                L_over_d = 11 + 1.5 * math.sqrt(self.fck) * rho_0 / rho
        else:
            L_over_d = 11 + 1.5 * math.sqrt(self.fck) * (rho_0 / (rho if rho > 0 else rho_0))
        
        # Apply K factor
        L_over_d = L_over_d * K
        
        # Correction for steel stress
        load_ratio = 0.7  # Simplified ratio of service to ultimate loads
        sigma_s = self.fyd * load_ratio
        
        if sigma_s < 310:
            L_over_d = L_over_d * (310 / sigma_s)
        
        # Correction for flanged beams (if applicable)
        beam_type = self.input.get('beam_type', 'rectangular')
        if beam_type in ['T-beam', 'L-beam']:
            flange_width = self.input.get('flange_width', self.width)
            if flange_width / self.width > 3:
                L_over_d = L_over_d * 0.8
        
        # Actual L/d ratio
        actual_L_over_d = (span_m * 1000) / d if d > 0 else 0
        
        # Check
        status = "OK" if actual_L_over_d <= L_over_d else "FAIL"
        
        return {
            "allowable_span_depth_ratio": round(L_over_d, 2),
            "actual_span_depth_ratio": round(actual_L_over_d, 2),
            "status": status,
            "rho": round(rho * 100, 3),
            "rho_0": round(rho_0 * 100, 3),
            "k_factor": K,
            "support_type": support_type
        }
    
    def check_cracking(self) -> Dict:
        """
        Check crack control requirements
        Section 6.3 from PDF
        """
        # Calculate steel stress at SLS
        load_ratio = 0.7  # Service to ultimate load ratio
        sigma_s = self.fyd * load_ratio
        
        # Exposure class determines crack width limit
        exposure = self.input.get('exposure_class', 'XC1')
        crack_width_limits = {
            'XC1': 0.4, 'XC2': 0.3, 'XC3': 0.3, 'XC4': 0.3,
            'XD1': 0.3, 'XD2': 0.3,
            'XS1': 0.3, 'XS2': 0.3, 'XS3': 0.3
        }
        w_k = crack_width_limits.get(exposure, 0.3)
        
        # Get maximum bar spacing from Table 6.2
        stress_levels = [160, 200, 240, 280, 320, 360]
        spacing_03 = [300, 250, 200, 150, 100, 50]  # For wk = 0.3mm
        spacing_04 = [300, 300, 250, 200, 150, 100]  # For wk = 0.4mm
        
        # Interpolate for actual stress
        if w_k == 0.3:
            spacings = spacing_03
        else:
            spacings = spacing_04
        
        max_spacing = 300  # Default
        for i, stress in enumerate(stress_levels):
            if sigma_s <= stress:
                max_spacing = spacings[i]
                break
        
        # Check minimum steel area (Eq 7.1)
        # Tensile zone area
        Act = 0.5 * self.width * self.depth 
        k = 1.0 if self.depth <= 300 else 0.65 if self.depth >= 800 else \
            0.65 + (800 - self.depth) / 500 * (1.0 - 0.65)
        kc = 0.4  # For bending
        
        A_s_min_crack = kc * k * self.fctm * Act / sigma_s if sigma_s > 0 else 0
        
        flexural = self.design_flexure()
        A_s_provided = flexural.get('steel_provided', flexural.get('tension_steel_provided', 0))
        
        # Calculate actual bar spacing
        bar_arrangement = flexural.get('bar_arrangement', 
                                       flexural.get('tension_bar_arrangement', {}))
        num_bars = bar_arrangement.get('count', 3)
        bar_dia = bar_arrangement.get('size', 25)
        
        clear_spacing = (self.width - 2 * (self.cover + 8) - num_bars * bar_dia) / (num_bars - 1) if num_bars > 1 else 0
        
        spacing_ok = clear_spacing <= max_spacing
        min_steel_ok = A_s_provided >= A_s_min_crack
        status = "OK" if (spacing_ok and min_steel_ok) else "FAIL"
        
        return {
            "crack_width_limit": w_k,
            "exposure_class": exposure,
            "steel_stress_sls": round(sigma_s, 2),
            "maximum_bar_spacing": max_spacing,
            "actual_bar_spacing": round(clear_spacing, 2),
            "spacing_ok": spacing_ok,
            "minimum_steel_crack": round(A_s_min_crack, 2),
            "steel_provided": round(A_s_provided, 2),
            "minimum_steel_ok": min_steel_ok,
            "status": status
        }
    
    def generate_detailing(self) -> Dict:
        """Generate reinforcement detailing information"""
        flexural = self.design_flexure()
        shear = self.design_shear()
        
        # Anchorage length calculation (Section 5.2, Table 5.5)
        bar_arrangement = flexural.get('bar_arrangement', flexural.get('tension_bar_arrangement', {}))
        bar_size = bar_arrangement.get('size', 25)
        
        # Bond stress (Eq 8.2)
        eta_1 = 1.0  # Good bond conditions
        eta_2 = 1.0 if bar_size <= 32 else (132 - bar_size) / 100
        f_bd = 2.25 * eta_1 * eta_2 * self.fctd
        
        # Basic anchorage length (Eq 8.3)
        l_bd_req = bar_size * self.fyd / (4 * f_bd) if f_bd > 0 else 0
        
        # Design anchorage length (simplified, alpha factors = 1.0)
        l_bd = l_bd_req
        l_bd_basic = max(l_bd, 0.3 * l_bd_req, 10 * bar_size, 100)
        
        # Curtailment positions
        span_m = self.span / 1000
        curtailment = self._calculate_curtailment(span_m)
        
        return {
            "main_steel": {
                "bottom_bars": flexural.get('bar_arrangement', flexural.get('tension_bar_arrangement', {})),
                "top_bars": flexural.get('compression_bar_arrangement', {"description": "2H12", "size": 12, "count": 2})
            },
            "shear_links": shear.get('link_design', shear.get('shear_links', {})),
            "anchorage_length": {
                "basic": round(l_bd_basic, 2),
                "multiple": round(l_bd_basic / bar_size, 1) if bar_size > 0 else 0
            },
            "curtailment": curtailment,
            "cover": self.cover,
            "concrete_grade": f"C{int(self.fck)}/{int(self.fck + 8)}",
            "steel_grade": f"Grade {int(self.fyk)}"
        }
    
    def _calculate_curtailment(self, span: float) -> Dict:
        """Calculate bar curtailment positions"""
        # Simplified curtailment
        support_type = self.input.get('support_type', 'simply_supported')
        
        if support_type == 'simply_supported':
            curtail_start = span / 4
            curtail_end = 3 * span / 4
        elif support_type == 'continuous':
            curtail_start = span / 5
            curtail_end = 4 * span / 5
        else:  # cantilever
            curtail_start = 0
            curtail_end = span
        
        return {
            "curtailment_allowed": support_type != 'cantilever',
            "from_left": round(curtail_start, 2),
            "to_right": round(curtail_end, 2)
        }
    
    def get_material_properties(self) -> Dict:
        """Get all material properties"""
        return {
            "concrete": {
                "fck": self.fck,
                "fcd": round(self.fcd, 2),
                "fctm": round(self.fctm, 2),
                "fctd": round(self.fctd, 2),
                "gamma_c": self.gamma_c,
            },
            "steel": {
                "fyk": self.fyk,
                "fyd": round(self.fyd, 2),
                "gamma_s": self.gamma_s,
            }
        }