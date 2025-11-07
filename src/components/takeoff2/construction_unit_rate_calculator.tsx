import React, { useState } from 'react';
import { Calculator, FileText, Download, Building2, Wrench, PaintBucket, Droplets } from 'lucide-react';

const ConstructionCalculator = () => {
  const [selectedWork, setSelectedWork] = useState('');
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);

  const workCategories = {
    earthworks: {
      name: 'Earthworks',
      icon: <Building2 className="w-5 h-5" />,
      items: [
        'Site Clearance',
        'Bulk Excavation',
        'Trench Excavation',
        'Backfilling',
        'Hardcore Filling',
        'Compaction'
      ]
    },
    concrete: {
      name: 'Concrete Works',
      icon: <Wrench className="w-5 h-5" />,
      items: [
        'Mass Concrete Foundation',
        'Reinforced Concrete Slab',
        'Concrete Columns',
        'Concrete Beams',
        'Retaining Walls'
      ]
    },
    masonry: {
      name: 'Masonry Works',
      icon: <Building2 className="w-5 h-5" />,
      items: [
        'Block Walling',
        'Brick Walling',
        'Stone Walling'
      ]
    },
    finishes: {
      name: 'Finishes',
      icon: <PaintBucket className="w-5 h-5" />,
      items: [
        'Wall Tiling',
        'Floor Tiling',
        'Bathroom Tiling',
        'Kitchen Tiling',
        'Painting - Emulsion',
        'Painting - Gloss',
        'Plastering',
        'Screeding'
      ]
    },
    plumbing: {
      name: 'Plumbing Works',
      icon: <Droplets className="w-5 h-5" />,
      items: [
        'Sewer Pipe Laying',
        'Water Pipe Installation',
        'Manhole Construction',
        'Septic Tank Construction',
        'Water Tank Installation'
      ]
    },
    roofing: {
      name: 'Roofing Works',
      icon: <Building2 className="w-5 h-5" />,
      items: [
        'Timber Roof Trusses',
        'Iron Sheet Roofing',
        'Tile Roofing',
        'Fascia Boards',
        'Gutters & Downpipes'
      ]
    },
    electrical: {
      name: 'Electrical Works',
      icon: <Wrench className="w-5 h-5" />,
      items: [
        'Conduit Installation',
        'Wiring Installation',
        'Socket Installation',
        'Lighting Points',
        'Distribution Board'
      ]
    }
  };

  const workInputs = {
    'Site Clearance': [
      { name: 'area', label: 'Area (m²)', type: 'number', required: true },
      { name: 'vegetation_density', label: 'Vegetation Density', type: 'select', options: ['Light', 'Medium', 'Heavy'], required: true },
      { name: 'disposal_distance', label: 'Disposal Distance (km)', type: 'number', required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true },
      { name: 'terrain', label: 'Terrain Type', type: 'select', options: ['Flat', 'Sloped', 'Very Sloped'], required: true },
      { name: 'access_difficulty', label: 'Site Access', type: 'select', options: ['Easy', 'Moderate', 'Difficult'], required: true },
      { name: 'building_nearby', label: 'Buildings Nearby', type: 'select', options: ['Yes', 'No'], required: true }
    ],
    'Bulk Excavation': [
      { name: 'volume', label: 'Volume (m³)', type: 'number', required: true },
      { name: 'depth', label: 'Average Depth (m)', type: 'number', required: true },
      { name: 'soil_type', label: 'Soil Type', type: 'select', options: ['Soft', 'Medium', 'Hard', 'Rock'], required: true },
      { name: 'excavation_method', label: 'Method', type: 'select', options: ['Manual', 'Machine'], required: true },
      { name: 'water_table', label: 'Water Table Issue', type: 'select', options: ['Dry', 'Seasonal', 'High'], required: true },
      { name: 'disposal_distance', label: 'Disposal Distance (km)', type: 'number', required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Wall Tiling': [
      { name: 'area', label: 'Wall Area (m²)', type: 'number', required: true },
      { name: 'tile_size', label: 'Tile Size (cm)', type: 'select', options: ['20x20', '30x30', '40x40', '60x60'], required: true },
      { name: 'tile_quality', label: 'Tile Quality', type: 'select', options: ['Standard', 'Premium', 'Luxury'], required: true },
      { name: 'wall_condition', label: 'Wall Condition', type: 'select', options: ['Good', 'Fair', 'Poor'], required: true },
      { name: 'pattern', label: 'Laying Pattern', type: 'select', options: ['Straight', 'Diagonal', 'Herringbone'], required: true },
      { name: 'wastage', label: 'Expected Wastage (%)', type: 'number', required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Floor Tiling': [
      { name: 'area', label: 'Floor Area (m²)', type: 'number', required: true },
      { name: 'tile_size', label: 'Tile Size (cm)', type: 'select', options: ['20x20', '30x30', '40x40', '60x60', '80x80'], required: true },
      { name: 'tile_quality', label: 'Tile Quality', type: 'select', options: ['Standard', 'Premium', 'Luxury'], required: true },
      { name: 'floor_condition', label: 'Floor Condition', type: 'select', options: ['Good', 'Fair', 'Poor'], required: true },
      { name: 'pattern', label: 'Laying Pattern', type: 'select', options: ['Straight', 'Diagonal', 'Herringbone'], required: true },
      { name: 'wastage', label: 'Expected Wastage (%)', type: 'number', required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Bathroom Tiling': [
      { name: 'floor_area', label: 'Floor Area (m²)', type: 'number', required: true },
      { name: 'wall_area', label: 'Wall Area (m²)', type: 'number', required: true },
      { name: 'tile_quality', label: 'Tile Quality', type: 'select', options: ['Standard', 'Premium', 'Luxury'], required: true },
      { name: 'waterproofing', label: 'Waterproofing Required', type: 'select', options: ['Yes', 'No'], required: true },
      { name: 'special_cuts', label: 'Special Cuts/Features', type: 'select', options: ['None', 'Few', 'Many'], required: true },
      { name: 'wastage', label: 'Expected Wastage (%)', type: 'number', required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Painting - Emulsion': [
      { name: 'area', label: 'Surface Area (m²)', type: 'number', required: true },
      { name: 'coats', label: 'Number of Coats', type: 'number', required: true },
      { name: 'paint_quality', label: 'Paint Quality', type: 'select', options: ['Economy', 'Standard', 'Premium'], required: true },
      { name: 'surface_condition', label: 'Surface Condition', type: 'select', options: ['New', 'Repaint-Good', 'Repaint-Poor'], required: true },
      { name: 'color', label: 'Color Type', type: 'select', options: ['White', 'Light Colors', 'Dark Colors'], required: true },
      { name: 'height', label: 'Working Height', type: 'select', options: ['Standard', 'High', 'Very High'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Sewer Pipe Laying': [
      { name: 'length', label: 'Length (m)', type: 'number', required: true },
      { name: 'pipe_diameter', label: 'Pipe Diameter (mm)', type: 'select', options: ['100', '150', '200', '250', '300'], required: true },
      { name: 'pipe_material', label: 'Pipe Material', type: 'select', options: ['PVC', 'HDPE', 'Concrete'], required: true },
      { name: 'trench_depth', label: 'Average Trench Depth (m)', type: 'number', required: true },
      { name: 'soil_type', label: 'Soil Type', type: 'select', options: ['Soft', 'Medium', 'Hard'], required: true },
      { name: 'bedding_required', label: 'Bedding Required', type: 'select', options: ['Yes', 'No'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Manhole Construction': [
      { name: 'depth', label: 'Manhole Depth (m)', type: 'number', required: true },
      { name: 'manhole_type', label: 'Manhole Type', type: 'select', options: ['Standard', 'Deep', 'Junction'], required: true },
      { name: 'diameter', label: 'Internal Diameter (mm)', type: 'select', options: ['900', '1050', '1200'], required: true },
      { name: 'cover_type', label: 'Cover Type', type: 'select', options: ['Light', 'Medium', 'Heavy Duty'], required: true },
      { name: 'excavation_condition', label: 'Excavation Condition', type: 'select', options: ['Dry', 'Wet', 'Rocky'], required: true },
      { name: 'benching_required', label: 'Benching Required', type: 'select', options: ['Yes', 'No'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Mass Concrete Foundation': [
      { name: 'volume', label: 'Concrete Volume (m³)', type: 'number', required: true },
      { name: 'concrete_grade', label: 'Concrete Grade', type: 'select', options: ['C15', 'C20', 'C25', 'C30'], required: true },
      { name: 'foundation_depth', label: 'Foundation Depth (m)', type: 'number', required: true },
      { name: 'pour_method', label: 'Pouring Method', type: 'select', options: ['Manual', 'Ready Mix', 'Concrete Pump'], required: true },
      { name: 'access_difficulty', label: 'Site Access', type: 'select', options: ['Easy', 'Moderate', 'Difficult'], required: true },
      { name: 'curing_method', label: 'Curing Method', type: 'select', options: ['Water', 'Membrane', 'Both'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Reinforced Concrete Slab': [
      { name: 'area', label: 'Slab Area (m²)', type: 'number', required: true },
      { name: 'thickness', label: 'Slab Thickness (mm)', type: 'number', required: true },
      { name: 'concrete_grade', label: 'Concrete Grade', type: 'select', options: ['C20', 'C25', 'C30', 'C35'], required: true },
      { name: 'reinforcement_ratio', label: 'Reinforcement', type: 'select', options: ['Light', 'Medium', 'Heavy'], required: true },
      { name: 'formwork_type', label: 'Formwork Type', type: 'select', options: ['Timber', 'Steel', 'Plastic'], required: true },
      { name: 'slab_level', label: 'Slab Level', type: 'select', options: ['Ground Floor', 'First Floor', 'Upper Floors'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Block Walling': [
      { name: 'area', label: 'Wall Area (m²)', type: 'number', required: true },
      { name: 'block_size', label: 'Block Size', type: 'select', options: ['4 inch', '6 inch', '8 inch', '9 inch'], required: true },
      { name: 'wall_height', label: 'Wall Height (m)', type: 'number', required: true },
      { name: 'mortar_ratio', label: 'Mortar Ratio', type: 'select', options: ['1:4', '1:5', '1:6'], required: true },
      { name: 'reinforcement', label: 'Reinforcement', type: 'select', options: ['None', 'Horizontal', 'Vertical', 'Both'], required: true },
      { name: 'finish', label: 'Wall Finish', type: 'select', options: ['Fair Face', 'To be Plastered'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Plastering': [
      { name: 'area', label: 'Surface Area (m²)', type: 'number', required: true },
      { name: 'thickness', label: 'Plaster Thickness (mm)', type: 'number', required: true },
      { name: 'mortar_ratio', label: 'Mortar Ratio', type: 'select', options: ['1:3', '1:4', '1:5'], required: true },
      { name: 'surface_type', label: 'Surface Type', type: 'select', options: ['Wall', 'Ceiling', 'Column'], required: true },
      { name: 'finish_quality', label: 'Finish Quality', type: 'select', options: ['Rough', 'Smooth', 'Fine'], required: true },
      { name: 'wall_condition', label: 'Wall Condition', type: 'select', options: ['New', 'Old', 'Damaged'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Screeding': [
      { name: 'area', label: 'Floor Area (m²)', type: 'number', required: true },
      { name: 'thickness', label: 'Screed Thickness (mm)', type: 'number', required: true },
      { name: 'mix_ratio', label: 'Mix Ratio', type: 'select', options: ['1:3', '1:4'], required: true },
      { name: 'finish', label: 'Finish Type', type: 'select', options: ['Rough', 'Smooth', 'Power Floated'], required: true },
      { name: 'base_condition', label: 'Base Condition', type: 'select', options: ['Good', 'Fair', 'Poor'], required: true },
      { name: 'falls_required', label: 'Falls Required', type: 'select', options: ['Yes', 'No'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Trench Excavation': [
      { name: 'length', label: 'Trench Length (m)', type: 'number', required: true },
      { name: 'width', label: 'Trench Width (m)', type: 'number', required: true },
      { name: 'depth', label: 'Trench Depth (m)', type: 'number', required: true },
      { name: 'soil_type', label: 'Soil Type', type: 'select', options: ['Soft', 'Medium', 'Hard', 'Rock'], required: true },
      { name: 'shoring_required', label: 'Shoring Required', type: 'select', options: ['Yes', 'No'], required: true },
      { name: 'dewatering', label: 'Dewatering Required', type: 'select', options: ['Yes', 'No'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ],
    'Iron Sheet Roofing': [
      { name: 'area', label: 'Roof Area (m²)', type: 'number', required: true },
      { name: 'sheet_gauge', label: 'Sheet Gauge', type: 'select', options: ['28', '30', '32'], required: true },
      { name: 'sheet_type', label: 'Sheet Type', type: 'select', options: ['Box Profile', 'Corrugated', 'Tile Profile'], required: true },
      { name: 'coating', label: 'Coating', type: 'select', options: ['Plain', 'Colored', 'Stone Coated'], required: true },
      { name: 'roof_pitch', label: 'Roof Pitch', type: 'select', options: ['Low', 'Medium', 'Steep'], required: true },
      { name: 'complexity', label: 'Roof Complexity', type: 'select', options: ['Simple', 'Moderate', 'Complex'], required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['Nairobi', 'Coast', 'Western'], required: true }
    ]
  };

  const calculateUnitRate = (workType, data) => {
    const regionFactors = {
      'Nairobi': 1.15,
      'Coast': 1.10,
      'Western': 1.0
    };

    const labourRates = {
      'Nairobi': { skilled: 1500, semiskilled: 1000, unskilled: 700 },
      'Coast': { skilled: 1400, semiskilled: 900, unskilled: 650 },
      'Western': { skilled: 1200, semiskilled: 800, unskilled: 600 }
    };

    const materialPrices = {
      cement: 750,
      sand: 1800,
      ballast: 2200,
      blocks_4: 45,
      blocks_6: 55,
      blocks_8: 70,
      reinforcement: 95,
      tiles_standard: 1200,
      tiles_premium: 2800,
      tiles_luxury: 5500,
      paint_economy: 1200,
      paint_standard: 1800,
      paint_premium: 2800,
      pvc_pipe_100: 580,
      pvc_pipe_150: 920,
      pvc_pipe_200: 1450,
      iron_sheet_28: 850,
      iron_sheet_30: 720,
      iron_sheet_32: 650
    };

    let breakdown = {
      materials: {},
      labour: {},
      equipment: {},
      overhead: 0,
      contingency: 0,
      profit: 0
    };

    const region = data.region || 'Nairobi';
    const regionFactor = regionFactors[region];

    switch(workType) {
      case 'Site Clearance':
        const clearanceArea = parseFloat(data.area);
        const densityFactor = data.vegetation_density === 'Light' ? 0.8 : data.vegetation_density === 'Heavy' ? 1.5 : 1.0;
        const terrainFactor = data.terrain === 'Flat' ? 1.0 : data.terrain === 'Very Sloped' ? 1.4 : 1.2;
        const accessFactor = data.access_difficulty === 'Easy' ? 1.0 : data.access_difficulty === 'Difficult' ? 1.3 : 1.15;
        
        breakdown.labour.unskilled = labourRates[region].unskilled * 0.15 * densityFactor * terrainFactor;
        breakdown.labour.skilled = labourRates[region].skilled * 0.05 * densityFactor;
        breakdown.equipment.wheelbarrows = 150 * densityFactor;
        breakdown.equipment.tools = 80;
        breakdown.equipment.disposal = parseFloat(data.disposal_distance) * 500 * densityFactor;
        
        if(data.building_nearby === 'Yes') {
          breakdown.labour.extra_care = 200;
        }
        
        const clearanceMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const clearanceLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const clearanceEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (clearanceMaterialTotal + clearanceLabourTotal + clearanceEquipmentTotal) * 0.10;
        breakdown.contingency = (clearanceMaterialTotal + clearanceLabourTotal + clearanceEquipmentTotal) * 0.08;
        breakdown.profit = (clearanceMaterialTotal + clearanceLabourTotal + clearanceEquipmentTotal) * 0.12;
        
        return {
          unitRate: ((clearanceMaterialTotal + clearanceLabourTotal + clearanceEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * accessFactor).toFixed(2),
          unit: 'KES/m²',
          quantity: clearanceArea,
          breakdown: breakdown,
          totalCost: ((clearanceMaterialTotal + clearanceLabourTotal + clearanceEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * accessFactor * clearanceArea).toFixed(2)
        };

      case 'Wall Tiling':
        const wallArea = parseFloat(data.area);
        const wastage = parseFloat(data.wastage) / 100 || 0.10;
        const tileCoverage = data.tile_size === '20x20' ? 25 : data.tile_size === '30x30' ? 11.11 : data.tile_size === '40x40' ? 6.25 : 2.78;
        const tileQuality = data.tile_quality === 'Standard' ? 'tiles_standard' : data.tile_quality === 'Premium' ? 'tiles_premium' : 'tiles_luxury';
        const patternFactor = data.pattern === 'Straight' ? 1.0 : data.pattern === 'Diagonal' ? 1.15 : 1.25;
        const conditionFactor = data.wall_condition === 'Good' ? 1.0 : data.wall_condition === 'Fair' ? 1.15 : 1.35;
        
        const tilesNeeded = wallArea * tileCoverage * (1 + wastage) * patternFactor;
        const cementBags = wallArea * 0.03 * conditionFactor;
        const adhesive = wallArea * 5 * conditionFactor;
        const grout = wallArea * 0.8;
        
        breakdown.materials.tiles = (materialPrices[tileQuality] / 1.44) * tilesNeeded;
        breakdown.materials.cement = materialPrices.cement * cementBags;
        breakdown.materials.tile_adhesive = adhesive * 180;
        breakdown.materials.grout = grout * 120;
        breakdown.materials.sand = (wallArea * 0.02) * materialPrices.sand / 1000;
        
        breakdown.labour.tiler = labourRates[region].skilled * (wallArea / 8) * patternFactor;
        breakdown.labour.helper = labourRates[region].unskilled * (wallArea / 12);
        
        breakdown.equipment.tile_cutter = 250;
        breakdown.equipment.mixing_tools = 150;
        breakdown.equipment.levels_spacers = 180;
        
        const wallMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const wallLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const wallEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (wallMaterialTotal + wallLabourTotal + wallEquipmentTotal) * 0.10;
        breakdown.contingency = (wallMaterialTotal + wallLabourTotal + wallEquipmentTotal) * 0.08;
        breakdown.profit = (wallMaterialTotal + wallLabourTotal + wallEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((wallMaterialTotal + wallLabourTotal + wallEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * conditionFactor / wallArea).toFixed(2),
          unit: 'KES/m²',
          quantity: wallArea,
          breakdown: breakdown,
          totalCost: ((wallMaterialTotal + wallLabourTotal + wallEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * conditionFactor).toFixed(2)
        };

      case 'Floor Tiling':
        const floorArea = parseFloat(data.area);
        const floorWastage = parseFloat(data.wastage) / 100 || 0.10;
        const floorTileCoverage = data.tile_size === '20x20' ? 25 : data.tile_size === '30x30' ? 11.11 : 
                                  data.tile_size === '40x40' ? 6.25 : data.tile_size === '60x60' ? 2.78 : 1.56;
        const floorTileQuality = data.tile_quality === 'Standard' ? 'tiles_standard' : data.tile_quality === 'Premium' ? 'tiles_premium' : 'tiles_luxury';
        const floorPatternFactor = data.pattern === 'Straight' ? 1.0 : data.pattern === 'Diagonal' ? 1.15 : 1.25;
        const floorConditionFactor = data.floor_condition === 'Good' ? 1.0 : data.floor_condition === 'Fair' ? 1.20 : 1.45;
        
        const floorTilesNeeded = floorArea * floorTileCoverage * (1 + floorWastage) * floorPatternFactor;
        const floorCementBags = floorArea * 0.04 * floorConditionFactor;
        const floorAdhesive = floorArea * 6 * floorConditionFactor;
        
        breakdown.materials.tiles = (materialPrices[floorTileQuality] / 1.44) * floorTilesNeeded;
        breakdown.materials.cement = materialPrices.cement * floorCementBags;
        breakdown.materials.tile_adhesive = floorAdhesive * 180;
        breakdown.materials.grout = floorArea * 1.2 * 120;
        breakdown.materials.sand = (floorArea * 0.03) * materialPrices.sand / 1000;
        
        breakdown.labour.tiler = labourRates[region].skilled * (floorArea / 10) * floorPatternFactor;
        breakdown.labour.helper = labourRates[region].unskilled * (floorArea / 15);
        
        breakdown.equipment.tile_cutter = 280;
        breakdown.equipment.mixing_tools = 150;
        breakdown.equipment.levels_spacers = 200;
        
        const floorMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const floorLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const floorEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (floorMaterialTotal + floorLabourTotal + floorEquipmentTotal) * 0.10;
        breakdown.contingency = (floorMaterialTotal + floorLabourTotal + floorEquipmentTotal) * 0.08;
        breakdown.profit = (floorMaterialTotal + floorLabourTotal + floorEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((floorMaterialTotal + floorLabourTotal + floorEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * floorConditionFactor / floorArea).toFixed(2),
          unit: 'KES/m²',
          quantity: floorArea,
          breakdown: breakdown,
          totalCost: ((floorMaterialTotal + floorLabourTotal + floorEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * floorConditionFactor).toFixed(2)
        };

      case 'Bathroom Tiling':
        const bathFloorArea = parseFloat(data.floor_area);
        const bathWallArea = parseFloat(data.wall_area);
        const bathTotalArea = bathFloorArea + bathWallArea;
        const bathWastage = parseFloat(data.wastage) / 100 || 0.12;
        const bathQuality = data.tile_quality === 'Standard' ? 'tiles_standard' : data.tile_quality === 'Premium' ? 'tiles_premium' : 'tiles_luxury';
        const waterproofing = data.waterproofing === 'Yes' ? 1 : 0;
        const specialCutsFactor = data.special_cuts === 'None' ? 1.0 : data.special_cuts === 'Few' ? 1.2 : 1.4;
        
        const bathTilesNeeded = bathTotalArea * 11.11 * (1 + bathWastage) * specialCutsFactor;
        
        breakdown.materials.tiles = (materialPrices[bathQuality] / 1.44) * bathTilesNeeded;
        breakdown.materials.cement = materialPrices.cement * bathTotalArea * 0.045;
        breakdown.materials.tile_adhesive = bathTotalArea * 7 * 180;
        breakdown.materials.grout = bathTotalArea * 1.5 * 120;
        breakdown.materials.waterproofing = waterproofing * bathTotalArea * 350;
        breakdown.materials.sand = (bathTotalArea * 0.025) * materialPrices.sand / 1000;
        breakdown.materials.sealant = 450;
        
        breakdown.labour.tiler = labourRates[region].skilled * (bathTotalArea / 6) * specialCutsFactor;
        breakdown.labour.helper = labourRates[region].unskilled * (bathTotalArea / 10);
        breakdown.labour.waterproofing_labour = waterproofing * labourRates[region].skilled * 0.3;
        
        breakdown.equipment.tile_cutter = 300;
        breakdown.equipment.mixing_tools = 180;
        breakdown.equipment.waterproofing_tools = waterproofing * 250;
        
        const bathMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const bathLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const bathEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (bathMaterialTotal + bathLabourTotal + bathEquipmentTotal) * 0.12;
        breakdown.contingency = (bathMaterialTotal + bathLabourTotal + bathEquipmentTotal) * 0.10;
        breakdown.profit = (bathMaterialTotal + bathLabourTotal + bathEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((bathMaterialTotal + bathLabourTotal + bathEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor / bathTotalArea).toFixed(2),
          unit: 'KES/m²',
          quantity: bathTotalArea,
          breakdown: breakdown,
          totalCost: ((bathMaterialTotal + bathLabourTotal + bathEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor).toFixed(2)
        };

      case 'Painting - Emulsion':
        const paintArea = parseFloat(data.area);
        const coats = parseFloat(data.coats);
        const paintQuality = data.paint_quality === 'Economy' ? 'paint_economy' : data.paint_quality === 'Premium' ? 'paint_premium' : 'paint_standard';
        const surfaceCondition = data.surface_condition === 'New' ? 1.0 : data.surface_condition === 'Repaint-Good' ? 1.15 : 1.4;
        const colorFactor = data.color === 'White' ? 1.0 : data.color === 'Dark Colors' ? 1.15 : 1.05;
        const heightFactor = data.height === 'Standard' ? 1.0 : data.height === 'High' ? 1.25 : 1.5;
        
        const paintLitres = (paintArea * coats / 12) * surfaceCondition * colorFactor;
        const primerNeeded = data.surface_condition === 'New' || data.surface_condition === 'Repaint-Poor' ? paintArea / 14 : 0;
        
        breakdown.materials.paint = paintLitres * (materialPrices[paintQuality] / 4);
        breakdown.materials.primer = primerNeeded * 450;
        breakdown.materials.putty = data.surface_condition === 'Repaint-Poor' ? paintArea * 0.5 * 180 : paintArea * 0.2 * 180;
        breakdown.materials.sandpaper = 120;
        breakdown.materials.masking_tape = 180;
        
        breakdown.labour.painter = labourRates[region].skilled * (paintArea / 40) * coats * heightFactor;
        breakdown.labour.helper = labourRates[region].unskilled * (paintArea / 80) * heightFactor;
        
        breakdown.equipment.brushes_rollers = 350;
        breakdown.equipment.ladders = heightFactor > 1 ? 400 * heightFactor : 0;
        breakdown.equipment.scaffolding = heightFactor > 1.4 ? 800 : 0;
        breakdown.equipment.dropsheets = 150;
        
        const paintMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const paintLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const paintEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (paintMaterialTotal + paintLabourTotal + paintEquipmentTotal) * 0.10;
        breakdown.contingency = (paintMaterialTotal + paintLabourTotal + paintEquipmentTotal) * 0.08;
        breakdown.profit = (paintMaterialTotal + paintLabourTotal + paintEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((paintMaterialTotal + paintLabourTotal + paintEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor / paintArea).toFixed(2),
          unit: 'KES/m²',
          quantity: paintArea,
          breakdown: breakdown,
          totalCost: ((paintMaterialTotal + paintLabourTotal + paintEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor).toFixed(2)
        };

      case 'Sewer Pipe Laying':
        const pipeLength = parseFloat(data.length);
        const pipeDiameter = data.pipe_diameter;
        const pipeType = data.pipe_material === 'PVC' ? `pvc_pipe_${pipeDiameter}` : data.pipe_material;
        const trenchDepth = parseFloat(data.trench_depth);
        const soilFactor = data.soil_type === 'Soft' ? 1.0 : data.soil_type === 'Hard' ? 1.4 : 1.2;
        const beddingRequired = data.bedding_required === 'Yes' ? 1 : 0;
        
        const trenchVolume = pipeLength * 0.6 * trenchDepth;
        const beddingVolume = beddingRequired * pipeLength * 0.6 * 0.15;
        
        breakdown.materials.pipes = pipeLength * (materialPrices[pipeType] || 800);
        breakdown.materials.joints_fittings = pipeLength * 85;
        breakdown.materials.bedding_material = beddingVolume * materialPrices.ballast;
        breakdown.materials.backfill_select = trenchVolume * 0.3 * 1200;
        breakdown.materials.cement = beddingRequired * pipeLength * 0.1 * materialPrices.cement;
        breakdown.materials.testing_materials = 450;
        
        breakdown.labour.pipe_layer = labourRates[region].skilled * (pipeLength / 15) * soilFactor;
        breakdown.labour.excavator = labourRates[region].semiskilled * (pipeLength / 10) * soilFactor;
        breakdown.labour.helper = labourRates[region].unskilled * (pipeLength / 8);
        
        breakdown.equipment.excavation_tools = 350 * soilFactor;
        breakdown.equipment.laser_level = 500;
        breakdown.equipment.compaction = 450;
        breakdown.equipment.testing_equipment = 380;
        
        const pipeMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const pipeLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const pipeEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (pipeMaterialTotal + pipeLabourTotal + pipeEquipmentTotal) * 0.12;
        breakdown.contingency = (pipeMaterialTotal + pipeLabourTotal + pipeEquipmentTotal) * 0.10;
        breakdown.profit = (pipeMaterialTotal + pipeLabourTotal + pipeEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((pipeMaterialTotal + pipeLabourTotal + pipeEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor / pipeLength).toFixed(2),
          unit: 'KES/m',
          quantity: pipeLength,
          breakdown: breakdown,
          totalCost: ((pipeMaterialTotal + pipeLabourTotal + pipeEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor).toFixed(2)
        };

      case 'Manhole Construction':
        const manholeDepth = parseFloat(data.depth);
        const manholeType = data.manhole_type;
        const diameter = parseFloat(data.diameter) / 1000;
        const coverType = data.cover_type;
        const depthFactor = manholeDepth > 3 ? 1.3 : manholeDepth > 2 ? 1.15 : 1.0;
        const excavationCondition = data.excavation_condition === 'Dry' ? 1.0 : data.excavation_condition === 'Wet' ? 1.3 : 1.5;
        const benchin = data.benching_required === 'Yes' ? 1 : 0;
        
        const wallVolume = Math.PI * diameter * 0.15 * manholeDepth;
        const baseVolume = Math.PI * Math.pow(diameter / 2, 2) * 0.15;
        const brickCount = Math.PI * diameter * manholeDepth * 70;
        
        breakdown.materials.cement = (wallVolume + baseVolume) * 8 * materialPrices.cement;
        breakdown.materials.sand = (wallVolume + baseVolume) * 0.6 * materialPrices.sand;
        breakdown.materials.ballast = baseVolume * 1.2 * materialPrices.ballast;
        breakdown.materials.bricks = brickCount * 15;
        breakdown.materials.manhole_cover = coverType === 'Light' ? 3500 : coverType === 'Heavy Duty' ? 8500 : 5500;
        breakdown.materials.step_irons = Math.ceil(manholeDepth / 0.3) * 850;
        breakdown.materials.benching = benching * diameter * 1.5 * materialPrices.cement;
        breakdown.materials.waterproofing = manholeDepth * diameter * 380;
        
        breakdown.labour.mason = labourRates[region].skilled * manholeDepth * 2 * depthFactor;
        breakdown.labour.excavator = labourRates[region].semiskilled * manholeDepth * 1.5 * excavationCondition;
        breakdown.labour.helper = labourRates[region].unskilled * manholeDepth * 2;
        breakdown.labour.concrete_work = labourRates[region].skilled * 0.8;
        
        breakdown.equipment.excavation = 650 * excavationCondition;
        breakdown.equipment.concrete_mixer = 550;
        breakdown.equipment.dewatering = data.excavation_condition === 'Wet' ? 1200 : 0;
        breakdown.equipment.lifting = 450;
        
        const manholeMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const manholeLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const manholeEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (manholeMaterialTotal + manholeLabourTotal + manholeEquipmentTotal) * 0.12;
        breakdown.contingency = (manholeMaterialTotal + manholeLabourTotal + manholeEquipmentTotal) * 0.10;
        breakdown.profit = (manholeMaterialTotal + manholeLabourTotal + manholeEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((manholeMaterialTotal + manholeLabourTotal + manholeEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor).toFixed(2),
          unit: 'KES/Nr',
          quantity: 1,
          breakdown: breakdown,
          totalCost: ((manholeMaterialTotal + manholeLabourTotal + manholeEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor).toFixed(2)
        };

      case 'Block Walling':
        const wallArea = parseFloat(data.area);
        const blockSize = data.block_size;
        const wallHeight = parseFloat(data.wall_height);
        const mortarRatio = data.mortar_ratio;
        const reinforcement = data.reinforcement;
        const fairFace = data.finish === 'Fair Face' ? 1.15 : 1.0;
        
        const blocksPerSqm = blockSize === '4 inch' ? 12.5 : blockSize === '6 inch' ? 12.5 : blockSize === '8 inch' ? 12.5 : 10;
        const blockPrice = blockSize === '4 inch' ? materialPrices.blocks_4 : blockSize === '6 inch' ? materialPrices.blocks_6 : materialPrices.blocks_8;
        const mortarCement = wallArea * 0.022 * (mortarRatio === '1:4' ? 1.1 : mortarRatio === '1:5' ? 1.0 : 0.9);
        
        breakdown.materials.blocks = wallArea * blocksPerSqm * blockPrice * 1.05;
        breakdown.materials.cement = mortarCement * materialPrices.cement;
        breakdown.materials.sand = wallArea * 0.025 * materialPrices.sand;
        
        if(reinforcement !== 'None') {
          const reinforcementFactor = reinforcement === 'Both' ? 2.5 : reinforcement === 'Vertical' ? 1.8 : 1.2;
          breakdown.materials.reinforcement = wallHeight * 2 * materialPrices.reinforcement * reinforcementFactor;
        }
        
        breakdown.labour.mason = labourRates[region].skilled * (wallArea / 10) * fairFace;
        breakdown.labour.helper = labourRates[region].unskilled * (wallArea / 15);
        
        breakdown.equipment.mixer = 450;
        breakdown.equipment.scaffolding = wallHeight > 2.4 ? 800 : 0;
        breakdown.equipment.tools = 280;
        
        const blockMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const blockLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const blockEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (blockMaterialTotal + blockLabourTotal + blockEquipmentTotal) * 0.10;
        breakdown.contingency = (blockMaterialTotal + blockLabourTotal + blockEquipmentTotal) * 0.08;
        breakdown.profit = (blockMaterialTotal + blockLabourTotal + blockEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((blockMaterialTotal + blockLabourTotal + blockEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor / wallArea).toFixed(2),
          unit: 'KES/m²',
          quantity: wallArea,
          breakdown: breakdown,
          totalCost: ((blockMaterialTotal + blockLabourTotal + blockEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor).toFixed(2)
        };

      case 'Mass Concrete Foundation':
        const concreteVolume = parseFloat(data.volume);
        const grade = data.concrete_grade;
        const foundationDepth = parseFloat(data.foundation_depth);
        const pourMethod = data.pour_method;
        const accessDifficulty = data.access_difficulty === 'Easy' ? 1.0 : data.access_difficulty === 'Difficult' ? 1.35 : 1.18;
        
        const cementRatio = grade === 'C15' ? 5.5 : grade === 'C20' ? 6.5 : grade === 'C25' ? 7.5 : 8.5;
        const readyMixPremium = pourMethod === 'Ready Mix' ? 1.25 : pourMethod === 'Concrete Pump' ? 1.4 : 1.0;
        
        breakdown.materials.cement = concreteVolume * cementRatio * materialPrices.cement * readyMixPremium;
        breakdown.materials.sand = concreteVolume * 0.45 * materialPrices.sand;
        breakdown.materials.ballast = concreteVolume * 0.9 * materialPrices.ballast;
        breakdown.materials.water = concreteVolume * 50;
        breakdown.materials.curing_membrane = concreteVolume * 2.5 * 180;
        
        breakdown.labour.skilled = labourRates[region].skilled * concreteVolume * 0.8;
        breakdown.labour.semiskilled = labourRates[region].semiskilled * concreteVolume * 1.2;
        breakdown.labour.unskilled = labourRates[region].unskilled * concreteVolume * 1.5;
        
        breakdown.equipment.mixer = pourMethod === 'Manual' ? 650 : 0;
        breakdown.equipment.vibrator = 550;
        breakdown.equipment.pump = pourMethod === 'Concrete Pump' ? 12000 : 0;
        breakdown.equipment.tools = 450;
        
        const concreteMaterialTotal = Object.values(breakdown.materials).reduce((a, b) => a + b, 0);
        const concreteLabourTotal = Object.values(breakdown.labour).reduce((a, b) => a + b, 0);
        const concreteEquipmentTotal = Object.values(breakdown.equipment).reduce((a, b) => a + b, 0);
        
        breakdown.overhead = (concreteMaterialTotal + concreteLabourTotal + concreteEquipmentTotal) * 0.12;
        breakdown.contingency = (concreteMaterialTotal + concreteLabourTotal + concreteEquipmentTotal) * 0.10;
        breakdown.profit = (concreteMaterialTotal + concreteLabourTotal + concreteEquipmentTotal) * 0.15;
        
        return {
          unitRate: ((concreteMaterialTotal + concreteLabourTotal + concreteEquipmentTotal + 
                     breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * accessDifficulty / concreteVolume).toFixed(2),
          unit: 'KES/m³',
          quantity: concreteVolume,
          breakdown: breakdown,
          totalCost: ((concreteMaterialTotal + concreteLabourTotal + concreteEquipmentTotal + 
                      breakdown.overhead + breakdown.contingency + breakdown.profit) * regionFactor * accessDifficulty).toFixed(2)
        };

      default:
        return null;
    }
  };

  const handleInputChange = (name, value) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleCalculate = () => {
    const result = calculateUnitRate(selectedWork, inputs);
    setResult(result);
  };

  const generateReport = () => {
    if (!result) return;
    
    const reportContent = `
CONSTRUCTION UNIT RATE REPORT
=====================================

Project: ${selectedWork}
Date: ${new Date().toLocaleDateString()}
Region: ${inputs.region || 'N/A'}

QUANTITY & UNIT RATE
-------------------------------------
Quantity: ${result.quantity} ${result.unit.split('/')[1]}
Unit Rate: ${result.unitRate} ${result.unit}
Total Cost: KES ${result.totalCost}

COST BREAKDOWN
-------------------------------------

MATERIALS:
${Object.entries(result.breakdown.materials).map(([key, value]) => 
  `  ${key.replace(/_/g, ' ').toUpperCase()}: KES ${value.toFixed(2)}`
).join('\n')}

LABOUR:
${Object.entries(result.breakdown.labour).map(([key, value]) => 
  `  ${key.replace(/_/g, ' ').toUpperCase()}: KES ${value.toFixed(2)}`
).join('\n')}

EQUIPMENT:
${Object.entries(result.breakdown.equipment).map(([key, value]) => 
  `  ${key.replace(/_/g, ' ').toUpperCase()}: KES ${value.toFixed(2)}`
).join('\n')}

OTHER COSTS:
  OVERHEAD (10-12%): KES ${result.breakdown.overhead.toFixed(2)}
  CONTINGENCY (8-10%): KES ${result.breakdown.contingency.toFixed(2)}
  PROFIT (12-15%): KES ${result.breakdown.profit.toFixed(2)}

=====================================
Generated by Construction Calculator
`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedWork.replace(/ /g, '_')}_UnitRate_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentInputs = selectedWork ? workInputs[selectedWork] || [] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="w-10 h-10 text-gray-700 dark:text-gray-300" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Kenya Construction Unit Rate Calculator
              </h1>
              <p className="text-gray-600 dark:text-gray-400">CSMM & SMM Compliant</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Select Work Category</h3>
              <div className="space-y-2">
                {Object.entries(workCategories).map(([key, category]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      {category.icon}
                      <span>{category.name}</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {category.items.map(item => (
                        <button
                          key={item}
                          onClick={() => {
                            setSelectedWork(item);
                            setInputs({});
                            setResult(null);
                          }}
                          className={`w-full text-left px-4 py-2 rounded transition-colors ${
                            selectedWork === item
                              ? 'bg-gray-700 dark:bg-gray-600 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          } border border-gray-300 dark:border-gray-600`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              {selectedWork ? (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-xl">
                    {selectedWork} - Input Parameters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {currentInputs.map(input => (
                      <div key={input.name}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {input.label}
                          {input.required && <span className="text-red-500">*</span>}
                        </label>
                        {input.type === 'select' ? (
                          <select
                            value={inputs[input.name] || ''}
                            onChange={(e) => handleInputChange(input.name, e.target.value)}
                            className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-500"
                          >
                            <option value="">Select...</option>
                            {input.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={input.type}
                            value={inputs[input.name] || ''}
                            onChange={(e) => handleInputChange(input.name, e.target.value)}
                            className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-500"
                            step="0.01"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleCalculate}
                    className="w-full bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-5 h-5" />
                    Calculate Unit Rate
                  </button>

                  {result && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">Calculation Results</h4>
                        <button
                          onClick={generateReport}
                          className="bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Export Report
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unit Rate</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.unitRate}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{result.unit}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Quantity</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.quantity}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{result.unit.split('/')[1]}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Cost</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">KES {result.totalCost}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">All inclusive</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Materials Cost Breakdown
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(result.breakdown.materials).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">KES {value.toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900 dark:text-gray-100">Materials Total</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  KES {Object.values(result.breakdown.materials).reduce((a, b) => a + b, 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            Labour Cost Breakdown
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(result.breakdown.labour).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">KES {value.toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900 dark:text-gray-100">Labour Total</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  KES {Object.values(result.breakdown.labour).reduce((a, b) => a + b, 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Equipment & Tools
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(result.breakdown.equipment).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">KES {value.toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900 dark:text-gray-100">Equipment Total</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  KES {Object.values(result.breakdown.equipment).reduce((a, b) => a + b, 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Additional Costs
                          </h5>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Overhead (10-12%)</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">KES {result.breakdown.overhead.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Contingency (8-10%)</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">KES {result.breakdown.contingency.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Profit (12-15%)</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">KES {result.breakdown.profit.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Select a work item from the left to begin</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">About This Calculator</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Standards Compliance</h4>
              <p>Calculations based on CSMM (Civil Standard Method of Measurement) and SMM (Standard Method of Measurement) for Kenya construction industry.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Regional Pricing</h4>
              <p>Accounts for regional variations in material and labour costs across Nairobi, Coast, and Western regions with realistic market prices.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Field-Ready</h4>
              <p>Incorporates practical factors like wastage, site conditions, access difficulty, and method of work for accurate field estimates.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConstructionCalculator;
                      
        