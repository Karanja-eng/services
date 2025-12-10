import React, { useState } from 'react';
import { Calculator, AlertCircle, CheckCircle, Info } from 'lucide-react';

const EurocodeColumnDesign = ({ theme = 'light' }) => {
  const [results, setResults] = useState(null);
  const [columnData, setColumnData] = useState({
    height: 4.0,
    N_Ed: 1000,
    M_y_Ed: 50,
    M_z_Ed: 0,
    grade: 'S355',
    section: 'HEA 300',
    section_type: 'HEA',
    buckling_length_y: 1.0,
    buckling_length_z: 1.0,
    buckling_curve_y: 'b',
    buckling_curve_z: 'c'
  });

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const borderColor = isDark ? 'border-gray-600' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-white';
  const inputBorder = isDark ? 'border-gray-600' : 'border-blue-200';

  const calculateColumn = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/eurocode/columns/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(columnData)
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
          <h2 className={`text-2xl font-bold ${textColor}`}>Eurocode 3 - Column Design</h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>EN 1993-1-1:2005 Section 6.3</p>
        </div>
      </div>

      <div className={`${bgColor} rounded-lg shadow-lg p-6 border-2 ${borderColor}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Section Type
            </label>
            <select
              value={columnData.section_type}
              onChange={(e) => setColumnData({ ...columnData, section_type: e.target.value, section: e.target.value === 'HEA' ? 'HEA 300' : e.target.value === 'HEB' ? 'HEB 300' : 'HEM 300' })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
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
              value={columnData.section}
              onChange={(e) => setColumnData({ ...columnData, section: e.target.value })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              {columnData.section_type === 'HEA' && (
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
              {columnData.section_type === 'HEB' && (
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
              {columnData.section_type === 'HEM' && (
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
              value={columnData.grade}
              onChange={(e) => setColumnData({ ...columnData, grade: e.target.value })}
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
              Height (m)
            </label>
            <input
              type="number"
              value={columnData.height}
              onChange={(e) => setColumnData({ ...columnData, height: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
              step="0.1"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Axial Force N_Ed (kN)
            </label>
            <input
              type="number"
              value={columnData.N_Ed}
              onChange={(e) => setColumnData({ ...columnData, N_Ed: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500 ${inputBg} ${textColor}`}
              step="10"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Moment M_y,Ed (kNm)
            </label>
            <input
              type="number"
              value={columnData.M_y_Ed}
              onChange={(e) => setColumnData({ ...columnData, M_y_Ed: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500 ${inputBg} ${textColor}`}
              step="5"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Moment M_z,Ed (kNm)
            </label>
            <input
              type="number"
              value={columnData.M_z_Ed}
              onChange={(e) => setColumnData({ ...columnData, M_z_Ed: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500 ${inputBg} ${textColor}`}
              step="5"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Buckling Length Factor (y-axis)
            </label>
            <input
              type="number"
              value={columnData.buckling_length_y}
              onChange={(e) => setColumnData({ ...columnData, buckling_length_y: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
              step="0.1"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Buckling Length Factor (z-axis)
            </label>
            <input
              type="number"
              value={columnData.buckling_length_z}
              onChange={(e) => setColumnData({ ...columnData, buckling_length_z: parseFloat(e.target.value) })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
              step="0.1"
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Buckling Curve (y-axis)
            </label>
            <select
              value={columnData.buckling_curve_y}
              onChange={(e) => setColumnData({ ...columnData, buckling_curve_y: e.target.value })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              <option value="a0">Curve a0 (α=0.13)</option>
              <option value="a">Curve a (α=0.21)</option>
              <option value="b">Curve b (α=0.34)</option>
              <option value="c">Curve c (α=0.49)</option>
              <option value="d">Curve d (α=0.76)</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-semibold ${textColor} mb-2`}>
              Buckling Curve (z-axis)
            </label>
            <select
              value={columnData.buckling_curve_z}
              onChange={(e) => setColumnData({ ...columnData, buckling_curve_z: e.target.value })}
              className={`w-full px-4 py-2 border-2 ${inputBorder} rounded-lg focus:outline-none focus:border-blue-500 ${inputBg} ${textColor}`}
            >
              <option value="a0">Curve a0 (α=0.13)</option>
              <option value="a">Curve a (α=0.21)</option>
              <option value="b">Curve b (α=0.34)</option>
              <option value="c">Curve c (α=0.49)</option>
              <option value="d">Curve d (α=0.76)</option>
            </select>
          </div>
        </div>

        <div className={`mt-4 p-4 ${isDark ? 'bg-gray-700' : 'bg-blue-50'} rounded-lg border ${isDark ? 'border-gray-600' : 'border-blue-300'}`}>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-blue-800'}`}>
            <strong>Buckling Curves (EN 1993-1-1 Table 6.2):</strong><br/>
            For rolled I/H sections:<br/>
            • y-axis (major): typically curve b (tf ≤ 100mm)<br/>
            • z-axis (minor): typically curve c (tf ≤ 100mm)
          </p>
        </div>

        <button
          onClick={calculateColumn}
          className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
        >
          <Calculator size={20} />
          Calculate Column Design
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
                Section & Loading
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">Section:</span> {results.section}</p>
                <p className={textColor}><span className="font-semibold">Class:</span> {results.section_class}</p>
                <p className={textColor}><span className="font-semibold">N_Ed:</span> {results.N_Ed} kN</p>
                <p className={textColor}><span className="font-semibold">M_y,Ed:</span> {results.M_y_Ed} kNm</p>
                <p className={textColor}><span className="font-semibold">M_z,Ed:</span> {results.M_z_Ed} kNm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-green-700 border-b-2 ${isDark ? 'border-green-500' : 'border-green-200'} pb-2`}>
                Cross-Section Resistance
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">N_c,Rd:</span> {results.N_c_Rd} kN</p>
                <p className={textColor}><span className="font-semibold">M_c,y,Rd:</span> {results.M_c_y_Rd} kNm</p>
                <p className={textColor}><span className="font-semibold">M_c,z,Rd:</span> {results.M_c_z_Rd} kNm</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-blue-700 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-200'} pb-2`}>
                Buckling Resistance
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">N_b,Rd,y:</span> {results.N_b_Rd_y} kN</p>
                <p className={textColor}><span className="font-semibold">N_b,Rd,z:</span> {results.N_b_Rd_z} kN</p>
                <p className={textColor}><span className="font-semibold">λ_y:</span> {results.lambda_y}</p>
                <p className={textColor}><span className="font-semibold">λ_z:</span> {results.lambda_z}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`font-bold text-lg text-green-700 border-b-2 ${isDark ? 'border-green-500' : 'border-green-200'} pb-2`}>
                Reduction Factors
              </h4>
              <div className="space-y-2">
                <p className={textColor}><span className="font-semibold">χ_y:</span> {results.chi_y}</p>
                <p className={textColor}><span className="font-semibold">χ_z:</span> {results.chi_z}</p>
              </div>
            </div>

            <div className="col-span-2">
              <h4 className={`font-bold text-lg ${textColor} border-b-2 ${borderColor} pb-2 mb-3`}>
                Interaction Check (EN 1993-1-1 Eq 6.61 & 6.62)
              </h4>
              <div className="w-full bg-gray-200 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-white font-semibold ${
                    parseFloat(results.interaction_ratio) > 100 ? 'bg-red-600' : parseFloat(results.interaction_ratio) > 90 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(parseFloat(results.interaction_ratio), 100)}%` }}
                >
                  {results.interaction_ratio}%
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-6 p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg border ${borderColor}`}>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <strong>Reference:</strong> EN 1993-1-1:2005 Section 6.3 - Members subjected to compression and bending
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EurocodeColumnDesign;