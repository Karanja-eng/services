import React, { useState, useRef, useEffect } from 'react';
import { Building2, Calculator, Layers, Frame, Wind, Box, Ruler, FileText, Moon, Sun, Menu, X, ChevronDown, ChevronRight, Columns, TrendingUp, ArrowLeft } from 'lucide-react';
import * as THREE from 'three';

import StructuralVisualizationComponent from '../../Drawings/visualise_component';
import { SectionView } from './SectionView';
import FrameViewer from './New_frame';
import InteractiveStructureBuilder from './InteractiveStructureBuilder';
// Theme Context
const ThemeContext = React.createContext();

const RCStructuralDesign = () => {
  const [theme, setTheme] = useState('light');
  const [activeModule, setActiveModule] = useState('loads');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    loads: true,
    ties: false,
    analysis: false,
    systems: false,
    modeling: false,
    advanced: false
  });

  // Load Combinations State
  const [loadData, setLoadData] = useState({
    deadLoad: '',
    imposedLoad: '',
    windLoad: '',
    loadFactor: '1.4',
    combination: 'uls'
  });

  // Tie Design State
  const [tieData, setTieData] = useState({
    tieType: 'internal',
    span: '',
    loadPerMeter: '',
    concreteGrade: 'C30',
    steelGrade: '500'
  });

  // Frame Analysis State
  const [frameData, setFrameData] = useState({
    method: 'portal',
    floors: '',
    bays: '',
    storyHeight: '',
    bayWidth: '',
    lateralLoad: ''
  });

  // Building System State
  const [systemData, setSystemData] = useState({
    type: 'rigid_frame',
    height: '',
    width: '',
    depth: '',
    coreSize: ''
  });

  // Computer Modeling State
  const [modelData, setModelData] = useState({
    category: 'cat1',
    bents: '',
    symmetry: 'symmetric',
    load: ''
  });

  // Beam Design State
  const [beamData, setBeamData] = useState({
    span: '', width: '300', depth: '500',
    concreteGrade: 'C30', steelGrade: '500',
    moment: '', shear: '', cover: '25'
  });

  // Column Design State
  const [columnData, setColumnData] = useState({
    height: '', width: '300', depth: '300',
    concreteGrade: 'C30', steelGrade: '500',
    axialLoad: '', moment: '', effectiveLength: ''
  });

  const [showReferenceTables, setShowReferenceTables] = useState(false);
  const [results, setResults] = useState(null);
  const isFullScreen = ['builder', 'advanced'].includes(activeModule);
  const canvasRef = useRef(null);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // BS Code Load Combination Calculations
  const calculateLoadCombinations = () => {
    const dead = parseFloat(loadData.deadLoad) || 0;
    const imposed = parseFloat(loadData.imposedLoad) || 0;
    const wind = parseFloat(loadData.windLoad) || 0;

    const combinations = {
      uls: {
        combo1: 1.4 * dead + 1.6 * imposed,
        combo2: 1.4 * dead + 1.6 * imposed + 1.2 * wind,
        combo3: 1.0 * dead + 1.4 * wind,
        combo4: 1.2 * dead + 1.2 * imposed + 1.2 * wind
      },
      sls: {
        characteristic: dead + imposed,
        quasi_permanent: dead + 0.3 * imposed,
        frequent: dead + 0.5 * imposed
      }
    };

    return combinations;
  };

  // Tie Force Calculations (BS 8110)
  const calculateTieForces = () => {
    const span = parseFloat(tieData.span) || 0;
    const load = parseFloat(tieData.loadPerMeter) || 0;

    let tieForce = 0;
    let spacing = 0;

    switch (tieData.tieType) {
      case 'internal':
        // Internal tie: Ft = 0.5(gk + qk)L or 1.0Ls whichever is greater
        tieForce = Math.max(0.5 * load * span, 1.0 * span);
        spacing = 'At every floor level';
        break;
      case 'peripheral':
        // Peripheral tie: Ft = 1.0Ls or 0.5(gk + qk)L whichever is greater
        tieForce = Math.max(1.0 * span, 0.5 * load * span);
        spacing = 'Around perimeter';
        break;
      case 'column':
        // Column tie: 3% of total vertical load or minimum tie
        tieForce = Math.max(0.03 * load * span * span, 75);
        spacing = 'At every floor';
        break;
      case 'corner':
        // Corner column tie: 2 × column tie force
        tieForce = Math.max(0.06 * load * span * span, 150);
        spacing = 'At corners';
        break;
      case 'vertical':
        // Vertical tie: Maximum of column design load or 3% column load
        tieForce = Math.max(load, 0.03 * load);
        spacing = 'Full height';
        break;
      default:
        tieForce = 0;
    }

    const fy = parseInt(tieData.steelGrade);
    const requiredArea = (tieForce * 1000) / (0.87 * fy);

    return {
      tieForce: tieForce.toFixed(2),
      requiredArea: requiredArea.toFixed(2),
      spacing,
      barSize: requiredArea < 100 ? 'H10' : requiredArea < 200 ? 'H12' : 'H16'
    };
  };

  // Portal Frame Method Analysis
  const analyzePortalFrame = () => {
    const floors = parseInt(frameData.floors) || 0;
    const bays = parseInt(frameData.bays) || 0;
    const height = parseFloat(frameData.storyHeight) || 0;
    const width = parseFloat(frameData.bayWidth) || 0;
    const load = parseFloat(frameData.lateralLoad) || 0;

    // Portal method assumptions: inflection points at mid-height
    const shearPerColumn = load / (bays + 1);
    const moment = shearPerColumn * (height / 2);
    const axialForce = moment / width;

    return {
      shearPerColumn: shearPerColumn.toFixed(2),
      moment: moment.toFixed(2),
      axialForce: axialForce.toFixed(2),
      inflectionPoint: (height / 2).toFixed(2)
    };
  };

  // Building System Analysis
  const analyzeStructuralSystem = () => {
    const height = parseFloat(systemData.height) || 0;
    const width = parseFloat(systemData.width) || 0;
    const type = systemData.type;

    let suitability = '';
    let driftLimit = 0;
    let characteristics = [];

    switch (type) {
      case 'rigid_frame':
        suitability = height <= 25 ? 'Suitable' : 'Consider bracing';
        driftLimit = height / 500;
        characteristics = ['Flexible space layout', 'Economic up to 25m'];
        break;
      case 'braced_frame':
        suitability = height <= 50 ? 'Suitable' : 'Consider shear walls';
        driftLimit = height / 600;
        characteristics = ['High lateral stiffness', 'Economic up to 50m'];
        break;
      case 'shear_wall':
        suitability = height <= 70 ? 'Suitable' : 'Consider coupled system';
        driftLimit = height / 700;
        characteristics = ['Very stiff', 'Good for high-rise'];
        break;
      case 'coupled_wall':
        suitability = height <= 100 ? 'Suitable' : 'Consider tube';
        driftLimit = height / 750;
        characteristics = ['Optimal stiffness', 'Coupling beams critical'];
        break;
      case 'framed_tube':
        suitability = height <= 150 ? 'Suitable' : 'Consider bundled tube';
        driftLimit = height / 800;
        characteristics = ['Perimeter resistance', 'Very tall buildings'];
        break;
      case 'tube_in_tube':
        suitability = height <= 200 ? 'Suitable' : 'Ultra high-rise';
        driftLimit = height / 850;
        characteristics = ['Core + perimeter', 'Maximum efficiency'];
        break;
      case 'outrigger':
        suitability = height <= 300 ? 'Suitable' : 'Mega-tall structure';
        driftLimit = height / 900;
        characteristics = ['Core + outriggers', 'Superior tall building'];
        break;
      default:
        suitability = 'Select system';
    }

    const aspectRatio = height / width;
    const slenderness = aspectRatio > 5 ? 'Slender - Wind critical' : aspectRatio > 3 ? 'Medium' : 'Stocky';

    return {
      suitability,
      driftLimit: driftLimit.toFixed(3),
      aspectRatio: aspectRatio.toFixed(2),
      slenderness,
      characteristics
    };
  };

  // Computer Modeling Analysis
  const analyzeComputerModel = () => {
    const bents = parseInt(modelData.bents) || 0;
    const load = parseFloat(modelData.load) || 0;
    const category = modelData.category;

    let distribution = '';
    let analysis = '';
    let loadPerBent = 0;

    switch (category) {
      case 'cat1':
        distribution = 'Equal distribution to identical parallel bents';
        loadPerBent = load / bents;
        analysis = 'Simple proportional distribution';
        break;
      case 'cat2':
        distribution = 'Distribution based on relative stiffness';
        loadPerBent = load / bents; // Simplified
        analysis = 'Requires stiffness matrix calculation';
        break;
      case 'cat3':
        distribution = 'Torsional effects considered';
        loadPerBent = load / bents; // Simplified
        analysis = 'Full 3D analysis required with center of rigidity';
        break;
      default:
        distribution = 'Select category';
    }

    return {
      distribution,
      analysis,
      loadPerBent: loadPerBent.toFixed(2),
      method: modelData.category === 'cat1' ? 'Direct' : 'Matrix analysis'
    };
  };

  const handleCalculate = async () => {
    let calculationResults = {};
    const API_BASE = 'http://localhost:8001/api/framed/api';

    try {
      switch (activeModule) {
        case 'design_dashboard':
        case 'frame':
          const framePayload = {
            floors: parseInt(frameData.floors) || 0,
            bays: parseInt(frameData.bays) || 0,
            story_height: parseFloat(frameData.storyHeight) || 0,
            bay_width: parseFloat(frameData.bayWidth) || 0,
            lateral_load: parseFloat(frameData.lateralLoad) || 0,
            vertical_load: parseFloat(loadData.deadLoad) + parseFloat(loadData.imposedLoad) || 0,
            concrete_grade: tieData.concreteGrade,
            steel_grade: parseInt(tieData.steelGrade)
          };
          const endpoint = activeModule === 'design_dashboard' ? 'design/all' : 'analyze';
          const frameRes = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(framePayload)
          });
          calculationResults = await frameRes.json();
          break;

        case 'loads':
          const loadPayload = {
            dead_load: parseFloat(loadData.deadLoad) || 0,
            imposed_load: parseFloat(loadData.imposedLoad) || 0,
            wind_load: parseFloat(loadData.windLoad) || 0,
            combination_type: loadData.combination
          };
          const loadRes = await fetch(`${API_BASE}/loads/combinations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loadPayload)
          });
          calculationResults = await loadRes.json();
          break;

        case 'ties':
          const tiePayload = {
            tie_type: tieData.tieType,
            span: parseFloat(tieData.span) || 0,
            load_per_meter: parseFloat(tieData.loadPerMeter) || 0,
            concrete_grade: tieData.concreteGrade,
            steel_grade: parseInt(tieData.steelGrade),
            floor_area: null
          };
          const tieRes = await fetch(`${API_BASE}/design/ties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tiePayload)
          });
          calculationResults = await tieRes.json();
          break;

        case 'systems':
          const systemPayload = {
            system_type: systemData.type,
            height: parseFloat(systemData.height) || 0,
            width: parseFloat(systemData.width) || 0,
            depth: parseFloat(systemData.depth) || 0,
            core_size: parseFloat(systemData.coreSize) || 0,
            wind_pressure: 1.5
          };
          const sysRes = await fetch(`${API_BASE}/analysis/structural-system`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(systemPayload)
          });
          calculationResults = await sysRes.json();
          break;

        case 'modeling':
          const modelPayload = {
            category: modelData.category,
            bents: parseInt(modelData.bents) || 0,
            load: parseFloat(modelData.load) || 0,
            symmetry: modelData.symmetry
          };
          const modelRes = await fetch(`${API_BASE}/analysis/computer-model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modelPayload)
          });
          calculationResults = await modelRes.json();
          break;

        case 'beam':
          const beamPayload = {
            span: parseFloat(beamData.span) || 0,
            width: parseFloat(beamData.width) || 300,
            depth: parseFloat(beamData.depth) || 500,
            concrete_grade: beamData.concreteGrade,
            steel_grade: parseInt(beamData.steelGrade),
            moment: parseFloat(beamData.moment) || 0,
            shear: parseFloat(beamData.shear) || 0,
            cover: parseFloat(beamData.cover) || 25
          };
          const beamRes = await fetch(`${API_BASE}/design/beam`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(beamPayload)
          });
          calculationResults = await beamRes.json();
          break;

        case 'column':
          const colPayload = {
            height: parseFloat(columnData.height) || 0,
            width: parseFloat(columnData.width) || 300,
            depth: parseFloat(columnData.depth) || 300,
            concrete_grade: columnData.concreteGrade,
            steel_grade: parseInt(columnData.steelGrade),
            axial_load: parseFloat(columnData.axialLoad) || 0,
            moment: parseFloat(columnData.moment) || 0,
            effective_length: columnData.effectiveLength ? parseFloat(columnData.effectiveLength) : null
          };
          const colRes = await fetch(`${API_BASE}/design/column`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(colPayload)
          });
          calculationResults = await colRes.json();
          break;

        default:
          calculationResults = {};
      }
      setResults(calculationResults);
    } catch (error) {
      console.error("Calculation failed:", error);
      alert("Failed to connect to calculation server");
    }
  };

  // 3D Visualization Effect removed - replaced by StructuralVisualizationComponent

  const bgColor = theme === 'dark' ? 'bg-gray-900' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50';
  const inputBg = theme === 'dark' ? 'bg-gray-700' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  const modules = [
    { id: 'builder', icon: Building2, label: 'Structure Builder', section: 'modeling' },
    { id: 'loads', icon: Calculator, label: 'Loads & Combinations', section: 'analysis' },
    { id: 'frame', icon: Frame, label: 'Frame Analysis', section: 'analysis' },
    { id: 'design_dashboard', icon: Box, label: 'Member Design Dashboard', section: 'design' },
    { id: 'beams', icon: Ruler, label: 'Beam Reports', section: 'design' },
    { id: 'columns', icon: Columns, label: 'Column Reports', section: 'design' },
    { id: 'foundations', icon: Box, label: 'Foundation Reports', section: 'design' },
    { id: 'modeling', icon: Box, label: 'System Properties', section: 'modeling' },
    { id: 'advanced', icon: TrendingUp, label: 'Advanced Settings', section: 'modeling' },
  ];

  const sections = [
    { id: 'modeling', label: '1. Build & Setup', icon: Building2 },
    { id: 'analysis', label: '2. Loads & Analysis', icon: Calculator },
    { id: 'design', label: '3. Member Design', icon: Box },
  ];

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} transition-colors duration-200`}>
      {/* Header */}
      {!isFullScreen && (
        <header className={`${cardBg} border-b ${borderColor} px-6 py-4 top-0 z-50`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <Building2 size={32} className="text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold">BS Structural Design System</h1>
                <p className="text-sm opacity-70">BS Code Compliant Analysis & Design</p>
              </div>
            </div>
            <button onClick={toggleTheme} className={`p-2 rounded-lg ${inputBg} hover:opacity-80`}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
      )}

      <div className="flex">
        {/* Sidebar */}
        {!isFullScreen && (
          <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} ${cardBg} border-r ${borderColor} transition-all duration-300 overflow-hidden`}>
            <div className="p-4 space-y-6">
              {sections.map(section => (
                <div key={section.id}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-3 px-2">
                    {section.label}
                  </h3>
                  <nav className="space-y-1">
                    {modules.filter(m => m.section === section.id).map(module => (
                      <button
                        key={module.id}
                        onClick={() => setActiveModule(module.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeModule === module.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : `${inputBg} hover:bg-blue-50 hover:text-blue-600`
                          }`}
                      >
                        <module.icon size={18} />
                        <span className="text-sm font-medium">{module.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${isFullScreen ? 'h-screen overflow-hidden' : 'p-6'}`}>
          {isFullScreen && (
            <div className={`flex items-center gap-4 px-6 py-3 border-b ${borderColor} ${cardBg} sticky top-0 z-50`}>
              <button
                onClick={() => setActiveModule('design_dashboard')}
                className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ArrowLeft size={18} />
                Back to Dashboard
              </button>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <div className="flex items-center gap-2">
                {React.createElement(modules.find(m => m.id === activeModule)?.icon || Box, { size: 20, className: "text-blue-600" })}
                <span className="font-bold">{modules.find(m => m.id === activeModule)?.label}</span>
              </div>
            </div>
          )}

          <div className={isFullScreen ? "h-[calc(100vh-56px)] w-full" : "max-w-6xl mx-auto space-y-6"}>
            {/* Load Combinations Module */}
            {activeModule === 'loads' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calculator size={24} className="text-blue-600" />
                  Load Combinations (BS 8110)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Dead Load (Gk) kN/m²</label>
                    <input
                      type="number"
                      value={loadData.deadLoad}
                      onChange={(e) => setLoadData({ ...loadData, deadLoad: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Gk"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Imposed Load (Qk) kN/m²</label>
                    <input
                      type="number"
                      value={loadData.imposedLoad}
                      onChange={(e) => setLoadData({ ...loadData, imposedLoad: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Qk"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Wind Load (Wk) kN/m²</label>
                    <input
                      type="number"
                      value={loadData.windLoad}
                      onChange={(e) => setLoadData({ ...loadData, windLoad: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Wk"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Calculate Combinations
                </button>
              </div>
            )}

            {/* Tie Design Module */}
            {activeModule === 'ties' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Layers size={24} className="text-blue-600" />
                  Tie Design (BS 8110)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tie Type</label>
                    <select
                      value={tieData.tieType}
                      onChange={(e) => setTieData({ ...tieData, tieType: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="internal">Internal Tie</option>
                      <option value="peripheral">Peripheral Tie</option>
                      <option value="column">Column/Wall Tie</option>
                      <option value="corner">Corner Column Tie</option>
                      <option value="vertical">Vertical Tie</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Span (m)</label>
                    <input
                      type="number"
                      value={tieData.span}
                      onChange={(e) => setTieData({ ...tieData, span: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter span"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Load per Meter (kN/m)</label>
                    <input
                      type="number"
                      value={tieData.loadPerMeter}
                      onChange={(e) => setTieData({ ...tieData, loadPerMeter: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter load"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Design Ties
                </button>
              </div>
            )}

            {/* Frame Analysis Module */}
            {activeModule === 'frame' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Frame size={24} className="text-blue-600" />
                  Frame Analysis
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Method</label>
                    <select
                      value={frameData.method}
                      onChange={(e) => setFrameData({ ...frameData, method: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="portal">Portal Method</option>
                      <option value="cantilever">Cantilever Method</option>
                      <option value="simple">Simple Method</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Floors</label>
                    <input
                      type="number"
                      value={frameData.floors}
                      onChange={(e) => setFrameData({ ...frameData, floors: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Floors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Bays</label>
                    <input
                      type="number"
                      value={frameData.bays}
                      onChange={(e) => setFrameData({ ...frameData, bays: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Bays"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Story Height (m)</label>
                    <input
                      type="number"
                      value={frameData.storyHeight}
                      onChange={(e) => setFrameData({ ...frameData, storyHeight: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Height"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Bay Width (m)</label>
                    <input
                      type="number"
                      value={frameData.bayWidth}
                      onChange={(e) => setFrameData({ ...frameData, bayWidth: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Width"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Lateral Load (kN)</label>
                    <input
                      type="number"
                      value={frameData.lateralLoad}
                      onChange={(e) => setFrameData({ ...frameData, lateralLoad: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Load"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Analyze Frame
                </button>
              </div>
            )}

            {/* Structural Systems Module */}
            {activeModule === 'systems' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 size={24} className="text-blue-600" />
                  Structural Systems
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">System Type</label>
                    <select
                      value={systemData.type}
                      onChange={(e) => setSystemData({ ...systemData, type: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="rigid_frame">Rigid Frame</option>
                      <option value="braced_frame">Braced Frame</option>
                      <option value="shear_wall">Shear Wall</option>
                      <option value="coupled_wall">Coupled Wall</option>
                      <option value="framed_tube">Framed Tube</option>
                      <option value="tube_in_tube">Tube-in-Tube</option>
                      <option value="outrigger">Outrigger System</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Building Height (m)</label>
                    <input
                      type="number"
                      value={systemData.height}
                      onChange={(e) => setSystemData({ ...systemData, height: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Height"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Building Width (m)</label>
                    <input
                      type="number"
                      value={systemData.width}
                      onChange={(e) => setSystemData({ ...systemData, width: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Width"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Building Depth (m)</label>
                    <input
                      type="number"
                      value={systemData.depth}
                      onChange={(e) => setSystemData({ ...systemData, depth: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Depth"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Core Size (m)</label>
                    <input
                      type="number"
                      value={systemData.coreSize}
                      onChange={(e) => setSystemData({ ...systemData, coreSize: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Core Size"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Check Suitability
                </button>
              </div>
            )}


            {/* Computer Modeling Module */}
            {activeModule === 'modeling' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Box size={24} className="text-blue-600" />
                  Computer Modeling Categories
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Model Category</label>
                    <select
                      value={modelData.category}
                      onChange={(e) => setModelData({ ...modelData, category: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="cat1">Category 1: Symmetric Floor, Identical Parallel Bents</option>
                      <option value="cat2">Category 2: Symmetric Floor, Non-Identical Bents</option>
                      <option value="cat3">Category 3: Non-Symmetric Floor Plan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Bents</label>
                    <input
                      type="number"
                      value={modelData.bents}
                      onChange={(e) => setModelData({ ...modelData, bents: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter number of bents"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Applied Load (kN)</label>
                    <input
                      type="number"
                      value={modelData.load}
                      onChange={(e) => setModelData({ ...modelData, load: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter applied load"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Symmetry</label>
                    <select
                      value={modelData.symmetry}
                      onChange={(e) => setModelData({ ...modelData, symmetry: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="symmetric">Symmetric</option>
                      <option value="asymmetric">Asymmetric</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Analyze Model
                </button>
              </div>
            )}

            {/* Beam Design Module */}
            {activeModule === 'beam' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Box size={24} className="text-blue-600" />
                  RC Beam Design (BS 8110)
                </h2>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Span (m)</label>
                    <input type="number" value={beamData.span} onChange={(e) => setBeamData({ ...beamData, span: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Width (mm)</label>
                    <input type="number" value={beamData.width} onChange={(e) => setBeamData({ ...beamData, width: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Depth (mm)</label>
                    <input type="number" value={beamData.depth} onChange={(e) => setBeamData({ ...beamData, depth: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Design Moment (kNm)</label>
                    <input type="number" value={beamData.moment} onChange={(e) => setBeamData({ ...beamData, moment: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Design Shear (kN)</label>
                    <input type="number" value={beamData.shear} onChange={(e) => setBeamData({ ...beamData, shear: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cover (mm)</label>
                    <input type="number" value={beamData.cover} onChange={(e) => setBeamData({ ...beamData, cover: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                </div>
                <button onClick={handleCalculate} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Design Beam
                </button>
              </div>
            )}

            {/* Column Design Module */}
            {activeModule === 'column' && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Columns size={24} className="text-blue-600" />
                  RC Column Design (BS 8110)
                </h2>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Height (m)</label>
                    <input type="number" value={columnData.height} onChange={(e) => setColumnData({ ...columnData, height: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Width (mm)</label>
                    <input type="number" value={columnData.width} onChange={(e) => setColumnData({ ...columnData, width: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Depth (mm)</label>
                    <input type="number" value={columnData.depth} onChange={(e) => setColumnData({ ...columnData, depth: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Axial Load (kN)</label>
                    <input type="number" value={columnData.axialLoad} onChange={(e) => setColumnData({ ...columnData, axialLoad: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Design Moment (kNm)</label>
                    <input type="number" value={columnData.moment} onChange={(e) => setColumnData({ ...columnData, moment: e.target.value })} className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`} />
                  </div>
                </div>
                <button onClick={handleCalculate} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Design Column
                </button>
              </div>
            )}

            {/* Framed Grid */}


            {/* 3D Visualization */}
            {/* 3D Visualization */}
            {activeModule === 'visualization' && (
              <div className="h-[600px] w-full rounded-lg overflow-hidden border border-gray-200 relative">
                <StructuralVisualizationComponent
                  theme={theme}
                  componentType="tall_framed_analysis"
                  componentData={{
                    floors: parseInt(frameData.floors) || 1,
                    bays: parseInt(frameData.bays) || 1,
                    story_height: parseFloat(frameData.storyHeight) || 3,
                    bay_width: parseFloat(frameData.bayWidth) || 5,
                    results: results
                  }}
                />
              </div>
            )}

            {/* Results Display */}
            {results && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText size={24} className="text-green-600" />
                  Calculation Results
                </h2>

                {activeModule === 'loads' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold mb-2">Ultimate Limit State (ULS)</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Combination 1: 1.4Gk + 1.6Qk</p>
                          <p className="text-2xl font-bold text-blue-600">{results.uls?.combo1?.toFixed(2)} kN/m²</p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Combination 2: 1.4Gk + 1.6Qk + 1.2Wk</p>
                          <p className="text-2xl font-bold text-blue-600">{results.uls?.combo2?.toFixed(2)} kN/m²</p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Combination 3: 1.0Gk + 1.4Wk</p>
                          <p className="text-2xl font-bold text-blue-600">{results.uls?.combo3?.toFixed(2)} kN/m²</p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Combination 4: 1.2Gk + 1.2Qk + 1.2Wk</p>
                          <p className="text-2xl font-bold text-blue-600">{results.uls?.combo4?.toFixed(2)} kN/m²</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold mb-2">Serviceability Limit State (SLS)</h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Characteristic</p>
                          <p className="text-xl font-bold text-green-600">{results.sls?.characteristic?.toFixed(2)} kN/m²</p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Quasi-Permanent</p>
                          <p className="text-xl font-bold text-green-600">{results.sls?.quasi_permanent?.toFixed(2)} kN/m²</p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Frequent</p>
                          <p className="text-xl font-bold text-green-600">{results.sls?.frequent?.toFixed(2)} kN/m²</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === 'ties' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Required Tie Force</p>
                        <p className="text-2xl font-bold text-blue-600">{results.tieForce} kN</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Required Steel Area</p>
                        <p className="text-2xl font-bold text-blue-600">{results.requiredArea} mm²</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Recommended Bar Size</p>
                        <p className="text-2xl font-bold text-green-600">{results.barSize}</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Spacing Requirement</p>
                        <p className="text-lg font-bold text-green-600">{results.spacing}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === 'frame' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Shear per Column</p>
                        <p className="text-2xl font-bold text-blue-600">{results.shearPerColumn} kN</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Maximum Moment</p>
                        <p className="text-2xl font-bold text-blue-600">{results.moment} kNm</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Axial Force</p>
                        <p className="text-2xl font-bold text-blue-600">{results.axialForce} kN</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Inflection Point</p>
                        <p className="text-2xl font-bold text-green-600">{results.inflectionPoint} m</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === 'systems' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">System Suitability</p>
                        <p className="text-xl font-bold text-blue-600">{results.suitability}</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Drift Limit (H/X)</p>
                        <p className="text-xl font-bold text-blue-600">{results.driftLimit} m</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Aspect Ratio</p>
                        <p className="text-xl font-bold text-blue-600">{results.aspectRatio}</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Slenderness</p>
                        <p className="text-xl font-bold text-green-600">{results.slenderness}</p>
                      </div>
                    </div>
                    <div className={`p-4 ${inputBg} rounded-lg`}>
                      <p className="text-sm opacity-70 mb-2">System Characteristics</p>
                      <ul className="list-disc list-inside space-y-1">
                        {results.characteristics?.map((char, idx) => (
                          <li key={idx} className="text-sm">{char}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeModule === 'modeling' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Load per Bent</p>
                        <p className="text-2xl font-bold text-blue-600">{results.loadPerBent} kN</p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Analysis Method</p>
                        <p className="text-xl font-bold text-blue-600">{results.method}</p>
                      </div>
                    </div>
                    <div className={`p-4 ${inputBg} rounded-lg`}>
                      <p className="text-sm opacity-70 mb-2">Load Distribution</p>
                      <p className="text-sm">{results.distribution}</p>
                    </div>
                    <div className={`p-4 ${inputBg} rounded-lg`}>
                      <p className="text-sm opacity-70 mb-2">Analysis Approach</p>
                      <p className="text-sm">{results.analysis}</p>
                    </div>
                  </div>
                )}

                {activeModule === 'beam' && results.reinforcement && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className={`${inputBg} p-4 rounded-lg`}>
                        <h3 className="font-bold mb-4">Design Summary</h3>
                        <div className="space-y-2">
                          <p className="flex justify-between"><span>Status:</span> <span className={results.status === 'OK' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{results.status}</span></p>
                          <p className="flex justify-between"><span>Required Steel (As):</span> <span>{results.reinforcement?.tension_bars?.area_required?.toFixed(0)} mm²</span></p>
                          <p className="flex justify-between"><span>Provided Steel (As,prov):</span> <span>{results.reinforcement?.tension_bars?.area_provided?.toFixed(0)} mm²</span></p>
                          <p className="flex justify-between"><span>Start/End Shear:</span> <span>{results.shear_check?.shear_stress?.toFixed(2)} N/mm²</span></p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <SectionView
                          type="beam"
                          width={parseFloat(beamData.width)}
                          depth={parseFloat(beamData.depth)}
                          cover={parseFloat(beamData.cover)}
                          reinforcement={results.reinforcement}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === 'column' && results.reinforcement && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className={`${inputBg} p-4 rounded-lg`}>
                        <h3 className="font-bold mb-4">Design Summary</h3>
                        <div className="space-y-2">
                          <p className="flex justify-between"><span>Status:</span> <span className={results.status === 'OK' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{results.status}</span></p>
                          <p className="flex justify-between"><span>Axial Capacity (N):</span> <span>{results.capacity?.axial?.toFixed(0)} kN</span></p>
                          <p className="flex justify-between"><span>Moment Capacity (M):</span> <span>{results.capacity?.moment?.toFixed(0)} kNm</span></p>
                          <p className="flex justify-between"><span>Main Bars:</span> <span>{results.reinforcement.number_of_bars} {results.reinforcement.bar_size}</span></p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <SectionView
                          type="column"
                          width={parseFloat(columnData.width)}
                          depth={parseFloat(columnData.depth)}
                          cover={40} // Default for columns usually higher
                          reinforcement={results.reinforcement}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === 'design_dashboard' && results?.design && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Beams', count: results.design.beams.length, color: 'blue' },
                        { label: 'Columns', count: results.design.columns.length, color: 'green' },
                        { label: 'Foundations', count: results.design.foundations.length, color: 'purple' },
                        { label: 'Slabs', count: results.design.slabs.length, color: 'orange' }
                      ].map(stat => (
                        <div key={stat.label} className={`${inputBg} p-4 rounded-xl border border-${stat.color}-200 flex flex-col items-center justify-center`}>
                          <p className={`text-${stat.color}-600 font-bold text-2xl`}>{stat.count}</p>
                          <p className="text-xs opacity-60 uppercase">{stat.label} Designed</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-600/20">
                      <h3 className="font-bold text-blue-600 mb-2 flex items-center gap-2">
                        <Calculator size={18} />
                        Engineering Utilization Summary
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left opacity-60">
                              <th className="pb-2">Member Group</th>
                              <th className="pb-2">Status</th>
                              <th className="pb-2">Avg Utilization</th>
                              <th className="pb-2">Critical Member</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-2 font-medium">Main Beams</td>
                              <td><span className="bg-green-500/20 text-green-600 px-2 py-0.5 rounded text-xs font-bold">PASS</span></td>
                              <td>42%</td>
                              <td>B-01-Level2</td>
                            </tr>
                            <tr>
                              <td className="py-2 font-medium">Vertical Columns</td>
                              <td><span className="bg-green-500/20 text-green-600 px-2 py-0.5 rounded text-xs font-bold">PASS</span></td>
                              <td>68%</td>
                              <td>C-04-Level0</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === 'beams' && results?.design?.beams && (
                  <div className="grid grid-cols-1 gap-4">
                    {results.design.beams.map(beam => (
                      <div key={beam.member_id} className={`${inputBg} p-4 rounded-xl border ${borderColor}`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold">Member ID: {beam.member_id}</h4>
                          <span className={`${beam.status ? 'bg-green-500' : 'bg-red-500'} text-white px-3 py-1 rounded-full text-xs font-bold`}>
                            {beam.status ? 'BS 8110 COMPLIANT' : 'FAIL'}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="opacity-70">Main Tension Steel: <span className="font-bold text-blue-600">{beam.details.span_designs[0]?.sagging_bars_count}H{beam.details.span_designs[0]?.sagging_bars_diameter}</span></p>
                            <p className="opacity-70">Shear Links: <span className="font-bold">H{beam.details.span_designs[0]?.shear_links_diameter}@{beam.details.span_designs[0]?.shear_links_spacing}mm</span></p>
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="opacity-70">Moment Util: {(beam.details.span_designs[0].design_checks.moment_utilization * 100).toFixed(1)}%</p>
                            <p className="opacity-70">Shear Util: {(beam.details.span_designs[0].design_checks.shear_utilization * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeModule === 'columns' && results?.design?.columns && (
                  <div className="grid grid-cols-1 gap-4">
                    {results.design.columns.map(col => (
                      <div key={col.member_id} className={`${inputBg} p-4 rounded-xl border ${borderColor}`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold">Column ID: {col.member_id}</h4>
                          <span className={`bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase`}>
                            {col.classification} - {col.mode}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs opacity-60">Steel Area</p>
                            <p className="font-bold text-lg">{col.steel_area.toFixed(0)} mm²</p>
                          </div>
                          <div>
                            <p className="text-xs opacity-60">Status</p>
                            <p className="font-bold text-green-600 uppercase">{col.status}</p>
                          </div>
                          <div>
                            <p className="text-xs opacity-60">Ratio (ρ)</p>
                            <p className="font-bold">{col.steel_percentage.toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeModule === 'foundations' && results?.design?.foundations && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.design.foundations.map((found, idx) => (
                      <div key={idx} className={`${inputBg} p-4 rounded-xl border ${borderColor}`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold">{found.design_summary.type}</h4>
                          <span className={`${found.design_summary.status === 'PASS' ? 'bg-green-500' : 'bg-red-500'} text-white px-3 py-1 rounded-full text-xs font-bold`}>
                            {found.design_summary.status}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="flex justify-between"><span>Dimensions:</span> <span className="font-bold">{found.design_summary.foundation_size}</span></p>
                          <p className="flex justify-between"><span>Reinf X:</span> <span>{found.reinforcement.main_bars_x}</span></p>
                          <p className="flex justify-between"><span>Reinf Y:</span> <span>{found.reinforcement.main_bars_y}</span></p>
                          <div className="pt-2 border-t opacity-40">
                            <p className="flex justify-between text-xs"><span>Bearing Utilization:</span> <span>{(found.design_summary.utilization_ratio * 100).toFixed(1)}%</span></p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeModule === 'slabs' && results?.design?.slabs && (
                  <div className="grid grid-cols-1 gap-4">
                    {results.design.slabs.map((slab, idx) => (
                      <div key={idx} className={`${inputBg} p-4 rounded-xl border ${borderColor}`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold">{slab.slabType}</h4>
                          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                            BS 8110 DESIGN
                          </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="opacity-70">Main Reinf: <span className="font-bold text-blue-600">{slab.reinforcementX || slab.mainReinforcement}</span></p>
                            <p className="opacity-70">Distribution: <span className="font-bold">{slab.reinforcementY || slab.distributionSteel}</span></p>
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="opacity-70">Thickness: {slab.totalDepth} mm</p>
                            <p className="opacity-70">Effective Depth: {slab.effectiveDepth} mm</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                  <p className="text-sm">
                    <strong>Note:</strong> All calculations are based on BS 8110 and Eurocode standards.
                    Results should be verified by a qualified structural engineer before implementation.
                  </p>
                </div>
              </div>
            )}

            {activeModule === 'advanced' && (
              <div className="h-[800px]">
                <FrameViewer />
              </div>
            )}

            {activeModule === 'builder' && (
              <div className="h-[800px]">
                <InteractiveStructureBuilder />
              </div>
            )}

            {/* BS Code Reference Tables */}
            <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText size={24} className="text-blue-600" />
                  BS Code Reference Tables
                </h2>
                <button
                  onClick={() => setShowReferenceTables(!showReferenceTables)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${showReferenceTables
                    ? 'bg-blue-600 text-white shadow-md'
                    : `${inputBg} border ${borderColor} hover:bg-gray-100`
                    }`}
                >
                  {showReferenceTables ? 'Hide Tables' : 'Show Reference Tables'}
                  {showReferenceTables ? <ChevronDown size={18} className="rotate-180" /> : <ChevronRight size={18} />}
                </button>
              </div>

              {showReferenceTables && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className={`p-4 ${inputBg} rounded-lg`}>
                    <h3 className="font-bold mb-2">Concrete Grades (BS 8110)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-2">Grade</th>
                            <th className="text-left py-2">fcu (N/mm²)</th>
                            <th className="text-left py-2">Application</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">C25</td>
                            <td className="py-2">25</td>
                            <td className="py-2">General construction</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">C30</td>
                            <td className="py-2">30</td>
                            <td className="py-2">Reinforced concrete</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">C40</td>
                            <td className="py-2">40</td>
                            <td className="py-2">High strength applications</td>
                          </tr>
                          <tr>
                            <td className="py-2">C50</td>
                            <td className="py-2">50</td>
                            <td className="py-2">Pre-stressed concrete</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={`p-4 ${inputBg} rounded-lg`}>
                    <h3 className="font-bold mb-2">Load Factors (BS 8110)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-2">Load Type</th>
                            <th className="text-left py-2">ULS Factor</th>
                            <th className="text-left py-2">SLS Factor</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">Dead Load (Gk)</td>
                            <td className="py-2">1.4</td>
                            <td className="py-2">1.0</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">Imposed Load (Qk)</td>
                            <td className="py-2">1.6</td>
                            <td className="py-2">1.0</td>
                          </tr>
                          <tr>
                            <td className="py-2">Wind Load (Wk)</td>
                            <td className="py-2">1.4</td>
                            <td className="py-2">1.0</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={`p-4 ${inputBg} rounded-lg`}>
                    <h3 className="font-bold mb-2">Reinforcement Bar Sizes (BS 4449)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-2">Bar Size</th>
                            <th className="text-left py-2">Diameter (mm)</th>
                            <th className="text-left py-2">Area (mm²)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">H8</td>
                            <td className="py-2">8</td>
                            <td className="py-2">50</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">H10</td>
                            <td className="py-2">10</td>
                            <td className="py-2">79</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">H12</td>
                            <td className="py-2">12</td>
                            <td className="py-2">113</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">H16</td>
                            <td className="py-2">16</td>
                            <td className="py-2">201</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">H20</td>
                            <td className="py-2">20</td>
                            <td className="py-2">314</td>
                          </tr>
                          <tr>
                            <td className="py-2">H25</td>
                            <td className="py-2">25</td>
                            <td className="py-2">491</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RCStructuralDesign;
