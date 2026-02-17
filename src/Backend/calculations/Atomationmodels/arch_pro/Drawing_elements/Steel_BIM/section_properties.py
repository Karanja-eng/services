"""
structural_steel_bim/sections/section_properties.py

Standard BS EN rolled sections and built-up section definitions.
All dimensions in millimeters, properties in SI units.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional


class SectionType(Enum):
    """BS EN section designations."""
    UB = "Universal Beam"
    UC = "Universal Column"
    UBP = "Universal Bearing Pile"
    RSJ = "Rolled Steel Joist"
    PFC = "Parallel Flange Channel"
    RSA = "Rolled Steel Angle - Equal"
    RSA_UNEQUAL = "Rolled Steel Angle - Unequal"
    RHS = "Rectangular Hollow Section"
    CHS = "Circular Hollow Section"
    SHS = "Square Hollow Section"
    TEE = "Structural Tee"
    PLATE = "Flat Plate"
    BUILT_UP_I = "Built-up I Section"
    BUILT_UP_BOX = "Built-up Box Section"


@dataclass
class SectionProperties:
    """Geometric and mechanical properties of structural sections."""
    designation: str
    section_type: SectionType
    
    # Dimensions (mm)
    depth: float  # h - overall depth
    width: float  # b - overall width
    web_thickness: float  # tw
    flange_thickness: float  # tf
    root_radius: Optional[float] = None  # r
    
    # Additional dimensions for specific sections
    leg_length_1: Optional[float] = None  # For angles
    leg_length_2: Optional[float] = None  # For unequal angles
    diameter: Optional[float] = None  # For CHS
    
    # Section properties
    area: float = 0.0  # cm²
    mass_per_meter: float = 0.0  # kg/m
    
    # Moment of inertia (cm⁴)
    Iyy: float = 0.0  # Major axis
    Izz: float = 0.0  # Minor axis
    
    # Section modulus (cm³)
    Wyy: float = 0.0
    Wzz: float = 0.0
    
    # Radius of gyration (cm)
    iyy: float = 0.0
    izz: float = 0.0
    
    # Torsional properties
    torsional_constant: float = 0.0  # It (cm⁴)
    warping_constant: float = 0.0  # Iw (cm⁶)
    
    # Plastic modulus (cm³)
    Wpl_y: float = 0.0
    Wpl_z: float = 0.0
    
    def to_dict(self) -> Dict:
        return {
            'designation': self.designation,
            'section_type': self.section_type.value,
            'depth': self.depth,
            'width': self.width,
            'web_thickness': self.web_thickness,
            'flange_thickness': self.flange_thickness,
            'root_radius': self.root_radius,
            'area': self.area,
            'mass_per_meter': self.mass_per_meter,
            'Iyy': self.Iyy,
            'Izz': self.Izz,
            'Wyy': self.Wyy,
            'Wzz': self.Wzz,
            'iyy': self.iyy,
            'izz': self.izz
        }


# BS EN 10365:2017 Universal Beams - Sample Library
BS_UNIVERSAL_BEAMS = {
    "914x419x388UB": SectionProperties(
        designation="914x419x388UB",
        section_type=SectionType.UB,
        depth=921.0, width=420.5, web_thickness=21.4, flange_thickness=36.6,
        root_radius=24.0, area=494.0, mass_per_meter=388.0,
        Iyy=571000.0, Izz=47300.0, Wyy=12400.0, Wzz=2250.0,
        iyy=34.0, izz=9.79, torsional_constant=309.0,
        Wpl_y=14200.0, Wpl_z=3470.0
    ),
    "838x292x226UB": SectionProperties(
        designation="838x292x226UB",
        section_type=SectionType.UB,
        depth=850.9, width=293.8, web_thickness=16.1, flange_thickness=26.8,
        root_radius=17.8, area=288.0, mass_per_meter=226.0,
        Iyy=359000.0, Izz=14500.0, Wyy=8440.0, Wzz=986.0,
        iyy=35.3, izz=7.09, torsional_constant=124.0,
        Wpl_y=9540.0, Wpl_z=1510.0
    ),
    "762x267x197UB": SectionProperties(
        designation="762x267x197UB",
        section_type=SectionType.UB,
        depth=769.8, width=268.0, web_thickness=15.6, flange_thickness=25.4,
        root_radius=16.5, area=251.0, mass_per_meter=197.0,
        Iyy=281000.0, Izz=11700.0, Wyy=7300.0, Wzz=875.0,
        iyy=33.5, izz=6.83, torsional_constant=100.0,
        Wpl_y=8200.0, Wpl_z=1340.0
    ),
    "610x305x238UB": SectionProperties(
        designation="610x305x238UB",
        section_type=SectionType.UB,
        depth=635.8, width=311.4, web_thickness=18.4, flange_thickness=31.4,
        root_radius=16.5, area=303.0, mass_per_meter=238.0,
        Iyy=248000.0, Izz=23900.0, Wyy=7800.0, Wzz=1540.0,
        iyy=28.6, izz=8.88, torsional_constant=204.0,
        Wpl_y=8820.0, Wpl_z=2360.0
    ),
    "533x210x122UB": SectionProperties(
        designation="533x210x122UB",
        section_type=SectionType.UB,
        depth=544.5, width=211.9, web_thickness=12.8, flange_thickness=21.3,
        root_radius=12.7, area=155.0, mass_per_meter=122.0,
        Iyy=123000.0, Izz=6490.0, Wyy=4520.0, Wzz=612.0,
        iyy=28.2, izz=6.48, torsional_constant=60.8,
        Wpl_y=5070.0, Wpl_z=937.0
    ),
    "457x191x98UB": SectionProperties(
        designation="457x191x98UB",
        section_type=SectionType.UB,
        depth=467.2, width=192.8, web_thickness=11.4, flange_thickness=19.6,
        root_radius=10.2, area=125.0, mass_per_meter=98.0,
        Iyy=87600.0, Izz=4570.0, Wyy=3750.0, Wzz=474.0,
        iyy=26.5, izz=6.05, torsional_constant=43.9,
        Wpl_y=4180.0, Wpl_z=729.0
    ),
    "406x178x74UB": SectionProperties(
        designation="406x178x74UB",
        section_type=SectionType.UB,
        depth=412.8, width=179.5, web_thickness=9.5, flange_thickness=16.0,
        root_radius=10.2, area=94.5, mass_per_meter=74.0,
        Iyy=55300.0, Izz=3020.0, Wyy=2680.0, Wzz=337.0,
        iyy=24.2, izz=5.65, torsional_constant=25.5,
        Wpl_y=2970.0, Wpl_z=518.0
    ),
    "356x171x67UB": SectionProperties(
        designation="356x171x67UB",
        section_type=SectionType.UB,
        depth=363.4, width=173.2, web_thickness=9.1, flange_thickness=15.7,
        root_radius=10.2, area=85.5, mass_per_meter=67.0,
        Iyy=41900.0, Izz=2490.0, Wyy=2310.0, Wzz=288.0,
        iyy=22.1, izz=5.40, torsional_constant=21.3,
        Wpl_y=2560.0, Wpl_z=442.0
    ),
    "305x165x54UB": SectionProperties(
        designation="305x165x54UB",
        section_type=SectionType.UB,
        depth=310.4, width=166.9, web_thickness=7.9, flange_thickness=13.7,
        root_radius=8.9, area=68.4, mass_per_meter=54.0,
        Iyy=24500.0, Izz=1790.0, Wyy=1580.0, Wzz=214.0,
        iyy=18.9, izz=5.11, torsional_constant=14.0,
        Wpl_y=1750.0, Wpl_z=329.0
    ),
    "254x146x43UB": SectionProperties(
        designation="254x146x43UB",
        section_type=SectionType.UB,
        depth=259.6, width=147.3, web_thickness=7.2, flange_thickness=12.7,
        root_radius=7.6, area=55.0, mass_per_meter=43.0,
        Iyy=14200.0, Izz=1270.0, Wyy=1090.0, Wzz=172.0,
        iyy=16.1, izz=4.81, torsional_constant=10.3,
        Wpl_y=1210.0, Wpl_z=264.0
    ),
}

# BS EN 10365:2017 Universal Columns - Sample Library
BS_UNIVERSAL_COLUMNS = {
    "356x406x634UC": SectionProperties(
        designation="356x406x634UC",
        section_type=SectionType.UC,
        depth=474.6, width=424.0, web_thickness=47.6, flange_thickness=77.0,
        root_radius=15.2, area=808.0, mass_per_meter=634.0,
        Iyy=272000.0, Izz=132000.0, Wyy=11500.0, Wzz=6230.0,
        iyy=18.4, izz=12.8, torsional_constant=3950.0,
        Wpl_y=13300.0, Wpl_z=9620.0
    ),
    "356x368x202UC": SectionProperties(
        designation="356x368x202UC",
        section_type=SectionType.UC,
        depth=374.6, width=374.7, web_thickness=16.5, flange_thickness=27.0,
        root_radius=15.2, area=257.0, mass_per_meter=202.0,
        Iyy=73400.0, Izz=36600.0, Wyy=3920.0, Wzz=1950.0,
        iyy=16.9, izz=11.9, torsional_constant=226.0,
        Wpl_y=4470.0, Wpl_z=3010.0
    ),
    "305x305x240UC": SectionProperties(
        designation="305x305x240UC",
        section_type=SectionType.UC,
        depth=352.5, width=318.4, web_thickness=23.0, flange_thickness=37.7,
        root_radius=15.2, area=306.0, mass_per_meter=240.0,
        Iyy=77500.0, Izz=33900.0, Wyy=4400.0, Wzz=2130.0,
        iyy=15.9, izz=10.5, torsional_constant=397.0,
        Wpl_y=5050.0, Wpl_z=3300.0
    ),
    "254x254x167UC": SectionProperties(
        designation="254x254x167UC",
        section_type=SectionType.UC,
        depth=289.1, width=265.2, web_thickness=19.2, flange_thickness=31.7,
        root_radius=12.7, area=213.0, mass_per_meter=167.0,
        Iyy=45700.0, Izz=20300.0, Wyy=3160.0, Wzz=1530.0,
        iyy=14.7, izz=9.77, torsional_constant=244.0,
        Wpl_y=3610.0, Wpl_z=2370.0
    ),
    "203x203x86UC": SectionProperties(
        designation="203x203x86UC",
        section_type=SectionType.UC,
        depth=222.2, width=209.1, web_thickness=13.0, flange_thickness=20.5,
        root_radius=10.2, area=110.0, mass_per_meter=86.0,
        Iyy=18500.0, Izz=8340.0, Wyy=1660.0, Wzz=798.0,
        iyy=13.0, izz=8.71, torsional_constant=93.1,
        Wpl_y=1880.0, Wpl_z=1230.0
    ),
    "152x152x37UC": SectionProperties(
        designation="152x152x37UC",
        section_type=SectionType.UC,
        depth=161.8, width=154.4, web_thickness=8.1, flange_thickness=11.5,
        root_radius=7.6, area=47.4, mass_per_meter=37.0,
        Iyy=4590.0, Izz=2100.0, Wyy=567.0, Wzz=272.0,
        iyy=9.84, izz=6.65, torsional_constant=18.8,
        Wpl_y=637.0, Wpl_z=419.0
    ),
}

# BS EN 10365:2017 Parallel Flange Channels - Sample Library
BS_PFC = {
    "430x100x64PFC": SectionProperties(
        designation="430x100x64PFC",
        section_type=SectionType.PFC,
        depth=430.0, width=100.0, web_thickness=11.0, flange_thickness=19.0,
        root_radius=12.0, area=81.9, mass_per_meter=64.0,
        Iyy=39100.0, Izz=927.0, Wyy=1820.0, Wzz=139.0,
        iyy=21.8, izz=3.36, torsional_constant=25.8
    ),
    "380x100x54PFC": SectionProperties(
        designation="380x100x54PFC",
        section_type=SectionType.PFC,
        depth=380.0, width=100.0, web_thickness=9.5, flange_thickness=16.5,
        root_radius=10.5, area=68.4, mass_per_meter=54.0,
        Iyy=27900.0, Izz=806.0, Wyy=1470.0, Wzz=121.0,
        iyy=20.2, izz=3.43, torsional_constant=18.1
    ),
    "300x100x46PFC": SectionProperties(
        designation="300x100x46PFC",
        section_type=SectionType.PFC,
        depth=300.0, width=100.0, web_thickness=9.0, flange_thickness=16.5,
        root_radius=10.5, area=58.8, mass_per_meter=46.0,
        Iyy=16700.0, Izz=780.0, Wyy=1110.0, Wzz=117.0,
        iyy=16.9, izz=3.64, torsional_constant=16.8
    ),
    "260x90x35PFC": SectionProperties(
        designation="260x90x35PFC",
        section_type=SectionType.PFC,
        depth=260.0, width=90.0, web_thickness=8.0, flange_thickness=14.0,
        root_radius=9.0, area=44.6, mass_per_meter=35.0,
        Iyy=10700.0, Izz=513.0, Wyy=822.0, Wzz=86.2,
        iyy=15.5, izz=3.39, torsional_constant=11.2
    ),
    "230x90x32PFC": SectionProperties(
        designation="230x90x32PFC",
        section_type=SectionType.PFC,
        depth=230.0, width=90.0, web_thickness=7.5, flange_thickness=14.0,
        root_radius=9.0, area=41.3, mass_per_meter=32.0,
        Iyy=8340.0, Izz=507.0, Wyy=725.0, Wzz=85.0,
        iyy=14.2, izz=3.50, torsional_constant=10.8
    ),
    "200x90x30PFC": SectionProperties(
        designation="200x90x30PFC",
        section_type=SectionType.PFC,
        depth=200.0, width=90.0, web_thickness=7.0, flangle_thickness=14.0,
        root_radius=9.0, area=38.2, mass_per_meter=30.0,
        Iyy=6290.0, Izz=497.0, Wyy=629.0, Wzz=83.3,
        iyy=12.8, izz=3.61, torsional_constant=10.4
    ),
}

# BS EN 10056-1 Equal Angles - Sample Library
BS_EQUAL_ANGLES = {
    "200x200x24EA": SectionProperties(
        designation="200x200x24EA",
        section_type=SectionType.RSA,
        depth=200.0, width=200.0, web_thickness=24.0, flange_thickness=24.0,
        leg_length_1=200.0, leg_length_2=200.0,
        root_radius=18.0, area=91.1, mass_per_meter=71.5,
        Iyy=5260.0, Izz=5260.0, iyy=7.60, izz=7.60
    ),
    "150x150x18EA": SectionProperties(
        designation="150x150x18EA",
        section_type=SectionType.RSA,
        depth=150.0, width=150.0, web_thickness=18.0, flange_thickness=18.0,
        leg_length_1=150.0, leg_length_2=150.0,
        root_radius=13.5, area=51.0, mass_per_meter=40.1,
        Iyy=2130.0, Izz=2130.0, iyy=6.46, izz=6.46
    ),
    "150x150x15EA": SectionProperties(
        designation="150x150x15EA",
        section_type=SectionType.RSA,
        depth=150.0, width=150.0, web_thickness=15.0, flange_thickness=15.0,
        leg_length_1=150.0, leg_length_2=150.0,
        root_radius=13.5, area=42.9, mass_per_meter=33.8,
        Iyy=1820.0, Izz=1820.0, iyy=6.51, izz=6.51
    ),
    "150x150x12EA": SectionProperties(
        designation="150x150x12EA",
        section_type=SectionType.RSA,
        depth=150.0, width=150.0, web_thickness=12.0, flange_thickness=12.0,
        leg_length_1=150.0, leg_length_2=150.0,
        root_radius=13.5, area=34.8, mass_per_meter=27.3,
        Iyy=1500.0, Izz=1500.0, iyy=6.57, izz=6.57
    ),
    "120x120x12EA": SectionProperties(
        designation="120x120x12EA",
        section_type=SectionType.RSA,
        depth=120.0, width=120.0, web_thickness=12.0, flange_thickness=12.0,
        leg_length_1=120.0, leg_length_2=120.0,
        root_radius=11.0, area=27.5, mass_per_meter=21.6,
        Iyy=833.0, Izz=833.0, iyy=5.50, izz=5.50
    ),
    "100x100x12EA": SectionProperties(
        designation="100x100x12EA",
        section_type=SectionType.RSA,
        depth=100.0, width=100.0, web_thickness=12.0, flange_thickness=12.0,
        leg_length_1=100.0, leg_length_2=100.0,
        root_radius=9.0, area=22.7, mass_per_meter=17.8,
        Iyy=451.0, Izz=451.0, iyy=4.46, izz=4.46
    ),
    "90x90x12EA": SectionProperties(
        designation="90x90x12EA",
        section_type=SectionType.RSA,
        depth=90.0, width=90.0, web_thickness=12.0, flange_thickness=12.0,
        leg_length_1=90.0, leg_length_2=90.0,
        root_radius=8.0, area=20.5, mass_per_meter=16.1,
        Iyy=333.0, Izz=333.0, iyy=4.03, izz=4.03
    ),
    "80x80x10EA": SectionProperties(
        designation="80x80x10EA",
        section_type=SectionType.RSA,
        depth=80.0, width=80.0, web_thickness=10.0, flange_thickness=10.0,
        leg_length_1=80.0, leg_length_2=80.0,
        root_radius=7.0, area=15.3, mass_per_meter=12.0,
        Iyy=194.0, Izz=194.0, iyy=3.56, izz=3.56
    ),
    "70x70x10EA": SectionProperties(
        designation="70x70x10EA",
        section_type=SectionType.RSA,
        depth=70.0, width=70.0, web_thickness=10.0, flange_thickness=10.0,
        leg_length_1=70.0, leg_length_2=70.0,
        root_radius=6.0, area=13.3, mass_per_meter=10.5,
        Iyy=134.0, Izz=134.0, iyy=3.18, izz=3.18
    ),
    "60x60x8EA": SectionProperties(
        designation="60x60x8EA",
        section_type=SectionType.RSA,
        depth=60.0, width=60.0, web_thickness=8.0, flange_thickness=8.0,
        leg_length_1=60.0, leg_length_2=60.0,
        root_radius=5.0, area=9.17, mass_per_meter=7.22,
        Iyy=68.5, Izz=68.5, iyy=2.73, izz=2.73
    ),
}

# BS EN 10210-2 Circular Hollow Sections - Sample Library
BS_CHS = {
    "508.0x16.0CHS": SectionProperties(
        designation="508.0x16.0CHS",
        section_type=SectionType.CHS,
        depth=508.0, width=508.0, web_thickness=16.0, flange_thickness=16.0,
        diameter=508.0, area=248.0, mass_per_meter=195.0,
        Iyy=127000.0, Izz=127000.0, iyy=22.6, izz=22.6,
        torsional_constant=254000.0
    ),
    "406.4x12.5CHS": SectionProperties(
        designation="406.4x12.5CHS",
        section_type=SectionType.CHS,
        depth=406.4, width=406.4, web_thickness=12.5, flange_thickness=12.5,
        diameter=406.4, area=156.0, mass_per_meter=122.0,
        Iyy=63200.0, Izz=63200.0, iyy=20.1, izz=20.1,
        torsional_constant=126000.0
    ),
    "323.9x10.0CHS": SectionProperties(
        designation="323.9x10.0CHS",
        section_type=SectionType.CHS,
        depth=323.9, width=323.9, web_thickness=10.0, flange_thickness=10.0,
        diameter=323.9, area=99.5, mass_per_meter=78.1,
        Iyy=32200.0, Izz=32200.0, iyy=18.0, izz=18.0,
        torsional_constant=64400.0
    ),
    "273.0x10.0CHS": SectionProperties(
        designation="273.0x10.0CHS",
        section_type=SectionType.CHS,
        depth=273.0, width=273.0, web_thickness=10.0, flange_thickness=10.0,
        diameter=273.0, area=83.6, mass_per_meter=65.7,
        Iyy=19100.0, Izz=19100.0, iyy=15.1, izz=15.1,
        torsional_constant=38200.0
    ),
    "219.1x8.0CHS": SectionProperties(
        designation="219.1x8.0CHS",
        section_type=SectionType.CHS,
        depth=219.1, width=219.1, web_thickness=8.0, flange_thickness=8.0,
        diameter=219.1, area=53.6, mass_per_meter=42.1,
        Iyy=9700.0, Izz=9700.0, iyy=13.4, izz=13.4,
        torsional_constant=19400.0
    ),
    "168.3x8.0CHS": SectionProperties(
        designation="168.3x8.0CHS",
        section_type=SectionType.CHS,
        depth=168.3, width=168.3, web_thickness=8.0, flange_thickness=8.0,
        diameter=168.3, area=41.1, mass_per_meter=32.2,
        Iyy=4840.0, Izz=4840.0, iyy=10.8, izz=10.8,
        torsional_constant=9680.0
    ),
    "139.7x6.3CHS": SectionProperties(
        designation="139.7x6.3CHS",
        section_type=SectionType.CHS,
        depth=139.7, width=139.7, web_thickness=6.3, flange_thickness=6.3,
        diameter=139.7, area=27.0, mass_per_meter=21.2,
        Iyy=2560.0, Izz=2560.0, iyy=9.73, izz=9.73,
        torsional_constant=5120.0
    ),
    "114.3x5.0CHS": SectionProperties(
        designation="114.3x5.0CHS",
        section_type=SectionType.CHS,
        depth=114.3, width=114.3, web_thickness=5.0, flange_thickness=5.0,
        diameter=114.3, area=17.5, mass_per_meter=13.7,
        Iyy=1230.0, Izz=1230.0, iyy=8.39, izz=8.39,
        torsional_constant=2460.0
    ),
}

# BS EN 10210-2 Square Hollow Sections - Sample Library
BS_SHS = {
    "400x400x16.0SHS": SectionProperties(
        designation="400x400x16.0SHS",
        section_type=SectionType.SHS,
        depth=400.0, width=400.0, web_thickness=16.0, flange_thickness=16.0,
        area=239.0, mass_per_meter=188.0,
        Iyy=102000.0, Izz=102000.0, iyy=20.7, izz=20.7,
        torsional_constant=169000.0
    ),
    "300x300x12.5SHS": SectionProperties(
        designation="300x300x12.5SHS",
        section_type=SectionType.SHS,
        depth=300.0, width=300.0, web_thickness=12.5, flange_thickness=12.5,
        area=141.0, mass_per_meter=111.0,
        Iyy=43900.0, Izz=43900.0, iyy=17.6, izz=17.6,
        torsional_constant=73100.0
    ),
    "250x250x10.0SHS": SectionProperties(
        designation="250x250x10.0SHS",
        section_type=SectionType.SHS,
        depth=250.0, width=250.0, web_thickness=10.0, flange_thickness=10.0,
        area=94.0, mass_per_meter=73.9,
        Iyy=24100.0, Izz=24100.0, iyy=16.0, izz=16.0,
        torsional_constant=40200.0
    ),
    "200x200x10.0SHS": SectionProperties(
        designation="200x200x10.0SHS",
        section_type=SectionType.SHS,
        depth=200.0, width=200.0, web_thickness=10.0, flange_thickness=10.0,
        area=74.0, mass_per_meter=58.3,
        Iyy=12300.0, Izz=12300.0, iyy=12.9, izz=12.9,
        torsional_constant=20500.0
    ),
    "150x150x8.0SHS": SectionProperties(
        designation="150x150x8.0SHS",
        section_type=SectionType.SHS,
        depth=150.0, width=150.0, web_thickness=8.0, flange_thickness=8.0,
        area=44.8, mass_per_meter=35.2,
        Iyy=4620.0, Izz=4620.0, iyy=10.2, izz=10.2,
        torsional_constant=7700.0
    ),
    "120x120x6.3SHS": SectionProperties(
        designation="120x120x6.3SHS",
        section_type=SectionType.SHS,
        depth=120.0, width=120.0, web_thickness=6.3, flange_thickness=6.3,
        area=28.3, mass_per_meter=22.2,
        Iyy=2170.0, Izz=2170.0, iyy=8.76, izz=8.76,
        torsional_constant=3610.0
    ),
    "100x100x6.3SHS": SectionProperties(
        designation="100x100x6.3SHS",
        section_type=SectionType.SHS,
        depth=100.0, width=100.0, web_thickness=6.3, flange_thickness=6.3,
        area=23.4, mass_per_meter=18.4,
        Iyy=1230.0, Izz=1230.0, iyy=7.26, izz=7.26,
        torsional_constant=2050.0
    ),
}

# BS EN 10210-2 Rectangular Hollow Sections - Sample Library
BS_RHS = {
    "500x300x16.0RHS": SectionProperties(
        designation="500x300x16.0RHS",
        section_type=SectionType.RHS,
        depth=500.0, width=300.0, web_thickness=16.0, flange_thickness=16.0,
        area=239.0, mass_per_meter=188.0,
        Iyy=122000.0, Izz=51300.0, iyy=22.6, izz=14.7,
        torsional_constant=124000.0
    ),
    "400x200x12.5RHS": SectionProperties(
        designation="400x200x12.5RHS",
        section_type=SectionType.RHS,
        depth=400.0, width=200.0, web_thickness=12.5, flange_thickness=12.5,
        area=141.0, mass_per_meter=111.0,
        Iyy=53100.0, Izz=19200.0, iyy=19.4, izz=11.7,
        torsional_constant=54600.0
    ),
    "300x200x10.0RHS": SectionProperties(
        designation="300x200x10.0RHS",
        section_type=SectionType.RHS,
        depth=300.0, width=200.0, web_thickness=10.0, flange_thickness=10.0,
        area=94.0, mass_per_meter=73.9,
        Iyy=28400.0, Izz=14200.0, iyy=17.4, izz=12.3,
        torsional_constant=32400.0
    ),
    "250x150x10.0RHS": SectionProperties(
        designation="250x150x10.0RHS",
        section_type=SectionType.RHS,
        depth=250.0, width=150.0, web_thickness=10.0, flange_thickness=10.0,
        area=74.0, mass_per_meter=58.3,
        Iyy=15900.0, Izz=6950.0, iyy=14.7, izz=9.70,
        torsional_constant=17200.0
    ),
    "200x120x8.0RHS": SectionProperties(
        designation="200x120x8.0RHS",
        section_type=SectionType.RHS,
        depth=200.0, width=120.0, web_thickness=8.0, flange_thickness=8.0,
        area=47.7, mass_per_meter=37.5,
        Iyy=6990.0, Izz=2920.0, iyy=12.1, izz=7.82,
        torsional_constant=7520.0
    ),
    "150x100x6.3RHS": SectionProperties(
        designation="150x100x6.3RHS",
        section_type=SectionType.RHS,
        depth=150.0, width=100.0, web_thickness=6.3, flange_thickness=6.3,
        area=29.7, mass_per_meter=23.3,
        Iyy=3000.0, Izz=1410.0, iyy=10.0, izz=6.89,
        torsional_constant=3280.0
    ),
}


def get_section_properties(designation: str) -> Optional[SectionProperties]:
    """Retrieve section properties by designation."""
    all_sections = {
        **BS_UNIVERSAL_BEAMS,
        **BS_UNIVERSAL_COLUMNS,
        **BS_PFC,
        **BS_EQUAL_ANGLES,
        **BS_CHS,
        **BS_SHS,
        **BS_RHS
    }
    return all_sections.get(designation)