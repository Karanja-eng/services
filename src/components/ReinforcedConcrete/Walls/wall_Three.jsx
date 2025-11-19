import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * WALL DETAILING MODELS - MW1 to MW4
 * Based on IStructE/Concrete Society Standard Method of Detailing Structural Concrete
 *
 * These components visualize standard reinforcement details for concrete walls
 * following BS EN 1992 (Eurocode 2) practices.
 */

// ============================================================================
// MW1: WALLS - GENERAL DETAILS
// ============================================================================

/**
 * MW1: Walls - General Details
 * Shows typical wall reinforcement with:
 * - Vertical bars resting on kicker
 * - U-bars at top
 * - L-bars at bottom
 * - Compression lap + 150mm for foundation tolerance
 * - Projection above floor level = compression lap + kicker height
 * - Standard reinforcement table for different wall thicknesses
 * - Horizontal bars laid outside vertical bars
 *
 * @param {Object} props
 */
export function DrawWallMW1({
  wallLength = 6.0,
  wallHeight = 3.0,
  wallThickness = 0.2,
  foundationThickness = 0.5,
  cover = 0.03,
  verticalBarDiameter = 0.012,
  verticalBarSpacing = 0.2,
  horizontalBarDiameter = 0.01,
  horizontalBarSpacing = 0.2,
  kickerHeight = 0.075,
  kickerBelowGround = 0.15,
  colors = {
    concrete: "#a8a8a8",
    foundation: "#999999",
    verticalRebar: "#cc3333",
    horizontalRebar: "#cc8833",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const compressionLap = verticalBarDiameter * 54; // Simplified for walls
  const starterLength = compressionLap + 0.15; // Add 150mm tolerance
  const projectionAboveFloor = compressionLap + kickerHeight;

  const numVerticalBars = Math.floor(wallLength / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(wallHeight / horizontalBarSpacing) + 1;

  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
  );

  const foundationGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(wallLength, wallThickness * 2, foundationThickness),
    [wallLength, wallThickness, foundationThickness]
  );

  const kickerGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, kickerHeight),
    [wallLength, wallThickness, kickerHeight]
  );

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

  const foundationMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.foundation,
        transparent: true,
        opacity: opacity * 0.8,
        wireframe: wireframe,
      }),
    [colors.foundation, opacity, wireframe]
  );

  const verticalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.verticalRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.verticalRebar, wireframe]
  );

  const horizontalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.horizontalRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.horizontalRebar, wireframe]
  );

  // Create L-bar path for bottom starter bars
  const createLBarPath = () => {
    const path = new THREE.CurvePath();
    const bendRadius = verticalBarDiameter * 2;
    const horizontalLeg = 0.45; // Minimum 450mm

    // Horizontal leg in foundation
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, horizontalLeg, 0)
      )
    );

    // 90 degree bend
    const arc = new THREE.ArcCurve(
      bendRadius,
      horizontalLeg,
      bendRadius,
      Math.PI,
      Math.PI / 2,
      true
    );
    const arcPoints = arc.getPoints(12);
    const arc3D = arcPoints.map((p) => new THREE.Vector3(0, p.x, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Vertical leg
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, bendRadius, horizontalLeg + bendRadius),
        new THREE.Vector3(
          0,
          bendRadius,
          horizontalLeg + bendRadius + starterLength
        )
      )
    );

    return path;
  };

  // Create U-bar path for top bars
  const createUBarPath = () => {
    const path = new THREE.CurvePath();
    const bendRadius = verticalBarDiameter * 2;
    const uWidth = wallThickness - 2 * cover - 2 * verticalBarDiameter;
    const uHeight = projectionAboveFloor - bendRadius * 2;

    // Left vertical
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, -uWidth / 2, 0),
        new THREE.Vector3(0, -uWidth / 2, uHeight)
      )
    );

    // Top left bend
    const topLeftArc = new THREE.ArcCurve(
      bendRadius,
      uHeight + bendRadius,
      bendRadius,
      Math.PI,
      Math.PI / 2,
      true
    );
    const topLeftPoints = topLeftArc.getPoints(12);
    const topLeft3D = topLeftPoints.map(
      (p) => new THREE.Vector3(0, -uWidth / 2 + p.x, p.y)
    );
    for (let i = 0; i < topLeft3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(topLeft3D[i], topLeft3D[i + 1]));
    }

    // Top horizontal
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(
          0,
          -uWidth / 2 + bendRadius,
          uHeight + bendRadius * 2
        ),
        new THREE.Vector3(0, uWidth / 2 - bendRadius, uHeight + bendRadius * 2)
      )
    );

    // Top right bend
    const topRightArc = new THREE.ArcCurve(
      -bendRadius,
      uHeight + bendRadius,
      bendRadius,
      Math.PI / 2,
      0,
      true
    );
    const topRightPoints = topRightArc.getPoints(12);
    const topRight3D = topRightPoints.map(
      (p) => new THREE.Vector3(0, uWidth / 2 + p.x, p.y)
    );
    for (let i = 0; i < topRight3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(topRight3D[i], topRight3D[i + 1]));
    }

    // Right vertical
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, uWidth / 2, uHeight),
        new THREE.Vector3(0, uWidth / 2, 0)
      )
    );

    return path;
  };

  const lBarPath = createLBarPath();
  const uBarPath = createUBarPath();

  return (
    <group name="MW1-Wall-General-Details">
      {/* Foundation */}
      {showConcrete && (
        <mesh
          geometry={foundationGeometry}
          material={foundationMaterial}
          position={[0, 0, -foundationThickness / 2 - kickerBelowGround]}
        />
      )}

      {/* Kicker */}
      {showConcrete && (
        <mesh
          geometry={kickerGeometry}
          material={concreteMaterial}
          position={[0, 0, kickerHeight / 2]}
        />
      )}

      {/* Wall */}
      {showConcrete && (
        <mesh
          geometry={wallGeometry}
          material={concreteMaterial}
          position={[0, 0, kickerHeight + wallHeight / 2]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical Bars - Near Face */}
          <group name="vertical-bars-near-face">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y = -wallThickness / 2 + cover + verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-near-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, kickerHeight + wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Far Face */}
          <group name="vertical-bars-far-face">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y = wallThickness / 2 - cover - verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-far-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, kickerHeight + wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* L-bar Starters from Foundation - Near Face */}
          <group name="l-bar-starters-near">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y = -wallThickness / 2 + cover + verticalBarDiameter / 2;

              const lBarGeometry = new THREE.TubeGeometry(
                lBarPath,
                64,
                verticalBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`l-bar-near-${i}`}
                  geometry={lBarGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, -foundationThickness - kickerBelowGround]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* L-bar Starters from Foundation - Far Face */}
          <group name="l-bar-starters-far">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y = wallThickness / 2 - cover - verticalBarDiameter / 2;

              const lBarGeometry = new THREE.TubeGeometry(
                lBarPath,
                64,
                verticalBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`l-bar-far-${i}`}
                  geometry={lBarGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, -foundationThickness - kickerBelowGround]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* U-bars at Top - Alternate positions */}
          <group name="u-bars-top">
            {Array.from({ length: Math.floor(numVerticalBars / 2) }).map(
              (_, i) => {
                const x = -wallLength / 2 + i * verticalBarSpacing * 2;

                const uBarGeometry = new THREE.TubeGeometry(
                  uBarPath,
                  64,
                  verticalBarDiameter / 2,
                  8,
                  false
                );

                return (
                  <mesh
                    key={`u-bar-${i}`}
                    geometry={uBarGeometry}
                    material={verticalBarMaterial}
                    position={[x, 0, kickerHeight + wallHeight]}
                    rotation={[Math.PI / 2, 0, Math.PI / 2]}
                  />
                );
              }
            )}
          </group>

          {/* Horizontal Bars - Near Face (outside vertical bars) */}
          <group name="horizontal-bars-near">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = kickerHeight + i * horizontalBarSpacing;
              const y =
                -wallThickness / 2 +
                cover +
                verticalBarDiameter +
                horizontalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                horizontalBarDiameter / 2,
                horizontalBarDiameter / 2,
                wallLength,
                16
              );

              return (
                <mesh
                  key={`horiz-near-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Horizontal Bars - Far Face (outside vertical bars) */}
          <group name="horizontal-bars-far">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = kickerHeight + i * horizontalBarSpacing;
              const y =
                wallThickness / 2 -
                cover -
                verticalBarDiameter -
                horizontalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                horizontalBarDiameter / 2,
                horizontalBarDiameter / 2,
                wallLength,
                16
              );

              return (
                <mesh
                  key={`horiz-far-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Compression lap + 150 annotation */}
          {/* Kicker: 75 (150 below ground) */}
          {/* 450mm minimum horizontal leg */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MW2: WALLS - CORNER DETAILS (Detail A and Detail B)
// ============================================================================

/**
 * MW2: Walls - Corner Details
 * Shows corner reinforcement with:
 * - Detail A: Standard corner (two bars in loop, tension lap)
 * - Detail B: Large opening moments (four bars in loop for thick walls)
 * - Two bars within loop for wall thickness ≤ 300mm
 * - Four bars for wall thickness > 300mm
 * - U-bars same size and pitch as horizontal bars
 * - Tension lap requirements
 *
 * @param {Object} props
 */
export function DrawWallMW2({
  wall1Length = 4.0,
  wall2Length = 4.0,
  wallHeight = 3.0,
  wallThickness = 0.25,
  cover = 0.03,
  verticalBarDiameter = 0.012,
  verticalBarSpacing = 0.2,
  horizontalBarDiameter = 0.01,
  horizontalBarSpacing = 0.2,
  detailType = "A", // 'A' or 'B'
  colors = {
    concrete: "#a8a8a8",
    verticalRebar: "#cc3333",
    horizontalRebar: "#cc8833",
    cornerBars: "#ff6600",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const tensionLap = verticalBarDiameter * 54;
  const numBarsInLoop = wallThickness > 0.3 ? 4 : 2;

  const wall1Geometry = useMemo(
    () => new THREE.BoxGeometry(wall1Length, wallThickness, wallHeight),
    [wall1Length, wallThickness, wallHeight]
  );

  const wall2Geometry = useMemo(
    () => new THREE.BoxGeometry(wallThickness, wall2Length, wallHeight),
    [wallThickness, wall2Length, wallHeight]
  );

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

  const verticalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.verticalRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.verticalRebar, wireframe]
  );

  const horizontalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.horizontalRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.horizontalRebar, wireframe]
  );

  const cornerBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.cornerBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.cornerBars, wireframe]
  );

  const numVerticalBarsWall1 = Math.floor(wall1Length / verticalBarSpacing) + 1;
  const numVerticalBarsWall2 = Math.floor(wall2Length / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(wallHeight / horizontalBarSpacing) + 1;

  // Create corner L-bar path
  const createCornerLBar = (isInner = true) => {
    const path = new THREE.CurvePath();
    const bendRadius = verticalBarDiameter * 2;
    const legLength1 = tensionLap;
    const legLength2 = tensionLap;

    const offset = isInner
      ? cover + verticalBarDiameter / 2
      : cover + verticalBarDiameter * 1.5;

    // Horizontal leg along wall 1
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-legLength1, offset - wallThickness / 2, 0),
        new THREE.Vector3(-bendRadius, offset - wallThickness / 2, 0)
      )
    );

    // 90 degree bend at corner
    const arc = new THREE.ArcCurve(
      -bendRadius,
      offset - wallThickness / 2 + bendRadius,
      bendRadius,
      -Math.PI / 2,
      0,
      false
    );
    const arcPoints = arc.getPoints(12);
    const arc3D = arcPoints.map((p) => new THREE.Vector3(p.x, p.y, 0));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Horizontal leg along wall 2
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(
          -bendRadius * 2,
          offset - wallThickness / 2 + bendRadius,
          0
        ),
        new THREE.Vector3(
          -bendRadius * 2,
          offset - wallThickness / 2 + bendRadius + legLength2,
          0
        )
      )
    );

    return path;
  };

  return (
    <group name="MW2-Wall-Corner-Details">
      {/* Wall 1 (along X-axis) */}
      {showConcrete && (
        <mesh
          geometry={wall1Geometry}
          material={concreteMaterial}
          position={[-wall1Length / 2, 0, wallHeight / 2]}
        />
      )}

      {/* Wall 2 (along Y-axis) */}
      {showConcrete && (
        <mesh
          geometry={wall2Geometry}
          material={concreteMaterial}
          position={[0, wall2Length / 2, wallHeight / 2]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical Bars - Wall 1 Near Face */}
          <group name="vertical-wall1-near">
            {Array.from({ length: numVerticalBarsWall1 }).map((_, i) => {
              const x = -wall1Length + i * verticalBarSpacing;
              const y = -wallThickness / 2 + cover + verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`v-w1-near-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Wall 1 Far Face */}
          <group name="vertical-wall1-far">
            {Array.from({ length: numVerticalBarsWall1 }).map((_, i) => {
              const x = -wall1Length + i * verticalBarSpacing;
              const y = wallThickness / 2 - cover - verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`v-w1-far-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Wall 2 Near Face */}
          <group name="vertical-wall2-near">
            {Array.from({ length: numVerticalBarsWall2 }).map((_, i) => {
              const y = i * verticalBarSpacing;
              const x = -wallThickness / 2 + cover + verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`v-w2-near-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Wall 2 Far Face */}
          <group name="vertical-wall2-far">
            {Array.from({ length: numVerticalBarsWall2 }).map((_, i) => {
              const y = i * verticalBarSpacing;
              const x = wallThickness / 2 - cover - verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`v-w2-far-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Corner L-bars (2 or 4 bars depending on wall thickness) */}
          <group name="corner-l-bars">
            {Array.from({ length: numHorizontalBars }).map((_, heightIdx) => {
              const z = heightIdx * horizontalBarSpacing;

              return (
                <group key={`corner-group-${heightIdx}`}>
                  {/* Inner face L-bar */}
                  <mesh
                    geometry={
                      new THREE.TubeGeometry(
                        createCornerLBar(true),
                        64,
                        verticalBarDiameter / 2,
                        8,
                        false
                      )
                    }
                    material={cornerBarMaterial}
                    position={[0, 0, z]}
                  />

                  {/* Outer face L-bar */}
                  <mesh
                    geometry={
                      new THREE.TubeGeometry(
                        createCornerLBar(false),
                        64,
                        verticalBarDiameter / 2,
                        8,
                        false
                      )
                    }
                    material={cornerBarMaterial}
                    position={[0, 0, z]}
                  />

                  {/* Additional bars for Detail B (thick walls > 300mm) */}
                  {detailType === "B" && wallThickness > 0.3 && (
                    <>
                      <mesh
                        geometry={
                          new THREE.TubeGeometry(
                            createCornerLBar(true),
                            64,
                            verticalBarDiameter / 2,
                            8,
                            false
                          )
                        }
                        material={cornerBarMaterial}
                        position={[0, 0, z]}
                        rotation={[0, 0, Math.PI]}
                      />
                      <mesh
                        geometry={
                          new THREE.TubeGeometry(
                            createCornerLBar(false),
                            64,
                            verticalBarDiameter / 2,
                            8,
                            false
                          )
                        }
                        material={cornerBarMaterial}
                        position={[0, 0, z]}
                        rotation={[0, 0, Math.PI]}
                      />
                    </>
                  )}
                </group>
              );
            })}
          </group>

          {/* Horizontal Bars - Wall 1 */}
          <group name="horizontal-wall1">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = i * horizontalBarSpacing;

              return (
                <React.Fragment key={`h-w1-${i}`}>
                  <mesh
                    geometry={
                      new THREE.CylinderGeometry(
                        horizontalBarDiameter / 2,
                        horizontalBarDiameter / 2,
                        wall1Length - tensionLap,
                        16
                      )
                    }
                    material={horizontalBarMaterial}
                    position={[
                      -wall1Length / 2 - tensionLap / 2,
                      -wallThickness / 2 +
                        cover +
                        verticalBarDiameter +
                        horizontalBarDiameter / 2,
                      z,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  <mesh
                    geometry={
                      new THREE.CylinderGeometry(
                        horizontalBarDiameter / 2,
                        horizontalBarDiameter / 2,
                        wall1Length - tensionLap,
                        16
                      )
                    }
                    material={horizontalBarMaterial}
                    position={[
                      -wall1Length / 2 - tensionLap / 2,
                      wallThickness / 2 -
                        cover -
                        verticalBarDiameter -
                        horizontalBarDiameter / 2,
                      z,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Horizontal Bars - Wall 2 */}
          <group name="horizontal-wall2">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = i * horizontalBarSpacing;

              return (
                <React.Fragment key={`h-w2-${i}`}>
                  <mesh
                    geometry={
                      new THREE.CylinderGeometry(
                        horizontalBarDiameter / 2,
                        horizontalBarDiameter / 2,
                        wall2Length - tensionLap,
                        16
                      )
                    }
                    material={horizontalBarMaterial}
                    position={[
                      -wallThickness / 2 +
                        cover +
                        verticalBarDiameter +
                        horizontalBarDiameter / 2,
                      wall2Length / 2 - tensionLap / 2,
                      z,
                    ]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                  <mesh
                    geometry={
                      new THREE.CylinderGeometry(
                        horizontalBarDiameter / 2,
                        horizontalBarDiameter / 2,
                        wall2Length - tensionLap,
                        16
                      )
                    }
                    material={horizontalBarMaterial}
                    position={[
                      wallThickness / 2 -
                        cover -
                        verticalBarDiameter -
                        horizontalBarDiameter / 2,
                      wall2Length / 2 - tensionLap / 2,
                      z,
                    ]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                </React.Fragment>
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Detail type (A or B) */}
          {/* Number of bars in loop */}
          {/* Tension lap lengths */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MW3: WALLS - HALF LANDING DETAIL
// ============================================================================

/**
 * MW3: Walls - Half Landing Detail
 * Shows connection of half landing to wall with:
 * - Pre-bent bars fitting flush with shutter
 * - Tension lap requirements
 * - Two fixing bars inside U-bars
 * - 35mm cover typical
 * - Horizontal wall reinforcement not shown for clarity
 * - Bars detailed with wall
 */
export function DrawWallMW3({
  wallLength = 4.0,
  wallHeight = 3.0,
  wallThickness = 0.2,
  landingWidth = 1.5,
  landingThickness = 0.2,
  landingLevel = 1.5, // Height where landing connects
  cover = 0.035,
  landingBarDiameter = 0.012,
  landingBarSpacing = 0.15,
  uBarDiameter = 0.012,
  fixingBarDiameter = 0.01,
  colors = {
    concrete: "#a8a8a8",
    landing: "#999999",
    wallRebar: "#cc3333",
    landingBars: "#cc8833",
    uBars: "#3366cc",
    fixingBars: "#ff6600",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const tensionLap = landingBarDiameter * 42;
  const numLandingBars = Math.floor(landingWidth / landingBarSpacing) + 1;

  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
  );

  const landingGeometry = useMemo(
    () => new THREE.BoxGeometry(landingWidth, landingThickness, wallLength),
    [landingWidth, landingThickness, wallLength]
  );

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

  const landingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.landing,
        transparent: true,
        opacity: opacity * 0.8,
        wireframe: wireframe,
      }),
    [colors.landing, opacity, wireframe]
  );

  const wallRebarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.wallRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.wallRebar, wireframe]
  );

  const landingBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.landingBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.landingBars, wireframe]
  );

  const uBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.uBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.uBars, wireframe]
  );

  const fixingBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.fixingBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.fixingBars, wireframe]
  );

  // Create pre-bent U-bar path that fits flush with shutter
  const createPrebentUBar = () => {
    const path = new THREE.CurvePath();
    const bendRadius = uBarDiameter * 2;
    const embedmentInWall = tensionLap;
    const extensionIntoLanding = landingWidth - cover * 2;

    // Horizontal section embedded in wall
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, embedmentInWall)
      )
    );

    // 90 degree bend
    const arc = new THREE.ArcCurve(
      bendRadius,
      embedmentInWall,
      bendRadius,
      Math.PI,
      Math.PI / 2,
      true
    );
    const arcPoints = arc.getPoints(12);
    const arc3D = arcPoints.map((p) => new THREE.Vector3(p.x, 0, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Horizontal section extending into landing
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(bendRadius, 0, embedmentInWall + bendRadius),
        new THREE.Vector3(
          bendRadius + extensionIntoLanding,
          0,
          embedmentInWall + bendRadius
        )
      )
    );

    return path;
  };

  const prebentUBarPath = createPrebentUBar();

  return (
    <group name="MW3-Wall-Half-Landing-Detail">
      {/* Wall */}
      {showConcrete && (
        <mesh
          geometry={wallGeometry}
          material={concreteMaterial}
          position={[0, 0, wallHeight / 2]}
        />
      )}

      {/* Half Landing */}
      {showConcrete && (
        <mesh
          geometry={landingGeometry}
          material={landingMaterial}
          position={[wallThickness / 2 + landingWidth / 2, 0, landingLevel]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Pre-bent U-bars from wall into landing */}
          <group name="prebent-u-bars">
            {Array.from({ length: numLandingBars }).map((_, i) => {
              const y = -wallLength / 2 + i * landingBarSpacing;
              const x = wallThickness / 2 - cover - uBarDiameter / 2;

              const uBarGeometry = new THREE.TubeGeometry(
                prebentUBarPath,
                64,
                uBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`u-bar-${i}`}
                  geometry={uBarGeometry}
                  material={uBarMaterial}
                  position={[x, y, landingLevel]}
                  rotation={[0, Math.PI / 2, 0]}
                />
              );
            })}
          </group>

          {/* Two fixing bars placed inside U-bars */}
          <group name="fixing-bars">
            {[-landingWidth / 4, landingWidth / 4].map((offset, idx) => {
              const fixingBarGeometry = new THREE.CylinderGeometry(
                fixingBarDiameter / 2,
                fixingBarDiameter / 2,
                wallLength,
                16
              );

              return (
                <mesh
                  key={`fixing-bar-${idx}`}
                  geometry={fixingBarGeometry}
                  material={fixingBarMaterial}
                  position={[
                    wallThickness / 2 + offset,
                    0,
                    landingLevel + tensionLap / 2,
                  ]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Main landing bars (top) */}
          <group name="landing-top-bars">
            {Array.from({ length: numLandingBars }).map((_, i) => {
              const y = -wallLength / 2 + i * landingBarSpacing;
              const x = wallThickness / 2 + landingWidth / 2;
              const z =
                landingLevel +
                landingThickness / 2 -
                cover -
                landingBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                landingBarDiameter / 2,
                landingBarDiameter / 2,
                landingWidth,
                16
              );

              return (
                <mesh
                  key={`landing-top-${i}`}
                  geometry={barGeometry}
                  material={landingBarMaterial}
                  position={[x, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Main landing bars (bottom) */}
          <group name="landing-bottom-bars">
            {Array.from({ length: numLandingBars }).map((_, i) => {
              const y = -wallLength / 2 + i * landingBarSpacing;
              const x = wallThickness / 2 + landingWidth / 2;
              const z =
                landingLevel -
                landingThickness / 2 +
                cover +
                landingBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                landingBarDiameter / 2,
                landingBarDiameter / 2,
                landingWidth,
                16
              );

              return (
                <mesh
                  key={`landing-bottom-${i}`}
                  geometry={barGeometry}
                  material={landingBarMaterial}
                  position={[x, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Wall vertical bars (shown for context) */}
          <group name="wall-vertical-bars">
            {Array.from({ length: Math.floor(wallLength / 0.2) + 1 }).map(
              (_, i) => {
                const y = -wallLength / 2 + i * 0.2;
                const x = wallThickness / 2 - cover - 0.012 / 2;

                const barGeometry = new THREE.CylinderGeometry(
                  0.012 / 2,
                  0.012 / 2,
                  wallHeight,
                  16
                );

                return (
                  <mesh
                    key={`wall-vert-${i}`}
                    geometry={barGeometry}
                    material={wallRebarMaterial}
                    position={[x, y, wallHeight / 2]}
                  />
                );
              }
            )}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Tension lap annotation */}
          {/* 35mm cover specification */}
          {/* Pre-bent bars note */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MW4: WALLS - HOLE DETAILS
// ============================================================================

/**
 * MW4: Walls - Hole Details
 * Shows trimming reinforcement around openings with:
 * - Trimmer bars (one size larger than vertical bars)
 * - Trimmer bars above and below opening
 * - Trimmer bars at sides of opening
 * - Tension anchorage length beyond trimmer bars
 * - For walls < 250mm thick, only one trimmer bar of equivalent area
 * - For walls ≤ 200mm thick, only one trimmer bar on each side
 * - Compression lap unless specified otherwise
 */
export function DrawWallMW4({
  wallLength = 6.0,
  wallHeight = 3.0,
  wallThickness = 0.25,
  holeWidth = 1.0,
  holeHeight = 1.2,
  holePositionX = 0, // Center of hole relative to wall center
  holePositionZ = 1.5, // Bottom of hole from ground
  cover = 0.03,
  verticalBarDiameter = 0.012,
  verticalBarSpacing = 0.2,
  horizontalBarDiameter = 0.01,
  horizontalBarSpacing = 0.2,
  trimmerBarDiameter = 0.016, // One size larger
  colors = {
    concrete: "#a8a8a8",
    verticalRebar: "#cc3333",
    horizontalRebar: "#cc8833",
    trimmerBars: "#ff6600",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const tensionAnchorage = trimmerBarDiameter * 36;
  const compressionLap = verticalBarDiameter * 54;
  const numTrimmerBarsVertical = wallThickness >= 0.25 ? 2 : 1;
  const numTrimmerBarsHorizontal = wallThickness > 0.2 ? 2 : 1;

  // Calculate wall geometry with hole
  const wallGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const hw = wallLength / 2;
    const hh = wallHeight / 2;

    // Outer rectangle
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.lineTo(-hw, -hh);

    // Hole (subtract)
    const holePath = new THREE.Path();
    const holeLeft = holePositionX - holeWidth / 2;
    const holeRight = holePositionX + holeWidth / 2;
    const holeBottom = holePositionZ - wallHeight / 2;
    const holeTop = holeBottom + holeHeight;

    holePath.moveTo(holeLeft, holeBottom);
    holePath.lineTo(holeRight, holeBottom);
    holePath.lineTo(holeRight, holeTop);
    holePath.lineTo(holeLeft, holeTop);
    holePath.lineTo(holeLeft, holeBottom);

    shape.holes.push(holePath);

    const extrudeSettings = {
      depth: wallThickness,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(0, 0, 0);

    return geometry;
  }, [
    wallLength,
    wallHeight,
    wallThickness,
    holeWidth,
    holeHeight,
    holePositionX,
    holePositionZ,
  ]);

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

  const verticalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.verticalRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.verticalRebar, wireframe]
  );

  const horizontalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.horizontalRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.horizontalRebar, wireframe]
  );

  const trimmerBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.trimmerBars,
        metalness: 0.8,
        roughness: 0.2,
        wireframe: wireframe,
      }),
    [colors.trimmerBars, wireframe]
  );

  const numVerticalBars = Math.floor(wallLength / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(wallHeight / horizontalBarSpacing) + 1;

  // Calculate hole boundaries
  const holeLeft = holePositionX - holeWidth / 2;
  const holeRight = holePositionX + holeWidth / 2;
  const holeBottom = holePositionZ;
  const holeTop = holePositionZ + holeHeight;

  return (
    <group name="MW4-Wall-Hole-Details">
      {/* Wall with Hole */}
      {showConcrete && (
        <mesh
          geometry={wallGeometry}
          material={concreteMaterial}
          position={[0, 0, wallHeight / 2]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical Bars - Near Face (avoiding hole) */}
          <group name="vertical-bars-near">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y = -wallThickness / 2 + cover + verticalBarDiameter / 2;

              // Skip bars that would pass through hole
              if (x > holeLeft && x < holeRight) {
                return null;
              }

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-near-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Far Face (avoiding hole) */}
          <group name="vertical-bars-far">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y = wallThickness / 2 - cover - verticalBarDiameter / 2;

              // Skip bars that would pass through hole
              if (x > holeLeft && x < holeRight) {
                return null;
              }

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-far-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Horizontal Bars - Near Face (avoiding hole) */}
          <group name="horizontal-bars-near">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = i * horizontalBarSpacing;
              const y =
                -wallThickness / 2 +
                cover +
                verticalBarDiameter +
                horizontalBarDiameter / 2;

              // Skip bars that would pass through hole
              if (z > holeBottom && z < holeTop) {
                return null;
              }

              const barGeometry = new THREE.CylinderGeometry(
                horizontalBarDiameter / 2,
                horizontalBarDiameter / 2,
                wallLength,
                16
              );

              return (
                <mesh
                  key={`horiz-near-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Horizontal Bars - Far Face (avoiding hole) */}
          <group name="horizontal-bars-far">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = i * horizontalBarSpacing;
              const y =
                wallThickness / 2 -
                cover -
                verticalBarDiameter -
                horizontalBarDiameter / 2;

              // Skip bars that would pass through hole
              if (z > holeBottom && z < holeTop) {
                return null;
              }

              const barGeometry = new THREE.CylinderGeometry(
                horizontalBarDiameter / 2,
                horizontalBarDiameter / 2,
                wallLength,
                16
              );

              return (
                <mesh
                  key={`horiz-far-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Trimmer Bars - Top of Hole */}
          <group name="trimmer-top">
            {Array.from({ length: numTrimmerBarsHorizontal }).map(
              (_, layerIdx) => {
                const yOffset =
                  layerIdx === 0
                    ? -wallThickness / 2 + cover + trimmerBarDiameter / 2
                    : wallThickness / 2 - cover - trimmerBarDiameter / 2;

                const trimmerLength = holeWidth + 2 * tensionAnchorage;

                const trimmerGeometry = new THREE.CylinderGeometry(
                  trimmerBarDiameter / 2,
                  trimmerBarDiameter / 2,
                  trimmerLength,
                  16
                );

                return (
                  <mesh
                    key={`trimmer-top-${layerIdx}`}
                    geometry={trimmerGeometry}
                    material={trimmerBarMaterial}
                    position={[
                      holePositionX,
                      yOffset,
                      holeTop + trimmerBarDiameter,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                );
              }
            )}
          </group>

          {/* Trimmer Bars - Bottom of Hole */}
          <group name="trimmer-bottom">
            {Array.from({ length: numTrimmerBarsHorizontal }).map(
              (_, layerIdx) => {
                const yOffset =
                  layerIdx === 0
                    ? -wallThickness / 2 + cover + trimmerBarDiameter / 2
                    : wallThickness / 2 - cover - trimmerBarDiameter / 2;

                const trimmerLength = holeWidth + 2 * tensionAnchorage;

                const trimmerGeometry = new THREE.CylinderGeometry(
                  trimmerBarDiameter / 2,
                  trimmerBarDiameter / 2,
                  trimmerLength,
                  16
                );

                return (
                  <mesh
                    key={`trimmer-bottom-${layerIdx}`}
                    geometry={trimmerGeometry}
                    material={trimmerBarMaterial}
                    position={[
                      holePositionX,
                      yOffset,
                      holeBottom - trimmerBarDiameter,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                );
              }
            )}
          </group>

          {/* Trimmer Bars - Left Side of Hole */}
          <group name="trimmer-left">
            {Array.from({ length: numTrimmerBarsVertical }).map(
              (_, layerIdx) => {
                const yOffset =
                  layerIdx === 0
                    ? -wallThickness / 2 + cover + trimmerBarDiameter / 2
                    : wallThickness / 2 - cover - trimmerBarDiameter / 2;

                const trimmerLength = holeHeight + 2 * tensionAnchorage;

                const trimmerGeometry = new THREE.CylinderGeometry(
                  trimmerBarDiameter / 2,
                  trimmerBarDiameter / 2,
                  trimmerLength,
                  16
                );

                return (
                  <mesh
                    key={`trimmer-left-${layerIdx}`}
                    geometry={trimmerGeometry}
                    material={trimmerBarMaterial}
                    position={[
                      holeLeft - trimmerBarDiameter,
                      yOffset,
                      holeBottom + holeHeight / 2,
                    ]}
                  />
                );
              }
            )}
          </group>

          {/* Trimmer Bars - Right Side of Hole */}
          <group name="trimmer-right">
            {Array.from({ length: numTrimmerBarsVertical }).map(
              (_, layerIdx) => {
                const yOffset =
                  layerIdx === 0
                    ? -wallThickness / 2 + cover + trimmerBarDiameter / 2
                    : wallThickness / 2 - cover - trimmerBarDiameter / 2;

                const trimmerLength = holeHeight + 2 * tensionAnchorage;

                const trimmerGeometry = new THREE.CylinderGeometry(
                  trimmerBarDiameter / 2,
                  trimmerBarDiameter / 2,
                  trimmerLength,
                  16
                );

                return (
                  <mesh
                    key={`trimmer-right-${layerIdx}`}
                    geometry={trimmerGeometry}
                    material={trimmerBarMaterial}
                    position={[
                      holeRight + trimmerBarDiameter,
                      yOffset,
                      holeBottom + holeHeight / 2,
                    ]}
                  />
                );
              }
            )}
          </group>

          {/* U-bars wrapping trimmer bars at corners */}
          <group name="u-bars-around-hole">
            {/* Top-left corner U-bar */}
            {/* Top-right corner U-bar */}
            {/* Bottom-left corner U-bar */}
            {/* Bottom-right corner U-bar */}
            {/* These would wrap around the trimmer bars - simplified here */}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Trimmer bar specification */}
          {/* Tension anchorage length */}
          {/* Hole dimensions */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// EXPORT ALL WALL DETAILS
// ============================================================================

/**
 * Complete wall detailing library following IStructE/Concrete Society standards.
 * Each component can be integrated with the StructuralVisualizationComponent.
 *
 * Usage example:
 * ```jsx
 * import { DrawWallMW1, DrawWallMW2, DrawWallMW3, DrawWallMW4 } from './wall-details-mw1-mw4';
 *
 * <DrawWallMW1
 *   wallLength={6.0}
 *   wallHeight={3.0}
 *   wallThickness={0.200}
 *   colors={colors}
 *   showConcrete={showConcrete}
 *   showRebar={showRebar}
 *   wireframe={wireframe}
 *   opacity={0.4}
 * />
 * ```
 */
