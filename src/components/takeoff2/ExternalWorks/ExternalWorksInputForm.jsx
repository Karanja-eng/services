import React, { useState } from 'react';

export default function ExternalWorksInputForm({ formData, setFormData, theme, handleCalculate }) {
  const [activeSection, setActiveSection] = useState('site');

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const calculateTotals = () => {
    const clearArea = (formData.siteData.siteLength * formData.siteData.siteWidth) -
      (formData.demolition.houseLength * formData.demolition.houseWidth);

    const vegSoilVolume = clearArea * formData.demolition.vegetableSoilDepth;

    const roadArea = formData.roadConfig.roadLength * formData.roadConfig.roadWidth;
    const drivewayArea = formData.roadConfig.drivewayLength * formData.roadConfig.drivewayWidth;
    const parkingArea = formData.roadConfig.parkingLength * formData.roadConfig.parkingWidth;

    const bellmouthArea = (3 / 14) * Math.PI *
      (Math.pow(formData.roadConfig.bellmouthRadius1, 2) +
        Math.pow(formData.roadConfig.bellmouthRadius2, 2));

    const totalPavedArea = roadArea + drivewayArea + parkingArea + bellmouthArea;

    const excavationVolume = totalPavedArea * formData.pavementLayers.excavationDepthAfterVeg;

    const murramVolume = totalPavedArea * formData.pavementLayers.murramDepth;
    const hardcoreVolume = totalPavedArea * formData.pavementLayers.hardcoreThickness;
    const bitumenVolume = totalPavedArea * formData.pavementLayers.bitumenThickness;

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
    link.download = `external-works-${formData.projectInfo.projectName || 'project'}.json`;
    link.click();
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
                  value={formData.projectInfo.projectName}
                  onChange={(e) => handleInputChange('projectInfo', 'projectName', e.target.value)}
                  placeholder="Enter project name"
                />
              </div>
              <div className="form-group">
                <label>Project Location</label>
                <input
                  type="text"
                  value={formData.projectInfo.location}
                  onChange={(e) => handleInputChange('projectInfo', 'location', e.target.value)}
                  placeholder="Enter location"
                />
              </div>
              <div className="form-group">
                <label>Drawing Number</label>
                <input
                  type="text"
                  value={formData.projectInfo.drawingNumber}
                  onChange={(e) => handleInputChange('projectInfo', 'drawingNumber', e.target.value)}
                  placeholder="e.g., DRG No.01"
                />
              </div>
              <div className="form-group">
                <label>Site Length (m)</label>
                <input
                  type="number"
                  value={formData.siteData.siteLength}
                  onChange={(e) => handleInputChange('siteData', 'siteLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Site Width (m)</label>
                <input
                  type="number"
                  value={formData.siteData.siteWidth}
                  onChange={(e) => handleInputChange('siteData', 'siteWidth', parseFloat(e.target.value))}
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
                  value={formData.demolition.houseLength}
                  onChange={(e) => handleInputChange('demolition', 'houseLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Existing House Width (m)</label>
                <input
                  type="number"
                  value={formData.demolition.houseWidth}
                  onChange={(e) => handleInputChange('demolition', 'houseWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Building Demolition Volume (m³)</label>
                <input
                  type="number"
                  value={formData.demolition.buildingDemolitionVolume}
                  onChange={(e) => handleInputChange('demolition', 'buildingDemolitionVolume', parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Trees Small (0.5-2m girth)</label>
                <input
                  type="number"
                  value={formData.demolition.treesSmall}
                  onChange={(e) => handleInputChange('demolition', 'treesSmall', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Trees Large (less tha 2m girth)</label>
                <input
                  type="number"
                  value={formData.demolition.treesLarge}
                  onChange={(e) => handleInputChange('demolition', 'treesLarge', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Stumps (greater than 1m)</label>
                <input
                  type="number"
                  value={formData.demolition.stumps}
                  onChange={(e) => handleInputChange('demolition', 'stumps', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Pipeline Removal Length (m)</label>
                <input
                  type="number"
                  value={formData.demolition.pipelineRemovalLength}
                  onChange={(e) => handleInputChange('demolition', 'pipelineRemovalLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Pipeline Diameter (mm)</label>
                <input
                  type="number"
                  value={formData.demolition.pipelineDiameter}
                  onChange={(e) => handleInputChange('demolition', 'pipelineDiameter', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Vegetable Soil Depth (m)</label>
                <input
                  type="number"
                  value={formData.demolition.vegetableSoilDepth}
                  onChange={(e) => handleInputChange('demolition', 'vegetableSoilDepth', parseFloat(e.target.value))}
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
                  value={formData.roadConfig.roadLength}
                  onChange={(e) => handleInputChange('roadConfig', 'roadLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Road Width (m)</label>
                <input
                  type="number"
                  value={formData.roadConfig.roadWidth}
                  onChange={(e) => handleInputChange('roadConfig', 'roadWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Road Surface Type</label>
                <select
                  value={formData.roadConfig.roadType}
                  onChange={(e) => handleInputChange('roadConfig', 'roadType', e.target.value)}
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
                  value={formData.roadConfig.bellmouthRadius1}
                  onChange={(e) => handleInputChange('roadConfig', 'bellmouthRadius1', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Bellmouth Radius 2 (m)</label>
                <input
                  type="number"
                  value={formData.roadConfig.bellmouthRadius2}
                  onChange={(e) => handleInputChange('roadConfig', 'bellmouthRadius2', parseFloat(e.target.value))}
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
                  value={formData.roadConfig.drivewayLength}
                  onChange={(e) => handleInputChange('roadConfig', 'drivewayLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Driveway Width (m)</label>
                <input
                  type="number"
                  value={formData.roadConfig.drivewayWidth}
                  onChange={(e) => handleInputChange('roadConfig', 'drivewayWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Driveway Type</label>
                <select
                  value={formData.roadConfig.drivewayType}
                  onChange={(e) => handleInputChange('roadConfig', 'drivewayType', e.target.value)}
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
                  value={formData.roadConfig.parkingLength}
                  onChange={(e) => handleInputChange('roadConfig', 'parkingLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Parking Width (m)</label>
                <input
                  type="number"
                  value={formData.roadConfig.parkingWidth}
                  onChange={(e) => handleInputChange('roadConfig', 'parkingWidth', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Parking Type</label>
                <select
                  value={formData.roadConfig.parkingType}
                  onChange={(e) => handleInputChange('roadConfig', 'parkingType', e.target.value)}
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
                  value={formData.pavementLayers.bitumenThickness}
                  onChange={(e) => handleInputChange('pavementLayers', 'bitumenThickness', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Bitumen Macadam Base (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.bitumenMacadamBase}
                  onChange={(e) => handleInputChange('pavementLayers', 'bitumenMacadamBase', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Murram Filling Depth (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.murramDepth}
                  onChange={(e) => handleInputChange('pavementLayers', 'murramDepth', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Hardcore Thickness (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.hardcoreThickness}
                  onChange={(e) => handleInputChange('pavementLayers', 'hardcoreThickness', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Sand Bed Thickness (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.sandBedThickness}
                  onChange={(e) => handleInputChange('pavementLayers', 'sandBedThickness', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Excavation Depth After Veg (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.excavationDepthAfterVeg}
                  onChange={(e) => handleInputChange('pavementLayers', 'excavationDepthAfterVeg', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Backing Allowance (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.backingAllowance}
                  onChange={(e) => handleInputChange('pavementLayers', 'backingAllowance', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Concrete Backing Thickness (m)</label>
                <input
                  type="number"
                  value={formData.pavementLayers.concreteBackingThickness}
                  onChange={(e) => handleInputChange('pavementLayers', 'concreteBackingThickness', parseFloat(e.target.value))}
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
                  value={formData.kerbsChannels.kerbType}
                  onChange={(e) => handleInputChange('kerbsChannels', 'kerbType', e.target.value)}
                >
                  <option value="pcc">PCC Kerb 125x250mm</option>
                  <option value="precast">Precast Concrete</option>
                </select>
              </div>
              <div className="form-group">
                <label>Kerb Straight Length (m)</label>
                <input
                  type="number"
                  value={formData.kerbsChannels.kerbStraightLength}
                  onChange={(e) => handleInputChange('kerbsChannels', 'kerbStraightLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Kerb Curved Length (m)</label>
                <input
                  type="number"
                  value={formData.kerbsChannels.kerbCurvedLength}
                  onChange={(e) => handleInputChange('kerbsChannels', 'kerbCurvedLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Channel Straight Length (m)</label>
                <input
                  type="number"
                  value={formData.kerbsChannels.channelStraightLength}
                  onChange={(e) => handleInputChange('kerbsChannels', 'channelStraightLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Channel Curved Length (m)</label>
                <input
                  type="number"
                  value={formData.kerbsChannels.channelCurvedLength}
                  onChange={(e) => handleInputChange('kerbsChannels', 'channelCurvedLength', parseFloat(e.target.value))}
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
                  value={formData.drainage.invertBlockCount}
                  onChange={(e) => handleInputChange('drainage', 'invertBlockCount', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Invert Block Size (m)</label>
                <input
                  type="number"
                  value={formData.drainage.invertBlockSize}
                  onChange={(e) => handleInputChange('drainage', 'invertBlockSize', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>PCC Slab Length (m)</label>
                <input
                  type="number"
                  value={formData.drainage.pccSlabLength}
                  onChange={(e) => handleInputChange('drainage', 'pccSlabLength', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>PCC Slab Width (m)</label>
                <input
                  type="number"
                  value={formData.drainage.pccSlabWidth}
                  onChange={(e) => handleInputChange('drainage', 'pccSlabWidth', parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>PCC Slab Thickness (m)</label>
                <input
                  type="number"
                  value={formData.drainage.pccSlabThickness}
                  onChange={(e) => handleInputChange('drainage', 'pccSlabThickness', parseFloat(e.target.value))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Drainage Channel Length (m)</label>
                <input
                  type="number"
                  value={formData.drainage.drainageChannelLength}
                  onChange={(e) => handleInputChange('drainage', 'drainageChannelLength', parseFloat(e.target.value))}
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
                  value={formData.landscaping.grassSeedingArea}
                  onChange={(e) => handleInputChange('landscaping', 'grassSeedingArea', parseFloat(e.target.value))}
                  step="1"
                />
              </div>
              <div className="form-group">
                <label>Imported Topsoil Thickness (m)</label>
                <input
                  type="number"
                  value={formData.landscaping.importedTopsoilThickness}
                  onChange={(e) => handleInputChange('landscaping', 'importedTopsoilThickness', parseFloat(e.target.value))}
                  step="0.05"
                />
              </div>
              <div className="form-group">
                <label>Mahogany Trees (1m high)</label>
                <input
                  type="number"
                  value={formData.landscaping.mahoganyTrees}
                  onChange={(e) => handleInputChange('landscaping', 'mahoganyTrees', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Ornamental Trees (10m c/c)</label>
                <input
                  type="number"
                  value={formData.landscaping.ornamentalTrees}
                  onChange={(e) => handleInputChange('landscaping', 'ornamentalTrees', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Euphorbia Hedge Length (m)</label>
                <input
                  type="number"
                  value={formData.landscaping.euphorbiaHedgeLength}
                  onChange={(e) => handleInputChange('landscaping', 'euphorbiaHedgeLength', parseFloat(e.target.value))}
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
                  value={formData.fencing.timberPostWireFence}
                  onChange={(e) => handleInputChange('fencing', 'timberPostWireFence', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Fence Type 1 (2-2.5m) Length (m)</label>
                <input
                  type="number"
                  value={formData.fencing.fenceType1Length}
                  onChange={(e) => handleInputChange('fencing', 'fenceType1Length', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Fence Type 2 (1.5-2m) Length (m)</label>
                <input
                  type="number"
                  value={formData.fencing.fenceType2Length}
                  onChange={(e) => handleInputChange('fencing', 'fenceType2Length', parseFloat(e.target.value))}
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Metal Gates ({">"}5m span)</label>
                <input
                  type="number"
                  value={formData.fencing.metalGates}
                  onChange={(e) => handleInputChange('fencing', 'metalGates', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Normal Gates</label>
                <input
                  type="number"
                  value={formData.fencing.normalGates}
                  onChange={(e) => handleInputChange('fencing', 'normalGates', parseInt(e.target.value))}
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