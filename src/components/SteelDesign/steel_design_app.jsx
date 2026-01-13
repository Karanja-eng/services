import React, { useState } from 'react';
import axios from 'axios';
import { Calculator, Save, FileText, AlertCircle, CheckCircle, Menu, X, Loader2, Zap, Shield, GitBranch } from 'lucide-react';
import MomentDistributionCalculator from '../ReinforcedConcrete/Beams/distribution';

const API_BASE_URL = "http://localhost:8001/steel_backend";

// Steel Section Database (BS 5950 Universal Beams & Columns)
const steelSections = {
  UB: [
    { designation: '914x419x388', depth: 921.0, width: 420.5, tw: 21.4, tf: 36.6, r: 24.1, area: 494.0, Ix: 504000, Iy: 47200, Zx: 11000, Zy: 2250, rx: 319, ry: 97.9 },
    { designation: '914x305x289', depth: 926.6, width: 307.7, tw: 19.5, tf: 32.0, r: 19.1, area: 368.0, Ix: 404000, Iy: 20500, Zx: 8720, Zy: 1330, rx: 331, ry: 74.6 },
    { designation: '838x292x226', depth: 850.9, width: 293.8, tw: 16.1, tf: 26.8, r: 17.8, area: 288.0, Ix: 285000, Iy: 16500, Zx: 6700, Zy: 1120, rx: 315, ry: 75.7 },
    { designation: '762x267x197', depth: 769.8, width: 268.0, tw: 15.6, tf: 25.4, r: 16.5, area: 251.0, Ix: 204000, Iy: 12800, Zx: 5300, Zy: 953, rx: 285, ry: 71.4 },
    { designation: '686x254x170', depth: 692.9, width: 255.8, tw: 14.5, tf: 23.7, r: 15.2, area: 217.0, Ix: 150000, Iy: 10200, Zx: 4330, Zy: 800, rx: 263, ry: 68.5 },
    { designation: '610x305x238', depth: 633.0, width: 311.4, tw: 18.6, tf: 31.4, r: 16.5, area: 303.0, Ix: 198000, Iy: 23100, Zx: 6260, Zy: 1480, rx: 256, ry: 87.4 },
    { designation: '610x229x140', depth: 617.2, width: 230.2, tw: 13.1, tf: 19.6, r: 12.7, area: 179.0, Ix: 98400, Iy: 5960, Zx: 3190, Zy: 518, rx: 234, ry: 57.7 },
    { designation: '533x210x122', depth: 544.5, width: 211.9, tw: 12.7, tf: 21.3, r: 12.7, area: 155.0, Ix: 73700, Iy: 5500, Zx: 2710, Zy: 519, rx: 218, ry: 59.6 },
    { designation: '457x191x98', depth: 467.2, width: 192.8, tw: 11.4, tf: 19.6, r: 10.2, area: 125.0, Ix: 49500, Iy: 4050, Zx: 2120, Zy: 421, rx: 199, ry: 56.9 },
    { designation: '457x152x82', depth: 465.1, width: 153.5, tw: 10.5, tf: 18.9, r: 10.2, area: 105.0, Ix: 41100, Iy: 1870, Zx: 1770, Zy: 243, rx: 198, ry: 42.2 },
    { designation: '406x178x74', depth: 412.8, width: 179.5, tw: 9.5, tf: 16.0, r: 10.2, area: 94.5, Ix: 30800, Iy: 2920, Zx: 1490, Zy: 326, rx: 181, ry: 55.6 },
    { designation: '356x171x67', depth: 363.4, width: 173.2, tw: 9.1, tf: 15.7, r: 10.2, area: 85.5, Ix: 22200, Iy: 2490, Zx: 1220, Zy: 287, rx: 161, ry: 53.9 },
    { designation: '305x165x54', depth: 310.4, width: 166.9, tw: 7.9, tf: 13.7, r: 8.9, area: 68.4, Ix: 12400, Iy: 1870, Zx: 802, Zy: 224, rx: 135, ry: 52.3 },
    { designation: '305x127x48', depth: 311.0, width: 125.2, tw: 9.0, tf: 14.0, r: 8.9, area: 61.0, Ix: 10900, Iy: 816, Zx: 703, Zy: 130, rx: 134, ry: 36.6 },
    { designation: '254x146x43', depth: 259.6, width: 147.3, tw: 7.2, tf: 12.7, r: 7.6, area: 54.8, Ix: 7840, Iy: 1450, Zx: 604, Zy: 197, rx: 120, ry: 51.4 },
    { designation: '254x102x28', depth: 260.4, width: 102.2, tw: 6.3, tf: 10.0, r: 7.6, area: 36.0, Ix: 4010, Iy: 358, Zx: 308, Zy: 70.1, rx: 105, ry: 31.5 },
    { designation: '203x133x30', depth: 206.8, width: 133.9, tw: 6.4, tf: 9.6, r: 7.6, area: 38.2, Ix: 3070, Iy: 786, Zx: 297, Zy: 117, rx: 89.6, ry: 45.4 },
    { designation: '178x102x19', depth: 177.8, width: 101.2, tw: 4.8, tf: 7.9, r: 7.6, area: 24.3, Ix: 1360, Iy: 250, Zx: 153, Zy: 49.4, rx: 74.9, ry: 32.1 },
    { designation: '152x89x16', depth: 152.4, width: 88.7, tw: 4.5, tf: 7.7, r: 7.6, area: 20.3, Ix: 834, Iy: 155, Zx: 109, Zy: 34.9, rx: 64.1, ry: 27.6 },
    { designation: '127x76x13', depth: 127.0, width: 76.0, tw: 4.0, tf: 7.6, r: 7.6, area: 16.5, Ix: 473, Iy: 104, Zx: 74.5, Zy: 27.3, rx: 53.6, ry: 25.1 }
  ],
  UC: [
    { designation: '356x406x634', depth: 474.6, width: 424.0, tw: 47.6, tf: 77.0, r: 15.2, area: 808.0, Ix: 272000, Iy: 131000, Zx: 11500, Zy: 6180, rx: 581, ry: 403 },
    { designation: '356x406x551', depth: 455.6, width: 418.5, tw: 42.1, tf: 67.5, r: 15.2, area: 702.0, Ix: 228000, Iy: 111000, Zx: 10000, Zy: 5310, rx: 570, ry: 397 },
    { designation: '356x368x202', depth: 374.6, width: 374.7, tw: 19.9, tf: 30.2, r: 15.2, area: 257.0, Ix: 84800, Iy: 39800, Zx: 4530, Zy: 2130, rx: 575, ry: 393 },
    { designation: '305x305x283', depth: 365.3, width: 321.8, tw: 26.9, tf: 44.1, r: 15.2, area: 361.0, Ix: 111000, Iy: 52100, Zx: 6070, Zy: 3240, rx: 554, ry: 380 },
    { designation: '305x305x240', depth: 352.5, width: 318.4, tw: 23.0, tf: 37.7, r: 15.2, area: 306.0, Ix: 92700, Iy: 43600, Zx: 5260, Zy: 2740, rx: 550, ry: 377 },
    { designation: '305x305x198', depth: 339.9, width: 314.5, tw: 19.1, tf: 31.4, r: 15.2, area: 252.0, Ix: 75500, Iy: 35600, Zx: 4440, Zy: 2260, rx: 547, ry: 376 },
    { designation: '254x254x167', depth: 289.1, width: 265.2, tw: 19.2, tf: 31.7, r: 12.7, area: 213.0, Ix: 49100, Iy: 23200, Zx: 3400, Zy: 1750, rx: 480, ry: 330 },
    { designation: '254x254x132', depth: 276.3, width: 261.3, tw: 15.3, tf: 25.3, r: 12.7, area: 168.0, Ix: 38700, Iy: 18300, Zx: 2800, Zy: 1400, rx: 480, ry: 330 },
    { designation: '254x254x107', depth: 266.7, width: 258.8, tw: 12.8, tf: 20.5, r: 12.7, area: 137.0, Ix: 31000, Iy: 14700, Zx: 2320, Zy: 1140, rx: 476, ry: 328 },
    { designation: '203x203x86', depth: 222.2, width: 209.1, tw: 12.7, tf: 20.5, r: 10.2, area: 110.0, Ix: 18300, Iy: 8640, Zx: 1650, Zy: 827, rx: 408, ry: 280 },
    { designation: '203x203x71', depth: 215.8, width: 206.4, tw: 10.3, tf: 17.3, r: 10.2, area: 90.8, Ix: 15100, Iy: 7150, Zx: 1400, Zy: 693, rx: 408, ry: 281 },
    { designation: '203x203x60', depth: 209.6, width: 205.2, tw: 9.4, tf: 14.2, r: 10.2, area: 75.8, Ix: 12400, Iy: 5880, Zx: 1180, Zy: 573, rx: 404, ry: 278 },
    { designation: '152x152x37', depth: 161.8, width: 154.4, tw: 8.0, tf: 11.5, r: 7.6, area: 47.4, Ix: 4880, Iy: 2320, Zx: 603, Zy: 301, rx: 321, ry: 221 },
    { designation: '152x152x30', depth: 157.6, width: 152.9, tw: 6.5, tf: 9.4, r: 7.6, area: 38.2, Ix: 3990, Iy: 1900, Zx: 506, Zy: 248, rx: 323, ry: 223 },
    { designation: '152x152x23', depth: 152.4, width: 152.2, tw: 5.8, tf: 6.8, r: 7.6, area: 29.8, Ix: 2900, Iy: 1390, Zx: 381, Zy: 183, rx: 312, ry: 216 }
  ]
};

