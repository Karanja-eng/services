import React, { useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Wrench, Award, CheckCircle, AlertTriangle, Shield, FileText, DollarSign } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const Eurocode2DesignCalculator = ({ analysisResults, isDarkMode = false }) => {
  const [designParams, setDesignParams] = useState({
    beam_type: 'Rectangular',
    support_condition: 'Continuous',
    imposed_load: 10.0,
    permanent_load: 5.0,
    fire_resistance: 60,
    design_working_life: 50,
    materials: {
      concrete_class: 'C30/37',
      steel_class: 'Class B',
      fyk: 500.0,
      exposure_class: 'XC1',
      concrete_density: 25.0
    },
    rectangular_geometry: {
      width: 300,
      depth: 500,
      cover: 30
    },
    t_beam_geometry: {
      web_width: 300,
      web_depth: 400,
      flange_width: 1000,
      flange_thickness: 150,
      cover: 30
    },
    l_beam_geometry: {
      web_width: 250,
      web_depth: 350,
      flange_width: 600,
      flange_thickness: 120,
      cover: 35
    }
  });

  const [designResults, setDesignResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const designBeam = async () => {
    if (!analysisResults) {
      setError('Please complete structural analysis first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the integrated EC2 design endpoint
      const response = await axios.post(`${API_BASE_URL}/integrated/eurocode2_design`, {
        analysis_results: analysisResults,
        design_parameters: designParams
      });
      setDesignResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Eurocode 2 design failed');
    } finally {
      setLoading(false);
    }
  };

  const updateDesignParam = (path, value) => {
    const keys = path.split('.');
    setDesignParams(prev => {
      const newParams = { ...prev };
      let current = newParams;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newParams;
    });
  };

  const themeClasses = {
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900',
    table: isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'
  };

  return (
    <div className={`space-y-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} p-6 rounded-lg`}>
      {/* Header */}
      <div className={`${themeClasses.card} p-6 rounded-lg shadow-lg border`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className={`text-2xl font-bold ${themeClasses.text}`}>Eurocode 2 (EN 1992-1-1)</h2>
              <p className={themeClasses.textSecondary}>European Standard for Reinforced Concrete Design</p>
            </div>
          </div>
          <div className="text-right">
            <span className="px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
              EC2 Compliant
            </span>
          </div>
        </div>
      </div>

      {/* Design Configuration */}
      <div className={`${themeClasses.card} p-6 rounded-lg shadow-lg border`}>
        <h3 className={`text-xl font-semibold ${themeClasses.text} mb-6`}>Design Configuration</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Parameters */}
          <div>
            <h4 className={`font-semibold ${themeClasses.text} mb-4`}>Basic Parameters</h4>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                  Member Type
                </label>
                <select
                  value={designParams.beam_type}
                  onChange={(e) => updateDesignParam('beam_type', e.target.value)}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                >
                  <option value="Rectangular">Rectangular</option>
                  <option value="T-Beam">T-Beam</option>
                  <option value="L-Beam">L-Beam</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                  Support Condition
                </label>
                <select
                  value={designParams.support_condition}
                  onChange={(e) => updateDesignParam('support_condition', e.target.value)}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                >
                  <option value="Simply Supported">Simply Supported</option>
                  <option value="Continuous">Continuous</option>
                  <option value="Cantilever">Cantilever</option>
                  <option value="Fixed">Fixed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                    Imposed Load (kN/m)
                  </label>
                  <input
                    type="number"
                    value={designParams.imposed_load}
                    onChange={(e) => updateDesignParam('imposed_load', parseFloat(e.target.value))}
                    className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                  >
                    <option value="60">R60</option>
                    <option value="90">R90</option>
                    <option value="120">R120</option>
                    <option value="180">R180</option>
                    <option value="240">R240</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                    Design Life (years)
                  </label>
                  <select
                    value={designParams.design_working_life}
                    onChange={(e) => updateDesignParam('design_working_life', parseInt(e.target.value))}
                    className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                  >
                    <option value="10">10 (Temporary)</option>
                    <option value="50">50 (Buildings)</option>
                    <option value="100">100 (Bridges)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Material Properties - EC2 Specific */}
          <div>
            <h4 className={`font-semibold ${themeClasses.text} mb-4`}>Material Properties (EC2)</h4>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                  Concrete Class (fck/fcu)
                </label>
                <select
                  value={designParams.materials.concrete_class}
                  onChange={(e) => updateDesignParam('materials.concrete_class', e.target.value)}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                >
                  <option value="C12/15">C12/15</option>
                  <option value="C16/20">C16/20</option>
                  <option value="C20/25">C20/25</option>
                  <option value="C25/30">C25/30</option>
                  <option value="C30/37">C30/37</option>
                  <option value="C35/45">C35/45</option>
                  <option value="C40/50">C40/50</option>
                  <option value="C45/55">C45/55</option>
                  <option value="C50/60">C50/60</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                    Steel Class
                  </label>
                  <select
                    value={designParams.materials.steel_class}
                    onChange={(e) => updateDesignParam('materials.steel_class', e.target.value)}
                    className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                  >
                    <option value="Class A">Class A</option>
                    <option value="Class B">Class B</option>
                    <option value="Class C">Class C</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                    fyk (MPa)
                  </label>
                  <select
                    value={designParams.materials.fyk}
                    onChange={(e) => updateDesignParam('materials.fyk', parseFloat(e.target.value))}
                    className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                  >
                    <option value="400">400</option>
                    <option value="500">500</option>
                    <option value="600">600</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                  Exposure Class (EN 206)
                </label>
                <select
                  value={designParams.materials.exposure_class}
                  onChange={(e) => updateDesignParam('materials.exposure_class', e.target.value)}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                >
                  <optgroup label="Carbonation">
                    <option value="XC1">XC1 - Dry/Permanently wet</option>
                    <option value="XC2">XC2 - Wet, rarely dry</option>
                    <option value="XC3">XC3 - Moderate humidity</option>
                    <option value="XC4">XC4 - Cyclic wet/dry</option>
                  </optgroup>
                  <optgroup label="Chlorides">
                    <option value="XD1">XD1 - Moderate humidity</option>
                    <option value="XD2">XD2 - Wet, rarely dry</option>
                    <option value="XD3">XD3 - Cyclic wet/dry</option>
                  </optgroup>
                  <optgroup label="Seawater">
                    <option value="XS1">XS1 - Airborne salt</option>
                    <option value="XS2">XS2 - Permanently submerged</option>
                    <option value="XS3">XS3 - Tidal/splash zones</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Geometry Configuration */}
        <div className="mt-6">
          <h4 className={`font-semibold ${themeClasses.text} mb-4`}>Cross-Section Geometry</h4>
          
          {designParams.beam_type === 'Rectangular' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>Width (mm)</label>
                <input
                  type="number"
                  value={designParams.rectangular_geometry.width}
                  onChange={(e) => updateDesignParam('rectangular_geometry.width', parseFloat(e.target.value))}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>Depth (mm)</label>
                <input
                  type="number"
                  value={designParams.rectangular_geometry.depth}
                  onChange={(e) => updateDesignParam('rectangular_geometry.depth', parseFloat(e.target.value))}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>Cover (mm)</label>
                <input
                  type="number"
                  value={designParams.rectangular_geometry.cover}
                  onChange={(e) => updateDesignParam('rectangular_geometry.cover', parseFloat(e.target.value))}
                  className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Design Button */}
      <div className="flex justify-center">
        <button
          onClick={designBeam}
          disabled={loading || !analysisResults}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-lg font-semibold shadow-lg"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
          ) : (
            <Wrench className="h-5 w-5 mr-3" />
          )}
          {loading ? 'Designing...' : 'Design to Eurocode 2'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`p-4 ${isDarkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'} border rounded-lg flex items-center`}>
          <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
          <span className={isDarkMode ? 'text-red-200' : 'text-red-700'}>{error}</span>
        </div>
      )}

      {/* Design Results */}
      {designResults && designResults.member_designs && (
        <div className="space-y-6">
          {/* Summary */}
          <div className={`${themeClasses.card} p-6 rounded-lg shadow-lg border`}>
            <h3 className={`text-xl font-semibold ${themeClasses.text} mb-4 flex items-center`}>
              <Award className="h-6 w-6 mr-2 text-green-600" />
              Eurocode 2 Design Results Summary
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'} p-4 rounded-lg`}>
                <div className={`text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-600'}`}>Members Designed</div>
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-blue-100' : 'text-blue-700'}`}>
                  {designResults.summary.total_members}
                </div>
              </div>
              <div className={`${isDarkMode ? 'bg-green-900' : 'bg-green-50'} p-4 rounded-lg`}>
                <div className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-600'}`}>Design Code</div>
                <div className={`text-lg font-semibold ${isDarkMode ? 'text-green-100' : 'text-green-700'}`}>
                  EN 1992-1-1:2004
                </div>
              </div>
              <div className={`p-4 rounded-lg ${designResults.summary.all_designs_ok ? 
                (isDarkMode ? 'bg-green-900' : 'bg-green-50') : 
                (isDarkMode ? 'bg-red-900' : 'bg-red-50')}`}>
                <div className={`text-sm ${designResults.summary.all_designs_ok ?
                  (isDarkMode ? 'text-green-200' : 'text-green-600') :
                  (isDarkMode ? 'text-red-200' : 'text-red-600')}`}>
                  Design Status
                </div>
                <div className={`text-lg font-semibold ${designResults.summary.all_designs_ok ?
                  (isDarkMode ? 'text-green-100' : 'text-green-700') :
                  (isDarkMode ? 'text-red-100' : 'text-red-700')}`}>
                  {designResults.summary.all_designs_ok ? '✓ All Compliant' : '✗ Issues Found'}
                </div>
              </div>
            </div>
          </div>

          {/* Individual Member Results */}
          {designResults.member_designs.map((memberDesign, index) => (
            <div key={index} className={`${themeClasses.card} p-6 rounded-lg shadow-lg border`}>
              <h4 className={`text-lg font-semibold ${themeClasses.text} mb-4`}>
                Member {memberDesign.member_id || index + 1} - EC2 Design Details
              </h4>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Reinforcement */}
                <div>
                  <h5 className={`font-semibold ${themeClasses.text} mb-3`}>Reinforcement (EC2 Tables)</h5>
                  <div className="space-y-3">
                    <div className={`${themeClasses.table} p-3 rounded`}>
                      <div className={`text-sm ${themeClasses.textSecondary}`}>Main Reinforcement</div>
                      <div className={`font-medium ${themeClasses.text}`}>
                        {Object.entries(memberDesign.reinforcement.main_bars_count || {}).map(([dia, count]) => (
                          <span key={dia}>{count}H{dia} </span>
                        ))}
                      </div>
                      <div className={`text-sm ${themeClasses.textSecondary}`}>
                        As = {memberDesign.reinforcement.main_bars_area.toFixed(0)} mm²
                      </div>
                      <div className={`text-sm ${themeClasses.textSecondary}`}>
                        {memberDesign.reinforcement.bar_arrangement}
                      </div>
                    </div>
                    
                    <div className={`${themeClasses.table} p-3 rounded`}>
                      <div className={`text-sm ${themeClasses.textSecondary}`}>Shear Links (EC2 Section 9.2.2)</div>
                      <div className={`font-medium ${themeClasses.text}`}>
                        {memberDesign.reinforcement.link_legs}-leg H{memberDesign.reinforcement.shear_links} @ {memberDesign.reinforcement.link_spacing}mm c/c
                      </div>
                    </div>
                    
                    <div className={`${themeClasses.table} p-3 rounded`}>
                      <div className={`text-sm ${themeClasses.textSecondary}`}>Steel Ratio</div>
                      <div className={`font-medium ${themeClasses.text}`}>
                        ρ = {memberDesign.reinforcement.steel_ratio.toFixed(3)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* EC2 Design Checks */}
                <div>
                  <h5 className={`font-semibold ${themeClasses.text} mb-3`}>EC2 Design Checks</h5>
                  <div className="space-y-2">
                    {[
                      { name: 'ULS - Moment', ok: memberDesign.design_checks.moment_capacity_ok, util: memberDesign.design_checks.moment_utilization },
                      { name: 'ULS - Shear', ok: memberDesign.design_checks.shear_capacity_ok, util: memberDesign.design_checks.shear_utilization },
                      { name: 'SLS - Deflection', ok: memberDesign.design_checks.deflection_ok, util: 0 },
                      { name: 'SLS - Crack Width', ok: memberDesign.design_checks.crack_width_ok, util: 0 },
                      { name: 'Min Steel (9.2.1)', ok: memberDesign.design_checks.minimum_steel_ok, util: 0 },
                      { name: 'Max Steel (9.2.1)', ok: memberDesign.design_checks.maximum_steel_ok, util: 0 },
                      { name: 'Bar Spacing (8.2)', ok: memberDesign.design_checks.bar_spacing_ok, util: 0 },
                      { name: 'Detailing (Section 8)', ok: memberDesign.design_checks.detailing_ok, util: 0 }
                    ].map((check, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className={`text-sm ${themeClasses.textSecondary}`}>{check.name}</span>
                        <span className={`text-sm font-medium ${check.ok ? 'text-green-600' : 'text-red-600'}`}>
                          {check.ok ? '✓ OK' : '✗ FAIL'}
                          {check.util > 0 && ` (${(check.util * 100).toFixed(1)}%)`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Durability Info */}
                  {memberDesign.durability_requirements && (
                    <div className={`mt-4 p-3 ${isDarkMode ? 'bg-purple-900' : 'bg-purple-50'} rounded`}>
                      <div className={`text-sm font-semibold ${isDarkMode ? 'text-purple-200' : 'text-purple-800'} mb-1`}>
                        Durability (Section 4)
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                        <div>Exposure: {memberDesign.durability_requirements.exposure_class}</div>
                        <div>Required cover: {memberDesign.durability_requirements.required_cover}mm</div>
                        <div>Provided: {memberDesign.durability_requirements.provided_cover}mm</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Utilization Chart */}
              <div className="mt-6">
                <h5 className={`font-semibold ${themeClasses.text} mb-3`}>Capacity Utilization</h5>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { name: 'Moment', utilization: memberDesign.design_checks.moment_utilization * 100, limit: 100 },
                    { name: 'Shear', utilization: memberDesign.design_checks.shear_utilization * 100, limit: 100 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Utilization (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <ReferenceLine y={100} stroke="red" strokeDasharray="2 2" label="Limit" />
                    <ReferenceLine y={95} stroke="orange" strokeDasharray="2 2" label="95%" />
                    <Bar dataKey="utilization" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cost Estimate */}
              {memberDesign.cost_estimate && (
                <div className="mt-6">
                  <h5 className={`font-semibold ${themeClasses.text} mb-3 flex items-center`}>
                    <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                    Cost Estimate (per meter)
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className={`${themeClasses.table} p-3 rounded`}>
                      <div className={themeClasses.textSecondary}>Concrete</div>
                      <div className={`font-medium ${themeClasses.text}`}>{memberDesign.cost_estimate.concrete_volume_per_meter.toFixed(3)} m³</div>
                    </div>
                    <div className={`${themeClasses.table} p-3 rounded`}>
                      <div className={themeClasses.textSecondary}>Steel</div>
                      <div className={`font-medium ${themeClasses.text}`}>{memberDesign.cost_estimate.steel_weight_per_meter.toFixed(1)} kg</div>
                    </div>
                    <div className={`${themeClasses.table} p-3 rounded`}>
                      <div className={themeClasses.textSecondary}>Material Cost</div>
                      <div className={`font-medium ${themeClasses.text}`}>€{memberDesign.cost_estimate.total_cost_per_meter.toFixed(2)}</div>
                    </div>
                    <div className={`${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'} p-3 rounded`}>
                      <div className={`${isDarkMode ? 'text-blue-200' : 'text-blue-600'}`}>Total Cost</div>
                      <div className={`text-lg font-semibold ${isDarkMode ? 'text-blue-100' : 'text-blue-700'}`}>
                        €{(memberDesign.cost_estimate.total_cost_per_meter * (memberDesign.span_length || 6)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Calculations Summary */}
          <div className={`${themeClasses.card} p-6 rounded-lg shadow-lg border`}>
            <h4 className={`text-lg font-semibold ${themeClasses.text} mb-4 flex items-center`}>
              <FileText className="h-5 w-5 mr-2 text-gray-600" />
              EC2 Calculations Summary
            </h4>
            
            <div className="space-y-4">
              {designResults.member_designs.map((memberDesign, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h5 className={`font-semibold ${themeClasses.text} mb-2`}>
                    Member {memberDesign.member_id || index + 1}
                  </h5>
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} p-3 rounded font-mono text-xs overflow-x-auto`}>
                    {memberDesign.calculations_summary.map((line, lineIdx) => (
                      <div key={lineIdx} className={`whitespace-pre-wrap ${themeClasses.textSecondary}`}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Eurocode2DesignCalculator; ${themeClasses.input} rounded-md px-3 py-2 border`}
                    step="0.1"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                    Permanent Load (kN/m)
                  </label>
                  <input
                    type="number"
                    value={designParams.permanent_load}
                    onChange={(e) => updateDesignParam('permanent_load', parseFloat(e.target.value))}
                    className={`w-full ${themeClasses.input} rounded-md px-3 py-2 border`}
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                    Fire Resistance (min)
                  </label>
                  <select
                    value={designParams.fire_resistance}
                    onChange={(e) => updateDesignParam('fire_resistance', parseInt(e.target.value))}
                    className={`w-full