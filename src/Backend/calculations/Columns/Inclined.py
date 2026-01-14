# design_logic.py
#inclined columns
import math


class Column:
    def __init__(
        self, length, width, height, inclination_angle, fy, fc, cover, axial_load
    ):
        self.length = length  # mm (b)
        self.width = width  # mm (h)
        self.height = height  # mm (l)
        self.is_inclined = True
        self.inclination_angle = math.radians(inclination_angle)  # Convert to radians
        self.beta = 0.75  # From Table 3.19 BS8110 for braced column, condition 1
        self.fy = fy  # Steel yield strength (N/mm^2), assumed
        self.fc = fc  # Concrete strength (N/mm^2), assumed
        self.cover = cover  # Effective length (mm)
        self.is_short = True
        self.axial_load = axial_load  # kN

    def calculate_effective_length(self):
        """Calculate effective length based on BS8110."""
        if self.is_inclined:
            # Inclined column: effective length considers inclined length
            self.effective_length = self.beta * self.height
        else:
            # Vertical column
            self.effective_length = self.beta * (
                self.height - 500
            )  # Subtract beam depth
        return self.effective_length

    def check_column_type(self):
        """Determine if column is short or slender."""
        l_ex = self.effective_length / self.length
        l_ey = self.effective_length / self.width
        self.is_short = l_ex < 15 and l_ey < 15
        return self.is_short

    def calculate_moment(self, axial_load: float, eccentricity: float = 0):
        """Calculate design moment for the column."""
        self.axial_load = axial_load
        if self.is_inclined:
            # Moment due to eccentricity from inclination
            e = (
                eccentricity
                if eccentricity > 0
                else (self.height / 2) * math.cos(self.inclination_angle)
            )
            self.moment = self.axial_load * e / 1000  # Convert to kNm
        else:
            # Vertical column moment from frame analysis or minimum eccentricity
            min_eccentricity = min(0.05 * self.width, 20)  # BS8110 3.8.4.4
            self.moment = max(self.axial_load * min_eccentricity / 1000, 0)
        return self.moment

    def calculate_reinforcement(self):
        """Calculate required reinforcement area based on BS8110."""
        N = self.axial_load * 1000  # Convert kN to N
        M = self.moment * 10**6  # Convert kNm to Nmm
        bh = self.length * self.width
        d = self.width - 25 - 10  # Cover + half bar diameter (assumed 20mm bar)

        # Normalized axial load and moment
        n = N / (bh)
        m = M / (bh * self.width)

        # Simplified reinforcement calculation (based on charts or empirical formula)
        # Using minimum reinforcement as per BS8110 (0.4% of bh)
        min_reinforcement = 0.004 * bh
        self.reinforcement_area = max(
            min_reinforcement, 453
        )  # Minimum 4T12 from document
        return self.reinforcement_area

    def design_summary(self):
        """Return a summary of the column design."""
        return {
            "effective_length_mm": self.calculate_effective_length(),
            "axial_load_kN": self.axial_load,
            "moment_kNm": self.calculate_moment(self.axial_load),
            "reinforcement_area_mm2": self.calculate_reinforcement(),
        }
