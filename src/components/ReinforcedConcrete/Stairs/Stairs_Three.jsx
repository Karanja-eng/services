import React, { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { Line } from "@react-three/drei";
/**
 * STAIRCASE DETAILING MODELS - MST1 & MST2
 * Based on IStructE/Concrete Society Standard Method of Detailing Structural Concrete
 *
 * CRITICAL ENGINEERING SPECIFICATIONS:
 * - MST1: End supported stairs with landings
 * - MST2: Cantilever stairs from wall/edge beam
 * - All dimensions per BS EN 1992 (Eurocode 2)
 * - Covers: 25mm internal, 40mm external
 * - Tension anchorage = greater of 0.1 x design span, tension anchorage length, or 500mm
 * - U-bars = 50% of main bottom reinforcement area
 * - Distribution bars as per Model Detail MS1
 */

// ============================================================================
// MST1: END SUPPORTED STAIRS WITH LANDINGS
// ============================================================================

/**
 * MST1: End Supported Stairs with Landings
 *
 * CRITICAL DETAILS:
 * - Tension lap at construction joints
 * - Tension anchorage = max(0.1 x span, anchorage length, 500mm)
 * - U-bars at both landings = 50% of main bottom reinforcement
 * - Bottom bars: length = 0.8 x span + 0.5 x tension lap (alternately reversed)
 * - Distribution bars: not less than 2 bars, pitch as per table
 * - Similar bars to main bottom reinforcement at construction joints
 * - 25mm cover standard (20mm or bar size, whichever greater)
 *
 * TWO VARIATIONS:
 * A) Landing at mid-floor level (standard)
 * B) Alternative detail with landing supporting stair flight
 */

export function DrawStairsMST1({
  // Overall dimensions
  flightLength = 4.0,
  flightWidth = 1.2,
  waistThickness = 0.18,
  riserHeight = 0.175,
  goingDepth = 0.275,
  numSteps = 13,

  // Landing dimensions
  landingLength = 1.2,
  landingThickness = 0.18,
  landingAtMidFloor = true,

  // Reinforcement parameters
  mainBarDiameter = 0.016,
  mainBarSpacing = 0.15,
  distributionBarDiameter = 0.01,
  distributionBarSpacing = 0.2,
  uBarDiameter = 0.012,

  // Covers and laps
  cover = 0.025,
  tensionLapMultiplier = 42,
  tensionAnchorageLength = 0.6,

  // Support conditions
  topSupportWidth = 0.3,
  bottomSupportWidth = 0.3,

  // Colors
  colors,
  showConcrete,
  showRebar,
  showLabels,
  wireframe,
  opacity,
}) {
  // Calculate critical dimensions
  const totalRise = riserHeight * numSteps;
  const totalGoing = goingDepth * (numSteps - 1);
  const flightAngle = Math.atan(totalRise / totalGoing);
  const waistLengthOnSlope = Math.sqrt(
    totalRise * totalRise + totalGoing * totalGoing
  );
  const designSpan = totalGoing; // Horizontal span

  // Tension parameters per code
  const tensionLap = mainBarDiameter * tensionLapMultiplier;
  const tensionAnchorage = Math.max(
    0.1 * designSpan,
    tensionAnchorageLength,
    0.5
  );

  // Calculate bar quantities
  const numMainBars = Math.floor(flightWidth / mainBarSpacing) + 1;
  const numDistributionBars =
    Math.floor(waistLengthOnSlope / distributionBarSpacing) + 1;
  const numUBarsPerLanding = Math.max(2, Math.floor(numMainBars * 0.5)); // 50% of main bars

  // Materials
  const concreteMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const waistMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.waist,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.waist, opacity, wireframe]
  );

  const landingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.landing,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.landing, opacity, wireframe]
  );

  const mainBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.mainBars]
  );

  const distributionBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.distributionBars]
  );

  const uBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.uBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.uBars]
  );

  // Create stair flight geometry (waist slab)
  const createWaistGeometry = () => {
    const shape = new THREE.Shape();

    // Waist profile following the steps
    shape.moveTo(0, 0);
    shape.lineTo(totalGoing, totalRise);
    shape.lineTo(
      totalGoing,
      totalRise - waistThickness / Math.cos(flightAngle)
    );
    shape.lineTo(0, -waistThickness / Math.cos(flightAngle));
    shape.closePath();

    const extrudeSettings = {
      depth: flightWidth,
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  };

  // Create step geometry
  const createStepGeometry = (stepIndex) => {
    const stepWidth = flightWidth;
    const stepGeo = new THREE.BoxGeometry(goingDepth, stepWidth, riserHeight);
    return stepGeo;
  };

  // Create U-bar path
  const createUBarPath = (spanLength, legDepth) => {
    const path = new THREE.CurvePath();
    const bendRadius = uBarDiameter * 4;

    // Bottom horizontal leg
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(spanLength * 0.8, 0, 0)
      )
    );

    // Bend up (right side)
    const arcRight = new THREE.ArcCurve(
      spanLength * 0.8,
      0,
      bendRadius,
      0,
      Math.PI / 2,
      false
    );
    const arcRightPoints = arcRight.getPoints(8);
    const arcRight3D = arcRightPoints.map(
      (p) => new THREE.Vector3(p.x, 0, p.y)
    );
    for (let i = 0; i < arcRight3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arcRight3D[i], arcRight3D[i + 1]));
    }

    // Vertical leg (right)
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(spanLength * 0.8 + bendRadius, 0, bendRadius),
        new THREE.Vector3(
          spanLength * 0.8 + bendRadius,
          0,
          bendRadius + legDepth
        )
      )
    );

    return path;
  };

  // Create main bottom bar path (straight with extensions)
  const createMainBottomBarPath = () => {
    const path = new THREE.CurvePath();
    const barLength = designSpan * 0.8 + tensionLap * 0.5;

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(barLength, 0, 0)
      )
    );

    return path;
  };

  return (
    <group name="MST1-End-Supported-Stairs">
      {/* Bottom Landing */}
      {showConcrete && (
        <mesh
          geometry={
            new THREE.BoxGeometry(landingLength, flightWidth, landingThickness)
          }
          material={landingMaterial}
          position={[-landingLength / 2, 0, landingThickness / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Stair Flight Waist Slab */}
      {showConcrete && (
        <mesh
          geometry={createWaistGeometry()}
          material={waistMaterial}
          position={[0, flightWidth / 2, 0]}
          rotation={[90, 0, 0]}
          castShadow
          receiveShadow
        />
      )}

      {/* Individual Steps */}
      {showConcrete &&
        Array.from({ length: numSteps }).map((_, i) => {
          const stepX = i * goingDepth + goingDepth / 2;
          const stepZ = i * riserHeight + riserHeight / 2;

          return (
            <mesh
              key={`step-${i}`}
              geometry={createStepGeometry(i)}
              material={concreteMaterial}
              position={[stepX, 0, stepZ]}
              castShadow
              receiveShadow
            />
          );
        })}

      {/* Top Landing */}
      {showConcrete && (
        <mesh
          geometry={
            new THREE.BoxGeometry(landingLength, flightWidth, landingThickness)
          }
          material={landingMaterial}
          position={[
            totalGoing + landingLength / 2,
            0,
            totalRise + landingThickness / 2,
          ]}
          castShadow
          receiveShadow
        />
      )}

      {/* Main Reinforcement */}
      {showRebar && (
        <group name="main-reinforcement">
          {/* Main bottom bars (longitudinal - direction of span) */}
          <group name="main-bottom-bars">
            {Array.from({ length: numMainBars }).map((_, i) => {
              const y = -flightWidth / 2 + i * mainBarSpacing;
              const z = cover + mainBarDiameter / 2;

              // Calculate bar length: 0.8 x span + 0.5 x tension lap
              const barLength = designSpan * 0.8 + tensionLap * 0.5;

              // Create bar path following the slope
              const points = [];
              const segments = 20;
              for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                const x = t * barLength;
                const zLocal = x * Math.tan(flightAngle);
                points.push(new THREE.Vector3(x, 0, zLocal + z));
              }

              const curve = new THREE.CatmullRomCurve3(points);
              const barGeometry = new THREE.TubeGeometry(
                curve,
                segments,
                mainBarDiameter / 2,
                8,
                false
              );

              // Alternate reversed bars (stagger pattern)
              const offset = i % 2 === 0 ? 0 : tensionLap * 0.25;

              return (
                <mesh
                  key={`main-bottom-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={[offset, y, 0]}
                />
              );
            })}
          </group>

          {/* Distribution bars (transverse) */}
          <group name="distribution-bars">
            {Array.from({ length: numDistributionBars }).map((_, i) => {
              const distanceAlongSlope = i * distributionBarSpacing;
              const x = distanceAlongSlope * Math.cos(flightAngle);
              const z =
                distanceAlongSlope * Math.sin(flightAngle) +
                cover +
                mainBarDiameter +
                distributionBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                distributionBarDiameter / 2,
                distributionBarDiameter / 2,
                flightWidth,
                16
              );

              return (
                <mesh
                  key={`dist-${i}`}
                  geometry={barGeometry}
                  material={distributionBarMaterial}
                  position={[x, 0, z]}
                  rotation={[Math.PI / 90, 0, 0]}
                />
              );
            })}
          </group>

          {/* U-bars at bottom landing */}
          <group name="u-bars-bottom-landing">
            {Array.from({ length: numUBarsPerLanding }).map((_, i) => {
              const y = -flightWidth / 2 + i * (mainBarSpacing * 2); // Every other position (50% of main)
              const z = cover + mainBarDiameter / 2;

              const uBarPath = createUBarPath(landingLength, landingThickness);
              const uBarGeometry = new THREE.TubeGeometry(
                uBarPath,
                64,
                uBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`u-bar-bottom-${i}`}
                  geometry={uBarGeometry}
                  material={uBarMaterial}
                  position={[-landingLength, y, z]}
                />
              );
            })}
          </group>

          {/* U-bars at top landing */}
          <group name="u-bars-top-landing">
            {Array.from({ length: numUBarsPerLanding }).map((_, i) => {
              const y = -flightWidth / 2 + i * (mainBarSpacing * 2);
              const z = totalRise + cover + mainBarDiameter / 2;

              const uBarPath = createUBarPath(landingLength, landingThickness);
              const uBarGeometry = new THREE.TubeGeometry(
                uBarPath,
                64,
                uBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`u-bar-top-${i}`}
                  geometry={uBarGeometry}
                  material={uBarMaterial}
                  position={[totalGoing, y, z]}
                />
              );
            })}
          </group>

          {/* Construction joint reinforcement (similar bars to main bottom) */}
          <group name="construction-joint-bars">
            {/* Bottom joint */}
            {Array.from({ length: numMainBars }).map((_, i) => {
              const y = -flightWidth / 2 + i * mainBarSpacing;
              const z = cover + mainBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                mainBarDiameter / 2,
                mainBarDiameter / 2,
                tensionLap,
                16
              );

              return (
                <mesh
                  key={`joint-bottom-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={[-tensionLap / 2, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}

            {/* Top joint */}
            {Array.from({ length: numMainBars }).map((_, i) => {
              const y = -flightWidth / 2 + i * mainBarSpacing;
              const z = totalRise + cover + mainBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                mainBarDiameter / 2,
                mainBarDiameter / 2,
                tensionLap,
                16
              );

              return (
                <mesh
                  key={`joint-top-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={[totalGoing + tensionLap / 2, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels and Annotations */}
      {showLabels && (
        <group name="labels">
          {/* Main title */}
          <Text
            position={[totalGoing / 2, flightWidth / 2 + 0.5, totalRise / 2]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            MST1: END SUPPORTED STAIRS
          </Text>

          {/* Tension lap annotation */}
          <Text
            position={[-landingLength - 0.3, 0, landingThickness / 2]}
            fontSize={0.1}
            color="red"
            anchorX="right"
            anchorY="middle"
          >
            Tension Lap\n{`${(tensionLap * 1000).toFixed(0)}mm`}
          </Text>

          {/* Tension anchorage annotation */}
          <Text
            position={[totalGoing + landingLength + 0.3, 0, totalRise]}
            fontSize={0.1}
            color="red"
            anchorX="left"
            anchorY="middle"
          >
            Tension Anchorage\n'A' = max(0.1L,{" "}
            {`${(tensionAnchorage * 1000).toFixed(0)}mm`}, 500mm)
          </Text>

          {/* U-bars annotation */}
          <Text
            position={[0, -flightWidth / 2 - 0.4, landingThickness / 2]}
            fontSize={0.09}
            color="orange"
            anchorX="center"
            anchorY="top"
          >
            U-bars = 50% of main bottom bars
          </Text>

          {/* Cover annotation */}
          <Text
            position={[totalGoing / 2, flightWidth / 2 + 0.3, cover]}
            fontSize={0.08}
            color="blue"
            anchorX="center"
            anchorY="bottom"
          >
            25mm cover (or bar dia., whichever greater)
          </Text>

          {/* Construction joint indicator */}
          <Text
            position={[0, 0, -0.3]}
            fontSize={0.08}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            Construction Joint
          </Text>

          {/* Distribution bars note */}
          <Text
            position={[totalGoing / 2, -flightWidth / 2 - 0.3, totalRise / 2]}
            fontSize={0.08}
            color="blue"
            anchorX="center"
            anchorY="top"
          >
            Distribution bars as MS1\nNot less than 2 No. bars
          </Text>
        </group>
      )}

      {/* Dimension Lines */}
      {showLabels && (
        <group name="dimension-lines">
          {/* Span dimension */}
          <Line
            points={[
              [0, -flightWidth / 2 - 0.5, -0.2],
              [totalGoing, -flightWidth / 2 - 0.5, -0.2],
            ]}
            color="black"
            lineWidth={2}
          />
          <Text
            position={[totalGoing / 2, -flightWidth / 2 - 0.6, -0.2]}
            fontSize={0.09}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            Design Span: {`${(designSpan * 1000).toFixed(0)}mm`}
          </Text>

          {/* Rise dimension */}
          <Line
            points={[
              [totalGoing + 0.5, 0, 0],
              [totalGoing + 0.5, 0, totalRise],
            ]}
            color="black"
            lineWidth={2}
          />
          <Text
            position={[totalGoing + 0.6, 0, totalRise / 2]}
            fontSize={0.09}
            color="black"
            anchorX="left"
            anchorY="middle"
            rotation={[0, 0, Math.PI / 2]}
          >
            Total Rise: {`${(totalRise * 1000).toFixed(0)}mm`}
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MST2: CANTILEVER STAIRS FROM WALL/EDGE BEAM
// ============================================================================

/**
 * MST2: Cantilever Stairs from Wall or Edge Beam
 *
 * CRITICAL DETAILS:
 * - Main cantilever bars MUST be mild steel if to be rebent
 * - Design reinforcement specified by designer
 * - Links H8 @ 300mm unless otherwise specified (bends adjusted on site)
 * - Distribution bars H10 @ 300mm unless otherwise specified
 * - Nominal H8 U-bar at free edge
 * - Corner bar detailed with wall
 * - Position of H8 U-bar critical for tread support
 * - Tension anchorage into wall/beam
 * - 25mm cover standard (or bar size, whichever greater)
 */

export function DrawStairsMST2({
  // Overall dimensions
  cantileverLength = 1.2,
  flightWidth = 2.5,
  waistThickness = 0.2,
  riserHeight = 0.175,
  treadDepth = 0.3,
  numTreads = 10,

  // Wall/support dimensions
  wallThickness = 0.25,
  wallHeight = 3.0,

  // Reinforcement parameters
  designBarDiameter = 0.02,
  numDesignBars = 6, // Per tread - specified by designer
  linkDiameter = 0.008,
  linkSpacing = 0.3,
  distributionBarDiameter = 0.01,
  distributionBarSpacing = 0.3,
  nominalUBarDiameter = 0.008,

  // Anchorage and covers
  cover = 0.025,
  anchorageIntoWall = 0.8,

  // Colors
  colors,

  showConcrete,
  showRebar,
  showLabels,
  wireframe,
  opacity,
}) {
  // Calculate flight angle
  const totalRise = riserHeight * numTreads;
  const flightAngle = Math.atan(riserHeight / treadDepth);

  // Materials
  const concreteMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.wall,
        transparent: true,
        opacity: opacity * 0.9,
        wireframe: wireframe,
      }),
    [colors.wall, opacity, wireframe]
  );

  const treadMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.tread,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.tread, opacity, wireframe]
  );

  const designBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.designBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.designBars]
  );

  const linkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.links,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.links]
  );

  const distributionBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.distributionBars]
  );

  const uBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.uBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.uBars]
  );

  // Create tread geometry
  const createTreadGeometry = () => {
    return new THREE.BoxGeometry(treadDepth, cantileverLength, waistThickness);
  };

  // Create main cantilever bar path (L-shaped, anchored into wall)
  const createCantileverBarPath = (treadIndex) => {
    const path = new THREE.CurvePath();
    const treadElevation = treadIndex * riserHeight;
    const bendRadius = designBarDiameter * 4;

    // Horizontal leg into wall
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-anchorageIntoWall, 0, treadElevation),
        new THREE.Vector3(-wallThickness / 2, 0, treadElevation)
      )
    );

    // Vertical section along wall face
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-wallThickness / 2, 0, treadElevation),
        new THREE.Vector3(
          -wallThickness / 2,
          0,
          treadElevation + cover + designBarDiameter / 2
        )
      )
    );

    // Bend out into cantilever
    const arc = new THREE.ArcCurve(
      0,
      treadElevation + cover + designBarDiameter / 2 + bendRadius,
      bendRadius,
      Math.PI,
      Math.PI / 2,
      true
    );
    const arcPoints = arc.getPoints(8);
    const arc3D = arcPoints.map(
      (p) => new THREE.Vector3(p.x - wallThickness / 2, 0, p.y)
    );
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Horizontal cantilever
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(
          -wallThickness / 2 + bendRadius,
          0,
          treadElevation + cover + designBarDiameter / 2 + bendRadius
        ),
        new THREE.Vector3(
          cantileverLength - cover,
          0,
          treadElevation + cover + designBarDiameter / 2 + bendRadius
        )
      )
    );

    return path;
  };

  // Create link path (U-shaped, adjusted on site)
  const createLinkPath = (treadElevation) => {
    const path = new THREE.CurvePath();
    const linkWidth = cantileverLength - 2 * cover - designBarDiameter;
    const linkHeight = waistThickness - 2 * cover - designBarDiameter;

    // Bottom horizontal
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(linkWidth, 0, 0)
      )
    );

    // Up at far end
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(linkWidth, 0, 0),
        new THREE.Vector3(linkWidth, 0, linkHeight)
      )
    );

    // Top horizontal
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(linkWidth, 0, linkHeight),
        new THREE.Vector3(0, 0, linkHeight)
      )
    );

    // Down at near end (into wall)
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, linkHeight),
        new THREE.Vector3(0, 0, 0)
      )
    );

    return path;
  };

  // Create nominal U-bar path (at free edge)
  const createNominalUBarPath = () => {
    const path = new THREE.CurvePath();
    const uBarWidth = waistThickness - 2 * cover;
    const uBarProjection = 0.075; // 75mm projection

    // Vertical leg down
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -uBarProjection)
      )
    );

    // Horizontal across
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, -uBarProjection),
        new THREE.Vector3(uBarWidth, 0, -uBarProjection)
      )
    );

    // Vertical leg up
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(uBarWidth, 0, -uBarProjection),
        new THREE.Vector3(uBarWidth, 0, 0)
      )
    );

    return path;
  };

  return (
    <group name="MST2-Cantilever-Stairs">
      {/* Supporting Wall/Edge Beam */}
      {showConcrete && (
        <mesh
          geometry={
            new THREE.BoxGeometry(wallThickness, flightWidth, wallHeight)
          }
          material={wallMaterial}
          position={[-wallThickness / 2, 0, wallHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />
      )}

      {/* Cantilevered Treads */}
      {showConcrete &&
        Array.from({ length: numTreads }).map((_, i) => {
          const treadZ = i * riserHeight + waistThickness / 2;
          const treadX = cantileverLength / 2;

          return (
            <mesh
              key={`tread-${i}`}
              geometry={createTreadGeometry()}
              material={treadMaterial}
              position={[treadX, 0, treadZ]}
              castShadow
              receiveShadow
            />
          );
        })}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Main Cantilever Design Bars (anchored into wall) */}
          <group name="main-cantilever-bars">
            {Array.from({ length: numTreads }).map((_, treadIdx) => {
              // Multiple bars per tread
              return Array.from({ length: numDesignBars }).map((_, barIdx) => {
                const y =
                  -flightWidth / 2 +
                  (barIdx + 1) * (flightWidth / (numDesignBars + 1));

                const barPath = createCantileverBarPath(treadIdx);
                const barGeometry = new THREE.TubeGeometry(
                  barPath,
                  64,
                  designBarDiameter / 2,
                  8,
                  false
                );

                return (
                  <mesh
                    key={`cantilever-bar-${treadIdx}-${barIdx}`}
                    geometry={barGeometry}
                    material={designBarMaterial}
                    position={[0, y, 0]}
                  />
                );
              });
            })}
          </group>

          {/* Links (H8 @ 300mm - bends adjusted on site) */}
          <group name="links">
            {Array.from({ length: numTreads }).map((_, treadIdx) => {
              const treadElevation = treadIdx * riserHeight;

              // Multiple links per tread based on spacing
              const numLinksPerTread = Math.max(
                1,
                Math.floor(flightWidth / linkSpacing)
              );

              return Array.from({ length: numLinksPerTread }).map(
                (_, linkIdx) => {
                  const y =
                    -flightWidth / 2 +
                    (linkIdx + 1) * (flightWidth / (numLinksPerTread + 1));

                  const linkPath = createLinkPath(treadElevation);
                  const linkGeometry = new THREE.TubeGeometry(
                    linkPath,
                    32,
                    linkDiameter / 2,
                    8,
                    false
                  );

                  return (
                    <mesh
                      key={`link-${treadIdx}-${linkIdx}`}
                      geometry={linkGeometry}
                      material={linkMaterial}
                      position={[
                        cover + designBarDiameter / 2,
                        y,
                        treadElevation + cover + designBarDiameter / 2,
                      ]}
                    />
                  );
                }
              );
            })}
          </group>

          {/* Distribution Bars (H10 @ 300mm - transverse) */}
          <group name="distribution-bars">
            {Array.from({ length: numTreads }).map((_, treadIdx) => {
              const treadElevation = treadIdx * riserHeight;
              const numDistBars =
                Math.floor(treadDepth / distributionBarSpacing) + 1;

              return Array.from({ length: numDistBars }).map((_, barIdx) => {
                const x = barIdx * distributionBarSpacing;
                const z =
                  treadElevation +
                  waistThickness -
                  cover -
                  distributionBarDiameter / 2;

                const barGeometry = new THREE.CylinderGeometry(
                  distributionBarDiameter / 2,
                  distributionBarDiameter / 2,
                  flightWidth,
                  16
                );

                return (
                  <mesh
                    key={`dist-${treadIdx}-${barIdx}`}
                    geometry={barGeometry}
                    material={distributionBarMaterial}
                    position={[x, 0, z]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              });
            })}
          </group>

          {/* Nominal H8 U-bars at free edge (one per tread) */}
          <group name="nominal-u-bars">
            {Array.from({ length: numTreads }).map((_, treadIdx) => {
              const treadElevation = treadIdx * riserHeight;

              return Array.from({ length: Math.floor(flightWidth / 0.3) }).map(
                (_, uBarIdx) => {
                  const y = -flightWidth / 2 + uBarIdx * 0.3;
                  const x = cantileverLength - cover;
                  const z = treadElevation + waistThickness;

                  const uBarPath = createNominalUBarPath();
                  const uBarGeometry = new THREE.TubeGeometry(
                    uBarPath,
                    32,
                    nominalUBarDiameter / 2,
                    8,
                    false
                  );

                  return (
                    <mesh
                      key={`u-bar-${treadIdx}-${uBarIdx}`}
                      geometry={uBarGeometry}
                      material={uBarMaterial}
                      position={[x, y, z]}
                      rotation={[0, Math.PI / 2, 0]}
                    />
                  );
                }
              );
            })}
          </group>

          {/* Corner bars detailed with wall (vertical bars in wall) */}
          <group name="corner-wall-bars">
            {Array.from({ length: 4 }).map((_, i) => {
              const y = -flightWidth / 2 + i * (flightWidth / 3);
              const x = -wallThickness / 2 + cover + designBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                designBarDiameter / 2,
                designBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`wall-bar-${i}`}
                  geometry={barGeometry}
                  material={designBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels and Annotations */}
      {showLabels && (
        <group name="labels">
          {/* Main title */}
          <Text
            position={[
              cantileverLength / 2,
              flightWidth / 2 + 0.6,
              totalRise / 2,
            ]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            MST2: CANTILEVER FROM WALL
          </Text>

          {/* Critical note about mild steel */}
          <Text
            position={[
              cantileverLength / 2,
              -flightWidth / 2 - 0.4,
              totalRise / 2,
            ]}
            fontSize={0.1}
            color="red"
            anchorX="center"
            anchorY="top"
            maxWidth={2.0}
          >
            CRITICAL: Main bars MUST be\nmild steel if to be rebent
          </Text>

          {/* Anchorage annotation */}
          <Text
            position={[
              -wallThickness / 2 - anchorageIntoWall / 2,
              0,
              riserHeight,
            ]}
            fontSize={0.09}
            color="red"
            anchorX="center"
            anchorY="bottom"
          >
            Tension Anchorage\n
            {`${(anchorageIntoWall * 1000).toFixed(0)}mm into wall`}
          </Text>

          {/* Design reinforcement note */}
          <Text
            position={[cantileverLength + 0.4, 0, totalRise / 2]}
            fontSize={0.09}
            color="blue"
            anchorX="left"
            anchorY="middle"
          >
            Design reinforcement\nspecified by designer
          </Text>

          {/* Links annotation */}
          <Text
            position={[
              cantileverLength / 2,
              flightWidth / 2 + 0.3,
              riserHeight * 2,
            ]}
            fontSize={0.08}
            color="blue"
            anchorX="center"
            anchorY="bottom"
          >
            H8 Links @ 300mm\n(Bends adjusted on site)
          </Text>

          {/* Distribution bars note */}
          <Text
            position={[
              treadDepth / 2,
              flightWidth / 2 + 0.2,
              waistThickness - cover,
            ]}
            fontSize={0.08}
            color="orange"
            anchorX="center"
            anchorY="bottom"
          >
            H10 Distribution @ 300mm
          </Text>

          {/* Nominal U-bar annotation */}
          <Text
            position={[cantileverLength + 0.2, 0, totalRise - riserHeight]}
            fontSize={0.07}
            color="#cc8833"
            anchorX="left"
            anchorY="middle"
          >
            Nominal H8 U-bar
          </Text>

          {/* Cover annotation */}
          <Text
            position={[0, -flightWidth / 2 - 0.2, cover]}
            fontSize={0.07}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            25mm cover (or bar dia.)
          </Text>

          {/* Corner bar note */}
          <Text
            position={[-wallThickness - 0.2, 0, wallHeight / 2]}
            fontSize={0.08}
            color="blue"
            anchorX="right"
            anchorY="middle"
          >
            Corner bars\ndetailed with wall
          </Text>

          {/* Position of U-bar note */}
          <Text
            position={[
              cantileverLength - 0.1,
              -flightWidth / 2 - 0.3,
              totalRise / 3,
            ]}
            fontSize={0.07}
            color="orange"
            anchorX="center"
            anchorY="top"
          >
            Position of H8 U-bar\ncritical for tread support
          </Text>
        </group>
      )}

      {/* Dimension Lines */}
      {showLabels && (
        <group name="dimension-lines">
          {/* Cantilever length */}
          <Line
            points={[
              [0, -flightWidth / 2 - 0.5, 0],
              [cantileverLength, -flightWidth / 2 - 0.5, 0],
            ]}
            color="black"
            lineWidth={2}
          />
          <Text
            position={[cantileverLength / 2, -flightWidth / 2 - 0.6, 0]}
            fontSize={0.09}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            Cantilever: {`${(cantileverLength * 1000).toFixed(0)}mm`}
          </Text>

          {/* Total rise */}
          <Line
            points={[
              [cantileverLength + 0.5, 0, 0],
              [cantileverLength + 0.5, 0, totalRise],
            ]}
            color="black"
            lineWidth={2}
          />
          <Text
            position={[cantileverLength + 0.6, 0, totalRise / 2]}
            fontSize={0.09}
            color="black"
            anchorX="left"
            anchorY="middle"
            rotation={[0, 0, Math.PI / 2]}
          >
            Rise: {`${(totalRise * 1000).toFixed(0)}mm`}
          </Text>

          {/* Anchorage into wall */}
          <Line
            points={[
              [-wallThickness / 2 - anchorageIntoWall, 0, riserHeight - 0.1],
              [-wallThickness / 2, 0, riserHeight - 0.1],
            ]}
            color="red"
            lineWidth={2}
          />

          {/* Tread depth */}
          <Line
            points={[
              [0, flightWidth / 2 + 0.5, riserHeight],
              [treadDepth, flightWidth / 2 + 0.5, riserHeight],
            ]}
            color="black"
            lineWidth={1}
          />
          <Text
            position={[treadDepth / 2, flightWidth / 2 + 0.6, riserHeight]}
            fontSize={0.07}
            color="black"
            anchorX="center"
            anchorY="bottom"
          >
            Tread: {`${(treadDepth * 1000).toFixed(0)}mm`}
          </Text>
        </group>
      )}

      {/* Section indicator for Detail A-A */}
      {showLabels && (
        <group name="section-indicator">
          <Text
            position={[cantileverLength / 2, 0, -0.4]}
            fontSize={0.12}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            Section A-A
          </Text>
          <Line
            points={[
              [0, -flightWidth / 2, -0.3],
              [cantileverLength, -flightWidth / 2, -0.3],
            ]}
            color="black"
            lineWidth={2}
          />
          <Line
            points={[
              [0, flightWidth / 2, -0.3],
              [cantileverLength, flightWidth / 2, -0.3],
            ]}
            color="black"
            lineWidth={2}
          />
        </group>
      )}
    </group>
  );
}
