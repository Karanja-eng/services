import React, { useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

// Color codes for different components
const COLORS = {
  kerb: "#808080", // Gray
  channel: "#606060", // Dark gray
  invertBlock: "#505050", // Darker gray
  pccSlab: "#D3D3D3", // Light gray
  bitumen: "#1A1A1A", // Black
  murram: "#8B4513", // Brown
  hardcore: "#A0522D", // Darker brown
  sandBed: "#F4A460", // Sandy brown
  subBase: "#D2691E", // Chocolate
  baseCoarse: "#8B7355", // Tan
  wearingCourse: "#2F4F4F", // Dark slate gray
  concrete: "#C0C0C0", // Silver
  grass: "#228B22", // Forest green
  driveway: "#4A4A4A", // Charcoal
  parking: "#3A3A3A", // Dark charcoal
  cabro: "#CD853F", // Peru
  road: "#696969", // Dim gray
};

// Layer thickness (in meters)
const LAYER_THICKNESS = {
  kerb: 0.25,
  channel: 0.15,
  invertBlock: 0.35,
  pccSlab: 0.05,
  bitumen: 0.05,
  murram: 0.2,
  hardcore: 0.2,
  sandBed: 0.15,
  subBase: 0.15,
  baseCoarse: 0.15,
  wearingCourse: 0.04,
  concrete: 0.1,
};

// Component for a single pavement layer
function PavementLayer({ geometry, color, position, opacity = 1 }) {
  return (
    <mesh position={position} receiveShadow castShadow>
      <boxGeometry args={geometry} />
      <meshStandardMaterial
        color={color}
        opacity={opacity}
        transparent={opacity < 1}
        roughness={0.7}
        metalness={0.2}
      />
    </mesh>
  );
}

// Kerb component
function Kerb({ start, end, height = 0.25, width = 0.125 }) {
  const length = Math.sqrt(
    Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
  );
  const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
  const midPoint = [
    (start[0] + end[0]) / 2,
    height / 2,
    (start[2] + end[2]) / 2,
  ];

  return (
    <mesh position={midPoint} rotation={[0, angle, 0]} castShadow>
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial color={COLORS.kerb} roughness={0.8} />
    </mesh>
  );
}

// Channel component
function Channel({ start, end, width = 0.125, depth = 0.1 }) {
  const length = Math.sqrt(
    Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
  );
  const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
  const midPoint = [
    (start[0] + end[0]) / 2,
    -depth / 2,
    (start[2] + end[2]) / 2,
  ];

  // Create V-shaped channel
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, -depth);
  shape.lineTo(width / 2, 0);

  const extrudeSettings = {
    steps: 1,
    depth: length,
    bevelEnabled: false,
  };

  return (
    <mesh position={midPoint} rotation={[0, angle, Math.PI / 2]} castShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial color={COLORS.channel} />
    </mesh>
  );
}

// Bellmouth curve component
function BellmouthCurve({ center, radius1, radius2, thickness, layerType }) {
  const points = useMemo(() => {
    const pts = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI / 2) * (i / segments);
      pts.push(
        new THREE.Vector3(
          center[0] + Math.cos(angle) * radius1,
          0,
          center[2] + Math.sin(angle) * radius1
        )
      );
    }
    for (let i = segments; i >= 0; i--) {
      const angle = (Math.PI / 2) * (i / segments);
      pts.push(
        new THREE.Vector3(
          center[0] + Math.cos(angle) * radius2,
          0,
          center[2] + Math.sin(angle) * radius2
        )
      );
    }
    return pts;
  }, [center, radius1, radius2]);

  const shape = useMemo(() => {
    const shp = new THREE.Shape();
    shp.moveTo(points[0].x, points[0].z);
    points.forEach((pt) => shp.lineTo(pt.x, pt.z));
    shp.closePath();
    return shp;
  }, [points]);

  return (
    <mesh
      position={[0, thickness / 2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <extrudeGeometry
        args={[shape, { depth: thickness, bevelEnabled: false }]}
      />
      <meshStandardMaterial color={COLORS[layerType] || COLORS.bitumen} />
    </mesh>
  );
}

// Road marking component
function RoadMarking({ start, end, width = 0.1, dashed = false }) {
  if (dashed) {
    const length = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
    );
    const dashLength = 2;
    const gapLength = 1;
    const numDashes = Math.floor(length / (dashLength + gapLength));
    const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);

    return (
      <>
        {Array.from({ length: numDashes }).map((_, i) => {
          const dashStart = i * (dashLength + gapLength);
          const x = start[0] + Math.cos(angle) * (dashStart + dashLength / 2);
          const z = start[2] + Math.sin(angle) * (dashStart + dashLength / 2);
          return (
            <mesh key={i} position={[x, 0.051, z]} rotation={[0, angle, 0]}>
              <boxGeometry args={[dashLength, 0.001, width]} />
              <meshStandardMaterial
                color="#FFFFFF"
                emissive="#FFFFFF"
                emissiveIntensity={0.2}
              />
            </mesh>
          );
        })}
      </>
    );
  }

  const length = Math.sqrt(
    Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
  );
  const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
  const midPoint = [(start[0] + end[0]) / 2, 0.051, (start[2] + end[2]) / 2];

  return (
    <mesh position={midPoint} rotation={[0, angle, 0]}>
      <boxGeometry args={[length, 0.001, width]} />
      <meshStandardMaterial
        color="#FFFFFF"
        emissive="#FFFFFF"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

// Tree component
function Tree({ position, type = "ornamental" }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 1, 8]} />
        <meshStandardMaterial color="#4B3621" />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  );
}

