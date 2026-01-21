import React, { useState } from 'react';
import { Calculator, Map, Grid3x3, Layers, TrendingUp, Wrench, Plus, Trash2, Download, Upload } from 'lucide-react';

// Main App Component
export default function SurveyingApp({ isDark = false }) {
  const [activeTab, setActiveTab] = useState('levelling');

  const tabs = [
    { id: 'levelling', label: 'Levelling', icon: TrendingUp },
    { id: 'traverse', label: 'Traverse', icon: Map },
    { id: 'tacheometric', label: 'Tacheometry', icon: Calculator },
    { id: 'sewer', label: 'Sewer Design', icon: Wrench },
    { id: 'control', label: 'Control Survey', icon: Map },
    { id: 'corrections', label: 'Corrections', icon: Calculator }
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <header className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white shadow-lg">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Grid3x3 className="w-8 h-8 text-teal-400" />
              Civil Engineering Surveying Calculator
            </h1>
            <p className="text-slate-300 dark:text-slate-400 mt-2">Professional Field Surveying Tools</p>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="bg-white dark:bg-slate-800 shadow-md border-b-2 border-slate-200 dark:border-slate-700">
          <div className="container mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-4 ${activeTab === id
                    ? 'border-teal-500 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {activeTab === 'levelling' && <LevellingModule isDark={isDark} />}
          {activeTab === 'traverse' && <TraverseModule isDark={isDark} />}
          {activeTab === 'tacheometric' && <TacheometricModule isDark={isDark} />}
          {activeTab === 'sewer' && <SewerDesignModule isDark={isDark} />}
          {activeTab === 'control' && <ControlSurveyModule isDark={isDark} />}
          {activeTab === 'corrections' && <CorrectionsModule isDark={isDark} />}
        </main>
      </div>
    </div>
  );
}

