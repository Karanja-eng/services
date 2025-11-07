import React, { useState, useEffect } from 'react';
import { Calculator, Building2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';

const API_BASE_URL = "http://localhost:8001/BS_walls";

const WallDesignCalculator = () => {
  const [wallType, setWallType] = useState('shear');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');

  const [inputs, setInputs] = useState({
    height: 3.5,
    length: 4.0,
    thickness: 200,
    axialLoad: 1500,
    shearForce: 250,
    moment: 350,
    concreteGrade: 30,
    steelGrade: 500,
    coverDepth: 40,
    exposureClass: 'XC1'
  });

  const handleInputChange = (e) => {
    setInputs({
      ...inputs,
      [e.target.name]: parseFloat(e.target.value) || e.target.value
    });
  };

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        setApiStatus(response.ok ? 'connected' : 'error');
      } catch (err) {
        setApiStatus('error');
      }
    };
    
    checkApiHealth();
  }, []);

  const calculateDesign = async () => {
    if (apiStatus !== 'connected') {
      setError('API is not connected');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallType,
          ...inputs
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Calculation failed');
      }

      const data = await response.json();
      
      setResult(data);
        wallType,
        designStatus: 'PASS',
        reinforcement: {
          vertical: {
            diameter: 16,
            spacing: 200,
            area: 1005,
            ratio: 0.0063
          },
          horizontal: {
            diameter: 12,
            spacing: 250,
            area: 452,
            ratio: 0.0028
          }
        },
        capacities: {
          axialCapacity: 2450,
          shearCapacity: 380,
          momentCapacity: 485,
          utilization: {
            axial: 0.61,
            shear: 0.66,
            moment: 0.72
          }
        },
        checks: [
          { name: 'Minimum Reinforcement', status: 'PASS', value: '0.63%', limit: '0.40%' },
          { name: 'Maximum Reinforcement', status: 'PASS', value: '0.91%', limit: '4.00%' },
          { name: 'Slenderness Ratio', status: 'PASS', value: '17.5', limit: '30.0' },
          { name: 'Shear Stress', status: 'PASS', value: '0.42 MPa', limit: '0.63 MPa' },
          { name: 'Crack Control', status: 'PASS', value: '0.28 mm', limit: '0.30 mm' }
        ],
        bsCodeReferences: [
          'BS EN 1992-1-1:2004 (Eurocode 2)',
          'BS 8110-1:1997 (Structural Use of Concrete)',
          'BS 8500-1:2015 (Concrete Specification)'
        ]
      };

      setResult(mockResult);
    } catch (err) {
      setError(err.message || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              RC Wall Design Calculator
            </h1>
          </div>
          <p className="text-gray-600">
            Professional structural design tool for reinforced concrete walls per BS codes
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Wall Type Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Wall Type</h2>
              <div className="space-y-2">
                {[
                  { value: 'shear', label: 'Shear Wall' },
                  { value: 'core', label: 'Elevator Core Wall' },
                  { value: 'retaining', label: 'Retaining Wall' },
                  { value: 'bearing', label: 'Bearing Wall' }
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setWallType(type.value)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                      wallType === type.value
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Geometry Inputs */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Geometry</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (m)
                  </label>
                  <input
                    type="number"
                    name="height"
                    value={inputs.height}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length (m)
                  </label>
                  <input
                    type="number"
                    name="length"
                    value={inputs.length}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thickness (mm)
                  </label>
                  <input
                    type="number"
                    name="thickness"
                    value={inputs.thickness}
                    onChange={handleInputChange}
                    step="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Loading Inputs */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Design Loads</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Axial Load (kN)
                  </label>
                  <input
                    type="number"
                    name="axialLoad"
                    value={inputs.axialLoad}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shear Force (kN)
                  </label>
                  <input
                    type="number"
                    name="shearForce"
                    value={inputs.shearForce}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moment (kNm)
                  </label>
                  <input
                    type="number"
                    name="moment"
                    value={inputs.moment}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Material Properties */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Materials</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concrete Grade (MPa)
                  </label>
                  <select
                    name="concreteGrade"
                    value={inputs.concreteGrade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="25">C25/30</option>
                    <option value="30">C30/37</option>
                    <option value="35">C35/45</option>
                    <option value="40">C40/50</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Steel Grade (MPa)
                  </label>
                  <select
                    name="steelGrade"
                    value={inputs.steelGrade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="500">Grade 500</option>
                    <option value="460">Grade 460</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cover Depth (mm)
                  </label>
                  <input
                    type="number"
                    name="coverDepth"
                    value={inputs.coverDepth}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exposure Class
                  </label>
                  <select
                    name="exposureClass"
                    value={inputs.exposureClass}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="XC1">XC1 - Dry</option>
                    <option value="XC3">XC3 - Moderate Humidity</option>
                    <option value="XC4">XC4 - Cyclic Wet/Dry</option>
                    <option value="XD1">XD1 - Moderate Chloride</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={calculateDesign}
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-6 py-4 rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              {loading ? 'Calculating...' : 'Calculate Design'}
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <>
                {/* Status Banner */}
                <div className={`rounded-lg p-6 ${
                  result.designStatus === 'PASS' 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500' 
                    : 'bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500'
                }`}>
                  <div className="flex items-center gap-3">
                    {result.designStatus === 'PASS' ? (
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    )}
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">
                        Design {result.designStatus}
                      </h3>
                      <p className="text-gray-600">
                        {result.wallType.charAt(0).toUpperCase() + result.wallType.slice(1)} Wall Analysis Complete
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reinforcement Details */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Reinforcement Design
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Vertical Reinforcement</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bar Diameter:</span>
                          <span className="font-medium">T{result.reinforcement.vertical.diameter}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Spacing:</span>
                          <span className="font-medium">{result.reinforcement.vertical.spacing} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Area:</span>
                          <span className="font-medium">{result.reinforcement.vertical.area} mm²/m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ratio:</span>
                          <span className="font-medium">{(result.reinforcement.vertical.ratio * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Horizontal Reinforcement</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bar Diameter:</span>
                          <span className="font-medium">T{result.reinforcement.horizontal.diameter}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Spacing:</span>
                          <span className="font-medium">{result.reinforcement.horizontal.spacing} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Area:</span>
                          <span className="font-medium">{result.reinforcement.horizontal.area} mm²/m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ratio:</span>
                          <span className="font-medium">{(result.reinforcement.horizontal.ratio * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capacity Check */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Capacity Analysis
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Axial', capacity: result.capacities.axialCapacity, utilization: result.capacities.utilization.axial, unit: 'kN' },
                      { label: 'Shear', capacity: result.capacities.shearCapacity, utilization: result.capacities.utilization.shear, unit: 'kN' },
                      { label: 'Moment', capacity: result.capacities.momentCapacity, utilization: result.capacities.utilization.moment, unit: 'kNm' }
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{item.label} Capacity</span>
                          <span className="text-gray-600">{item.capacity} {item.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.utilization > 0.9 ? 'bg-red-500' :
                                item.utilization > 0.7 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${item.utilization * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-16 text-right">
                            {(item.utilization * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code Checks */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    BS Code Compliance Checks
                  </h3>
                  <div className="space-y-3">
                    {result.checks.map((check, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {check.status === 'PASS' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          <span className="font-medium text-gray-700">{check.name}</span>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-gray-600">
                            Value: <span className="font-medium text-gray-800">{check.value}</span>
                          </div>
                          <div className="text-gray-500">
                            Limit: {check.limit}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code References */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6 border-l-4 border-blue-500">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2">
                        Design Standards Applied
                      </h3>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {result.bsCodeReferences.map((ref, idx) => (
                          <li key={idx}>• {ref}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!result && !error && !loading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  Ready to Calculate
                </h3>
                <p className="text-gray-500">
                  Enter your wall parameters and click Calculate Design to begin analysis
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WallDesignCalculator;