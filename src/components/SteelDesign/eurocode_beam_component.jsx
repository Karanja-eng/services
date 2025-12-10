import React, { useState } from 'react';
import { Calculator, AlertCircle, CheckCircle, Info } from 'lucide-react';

const EurocodeBeamDesign = ({ theme = 'light' }) => {
  const [results, setResults] = useState(null);
  const [beamData, setBeamData] = useState({
    span: 6.0,
    udl: 50,
    point_load: 0,
    point_load_position: 0,
    grade: 'S355',
    section: 'IPE 300',
    section_type: 'IPE',
    lateral_restraint: 'full'
  });

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const borderColor = isDark ? 'border-gray-600' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-white';
  const inputBorder = isDark ? 'border-gray-600' : 'border-blue-200';

  const calculateBeam = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/eurocode/beams/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(beamData)
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Calculation failed. Ensure backend is running.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="text-blue-600" size={32} />
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>Eurocode 3 - Beam Design</h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>EN 1993-1-1:2005</p>
        </div>
      </div>

      <div className={`${bgColor} rounded-lg shadow-lg p-6 border-2 ${borderColor}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Section Type
            </label>
            <select
              value={beamData.section_type}
              onChange={(e) => setBeamData({ ...beamData, section_type: e.target.value, section: e.target.value === 'IPE' ? 'IPE 300' : e.target.value === 'HEA' ? 'HEA 300' : e.target.value === 'HEB' ? 'HEB 300' : 'HEM 300' })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              <option value="IPE">IPE (European I-Beam)</option>
              <option value="HEA">HEA (Wide Flange Light)</option>
              <option value="HEB">HEB (Wide Flange Medium)</option>
              <option value="HEM">HEM (Wide Flange Heavy)</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Section Designation
            </label>
            <select
              value={beamData.section}
              onChange={(e) => setBeamData({ ...beamData, section: e.target.value })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              {beamData.section_type === 'IPE' && (
                <>
                  <option>IPE 600</option>
                  <option>IPE 550</option>
                  <option>IPE 500</option>
                  <option>IPE 450</option>
                  <option>IPE 400</option>
                  <option>IPE 360</option>
                  <option>IPE 330</option>
                  <option>IPE 300</option>
                  <option>IPE 270</option>
                  <option>IPE 240</option>
                  <option>IPE 220</option>
                  <option>IPE 200</option>
                  <option>IPE 180</option>
                  <option>IPE 160</option>
                </>
              )}
              {beamData.section_type === 'HEA' && (
                <>
                  <option>HEA 600</option>
                  <option>HEA 550</option>
                  <option>HEA 500</option>
                  <option>HEA 450</option>
                  <option>HEA 400</option>
                  <option>HEA 360</option>
                  <option>HEA 340</option>
                  <option>HEA 320</option>
                  <option>HEA 300</option>
                  <option>HEA 280</option>
                  <option>HEA 260</option>
                  <option>HEA 240</option>
                  <option>HEA 220</option>
                  <option>HEA 200</option>
                </>
              )}
              {beamData.section_type === 'HEB' && (
                <>
                  <option>HEB 600</option>
                  <option>HEB 550</option>
                  <option>HEB 500</option>
                  <option>HEB 450</option>
                  <option>HEB 400</option>
                  <option>HEB 360</option>
                  <option>HEB 340</option>
                  <option>HEB 320</option>
                  <option>HEB 300</option>
                  <option>HEB 280</option>
                  <option>HEB 260</option>
                  <option>HEB 240</option>
                  <option>HEB 220</option>
                  <option>HEB 200</option>
                </>
              )}
              {beamData.section_type === 'HEM' && (
                <>
                  <option>HEM 600</option>
                  <option>HEM 550</option>
                  <option>HEM 500</option>
                  <option>HEM 450</option>
                  <option>HEM 400</option>
                  <option>HEM 360</option>
                  <option>HEM 340</option>
                  <option>HEM 320</option>
                  <option>HEM 300</option>
                  <option>HEM 280</option>
                  <option>HEM 260</option>
                  <option>HEM 240</option>
                  <option>HEM 220</option>
                  <option>HEM 200</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Steel Grade
            </label>
            <select
              value={beamData.grade}
              onChange={(e) => setBeamData({ ...beamData, grade: e.target.value })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              <option value="S235">S235 (fy=235 N/mm²)</option>
              <option value="S275">S275 (fy=275 N/mm²)</option>
              <option value="S355">S355 (fy=355 N/mm²)</option>
              <option value="S420">S420 (fy=420 N/mm²)</option>
              <option value="S460">S460 (fy=460 N/mm²)</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Span (m)
            </label>
            <input
              type="number"
              value={beamData.span}
              onChange={(e) => setBeamData({ ...beamData, span: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
              step="0.1"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              UDL (kN/m)
            </label>
            <input
              type="number"
              value={beamData.udl}
              onChange={(e) => setBeamData({ ...beamData, udl: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500 ${inputBg} ${textColor}`}
              step="1"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Point Load (kN)
            </label>
            <input
              type="number"
              value={beamData.point_load}
              onChange={(e) => setBeamData({ ...beamData, point_load: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500 ${inputBg} ${textColor}`}
              step="1"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Lateral Restraint
            </label>
            <select
              value={beamData.lateral_restraint}
              onChange={(e) => setBeamData({ ...beamData, lateral_restraint: e.target.value })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              <option value="full">Full Restraint</option>
              <option value="ends_only">Ends Only</option>
              <option value="none">No Restraint</option>
            </select>
          </div>
        </div>

        <button
          onClick={calculateBeam}
          className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
        >
          <Calculator size={20} />
          Calculate Beam Design
        </button>
      </div>

      {results && (
        <div className={`${bgColor} rounded-lg shadow-xl p-6 border-2 ${borderColor}`}>
          <div className="flex items-center gap-3 mb-6">
            <Info className="text-blue-600" size={28} />
            <h3 className={`text-2xl font-bold ${textColor}`}>Design Results - EN 1993-1-1</h3>
          </div>

          <div className={`p-4 rounded-lg mb-6 ${results.passed ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
            <div className="flex items-center gap-2">
              {results.passed ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <AlertCircle className="text-red-600" size={24} />
              )}
              <span className={`text-lg font-bold ${results.passed ? 'text-green-700' : 'text-red-700'}`}>
                {results.passed ? 'DESIGN ADEQUATE' : 'DESIGN INADEQUATE'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-blue-700 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-200'} pb-2`}>
                Section Properties
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">Section:</span> {results.section}</p>
                <p className={textColor}><span className="font-semibold">Section Class:</span> {results.section_class}</p>
                <p className={textColor}><span className="font-semibold">fy:</span> {results.fy} N/mm²</p>
                <p className={textColor}><span className="font-semibold">ε:</span> {results.epsilon}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-green-700 border-b-2 ${isDark ? 'border-green-500' : 'border-green-200'} pb-2`}>
                Applied Forces
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">M_Ed:</span> {results.M_Ed} kNm</p>
                <p className={textColor}><span className="font-semibold">V_Ed:</span> {results.V_Ed} kN</p>
                <p className={textColor}><span className="font-semibold">δ_max:</span> {results.delta_max} mm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-blue-700 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-200'} pb-2`}>
                Resistances
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">M_c,Rd:</span> {results.M_c_Rd} kNm</p>
                <p className={textColor}><span className="font-semibold">M_b,Rd:</span> {results.M_b_Rd} kNm</p>
                <p className={textColor}><span className="font-semibold">V_c,Rd:</span> {results.V_c_Rd} kN</p>
                <p className={textColor}><span className="font-semibold">δ_limit:</span> {results.delta_limit} mm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-green-700 border-b-2 ${isDark ? 'border-green-500' : 'border-green-200'} pb-2`}>
                Buckling Parameters
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">λ̄_LT:</span> {results.lambda_LT}</p>
                <p className={textColor}><span className="font-semibold">χ_LT:</span> {results.chi_LT}</p>
              </div>
            </div>

            <div className="col-span-2 space-y-3">
              <h4 className={`font-bold text-lg ${textColor} border-b-2 ${borderColor} pb-2`}>
                Utilization Ratios
              </h4>
              
              <div>
                <p className={`font-semibold mb-1 ${textColor}`}>Bending: {results.bending_utilization}%</p>
                <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-3`}>
                  <div 
                    className={`h-3 rounded-full ${parseFloat(results.bending_utilization) > 100 ? 'bg-red-600' : parseFloat(results.bending_utilization) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                    style={{ width: `${Math.min(parseFloat(results.bending_utilization), 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <p className={`font-semibold mb-1 ${textColor}`}>Shear: {results.shear_utilization}%</p>
                <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-3`}>
                  <div 
                    className={`h-3 rounded-full ${parseFloat(results.shear_utilization) > 100 ? 'bg-red-600' : parseFloat(results.shear_utilization) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                    style={{ width: `${Math.min(parseFloat(results.shear_utilization), 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <p className={`font-semibold mb-1 ${textColor}`}>Deflection: {results.deflection_utilization}%</p>
                <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-3`}>
                  <div 
                    className={`h-3 rounded-full ${parseFloat(results.deflection_utilization) > 100 ? 'bg-red-600' : parseFloat(results.deflection_utilization) > 90 ? 'bg-yellow-600' : 'bg-green-600'}`}
                    style={{ width: `${Math.min(parseFloat(results.deflection_utilization), 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-6 p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg border ${borderColor}`}>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <strong>Reference:</strong> EN 1993-1-1:2005 - Design of steel structures - General rules and rules for buildings
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EurocodeBeamDesign;