// Levelling Module (Rise and Fall + Height of Collimation)
function LevellingModule({ isDark = false }) {
  const [method, setMethod] = useState('rise-fall');
  const [benchmarkRL, setBenchmarkRL] = useState(100.000);
  const [rows, setRows] = useState([
    { station: 'BM', bs: 1.525, is: '', fs: '', rise: '', fall: '', rl: '', remarks: 'RL of Benchmark' }
  ]);

  const addRow = () => {
    setRows([...rows, { station: `ST${rows.length}`, bs: '', is: '', fs: '', rise: '', fall: '', rl: '', remarks: '' }]);
  };

  const deleteRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const calculateRiseFall = () => {
    const calculated = [...rows];
    let previousRL = benchmarkRL;

    calculated[0].rl = benchmarkRL.toFixed(3);

    for (let i = 0; i < calculated.length; i++) {
      const bs = parseFloat(calculated[i].bs) || 0;
      const fs = parseFloat(calculated[i].fs) || 0;
      const is_val = parseFloat(calculated[i].is) || 0;

      if (i > 0) {
        if (bs > 0 && fs === 0) {
          const fall = previousRL - (previousRL + bs);
          calculated[i].fall = Math.abs(fall).toFixed(3);
          calculated[i].rise = '';
          calculated[i].rl = (previousRL - Math.abs(fall)).toFixed(3);
          calculated[i].remarks = 'Change Point';
        } else if (fs > 0) {
          const diff = (parseFloat(calculated[i - 1].bs) || parseFloat(calculated[i - 1].is) || 0) - fs;
          if (diff > 0) {
            calculated[i].rise = diff.toFixed(3);
            calculated[i].fall = '';
            calculated[i].rl = (previousRL + diff).toFixed(3);
          } else {
            calculated[i].fall = Math.abs(diff).toFixed(3);
            calculated[i].rise = '';
            calculated[i].rl = (previousRL + diff).toFixed(3);
          }
        } else if (is_val > 0) {
          const diff = (parseFloat(calculated[i - 1].bs) || 0) - is_val;
          if (diff > 0) {
            calculated[i].rise = diff.toFixed(3);
            calculated[i].fall = '';
          } else {
            calculated[i].fall = Math.abs(diff).toFixed(3);
            calculated[i].rise = '';
          }
          calculated[i].rl = (previousRL + (parseFloat(calculated[i].rise) || 0) - (parseFloat(calculated[i].fall) || 0)).toFixed(3);
        }
        previousRL = parseFloat(calculated[i].rl);
      }
    }

    setRows(calculated);
  };

  const calculateHOC = () => {
    const calculated = [...rows];
    calculated[0].rl = benchmarkRL.toFixed(3);

    let hoc = benchmarkRL + (parseFloat(calculated[0].bs) || 0);
    calculated[0].remarks = `RL of Benchmark, HOC = ${hoc.toFixed(3)}`;

    for (let i = 1; i < calculated.length; i++) {
      const bs = parseFloat(calculated[i].bs) || 0;
      const fs = parseFloat(calculated[i].fs) || 0;
      const is_val = parseFloat(calculated[i].is) || 0;

      if (bs > 0) {
        calculated[i].rl = (hoc - fs).toFixed(3);
        hoc = parseFloat(calculated[i].rl) + bs;
        calculated[i].remarks = `Change Point, HOC = ${hoc.toFixed(3)}`;
      } else if (is_val > 0) {
        calculated[i].rl = (hoc - is_val).toFixed(3);
      } else if (fs > 0) {
        calculated[i].rl = (hoc - fs).toFixed(3);
      }
    }

    setRows(calculated);
  };

  const getArithmeticChecks = () => {
    const sumBS = rows.reduce((sum, row) => sum + (parseFloat(row.bs) || 0), 0);
    const sumFS = rows.reduce((sum, row) => sum + (parseFloat(row.fs) || 0), 0);
    const sumRise = rows.reduce((sum, row) => sum + (parseFloat(row.rise) || 0), 0);
    const sumFall = rows.reduce((sum, row) => sum + (parseFloat(row.fall) || 0), 0);
    const firstRL = parseFloat(rows[0].rl) || 0;
    const lastRL = parseFloat(rows[rows.length - 1].rl) || 0;

    return {
      sumBS: sumBS.toFixed(3),
      sumFS: sumFS.toFixed(3),
      sumRise: sumRise.toFixed(3),
      sumFall: sumFall.toFixed(3),
      check1: (sumBS - sumFS).toFixed(3),
      check2: (sumRise - sumFall).toFixed(3),
      check3: (lastRL - firstRL).toFixed(3),
      isValid: Math.abs((sumBS - sumFS) - (sumRise - sumFall)) < 0.01
    };
  };

  const checks = getArithmeticChecks();

  return (
    <div className="space-y-6">
      {/* Method Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Levelling Calculations</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2 border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:border-teal-500 focus:outline-none"
            >
              <option value="rise-fall">Rise and Fall Method</option>
              <option value="hoc">Height of Collimation Method</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Benchmark RL (m)</label>
            <input
              type="number"
              step="0.001"
              value={benchmarkRL}
              onChange={(e) => setBenchmarkRL(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={method === 'rise-fall' ? calculateRiseFall : calculateHOC}
            className="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-md flex items-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate
          </button>
          <button
            onClick={addRow}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Row
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
              <th className="border border-slate-600 px-4 py-3">Station</th>
              <th className="border border-slate-600 px-4 py-3">BS (m)</th>
              {method === 'hoc' && <th className="border border-slate-600 px-4 py-3">IS (m)</th>}
              <th className="border border-slate-600 px-4 py-3">FS (m)</th>
              {method === 'rise-fall' && (
                <>
                  <th className="border border-slate-600 px-4 py-3">Rise (m)</th>
                  <th className="border border-slate-600 px-4 py-3">Fall (m)</th>
                </>
              )}
              <th className="border border-slate-600 px-4 py-3">RL (m)</th>
              <th className="border border-slate-600 px-4 py-3">Remarks</th>
              <th className="border border-slate-600 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-4 py-2">
                  <input
                    type="text"
                    value={row.station}
                    onChange={(e) => updateRow(index, 'station', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="border border-slate-300 px-4 py-2">
                  <input
                    type="number"
                    step="0.001"
                    value={row.bs}
                    onChange={(e) => updateRow(index, 'bs', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                  />
                </td>
                {method === 'hoc' && (
                  <td className="border border-slate-300 px-4 py-2">
                    <input
                      type="number"
                      step="0.001"
                      value={row.is}
                      onChange={(e) => updateRow(index, 'is', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                    />
                  </td>
                )}
                <td className="border border-slate-300 px-4 py-2">
                  <input
                    type="number"
                    step="0.001"
                    value={row.fs}
                    onChange={(e) => updateRow(index, 'fs', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                  />
                </td>
                {method === 'rise-fall' && (
                  <>
                    <td className="border border-slate-300 px-4 py-2 bg-teal-50 text-center font-semibold text-teal-700">
                      {row.rise}
                    </td>
                    <td className="border border-slate-300 px-4 py-2 bg-red-50 text-center font-semibold text-red-700">
                      {row.fall}
                    </td>
                  </>
                )}
                <td className="border border-slate-300 px-4 py-2 bg-blue-50 text-center font-semibold text-blue-700">
                  {row.rl}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-sm text-slate-600">
                  {row.remarks}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center">
                  {index > 0 && (
                    <button
                      onClick={() => deleteRow(index)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Arithmetic Checks */}
      {method === 'rise-fall' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Arithmetic Checks</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">ΣBS - ΣFS</p>
              <p className="text-2xl font-bold text-slate-800">{checks.check1} m</p>
              <p className="text-xs text-slate-500 mt-1">({checks.sumBS} - {checks.sumFS})</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">ΣRise - ΣFall</p>
              <p className="text-2xl font-bold text-slate-800">{checks.check2} m</p>
              <p className="text-xs text-slate-500 mt-1">({checks.sumRise} - {checks.sumFall})</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">Last RL - First RL</p>
              <p className="text-2xl font-bold text-slate-800">{checks.check3} m</p>
              <p className={`text-sm font-semibold mt-2 ${checks.isValid ? 'text-teal-600' : 'text-red-600'}`}>
                {checks.isValid ? '✓ Checks Passed' : '✗ Check Failed'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Traverse Module (Bowditch Method)
function TraverseModule() {
  const [stations, setStations] = useState([
    { station: 'A', bearing: '', distance: '', latitude: '', departure: '', corrLat: '', corrDep: '', easting: '', northing: '' }
  ]);
  const [startE, setStartE] = useState(1000);
  const [startN, setStartN] = useState(1000);

  const addStation = () => {
    setStations([...stations, {
      station: String.fromCharCode(65 + stations.length),
      bearing: '', distance: '', latitude: '', departure: '',
      corrLat: '', corrDep: '', easting: '', northing: ''
    }]);
  };

  const updateStation = (index, field, value) => {
    const newStations = [...stations];
    newStations[index][field] = value;
    setStations(newStations);
  };

  const calculateTraverse = () => {
    const calculated = [...stations];
    let sumLat = 0, sumDep = 0, sumDist = 0;

    // Calculate latitudes and departures
    for (let i = 0; i < calculated.length; i++) {
      const bearing = parseFloat(calculated[i].bearing) || 0;
      const distance = parseFloat(calculated[i].distance) || 0;

      const bearingRad = (bearing * Math.PI) / 180;
      const lat = distance * Math.cos(bearingRad);
      const dep = distance * Math.sin(bearingRad);

      calculated[i].latitude = lat.toFixed(3);
      calculated[i].departure = dep.toFixed(3);

      sumLat += lat;
      sumDep += dep;
      sumDist += distance;
    }

    // Bowditch correction
    const corrLatPerUnit = -sumLat / sumDist;
    const corrDepPerUnit = -sumDep / sumDist;

    let currentE = startE;
    let currentN = startN;

    for (let i = 0; i < calculated.length; i++) {
      const distance = parseFloat(calculated[i].distance) || 0;
      const lat = parseFloat(calculated[i].latitude) || 0;
      const dep = parseFloat(calculated[i].departure) || 0;

      const corrLat = corrLatPerUnit * distance;
      const corrDep = corrDepPerUnit * distance;

      calculated[i].corrLat = corrLat.toFixed(3);
      calculated[i].corrDep = corrDep.toFixed(3);

      const finalLat = lat + corrLat;
      const finalDep = dep + corrDep;

      currentN += finalLat;
      currentE += finalDep;

      calculated[i].northing = currentN.toFixed(3);
      calculated[i].easting = currentE.toFixed(3);
    }

    setStations(calculated);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Traverse Calculations (Bowditch Method)</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Starting Easting (m)</label>
            <input
              type="number"
              value={startE}
              onChange={(e) => setStartE(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Starting Northing (m)</label>
            <input
              type="number"
              value={startN}
              onChange={(e) => setStartN(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={calculateTraverse}
            className="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-md flex items-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate Traverse
          </button>
          <button
            onClick={addStation}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Station
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
              <th className="border border-slate-600 px-3 py-2">Station</th>
              <th className="border border-slate-600 px-3 py-2">Bearing (°)</th>
              <th className="border border-slate-600 px-3 py-2">Distance (m)</th>
              <th className="border border-slate-600 px-3 py-2">Latitude (m)</th>
              <th className="border border-slate-600 px-3 py-2">Departure (m)</th>
              <th className="border border-slate-600 px-3 py-2">Corr. Lat (m)</th>
              <th className="border border-slate-600 px-3 py-2">Corr. Dep (m)</th>
              <th className="border border-slate-600 px-3 py-2">Easting (m)</th>
              <th className="border border-slate-600 px-3 py-2">Northing (m)</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2 text-center font-semibold">{station.station}</td>
                <td className="border border-slate-300 px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={station.bearing}
                    onChange={(e) => updateStation(index, 'bearing', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="border border-slate-300 px-3 py-2">
                  <input
                    type="number"
                    step="0.001"
                    value={station.distance}
                    onChange={(e) => updateStation(index, 'distance', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="border border-slate-300 px-3 py-2 bg-blue-50 text-center font-semibold">{station.latitude}</td>
                <td className="border border-slate-300 px-3 py-2 bg-blue-50 text-center font-semibold">{station.departure}</td>
                <td className="border border-slate-300 px-3 py-2 bg-teal-50 text-center font-semibold">{station.corrLat}</td>
                <td className="border border-slate-300 px-3 py-2 bg-teal-50 text-center font-semibold">{station.corrDep}</td>
                <td className="border border-slate-300 px-3 py-2 bg-green-50 text-center font-semibold text-green-700">{station.easting}</td>
                <td className="border border-slate-300 px-3 py-2 bg-green-50 text-center font-semibold text-green-700">{station.northing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// Tacheometric Module
function TacheometricModule() {
  const [stadia, setStadia] = useState({ upper: '', lower: '', central: '' });
  const [verticalAngle, setVerticalAngle] = useState('');
  const [k, setK] = useState(100);
  const [c, setC] = useState(0);
  const [result, setResult] = useState(null);

  const calculateTacheometry = () => {
    const s = parseFloat(stadia.upper) - parseFloat(stadia.lower);
    const theta = (parseFloat(verticalAngle) * Math.PI) / 180;

    const horizontalDistance = k * s * Math.cos(theta) * Math.cos(theta) + c * Math.cos(theta);
    const verticalDistance = k * s * Math.cos(theta) * Math.sin(theta) + c * Math.sin(theta);
    const slopeDistance = k * s + c;

    setResult({
      staffIntercept: s.toFixed(4),
      horizontalDistance: horizontalDistance.toFixed(3),
      verticalDistance: verticalDistance.toFixed(3),
      slopeDistance: slopeDistance.toFixed(3)
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Tacheometric Calculations</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Upper Stadia Reading (m)</label>
              <input
                type="number"
                step="0.001"
                value={stadia.upper}
                onChange={(e) => setStadia({ ...stadia, upper: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Central Hair Reading (m)</label>
              <input
                type="number"
                step="0.001"
                value={stadia.central}
                onChange={(e) => setStadia({ ...stadia, central: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Lower Stadia Reading (m)</label>
              <input
                type="number"
                step="0.001"
                value={stadia.lower}
                onChange={(e) => setStadia({ ...stadia, lower: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Vertical Angle (degrees)</label>
              <input
                type="number"
                step="0.01"
                value={verticalAngle}
                onChange={(e) => setVerticalAngle(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Multiplying Constant (k)</label>
              <input
                type="number"
                value={k}
                onChange={(e) => setK(parseFloat(e.target.value))}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Additive Constant (c)</label>
              <input
                type="number"
                step="0.01"
                value={c}
                onChange={(e) => setC(parseFloat(e.target.value))}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <button
          onClick={calculateTacheometry}
          className="mt-6 bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-md flex items-center gap-2"
        >
          <Calculator className="w-5 h-5" />
          Calculate
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Results</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
              <p className="text-sm text-slate-600 mb-1">Staff Intercept</p>
              <p className="text-2xl font-bold text-blue-700">{result.staffIntercept} m</p>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border-2 border-teal-200">
              <p className="text-sm text-slate-600 mb-1">Horizontal Distance</p>
              <p className="text-2xl font-bold text-teal-700">{result.horizontalDistance} m</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-200">
              <p className="text-sm text-slate-600 mb-1">Vertical Distance</p>
              <p className="text-2xl font-bold text-green-700">{result.verticalDistance} m</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border-2 border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Slope Distance</p>
              <p className="text-2xl font-bold text-slate-700">{result.slopeDistance} m</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sewer Design Module
function SewerDesignModule() {
  const [manholes, setManholes] = useState([
    { id: 'MH1', groundLevel: '', invertLevel: '', depth: '', distance: '', gradient: '', remarks: '' }
  ]);

  const addManhole = () => {
    setManholes([...manholes, {
      id: `MH${manholes.length + 1}`,
      groundLevel: '', invertLevel: '', depth: '',
      distance: '', gradient: '', remarks: ''
    }]);
  };

  const updateManhole = (index, field, value) => {
    const newManholes = [...manholes];
    newManholes[index][field] = value;
    setManholes(newManholes);
  };

  const calculateSewer = () => {
    const calculated = [...manholes];

    for (let i = 0; i < calculated.length; i++) {
      const gl = parseFloat(calculated[i].groundLevel) || 0;
      const il = parseFloat(calculated[i].invertLevel) || 0;

      if (gl && il) {
        calculated[i].depth = (gl - il).toFixed(3);
      }

      if (i > 0 && calculated[i].distance) {
        const prevIL = parseFloat(calculated[i - 1].invertLevel) || 0;
        const currIL = parseFloat(calculated[i].invertLevel) || 0;
        const dist = parseFloat(calculated[i].distance) || 0;

        if (dist > 0) {
          const gradient = ((prevIL - currIL) / dist) * 100;
          calculated[i].gradient = gradient.toFixed(4);
          calculated[i].remarks = gradient < 0 ? 'Check: Upward slope!' : 'OK';
        }
      }
    }

    setManholes(calculated);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Sewer Design & Levelling</h2>

        <div className="flex gap-3 mb-6">
          <button
            onClick={calculateSewer}
            className="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-md flex items-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calculate
          </button>
          <button
            onClick={addManhole}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Manhole
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                <th className="border border-slate-600 px-4 py-3">Manhole ID</th>
                <th className="border border-slate-600 px-4 py-3">Ground Level (m)</th>
                <th className="border border-slate-600 px-4 py-3">Invert Level (m)</th>
                <th className="border border-slate-600 px-4 py-3">Depth (m)</th>
                <th className="border border-slate-600 px-4 py-3">Distance (m)</th>
                <th className="border border-slate-600 px-4 py-3">Gradient (%)</th>
                <th className="border border-slate-600 px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {manholes.map((mh, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-4 py-2 text-center font-semibold">{mh.id}</td>
                  <td className="border border-slate-300 px-4 py-2">
                    <input
                      type="number"
                      step="0.001"
                      value={mh.groundLevel}
                      onChange={(e) => updateManhole(index, 'groundLevel', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                    />
                  </td>
                  <td className="border border-slate-300 px-4 py-2">
                    <input
                      type="number"
                      step="0.001"
                      value={mh.invertLevel}
                      onChange={(e) => updateManhole(index, 'invertLevel', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                    />
                  </td>
                  <td className="border border-slate-300 px-4 py-2 bg-blue-50 text-center font-semibold text-blue-700">
                    {mh.depth}
                  </td>
                  <td className="border border-slate-300 px-4 py-2">
                    <input
                      type="number"
                      step="0.001"
                      value={mh.distance}
                      onChange={(e) => updateManhole(index, 'distance', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded focus:border-teal-500 focus:outline-none"
                      disabled={index === 0}
                    />
                  </td>
                  <td className="border border-slate-300 px-4 py-2 bg-teal-50 text-center font-semibold text-teal-700">
                    {mh.gradient}
                  </td>
                  <td className="border border-slate-300 px-4 py-2 text-sm">
                    <span className={mh.remarks.includes('Check') ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {mh.remarks}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg shadow-md p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-slate-800 mb-3">Design Guidelines</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span><strong>Minimum gradient:</strong> 1:100 (1%) for 150mm diameter pipes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span><strong>Minimum cover:</strong> 0.9m in roads, 0.6m in fields</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span><strong>Manhole spacing:</strong> Maximum 90m for pipes up to 300mm diameter</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span><strong>Invert drop:</strong> Typically 50-150mm at manholes depending on pipe size change</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Control Survey Module
function ControlSurveyModule({ isDark = false }) {
  const [activeSubTab, setActiveSubTab] = useState('intersection');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Intersection State
  const [intersection, setIntersection] = useState({
    p1: { easting: 1000, northing: 1000 },
    p2: { easting: 1200, northing: 1000 },
    obs1: 45,
    obs2: 315,
    method: 'angular'
  });

  // Resection State
  const [resection, setResection] = useState({
    pts: [
      { id: 'A', coords: { easting: 1000, northing: 2000 } },
      { id: 'B', coords: { easting: 2000, northing: 2000 } },
      { id: 'C', coords: { easting: 1500, northing: 1000 } }
    ],
    angles: [120, 120, 120]
  });

  const handleCalculateIntersection = async () => {
    setLoading(true);
    try {
      const endpoint = intersection.method === 'angular'
        ? '/surveying_router/api/control/intersection/angular'
        : '/surveying_router/api/control/intersection/distance';

      const payload = {
        p1: { id: 'P1', coords: intersection.p1 },
        p2: { id: 'P2', coords: intersection.p2 },
        obs1: parseFloat(intersection.obs1),
        obs2: parseFloat(intersection.obs2),
        method: intersection.method
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateResection = async () => {
    setLoading(true);
    try {
      const payload = {
        target_id: 'P',
        fixed_points: resection.pts.map(p => ({ id: p.id, coords: p.coords })),
        observations: resection.angles.map(a => parseFloat(a)),
        method: '3-point'
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/surveying_router/api/control/resection/3point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Horizontal & Vertical Control</h2>

        <div className="flex border-b mb-6 border-slate-200 dark:border-slate-700">
          <button
            onClick={() => { setActiveSubTab('intersection'); setResult(null); }}
            className={`px-4 py-2 font-semibold ${activeSubTab === 'intersection' ? 'border-b-2 border-teal-500 text-teal-600' : 'text-slate-500'}`}
          >
            Intersection
          </button>
          <button
            onClick={() => { setActiveSubTab('resection'); setResult(null); }}
            className={`px-4 py-2 font-semibold ${activeSubTab === 'resection' ? 'border-b-2 border-teal-500 text-teal-600' : 'text-slate-500'}`}
          >
            3-Point Resection
          </button>
        </div>

        {activeSubTab === 'intersection' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-700 dark:text-slate-300">Base Point 1</h3>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Easting" value={intersection.p1.easting} onChange={e => setIntersection({ ...intersection, p1: { ...intersection.p1, easting: e.target.value } })} className="px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                <input type="number" placeholder="Northing" value={intersection.p1.northing} onChange={e => setIntersection({ ...intersection, p1: { ...intersection.p1, northing: e.target.value } })} className="px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
              </div>
              <h3 className="font-bold text-slate-700 dark:text-slate-300">Base Point 2</h3>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Easting" value={intersection.p2.easting} onChange={e => setIntersection({ ...intersection, p2: { ...intersection.p2, easting: e.target.value } })} className="px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                <input type="number" placeholder="Northing" value={intersection.p2.northing} onChange={e => setIntersection({ ...intersection, p2: { ...intersection.p2, northing: e.target.value } })} className="px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold text-slate-700 dark:text-slate-300">Observations</h3>
              <select value={intersection.method} onChange={e => setIntersection({ ...intersection, method: e.target.value })} className="w-full px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                <option value="angular">Angular Intersection (Bearings)</option>
                <option value="distance">Distance Intersection (Radii)</option>
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder={intersection.method === 'angular' ? 'Bearing 1 (°)' : 'Distance 1 (m)'} value={intersection.obs1} onChange={e => setIntersection({ ...intersection, obs1: e.target.value })} className="px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                <input type="number" placeholder={intersection.method === 'angular' ? 'Bearing 2 (°)' : 'Distance 2 (m)'} value={intersection.obs2} onChange={e => setIntersection({ ...intersection, obs2: e.target.value })} className="px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
              </div>
              <button
                onClick={handleCalculateIntersection}
                disabled={loading}
                className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition"
              >
                {loading ? 'Calculating...' : 'Calculate Intersection'}
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'resection' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {[0, 1, 2].map(i => (
                <div key={i} className="space-y-2">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">Point {resection.pts[i].id}</h3>
                  <input type="number" placeholder="Easting" value={resection.pts[i].coords.easting} onChange={e => {
                    const next = [...resection.pts];
                    next[i].coords.easting = e.target.value;
                    setResection({ ...resection, pts: next });
                  }} className="w-full px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                  <input type="number" placeholder="Northing" value={resection.pts[i].coords.northing} onChange={e => {
                    const next = [...resection.pts];
                    next[i].coords.northing = e.target.value;
                    setResection({ ...resection, pts: next });
                  }} className="w-full px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                  <input type="number" placeholder="Angle at P (°)" value={resection.angles[i]} onChange={e => {
                    const next = [...resection.angles];
                    next[i] = e.target.value;
                    setResection({ ...resection, angles: next });
                  }} className="w-full px-4 py-2 border rounded bg-blue-50 dark:bg-blue-900/40 dark:border-slate-600 dark:text-slate-100" />
                </div>
              ))}
            </div>
            <button
              onClick={handleCalculateResection}
              disabled={loading}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition"
            >
              {loading ? 'Calculating...' : 'Calculate 3-Point Resection'}
            </button>
          </div>
        )}
      </div>

      {result && result.result && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Results</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded">
              <p className="text-sm text-slate-500">Calculated Easting</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{result.result.easting || result.result.solution_a?.easting}</p>
            </div>
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded">
              <p className="text-sm text-slate-500">Calculated Northing</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{result.result.northing || result.result.solution_a?.northing}</p>
            </div>
          </div>
          {result.steps && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-300">Calculation Steps</h4>
              <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                {result.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Corrections Module
function CorrectionsModule({ isDark = false }) {
  const [distance, setDistance] = useState(100);
  const [corrections, setCorrections] = useState([
    { name: 'temperature', temp: 25, std_temp: 20, active: true },
    { name: 'tension', tension: 100, std_tension: 80, area: 0.000005, active: false }
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const activeCorrs = corrections.filter(c => c.active);
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/surveying_router/api/corrections/chained?distance=${distance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeCorrs)
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Angle & Distance Corrections</h2>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Measured Distance (m)</label>
          <input
            type="number"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            className="w-full px-4 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-700 dark:text-slate-300">Applicable Corrections</h3>
          {corrections.map((c, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded border-slate-200 dark:border-slate-700">
              <input type="checkbox" checked={c.active} onChange={e => {
                const next = [...corrections];
                next[i].active = e.target.checked;
                setCorrections(next);
              }} />
              <div className="flex-1">
                <p className="font-bold capitalize dark:text-slate-200">{c.name}</p>
                {c.name === 'temperature' && (
                  <div className="flex gap-4 mt-2">
                    <input type="number" placeholder="Temp" value={c.temp} onChange={e => {
                      const next = [...corrections];
                      next[i].temp = e.target.value;
                      setCorrections(next);
                    }} className="px-2 py-1 border rounded w-24 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                    <span className="text-sm text-slate-500">°C</span>
                  </div>
                )}
                {c.name === 'tension' && (
                  <div className="flex gap-4 mt-2">
                    <input type="number" placeholder="Tension" value={c.tension} onChange={e => {
                      const next = [...corrections];
                      next[i].tension = e.target.value;
                      setCorrections(next);
                    }} className="px-2 py-1 border rounded w-24 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                    <span className="text-sm text-slate-500">N</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
        >
          {loading ? 'Calculating...' : 'Apply Corrections'}
        </button>
      </div>

      {result && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Corrected Results</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border rounded dark:border-slate-700">
              <p className="text-sm text-slate-500">Original Distance</p>
              <p className="text-2xl font-bold dark:text-slate-200">{result.original_value} m</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <p className="text-sm text-slate-500">Final Corrected Distance</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.corrected_value} m</p>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700 dark:text-slate-300">Correction Components</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700">
                    <th className="px-2 py-1 text-left">Correction</th>
                    <th className="px-2 py-1 text-right">Value (m)</th>
                    <th className="px-2 py-1 text-left">Parameters</th>
                  </tr>
                </thead>
                <tbody>
                  {result.components.map((c, i) => (
                    <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-2 py-2 dark:text-slate-300">{c.name}</td>
                      <td className={`px-2 py-2 text-right font-bold ${c.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {c.value.toFixed(5)}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}