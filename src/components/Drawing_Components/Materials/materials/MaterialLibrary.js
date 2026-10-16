import * as THREE from 'three';

const rgb = (r,g,b) => new THREE.Color(r/255, g/255, b/255);
const std = (p) => ({ type: 'MeshStandardMaterial', ...p });
const phy = (p) => ({ type: 'MeshPhysicalMaterial', ...p });

export function makeNoiseTexture(size=256, mean=128, variance=30) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i=0; i<img.data.length; i+=4) {
    const v = Math.max(0,Math.min(255, mean + (Math.random()-0.5)*variance*2));
    img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const MasonryConcrete = {
  concrete_smooth:           std({ color:rgb(180,178,172), roughness:0.60, metalness:0.0, _category:'Concrete',  _label:'Smooth Concrete' }),
  concrete_exposed_aggregate:std({ color:rgb(160,155,145), roughness:0.85, metalness:0.0, _category:'Concrete',  _label:'Exposed Aggregate' }),
  concrete_board_marked:     std({ color:rgb(168,163,155), roughness:0.75, metalness:0.0, _category:'Concrete',  _label:'Board-Marked Concrete', _procedural:'concrete' }),
  concrete_polished:         std({ color:rgb(200,198,194), roughness:0.10, metalness:0.05,_category:'Concrete',  _label:'Polished Concrete' }),
  concrete_bush_hammered:    std({ color:rgb(155,150,142), roughness:0.95, metalness:0.0, _category:'Concrete',  _label:'Bush-Hammered Concrete' }),
  brick_clay_red:            std({ color:rgb(178,85,55),   roughness:0.88, metalness:0.0, _category:'Brick',     _label:'Red Clay Brick',    _procedural:'brick', _brickColor:[0.70,0.33,0.21], _mortarColor:[0.75,0.73,0.70] }),
  brick_clay_buff:           std({ color:rgb(210,185,145), roughness:0.85, metalness:0.0, _category:'Brick',     _label:'Buff Clay Brick',   _procedural:'brick', _brickColor:[0.82,0.73,0.57], _mortarColor:[0.80,0.78,0.74] }),
  brick_engineering:         std({ color:rgb(100,45,35),   roughness:0.70, metalness:0.0, _category:'Brick',     _label:'Engineering Brick', _procedural:'brick', _brickColor:[0.39,0.18,0.14], _mortarColor:[0.60,0.58,0.55] }),
  brick_glazed:              phy({ color:rgb(210,200,195), roughness:0.08, metalness:0.0, clearcoat:0.9, clearcoatRoughness:0.05, _category:'Brick', _label:'Glazed Brick' }),
  block_hollow_concrete:     std({ color:rgb(185,182,176), roughness:0.90, metalness:0.0, _category:'Blockwork', _label:'Hollow Concrete Block' }),
  block_aac:                 std({ color:rgb(220,218,215), roughness:0.85, metalness:0.0, _category:'Blockwork', _label:'AAC / Thermalite Block' }),
  stone_granite:             std({ color:rgb(135,120,115), roughness:0.50, metalness:0.02,_category:'Stone',     _label:'Granite' }),
  stone_limestone:           std({ color:rgb(220,210,190), roughness:0.78, metalness:0.0, _category:'Stone',     _label:'Limestone' }),
  stone_sandstone:           std({ color:rgb(210,185,145), roughness:0.85, metalness:0.0, _category:'Stone',     _label:'Sandstone' }),
  stone_slate:               std({ color:rgb(75,78,82),    roughness:0.70, metalness:0.02,_category:'Stone',     _label:'Slate' }),
  stone_marble:              phy({ color:rgb(240,238,235), roughness:0.05, metalness:0.0, clearcoat:0.6, clearcoatRoughness:0.02, _category:'Stone', _label:'Marble (Polished)' }),
};

export const Metals = {
  steel_hot_rolled:          std({ color:rgb(80,78,75),    roughness:0.60, metalness:0.95, _category:'Steel',     _label:'Hot-Rolled Mill Finish' }),
  steel_galvanized:          std({ color:rgb(185,188,190), roughness:0.40, metalness:0.90, _category:'Steel',     _label:'Galvanized Steel' }),
  steel_painted_ral9005:     std({ color:rgb(14,14,16),    roughness:0.50, metalness:0.10, _category:'Steel',     _label:'Painted Steel RAL9005 Black' }),
  steel_painted_ral3000:     std({ color:rgb(168,44,24),   roughness:0.50, metalness:0.10, _category:'Steel',     _label:'Painted Steel RAL3000 Red' }),
  steel_corten:              std({ color:rgb(140,75,35),   roughness:0.85, metalness:0.70, _category:'Steel',     _label:'Weathering Steel (Corten)' }),
  steel_stainless_brushed:   std({ color:rgb(185,182,178), roughness:0.35, metalness:1.00, _category:'Steel',     _label:'Stainless – Brushed' }),
  steel_stainless_polished:  phy({ color:rgb(200,198,195), roughness:0.02, metalness:1.00, reflectivity:1.0, _category:'Steel', _label:'Stainless – Polished' }),
  aluminum_anodized_silver:  std({ color:rgb(190,190,190), roughness:0.30, metalness:0.90, _category:'Aluminium', _label:'Anodised Silver' }),
  aluminum_anodized_bronze:  std({ color:rgb(120,90,60),   roughness:0.35, metalness:0.85, _category:'Aluminium', _label:'Anodised Bronze' }),
  aluminum_anodized_black:   std({ color:rgb(25,25,28),    roughness:0.30, metalness:0.85, _category:'Aluminium', _label:'Anodised Black' }),
  aluminum_powder_coated:    std({ color:rgb(200,198,195), roughness:0.60, metalness:0.05, _category:'Aluminium', _label:'Powder-Coated Aluminium' }),
  copper_new:                phy({ color:rgb(185,110,60),  roughness:0.30, metalness:1.00, _category:'Copper',    _label:'Copper – New Bright' }),
  copper_oxidised:           phy({ color:rgb(80,130,115),  roughness:0.60, metalness:0.50, _category:'Copper',    _label:'Copper – Aged Patina' }),
  copper_brown:              phy({ color:rgb(115,68,40),   roughness:0.50, metalness:0.75, _category:'Copper',    _label:'Copper – Brown Oxidised' }),
  zinc_blue_grey:            std({ color:rgb(160,165,170), roughness:0.55, metalness:0.70, _category:'Zinc',      _label:'Zinc – Blue-Grey' }),
  zinc_pre_patinated:        std({ color:rgb(140,148,152), roughness:0.65, metalness:0.60, _category:'Zinc',      _label:'Zinc – Pre-Patinated' }),
};

export const Glazing = {
  glass_clear:      phy({ color:rgb(240,250,255), roughness:0.00, metalness:0.0, transmission:0.95, thickness:0.006, ior:1.52, transparent:true, opacity:0.15, _category:'Glazing', _label:'Clear Float Glass' }),
  glass_lowe:       phy({ color:rgb(210,230,235), roughness:0.03, metalness:0.0, transmission:0.82, thickness:0.006, ior:1.52, transparent:true, opacity:0.25, _category:'Glazing', _label:'Low-E Coated Glass' }),
  glass_tinted_bronze:phy({ color:rgb(180,150,110),roughness:0.02,metalness:0.0, transmission:0.65, thickness:0.006, ior:1.52, transparent:true, opacity:0.40, _category:'Glazing', _label:'Bronze Tinted Glass' }),
  glass_tinted_grey:phy({ color:rgb(140,148,155), roughness:0.02, metalness:0.0, transmission:0.60, thickness:0.006, ior:1.52, transparent:true, opacity:0.45, _category:'Glazing', _label:'Grey Tinted Glass' }),
  glass_tinted_blue:phy({ color:rgb(100,155,200), roughness:0.02, metalness:0.0, transmission:0.60, thickness:0.006, ior:1.52, transparent:true, opacity:0.40, _category:'Glazing', _label:'Blue Tinted Glass' }),
  glass_frosted:    phy({ color:rgb(240,245,248), roughness:0.40, metalness:0.0, transmission:0.60, thickness:0.006, ior:1.52, transparent:true, opacity:0.55, _category:'Glazing', _label:'Frosted / Etched Glass' }),
  glass_reflective: phy({ color:rgb(200,215,225), roughness:0.00, metalness:0.5, transmission:0.30, thickness:0.006, ior:1.52, envMapIntensity:2.5, transparent:true, opacity:0.55, _category:'Glazing', _label:'Reflective One-Way Mirror' }),
  glass_laminated:  phy({ color:rgb(220,240,228), roughness:0.02, metalness:0.0, transmission:0.88, thickness:0.012, ior:1.52, transparent:true, opacity:0.20, _category:'Glazing', _label:'Laminated Safety Glass' }),
};

export const Timber = {
  timber_pine:      std({ color:rgb(215,185,130), roughness:0.75, metalness:0.0, _category:'Timber',    _label:'Pine (Softwood)',      _procedural:'timber', _woodLight:[0.85,0.73,0.51], _woodDark:[0.62,0.46,0.28], _grainScale:8,  _ringFrequency:12 }),
  timber_oak:       std({ color:rgb(170,130,80),  roughness:0.70, metalness:0.0, _category:'Timber',    _label:'Oak (Hardwood)',       _procedural:'timber', _woodLight:[0.70,0.54,0.33], _woodDark:[0.45,0.32,0.16], _grainScale:10, _ringFrequency:8  }),
  timber_walnut:    std({ color:rgb(100,68,42),   roughness:0.60, metalness:0.0, _category:'Timber',    _label:'Walnut (Hardwood)',    _procedural:'timber', _woodLight:[0.47,0.33,0.20], _woodDark:[0.25,0.15,0.08], _grainScale:10, _ringFrequency:6  }),
  timber_teak:      std({ color:rgb(155,110,60),  roughness:0.65, metalness:0.0, _category:'Timber',    _label:'Teak (Hardwood)',      _procedural:'timber', _woodLight:[0.68,0.50,0.30], _woodDark:[0.42,0.28,0.12], _grainScale:9,  _ringFrequency:10 }),
  timber_iroko:     std({ color:rgb(140,100,55),  roughness:0.65, metalness:0.0, _category:'Timber',    _label:'Iroko (Hardwood)',     _procedural:'timber', _woodLight:[0.60,0.44,0.25], _woodDark:[0.38,0.24,0.10], _grainScale:9,  _ringFrequency:9  }),
  timber_plywood:   std({ color:rgb(195,170,125), roughness:0.80, metalness:0.0, _category:'Composite', _label:'Plywood' }),
  timber_osb:       std({ color:rgb(190,160,100), roughness:0.90, metalness:0.0, _category:'Composite', _label:'OSB Board' }),
  timber_mdf_painted:std({ color:rgb(248,246,244),roughness:0.40, metalness:0.0, _category:'Composite', _label:'MDF Painted' }),
  timber_cedar_shingles:std({ color:rgb(158,128,90),roughness:0.90,metalness:0.0, _category:'Cladding',  _label:'Cedar Shingles' }),
  timber_composite_decking:std({ color:rgb(120,90,65),roughness:0.80,metalness:0.0, _category:'Decking',   _label:'Composite Decking' }),
};

export const Finishes = {
  paint_flat_white:       std({ color:rgb(248,248,248), roughness:0.95, metalness:0.0, _category:'Paint',    _label:'Flat White Paint' }),
  paint_eggshell_white:   std({ color:rgb(245,244,241), roughness:0.60, metalness:0.0, _category:'Paint',    _label:'Eggshell White Paint' }),
  paint_gloss_black:      phy({ color:rgb(10,10,12),    roughness:0.05, metalness:0.0, clearcoat:1.0, clearcoatRoughness:0.02, _category:'Paint', _label:'Gloss Black Paint' }),
  render_smooth:          std({ color:rgb(225,222,218), roughness:0.65, metalness:0.0, _category:'Render',   _label:'Smooth Render' }),
  render_rough_cast:      std({ color:rgb(210,206,198), roughness:0.90, metalness:0.0, _category:'Render',   _label:'Rough-Cast Render' }),
  tile_ceramic_white:     phy({ color:rgb(248,248,246), roughness:0.08, metalness:0.0, clearcoat:0.8, clearcoatRoughness:0.05, _category:'Tiles', _label:'White Ceramic Tile' }),
  tile_porcelain_grey:    phy({ color:rgb(170,170,168), roughness:0.10, metalness:0.0, clearcoat:0.7, clearcoatRoughness:0.06, _category:'Tiles', _label:'Grey Porcelain Tile' }),
  roofing_clay_tile:      std({ color:rgb(165,80,50),   roughness:0.88, metalness:0.0, _category:'Roofing',  _label:'Clay Roof Tile' }),
  roofing_metal_standing_seam:std({ color:rgb(80,85,90), roughness:0.50, metalness:0.80, _category:'Roofing', _label:'Metal Standing Seam' }),
  roofing_green_roof:     std({ color:rgb(85,115,60),   roughness:0.95, metalness:0.0, _category:'Roofing',  _label:'Green Roof' }),
  flooring_hardwood:      std({ color:rgb(165,120,70),  roughness:0.30, metalness:0.0, _category:'Flooring', _label:'Hardwood Floor', _procedural:'timber', _woodLight:[0.72,0.55,0.34], _woodDark:[0.48,0.32,0.16], _grainScale:15, _ringFrequency:5 }),
  flooring_carpet_grey:   std({ color:rgb(160,158,158), roughness:0.99, metalness:0.0, _category:'Flooring', _label:'Grey Carpet' }),
  flooring_vinyl:         std({ color:rgb(200,195,188), roughness:0.45, metalness:0.0, _category:'Flooring', _label:'Vinyl Flooring' }),
};

export const MaterialLibrary = {
  ...MasonryConcrete, ...Metals, ...Glazing, ...Timber, ...Finishes,
};

export const CATEGORIES = [
  'All','Concrete','Brick','Blockwork','Stone',
  'Steel','Aluminium','Copper','Zinc','Glazing',
  'Timber','Composite','Cladding','Decking',
  'Paint','Render','Tiles','Flooring','Roofing',
];

export default MaterialLibrary;
