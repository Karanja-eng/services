import React, { useState } from 'react';

export default function ExternalWorksInputForm() {
  const [formData, setFormData] = useState({
    // Site Information
    projectName: '',
    projectLocation: '',
    drawingNumber: '',
    
    // Site Dimensions
    siteLength: 50,
    siteWidth: 40,
    
    // Demolition & Site Clearance (Class D)
    houseLength: 12,
    houseWidth: 10,
    buildingDemolitionVolume: 0,
    pipelineRemovalLength: 0,
    pipelineDiameter: 225,
    treesSmall: 0, // 0.5-2m girth
    treesLarge: 0, // >2m girth
    stumps: 0, // <1m
    vegetableSoilDepth: 0.15,
    
    // Road Configuration
    roadLength: 32,
    roadWidth: 9,
    roadType: 'bitumen', // bitumen or cabro
    
    // Driveway Configuration
    drivewayLength: 20,
    drivewayWidth: 9,
    drivewayType: 'bitumen',
    
    // Parking Configuration
    parkingLength: 25,
    parkingWidth: 9,
    parkingType: 'cabro',
    
    // Bellmouth Configuration
    bellmouthRadius1: 3.5,
    bellmouthRadius2: 2.5,
    
    // Pavement Layers Thickness (m)
    bitumenThickness: 0.05,
    bitumenMacadamBaseThickness: 0.15,
    murramFillingDepth: 0.20,
    hardcoreThickness: 0.20,
    sandBedThickness: 0.15,
    
    // Excavation
    excavationDepthAfterVeg: 0.50,
    backingAllowance: 0.10,
    
    // Kerbs and Channels
    kerbType: 'pcc', // pcc or precast
    kerbStraightLength: 0,
    kerbCurvedLength: 0,
    channelStraightLength: 0,
    channelCurvedLength: 0,
    
    // Edgings (alternative to kerbs)
    invertBlockLength: 0,
    pccSlabLength: 0,
    pccSlabWidth: 0.5,
    pccSlabThickness: 0.05,
    
    // Concrete Backing
    concreteBackingThickness: 0.10,
    
    // Landscaping (Class E)
    grassSeedingArea: 0,
    importedTopsoilThickness: 0.15,
    mahoganyTrees: 0, // 1m high
    ornamentalTrees: 0, // 10m c/c
    euphorbiaPedgeLength: 0, // 0.5m high
    
    // Fencing & Gates (Class X)
    timberPostWireFenceLength: 0, // 2100mm high
    fenceType1Length: 0, // 2-2.5m height
    fenceType2Length: 0, // 1.5-2m height
    metalGates: 0, // >5m span
    normalGates: 0,
    
    // Drainage
    invertBlockCount: 0,
    invertBlockSize: 0.35,
    drainageChannelLength: 0,
    
    // Additional Site Features
    footpathLength: 0,
    footpathWidth: 1.5,
    
    // Unit Rates (for estimation)
    includeRates: false,
  });

  const [activeSection, setActiveSection] = useState('site');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotals = () => {
    const clearArea = (formData.siteLength * formData.siteWidth) - 
                      (formData.houseLength * formData.houseWidth);
    
    const vegSoilVolume = clearArea * formData.vegetableSoilDepth;
    
    const roadArea = formData.roadLength * formData.roadWidth;
    const drivewayArea = formData.drivewayLength * formData.drivewayWidth;
    const parkingArea = formData.parkingLength * formData.parkingWidth;
    
    const bellmouthArea = (3/14) * Math.PI * 
                          (Math.pow(formData.bellmouthRadius1, 2) + 
                           Math.pow(formData.bellmouthRadius2, 2));
    
    const totalPavedArea = roadArea + drivewayArea + parkingArea + bellmouthArea;
    
    const excavationVolume = totalPavedArea * formData.excavationDepthAfterVeg;
    
    const murramVolume = totalPavedArea * formData.murramFillingDepth;
    const hardcoreVolume = totalPavedArea * formData.hardcoreThickness;
    const bitumenVolume = totalPavedArea * formData.bitumenThickness;
    
    return {
      clearArea,
      vegSoilVolume,
      totalPavedArea,
      excavationVolume,
      murramVolume,
      hardcoreVolume,
      bitumenVolume,
      roadArea,
      drivewayArea,
      parkingArea,
      bellmouthArea
    };
  };

  const totals = calculateTotals();

  const handleExport = () => {
    const dataStr = JSON.stringify(formData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `external-works-${formData.projectName || 'project'}.json`;
    link.click();
  };

  const handleCalculate = () => {
    alert('Calculations completed! Check the summary section below.');
  };

  const sections = {
    site: 'Site Information',
    demolition: 'Demolition & Clearance',
    road: 'Road Configuration',
    parking: 'Parking & Driveway',
    layers: 'Pavement Layers',
    kerbs: 'Kerbs & Channels',
    drainage: 'Drainage',
    landscape: 'Landscaping',
    fencing: 'Fencing & Gates',
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'site':
        return (
          <div className="form-section">
            <h3>Site Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  placeholder="Enter project name"
                />
              </div>
              <div className="form-group">
                <label>Project Location</label>
                <input
                  type="text"
                  value={formData.projectLocation}
                  onChange={(e) => handleInputChange('projectLocation', e.target.value)}
                  placeholder="Enter location"
                />
              </div>
              <div className="form-group">
                <label>Drawing Number</label>
                <input
                  type="text"
                  value={formData.drawingNumber}
                  onChange={(e) => handleInputChange('drawingNumber', e.target.value)}
                  placeholder="e.g., DRG No.01"
                />
              </div>
              <div className="form-group">
                <label>Site Length (m)</label>
                <input
                  type="number"
                  value={formData.siteLength}
                  onChange={(e) => handleInputChange('siteLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Site Width (m)</label>
                <input
                  type="number"
                  value={formData.siteWidth}
                  onChange={(e) => handleInputChange('siteWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
            </div>
          </div>
        );
      
      case 'demolition':
        return (
          <div className="form-section">
            <h3>Demolition & Site Clearance (Class D - CESMM)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Existing House Length (m)</label>
                <input
                  type="number"
                  value={formData.houseLength}
                  onChange={(e) => handleInputChange('houseLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Existing House Width (m)</label>
                <input
                  type="number"
                  value={formData.houseWidth}
                  onChange={(e) => handleInputChange('houseWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Building Demolition Volume (m³)</label>
                <input
                  type="number"
                  value={formData.buildingDemolitionVolume}
                  onChange={(e) => handleInputChange('buildingDemolitionVolume', parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Trees Small (0.5-2m girth)</label>
                <input
                  type="number"
                  value={formData.treesSmall}
                  onChange={(e) => handleInputChange('treesSmall', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Trees Large (>2m girth)</label>
                <input
                  type="number"
                  value={formData.treesLarge}
                  onChange={(e) => handleInputChange('treesLarge', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Stumps (<1m)</label>
                <input
                  type="number"
                  value={formData.stumps}
                  onChange={(e) => handleInputChange('stumps', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Pipeline Removal Length (m)</label>
                <input
                  type="number"
                  value={formData.pipelineRemovalLength}
                  onChange={(e) => handleInputChange('pipelineRemovalLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Pipeline Diameter (mm)</label>
                <input
                  type="number"
                  value={formData.pipelineDiameter}
                  onChange={(e) => handleInputChange('pipelineDiameter', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Vegetable Soil Depth (m)</label>
                <input
                  type="number"
                  value={formData.vegetableSoilDepth}
                  onChange={(e) => handleInputChange('vegetableSoilDepth', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
            </div>
          </div>
        );
      
      case 'road':
        return (
          <div className="form-section">
            <h3>Road Configuration</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Road Length (m)</label>
                <input
                  type="number"
                  value={formData.roadLength}
                  onChange={(e) => handleInputChange('roadLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Road Width (m)</label>
                <input
                  type="number"
                  value={formData.roadWidth}
                  onChange={(e) => handleInputChange('roadWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Road Surface Type</label>
                <select
                  value={formData.roadType}
                  onChange={(e) => handleInputChange('roadType', e.target.value)}
                >
                  <option value="bitumen">Bitumen Bound</option>
                  <option value="cabro">Cabro Blocks</option>
                  <option value="concrete">Concrete</option>
                </select>
              </div>
              <div className="form-group">
                <label>Bellmouth Radius 1 (m)</label>
                <input
                  type="number"
                  value={formData.bellmouthRadius1}
                  onChange={(e) => handleInputChange('bellmouthRadius1', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Bellmouth Radius 2 (m)</label>
                <input
                  type="number"
                  value={formData.bellmouthRadius2}
                  onChange={(e) => handleInputChange('bellmouthRadius2', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
            </div>
          </div>
        );
      
      case 'parking':
        return (
          <div className="form-section">
            <h3>Parking & Driveway Configuration</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Driveway Length (m)</label>
                <input
                  type="number"
                  value={formData.drivewayLength}
                  onChange={(e) => handleInputChange('drivewayLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Driveway Width (m)</label>
                <input
                  type="number"
                  value={formData.drivewayWidth}
                  onChange={(e) => handleInputChange('drivewayWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Driveway Type</label>
                <select
                  value={formData.drivewayType}
                  onChange={(e) => handleInputChange('drivewayType', e.target.value)}
                >
                  <option value="bitumen">Bitumen Bound</option>
                  <option value="cabro">Cabro Blocks</option>
                  <option value="concrete">Concrete</option>
                </select>
              </div>
              <div className="form-group">
                <label>Parking Length (m)</label>
                <input
                  type="number"
                  value={formData.parkingLength}
                  onChange={(e) => handleInputChange('parkingLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Parking Width (m)</label>
                <input
                  type="number"
                  value={formData.parkingWidth}
                  onChange={(e) => handleInputChange('parkingWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Parking Type</label>
                <select
                  value={formData.parkingType}
                  onChange={(e) => handleInputChange('parkingType', e.target.value)}
                >
                  <option value="bitumen">Bitumen Bound</option>
                  <option value="cabro">Cabro Blocks</option>
                  <option value="concrete">Concrete</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      case 'layers':
        return (
          <div className="form-section">
            <h3>Pavement Layers Thickness (Class R - CESMM)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Bitumen Premix (m)</label>
                <input
                  type="number"
                  value={formData.bitumenThickness}
                  onChange={(e) => handleInputChange('bitumenThickness', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Bitumen Macadam Base (m)</label>
                <input
                  type="number"
                  value={formData.bitumenMacadamBaseThickness}
                  onChange={(e) => handleInputChange('bitumenMacadamBaseThickness', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Murram Filling Depth (m)</label>
                <input
                  type="number"
                  value={formData.murramFillingDepth}
                  onChange={(e) => handleInputChange('murramFillingDepth', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Hardcore Thickness (m)</label>
                <input
                  type="number"
                  value={formData.hardcoreThickness}
                  onChange={(e) => handleInputChange('hardcoreThickness', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Sand Bed Thickness (m)</label>
                <input
                  type="number"
                  value={formData.sandBedThickness}
                  onChange={(e) => handleInputChange('sandBedThickness', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Excavation Depth After Veg (m)</label>
                <input
                  type="number"
                  value={formData.excavationDepthAfterVeg}
                  onChange={(e) => handleInputChange('excavationDepthAfterVeg', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Backing Allowance (m)</label>
                <input
                  type="number"
                  value={formData.backingAllowance}
                  onChange={(e) => handleInputChange('backingAllowance', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Concrete Backing Thickness (m)</label>
                <input
                  type="number"
                  value={formData.concreteBackingThickness}
                  onChange={(e) => handleInputChange('concreteBackingThickness', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
            </div>
          </div>
        );
      
      case 'kerbs':
        return (
          <div className="form-section">
            <h3>Kerbs & Channels</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Kerb Type</label>
                <select
                  value={formData.kerbType}
                  onChange={(e) => handleInputChange('kerbType', e.target.value)}
                >
                  <option value="pcc">PCC Kerb 125x250mm</option>
                  <option value="precast">Precast Concrete</option>
                </select>
              </div>
              <div className="form-group">
                <label>Kerb Straight Length (m)</label>
                <input
                  type="number"
                  value={formData.kerbStraightLength}
                  onChange={(e) => handleInputChange('kerbStraightLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Kerb Curved Length (m)</label>
                <input
                  type="number"
                  value={formData.kerbCurvedLength}
                  onChange={(e) => handleInputChange('kerbCurvedLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Channel Straight Length (m)</label>
                <input
                  type="number"
                  value={formData.channelStraightLength}
                  onChange={(e) => handleInputChange('channelStraightLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Channel Curved Length (m)</label>
                <input
                  type="number"
                  value={formData.channelCurvedLength}
                  onChange={(e) => handleInputChange('channelCurvedLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
            </div>
          </div>
        );
      
      case 'drainage':
        return (
          <div className="form-section">
            <h3>Drainage (Invert Blocks & PCC Slabs)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Invert Block Count</label>
                <input
                  type="number"
                  value={formData.invertBlockCount}
                  onChange={(e) => handleInputChange('invertBlockCount', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Invert Block Size (m)</label>
                <input
                  type="number"
                  value={formData.invertBlockSize}
                  onChange={(e) => handleInputChange('invertBlockSize', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>PCC Slab Length (m)</label>
                <input
                  type="number"
                  value={formData.pccSlabLength}
                  onChange={(e) => handleInputChange('pccSlabLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>PCC Slab Width (m)</label>
                <input
                  type="number"
                  value={formData.pccSlabWidth}
                  onChange={(e) => handleInputChange('pccSlabWidth', parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>PCC Slab Thickness (m)</label>
                <input
                  type="number"
                  value={formData.pccSlabThickness}
                  onChange={(e) => handleInputChange('pccSlabThickness', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Drainage Channel Length (m)</label>
                <input
                  type="number"
                  value={formData.drainageChannelLength}
                  onChange={(e) => handleInputChange('drainageChannelLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
            </div>
          </div>
        );
      
      case 'landscape':
        return (
          <div className="form-section">
            <h3>Landscaping (Class E - CESMM)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Grass Seeding Area (m²)</label>
                <input
                  type="number"
                  value={formData.grassSeedingArea}
                  onChange={(e) => handleInputChange('grassSeedingArea', parseFloat(e.target.value))}
                  step="1"
                />
              </div>
              <div className="form-group">
                <label>Imported Topsoil Thickness (m)</label>
                <input
                  type="number"
                  value={formData.importedTopsoilThickness}
                  onChange={(e) => handleInputChange('importedTopsoilThickness', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Mahogany Trees (1m high)</label>
                <input
                  type="number"
                  value={formData.mahoganyTrees}
                  onChange={(e) => handleInputChange('mahoganyTrees', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Ornamental Trees (10m c/c)</label>
                <input
                  type="number"
                  value={formData.ornamentalTrees}
                  onChange={(e) => handleInputChange('ornamentalTrees', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Euphorbia Hedge Length (m)</label>
                <input
                  type="number"
                  value={formData.euphorbiaPedgeLength}
                  onChange={(e) => handleInputChange('euphorbiaPedgeLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
            </div>
          </div>
        );
      
      case 'fencing':
        return (
          <div className="form-section">
            <h3>Fencing & Gates (Class X - CESMM)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Timber Posts & Wire Fence (m)</label>
                <input
                  type="number"
                  value={formData.timberPostWireFenceLength}
                  onChange={(e) => handleInputChange('timberPostWireFenceLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Fence Type 1 (2-2.5m) Length (m)</label>
                <input
                  type="number"
                  value={formData.fenceType1Length}
                  onChange={(e) => handleInputChange('fenceType1Length', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Fence Type 2 (1.5-2m) Length (m)</label>
                <input
                  type="number"
                  value={formData.fenceType2Length}
                  onChange={(e) => handleInputChange('fenceType2Length', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Metal Gates (>5m span)</label>
                <input
                  type="number"
                  value={formData.metalGates}
                  onChange={(e) => handleInputChange('metalGates', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Normal Gates</label>
                <input
                  type="number"
                  value={formData.normalGates}
                  onChange={(e) => handleInputChange('normalGates', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
        }
        .form-group label {
          font-weight: 600;
          margin-bottom: 5px;
          font-size: 14px;
          color: #333;
        }
        .form-group input,
        .form-group select {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4CAF50;
        }
        .form-section h3 {
          color: #2c3e50;
          border-bottom: 2px solid #4CAF50;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .nav-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }
        .nav-tab {
          padding: 10px 20px;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
        }
        .nav-tab:hover {
          background: #e0e0e0;
        }
        .nav-tab.active {
          background: #4CAF50;
          color: white;
        }
        .summary-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 15px;
        }
        .summary-item {
          background: white;
          padding: 15px;
          border-radius: 4px;
          border-left: 4px solid #4CAF50;
        }
        .summary-item label {
          font-size: 12px;
          color: #666;
          display: block;
          margin-bottom: 5px;
        }
        .summary-item value {
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
        }
        .action-buttons {
          display: flex;
          gap: 15px;
          margin-top: 30px;
          flex-wrap: wrap;
        }
        .btn {
          padding: 12px 30px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-primary {
          background: #4CAF50;
          color: white;
        }
        .btn-primary:hover {
          background: #45a049;
        }
        .btn-secondary {
          background: #2196F3;
          color: white;
        }
        .btn-secondary:hover {
          background: #0b7dda;
        }
        .btn-export {
          background: #FF9800;
          color: white;
        }
        .btn-export:hover {
          background: #e68900;
        }
      `}</style>

      <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>External Works Quantity Takeoff</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Professional quantity takeoff system for external works based on CESMM4 standards
      </p>

      <div className="nav-tabs">
        {Object.entries(sections).map(([key, label]) => (
          <button
            key={key}
            className={`nav-tab ${activeSection === key ? 'active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {renderSection()}

      <div className="summary-section">
        <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>Calculated Quantities Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <label>Site Clearance Area</label>
            <value>{totals.clearArea.toFixed(2)} m²</value>
          </div>
          <div className="summary-item">
            <label>Vegetable Soil Volume</label>
            <value>{totals.vegSoilVolume.toFixed(2)} m³</value>
          </div>
          <div className="summary-item">
            <label>Total Paved Area</label>
            <value>{totals.totalPavedArea.toFixed(2)} m²</value>
          </div>
          <div className="summary-item">
            <label>Road Area</label>
            <value>{totals.roadArea.toFixed(2)} m²</value>
          </div>
          <div className="summary-item">
            <label>Driveway Area</label>
            <value>{totals.drivewayArea.toFixed(2)} m²</value>
          </div>
          <div className="summary-item">
            <label>Parking Area</label>
            <value>{totals.parkingArea.toFixed(2)} m²</value>
          </div>
          <div className="summary-item">
            <label>Bellmouth Area</label>
            <value>{totals.bellmouthArea.toFixed(2)} m²</value>
          </div>
          <div className="summary-item">
            <label>Excavation Volume</label>
            <value>{totals.excavationVolume.toFixed(2)} m³</value>
          </div>
          <div className="summary-item">
            <label>Murram Filling</label>
            <value>{totals.murramVolume.toFixed(2)} m³</value>
          </div>
          <div className="summary-item">
            <label>Hardcore Filling</label>
            <value>{totals.hardcoreVolume.toFixed(2)} m³</value>
          </div>
          <div className="summary-item">
            <label>Bitumen Volume</label>
            <value>{totals.bitumenVolume.toFixed(2)} m³</value>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button className="btn btn-primary" onClick={handleCalculate}>
          Calculate Quantities
        </button>
        <button className="btn btn-secondary" onClick={() => {
          // This would connect to the 3D visualizer
          alert('3D visualization would open with these parameters');
        }}>
          View 3D Model
        </button>
        <button className="btn btn-export" onClick={handleExport}>
          Export Data (JSON)
        </button>
        <button className="btn btn-export" onClick={() => {
          alert('Generate takeoff sheet functionality - connects to backend');
        }}>
          Generate Takeoff Sheet
        </button>
      </div>
    </div>
  )
} 