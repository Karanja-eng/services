import pandas as pd 
import numpy as np

###########################################
#######Spcing of Bars
# Dataset stored as a list of dictionaries
data = [
    {"Bar Diameter (mm)": d, "Spacing (mm)": s, "Area of Steel (mm²/m)": a}
    for d, row in {
        6: [566, 377, 283, 226, 189, 162, 142, 113, 94.3],
        8: [1010, 671, 503, 402, 335, 287, 252, 201, 168],
        10: [1570, 1050, 785, 628, 523, 448, 393, 314, 262],
        12: [2260, 1510, 1130, 905, 754, 647, 566, 452, 377],
        16: [4020, 2680, 2010, 1610, 1340, 1150, 1010, 804, 670],
        20: [6280, 4190, 3140, 2510, 2090, 1800, 1570, 1260, 1050],
        25: [9820, 6550, 4910, 3930, 3270, 2810, 2460, 1960, 1640],
        32: [16100, 10700, 8040, 6430, 5360, 4600, 4020, 3220, 2680],
        40: [25100, 16800, 12600, 10100, 8380, 7180, 6280, 5030, 4190]
    }.items()
    for s, a in zip([50, 75, 100, 125, 150, 175, 200, 250, 300], row)
]


def get_bar_spacing(required_area, bar_diameter):
    
    # Filter for matching bar diameter
    matches = [row for row in data if row["Bar Diameter (mm)"] == bar_diameter]
    if not matches:
        return f"Error: Bar diameter {bar_diameter} mm not found in dataset."
    # Filter for area ≥ required_area
    suitable = [row for row in matches if row["Area of Steel (mm²/m)"] >= required_area]
    if not suitable:
        return f"Error: No spacing provides ≥ {required_area} mm²/m for bar diameter {bar_diameter} mm."
    # Select the entry with the minimum area that satisfies the requirement
    selected = min(suitable, key=lambda x: x["Area of Steel (mm²/m)"])
    spacing = int(selected["Spacing (mm)"])
    area_used = selected['Area of Steel (mm²/m)']
    
    return spacing, area_used



######################################################
#####Number of Bars
data_table_3_10 = {
    6: [(1, 28.3), (2, 56.6), (3, 84.9), (4, 113), (5, 142), (6, 170), (7, 198), (8, 226), (9, 255), (10, 283)],
    8: [(1, 50.3), (2, 101), (3, 151), (4, 201), (5, 252), (6, 302), (7, 352), (8, 402), (9, 453), (10, 503)],
    10: [(1, 78.5), (2, 157), (3, 236), (4, 314), (5, 393), (6, 471), (7, 550), (8, 628), (9, 707), (10, 785)],
    12: [(1, 113), (2, 226), (3, 339), (4, 452), (5, 565), (6, 678), (7, 791), (8, 904), (9, 1017), (10, 1130)],
    16: [(1, 201), (2, 402), (3, 603), (4, 804), (5, 1010), (6, 1210), (7, 1410), (8, 1610), (9, 1810), (10, 2010)],
    20: [(1, 314), (2, 628), (3, 942), (4, 1260), (5, 1570), (6, 1880), (7, 2200), (8, 2510), (9, 2830), (10, 3140)],
    25: [(1, 491), (2, 982), (3, 1470), (4, 1960), (5, 2450), (6, 2940), (7, 3430), (8, 3920), (9, 4410), (10, 4910)],
    32: [(1, 804), (2, 1610), (3, 2410), (4, 3220), (5, 4020), (6, 4830), (7, 5630), (8, 6430), (9, 7240), (10, 8040)],
    40: [(1, 1260), (2, 2510), (3, 3770), (4, 5030), (5, 6280), (6, 7540), (7, 8800), (8, 10100), (9, 11300), (10, 12600)]
}
def get_number_of_bars(diameter, required_area):
    if diameter not in data_table_3_10:
        return f"Error: Diameter {diameter} mm not found in the dataset."
    options = data_table_3_10[diameter]
    for num_bars, area in options:
        if area >= required_area:
            return num_bars, diameter, area
    return f"Error: Required area {required_area} mm² exceeds the maximum available for diameter {diameter} mm."

##############################################
######Shear Coefficients Two way spanning
import pandas as pd
import numpy as np

# Data restructured to ensure consistent length
data = {
    "Type of Panel and Location": [],
    "l_y/l_x": [],
    "Shear Coefficient, β_sx": [],
    "Shear Coefficient, β_sy": []
}

# Panel types and locations
panel_types = [
    "Four edges continuous",
    "One short edge discontinuous",
    "Two adjacent edges discontinuous",
    "Two short edges discontinuous",
    "Two long edges discontinuous",
    "Three edges discontinuous (one edge continuous)",
    "Three edges discontinuous (one short edge continuous)",
    "Four edges discontinuous"
]
edge_conditions = ["Continuous edge", "Discontinuous edge"]

