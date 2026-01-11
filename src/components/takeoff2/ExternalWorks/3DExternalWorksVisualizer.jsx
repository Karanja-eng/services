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

// Bellmouth curve component for pavement layers
function BellmouthCurve({ center, radius, thickness, color, startAngle = 0, endAngle = Math.PI / 2, yOffset = 0 }) {
  const shape = useMemo(() => {
    const shp = new THREE.Shape();
    // Create a sector-like shape for the bellmouth pavement
    shp.moveTo(center[0], center[2]);
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      shp.lineTo(
        center[0] + Math.cos(angle) * radius,
        center[2] + Math.sin(angle) * radius
      );
    }
    shp.lineTo(center[0], center[2]);
    shp.closePath();
    return shp;
  }, [center, radius, startAngle, endAngle]);

  return (
    <mesh
      position={[0, yOffset + thickness / 2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <extrudeGeometry
        args={[shape, { depth: thickness, bevelEnabled: false }]}
      />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Curved Kerb component
function CurvedKerb({ center, radius, startAngle, endAngle, height = 0.25, width = 0.125 }) {
  const points = useMemo(() => {
    const pts = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      pts.push(new THREE.Vector2(
        center[0] + Math.cos(angle) * (radius + width / 2),
        center[2] + Math.sin(angle) * (radius + width / 2)
      ));
    }
    return pts;
  }, [center, radius, startAngle, endAngle, width]);

  const shape = useMemo(() => {
    const shp = new THREE.Shape();
    shp.moveTo(points[0].x, points[0].y);
    points.forEach(p => shp.lineTo(p.x, p.y));
    // Narrow path for the kerb
    for (let i = points.length - 1; i >= 0; i--) {
      const angle = startAngle + (endAngle - startAngle) * (i / (points.length - 1));
      shp.lineTo(
        center[0] + Math.cos(angle) * (radius - width / 2),
        center[2] + Math.sin(angle) * (radius - width / 2)
      );
    }
    shp.closePath();
    return shp;
  }, [center, radius, startAngle, endAngle, points, width]);

  return (
    <mesh position={[0, height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
      <extrudeGeometry args={[shape, { depth: height, bevelEnabled: false }]} />
      <meshStandardMaterial color={COLORS.kerb} roughness={0.8} />
    </mesh>
  );
}

// Curved Channel component
function CurvedChannel({ center, radius, startAngle, endAngle, width = 0.2, depth = 0.1 }) {
  // Similar to CurvedKerb but for the channel
  const points = useMemo(() => {
    const pts = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      pts.push(new THREE.Vector2(
        center[0] + Math.cos(angle) * radius,
        center[2] + Math.sin(angle) * radius
      ));
    }
    return pts;
  }, [center, radius, startAngle, endAngle]);

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(p => new THREE.Vector3(p.x, 0, p.y))
    );
    // Create a V-shape cross section
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, -depth);
    shape.lineTo(width / 2, 0);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      steps: 32,
      extrudePath: curve,
      bevelEnabled: false
    });
  }, [points, width, depth]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={COLORS.channel} />
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
    roadRotation = 0,
    parkingWidth,
    parkingLength,
    parkingRotation = 90,
    parkingPosX = 10,
    parkingPosZ = 0,
    bellmouthRadius1,
    bellmouthRadius2,
    showLayers,
    surfaceType,
  } = config;

  const degToRad = (deg) => (deg * Math.PI) / 180;

  // Render logic for pavement layers
  const renderPavement = (width, length, color, isParking = false) => (
    <group>
      {showLayers.subBase && (
        <PavementLayer
          geometry={[length, LAYER_THICKNESS.subBase, width]}
          color={COLORS.subBase}
          position={[0, -0.475, 0]}
        />
      )}
      {showLayers.hardcore && (
        <PavementLayer
          geometry={[length, LAYER_THICKNESS.hardcore, width]}
          color={COLORS.hardcore}
          position={[0, -0.3, 0]}
        />
      )}
      {!isParking && showLayers.baseCoarse && (
        <PavementLayer
          geometry={[length, LAYER_THICKNESS.baseCoarse, width]}
          color={COLORS.baseCoarse}
          position={[0, -0.125, 0]}
        />
      )}
      {showLayers.bitumen && (
        <PavementLayer
          geometry={[length, LAYER_THICKNESS.bitumen, width]}
          color={isParking ? COLORS.parking : (surfaceType === "bitumen" ? COLORS.bitumen : COLORS.cabro)}
          position={[0, -0.025, 0]}
        />
      )}
    </group>
  );

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={COLORS.grass} />
      </mesh>

      {/* Main Road Group */}
      <group rotation={[0, degToRad(roadRotation), 0]}>
        {renderPavement(roadWidth, roadLength, COLORS.bitumen)}

        {/* Road markings */}
        {surfaceType === "bitumen" && (
          <group position={[0, 0.01, 0]}>
            <RoadMarking start={[-roadLength / 2, 0, 0]} end={[roadLength / 2, 0, 0]} dashed={true} />
            <RoadMarking start={[-roadLength / 2, 0, -roadWidth / 2 + 0.2]} end={[roadLength / 2, 0, -roadWidth / 2 + 0.2]} width={0.15} />
            <RoadMarking start={[-roadLength / 2, 0, roadWidth / 2 - 0.2]} end={[roadLength / 2, 0, roadWidth / 2 - 0.2]} width={0.15} />
          </group>
        )}

        {/* Kerbs & Channels for Road */}
        {showLayers.kerb && (
          <>
            <Kerb start={[-roadLength / 2, 0, -roadWidth / 2]} end={[roadLength / 2, 0, -roadWidth / 2]} />
            <Kerb start={[-roadLength / 2, 0, roadWidth / 2]} end={[roadLength / 2, 0, roadWidth / 2]} />
          </>
        )}
      </group>

      {/* Access Road / Parking Group */}
      <group position={[parkingPosX, 0, parkingPosZ]} rotation={[0, degToRad(parkingRotation), 0]}>
        {renderPavement(parkingWidth, parkingLength, COLORS.parking, true)}

        {/* Parking Bay Markings */}
        <group position={[0, 0.01, 0]}>
          {Array.from({ length: Math.max(1, Math.floor(parkingLength / 2.5)) }).map((_, i) => (
            <RoadMarking
              key={i}
              start={[-parkingLength / 2 + i * 2.5, 0, -parkingWidth / 2]}
              end={[-parkingLength / 2 + i * 2.5, 0, parkingWidth / 2]}
              width={0.1}
            />
          ))}
          {/* Central line for double-sided parking if wide enough */}
          {parkingWidth > 10 && (
            <RoadMarking start={[-parkingLength / 2, 0, 0]} end={[parkingLength / 2, 0, 0]} width={0.1} />
          )}
        </group>

        {/* Kerbs & Channels for Parking */}
        {showLayers.kerb && (
          <>
            <Kerb start={[-parkingLength / 2, 0, -parkingWidth / 2]} end={[parkingLength / 2, 0, -parkingWidth / 2]} />
            <Kerb start={[-parkingLength / 2, 0, parkingWidth / 2]} end={[parkingLength / 2, 0, parkingWidth / 2]} />
            <Kerb start={[parkingLength / 2, 0, -parkingWidth / 2]} end={[parkingLength / 2, 0, parkingWidth / 2]} />
          </>
        )}

        {/* Bellmouth Junctions - Attached to the START of the parking road */}
        {showLayers.bellmouth && (
          <>
            {/* Left Bellmouth Layers */}
            {showLayers.subBase && (
              <BellmouthCurve
                center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                radius={bellmouthRadius1}
                thickness={LAYER_THICKNESS.subBase}
                color={COLORS.subBase}
                startAngle={0}
                endAngle={Math.PI / 2}
                yOffset={-0.55}
              />
            )}
            {showLayers.hardcore && (
              <BellmouthCurve
                center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                radius={bellmouthRadius1}
                thickness={LAYER_THICKNESS.hardcore}
                color={COLORS.hardcore}
                startAngle={0}
                endAngle={Math.PI / 2}
                yOffset={-0.4}
              />
            )}
            {showLayers.bitumen && (
              <BellmouthCurve
                center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                radius={bellmouthRadius1}
                thickness={LAYER_THICKNESS.bitumen}
                color={COLORS.bitumen}
                startAngle={0}
                endAngle={Math.PI / 2}
                yOffset={-0.05}
              />
            )}

            {/* Right Bellmouth Layers */}
            {showLayers.subBase && (
              <BellmouthCurve
                center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                radius={bellmouthRadius2}
                thickness={LAYER_THICKNESS.subBase}
                color={COLORS.subBase}
                startAngle={-Math.PI / 2}
                endAngle={0}
                yOffset={-0.55}
              />
            )}
            {showLayers.hardcore && (
              <BellmouthCurve
                center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                radius={bellmouthRadius2}
                thickness={LAYER_THICKNESS.hardcore}
                color={COLORS.hardcore}
                startAngle={-Math.PI / 2}
                endAngle={0}
                yOffset={-0.4}
              />
            )}
            {showLayers.bitumen && (
              <BellmouthCurve
                center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                radius={bellmouthRadius2}
                thickness={LAYER_THICKNESS.bitumen}
                color={COLORS.bitumen}
                startAngle={-Math.PI / 2}
                endAngle={0}
                yOffset={-0.05}
              />
            )}

            {/* Curved Kerbs for Bellmouth */}
            {showLayers.kerb && (
              <>
                <CurvedKerb
                  center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                  radius={bellmouthRadius1}
                  startAngle={0}
                  endAngle={Math.PI / 2}
                />
                <CurvedKerb
                  center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                  radius={bellmouthRadius2}
                  startAngle={-Math.PI / 2}
                  endAngle={0}
                />
              </>
            )}
          </>
        )}
      </group>


      {/* Nature decoration */}
      <Tree position={[25, 0, 15]} />
      <Tree position={[-25, 0, -15]} />
      <Tree position={[15, 0, -25]} />
    </>
  );
}

