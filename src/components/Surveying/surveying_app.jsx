import React, { useState } from 'react';
import { Calculator, Map, Grid3x3, Layers, TrendingUp, Wrench, Plus, Trash2, Download, Upload } from 'lucide-react';

// Main App Component
export default function SurveyingApp() {
  const [activeTab, setActiveTab] = useState('levelling');

  const tabs = [
    { id: 'levelling', label: 'Levelling', icon: TrendingUp },
    { id: 'traverse', label: 'Traverse', icon: Map },
    { id: 'contouring', label: 'Contouring', icon: Layers },
    { id: 'tacheometric', label: 'Tacheometry', icon: Calculator },
    { id: 'sewer', label: 'Sewer Design', icon: Wrench }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Grid3x3 className="w-8 h-8 text-teal-400" />
            Civil Engineering Surveying Calculator
          </h1>
          <p className="text-slate-300 mt-2">Professional Field Surveying Tools</p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-md border-b-2 border-slate-200">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-4 ${
                  activeTab === id
                    ? 'border-teal-500 text-teal-700 bg-teal-50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'
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
        {activeTab === 'levelling' && <LevellingModule />}
        {activeTab === 'traverse' && <TraverseModule />}
        {activeTab === 'contouring' && <ContouringModule />}
        {activeTab === 'tacheometric' && <TacheometricModule />}
        {activeTab === 'sewer' && <SewerDesignModule />}
      </main>
    </div>
  );
}

// Levelling Module (Rise and Fall + Height of Collimation)
function LevellingModule() {
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Levelling Calculations</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
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

// Contouring Module
function ContouringModule() {
  const [gridSize, setGridSize] = useState(5);
  const [contourInterval, setContourInterval] = useState(1);
  const [gridData, setGridData] = useState([]);

  const initializeGrid = () => {
    const data = [];
    for (let i = 0; i < gridSize; i++) {
      const row = [];
      for (let j = 0; j < gridSize; j++) {
        row.push({ row: i, col: j, rl: '' });
      }
      data.push(row);
    }
    setGridData(data);
  };

  const updateGridValue = (row, col, value) => {
    const newData = [...gridData];
    newData[row][col].rl = value;
    setGridData(newData);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Contouring & Grid Survey</h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Grid Size</label>
            <input
              type="number"
              min="2"
              max="20"
              value={gridSize}
              onChange={(e) => setGridSize(parseInt(e.target.value))}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contour Interval (m)</label>
            <input
              type="number"
              step="0.1"
              value={contourInterval}
              onChange={(e) => setContourInterval(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={initializeGrid}
              className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Grid3x3 className="w-5 h-5" />
              Generate Grid
            </button>
          </div>
        </div>
      </div>

      {gridData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Grid RL Values</h3>
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="border-2 border-slate-400 px-4 py-2 bg-slate-200"></th>
                {gridData[0].map((_, colIndex) => (
                  <th key={colIndex} className="border-2 border-slate-400 px-4 py-2 bg-slate-200 font-bold">
                    {String.fromCharCode(65 + colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gridData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="border-2 border-slate-400 px-4 py-2 bg-slate-200 font-bold">{rowIndex + 1}</th>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="border-2 border-slate-300 p-0">
                      <input
                        type="number"
                        step="0.01"
                        value={cell.rl}
                        onChange={(e) => updateGridValue(rowIndex, colIndex, e.target.value)}
                        className="w-20 h-16 text-center border-0 focus:bg-teal-50 focus:outline-none font-semibold"
                        placeholder="RL"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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