ly_lx_values = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0]

# Coefficients data (matching Table 3.16)
coefficients = {
    "Four edges continuous": {
        "Continuous edge": [0.33, 0.36, 0.39, 0.41, 0.43, 0.45, 0.48, 0.50],
        "Discontinuous edge": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Shear Coefficient, β_sy": [0.33, 0.36, 0.39, 0.41, 0.43, 0.45, 0.48, 0.50]
    },
    "One short edge discontinuous": {
        "Continuous edge": [0.36, 0.39, 0.42, 0.44, 0.45, 0.47, 0.50, 0.52],
        "Discontinuous edge": [0.24, 0.27, 0.29, 0.31, 0.32, 0.34, 0.36, 0.38],
        "Shear Coefficient, β_sy": [0.36, 0.39, 0.42, 0.44, 0.45, 0.47, 0.50, 0.52]
    },
    "Two adjacent edges discontinuous": {
        "Continuous edge": [0.40, 0.44, 0.47, 0.50, 0.52, 0.54, 0.57, 0.60],
        "Discontinuous edge": [0.26, 0.29, 0.31, 0.33, 0.34, 0.35, 0.38, 0.40],
        "Shear Coefficient, β_sy": [0.40, 0.44, 0.47, 0.50, 0.52, 0.54, 0.57, 0.60]
    },
    "Two short edges discontinuous": {
        "Continuous edge": [0.40, 0.43, 0.45, 0.47, 0.48, 0.49, 0.52, 0.54],
        "Discontinuous edge": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 0.26],
        "Shear Coefficient, β_sy": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 0.26]
    },
    "Two long edges discontinuous": {
        "Continuous edge": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 0.40],
        "Discontinuous edge": [0.26, 0.30, 0.33, 0.36, 0.38, 0.40, 0.44, 0.47],
        "Shear Coefficient, β_sy": [0.26, 0.30, 0.33, 0.36, 0.38, 0.40, 0.44, 0.47]
    },
    "Three edges discontinuous (one edge continuous)": {
        "Continuous edge": [0.45, 0.48, 0.51, 0.53, 0.55, 0.57, 0.60, 0.63],
        "Discontinuous edge": [0.30, 0.32, 0.34, 0.35, 0.36, 0.37, 0.39, 0.41],
        "Shear Coefficient, β_sy": [0.30, 0.32, 0.34, 0.35, 0.36, 0.37, 0.39, 0.41]
    },
    "Three edges discontinuous (one short edge continuous)": {
        "Continuous edge": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 0.45],
        "Discontinuous edge": [0.29, 0.33, 0.36, 0.38, 0.40, 0.42, 0.45, 0.48],
        "Shear Coefficient, β_sy": [0.29, 0.33, 0.36, 0.38, 0.40, 0.42, 0.45, 0.48]
    },
    "Four edges discontinuous": {
        "Continuous edge": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Discontinuous edge": [0.33, 0.36, 0.39, 0.41, 0.43, 0.45, 0.48, 0.50],
        "Shear Coefficient, β_sy": [0.33, 0.36, 0.39, 0.41, 0.43, 0.45, 0.48, 0.50]
    }
}

# Populate the data dictionary
for panel in panel_types:
    for edge in edge_conditions:
        for i, ly_lx in enumerate(ly_lx_values):
            data["Type of Panel and Location"].append(f"{panel} - {edge}")
            data["l_y/l_x"].append(ly_lx)
            # Use get() to avoid KeyError, default to np.nan if not present
            sx_value = coefficients[panel].get(edge, [np.nan] * 8)[i]
            sy_value = coefficients[panel].get("Shear Coefficient, β_sy", [np.nan] * 8)[i]
            data["Shear Coefficient, β_sx"].append(sx_value)
            data["Shear Coefficient, β_sy"].append(sy_value)

# Create DataFrame
df = pd.DataFrame(data)

# Fill NaN values with the last valid observation forward where applicable
df["Shear Coefficient, β_sx"] = df["Shear Coefficient, β_sx"].fillna(method='ffill')
df["Shear Coefficient, β_sy"] = df["Shear Coefficient, β_sy"].fillna(method='ffill')

# Display the DataFrame


# Save to CSV
# df.to_csv("shear_force_coefficients.csv", index=False)