// Helper component for UI controls
function ControlGroup({ label, value, onChange, type = "number", min, max, step = "0.5" }) {
  return (
    <label style={{ display: "block", marginBottom: "12px" }}>
      <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>{label}</div>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(type === "number" || type === "range" ? parseFloat(e.target.value) || 0 : e.target.value)}
        style={{
          width: "100%",
          padding: "8px",
          background: "#2a2a2a",
          border: "1px solid #444",
          color: "white",
          borderRadius: "6px",
          fontSize: "13px",
          outline: "none",
          transition: "border-color 0.2s"
        }}
        onFocus={(e) => e.target.style.borderColor = "#14b8a6"}
        onBlur={(e) => e.target.style.borderColor = "#444"}
      />
    </label>
  );
}

// Main App Component
export default function ExternalWorks3DVisualizer({ config: propConfig, setConfig: propSetConfig, theme }) {
  const [internalConfig, setInternalConfig] = useState({
    roadWidth: 9,
    roadLength: 40,
    roadRotation: 0,
    parkingWidth: 10,
    parkingLength: 20,
    parkingRotation: 90,
    parkingPosX: 10,
    parkingPosZ: 0,
    bellmouthRadius1: 6,
    bellmouthRadius2: 6,
    drivewayWidth: 6,
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

  // Merge prop config with internal state if props exist
  const config = useMemo(() => {
    if (!propConfig) return internalConfig;
    return {
      ...internalConfig,
      ...propConfig,
      // Map roadType to surfaceType if needed
      surfaceType: propConfig.roadType || internalConfig.surfaceType,
    };
  }, [propConfig, internalConfig]);

  const setConfig = (newCfg) => {
    if (propSetConfig) {
      propSetConfig(newCfg);
    } else {
      setInternalConfig(newCfg);
    }
  };

  const toggleLayer = (layer) => {
    setConfig({
      ...config,
      showLayers: {
        ...config.showLayers,
        [layer]: !config.showLayers[layer],
      },
    });
  };

  const handleInputChange = (field, value) => {
    setConfig({
      ...config,
      [field]: value
    });
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: "#1a1a1a", position: "relative" }}>
      {/* Control Panel */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(0,0,0,0.85)",
          padding: "20px",
          borderRadius: "12px",
          color: "white",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 1000,
          width: "300px",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
        }}
      >
        <h3 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "700", borderBottom: "1px solid #444", paddingBottom: "10px" }}>
          3D Road Engine
        </h3>

        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", color: "#14b8a6", letterSpacing: "1px" }}>
            Main Road
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <ControlGroup label="Width" value={config.roadWidth} onChange={(v) => handleInputChange('roadWidth', v)} />
            <ControlGroup label="Length" value={config.roadLength} onChange={(v) => handleInputChange('roadLength', v)} />
          </div>
          <ControlGroup label="Rotation" value={config.roadRotation} onChange={(v) => handleInputChange('roadRotation', v)} type="range" min={-180} max={180} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", color: "#14b8a6", letterSpacing: "1px" }}>
            Access Road / Parking
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <ControlGroup label="Width" value={config.parkingWidth} onChange={(v) => handleInputChange('parkingWidth', v)} />
            <ControlGroup label="Length" value={config.parkingLength} onChange={(v) => handleInputChange('parkingLength', v)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <ControlGroup label="Pos X" value={config.parkingPosX} onChange={(v) => handleInputChange('parkingPosX', v)} />
            <ControlGroup label="Pos Z" value={config.parkingPosZ} onChange={(v) => handleInputChange('parkingPosZ', v)} />
          </div>
          <ControlGroup label="Rotation" value={config.parkingRotation} onChange={(v) => handleInputChange('parkingRotation', v)} type="range" min={-180} max={180} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", color: "#14b8a6", letterSpacing: "1px" }}>
            Junction (Bellmouth)
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <ControlGroup label="Radius L" value={config.bellmouthRadius1} onChange={(v) => handleInputChange('bellmouthRadius1', v)} />
            <ControlGroup label="Radius R" value={config.bellmouthRadius2} onChange={(v) => handleInputChange('bellmouthRadius2', v)} />
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", color: "#14b8a6", letterSpacing: "1px" }}>
            Surface Type
          </h4>
          <select
            value={config.surfaceType}
            onChange={(e) =>
              setConfig({ ...config, surfaceType: e.target.value })
            }
            style={{
              width: "100%",
              padding: "10px",
              background: "#2a2a2a",
              border: "1px solid #444",
              color: "white",
              borderRadius: "6px",
              fontSize: "13px",
              outline: "none"
            }}
          >
            <option value="bitumen">Bitumen / Tar</option>
            <option value="cabro">Cabro Blocks</option>
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", color: "#14b8a6", letterSpacing: "1px" }}>
            Layer Visibility
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {Object.keys(config.showLayers).map((layer) => (
              <button
                key={layer}
                onClick={() => toggleLayer(layer)}
                style={{
                  padding: "8px 4px",
                  fontSize: "11px",
                  background: config.showLayers[layer] ? "rgba(20, 184, 166, 0.15)" : "#222",
                  border: `1px solid ${config.showLayers[layer] ? "#14b8a6" : "#444"}`,
                  color: config.showLayers[layer] ? "#5eead4" : "#999",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center"
                }}
              >
                {layer.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #333", paddingTop: "15px", marginTop: "10px" }}>
          <div style={{ fontSize: "11px", color: "#777", lineHeight: "1.6" }}>
            <div>• Left Mouse: Rotate</div>
            <div>• Right Mouse/Shift: Pan</div>
            <div>• Scroll: Zoom</div>
          </div>
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
