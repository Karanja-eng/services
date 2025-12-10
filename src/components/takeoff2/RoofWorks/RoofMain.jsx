import React, { useState, useRef, useEffect } from "react";
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
  FileText,
  Calculator,
  Download,
} from "lucide-react";

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

  const updateConfig = (key, value) => {
    setRoofConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-slate-800 shadow-lg overflow-y-auto">
        <div className="p-4 bg-blue-600 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Roof CAD Pro
          </h1>
          <p className="text-sm mt-1">Professional Roof Design Tool</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("3d")}
            className={`flex-1 py-3 px-4 font-medium ${activeTab === "3d"
                ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:bg-gray-50"
              }`}
          >
            3D View
          </button>
          <button
            onClick={() => setActiveTab("takeoff")}
            className={`flex-1 py-3 px-4 font-medium ${activeTab === "takeoff"
                ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:bg-gray-50"
              }`}
          >
            Take-off
          </button>
          <button
            onClick={() => setActiveTab("boq")}
            className={`flex-1 py-3 px-4 font-medium ${activeTab === "boq"
                ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:bg-gray-50"
              }`}
          >
            BOQ
          </button>
        </div>

        {/* Configuration Panel */}
        <div className="p-4 space-y-4">
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 shadow-sm p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
              {activeTab === "3d" && "3D Roof Visualization"}
              {activeTab === "takeoff" && "Quantity Take-off"}
              {activeTab === "boq" && "Bill of Quantities"}
            </h2>
            <p className="text-sm text-gray-600">
              {activeTab === "3d" && "Interactive 3D model of roof structure"}
              {activeTab === "takeoff" &&
                "Automated quantity calculations (SMM7)"}
              {activeTab === "boq" && "Detailed bill of quantities"}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
              Print
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Calculate
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
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
              <h3 className="text-lg font-bold mb-4">
                DIMENSION PAPER - ROOF STRUCTURE
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Project: {roofConfig.roofType.toUpperCase()} ROOF | Date:{" "}
                {new Date().toLocaleDateString()}
              </p>

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="text-left p-2 w-24">TIMESING</th>
                    <th className="text-left p-2 w-32">DIMENSION</th>
                    <th className="text-left p-2 w-32">SQUARING</th>
                    <th className="text-left p-2">DESCRIPTION</th>
                    <th className="text-right p-2 w-32">QUANTITY</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  <tr className="border-b">
                    <td className="p-2 align-top">2</td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness)
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Wall Plate
                      <br />
                      100 x 50mm sawn softwood
                      <br />
                      bedded in c.m. (1:3)
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness)
                      ).toFixed(2)}{" "}
                      m
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">
                      {Math.floor(
                        roofConfig.buildingLength / roofConfig.trussSpacing
                      ) + 1}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingWidth +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang)
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Tie Beams
                      <br />
                      150 x 50mm sawn softwood
                      <br />
                      bolted to rafters
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang)
                      ).toFixed(2)}{" "}
                      m
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">1</td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Ridge Board
                      <br />
                      175 x 25mm sawn softwood
                      <br />
                      fixed to rafters
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}{" "}
                      m
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">2</td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang)
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Purlins
                      <br />
                      75 x 75mm sawn softwood
                      <br />
                      supported on struts
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang)
                      ).toFixed(2)}{" "}
                      m
                    </td>
                  </tr>

                  <tr className="border-b bg-gray-50">
                    <td colSpan="4" className="p-2 font-bold">
                      ROOF COVERING
                    </td>
                    <td className="p-2"></td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">1</td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}
                      <br />
                      {(
                        roofConfig.buildingWidth /
                        2 /
                        Math.cos((roofConfig.pitchAngle * Math.PI) / 180)
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        (roofConfig.buildingWidth /
                          2 /
                          Math.cos((roofConfig.pitchAngle * Math.PI) / 180))
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Roof Covering
                      <br />
                      {roofConfig.covering === "tiles"
                        ? "Clay tiles"
                        : roofConfig.covering === "acSheets"
                          ? "A.C. corrugated sheets"
                          : roofConfig.covering === "giSheets"
                            ? "G.I. corrugated sheets"
                            : roofConfig.covering}
                      <br />
                      to manufacturer's specification
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        (roofConfig.buildingWidth /
                          2 /
                          Math.cos((roofConfig.pitchAngle * Math.PI) / 180))
                      ).toFixed(2)}{" "}
                      m²
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">2</td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness +
                        2 * roofConfig.overhang
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang)
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Fascia Board
                      <br />
                      200 x 25mm sawn softwood
                      <br />
                      treated with preservative
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang)
                      ).toFixed(2)}{" "}
                      m
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">2</td>
                    <td className="p-2 align-top">
                      {(
                        roofConfig.buildingLength +
                        2 * roofConfig.wallThickness
                      ).toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness)
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      PVC Gutters
                      <br />
                      100mm half round
                      <br />
                      inc. brackets at 1m c/c
                    </td>
                    <td className="p-2 text-right align-top">
                      {(
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness)
                      ).toFixed(2)}{" "}
                      m
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="p-2 align-top">4</td>
                    <td className="p-2 align-top">3.00</td>
                    <td className="p-2 align-top">12.00</td>
                    <td className="p-2">
                      Downpipes
                      <br />
                      75mm diameter PVC
                      <br />
                      inc. fixings & shoes
                    </td>
                    <td className="p-2 text-right align-top">12.00 m</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-6 p-4 bg-blue-50 rounded">
                <p className="text-sm font-semibold">Notes:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>
                    • All timber to be Grade GS or better, treated with
                    preservative
                  </li>
                  <li>• Roof pitch: {roofConfig.pitchAngle}°</li>
                  <li>• Truss spacing: {roofConfig.trussSpacing}m centres</li>
                  <li>• Measurements taken from centre lines</li>
                  <li>• Allow 10% wastage for covering materials</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "boq" && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 h-full overflow-auto">
              <div className="mb-6">
                <h3 className="text-xl font-bold">BILL OF QUANTITIES</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Project: {roofConfig.roofType.toUpperCase()} ROOF CONSTRUCTION
                </p>
                <p className="text-sm text-gray-600">
                  Date: {new Date().toLocaleDateString()}
                </p>
              </div>

              <div className="mb-6">
                <h4 className="font-bold bg-gray-800 text-white p-2">
                  SECTION A: PRELIMINARIES
                </h4>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="text-left p-2 w-20">Item No.</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-center p-2 w-24">Unit</th>
                      <th className="text-right p-2 w-24">Quantity</th>
                      <th className="text-right p-2 w-32">Rate (KES)</th>
                      <th className="text-right p-2 w-32">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">A.1</td>
                      <td className="p-2">Site establishment and clearance</td>
                      <td className="p-2 text-center">Item</td>
                      <td className="p-2 text-right">1</td>
                      <td className="p-2 text-right">50,000.00</td>
                      <td className="p-2 text-right">50,000.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-6">
                <h4 className="font-bold bg-gray-800 text-white p-2">
                  SECTION B: ROOF STRUCTURE
                </h4>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="text-left p-2 w-20">Item No.</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-center p-2 w-24">Unit</th>
                      <th className="text-right p-2 w-24">Quantity</th>
                      <th className="text-right p-2 w-32">Rate (KES)</th>
                      <th className="text-right p-2 w-32">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">B.1</td>
                      <td className="p-2">
                        Wall plates, 100 x 50mm sawn softwood, treated with
                        preservative, bedded in cement mortar (1:3) on top of
                        loadbearing walls
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness)
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">850.00</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness) *
                          850
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">B.2</td>
                      <td className="p-2">
                        Principal rafters, 150 x 50mm sawn softwood GS grade,
                        treated, notched over wall plate, fixed with galvanised
                        nails
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (Math.floor(
                            roofConfig.buildingLength / roofConfig.trussSpacing
                          ) +
                            1) *
                          (roofConfig.buildingWidth /
                            2 /
                            Math.cos((roofConfig.pitchAngle * Math.PI) / 180))
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">1,200.00</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (Math.floor(
                            roofConfig.buildingLength / roofConfig.trussSpacing
                          ) +
                            1) *
                          (roofConfig.buildingWidth /
                            2 /
                            Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                          1200
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">B.3</td>
                      <td className="p-2">
                        Tie beams, 150 x 50mm sawn softwood, bolted to principal
                        rafters with M12 bolts and washers
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          (Math.floor(
                            roofConfig.buildingLength / roofConfig.trussSpacing
                          ) +
                            1) *
                          (roofConfig.buildingWidth +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang)
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">1,200.00</td>
                      <td className="p-2 text-right">
                        {(
                          (Math.floor(
                            roofConfig.buildingLength / roofConfig.trussSpacing
                          ) +
                            1) *
                          (roofConfig.buildingWidth +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          1200
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">B.4</td>
                      <td className="p-2">
                        Ridge board, 175 x 25mm sawn softwood, fixed to
                        principal rafters
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">750.00</td>
                      <td className="p-2 text-right">
                        {(
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          750
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">B.5</td>
                      <td className="p-2">
                        Purlins, 75 x 75mm sawn softwood, supported on struts
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang)
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">600.00</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          600
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">B.6</td>
                      <td className="p-2">
                        Struts and ties, 100 x 50mm sawn softwood, bolted
                        connections
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          4 *
                          (Math.floor(
                            roofConfig.buildingLength / roofConfig.trussSpacing
                          ) +
                            1) *
                          (roofConfig.buildingWidth / 4)
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">850.00</td>
                      <td className="p-2 text-right">
                        {(
                          4 *
                          (Math.floor(
                            roofConfig.buildingLength / roofConfig.trussSpacing
                          ) +
                            1) *
                          (roofConfig.buildingWidth / 4) *
                          850
                        ).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-6">
                <h4 className="font-bold bg-gray-800 text-white p-2">
                  SECTION C: ROOF COVERING
                </h4>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="text-left p-2 w-20">Item No.</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-center p-2 w-24">Unit</th>
                      <th className="text-right p-2 w-24">Quantity</th>
                      <th className="text-right p-2 w-32">Rate (KES)</th>
                      <th className="text-right p-2 w-32">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">C.1</td>
                      <td className="p-2">
                        Roof battens, 40 x 20mm sawn softwood, fixed at 350mm
                        centres
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          (2 *
                            (roofConfig.buildingLength +
                              2 * roofConfig.wallThickness +
                              2 * roofConfig.overhang) *
                            (roofConfig.buildingWidth /
                              2 /
                              Math.cos(
                                (roofConfig.pitchAngle * Math.PI) / 180
                              ))) /
                          0.35
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">180.00</td>
                      <td className="p-2 text-right">
                        {(
                          ((2 *
                            (roofConfig.buildingLength +
                              2 * roofConfig.wallThickness +
                              2 * roofConfig.overhang) *
                            (roofConfig.buildingWidth /
                              2 /
                              Math.cos(
                                (roofConfig.pitchAngle * Math.PI) / 180
                              ))) /
                            0.35) *
                          180
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">C.2</td>
                      <td className="p-2">
                        {roofConfig.covering === "tiles"
                          ? "Clay roof tiles, machine made, red, laid to half bond"
                          : roofConfig.covering === "acSheets"
                            ? "A.C. corrugated sheets, 26 gauge, fixed with J-bolts"
                            : roofConfig.covering === "giSheets"
                              ? "G.I. corrugated sheets, 28 gauge, galvanised, fixed with J-bolts"
                              : "Roof covering as specified"}
                      </td>
                      <td className="p-2 text-center">m²</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          (roofConfig.buildingWidth /
                            2 /
                            Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                          1.1
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">
                        {roofConfig.covering === "tiles"
                          ? "2,500.00"
                          : roofConfig.covering === "acSheets"
                            ? "1,200.00"
                            : "1,500.00"}
                      </td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          (roofConfig.buildingWidth /
                            2 /
                            Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                          1.1 *
                          (roofConfig.covering === "tiles"
                            ? 2500
                            : roofConfig.covering === "acSheets"
                              ? 1200
                              : 1500)
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">C.3</td>
                      <td className="p-2">
                        Ridge capping,{" "}
                        {roofConfig.covering === "tiles"
                          ? "clay ridge tiles"
                          : "ridge flashing"}
                        , bedded in c.m. (1:3)
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">800.00</td>
                      <td className="p-2 text-right">
                        {(
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          800
                        ).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-6">
                <h4 className="font-bold bg-gray-800 text-white p-2">
                  SECTION D: RAINWATER GOODS
                </h4>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="text-left p-2 w-20">Item No.</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-center p-2 w-24">Unit</th>
                      <th className="text-right p-2 w-24">Quantity</th>
                      <th className="text-right p-2 w-32">Rate (KES)</th>
                      <th className="text-right p-2 w-32">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">D.1</td>
                      <td className="p-2">
                        Fascia board, 200 x 25mm sawn softwood, treated with
                        preservative
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang)
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">650.00</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          650
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">D.2</td>
                      <td className="p-2">
                        PVC gutters, 100mm half round, including brackets at 1m
                        centres
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness)
                        ).toFixed(2)}
                      </td>
                      <td className="p-2 text-right">450.00</td>
                      <td className="p-2 text-right">
                        {(
                          2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness) *
                          450
                        ).toFixed(2)}
                      </td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">D.3</td>
                      <td className="p-2">
                        Downpipes, 75mm diameter PVC, including fixings and
                        shoes
                      </td>
                      <td className="p-2 text-center">m</td>
                      <td className="p-2 text-right">12.00</td>
                      <td className="p-2 text-right">380.00</td>
                      <td className="p-2 text-right">4,560.00</td>
                    </tr>

                    <tr className="border-b">
                      <td className="p-2">D.4</td>
                      <td className="p-2">Gutter outlets and stop ends</td>
                      <td className="p-2 text-center">No</td>
                      <td className="p-2 text-right">8</td>
                      <td className="p-2 text-right">250.00</td>
                      <td className="p-2 text-right">2,000.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 border-t-2 border-gray-800 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL ESTIMATED COST (Excluding VAT):</span>
                  <span>
                    KES{" "}
                    {(() => {
                      const preliminaries = 50000;
                      const wallPlates =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness) *
                        850;
                      const rafters =
                        2 *
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth /
                          2 /
                          Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                        1200;
                      const tieBeams =
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        1200;
                      const ridge =
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        750;
                      const purlins =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        600;
                      const struts =
                        4 *
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth / 4) *
                        850;
                      const battens =
                        ((2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          (roofConfig.buildingWidth /
                            2 /
                            Math.cos(
                              (roofConfig.pitchAngle * Math.PI) / 180
                            ))) /
                          0.35) *
                        180;
                      const covering =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        (roofConfig.buildingWidth /
                          2 /
                          Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                        1.1 *
                        (roofConfig.covering === "tiles"
                          ? 2500
                          : roofConfig.covering === "acSheets"
                            ? 1200
                            : 1500);
                      const ridgeCap =
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        800;
                      const fascia =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        650;
                      const gutters =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness) *
                        450;
                      const downpipes = 12 * 380 + 8 * 250;

                      const total =
                        preliminaries +
                        wallPlates +
                        rafters +
                        tieBeams +
                        ridge +
                        purlins +
                        struts +
                        battens +
                        covering +
                        ridgeCap +
                        fascia +
                        gutters +
                        downpipes;
                      return (total * 0.16).toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                    })()}
                  </span>
                </div>
                <div className="flex justify-between text-xl font-bold mt-2 pt-2 border-t">
                  <span>GRAND TOTAL (Including VAT):</span>
                  <span>
                    KES{" "}
                    {(() => {
                      const preliminaries = 50000;
                      const wallPlates =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness) *
                        850;
                      const rafters =
                        2 *
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth /
                          2 /
                          Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                        1200;
                      const tieBeams =
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        1200;
                      const ridge =
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        750;
                      const purlins =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        600;
                      const struts =
                        4 *
                        (Math.floor(
                          roofConfig.buildingLength / roofConfig.trussSpacing
                        ) +
                          1) *
                        (roofConfig.buildingWidth / 4) *
                        850;
                      const battens =
                        ((2 *
                          (roofConfig.buildingLength +
                            2 * roofConfig.wallThickness +
                            2 * roofConfig.overhang) *
                          (roofConfig.buildingWidth /
                            2 /
                            Math.cos(
                              (roofConfig.pitchAngle * Math.PI) / 180
                            ))) /
                          0.35) *
                        180;
                      const covering =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        (roofConfig.buildingWidth /
                          2 /
                          Math.cos((roofConfig.pitchAngle * Math.PI) / 180)) *
                        1.1 *
                        (roofConfig.covering === "tiles"
                          ? 2500
                          : roofConfig.covering === "acSheets"
                            ? 1200
                            : 1500);
                      const ridgeCap =
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        800;
                      const fascia =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness +
                          2 * roofConfig.overhang) *
                        650;
                      const gutters =
                        2 *
                        (roofConfig.buildingLength +
                          2 * roofConfig.wallThickness) *
                        450;
                      const downpipes = 12 * 380 + 8 * 250;

                      const total =
                        preliminaries +
                        wallPlates +
                        rafters +
                        tieBeams +
                        ridge +
                        purlins +
                        struts +
                        battens +
                        covering +
                        ridgeCap +
                        fascia +
                        gutters +
                        downpipes;
                      return (total * 1.16).toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                    })()}
                  </span>
                </div>
              </div>

              <div className="mt-8 p-4 bg-gray-50 rounded">
                <p className="text-sm font-semibold mb-2">Prepared by:</p>
                <p className="text-sm">Civil Engineer / Quantity Surveyor</p>
                <p className="text-sm text-gray-600 mt-4">
                  Date: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