def get_shear_coefficients(panel_type, edge_condition, ly_lx):
    full_type = f"{panel_type} - {edge_condition}"
    row = df[df["Type of Panel and Location"] == full_type]
    
    if row.empty:
        return f"Error: Invalid panel type or edge condition: {full_type}"
    
    # Get the closest l_y/l_x value
    available_ratios = row["l_y/l_x"].values
    if not available_ratios.size:
        return f"Error: No data available for {full_type}"
    closest_ratio = min(available_ratios, key=lambda x: abs(x - ly_lx))
    
    # Get the coefficients for the closest ratio
    beta_sx = row[row["l_y/l_x"] == closest_ratio]["Shear Coefficient, β_sx"].values[0]
    beta_sy = row[row["l_y/l_x"] == closest_ratio]["Shear Coefficient, β_sy"].values[0]
    
    # If ly_lx is out of range, use the nearest boundary value
    if ly_lx <= min(available_ratios):
        beta_sx = row[row["l_y/l_x"] == min(available_ratios)]["Shear Coefficient, β_sx"].values[0]
        beta_sy = row[row["l_y/l_x"] == min(available_ratios)]["Shear Coefficient, β_sy"].values[0]
    elif ly_lx >= max(available_ratios):
        beta_sx = row[row["l_y/l_x"] == max(available_ratios)]["Shear Coefficient, β_sx"].values[0]
        beta_sy = row[row["l_y/l_x"] == max(available_ratios)]["Shear Coefficient, β_sy"].values[0]
    
    return {"β_sx": beta_sx, "β_sy": beta_sy}


################################################################
###########Moments Coefficients two way spanning


import pandas as pd
import numpy as np

# Data restructured to ensure consistent length
data = {
    "Type of Panel and Moments Considered": [],
    "l_y/l_x": [],
    "Short Span Coefficient, β_sx": [],
    "Long Span Coefficient, β_sy": []
}

# Populate data for each panel type and moment type
panel_types = [
    "Interior panels",
    "One short edge discontinuous",
    "One long edge discontinuous",
    "Two adjacent edges discontinuous",
    "Two short edges discontinuous",
    "Two long edges discontinuous",
    "Three edges discontinuous - one long edge continuous",
    "Three edges discontinuous - one short edge continuous",
    "Three edges discontinuous"
]
moment_types = ["Negative moment at continuous edge, β_sx", "Positive moment at mid-span, β_sx",
                "Negative moment at continuous edge, β_sy", "Positive moment at mid-span, β_sy"]
ly_lx_values = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0]

