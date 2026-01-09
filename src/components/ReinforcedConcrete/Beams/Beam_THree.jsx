import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * MultiSpanBeam3D
 * Visualizes a precise 3D model of a continuous reinforced concrete beam.
 * 
 * Coordinate System:
 * X-axis: Length (Span)
 * Y-axis: Depth (Height)
 * Z-axis: Width
 * 
 * Origin: Start of first span, Bottom-Left corner of section (or Center-Center depending on pref).
 * Here: Start of beam (X=0), Center of Width (Z=0), Center of Depth (Y=0) to simplify symmetry.
 */

export function MultiSpanBeam3D({
  spans = [], // Array of span objects: { spanLength, beamWidth, beamDepth, cover, topBars, bottomBars, links, ... }
  colors = {
    concrete: "#e0e0e0",
    mainRebar: "#d32f2f", // Red
    compressionRebar: "#d32f2f", // Red (same as main usually, or distinct #b71c1c)
    links: "#1976d2",     // Blue
    spacers: "#616161",
    supports: "#424242"
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.5,
}) {

  // If no spans provided, render placeholder or nothing
  if (!spans || spans.length === 0) return null;

  // Calculate cumulative X offsets for each span
  let currentX = 0;
  const spanRenderData = spans.map(span => {
    const startX = currentX;
    currentX += span.spanLength;
    return { ...span, startX };
  });

  return (
    <group name="MultiSpanBeam">
      {spanRenderData.map((spanData, index) => (
        <SingleSpanSection
          key={index}
          {...spanData}
          colors={colors}
          showConcrete={showConcrete}
          showRebar={showRebar}
          wireframe={wireframe}
          opacity={opacity}
          isFirst={index === 0}
          isLast={index === spans.length - 1}
        />
      ))}
      {/* Supports (Columns) at start of each span and end of last */}
      {spanRenderData.map((spanData, index) => (
        <SupportColumn
          key={`supp-start-${index}`}
          x={spanData.startX}
          y={-spanData.beamDepth / 2}
          z={0}
          width={spanData.beamWidth}
          depth={0.4} // Assumed column dimension
          colors={colors}
        />
      ))}
      <SupportColumn
        key="supp-end"
        x={currentX}
        y={-spans[spans.length - 1].beamDepth / 2}
        z={0}
        width={spans[spans.length - 1].beamWidth}
        depth={0.4}
        colors={colors}
      />
    </group>
  );
}

function SupportColumn({ x, y, z, width, depth, colors }) {
  // A simple column block below the beam support point
  // Centered at X, Top at Y
  const height = 1.0; // 1m stub column
  return (
    <mesh position={[x, y - height / 2, z]}>
      <boxGeometry args={[depth, height, width * 1.2]} />
      <meshStandardMaterial color={colors.supports} />
    </mesh>
  )
}

function SingleSpanSection({
  startX,
  spanLength,
  beamWidth = 0.3,
  beamDepth = 0.5,
  cover = 0.03, // meters

  // Reinforcement Data (Standardized from Backend)
  saggingBarsCount = 0,
  saggingBarDiameter = 0.02,
  saggingCompressionBarsCount = 0,
  saggingCompressionBarDiameter = 0.016,

  hoggingBarsCountLeft = 0,
  hoggingBarDiameterLeft = 0.02,
  hoggingCompressionBarsCountLeft = 0,
  hoggingCompressionBarDiameterLeft = 0.016,

  hoggingBarsCountRight = 0,
  hoggingBarDiameterRight = 0.02,
  hoggingCompressionBarsCountRight = 0,
  hoggingCompressionBarDiameterRight = 0.016,

  linksDiameter = 0.01,
  linksSpacing = 0.2, // meters

  colors,
  showConcrete,
  showRebar,
  wireframe,
  opacity,

  isFirst,
  isLast
}) {

  // --- GEOMETRY CONSTANTS ---
  const geometryQuality = 32; // Smoother cylinders

  // 1. Concrete Mesh
  // Positioned at center of this span's local segment
  const concreteX = startX + spanLength / 2;
  const concreteY = 0; // Centered vertically
  const concreteZ = 0;

  // 2. Reinforcement Logic
  // Orientation: X=Length, Y=Depth, Z=Width

  // -- Bottom Main Bars (Sagging) --
  // Full length of span minus cover (or continuous if internal)
  // Simplified: Extend into supports by 0.15 * spanLength or specific lap
  // User wants "Multi spans with supports placed".
  // Visual simplification: Main bars run full span length. Lap logic in real detailing is complex (staggered).
  // We will simply draw them from startX + cover to startX + spanLength - cover

  const bottomY = -beamDepth / 2 + cover + linksDiameter + saggingBarDiameter / 2;
  const topY = beamDepth / 2 - cover - linksDiameter - saggingBarDiameter / 2; // Assuming top bars similar dia for simplicity or separate

  const widthAvailable = beamWidth - 2 * cover - 2 * linksDiameter - saggingBarDiameter;
  const bottomSpacing = saggingBarsCount > 1 ? widthAvailable / (saggingBarsCount - 1) : 0;

  // -- Links (Stirrups) --
  // Loop from startX + 50mm to startX + spanLength - 50mm
  const numLinks = Math.floor((spanLength - 0.1) / linksSpacing);

  return (
    <group>
      {/* Concrete */}
      {showConcrete && (
        <mesh position={[concreteX, concreteY, concreteZ]}>
          <boxGeometry args={[spanLength, beamDepth, beamWidth]} />
          <meshStandardMaterial
            color={colors.concrete}
            transparent={true}
            opacity={opacity}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {showRebar && (
        <group>
          {/* Bottom Bars (Sagging) */}
          {Array.from({ length: saggingBarsCount }).map((_, i) => {
            const z = -widthAvailable / 2 + i * bottomSpacing;
            const xLen = spanLength - 0.05; // Slightly shorter than span to avoid z-fight at supports if simple
            // If continuous, we might want them to touch. Let's do full span for visual continuity.
            return (
              <mesh key={`bot-${i}`} position={[startX + spanLength / 2, bottomY, z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[saggingBarDiameter / 2, saggingBarDiameter / 2, xLen, geometryQuality]} />
                <meshStandardMaterial color={colors.mainRebar} />
              </mesh>
            )
          })}

          {/* Top Bars (Hogging/Compression) - Simplified Visuals */}
          {/* We draw "Top Bars" across the whole span for visual completeness in 3D, 
                   using the max of hoggingLeft/Right/SaggingCompression counts */}
          {/* Detailed: Top bars at supports extend 0.25-0.3L into span. 
                   Mid-span compression bars (if any) fill the gap. 
                   For visualization "wow" factor, let's draw continuous top bars (hanger or main) 
                   and color them red. */}

          {(() => {
            // Max top bars required
            const count = Math.max(2, hoggingBarsCountLeft, hoggingBarsCountRight, saggingCompressionBarsCount);
            const dia = Math.max(hoggingBarDiameterLeft, saggingCompressionBarDiameter);
            const topWAvail = beamWidth - 2 * cover - 2 * linksDiameter - dia;
            const topSpace = count > 1 ? topWAvail / (count - 1) : 0;

            return Array.from({ length: count }).map((_, i) => {
              const z = -topWAvail / 2 + i * topSpace;
              // Color: If this bar is acting as compression steel in midspan, red.
              // If just hanger, maybe different? User requested "Compression Steel logic".
              // We'll use mainRebar color for structural, maybe darker for hanger? 
              // Let's stick to mainRebar (Red) as per standard.
              return (
                <mesh key={`top-${i}`} position={[startX + spanLength / 2, topY, z]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[dia / 2, dia / 2, spanLength - 0.05, geometryQuality]} />
                  <meshStandardMaterial color={colors.mainRebar} />
                </mesh>
              )
            })
          })()}

          {/* Compression Steel Specifics (Mid-Span) */}
          {/* If specific compression bars are requested distinct from hangers, we add them. 
                   Though typically they occupy the top bar positions. 
                   The loop above covers them geometrically. */}

          {/* Links / Stirrups */}
          {Array.from({ length: numLinks }).map((_, i) => {
            const linkX = startX + 0.05 + i * linksSpacing;
            return (
              <group key={`link-${i}`} position={[linkX, 0, 0]}>
                {/* A shape for the stirrup */}
                <LinkShape
                  width={beamWidth - 2 * cover}
                  depth={beamDepth - 2 * cover}
                  diameter={linksDiameter}
                  color={colors.links}
                />
              </group>
            )
          })}
        </group>
      )}
    </group>
  );
}

function LinkShape({ width, depth, diameter, color }) {
  // Draws a rectangular stirrup in Y-Z plane
  // Centered at 0,0,0 local
  const halfW = width / 2;
  const halfD = depth / 2;

  const points = [
    new THREE.Vector3(0, -halfD, -halfW),
    new THREE.Vector3(0, -halfD, halfW),
    new THREE.Vector3(0, halfD, halfW),
    new THREE.Vector3(0, halfD, -halfW),
    new THREE.Vector3(0, -halfD, -halfW)
  ];

  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.01);
  // Actually LineCurve3 is better for sharp corners
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(points[0], points[1]));
  path.add(new THREE.LineCurve3(points[1], points[2]));
  path.add(new THREE.LineCurve3(points[2], points[3]));
  path.add(new THREE.LineCurve3(points[3], points[4]));

  return (
    <mesh>
      <tubeGeometry args={[path, 64, diameter / 2, 8, true]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