// Main scene component
function ExternalWorksScene({ config }) {
  const {
    roadWidth,
    roadLength,
    parkingWidth,
    parkingLength,
    bellmouthRadius1,
    bellmouthRadius2,
    drivewayWidth,
    showLayers,
    surfaceType,
  } = config;

  // Calculate positions
  const roadStartX = -roadLength / 2;
  const parkingOffsetZ = roadWidth / 2 + parkingWidth / 2;

  return (
    <>
      {/* Ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={COLORS.grass} />
      </mesh>

      {/* Main road - layered construction */}
      {showLayers.subBase && (
        <PavementLayer
          geometry={[roadLength, LAYER_THICKNESS.subBase, roadWidth]}
          color={COLORS.subBase}
          position={[0, -LAYER_THICKNESS.subBase / 2 - 0.4, 0]}
        />
      )}

      {showLayers.hardcore && (
        <PavementLayer
          geometry={[roadLength, LAYER_THICKNESS.hardcore, roadWidth]}
          color={COLORS.hardcore}
          position={[0, -LAYER_THICKNESS.hardcore / 2 - 0.25, 0]}
        />
      )}

      {showLayers.baseCoarse && (
        <PavementLayer
          geometry={[roadLength, LAYER_THICKNESS.baseCoarse, roadWidth]}
          color={COLORS.baseCoarse}
          position={[0, -LAYER_THICKNESS.baseCoarse / 2 - 0.1, 0]}
        />
      )}

      {/* Surface layer - bitumen or cabro */}
      {surfaceType === "bitumen" ? (
        <>
          {showLayers.bitumen && (
            <PavementLayer
              geometry={[roadLength, LAYER_THICKNESS.bitumen, roadWidth]}
              color={COLORS.bitumen}
              position={[0, 0, 0]}
            />
          )}
          {/* Road markings */}
          <RoadMarking
            start={[roadStartX, 0, 0]}
            end={[roadStartX + roadLength, 0, 0]}
            dashed={true}
          />
          <RoadMarking
            start={[roadStartX, 0, -roadWidth / 2 + 0.1]}
            end={[roadStartX + roadLength, 0, -roadWidth / 2 + 0.1]}
            width={0.15}
          />
          <RoadMarking
            start={[roadStartX, 0, roadWidth / 2 - 0.1]}
            end={[roadStartX + roadLength, 0, roadWidth / 2 - 0.1]}
            width={0.15}
          />
        </>
      ) : (
        <PavementLayer
          geometry={[roadLength, LAYER_THICKNESS.bitumen, roadWidth]}
          color={COLORS.cabro}
          position={[0, 0, 0]}
        />
      )}

      {/* Kerbs */}
      {showLayers.kerb && (
        <>
          <Kerb
            start={[roadStartX, 0, -roadWidth / 2]}
            end={[roadStartX + roadLength, 0, -roadWidth / 2]}
          />
          <Kerb
            start={[roadStartX, 0, roadWidth / 2]}
            end={[roadStartX + roadLength, 0, roadWidth / 2]}
          />
        </>
      )}

      {/* Channels */}
      {showLayers.channel && (
        <>
          <Channel
            start={[roadStartX, 0, -roadWidth / 2 - 0.2]}
            end={[roadStartX + roadLength, 0, -roadWidth / 2 - 0.2]}
          />
          <Channel
            start={[roadStartX, 0, roadWidth / 2 + 0.2]}
            end={[roadStartX + roadLength, 0, roadWidth / 2 + 0.2]}
          />
        </>
      )}

      {/* Parking area */}
      <group position={[parkingLength / 2 - 5, 0, parkingOffsetZ]}>
        {showLayers.hardcore && (
          <PavementLayer
            geometry={[parkingLength, LAYER_THICKNESS.hardcore, parkingWidth]}
            color={COLORS.hardcore}
            position={[0, -LAYER_THICKNESS.hardcore / 2 - 0.25, 0]}
          />
        )}
        <PavementLayer
          geometry={[parkingLength, LAYER_THICKNESS.bitumen, parkingWidth]}
          color={COLORS.parking}
          position={[0, 0, 0]}
        />
        {/* Parking bay lines */}
        {Array.from({ length: 5 }).map((_, i) => (
          <RoadMarking
            key={i}
            start={[-parkingLength / 2 + i * 5, 0, -parkingWidth / 2]}
            end={[-parkingLength / 2 + i * 5, 0, parkingWidth / 2]}
            width={0.1}
          />
        ))}
      </group>

      {/* Bellmouth curve */}
      {showLayers.bellmouth && (
        <BellmouthCurve
          center={[5, 0, roadWidth / 2 + 2]}
          radius1={bellmouthRadius1}
          radius2={bellmouthRadius2}
          thickness={LAYER_THICKNESS.bitumen}
          layerType="bitumen"
        />
      )}

      {/* Ornamental trees */}
      <Tree position={[-15, 0, 8]} />
      <Tree position={[-10, 0, 8]} />
      <Tree position={[-5, 0, 8]} />

      {/* Invert blocks with PCC slabs (drainage) */}
      {showLayers.invertBlock && (
        <>
          {Array.from({ length: 10 }).map((_, i) => (
            <group
              key={i}
              position={[roadStartX + i * 5, -0.3, roadWidth / 2 + 0.6]}
            >
              <mesh castShadow>
                <boxGeometry args={[0.35, 0.35, 0.35]} />
                <meshStandardMaterial color={COLORS.invertBlock} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <boxGeometry args={[0.5, 0.05, 0.5]} />
                <meshStandardMaterial color={COLORS.pccSlab} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* Grass areas */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-10, 0.01, -10]}
        receiveShadow
      >
        <planeGeometry args={[20, 15]} />
        <meshStandardMaterial color={COLORS.grass} />
      </mesh>

      {/* Labels */}
      <Text
        position={[0, 2, -roadWidth / 2 - 1]}
        rotation={[0, 0, 0]}
        fontSize={0.5}
        color="white"
      >
        Main Road {roadWidth.toFixed(1)}m x {roadLength.toFixed(1)}m
      </Text>
      <Text
        position={[parkingLength / 2 - 5, 2, parkingOffsetZ]}
        rotation={[0, 0, 0]}
        fontSize={0.4}
        color="white"
      >
        Parking {parkingWidth.toFixed(1)}m x {parkingLength.toFixed(1)}m
      </Text>
    </>
  );
}

// Main App Component
export default function ExternalWorks3DVisualizer() {
  const [config, setConfig] = useState({
    roadWidth: 9,
    roadLength: 32,
    parkingWidth: 9,
    parkingLength: 25,
    bellmouthRadius1: 3.5,
    bellmouthRadius2: 2.5,
    drivewayWidth: 9,
    surfaceType: "bitumen", // or 'cabro'
    showLayers: {
      subBase: true,
      hardcore: true,
      baseCoarse: true,
      bitumen: true,
      kerb: true,
      channel: true,
      invertBlock: true,
      bellmouth: true,
    },
  });

  const toggleLayer = (layer) => {
    setConfig((prev) => ({
      ...prev,
      showLayers: {
        ...prev.showLayers,
        [layer]: !prev.showLayers[layer],
      },
    }));
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: "#1a1a1a" }}>
      {/* Control Panel */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(0,0,0,0.8)",
          padding: "15px",
          borderRadius: "8px",
          color: "white",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 1000,
          width: "280px",
        }}
      >
        <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
          3D External Works
        </h3>

        <div style={{ marginBottom: "15px" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
            Dimensions (m)
          </h4>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}
          >
            Road Width:
            <input
              type="number"
              value={config.roadWidth}
              onChange={(e) =>
                setConfig({
                  ...config,
                  roadWidth: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                padding: "4px",
                marginTop: "4px",
                background: "#333",
                border: "1px solid #555",
                color: "white",
                borderRadius: "4px",
              }}
              step="0.5"
            />
          </label>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}
          >
            Road Length:
            <input
              type="number"
              value={config.roadLength}
              onChange={(e) =>
                setConfig({
                  ...config,
                  roadLength: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                padding: "4px",
                marginTop: "4px",
                background: "#333",
                border: "1px solid #555",
                color: "white",
                borderRadius: "4px",
              }}
              step="0.5"
            />
          </label>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}
          >
            Parking Width:
            <input
              type="number"
              value={config.parkingWidth}
              onChange={(e) =>
                setConfig({
                  ...config,
                  parkingWidth: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                padding: "4px",
                marginTop: "4px",
                background: "#333",
                border: "1px solid #555",
                color: "white",
                borderRadius: "4px",
              }}
              step="0.5"
            />
          </label>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}
          >
            Parking Length:
            <input
              type="number"
              value={config.parkingLength}
              onChange={(e) =>
                setConfig({
                  ...config,
                  parkingLength: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                padding: "4px",
                marginTop: "4px",
                background: "#333",
                border: "1px solid #555",
                color: "white",
                borderRadius: "4px",
              }}
              step="0.5"
            />
          </label>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}
          >
            Bellmouth R1:
            <input
              type="number"
              value={config.bellmouthRadius1}
              onChange={(e) =>
                setConfig({
                  ...config,
                  bellmouthRadius1: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                padding: "4px",
                marginTop: "4px",
                background: "#333",
                border: "1px solid #555",
                color: "white",
                borderRadius: "4px",
              }}
              step="0.5"
            />
          </label>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}
          >
            Bellmouth R2:
            <input
              type="number"
              value={config.bellmouthRadius2}
              onChange={(e) =>
                setConfig({
                  ...config,
                  bellmouthRadius2: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                padding: "4px",
                marginTop: "4px",
                background: "#333",
                border: "1px solid #555",
                color: "white",
                borderRadius: "4px",
              }}
              step="0.5"
            />
          </label>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
            Surface Type
          </h4>
          <select
            value={config.surfaceType}
            onChange={(e) =>
              setConfig({ ...config, surfaceType: e.target.value })
            }
            style={{
              width: "100%",
              padding: "6px",
              background: "#333",
              border: "1px solid #555",
              color: "white",
              borderRadius: "4px",
            }}
          >
            <option value="bitumen">Bitumen/Tar</option>
            <option value="cabro">Cabro Blocks</option>
          </select>
        </div>

        <div>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
            Visible Layers
          </h4>
          {Object.keys(config.showLayers).map((layer) => (
            <label
              key={layer}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={config.showLayers[layer]}
                onChange={() => toggleLayer(layer)}
                style={{ marginRight: "8px" }}
              />
              {layer
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase())}
            </label>
          ))}
        </div>

        <div style={{ marginTop: "15px", fontSize: "11px", color: "#aaa" }}>
          <p style={{ margin: "5px 0" }}>Use mouse to rotate/zoom</p>
          <p style={{ margin: "5px 0" }}>Right-click to pan</p>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          background: "rgba(0,0,0,0.8)",
          padding: "15px",
          borderRadius: "8px",
          color: "white",
          zIndex: 1000,
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Color Legend</h4>
        <div style={{ fontSize: "11px" }}>
          {Object.entries(COLORS)
            .slice(0, 12)
            .map(([name, color]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    background: color,
                    marginRight: "8px",
                    border: "1px solid #555",
                  }}
                />
                <span>{name.replace(/([A-Z])/g, " $1").trim()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[20, 15, 20]} fov={60} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
        />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <hemisphereLight intensity={0.3} groundColor="#080820" />
        <ExternalWorksScene config={config} />
        <gridHelper args={[100, 100, "#444", "#222"]} position={[0, -0.5, 0]} />
      </Canvas>
    </div>
  );
}