# Coefficients data (matching the table with consistent length)
coefficients = {
    "Interior panels": {
        "Negative moment at continuous edge, β_sx": [0.031, 0.037, 0.042, 0.046, 0.050, 0.053, 0.059, 0.063],
        "Positive moment at mid-span, β_sx": [0.024, 0.028, 0.032, 0.035, 0.037, 0.040, 0.044, 0.048],
        "Negative moment at continuous edge, β_sy": [0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032],
        "Positive moment at mid-span, β_sy": [0.024, 0.024, 0.024, 0.024, 0.024, 0.024, 0.024, 0.024]
    },
    "One short edge discontinuous": {
        "Negative moment at continuous edge, β_sx": [0.039, 0.044, 0.048, 0.052, 0.055, 0.058, 0.063, 0.067],
        "Positive moment at mid-span, β_sx": [0.029, 0.033, 0.036, 0.039, 0.041, 0.043, 0.047, 0.050],
        "Negative moment at continuous edge, β_sy": [0.037, 0.037, 0.037, 0.037, 0.037, 0.037, 0.037, 0.037],
        "Positive moment at mid-span, β_sy": [0.028, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028]
    },
    "One long edge discontinuous": {
        "Negative moment at continuous edge, β_sx": [0.039, 0.049, 0.056, 0.063, 0.068, 0.073, 0.082, 0.089],
        "Positive moment at mid-span, β_sx": [0.030, 0.036, 0.042, 0.047, 0.051, 0.055, 0.062, 0.067],
        "Negative moment at continuous edge, β_sy": [0.037, 0.037, 0.037, 0.037, 0.037, 0.037, 0.037, 0.037],
        "Positive moment at mid-span, β_sy": [0.028, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028]
    },
    "Two adjacent edges discontinuous": {
        "Negative moment at continuous edge, β_sx": [0.047, 0.056, 0.063, 0.069, 0.074, 0.078, 0.087, 0.093],
        "Positive moment at mid-span, β_sx": [0.036, 0.042, 0.047, 0.051, 0.055, 0.059, 0.065, 0.070],
        "Negative moment at continuous edge, β_sy": [0.045, 0.045, 0.045, 0.045, 0.045, 0.045, 0.045, 0.045],
        "Positive moment at mid-span, β_sy": [0.034, 0.034, 0.034, 0.034, 0.034, 0.034, 0.034, 0.034]
    },
    "Two short edges discontinuous": {
        "Negative moment at continuous edge, β_sx": [0.046, 0.050, 0.054, 0.057, 0.060, 0.062, 0.067, 0.070],
        "Positive moment at mid-span, β_sx": [0.034, 0.038, 0.040, 0.043, 0.045, 0.047, 0.050, 0.053],
        "Negative moment at continuous edge, β_sy": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Positive moment at mid-span, β_sy": [0.034, 0.034, 0.034, 0.034, 0.034, 0.034, 0.034, 0.034]
    },
    "Two long edges discontinuous": {
        "Negative moment at continuous edge, β_sx": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Positive moment at mid-span, β_sx": [0.034, 0.046, 0.056, 0.065, 0.072, 0.078, 0.091, 0.100],  # Corrected to 8 values
        "Negative moment at continuous edge, β_sy": [0.045, 0.045, 0.045, 0.045, 0.045, 0.045, 0.045, 0.045],
        "Positive moment at mid-span, β_sy": [0.034, 0.034, 0.034, 0.034, 0.034, 0.034, 0.034, 0.034]
    },
    "Three edges discontinuous - one long edge continuous": {
        "Negative moment at continuous edge, β_sx": [0.057, 0.065, 0.071, 0.076, 0.081, 0.084, 0.092, 0.098],
        "Positive moment at mid-span, β_sx": [0.043, 0.048, 0.053, 0.057, 0.060, 0.063, 0.069, 0.074],
        "Negative moment at continuous edge, β_sy": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Positive moment at mid-span, β_sy": [0.044, 0.044, 0.044, 0.044, 0.044, 0.044, 0.044, 0.044]
    },
    "Three edges discontinuous - one short edge continuous": {
        "Negative moment at continuous edge, β_sx": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Positive moment at mid-span, β_sx": [0.042, 0.054, 0.063, 0.071, 0.078, 0.084, 0.096, 0.105],
        "Negative moment at continuous edge, β_sy": [0.058, 0.058, 0.058, 0.058, 0.058, 0.058, 0.058, 0.058],
        "Positive moment at mid-span, β_sy": [0.044, 0.044, 0.044, 0.044, 0.044, 0.044, 0.044, 0.044]
    },
    "Three edges discontinuous": {
        "Negative moment at continuous edge, β_sx": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Positive moment at mid-span, β_sx": [0.055, 0.065, 0.074, 0.081, 0.087, 0.092, 0.103, 0.111],
        "Negative moment at continuous edge, β_sy": [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        "Positive moment at mid-span, β_sy": [0.056, 0.056, 0.056, 0.056, 0.056, 0.056, 0.056, 0.056]
    }
}

# Populate the data dictionary
for panel in panel_types:
    for moment in moment_types:
        for i, ly_lx in enumerate(ly_lx_values):
            data["Type of Panel and Moments Considered"].append(f"{panel} - {moment}")
            data["l_y/l_x"].append(ly_lx)
            # Use get() to avoid KeyError for missing moment types, default to np.nan
            sx_value = coefficients[panel].get(moment, [np.nan] * 8)[i]
            sy_value = coefficients[panel].get(moment.replace("β_sx", "β_sy"), [np.nan] * 8)[i] if "β_sx" in moment else sx_value
            data["Short Span Coefficient, β_sx"].append(sx_value)
            data["Long Span Coefficient, β_sy"].append(sy_value)

# Create DataFrame
df = pd.DataFrame(data)

# Fill NaN values with the last valid observation forward where applicable
# df["Long Span Coefficient, β_sy"] = df["Long Span Coefficient, β_sy"].fillna(method='ffill')

# Display the DataFrame
# print(df)

# Save to CSV
df.to_csv("bending_moment_coefficients.csv", index=False)

# Function to get bending moment coefficient
def get_bending_moment_coefficient(panel_type, moment_type, ly_lx):
    full_type = f"{panel_type} - {moment_type}"
    row = df[df["Type of Panel and Moments Considered"] == full_type]
    
    if row.empty:
        return f"Error: Invalid panel type or moment type: {full_type}"
    
    # Get the closest l_y/l_x value
    available_ratios = row["l_y/l_x"].values
    closest_ratio = min(available_ratios, key=lambda x: abs(x - ly_lx))
    
    # Get the coefficient for the closest ratio
    coefficient = row[row["l_y/l_x"] == closest_ratio]["Short Span Coefficient, β_sx"].values[0]
    long_span_coeff = row[row["l_y/l_x"] == closest_ratio]["Long Span Coefficient, β_sy"].values[0]
    
    # If ly_lx is out of range, use long span coefficient
    if ly_lx <= min(available_ratios) or ly_lx >= max(available_ratios):
        return long_span_coeff
    
    return coefficient if not np.isnan(coefficient) else long_span_coeff



#############################################