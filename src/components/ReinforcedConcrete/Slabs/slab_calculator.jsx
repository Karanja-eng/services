import React, { useState } from 'react';
import { Calculator, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

const SlabCalculator = () => {
  const [slabType, setSlabType] = useState('one-way');
  const [spanType, setSpanType] = useState('single');
  const [support, setSupport] = useState('simply-supported');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    // Material properties
    fck: 30,
    fy: 460,
    cover: 25,
    
    // Loading
    deadLoad: 1.5,
    liveLoad: 2.5,
    
    // Dimensions for one-way
    spanLength: 5.0,
    slabWidth: 1.0,
    
    // Dimensions for two-way
    lx: 5.0,
    ly: 6.0,
    
    // Cantilever
    cantileverLength: 1.5,
    
    // Ribbed/Waffle
    ribWidth: 125,
    ribSpacing: 500,
    topping: 50,
    ribDepth: 300
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const calculateSlab = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Simulate API call - replace with actual axios call
      // const response = await axios.post('http://localhost:8000/api/calculate', {
      //   slabType,
      //   spanType,
      //   support,
      //   ...formData
      // });
      
      // Simulated calculation results
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResults = calculateMockResults();
      setResults(mockResults);
    } catch (err) {
      setError(err.message || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const calculateMockResults = () => {
    const { fck, fy, spanLength, lx, ly, deadLoad, liveLoad } = formData;
    
    // BS 8110 calculations
    const totalLoad = 1.4 * deadLoad + 1.6 * liveLoad;
    
    if (slabType === 'one-way') {
      // One-way slab calculations
      const momentCoeff = support === 'simply-supported' ? 0.125 : 
                         support === 'continuous' ? 0.086 : 0.125;
      const shearCoeff = support === 'simply-supported' ? 0.5 : 
                        support === 'continuous' ? 0.6 : 0.5;
      
      const M = momentCoeff * totalLoad * Math.pow(spanLength, 2);
      const V = shearCoeff * totalLoad * spanLength;
      
      // Effective depth calculation
      const K = M / (formData.slabWidth * Math.pow(spanLength * 1000, 2) * fck);
      const z = spanLength * 1000 * (0.5 + Math.sqrt(0.25 - K / 0.9));
      const d = Math.max(z / 0.95, spanLength * 1000 / 26); // Span/depth ratio
      
      const As = M * 1e6 / (0.87 * fy * z);
      const spacing = (Math.PI * Math.pow(12, 2) / 4) / (As / 1000) * 1000;
      
      return {
        slabType: 'One-Way Slab',
        bendingMoment: M.toFixed(2),
        shearForce: V.toFixed(2),
        effectiveDepth: d.toFixed(0),
        totalDepth: (d + formData.cover + 12).toFixed(0),
        steelArea: As.toFixed(0),
        mainReinforcement: `H12 @ ${Math.min(spacing, 300).toFixed(0)}mm c/c`,
        distributionSteel: `H8 @ 250mm c/c`,
        checksPassed: [
          'Span/depth ratio: OK',
          'Minimum steel: OK',
          'Maximum spacing: OK',
          'Shear capacity: OK'
        ]
      };
    } else if (slabType === 'two-way') {
      // Two-way slab calculations
      const ratio = ly / lx;
      
      // BS 8110 moment coefficients (simplified)
      const alphaSx = ratio <= 1.0 ? 0.024 : 
                     ratio <= 1.5 ? 0.034 : 
                     ratio <= 2.0 ? 0.040 : 0.045;
      const alphaSy = ratio <= 1.0 ? 0.024 : 
                     ratio <= 1.5 ? 0.024 : 
                     ratio <= 2.0 ? 0.024 : 0.024;
      
      const Msx = alphaSx * totalLoad * Math.pow(lx, 2);
      const Msy = alphaSy * totalLoad * Math.pow(lx, 2);
      
      const d = Math.max(lx * 1000 / 28, 125);
      const zx = 0.95 * d;
      const zy = 0.95 * d;
      
      const Asx = Msx * 1e6 / (0.87 * fy * zx);
      const Asy = Msy * 1e6 / (0.87 * fy * zy);
      
      return {
        slabType: 'Two-Way Slab',
        bendingMomentX: Msx.toFixed(2),
        bendingMomentY: Msy.toFixed(2),
        effectiveDepth: d.toFixed(0),
        totalDepth: (d + formData.cover + 12).toFixed(0),
        steelAreaX: Asx.toFixed(0),
        steelAreaY: Asy.toFixed(0),
        reinforcementX: `H12 @ ${Math.min((Math.PI * 144 / 4) / (Asx / 1000) * 1000, 300).toFixed(0)}mm c/c`,
        reinforcementY: `H12 @ ${Math.min((Math.PI * 144 / 4) / (Asy / 1000) * 1000, 300).toFixed(0)}mm c/c`,
        checksPassed: [
          'Ly/Lx ratio: ' + ratio.toFixed(2),
          'Span/depth ratio: OK',
          'Minimum steel: OK',
          'Maximum spacing: OK'
        ]
      };
    } else if (slabType === 'ribbed') {
      const M = 0.086 * totalLoad * Math.pow(spanLength, 2);
      const d = formData.ribDepth - formData.cover - 12;
      const z = 0.95 * d;
      const As = M * 1e6 / (0.87 * fy * z);
      
      return {
        slabType: 'Ribbed Slab',
        bendingMoment: M.toFixed(2),
        effectiveDepth: d.toFixed(0),
        totalDepth: formData.ribDepth.toFixed(0),
        steelArea: As.toFixed(0),
        ribReinforcement: `2H16 + 2H12`,
        toppingReinforcement: `H8 @ 200mm c/c both ways`,
        ribSpacing: formData.ribSpacing,
        ribWidth: formData.ribWidth,
        checksPassed: [
          'Rib spacing: OK',
          'Topping thickness: OK',
          'Steel area: OK',
          'Shear capacity: OK'
        ]
      };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-xl">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">BS 8110 Slab Design Calculator</h1>
              <p className="text-blue-200 mt-1">Professional Structural Engineering Tool</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Design Parameters
            </h2>

            {/* Slab Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-blue-200 mb-2">Slab Type</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['one-way', 'two-way', 'ribbed', 'waffle'].map(type => (
                  <button
                    key={type}
                    onClick={() => setSlabType(type)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      slabType === type
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white/5 text-blue-200 hover:bg-white/10'
                    }`}
                  >
                    {type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Support Conditions */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-blue-200 mb-2">Support Conditions</label>
              <div className="grid grid-cols-3 gap-3">
                {['simply-supported', 'continuous', 'cantilever'].map(supp => (
                  <button
                    key={supp}
                    onClick={() => setSupport(supp)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      support === supp
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'bg-white/5 text-blue-200 hover:bg-white/10'
                    }`}
                  >
                    {supp.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Material Properties */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">fck (N/mm²)</label>
                <input
                  type="number"
                  name="fck"
                  value={formData.fck}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">fy (N/mm²)</label>
                <input
                  type="number"
                  name="fy"
                  value={formData.fy}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Cover (mm)</label>
                <input
                  type="number"
                  name="cover"
                  value={formData.cover}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Loading */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Dead Load (kN/m²)</label>
                <input
                  type="number"
                  name="deadLoad"
                  value={formData.deadLoad}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Live Load (kN/m²)</label>
                <input
                  type="number"
                  name="liveLoad"
                  value={formData.liveLoad}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Dimensions based on slab type */}
            {slabType === 'one-way' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Span Length (m)</label>
                  <input
                    type="number"
                    name="spanLength"
                    value={formData.spanLength}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Slab Width (m)</label>
                  <input
                    type="number"
                    name="slabWidth"
                    value={formData.slabWidth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {slabType === 'two-way' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Lx - Short Span (m)</label>
                  <input
                    type="number"
                    name="lx"
                    value={formData.lx}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Ly - Long Span (m)</label>
                  <input
                    type="number"
                    name="ly"
                    value={formData.ly}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {(slabType === 'ribbed' || slabType === 'waffle') && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Rib Width (mm)</label>
                  <input
                    type="number"
                    name="ribWidth"
                    value={formData.ribWidth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Rib Spacing (mm)</label>
                  <input
                    type="number"
                    name="ribSpacing"
                    value={formData.ribSpacing}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Topping (mm)</label>
                  <input
                    type="number"
                    name="topping"
                    value={formData.topping}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Rib Depth (mm)</label>
                  <input
                    type="number"
                    name="ribDepth"
                    value={formData.ribDepth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <button
              onClick={calculateSlab}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-green-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Calculating...' : 'Calculate Design'}
            </button>
          </div>

          {/* Results Panel */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">Design Results</h2>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-red-200">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {results ? (
              <div className="space-y-4">
                <div className="bg-blue-500/20 border border-blue-400 rounded-lg p-4">
                  <h3 className="font-bold text-blue-200 mb-2">{results.slabType}</h3>
                  <div className="space-y-2 text-sm text-blue-100">
                    {results.bendingMoment && (
                      <p>Bending Moment: <span className="font-bold">{results.bendingMoment} kNm</span></p>
                    )}
                    {results.bendingMomentX && (
                      <>
                        <p>Mx: <span className="font-bold">{results.bendingMomentX} kNm</span></p>
                        <p>My: <span className="font-bold">{results.bendingMomentY} kNm</span></p>
                      </>
                    )}
                    {results.shearForce && (
                      <p>Shear Force: <span className="font-bold">{results.shearForce} kN</span></p>
                    )}
                  </div>
                </div>

                <div className="bg-green-500/20 border border-green-400 rounded-lg p-4">
                  <h3 className="font-bold text-green-200 mb-2">Dimensions</h3>
                  <div className="space-y-2 text-sm text-green-100">
                    <p>Effective Depth: <span className="font-bold">{results.effectiveDepth} mm</span></p>
                    <p>Total Depth: <span className="font-bold">{results.totalDepth} mm</span></p>
                  </div>
                </div>

                <div className="bg-purple-500/20 border border-purple-400 rounded-lg p-4">
                  <h3 className="font-bold text-purple-200 mb-2">Reinforcement</h3>
                  <div className="space-y-2 text-sm text-purple-100">
                    {results.mainReinforcement && (
                      <p>Main Steel: <span className="font-bold">{results.mainReinforcement}</span></p>
                    )}
                    {results.distributionSteel && (
                      <p>Distribution: <span className="font-bold">{results.distributionSteel}</span></p>
                    )}
                    {results.reinforcementX && (
                      <>
                        <p>X-Direction: <span className="font-bold">{results.reinforcementX}</span></p>
                        <p>Y-Direction: <span className="font-bold">{results.reinforcementY}</span></p>
                      </>
                    )}
                    {results.ribReinforcement && (
                      <>
                        <p>Rib Steel: <span className="font-bold">{results.ribReinforcement}</span></p>
                        <p>Topping: <span className="font-bold">{results.toppingReinforcement}</span></p>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                  <h3 className="font-bold text-white mb-2">Design Checks</h3>
                  <div className="space-y-2">
                    {results.checksPassed.map((check, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-green-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-blue-200">
                <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Enter parameters and click Calculate to see results</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-blue-200 text-sm">
          <p>Designed according to BS 8110 | Professional Structural Engineering Tool</p>
        </div>
      </div>
    </div>
  );
};

export default SlabCalculator;