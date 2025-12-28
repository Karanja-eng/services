import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Line,
  Text,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Settings,
  Save,
  Upload,
  Download,
} from "lucide-react";
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';

// Roof 3D Viewer Component
function RoofStructure({ config }) {
  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  const {
    roofType,
    buildingLength,
    buildingWidth,
    wallThickness,
    overhang,
    pitchAngle,
    trussSpacing,
    rafterSpacing,
    wallPlateSize,
    rafterSize,
    tieBeamSize,
    ridgeSize,
    material,
    covering,
  } = config;

  // Calculate key dimensions
  const pitch = (pitchAngle * Math.PI) / 180;
  const effectiveSpan = buildingWidth + 2 * wallThickness + 2 * overhang;
  const halfSpan = effectiveSpan / 2;
  const roofHeight = halfSpan * Math.tan(pitch);
  const rafterLength = halfSpan / Math.cos(pitch);
  const effectiveLength = buildingLength + 2 * wallThickness + 2 * overhang;

  // Color schemes based on material
  const colors = {
    timber: {
      wallPlate: "#8B4513",
      rafter: "#A0522D",
      tieBeam: "#8B4513",
      ridge: "#654321",
      purlin: "#8B7355",
      strut: "#A0522D",
    },
    steel: {
      wallPlate: "#708090",
      rafter: "#778899",
      tieBeam: "#696969",
      ridge: "#556B2F",
      purlin: "#808080",
      strut: "#696969",
    },
  };

  const currentColors = colors[material] || colors.timber;

  // Covering colors
  const coveringColors = {
    tiles: "#CD5C5C",
    acSheets: "#C0C0C0",
    giSheets: "#B0C4DE",
    slate: "#708090",
    thatch: "#D2B48C",
  };

  // Number of trusses
  const numTrusses = Math.floor(buildingLength / trussSpacing) + 1;
  const numRafters = Math.floor(buildingLength / rafterSpacing) + 1;

  // Render wall plates
  const renderWallPlates = () => {
    const plates = [];
    const wpHeight = wallPlateSize[1];
    const wpWidth = wallPlateSize[0];

    // Long walls
    plates.push(
      <mesh key="wp-left" position={[0, wpHeight / 2, -effectiveSpan / 2]}>
        <boxGeometry args={[effectiveLength, wpHeight, wpWidth]} />
        <meshStandardMaterial color={currentColors.wallPlate} />
      </mesh>
    );

    plates.push(
      <mesh key="wp-right" position={[0, wpHeight / 2, effectiveSpan / 2]}>
        <boxGeometry args={[effectiveLength, wpHeight, wpWidth]} />
        <meshStandardMaterial color={currentColors.wallPlate} />
      </mesh>
    );

    return plates;
  };

  // Render trusses
  const renderTrusses = () => {
    const trusses = [];
    const startX = -(buildingLength / 2);

    for (let i = 0; i < numTrusses; i++) {
      const xPos = startX + i * trussSpacing;

      // Left rafter
      const leftRafterAngle = pitch;
      const leftRafterMidX = xPos;
      const leftRafterMidY = roofHeight / 2;
      const leftRafterMidZ = -halfSpan / 2;

      trusses.push(
        <mesh
          key={`truss-${i}-left`}
          position={[leftRafterMidX, leftRafterMidY, leftRafterMidZ]}
          rotation={[0, 0, -leftRafterAngle]}
        >
          <boxGeometry args={[rafterSize[0], rafterLength, rafterSize[1]]} />
          <meshStandardMaterial color={currentColors.rafter} />
        </mesh>
      );

      // Right rafter
      trusses.push(
        <mesh
          key={`truss-${i}-right`}
          position={[leftRafterMidX, leftRafterMidY, halfSpan / 2]}
          rotation={[0, 0, leftRafterAngle]}
        >
          <boxGeometry args={[rafterSize[0], rafterLength, rafterSize[1]]} />
          <meshStandardMaterial color={currentColors.rafter} />
        </mesh>
      );

      // Tie beam
      trusses.push(
        <mesh key={`tie-${i}`} position={[xPos, tieBeamSize[1] / 2, 0]}>
          <boxGeometry args={[tieBeamSize[0], tieBeamSize[1], effectiveSpan]} />
          <meshStandardMaterial color={currentColors.tieBeam} />
        </mesh>
      );

      // Vertical strut (king post for spans < 8m)
      if (effectiveSpan < 8) {
        const strutHeight = roofHeight - tieBeamSize[1];
        trusses.push(
          <mesh
            key={`strut-${i}`}
            position={[xPos, tieBeamSize[1] + strutHeight / 2, 0]}
          >
            <boxGeometry args={[0.1, strutHeight, 0.05]} />
            <meshStandardMaterial color={currentColors.strut} />
          </mesh>
        );
      } else {
        // Queen posts for larger spans
        const strutHeight = roofHeight * 0.6;
        const strutOffset = effectiveSpan / 4;

        trusses.push(
          <mesh
            key={`strut-${i}-left`}
            position={[xPos, tieBeamSize[1] + strutHeight / 2, -strutOffset]}
          >
            <boxGeometry args={[0.1, strutHeight, 0.05]} />
            <meshStandardMaterial color={currentColors.strut} />
          </mesh>
        );

        trusses.push(
          <mesh
            key={`strut-${i}-right`}
            position={[xPos, tieBeamSize[1] + strutHeight / 2, strutOffset]}
          >
            <boxGeometry args={[0.1, strutHeight, 0.05]} />
            <meshStandardMaterial color={currentColors.strut} />
          </mesh>
        );
      }
    }

    return trusses;
  };

  // Render common rafters (between trusses)
  const renderCommonRafters = () => {
    const rafters = [];
    const startX = -(buildingLength / 2);

    for (let i = 0; i < numRafters; i++) {
      const xPos = startX + i * rafterSpacing;

      // Skip if it's a truss position
      const isTrussPosition = Math.abs((xPos - startX) % trussSpacing) < 0.01;
      if (isTrussPosition) continue;

      // Left rafter
      rafters.push(
        <mesh
          key={`rafter-${i}-left`}
          position={[xPos, roofHeight / 2, -halfSpan / 2]}
          rotation={[0, 0, -pitch]}
        >
          <boxGeometry args={[rafterSize[0], rafterLength, rafterSize[1]]} />
          <meshStandardMaterial
            color={currentColors.rafter}
            opacity={0.8}
            transparent
          />
        </mesh>
      );

      // Right rafter
      rafters.push(
        <mesh
          key={`rafter-${i}-right`}
          position={[xPos, roofHeight / 2, halfSpan / 2]}
          rotation={[0, 0, pitch]}
        >
          <boxGeometry args={[rafterSize[0], rafterLength, rafterSize[1]]} />
          <meshStandardMaterial
            color={currentColors.rafter}
            opacity={0.8}
            transparent
          />
        </mesh>
      );
    }

    return rafters;
  };

  // Render ridge board
  const renderRidge = () => {
    return (
      <mesh position={[0, roofHeight, 0]}>
        <boxGeometry args={[effectiveLength, ridgeSize[1], ridgeSize[0]]} />
        <meshStandardMaterial color={currentColors.ridge} />
      </mesh>
    );
  };

  // Render purlins
  const renderPurlins = () => {
    const purlins = [];
    const purlinHeight = roofHeight * 0.5;
    const purlinZ = halfSpan * 0.5;

    // Left side purlins
    purlins.push(
      <mesh key="purlin-left" position={[0, purlinHeight, -purlinZ]}>
        <boxGeometry args={[effectiveLength, 0.075, 0.075]} />
        <meshStandardMaterial color={currentColors.purlin} />
      </mesh>
    );

    // Right side purlins
    purlins.push(
      <mesh key="purlin-right" position={[0, purlinHeight, purlinZ]}>
        <boxGeometry args={[effectiveLength, 0.075, 0.075]} />
        <meshStandardMaterial color={currentColors.purlin} />
      </mesh>
    );

    return purlins;
  };

  // Render roof covering
  const renderCovering = () => {
    if (!covering || covering === "none") return null;

    const coveringGeometry = new THREE.Shape();
    coveringGeometry.moveTo(-effectiveLength / 2, 0);
    coveringGeometry.lineTo(effectiveLength / 2, 0);
    coveringGeometry.lineTo(effectiveLength / 2, rafterLength);
    coveringGeometry.lineTo(-effectiveLength / 2, rafterLength);
    coveringGeometry.lineTo(-effectiveLength / 2, 0);

    const coverColor = coveringColors[covering] || "#C0C0C0";

    return (
      <>
        {/* Left side covering */}
        <mesh
          position={[0, roofHeight / 2, -halfSpan / 2]}
          rotation={[0, 0, -pitch]}
        >
          <boxGeometry args={[effectiveLength, rafterLength, 0.01]} />
          <meshStandardMaterial
            color={coverColor}
            side={THREE.DoubleSide}
            opacity={0.9}
            transparent
          />
        </mesh>

        {/* Right side covering */}
        <mesh
          position={[0, roofHeight / 2, halfSpan / 2]}
          rotation={[0, 0, pitch]}
        >
          <boxGeometry args={[effectiveLength, rafterLength, 0.01]} />
          <meshStandardMaterial
            color={coverColor}
            side={THREE.DoubleSide}
            opacity={0.9}
            transparent
          />
        </mesh>
      </>
    );
  };

  // Render hips for hipped roof
  const renderHips = () => {
    if (roofType !== "hipped") return null;

    const hips = [];
    const hipLength =
      Math.sqrt(
        Math.pow(effectiveLength / 2, 2) + Math.pow(effectiveSpan / 2, 2)
      ) / Math.cos(pitch);

    const hipAngle = Math.atan(effectiveLength / effectiveSpan);

    // Front left hip
    hips.push(
      <mesh
        key="hip-fl"
        position={[-effectiveLength / 4, roofHeight / 2, -effectiveSpan / 4]}
        rotation={[hipAngle, 0, -pitch]}
      >
        <boxGeometry args={[0.1, hipLength, 0.1]} />
        <meshStandardMaterial color={currentColors.ridge} />
      </mesh>
    );

    // Front right hip
    hips.push(
      <mesh
        key="hip-fr"
        position={[-effectiveLength / 4, roofHeight / 2, effectiveSpan / 4]}
        rotation={[-hipAngle, 0, pitch]}
      >
        <boxGeometry args={[0.1, hipLength, 0.1]} />
        <meshStandardMaterial color={currentColors.ridge} />
      </mesh>
    );

    // Back left hip
    hips.push(
      <mesh
        key="hip-bl"
        position={[effectiveLength / 4, roofHeight / 2, -effectiveSpan / 4]}
        rotation={[-hipAngle, 0, -pitch]}
      >
        <boxGeometry args={[0.1, hipLength, 0.1]} />
        <meshStandardMaterial color={currentColors.ridge} />
      </mesh>
    );

    // Back right hip
    hips.push(
      <mesh
        key="hip-br"
        position={[effectiveLength / 4, roofHeight / 2, effectiveSpan / 4]}
        rotation={[hipAngle, 0, pitch]}
      >
        <boxGeometry args={[0.1, hipLength, 0.1]} />
        <meshStandardMaterial color={currentColors.ridge} />
      </mesh>
    );

    return hips;
  };

  // Render building outline
  const renderBuildingOutline = () => {
    return (
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[buildingLength, 0.2, buildingWidth]} />
        <meshStandardMaterial color="#E8E8E8" opacity={0.3} transparent />
      </mesh>
    );
  };

  return (
    <group ref={groupRef}>
      {renderBuildingOutline()}
      {renderWallPlates()}
      {renderTrusses()}
      {renderCommonRafters()}
      {renderRidge()}
      {renderPurlins()}
      {renderCovering()}
      {renderHips()}

      {/* Grid helper */}
      <gridHelper
        args={[50, 50, "#cccccc", "#eeeeee"]}
        position={[0, -0.2, 0]}
      />

      {/* Dimension labels */}
      <Text position={[0, roofHeight + 1, 0]} fontSize={0.5} color="#000000">
        {`${roofType.toUpperCase()} ROOF`}
      </Text>
    </group>
  );
}

