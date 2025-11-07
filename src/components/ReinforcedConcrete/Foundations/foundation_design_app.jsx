import React, { useState } from 'react';
import { Calculator, FileText, Settings, Download, Save, CheckCircle } from 'lucide-react';

const FoundationDesignApp = () => {
  const [foundationType, setFoundationType] = useState('pad');
  const [columnShape, setColumnShape] = useState('square');
  const [columnPosition, setColumnPosition] = useState('centre');
  const [activeTab, setActiveTab] = useState('input');
  
  // Input States
  const [inputs, setInputs] = useState({
    // Loads
    deadLoad: '',
    liveLoad: '',
    windLoad: '',
    momentX: '',
    momentY: '',
    shearX: '',
    shearY: '',
    
    // Column Dimensions
    columnWidth: '',
    columnDepth: '',
    columnDiameter: '',
    
    // Material Properties
    concreteFck: '30',
    steelFyk: '500',
    soilBearing: '',
    
    // Foundation Dimensions (for checking/iteration)
    foundationLength: '',
    foundationWidth: '',
    foundationDepth: '',
    
    // Pile Foundation
    pileCount: '',
    pileDiameter: '',
    pileCapacity: '',
    pileSpacing: '',
    
    // Cover and other
    cover: '50',
    density: '24'
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setInputs({...inputs, [e.target.name]: e.target.value});
  };

  const calculateFoundation = async () => {
    setLoading(true);
    
    // Simulate API call - replace with actual FastAPI endpoint
    setTimeout(() => {
      const mockResults = {
        designSummary: {
          status: 'PASS',
          utilizationRatio: 0.87,
          foundationSize: `${inputs.foundationLength || '2500'} x ${inputs.foundationWidth || '2500'} x ${inputs.foundationDepth || '600'}mm`,
        },
        loadAnalysis: {
          totalVerticalLoad: parseFloat(inputs.deadLoad || 0) + parseFloat(inputs.liveLoad || 0),
          designLoad: (parseFloat(inputs.deadLoad || 0) * 1.35 + parseFloat(inputs.liveLoad || 0) * 1.5).toFixed(2),
          bearingPressure: 245.5,
          allowablePressure: parseFloat(inputs.soilBearing || 300),
        },
        reinforcement: {
          mainBarsX: '12H16@200 (B1)',
          mainBarsY: '12H16@200 (B2)',
          area: 2412,
          areaRequired: 1950,
        },
        checks: [
          { description: 'Bearing Pressure', value: '245.5 kN/m²', limit: `${inputs.soilBearing || 300} kN/m²`, status: 'PASS', ratio: 0.82 },
          { description: 'Punching Shear', value: '1.25 MPa', limit: '1.85 MPa', status: 'PASS', ratio: 0.68 },
          { description: 'Beam Shear (X)', value: '0.45 MPa', limit: '0.62 MPa', status: 'PASS', ratio: 0.73 },
          { description: 'Beam Shear (Y)', value: '0.45 MPa', limit: '0.62 MPa', status: 'PASS', ratio: 0.73 },
          { description: 'Reinforcement Ratio', value: '0.42%', limit: '0.13% min', status: 'PASS', ratio: 3.23 },
        ],
        bsReferences: [
          'BS EN 1992-1-1:2004 - Design of concrete structures',
          'BS 8004:2015 - Code of practice for foundations',
          'BS EN 1997-1:2004 - Geotechnical design'
        ]
      };
      
      setResults(mockResults);
      setLoading(false);
      setActiveTab('results');
    }, 1500);
  };

  const renderInputSection = () => {
    return (
      <div className="space-y-6">
        {/* Foundation Type Selection */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Foundation Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['pad', 'strip', 'pile', 'pilecap'].map(type => (
              <button
                key={type}
                onClick={() => setFoundationType(type)}
                className={`p-3 rounded border-2 transition-all ${
                  foundationType === type 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)} {type === 'pilecap' ? 'Cap' : 'Foundation'}
              </button>
            ))}
          </div>
        </div>

        {/* Column Configuration */}
        {foundationType === 'pad' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Column Configuration</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Column Shape</label>
                <select 
                  value={columnShape} 
                  onChange={(e) => setColumnShape(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="square">Square</option>
                  <option value="rectangular">Rectangular</option>
                  <option value="circular">Circular</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Column Position</label>
                <select 
                  value={columnPosition} 
                  onChange={(e) => setColumnPosition(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="centre">Centre</option>
                  <option value="edge">Edge (Eccentric)</option>
                  <option value="corner">Corner</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Loads Input */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Design Loads (kN, kNm)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InputField label="Dead Load (Gk)" name="deadLoad" value={inputs.deadLoad} onChange={handleInputChange} unit="kN" />
            <InputField label="Live Load (Qk)" name="liveLoad" value={inputs.liveLoad} onChange={handleInputChange} unit="kN" />
            <InputField label="Wind Load (Wk)" name="windLoad" value={inputs.windLoad} onChange={handleInputChange} unit="kN" />
            <InputField label="Moment X" name="momentX" value={inputs.momentX} onChange={handleInputChange} unit="kNm" />
            <InputField label="Moment Y" name="momentY" value={inputs.momentY} onChange={handleInputChange} unit="kNm" />
            <InputField label="Shear X" name="shearX" value={inputs.shearX} onChange={handleInputChange} unit="kN" />
          </div>
        </div>

        {/* Column Dimensions */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Column Dimensions (mm)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {columnShape !== 'circular' ? (
              <>
                <InputField label="Column Width" name="columnWidth" value={inputs.columnWidth} onChange={handleInputChange} unit="mm" />
                <InputField label="Column Depth" name="columnDepth" value={inputs.columnDepth} onChange={handleInputChange} unit="mm" />
              </>
            ) : (
              <InputField label="Column Diameter" name="columnDiameter" value={inputs.columnDiameter} onChange={handleInputChange} unit="mm" />
            )}
          </div>
        </div>

        {/* Material Properties */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Material Properties (BS EN 1992-1-1)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label="Concrete fck" name="concreteFck" value={inputs.concreteFck} onChange={handleInputChange} unit="MPa" />
            <InputField label="Steel fyk" name="steelFyk" value={inputs.steelFyk} onChange={handleInputChange} unit="MPa" />
            <InputField label="Soil Bearing" name="soilBearing" value={inputs.soilBearing} onChange={handleInputChange} unit="kN/m²" />
            <InputField label="Cover" name="cover" value={inputs.cover} onChange={handleInputChange} unit="mm" />
          </div>
        </div>

        {/* Foundation Dimensions */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Foundation Dimensions (mm)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InputField label="Length (L)" name="foundationLength" value={inputs.foundationLength} onChange={handleInputChange} unit="mm" />
            <InputField label="Width (B)" name="foundationWidth" value={inputs.foundationWidth} onChange={handleInputChange} unit="mm" />
            <InputField label="Depth (D)" name="foundationDepth" value={inputs.foundationDepth} onChange={handleInputChange} unit="mm" />
          </div>
        </div>

        {/* Pile Foundation Inputs */}
        {(foundationType === 'pile' || foundationType === 'pilecap') && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Pile Configuration (BS 8004)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InputField label="Number of Piles" name="pileCount" value={inputs.pileCount} onChange={handleInputChange} />
              <InputField label="Pile Diameter" name="pileDiameter" value={inputs.pileDiameter} onChange={handleInputChange} unit="mm" />
              <InputField label="Pile Capacity" name="pileCapacity" value={inputs.pileCapacity} onChange={handleInputChange} unit="kN" />
              <InputField label="Pile Spacing" name="pileSpacing" value={inputs.pileSpacing} onChange={handleInputChange} unit="mm" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Project
          </button>
          <button 
            onClick={calculateFoundation}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-400"
          >
            <Calculator className="w-5 h-5" />
            {loading ? 'Calculating...' : 'Design Foundation'}
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="space-y-6">
        {/* Design Summary */}
        <div className={`p-6 rounded-lg border-2 ${
          results.designSummary.status === 'PASS' 
            ? 'bg-green-50 border-green-500' 
            : 'bg-red-50 border-red-500'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className={`w-8 h-8 ${
                results.designSummary.status === 'PASS' ? 'text-green-600' : 'text-red-600'
              }`} />
              <div>
                <h3 className="text-xl font-bold text-gray-800">Design {results.designSummary.status}</h3>
                <p className="text-gray-600">Utilization Ratio: {(results.designSummary.utilizationRatio * 100).toFixed(1)}%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Foundation Size</p>
              <p className="text-lg font-semibold text-gray-800">{results.designSummary.foundationSize}</p>
            </div>
          </div>
        </div>

        {/* Load Analysis Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Load Analysis (BS EN 1990)</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Parameter</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Value</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-3 text-gray-700">Total Vertical Load (SLS)</td>
                <td className="px-6 py-3 text-right font-medium">{results.loadAnalysis.totalVerticalLoad}</td>
                <td className="px-6 py-3 text-right text-gray-600">kN</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-3 text-gray-700">Design Load (ULS: 1.35Gk + 1.5Qk)</td>
                <td className="px-6 py-3 text-right font-medium">{results.loadAnalysis.designLoad}</td>
                <td className="px-6 py-3 text-right text-gray-600">kN</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-700">Bearing Pressure (SLS)</td>
                <td className="px-6 py-3 text-right font-medium">{results.loadAnalysis.bearingPressure}</td>
                <td className="px-6 py-3 text-right text-gray-600">kN/m²</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-3 text-gray-700">Allowable Bearing Pressure</td>
                <td className="px-6 py-3 text-right font-medium">{results.loadAnalysis.allowablePressure}</td>
                <td className="px-6 py-3 text-right text-gray-600">kN/m²</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Design Checks Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Design Checks (BS EN 1992-1-1)</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Check Description</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Applied</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Capacity</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ratio</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.checks.map((check, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-3 text-gray-700">{check.description}</td>
                  <td className="px-6 py-3 text-right font-medium">{check.value}</td>
                  <td className="px-6 py-3 text-right font-medium">{check.limit}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      check.ratio < 0.9 ? 'bg-green-100 text-green-800' :
                      check.ratio < 1.0 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {(check.ratio * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      check.status === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {check.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reinforcement Details */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Reinforcement Details (BS 8666)</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Main Bars (X-Direction)</p>
                <p className="text-lg font-semibold text-gray-800">{results.reinforcement.mainBarsX}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Main Bars (Y-Direction)</p>
                <p className="text-lg font-semibold text-gray-800">{results.reinforcement.mainBarsY}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Area Provided</p>
                <p className="text-lg font-semibold text-gray-800">{results.reinforcement.area} mm²/m</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Area Required</p>
                <p className="text-lg font-semibold text-gray-800">{results.reinforcement.areaRequired} mm²/m</p>
              </div>
            </div>
          </div>
        </div>

        {/* BS References */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">Design Standards Referenced</h4>
          <ul className="space-y-2">
            {results.bsReferences.map((ref, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>{ref}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export PDF Report
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Drawings
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Foundation Design System</h1>
              <p className="text-gray-300 mt-1">Professional BS Standard Compliant Tool</p>
            </div>
            <Settings className="w-8 h-8 text-gray-300 hover:text-white cursor-pointer" />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <TabButton 
              active={activeTab === 'input'} 
              onClick={() => setActiveTab('input')}
              icon={<Calculator className="w-5 h-5" />}
            >
              Design Input
            </TabButton>
            <TabButton 
              active={activeTab === 'results'} 
              onClick={() => setActiveTab('results')}
              icon={<FileText className="w-5 h-5" />}
              disabled={!results}
            >
              Results & Checks
            </TabButton>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'input' && renderInputSection()}
        {activeTab === 'results' && renderResults()}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm">
          <p>© 2025 Foundation Design System | Compliant with BS EN 1992-1-1, BS 8004, BS EN 1997-1</p>
          <p className="mt-2 text-gray-400">For professional use by qualified structural engineers</p>
        </div>
      </footer>
    </div>
  );
};

const InputField = ({ label, name, value, onChange, unit, type = "number" }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <div className="relative">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        step="0.01"
        className="w-full p-2 pr-12 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {unit && (
        <span className="absolute right-3 top-2 text-sm text-gray-500">{unit}</span>
      )}
    </div>
  </div>
);

const TabButton = ({ active, onClick, children, icon, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${
      active 
        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {icon}
    {children}
  </button>
);

export default FoundationDesignApp;