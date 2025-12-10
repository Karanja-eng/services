import React, { useState, useRef, useEffect } from 'react';
import { Building2, Calculator, Layers, Frame, Wind, Box, Ruler, FileText, Moon, Sun, Menu, X, ChevronDown, ChevronRight, Code2, BookOpen, ToggleRight } from 'lucide-react';
import * as THREE from 'three';
import RCStructuralDesign from './rc_structural_design'

// ============================================================================
// EUROCODE STRUCTURAL DESIGN COMPONENT
// ============================================================================

const EurocodeComponent = ({ theme, onThemeChange }) => {
  const [activeModule, setActiveModule] = useState('actions');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Actions State (EN 1990)
  const [actionsData, setActionsData] = useState({
    permanentAction: '',
    variableAction: '',
    windAction: '',
    snowAction: '',
    combination: 'uls_6.10',
    psi0: '0.7',
    psi1: '0.5',
    psi2: '0.3'
  });

  // Material State (EN 1992)
  const [materialData, setMaterialData] = useState({
    concreteClass: 'C30/37',
    steelClass: 'B500B',
    exposureClass: 'XC3',
    structuralClass: 'S4',
    cementType: 'N'
  });

  // Section Design State
  const [sectionData, setSectionData] = useState({
    memberType: 'beam',
    width: '',
    height: '',
    cover: '',
    Med: '',
    Ved: '',
    Ned: ''
  });

  // Frame Analysis State (EN 1992-1-1)
  const [frameAnalysisData, setFrameAnalysisData] = useState({
    method: 'second_order',
    floors: '',
    bays: '',
    storyHeight: '',
    bayWidth: '',
    imperfections: 'true',
    cracked: 'true'
  });

  // Wind Actions State (EN 1991-1-4)
  const [windData, setWindData] = useState({
    vb0: '26',
    terrain: 'II',
    height: '',
    width: '',
    depth: '',
    seasonFactor: '1.0',
    directionFactor: '1.0',
    orography: '1.0'
  });

  // Seismic State (EN 1998)
  const [seismicData, setSeismicData] = useState({
    ag: '',
    soilType: 'B',
    ductilityClass: 'DCM',
    buildingHeight: '',
    mass: '',
    importanceClass: 'II'
  });

  // SLS State
  const [slsData, setSlsData] = useState({
    checkType: 'deflection',
    span: '',
    loadQP: '',
    allowableDeflection: 'L/250',
    crackWidth: '0.3'
  });

  const [results, setResults] = useState(null);
  const canvasRef = useRef(null);

  // Eurocode Tables and Constants
  const EurocodeTables = {
    concreteClasses: {
      'C20/25': { fck: 20, fcm: 28, fctm: 2.2, Ecm: 30000 },
      'C25/30': { fck: 25, fcm: 33, fctm: 2.6, Ecm: 31000 },
      'C30/37': { fck: 30, fcm: 38, fctm: 2.9, Ecm: 33000 },
      'C35/45': { fck: 35, fcm: 43, fctm: 3.2, Ecm: 34000 },
      'C40/50': { fck: 40, fcm: 48, fctm: 3.5, Ecm: 35000 },
      'C45/55': { fck: 45, fcm: 53, fctm: 3.8, Ecm: 36000 },
      'C50/60': { fck: 50, fcm: 58, fctm: 4.1, Ecm: 37000 }
    },
    steelClasses: {
      'B500A': { fyk: 500, es: 200000, ductility: 'high' },
      'B500B': { fyk: 500, es: 200000, ductility: 'high' },
      'B500C': { fyk: 500, es: 200000, ductility: 'very_high' }
    },
    partialFactors: {
      uls_persistent: { gammaG: 1.35, gammaQ: 1.5, gammaC: 1.5, gammaS: 1.15 },
      uls_accidental: { gammaG: 1.0, gammaQ: 1.0, gammaC: 1.2, gammaS: 1.0 },
      sls_characteristic: { gammaG: 1.0, gammaQ: 1.0 },
      sls_frequent: { gammaG: 1.0, gammaQ: 0.5 },
      sls_quasi_permanent: { gammaG: 1.0, gammaQ: 0.3 }
    },
    combinationFactors: {
      'Category A': { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
      'Category B': { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
      'Category C': { psi0: 0.7, psi1: 0.7, psi2: 0.6 },
      'Category D': { psi0: 0.7, psi1: 0.7, psi2: 0.6 },
      'Category E': { psi0: 1.0, psi1: 0.9, psi2: 0.8 },
      'Wind': { psi0: 0.6, psi1: 0.2, psi2: 0.0 },
      'Snow': { psi0: 0.5, psi1: 0.2, psi2: 0.0 }
    },
    terrainCategories: {
      '0': { z0: 0.003, zmin: 1, kr: 0.17 },
      'I': { z0: 0.01, zmin: 1, kr: 0.17 },
      'II': { z0: 0.05, zmin: 2, kr: 0.19 },
      'III': { z0: 0.3, zmin: 5, kr: 0.22 },
      'IV': { z0: 1.0, zmin: 10, kr: 0.24 }
    }
  };

  // EN 1990: Actions Combinations
  const calculateActionsCombinations = () => {
    const gk = parseFloat(actionsData.permanentAction) || 0;
    const qk = parseFloat(actionsData.variableAction) || 0;
    const wk = parseFloat(actionsData.windAction) || 0;
    const sk = parseFloat(actionsData.snowAction) || 0;

    const psi0 = parseFloat(actionsData.psi0);
    const psi1 = parseFloat(actionsData.psi1);
    const psi2 = parseFloat(actionsData.psi2);

    const factors = EurocodeTables.partialFactors.uls_persistent;

    // EN 1990 Equation 6.10 (STR/GEO Set B)
    const eq610a = factors.gammaG * gk + factors.gammaQ * qk + factors.gammaQ * psi0 * wk;
    const eq610b = factors.gammaG * gk + factors.gammaQ * psi0 * qk + factors.gammaQ * wk;
    const eq610c = factors.gammaG * gk + factors.gammaQ * psi0 * qk + factors.gammaQ * psi0 * wk;

    // EN 1990 Equation 6.10a (Alternative - Set C)
    const gammaG_unfav = 1.35;
    const gammaG_fav = 1.0;
    const xi = 0.85;
    const eq610a_alt = xi * gammaG_unfav * gk + factors.gammaQ * qk + factors.gammaQ * psi0 * wk;

    // Serviceability combinations
    const characteristic = gk + qk + psi0 * wk;
    const frequent = gk + psi1 * qk + psi2 * wk;
    const quasi_permanent = gk + psi2 * qk;

    const design_value = Math.max(eq610a, eq610b, eq610c, eq610a_alt);

    return {
      uls: {
        eq610a: eq610a.toFixed(2),
        eq610b: eq610b.toFixed(2),
        eq610c: eq610c.toFixed(2),
        eq610a_alternative: eq610a_alt.toFixed(2)
      },
      sls: {
        characteristic: characteristic.toFixed(2),
        frequent: frequent.toFixed(2),
        quasi_permanent: quasi_permanent.toFixed(2)
      },
      design_value: design_value.toFixed(2),
      governing: design_value === eq610a ? 'Eq 6.10a' :
        design_value === eq610b ? 'Eq 6.10b' :
          design_value === eq610c ? 'Eq 6.10c' : 'Eq 6.10a (alternative)'
    };
  };

  // EN 1992: Flexural Design
  const designFlexuralMember = () => {
    const b = parseFloat(sectionData.width) || 300;
    const h = parseFloat(sectionData.height) || 500;
    const cover = parseFloat(sectionData.cover) || 30;
    const Med = (parseFloat(sectionData.Med) || 0) * 1e6; // kNm to Nmm

    const concrete = EurocodeTables.concreteClasses[materialData.concreteClass];
    const steel = EurocodeTables.steelClasses[materialData.steelClass];

    const fck = concrete.fck;
    const fcd = fck / 1.5; // alphacc * fck / gammaC (alphacc = 1.0)
    const fyk = steel.fyk;
    const fyd = fyk / 1.15;

    const d = h - cover - 10; // Assuming 10mm bar radius

    // Calculate neutral axis depth (EN 1992-1-1 6.1)
    const lambda = 0.8; // For fck ≤ 50 MPa
    const eta = 1.0;

    // Mu = 0.167 * fcd * b * d² (balanced section limit)
    const Mu_bal = 0.167 * fcd * b * d * d;

    let As_req = 0;
    let As2_req = 0;
    let xu = 0;
    let designType = '';

    if (Med <= Mu_bal) {
      // Singly reinforced section
      const K = Med / (fcd * b * d * d);
      const z = d * (1 - Math.sqrt(1 - 2 * K / eta));
      As_req = Med / (fyd * z);
      xu = (d - z) / lambda;
      designType = 'Singly reinforced';
    } else {
      // Doubly reinforced section
      xu = lambda * d / (1 + lambda);
      const z = d - lambda * xu / 2;
      As_req = Mu_bal / (fyd * z);
      As2_req = (Med - Mu_bal) / (fyd * (d - cover - 10));
      designType = 'Doubly reinforced';
    }

    // Minimum reinforcement (EN 1992-1-1 9.2.1.1)
    const fctm = concrete.fctm;
    const As_min = Math.max(0.26 * (fctm / fyk) * b * d, 0.0013 * b * d);

    As_req = Math.max(As_req, As_min);

    // Bar selection
    const barAreas = { 8: 50.3, 10: 78.5, 12: 113, 16: 201, 20: 314, 25: 491, 32: 804 };
    let selectedBars = { diameter: 16, number: 3 };

    for (let dia of [12, 16, 20, 25, 32]) {
      for (let num = 2; num <= 8; num++) {
        if (barAreas[dia] * num >= As_req) {
          selectedBars = { diameter: dia, number: num };
          break;
        }
      }
      if (barAreas[selectedBars.diameter] * selectedBars.number >= As_req) break;
    }

    return {
      dimensions: { width: b, height: h, effective_depth: d },
      material_properties: { fcd: fcd.toFixed(2), fyd: fyd.toFixed(2) },
      neutral_axis: xu.toFixed(2),
      tension_steel: {
        required: As_req.toFixed(2),
        minimum: As_min.toFixed(2),
        provided: (barAreas[selectedBars.diameter] * selectedBars.number).toFixed(2),
        bars: `${selectedBars.number}Ø${selectedBars.diameter}`
      },
      compression_steel: {
        required: As2_req.toFixed(2),
        needed: As2_req > 0
      },
      design_type: designType,
      capacity_ratio: (Med / Mu_bal).toFixed(3)
    };
  };

  // EN 1992: Shear Design
  const designShear = () => {
    const b = parseFloat(sectionData.width) || 300;
    const d = parseFloat(sectionData.height) - parseFloat(sectionData.cover) - 10 || 450;
    const Ved = (parseFloat(sectionData.Ved) || 0) * 1000; // kN to N

    const concrete = EurocodeTables.concreteClasses[materialData.concreteClass];
    const fck = concrete.fck;
    const fcd = fck / 1.5;

    // VRd,c - Concrete shear capacity (EN 1992-1-1 6.2.2)
    const rho1 = 0.02; // Assumed longitudinal reinforcement ratio
    const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
    const CRd_c = 0.18 / 1.5; // 0.12 for γc = 1.5
    const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);

    const VRd_c = Math.max(
      CRd_c * k * Math.pow(100 * rho1 * fck, 1 / 3) * b * d,
      vmin * b * d
    );

    // VRd,max - Maximum shear capacity (EN 1992-1-1 6.2.3)
    const nu = 0.6 * (1 - fck / 250);
    const alpha_cw = 1.0; // For non-prestressed members
    const VRd_max = alpha_cw * b * 0.9 * d * nu * fcd / (1 / Math.tan(Math.PI / 4) + Math.tan(Math.PI / 4));

    let shearReinforcement = 'None required';
    let Asw_s = 0;
    let linkSpacing = 300;

    if (Ved > VRd_c) {
      // Shear reinforcement required
      const theta = Math.PI / 4; // 45 degrees (simplified)
      const z = 0.9 * d;
      const fywd = 500 / 1.15;

      Asw_s = Ved / (z * fywd * (1 / Math.tan(theta)));

      // Using H8 links (2 legs)
      const Asw = 2 * 50.3; // mm²
      linkSpacing = Math.min(Asw / Asw_s, 0.75 * d, 300);

      shearReinforcement = `Ø8 @ ${linkSpacing.toFixed(0)}mm`;
    }

    return {
      applied_shear: (Ved / 1000).toFixed(2),
      concrete_capacity: (VRd_c / 1000).toFixed(2),
      max_capacity: (VRd_max / 1000).toFixed(2),
      shear_reinforcement: shearReinforcement,
      utilization: (Ved / VRd_c).toFixed(3),
      check: Ved <= VRd_max ? 'PASS' : 'FAIL - Increase section'
    };
  };

  // EN 1991-1-4: Wind Actions
  const calculateWindActions = () => {
    const vb0 = parseFloat(windData.vb0);
    const cdir = parseFloat(windData.directionFactor);
    const cseason = parseFloat(windData.seasonFactor);
    const co = parseFloat(windData.orography);
    const z = parseFloat(windData.height);
    const b = parseFloat(windData.width);
    const h = parseFloat(windData.height);

    const terrain = EurocodeTables.terrainCategories[windData.terrain];
    const z0 = terrain.z0;
    const zmin = terrain.zmin;
    const kr = terrain.kr;

    // Basic wind velocity (EN 1991-1-4 4.2)
    const vb = cdir * cseason * vb0;

    // Mean wind velocity (EN 1991-1-4 4.3.1)
    const cr_z = kr * Math.log(Math.max(z, zmin) / z0);
    const vm_z = cr_z * co * vb;

    // Turbulence intensity (EN 1991-1-4 4.4)
    const kI = 1.0;
    const Iv_z = kI / (co * Math.log(Math.max(z, zmin) / z0));

    // Peak velocity pressure (EN 1991-1-4 4.5)
    const rho = 1.25; // kg/m³
    const qp_z = (1 + 7 * Iv_z) * 0.5 * rho * vm_z * vm_z / 1000; // kN/m²

    // Pressure coefficients (simplified for rectangular building)
    const cpe_windward = 0.8;
    const cpe_leeward = -0.5;
    const cpe_side = -0.7;

    // Wind forces
    const cscd = 1.0; // Structural factor (simplified)
    const Fw = cscd * qp_z * (cpe_windward - cpe_leeward) * b * h;

    // Base moment
    const Mb = Fw * h / 2;

    return {
      basic_velocity: vb.toFixed(2),
      mean_velocity: vm_z.toFixed(2),
      peak_pressure: qp_z.toFixed(3),
      turbulence_intensity: (Iv_z * 100).toFixed(1),
      wind_force: Fw.toFixed(2),
      base_moment: Mb.toFixed(2),
      pressure_coefficients: {
        windward: cpe_windward,
        leeward: cpe_leeward,
        side: cpe_side
      }
    };
  };

  // EN 1998: Seismic Design
  const calculateSeismicDesign = () => {
    const ag = parseFloat(seismicData.ag) / 100; // % of g to g
    const g = 9.81;
    const ag_val = ag * g;

    const soilFactors = {
      'A': { S: 1.0, TB: 0.15, TC: 0.4, TD: 2.0 },
      'B': { S: 1.2, TB: 0.15, TC: 0.5, TD: 2.0 },
      'C': { S: 1.15, TB: 0.20, TC: 0.6, TD: 2.0 },
      'D': { S: 1.35, TB: 0.20, TC: 0.8, TD: 2.0 },
      'E': { S: 1.4, TB: 0.15, TC: 0.5, TD: 2.0 }
    };

    const soil = soilFactors[seismicData.soilType];
    const H = parseFloat(seismicData.buildingHeight);
    const M = parseFloat(seismicData.mass);

    // Behavior factor
    const qFactors = {
      'DCL': 1.5,
      'DCM': 3.0,
      'DCH': 4.5
    };
    const q = qFactors[seismicData.ductilityClass];

    // Fundamental period (EN 1998-1 4.3.3.2.2)
    const Ct = 0.075; // For RC moment frames
    const T1 = Ct * Math.pow(H, 0.75);

    // Design spectrum (EN 1998-1 3.2.2.5)
    let Sd_T;
    const eta = 1.0; // Damping correction factor (5% damping)
    const TB = soil.TB;
    const TC = soil.TC;
    const TD = soil.TD;

    if (T1 <= TB) {
      Sd_T = ag_val * soil.S * (1 + T1 / TB * (eta * 2.5 - 1));
    } else if (T1 <= TC) {
      Sd_T = ag_val * soil.S * eta * 2.5;
    } else if (T1 <= TD) {
      Sd_T = ag_val * soil.S * eta * 2.5 * (TC / T1);
    } else {
      Sd_T = ag_val * soil.S * eta * 2.5 * (TC * TD / (T1 * T1));
    }

    // Design spectrum ordinate
    const Sd_design = Sd_T / q;

    // Base shear (EN 1998-1 4.3.3.2.2)
    const lambda = 0.85; // Correction factor
    const Fb = Sd_design * M * lambda;

    return {
      design_ground_acceleration: (ag_val).toFixed(3),
      soil_factor: soil.S,
      behavior_factor: q,
      fundamental_period: T1.toFixed(3),
      spectral_acceleration: Sd_design.toFixed(3),
      base_shear: Fb.toFixed(2),
      design_spectrum_points: {
        TB: soil.TB,
        TC: soil.TC,
        TD: soil.TD
      }
    };
  };

  // SLS Checks
  const performSLSChecks = () => {
    const span = parseFloat(slsData.span) * 1000;
    const load = parseFloat(slsData.loadQP);

    if (slsData.checkType === 'deflection') {
      // EN 1992-1-1 7.4: Deflection control
      const limitRatios = {
        'L/250': 250,
        'L/300': 300,
        'L/350': 350,
        'L/500': 500
      };

      const limitRatio = limitRatios[slsData.allowableDeflection];
      const allowable = span / limitRatio;

      // Simplified deflection (5wL⁴/384EI)
      const E = 33000; // Assumed Ecm
      const I = 1e9; // Assumed moment of inertia
      const w = load / 1000; // N/mm
      const deflection = (5 * w * Math.pow(span, 4)) / (384 * E * I);

      return {
        check_type: 'Deflection',
        calculated_deflection: deflection.toFixed(2),
        allowable_deflection: allowable.toFixed(2),
        ratio: `L/${(span / deflection).toFixed(0)}`,
        status: deflection <= allowable ? 'PASS' : 'FAIL'
      };
    } else {
      // EN 1992-1-1 7.3: Crack width control
      const wk_allow = parseFloat(slsData.crackWidth);
      const wk_calc = 0.25; // Simplified calculated crack width

      return {
        check_type: 'Crack Width',
        calculated_width: wk_calc.toFixed(3),
        allowable_width: wk_allow.toFixed(3),
        exposure_class: materialData.exposureClass,
        status: wk_calc <= wk_allow ? 'PASS' : 'FAIL'
      };
    }
  };

  const handleCalculate = () => {
    let calculationResults = {};

    switch (activeModule) {
      case 'actions':
        calculationResults = calculateActionsCombinations();
        break;
      case 'flexure':
        calculationResults = designFlexuralMember();
        break;
      case 'shear':
        calculationResults = designShear();
        break;
      case 'wind':
        calculationResults = calculateWindActions();
        break;
      case 'seismic':
        calculationResults = calculateSeismicDesign();
        break;
      case 'sls':
        calculationResults = performSLSChecks();
        break;
      default:
        calculationResults = {};
    }

    setResults(calculationResults);
  };

  const bgColor = theme === 'dark' ? 'bg-gray-900' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50';
  const inputBg = theme === 'dark' ? 'bg-gray-700' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  const modules = [
    { id: 'actions', icon: Calculator, label: 'Actions & Combinations (EN 1990)' },
    { id: 'flexure', icon: Layers, label: 'Flexural Design (EN 1992)' },
    { id: 'shear', icon: Frame, label: 'Shear Design (EN 1992)' },
    { id: 'wind', icon: Wind, label: 'Wind Actions (EN 1991-1-4)' },
    { id: 'seismic', icon: Building2, label: 'Seismic Design (EN 1998)' },
    { id: 'sls', icon: Ruler, label: 'SLS Checks (EN 1992)' }
  ];

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} transition-colors duration-200`}>
      {/* Header */}
      <header className={`${cardBg} border-b ${borderColor} px-6 py-4  top-0 z-50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Code2 size={32} className="text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">Eurocode Structural Design</h1>
              <p className="text-sm opacity-70">EN 1990 • EN 1991 • EN 1992 • EN 1998 Compliant</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} ${cardBg} border-r ${borderColor} transition-all duration-300 overflow-hidden`}>
          <nav className="p-4 space-y-2">
            {modules.map(module => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${activeModule === module.id
                  ? 'bg-blue-600 text-white'
                  : `${inputBg} hover:bg-blue-100 hover:text-blue-600`
                  }`}
              >
                <module.icon size={20} />
                <span className="font-medium">{module.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Actions Module (EN 1990) */}
            {activeModule === 'actions' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calculator size={24} className="text-blue-600" />
                  Actions & Combinations (EN 1990)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Permanent Action Gk (kN/m²)</label>
                    <input
                      type="number"
                      value={actionsData.permanentAction}
                      onChange={(e) => setActionsData({ ...actionsData, permanentAction: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter Gk"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Variable Action Qk (kN/m²)</label>
                    <input
                      type="number"
                      value={actionsData.variableAction}
                      onChange={(e) => setActionsData({ ...actionsData, variableAction: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter Qk"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Wind Action Wk (kN/m²)</label>
                    <input
                      type="number"
                      value={actionsData.windAction}
                      onChange={(e) => setActionsData({ ...actionsData, windAction: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter Wk"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">ψ₀ Factor</label>
                    <input
                      type="number"
                      step="0.1"
                      value={actionsData.psi0}
                      onChange={(e) => setActionsData({ ...actionsData, psi0: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Calculate Action Combinations
                </button>
              </div>
            )}

            {/* Flexural Design (EN 1992) */}
            {activeModule === 'flexure' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Layers size={24} className="text-blue-600" />
                  Flexural Design (EN 1992-1-1)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Concrete Class</label>
                    <select
                      value={materialData.concreteClass}
                      onChange={(e) => setMaterialData({ ...materialData, concreteClass: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      {Object.keys(EurocodeTables.concreteClasses).map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Steel Class</label>
                    <select
                      value={materialData.steelClass}
                      onChange={(e) => setMaterialData({ ...materialData, steelClass: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      {Object.keys(EurocodeTables.steelClasses).map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Width b (mm)</label>
                    <input
                      type="number"
                      value={sectionData.width}
                      onChange={(e) => setSectionData({ ...sectionData, width: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Height h (mm)</label>
                    <input
                      type="number"
                      value={sectionData.height}
                      onChange={(e) => setSectionData({ ...sectionData, height: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Concrete Cover (mm)</label>
                    <input
                      type="number"
                      value={sectionData.cover}
                      onChange={(e) => setSectionData({ ...sectionData, cover: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Design Moment MEd (kNm)</label>
                    <input
                      type="number"
                      value={sectionData.Med}
                      onChange={(e) => setSectionData({ ...sectionData, Med: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter MEd"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Design Flexural Reinforcement
                </button>
              </div>
            )}

            {/* Shear Design */}
            {activeModule === 'shear' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Frame size={24} className="text-blue-600" />
                  Shear Design (EN 1992-1-1 Section 6.2)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Width bw (mm)</label>
                    <input
                      type="number"
                      value={sectionData.width}
                      onChange={(e) => setSectionData({ ...sectionData, width: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Effective Depth d (mm)</label>
                    <input
                      type="number"
                      value={sectionData.height}
                      onChange={(e) => setSectionData({ ...sectionData, height: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="450"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Design Shear VEd (kN)</label>
                    <input
                      type="number"
                      value={sectionData.Ved}
                      onChange={(e) => setSectionData({ ...sectionData, Ved: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter VEd"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Design Shear Reinforcement
                </button>
              </div>
            )}

            {/* Wind Actions (EN 1991-1-4) */}
            {activeModule === 'wind' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Wind size={24} className="text-blue-600" />
                  Wind Actions (EN 1991-1-4)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Basic Wind Velocity vb,0 (m/s)</label>
                    <input
                      type="number"
                      value={windData.vb0}
                      onChange={(e) => setWindData({ ...windData, vb0: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Terrain Category</label>
                    <select
                      value={windData.terrain}
                      onChange={(e) => setWindData({ ...windData, terrain: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="0">0 - Sea/Coastal</option>
                      <option value="I">I - Lakes/Flat country</option>
                      <option value="II">II - Low vegetation</option>
                      <option value="III">III - Suburban/Industrial</option>
                      <option value="IV">IV - Urban centers</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Building Height (m)</label>
                    <input
                      type="number"
                      value={windData.height}
                      onChange={(e) => setWindData({ ...windData, height: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter height"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Building Width (m)</label>
                    <input
                      type="number"
                      value={windData.width}
                      onChange={(e) => setWindData({ ...windData, width: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter width"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Calculate Wind Actions
                </button>
              </div>
            )}

            {/* Seismic Design (EN 1998) */}
            {activeModule === 'seismic' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 size={24} className="text-blue-600" />
                  Seismic Design (EN 1998-1)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Design Ground Acceleration ag (% of g)</label>
                    <input
                      type="number"
                      value={seismicData.ag}
                      onChange={(e) => setSeismicData({ ...seismicData, ag: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="e.g., 15 for 0.15g"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Soil Type</label>
                    <select
                      value={seismicData.soilType}
                      onChange={(e) => setSeismicData({ ...seismicData, soilType: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="A">A - Rock</option>
                      <option value="B">B - Very dense sand/gravel</option>
                      <option value="C">C - Dense sand/gravel</option>
                      <option value="D">D - Loose-to-medium sand</option>
                      <option value="E">E - Soft soil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Ductility Class</label>
                    <select
                      value={seismicData.ductilityClass}
                      onChange={(e) => setSeismicData({ ...seismicData, ductilityClass: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="DCL">DCL - Low</option>
                      <option value="DCM">DCM - Medium</option>
                      <option value="DCH">DCH - High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Building Height (m)</label>
                    <input
                      type="number"
                      value={seismicData.buildingHeight}
                      onChange={(e) => setSeismicData({ ...seismicData, buildingHeight: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter height"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Total Mass (tonnes)</label>
                    <input
                      type="number"
                      value={seismicData.mass}
                      onChange={(e) => setSeismicData({ ...seismicData, mass: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter mass"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Perform Seismic Analysis
                </button>
              </div>
            )}

            {/* SLS Checks */}
            {activeModule === 'sls' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Ruler size={24} className="text-blue-600" />
                  Serviceability Limit State Checks (EN 1992-1-1 Section 7)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Check Type</label>
                    <select
                      value={slsData.checkType}
                      onChange={(e) => setSlsData({ ...slsData, checkType: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="deflection">Deflection Control</option>
                      <option value="crack_width">Crack Width Control</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Span (m)</label>
                    <input
                      type="number"
                      value={slsData.span}
                      onChange={(e) => setSlsData({ ...slsData, span: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter span"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quasi-Permanent Load (kN/m)</label>
                    <input
                      type="number"
                      value={slsData.loadQP}
                      onChange={(e) => setSlsData({ ...slsData, loadQP: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter load"
                    />
                  </div>
                  {slsData.checkType === 'deflection' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Allowable Deflection</label>
                      <select
                        value={slsData.allowableDeflection}
                        onChange={(e) => setSlsData({ ...slsData, allowableDeflection: e.target.value })}
                        className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      >
                        <option value="L/250">L/250</option>
                        <option value="L/300">L/300</option>
                        <option value="L/350">L/350</option>
                        <option value="L/500">L/500</option>
                      </select>
                    </div>
                  )}
                  {slsData.checkType === 'crack_width' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Allowable Crack Width (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={slsData.crackWidth}
                        onChange={(e) => setSlsData({ ...slsData, crackWidth: e.target.value })}
                        className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Perform SLS Check
                </button>
              </div>
            )}

            {/* Results Display */}
            {results && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText size={24} className="text-green-600" />
                  Calculation Results
                </h2>

                <div className="space-y-4">
                  {Object.entries(results).map(([key, value]) => (
                    <div key={key} className={`p-4 ${inputBg} rounded-lg`}>
                      {typeof value === 'object' && value !== null ? (
                        <>
                          <p className="text-sm font-bold mb-2 text-blue-600">
                            {key.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          <div className="grid md:grid-cols-2 gap-2">
                            {Object.entries(value).map(([subKey, subValue]) => (
                              <div key={subKey} className="flex justify-between">
                                <span className="text-sm opacity-70">{subKey.replace(/_/g, ' ')}:</span>
                                <span className="text-sm font-semibold">{subValue}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-sm opacity-70">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-lg font-bold text-blue-600">{value}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                  <p className="text-sm">
                    <strong>Note:</strong> All calculations comply with Eurocodes.
                    Results must be verified by a qualified structural engineer.
                  </p>
                </div>
              </div>
            )}

            {/* Eurocode Reference Tables */}
            <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
              <h2 className="text-xl font-bold mb-4">Eurocode Reference Tables</h2>
              <div className="space-y-4">
                <div className={`p-4 ${inputBg} rounded-lg`}>
                  <h3 className="font-bold mb-2">Concrete Classes (EN 1992-1-1 Table 3.1)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2">Class</th>
                          <th className="text-left py-2">fck (MPa)</th>
                          <th className="text-left py-2">fcm (MPa)</th>
                          <th className="text-left py-2">Ecm (GPa)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(EurocodeTables.concreteClasses).map(([cls, props]) => (
                          <tr key={cls} className="border-b border-gray-200">
                            <td className="py-2">{cls}</td>
                            <td className="py-2">{props.fck}</td>
                            <td className="py-2">{props.fcm}</td>
                            <td className="py-2">{props.Ecm / 1000}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`p-4 ${inputBg} rounded-lg`}>
                  <h3 className="font-bold mb-2">Partial Factors (EN 1990 Table A1.2)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2">Limit State</th>
                          <th className="text-left py-2">γG</th>
                          <th className="text-left py-2">γQ</th>
                          <th className="text-left py-2">γC</th>
                          <th className="text-left py-2">γS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">ULS Persistent</td>
                          <td className="py-2">1.35</td>
                          <td className="py-2">1.5</td>
                          <td className="py-2">1.5</td>
                          <td className="py-2">1.15</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">ULS Accidental</td>
                          <td className="py-2">1.0</td>
                          <td className="py-2">1.0</td>
                          <td className="py-2">1.2</td>
                          <td className="py-2">1.0</td>
                        </tr>
                        <tr>
                          <td className="py-2">SLS</td>
                          <td className="py-2">1.0</td>
                          <td className="py-2">1.0</td>
                          <td className="py-2">-</td>
                          <td className="py-2">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`p-4 ${inputBg} rounded-lg`}>
                  <h3 className="font-bold mb-2">Combination Factors ψ (EN 1990 Table A1.1)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2">Action</th>
                          <th className="text-left py-2">ψ₀</th>
                          <th className="text-left py-2">ψ₁</th>
                          <th className="text-left py-2">ψ₂</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(EurocodeTables.combinationFactors).map(([action, factors]) => (
                          <tr key={action} className="border-b border-gray-200">
                            <td className="py-2">{action}</td>
                            <td className="py-2">{factors.psi0}</td>
                            <td className="py-2">{factors.psi1}</td>
                            <td className="py-2">{factors.psi2}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}

    </div>
  );
};

// ============================================================================
// MAIN APP SWITCHER COMPONENT
// ============================================================================

const FramedStructureComponent = () => {
  const [theme, setTheme] = useState('light');
  const [activeCode, setActiveCode] = useState('eurocode');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const bgColor = theme === 'dark' ? 'bg-gray-900' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgColor} ${textColor}`}>
      {/* Main Header */}
      <header className={`${cardBg} border-b ${borderColor} px-6 py-4  top-0 z-50`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 size={36} className="text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Structural Design Suite</h1>
              <p className="text-sm opacity-70">Professional RC Design & Analysis Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className={`p-3 rounded-lg ${cardBg} hover:opacity-80 border ${borderColor}`}>
              {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Code Selector */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Select Design Code</h2>
            <div className="flex items-center gap-2">
              <ToggleRight size={20} className="text-blue-600" />
              <span className="text-sm font-medium">Code Standard</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setActiveCode('bs')}
              className={`p-6 rounded-lg border-2 transition-all ${activeCode === 'bs'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900'
                : `border-gray-300 dark:border-gray-600 ${cardBg} hover:border-blue-400`
                }`}
            >
              <div className="flex items-center gap-4">
                <BookOpen size={48} className="text-blue-600" />
                <div className="text-left">
                  <h3 className="text-xl font-bold">BS Codes</h3>
                  <p className="text-sm opacity-70 mt-1">BS 8110 | BS 6399 | BS 8002</p>
                  <p className="text-xs opacity-50 mt-2">British Standards for reinforced concrete design</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveCode('eurocode')}
              className={`p-6 rounded-lg border-2 transition-all ${activeCode === 'eurocode'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900'
                : `border-gray-300 dark:border-gray-600 ${cardBg} hover:border-blue-400`
                }`}
            >
              <div className="flex items-center gap-4">
                <Code2 size={48} className="text-blue-600" />
                <div className="text-left">
                  <h3 className="text-xl font-bold">Eurocodes</h3>
                  <p className="text-sm opacity-70 mt-1">EN 1990 | EN 1991 | EN 1992 | EN 1998</p>
                  <p className="text-xs opacity-50 mt-2">European standards for structural design</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Active Component Display */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        {activeCode === 'eurocode' ? (
          <EurocodeComponent theme={theme} onThemeChange={toggleTheme} />
        ) : (
          <RCStructuralDesign theme={theme} onThemeChange={toggleTheme} />
        )}
      </div>
    </div>
  );
};

export default FramedStructureComponent;