// Main App Component
export default function RoofComponent({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("3d");
  const [roofConfig, setRoofConfig] = useState({
    roofType: "gable",
    buildingLength: 12,
    buildingWidth: 8,
    wallThickness: 0.3,
    overhang: 0.6,
    pitchAngle: 30,
    trussSpacing: 1.8,
    rafterSpacing: 0.6,
    wallPlateSize: [0.1, 0.05],
    rafterSize: [0.15, 0.05],
    tieBeamSize: [0.15, 0.05],
    strutSize: [0.1, 0.05],
    ridgeSize: [0.175, 0.025],
    purlinSize: [0.075, 0.075],
    material: "timber",
    covering: "tiles",
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const updateConfig = (key, value) => {
    setRoofConfig((prev) => ({ ...prev, [key]: value }));
  };

  const calculateTakeoffItems = () => {
    const items = [];
    const { buildingLength, buildingWidth, wallThickness, overhang, pitchAngle, trussSpacing, covering } = roofConfig;

    // Helper calcs
    const pitchRad = (pitchAngle * Math.PI) / 180;
    const effectiveLength = buildingLength + 2 * wallThickness + 2 * overhang;
    const effectiveWidth = buildingWidth + 2 * wallThickness + 2 * overhang;
    const rafterLength = (buildingWidth / 2) / Math.cos(pitchRad);
    const numTrusses = Math.floor(buildingLength / trussSpacing) + 1;
    const roofArea = 2 * effectiveLength * rafterLength;
    const wallPlateLen = 2 * (buildingLength + 2 * wallThickness);

    // 1. Wall Plate
    items.push({
      billNo: "B.1",
      description: "Wall plates, 100 x 50mm sawn softwood, treated with preservative",
      unit: "m",
      quantity: wallPlateLen,
      rate: 850,
      amount: 0
    });

    // 2. Principal Rafters
    const totalRafterLen = 2 * numTrusses * rafterLength;
    items.push({
      billNo: "B.2",
      description: "Principal rafters, 150 x 50mm sawn softwood GS grade",
      unit: "m",
      quantity: totalRafterLen,
      rate: 1200,
      amount: 0
    });

    // 3. Tie Beams
    const totalTieBeamLen = numTrusses * effectiveWidth;
    items.push({
      billNo: "B.3",
      description: "Tie beams, 150 x 50mm sawn softwood",
      unit: "m",
      quantity: totalTieBeamLen,
      rate: 1200,
      amount: 0
    });

    // 4. Ridge Board
    items.push({
      billNo: "B.4",
      description: "Ridge board, 175 x 25mm sawn softwood",
      unit: "m",
      quantity: effectiveLength,
      rate: 750,
      amount: 0
    });

    // 5. Purlins
    items.push({
      billNo: "B.5",
      description: "Purlins, 75 x 75mm sawn softwood",
      unit: "m",
      quantity: 2 * effectiveLength,
      rate: 600,
      amount: 0
    });

    // 6. Struts
    const totalStrutLen = 4 * numTrusses * (buildingWidth / 4);
    items.push({
      billNo: "B.6",
      description: "Struts and ties, 100 x 50mm sawn softwood",
      unit: "m",
      quantity: totalStrutLen,
      rate: 850,
      amount: 0
    });

    // 7. Roof Covering
    const coveringName = covering === "tiles" ? "Clay roof tiles" :
      covering === "acSheets" ? "A.C. corrugated sheets" :
        covering === "giSheets" ? "G.I. corrugated sheets" : "Roof covering";

    items.push({
      billNo: "C.2",
      description: `${coveringName}, fixed as specified`,
      unit: "m²",
      quantity: roofArea * 1.1, // 10% waste
      rate: covering === "tiles" ? 2500 : 1500,
      amount: 0
    });

    // 8. Fascia
    items.push({
      billNo: "C.3",
      description: "Fascia Board 200 x 25mm sawn softwood",
      unit: "m",
      quantity: 2 * effectiveLength,
      rate: 0,
      amount: 0
    });

    // 9. Gutters
    items.push({
      billNo: "C.4",
      description: "PVC Gutters 100mm half round",
      unit: "m",
      quantity: 2 * (buildingLength + 2 * wallThickness),
      rate: 0,
      amount: 0
    });

    return items;
  };

  const handleCalculate = async () => {
    try {
      const payload = {
        columns: [], // Roof CAD currently doesn't have these in UI, but model expects them?
        beams: [],   // Or maybe it uses a different endpoint?
        slabs: [],
        settings: {
          conc_grade: "1:1.5:3",
          conc_grade_name: "C25",
          reinf_density: 120,
          form_type: "F3",
          include_wastage: true,
          conc_wastage: 5.0,
          reinf_wastage: 2.5,
          cover: 25,
          bar_spacing: 150
        }
      };

      // Wait, RoofBackend.py has /api/calculate which takes RoofConfig model.
      // Let's use the correct payload for RoofBackend.
      const roofPayload = {
        roof_type: roofConfig.roofType,
        building_length: roofConfig.buildingLength,
        building_width: roofConfig.buildingWidth,
        wall_thickness: roofConfig.wallThickness,
        overhang: roofConfig.overhang,
        pitch_angle: roofConfig.pitchAngle,
        truss_spacing: roofConfig.trussSpacing,
        rafter_spacing: roofConfig.rafterSpacing,
        material: roofConfig.material,
        covering: roofConfig.covering
      };

      const response = await axios.post("http://localhost:8001/roof_router/api/calculate", roofPayload);
      const data = response.data;

      if (data && data.takeoff_items) {
        const formattedItems = data.takeoff_items.map((item, index) => ({
          id: index + 1,
          billNo: item.bill_no || item.item_no || `R.${index + 1}`,
          itemNo: (index + 1).toString(),
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate || 0,
          amount: item.amount || 0,
          dimensions: [],
          isHeader: false
        }));
        setTakeoffData(formattedItems);
        setEditorKey(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error calculating roof takeoff:", error);
      // Fallback to local calculation if API fails?
      const rawItems = calculateTakeoffItems();
      const formattedItems = rawItems.map((item, index) => ({
        ...item,
        id: index + 1,
        itemNo: (index + 1).toString(),
        dimensions: [],
        isHeader: false
      }));
      setTakeoffData(formattedItems);
    }
  };

  // Initial calculation
  useEffect(() => {
    handleCalculate();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-slate-800 shadow-lg overflow-y-auto z-10">
        <div className="p-4 bg-blue-600 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Roof CAD Pro
          </h1>
          <p className="text-sm mt-1">Professional Roof Design Tool</p>
        </div>

        {/* Tab Navigation (Custom buttons for sidebar look, or use UniversalTabs if we move it to top? No, keep existing sidebar structure but maybe integrate UniversalTabs there?
           Actually, the UniversalTabs is a horizontal top bar. The existing design uses a sidebar left menu.
           I should keep the sidebar menu for navigation to ensure it fits the layout unless the user demanded universal tabs everywhere.
           The prompt says "The integration also requires a UniversalTabs component for consistent navigation".
           If I replace the sidebar tabs with UniversalTabs (horizontal), it might break the layout (sidebar vs main content).
           However, I can just Rendering UniversalTabs inside the sidebar is weird (horizontal in vertical).
           I will replace the top header tabs (Wait, the original code had tabs in sidebar?).
           Yes, "Tab Navigation" div in logic I read (lines 580-617) is INSIDE the sidebar.
           I will replace those buttons with a vertical version of tabs? Or just keep them but map them to the same values.
           Actually, to be truly "Universal", I should probably use the UniversalTabs component. 
           But UniversalTabs is styled as a horizontal bar (flex-row).
           I will use UniversalTabs in the MAIN CONTENT AREA if appropriate, or just keep manual tabs but ensure they map to the same expected keys.
           Wait, `Stairs.jsx` put UniversalTabs in the main content area.
           `RoofMain.jsx` has a sidebar. 
           If I put UniversalTabs in the top of the main content area, I can remove the sidebar tabs.
           That effectively moves navigation to the top. This is likely the "consistent" look requested.
           So I will REMOVE tabs from Sidebar and put UniversalTabs in the Main Content Area.
           This aligns with the goal of "Universal".
        */}

        {/* Configuration Panel - Sidebar Content */}
        <div className="p-4 space-y-4 border-t">
          {/* ... config inputs ... */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Roof Type
            </label>
            <select
              value={roofConfig.roofType}
              onChange={(e) => updateConfig("roofType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="gable">Gable Roof</option>
              <option value="hipped">Hipped Roof</option>
              <option value="gambrel">Gambrel Roof</option>
              <option value="lean-to">Lean-to Roof</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Length (m)
              </label>
              <input
                type="number"
                value={roofConfig.buildingLength}
                onChange={(e) =>
                  updateConfig("buildingLength", parseFloat(e.target.value))
                }
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Width (m)
              </label>
              <input
                type="number"
                value={roofConfig.buildingWidth}
                onChange={(e) =>
                  updateConfig("buildingWidth", parseFloat(e.target.value))
                }
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Wall Thickness (m)
              </label>
              <input
                type="number"
                value={roofConfig.wallThickness}
                onChange={(e) =>
                  updateConfig("wallThickness", parseFloat(e.target.value))
                }
                step="0.05"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Overhang (m)
              </label>
              <input
                type="number"
                value={roofConfig.overhang}
                onChange={(e) =>
                  updateConfig("overhang", parseFloat(e.target.value))
                }
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Pitch Angle (°): {roofConfig.pitchAngle}°
            </label>
            <input
              type="range"
              min="10"
              max="70"
              value={roofConfig.pitchAngle}
              onChange={(e) =>
                updateConfig("pitchAngle", parseInt(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Truss Spacing (m)
              </label>
              <input
                type="number"
                value={roofConfig.trussSpacing}
                onChange={(e) =>
                  updateConfig("trussSpacing", parseFloat(e.target.value))
                }
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Rafter Spacing (m)
              </label>
              <input
                type="number"
                value={roofConfig.rafterSpacing}
                onChange={(e) =>
                  updateConfig("rafterSpacing", parseFloat(e.target.value))
                }
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Material
            </label>
            <select
              value={roofConfig.material}
              onChange={(e) => updateConfig("material", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="timber">Timber</option>
              <option value="steel">Steel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Roof Covering
            </label>
            <select
              value={roofConfig.covering}
              onChange={(e) => updateConfig("covering", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="none">None (Structure Only)</option>
              <option value="tiles">Clay Tiles</option>
              <option value="acSheets">A.C. Sheets</option>
              <option value="giSheets">G.I. Sheets</option>
              <option value="slate">Slate</option>
              <option value="thatch">Thatch</option>
            </select>
          </div>

          <div className="pt-4 space-y-2">
            <button className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              Save Design
            </button>
            <button className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Export DXF
            </button>
            <button className="w-full bg-gray-600 text-white py-2 rounded-md hover:bg-gray-700 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Import Plan
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                {activeTab === "3d" && "3D Roof Visualization"}
                {activeTab === "takeoff" && "Quantity Take-off [Auto]"}
                {activeTab === "sheet" && "Standard Takeoff Sheet"}
                {activeTab === "boq" && "Bill of Quantities"}
              </h2>
              <p className="text-sm text-gray-600">
                {activeTab === "3d" && "Interactive 3D model of roof structure"}
                {activeTab === "takeoff" && "Automated quantity calculations (SMM7)"}
                {activeTab === "boq" && "Detailed bill of quantities"}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                Print
              </button>
              <button
                onClick={handleCalculate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Calculate
              </button>
            </div>
          </div>

          {/* Universal Tabs */}
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['3d', 'takeoff', 'sheet', 'boq']}
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden relative">
          {activeTab === "3d" && (
            <div className="w-full h-full bg-gradient-to-b from-sky-100 to-gray-100 rounded-lg shadow-inner">
              <Canvas>
                <PerspectiveCamera makeDefault position={[15, 10, 15]} />
                <OrbitControls
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  minDistance={5}
                  maxDistance={50}
                />
                <ambientLight intensity={0.5} />
                <directionalLight
                  position={[10, 10, 5]}
                  intensity={1}
                  castShadow
                />
                <directionalLight position={[-10, 10, -5]} intensity={0.5} />
                <pointLight position={[0, 15, 0]} intensity={0.5} />

                <RoofStructure config={roofConfig} />
              </Canvas>
            </div>
          )}

          {activeTab === "takeoff" && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 h-full overflow-auto">
              <EnglishMethodTakeoffSheet
                key={editorKey}
                initialItems={takeoffData}
                onChange={setTakeoffData}
                projectInfo={{
                  projectName: `${roofConfig.roofType.toUpperCase()} ROOF`,
                  clientName: "Client Name",
                  projectDate: new Date().toLocaleDateString()
                }}
              />
            </div>
          )}

          {activeTab === 'sheet' && (
            <UniversalSheet items={takeoffData} />
          )}

          {activeTab === "boq" && (
            <UniversalBOQ items={takeoffData} />
          )}
        </div>
      </div>
    </div>
  );
}