// Material Properties (BS 5950)
const steelGrades = {
  'S275': { fy: 275, fu: 430, E: 210000 },
  'S355': { fy: 355, fu: 510, E: 210000 },
  'S450': { fy: 450, fu: 550, E: 210000 }
};

const SteelDesignApp = ({ isDark = false }) => {
  const [activeModule, setActiveModule] = useState('beam');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Beam Design States
  const [beamData, setBeamData] = useState({
    span: 6.0,
    udl: 50,
    pointLoad: 0,
    pointLoadPosition: 0,
    grade: 'S275',
    section: '305x165x54',
    sectionType: 'UB'
  });

  // Column Design States
  const [columnData, setColumnData] = useState({
    height: 4.0,
    axialLoad: 1000,
    momentMajor: 50,
    momentMinor: 0,
    grade: 'S275',
    section: '203x203x60',
    sectionType: 'UC',
    effectiveLengthMajor: 1.0,
    effectiveLengthMinor: 1.0
  });

  // Frame Analysis States
  const [frameData, setFrameData] = useState({
    method: 'moment-distribution',
    spans: [{ length: 6, load: 50 }, { length: 8, load: 60 }],
    supports: ['fixed', 'pinned', 'pinned']
  });

  const calculateBeamDesign = () => {
    const section = steelSections[beamData.sectionType].find(s => s.designation === beamData.section);
    const material = steelGrades[beamData.grade];

    if (!section || !material) return;

    const L = beamData.span * 1000; // Convert to mm
    const w = beamData.udl; // kN/m
    const P = beamData.pointLoad; // kN
    const a = beamData.pointLoadPosition * 1000; // mm

    // Maximum bending moment
    const M_udl = (w * Math.pow(L, 2)) / 8000; // kNm
    const M_point = P > 0 ? (P * a * (L - a)) / (L * 1000) : 0; // kNm
    const M_max = M_udl + M_point;

    // Maximum shear
    const V_udl = (w * L) / 2000; // kN
    const V_point = P > 0 ? Math.max(P * (L - a) / L, P * a / L) : 0;
    const V_max = V_udl + V_point;

    // Design strength (BS 5950 Table 9)
    const py = material.fy;

    // Section classification (simplified)
    const b_t_flange = (section.width / 2) / section.tf;
    const d_t_web = (section.depth - 2 * section.tf) / section.tw;
    const epsilon = Math.sqrt(275 / py);

    let classification = 'Plastic';
    if (b_t_flange > 9 * epsilon || d_t_web > 80 * epsilon) {
      classification = 'Compact';
    }
    if (b_t_flange > 10 * epsilon || d_t_web > 100 * epsilon) {
      classification = 'Semi-compact';
    }
    if (b_t_flange > 15 * epsilon || d_t_web > 120 * epsilon) {
      classification = 'Slender';
    }

    // Moment capacity (BS 5950 Cl 4.2)
    const Mc = (section.Zx * py) / 1000000; // kNm (Zx in cm³)

    // Shear capacity (BS 5950 Cl 4.2.3)
    const Av = section.depth * section.tw; // mm²
    const Pv = (0.6 * py * Av) / 1000; // kN

    // Lateral torsional buckling
    const lambda_LT = (L / section.ry) * Math.sqrt(py / 275);
    const pb = py / (1 + 0.0005 * lambda_LT * lambda_LT); // Simplified
    const Mb = (section.Zx * pb) / 1000000; // kNm

    // Deflection (serviceability)
    const I = section.Ix * 10000; // mm⁴
    const delta_udl = (5 * w * Math.pow(L, 4)) / (384 * material.E * I);
    const delta_point = P > 0 ? (P * a * Math.pow(L - a, 2) * Math.sqrt(3 * a * (L - a))) / (27 * material.E * I * L) : 0;
    const delta_max = delta_udl + delta_point;
    const delta_limit = L / 360;

    // Utilization ratios
    const bendingRatio = M_max / Mb;
    const shearRatio = V_max / Pv;
    const deflectionRatio = delta_max / delta_limit;

    const passed = bendingRatio <= 1.0 && shearRatio <= 1.0 && deflectionRatio <= 1.0;

    setResults({
      type: 'beam',
      section: section.designation,
      classification,
      M_max: M_max.toFixed(2),
      V_max: V_max.toFixed(2),
      Mc: Mc.toFixed(2),
      Mb: Mb.toFixed(2),
      Pv: Pv.toFixed(2),
      delta_max: delta_max.toFixed(2),
      delta_limit: delta_limit.toFixed(2),
      bendingRatio: (bendingRatio * 100).toFixed(1),
      shearRatio: (shearRatio * 100).toFixed(1),
      deflectionRatio: (deflectionRatio * 100).toFixed(1),
      passed,
      py,
      epsilon: epsilon.toFixed(3),
      lambda_LT: lambda_LT.toFixed(1)
    });
  };

  const calculateColumnDesign = () => {
    const section = steelSections[columnData.sectionType].find(s => s.designation === columnData.section);
    const material = steelGrades[columnData.grade];

    if (!section || !material) return;

    const L = columnData.height * 1000; // mm
    const P = columnData.axialLoad; // kN
    const Mx = columnData.momentMajor; // kNm
    const My = columnData.momentMinor; // kNm
    const py = material.fy;

    // Effective lengths
    const LE_x = L * columnData.effectiveLengthMajor;
    const LE_y = L * columnData.effectiveLengthMinor;

    // Slenderness ratios
    const lambda_x = LE_x / section.rx;
    const lambda_y = LE_y / section.ry;
    const lambda = Math.max(lambda_x, lambda_y);

    // Compression resistance (BS 5950 Cl 4.7.4)
    const lambda_0 = Math.PI * Math.sqrt(material.E / py);
    const phi = 0.5 * (1 + 0.001 * lambda * (lambda - lambda_0) + Math.pow(lambda / lambda_0, 2));
    const chi = Math.min(1.0, 1 / (phi + Math.sqrt(phi * phi - Math.pow(lambda / lambda_0, 2))));
    const pc = chi * py;
    const Pc = (section.area * 100 * pc) / 1000; // kN

    // Moment capacity
    const Mcx = (section.Zx * py) / 1000000; // kNm
    const Mcy = (section.Zy * py) / 1000000; // kNm

    // Combined axial and bending (BS 5950 Cl 4.8.3.3)
    const axialRatio = P / Pc;
    const momentRatio = (Mx / Mcx) + (My / Mcy);
    const interaction = axialRatio + momentRatio;

    const passed = interaction <= 1.0 && axialRatio <= 1.0;

    setResults({
      type: 'column',
      section: section.designation,
      P,
      Pc: Pc.toFixed(2),
      Mx,
      My,
      Mcx: Mcx.toFixed(2),
      Mcy: Mcy.toFixed(2),
      lambda: lambda.toFixed(1),
      lambda_x: lambda_x.toFixed(1),
      lambda_y: lambda_y.toFixed(1),
      pc: pc.toFixed(1),
      axialRatio: (axialRatio * 100).toFixed(1),
      momentRatio: (momentRatio * 100).toFixed(1),
      interaction: (interaction * 100).toFixed(1),
      passed
    });
  };

  const calculateFrameAnalysis = async () => {
    setLoading(true);
    setResults(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/frame-analysis`, {
        method: frameData.method,
        spans: frameData.spans,
        supports: frameData.supports.map(s => s.charAt(0).toUpperCase() + s.slice(1)) // Fix case for backend
      });

      setResults({
        type: 'frame',
        method: response.data.method,
        diagrams: response.data.diagrams,
        maxMoment: response.data.max_moment,
        maxShear: response.data.max_shear,
        iteration_history: response.data.iteration_history,
        distribution_factors: response.data.distribution_factors,
        final_moments: response.data.final_moments,
        fixed_end_moments: response.data.fixed_end_moments,
        joints: response.data.joints,
        members: response.data.members
      });
    } catch (err) {
      console.error("Frame analysis failed:", err);
      // Fallback or error state
    } finally {
      setLoading(false);
    }
  };

  const renderBeamModule = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Beam Design (BS 5950)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Section Type</label>
            <select
              value={beamData.sectionType}
              onChange={(e) => setBeamData({ ...beamData, sectionType: e.target.value, section: steelSections[e.target.value][0].designation })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="UB">Universal Beam (UB)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section Designation</label>
            <select
              value={beamData.section}
              onChange={(e) => setBeamData({ ...beamData, section: e.target.value })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              {steelSections[beamData.sectionType].map(s => (
                <option key={s.designation} value={s.designation}>{s.designation}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Steel Grade</label>
            <select
              value={beamData.grade}
              onChange={(e) => setBeamData({ ...beamData, grade: e.target.value })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="S275">S275 (fy=275 N/mm²)</option>
              <option value="S355">S355 (fy=355 N/mm²)</option>
              <option value="S450">S450 (fy=450 N/mm²)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Span (m)</label>
            <input
              type="number"
              value={beamData.span}
              onChange={(e) => setBeamData({ ...beamData, span: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
              step="0.1"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">UDL (kN/m)</label>
            <input
              type="number"
              value={beamData.udl}
              onChange={(e) => setBeamData({ ...beamData, udl: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Point Load (kN)</label>
            <input
              type="number"
              value={beamData.pointLoad}
              onChange={(e) => setBeamData({ ...beamData, pointLoad: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Point Load Position (m from left)</label>
            <input
              type="number"
              value={beamData.pointLoadPosition}
              onChange={(e) => setBeamData({ ...beamData, pointLoadPosition: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              step="0.1"
              max={beamData.span}
            />
          </div>

          <button
            onClick={calculateBeamDesign}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
          >
            <Calculator size={20} />
            Calculate Design
          </button>
        </div>
      </div>
    </div>
  );

  const renderColumnModule = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Column Design (BS 5950)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section Type</label>
            <select
              value={columnData.sectionType}
              onChange={(e) => setColumnData({ ...columnData, sectionType: e.target.value, section: steelSections[e.target.value][0].designation })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="UC">Universal Column (UC)</option>
              <option value="UB">Universal Beam (UB)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section Designation</label>
            <select
              value={columnData.section}
              onChange={(e) => setColumnData({ ...columnData, section: e.target.value })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              {steelSections[columnData.sectionType].map(s => (
                <option key={s.designation} value={s.designation}>{s.designation}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Steel Grade</label>
            <select
              value={columnData.grade}
              onChange={(e) => setColumnData({ ...columnData, grade: e.target.value })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="S275">S275 (fy=275 N/mm²)</option>
              <option value="S355">S355 (fy=355 N/mm²)</option>
              <option value="S450">S450 (fy=450 N/mm²)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Height (m)</label>
            <input
              type="number"
              value={columnData.height}
              onChange={(e) => setColumnData({ ...columnData, height: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
              step="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Length Factor (Major Axis)</label>
            <input
              type="number"
              value={columnData.effectiveLengthMajor}
              onChange={(e) => setColumnData({ ...columnData, effectiveLengthMajor: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
              step="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Length Factor (Minor Axis)</label>
            <input
              type="number"
              value={columnData.effectiveLengthMinor}
              onChange={(e) => setColumnData({ ...columnData, effectiveLengthMinor: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
              step="0.1"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Axial Load (kN)</label>
            <input
              type="number"
              value={columnData.axialLoad}
              onChange={(e) => setColumnData({ ...columnData, axialLoad: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              step="10"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Major Axis Moment (kNm)</label>
            <input
              type="number"
              value={columnData.momentMajor}
              onChange={(e) => setColumnData({ ...columnData, momentMajor: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              step="5"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Minor Axis Moment (kNm)</label>
            <input
              type="number"
              value={columnData.momentMinor}
              onChange={(e) => setColumnData({ ...columnData, momentMinor: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              step="5"
            />
          </div>

          <button
            onClick={calculateColumnDesign}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
          >
            <Calculator size={20} />
            Calculate Design
          </button>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-800">
              <strong>Effective Length Factors:</strong><br />
              • Fixed-Fixed: 0.5<br />
              • Fixed-Pinned: 0.7<br />
              • Pinned-Pinned: 1.0<br />
              • Fixed-Free: 2.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFrameModule = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl shadow-xl mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <GitBranch className="h-8 w-8" />
          Frame Analysis - Moment Distribution Method
        </h2>
        <p className="text-blue-100 text-sm">
          Professional Hardy Cross analysis for continuous steel frames. Define joints, members, and loads below.
        </p>
      </div>

      <MomentDistributionCalculator
        isDark={false}
        onAnalysisComplete={(results) => {
          // Store results for potential steel design use
          setResults({
            type: 'frame',
            method: 'Moment Distribution Method',
            maxMoment: Math.max(...Object.values(results.moment_data || {}).flatMap(data => data.map(p => Math.abs(p.y)))),
            maxShear: Math.max(...Object.values(results.shear_force_data || {}).flatMap(data => data.map(p => Math.abs(p.y)))),
            ...results
          });
        }}
      />
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    if (results.type === 'beam') {
      return (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 border-2 border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800">Design Results - Beam</h3>
          </div>

          <div className={`p-4 rounded-lg mb-6 ${results.passed ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
            <div className="flex items-center gap-2">
              {results.passed ? <CheckCircle className="text-green-600" size={24} /> : <AlertCircle className="text-red-600" size={24} />}
              <span className={`text-lg font-bold ${results.passed ? 'text-green-700' : 'text-red-700'}`}>
                {results.passed ? 'DESIGN ADEQUATE' : 'DESIGN INADEQUATE'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">Section Properties</h4>
              <div className="space-y-2">
                <p><span className="font-semibold">Section:</span> {results.section}</p>
                <p><span className="font-semibold">Classification:</span> {results.classification}</p>
                <p><span className="font-semibold">Design Strength (py):</span> {results.py} N/mm²</p>
                <p><span className="font-semibold">Epsilon (ε):</span> {results.epsilon}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">Applied Forces</h4>
              <div className="space-y-2">
                <p><span className="font-semibold">Max Moment (M):</span> {results.M_max} kNm</p>
                <p><span className="font-semibold">Max Shear (V):</span> {results.V_max} kN</p>
                <p><span className="font-semibold">Max Deflection (δ):</span> {results.delta_max} mm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">Capacities</h4>
              <div className="space-y-2">
                <p><span className="font-semibold">Moment Capacity (Mc):</span> {results.Mc} kNm</p>
                <p><span className="font-semibold">Buckling Moment (Mb):</span> {results.Mb} kNm</p>
                <p><span className="font-semibold">Shear Capacity (Pv):</span> {results.Pv} kN</p>
                <p><span className="font-semibold">Deflection Limit:</span> {results.delta_limit} mm</p>
                <p><span className="font-semibold">Slenderness (λLT):</span> {results.lambda_LT}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">Utilization Ratios</h4>
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">Bending: {results.bendingRatio}%</p>
                  <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${parseFloat(results.bendingRatio) > 100 ? 'bg-red-600' : parseFloat(results.bendingRatio) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                      style={{ width: `${Math.min(parseFloat(results.bendingRatio), 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Shear: {results.shearRatio}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${parseFloat(results.shearRatio) > 100 ? 'bg-red-600' : parseFloat(results.shearRatio) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                      style={{ width: `${Math.min(parseFloat(results.shearRatio), 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Deflection: {results.deflectionRatio}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${parseFloat(results.deflectionRatio) > 100 ? 'bg-red-600' : parseFloat(results.deflectionRatio) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                      style={{ width: `${Math.min(parseFloat(results.deflectionRatio), 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600">
            <p className="text-sm text-gray-700 dark:text-slate-300">
              <strong>Reference:</strong> Design to BS 5950-1:2000 - Structural use of steelwork in building - Code of practice for design - Rolled and welded sections
            </p>
          </div>
        </div>
      );
    }

    if (results.type === 'column') {
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800">Design Results - Column</h3>
          </div>

          <div className={`p-4 rounded-lg mb-6 ${results.passed ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
            <div className="flex items-center gap-2">
              {results.passed ? <CheckCircle className="text-green-600" size={24} /> : <AlertCircle className="text-red-600" size={24} />}
              <span className={`text-lg font-bold ${results.passed ? 'text-green-700' : 'text-red-700'}`}>
                {results.passed ? 'DESIGN ADEQUATE' : 'DESIGN INADEQUATE'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">Section & Loading</h4>
              <div className="space-y-2">
                <p><span className="font-semibold">Section:</span> {results.section}</p>
                <p><span className="font-semibold">Axial Load (P):</span> {results.P} kN</p>
                <p><span className="font-semibold">Major Moment (Mx):</span> {results.Mx} kNm</p>
                <p><span className="font-semibold">Minor Moment (My):</span> {results.My} kNm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">Slenderness</h4>
              <div className="space-y-2">
                <p><span className="font-semibold">λx (Major Axis):</span> {results.lambda_x}</p>
                <p><span className="font-semibold">λy (Minor Axis):</span> {results.lambda_y}</p>
                <p><span className="font-semibold">λ (Governing):</span> {results.lambda}</p>
                <p><span className="font-semibold">Comp. Strength (pc):</span> {results.pc} N/mm²</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">Capacities</h4>
              <div className="space-y-2">
                <p><span className="font-semibold">Axial Capacity (Pc):</span> {results.Pc} kN</p>
                <p><span className="font-semibold">Major Moment Cap. (Mcx):</span> {results.Mcx} kNm</p>
                <p><span className="font-semibold">Minor Moment Cap. (Mcy):</span> {results.Mcy} kNm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">Interaction Check</h4>
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">Axial Ratio: {results.axialRatio}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${parseFloat(results.axialRatio) > 100 ? 'bg-red-600' : parseFloat(results.axialRatio) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                      style={{ width: `${Math.min(parseFloat(results.axialRatio), 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Moment Ratio: {results.momentRatio}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${parseFloat(results.momentRatio) > 100 ? 'bg-red-600' : parseFloat(results.momentRatio) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                      style={{ width: `${Math.min(parseFloat(results.momentRatio), 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Total Interaction: {results.interaction}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${parseFloat(results.interaction) > 100 ? 'bg-red-600' : parseFloat(results.interaction) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                      style={{ width: `${Math.min(parseFloat(results.interaction), 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
            <p className="text-sm text-gray-700">
              <strong>Reference:</strong> Design to BS 5950-1:2000 - Clause 4.7 (Compression members) and Clause 4.8 (Members subject to combined forces)
            </p>
          </div>
        </div>
      );
    }
    const IterationHistoryPanel = ({ results }) => {
      if (!results || !results.iteration_history) return null;

      return (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3">
            <Zap className="text-yellow-600" size={24} />
            <h4 className="text-xl font-bold text-gray-800">Hardy Cross Iteration History</h4>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {results.iteration_history.slice(-3).map((iteration, index) => (
              <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-700">
                    {iteration.type === "Initial FEM" ? "Fixed-End Moments" : `Iteration ${iteration.iteration}`}
                  </span>
                  {iteration.max_unbalance && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                      Unbalance: {iteration.max_unbalance.toFixed(4)} kNm
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="pb-2">Joint</th>
                        <th className="pb-2">Member</th>
                        <th className="pb-2 text-right">Moment (kNm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(iteration.moments || {}).map(([jointId, memberMoments]) =>
                        Object.entries(memberMoments).map(([memberId, moment]) => (
                          <tr key={`${jointId}-${memberId}`} className="border-b last:border-0">
                            <td className="py-2 font-medium">{jointId}</td>
                            <td className="py-2 text-gray-600">{memberId}</td>
                            <td className="py-2 text-right font-mono">{moment.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {results.iteration_history.length > 3 && (
              <p className="text-center text-sm text-gray-500 italic">... showing last 3 iterations of {results.iteration_history.length} ...</p>
            )}
          </div>
        </div>
      );
    };

    const DistributionFactorsPanel = ({ results }) => {
      if (!results || !results.distribution_factors) return null;

      return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h4 className="text-lg font-bold text-gray-800 mb-4">Distribution Factors (DF)</h4>
            <div className="space-y-3">
              {Object.entries(results.distribution_factors).map(([jointId, factors]) => (
                <div key={jointId} className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-bold text-blue-800 mb-2">Joint {jointId}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(factors).map(([memberId, df]) => (
                      <div key={memberId} className="flex justify-between text-xs">
                        <span className="text-gray-600">{memberId}:</span>
                        <span className="font-bold text-blue-700">{df.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h4 className="text-lg font-bold text-gray-800 mb-4">Final Member End Moments</h4>
            <div className="space-y-3">
              {Object.entries(results.final_moments || {}).map(([memberId, moments]) => (
                <div key={memberId} className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm font-bold text-green-800 mb-2">Member {memberId}</div>
                  <div className="flex justify-between text-xs">
                    <div>Start: <span className="font-bold text-green-700">{moments.start.toFixed(2)} kNm</span></div>
                    <div>End: <span className="font-bold text-green-700">{moments.end.toFixed(2)} kNm</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const FrameSchematic = ({ joints, members, results }) => {
      if (!joints || !members) return null;

      const allX = joints.map((j) => j.x_coordinate);
      const allY = joints.map((j) => j.y_coordinate);
      const minX = Math.min(...allX) - 1;
      const maxX = Math.max(...allX) + 1;
      const minY = Math.min(...allY) - 1;
      const maxY = Math.max(...allY) + 1;

      const width = 800;
      const height = 300;

      const scaleX = (width - 100) / (maxX - minX || 1);
      const scaleY = (height - 150) / (maxY - minY || 1);
      const scale = Math.min(scaleX, scaleY, 50);

      const offsetX = 50 - minX * scale;
      const offsetY = height - 50 + minY * scale;

      return (
        <div className="mt-8 bg-slate-50 border-2 border-slate-200 p-6 rounded-xl overflow-hidden">
          <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <GitBranch className="text-blue-600" size={20} /> Frame Configuration
          </h4>
          <div className="overflow-x-auto">
            <svg width={width} height={height} className="mx-auto">
              <defs>
                <marker id="arrow-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
                </marker>
              </defs>

              {members.map((member, index) => {
                const startJoint = joints.find(j => j.joint_id === member.start_joint_id);
                const endJoint = joints.find(j => j.joint_id === member.end_joint_id);
                if (!startJoint || !endJoint) return null;

                const x1 = startJoint.x_coordinate * scale + offsetX;
                const y1 = offsetY - startJoint.y_coordinate * scale;
                const x2 = endJoint.x_coordinate * scale + offsetX;
                const y2 = offsetY - endJoint.y_coordinate * scale;

                return (
                  <g key={index}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3B82F6" strokeWidth="6" strokeLinecap="round" />
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10} textAnchor="middle" className="text-[10px] font-bold fill-slate-600">
                      {member.member_id}
                    </text>

                    {[0.2, 0.4, 0.6, 0.8].map(t => (
                      <line
                        key={t}
                        x1={x1 + (x2 - x1) * t}
                        y1={y1 + (y2 - y1) * t - 30}
                        x2={x1 + (x2 - x1) * t}
                        y2={y1 + (y2 - y1) * t - 2}
                        stroke="#3B82F6"
                        strokeWidth="1.5"
                        markerEnd="url(#arrow-blue)"
                      />
                    ))}
                  </g>
                );
              })}

              {joints.map((joint, index) => {
                const x = joint.x_coordinate * scale + offsetX;
                const y = offsetY - joint.y_coordinate * scale;
                return (
                  <g key={joint.joint_id}>
                    <circle cx={x} cy={y} r={6} fill={joint.is_support ? "#EF4444" : "#1F2937"} stroke="white" strokeWidth="2" />
                    <text x={x} y={y + 20} textAnchor="middle" className="text-[12px] font-black fill-slate-800">
                      {joint.joint_id}
                    </text>
                    {joint.is_support && (
                      <rect x={x - 10} y={y + 6} width="20" height="4" fill="#EF4444" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      );
    };

    if (results.type === 'frame') {
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800">Frame Analysis Results</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
              <p className="text-sm text-gray-600 dark:text-slate-400">Maximum Moment</p>
              <p className="text-2xl font-bold text-blue-700">{results.maxMoment} kNm</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300">
              <p className="text-sm text-gray-600 dark:text-slate-400">Maximum Shear</p>
              <p className="text-2xl font-bold text-green-700">{results.maxShear} kN</p>
            </div>
          </div>

          {results.diagrams.map((diagram, i) => (
            <div key={i} className="mb-8">
              <h4 className="font-bold text-lg text-gray-800 dark:text-slate-100 mb-4">Span {diagram.span}</h4>

              <div className="mb-6">
                <h5 className="font-semibold text-gray-700 dark:text-slate-300 mb-2">Bending Moment Diagram (BMD)</h5>
                <div className="h-48 bg-gradient-to-b from-blue-50 to-white border-2 border-blue-200 rounded-lg p-4 relative">
                  <svg className="w-full h-full">
                    {diagram.points.map((p, idx) => {
                      if (idx === 0) return null;
                      const x1 = ((idx - 1) / (diagram.points.length - 1)) * 100;
                      const x2 = (idx / (diagram.points.length - 1)) * 100;
                      const y1 = 50 + (parseFloat(diagram.points[idx - 1].M) / parseFloat(results.maxMoment)) * 40;
                      const y2 = 50 + (parseFloat(p.M) / parseFloat(results.maxMoment)) * 40;
                      return (
                        <line
                          key={idx}
                          x1={`${x1}%`}
                          y1={`${y1}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          stroke="#2563eb"
                          strokeWidth="2"
                        />
                      );
                    })}
                    <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#6b7280" strokeWidth="1" strokeDasharray="4" />
                  </svg>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-gray-700 mb-2">Shear Force Diagram (SFD)</h5>
                <div className="h-48 bg-gradient-to-b from-green-50 to-white border-2 border-green-200 rounded-lg p-4 relative">
                  <svg className="w-full h-full">
                    {diagram.points.map((p, idx) => {
                      if (idx === 0) return null;
                      const x1 = ((idx - 1) / (diagram.points.length - 1)) * 100;
                      const x2 = (idx / (diagram.points.length - 1)) * 100;
                      const y1 = 50 - (parseFloat(diagram.points[idx - 1].V) / parseFloat(results.maxShear)) * 40;
                      const y2 = 50 - (parseFloat(p.V) / parseFloat(results.maxShear)) * 40;
                      return (
                        <line
                          key={idx}
                          x1={`${x1}%`}
                          y1={`${y1}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          stroke="#16a34a"
                          strokeWidth="2"
                        />
                      );
                    })}
                    <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#6b7280" strokeWidth="1" strokeDasharray="4" />
                  </svg>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
            <p className="text-sm text-gray-700">
              <strong>Analysis Method:</strong> {results.method}
            </p>
            <p className="text-xs text-gray-500 mt-1 italic">
              Analysis results from this frame calculation can now be used for the beam or column design sections below.
            </p>
          </div>

          {results.method === "Moment Distribution Method" && (
            <>
              <FrameSchematic joints={results.joints} members={results.members} results={results} />
              <DistributionFactorsPanel results={results} />
              <IterationHistoryPanel results={results} />
            </>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-green-600 text-white shadow-2xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <h1 className="text-3xl font-bold">Steel Design Suite</h1>
            </div>
            <div className="text-sm bg-white/20 px-4 py-2 rounded-lg backdrop-blur">
              BS 5950:2000
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-white dark:bg-slate-800 shadow-xl min-h-screen border-r-2 border-gray-200 dark:border-slate-700">
            <nav className="p-4 space-y-2">
              <button
                onClick={() => { setActiveModule('beam'); setResults(null); }}
                className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${activeModule === 'beam'
                  ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Beam Design
              </button>

              <button
                onClick={() => { setActiveModule('column'); setResults(null); }}
                className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${activeModule === 'column'
                  ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Column Design
              </button>

              <button
                onClick={() => { setActiveModule('frame'); setResults(null); }}
                className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${activeModule === 'frame'
                  ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Frame Analysis
              </button>

              <div className="pt-4 mt-4 border-t-2 border-gray-200">
                <button
                  className="w-full text-left px-4 py-3 rounded-lg font-semibold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all flex items-center gap-2"
                >
                  <Save size={18} />
                  Save Project
                </button>
              </div>

              <div className="pt-4 mt-4">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <h3 className="font-bold text-sm text-blue-800 mb-2">Quick Reference</h3>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>UB:</strong> Universal Beam</p>
                    <p><strong>UC:</strong> Universal Column</p>
                    <p><strong>S275:</strong> fy=275 N/mm²</p>
                    <p><strong>S355:</strong> fy=355 N/mm²</p>
                  </div>
                </div>
              </div>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {activeModule === 'beam' && renderBeamModule()}
            {activeModule === 'column' && renderColumnModule()}
            {activeModule === 'frame' && renderFrameModule()}

            {renderResults()}
          </div>
        </main>
      </div>


    </div>
  );
};

export default SteelDesignApp;
