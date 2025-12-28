import * as THREE from "three";
import React, { useMemo } from "react";
import { Text } from "@react-three/drei";
import { Line } from "@react-three/drei";

// ============================================================================
// MF1: PAD FOOTINGS
// ============================================================================

/**
 * MF1: Pad Footings
 * Features:
 * - 75mm bottom cover (standard for foundations)
 * - Compression lap + 150mm for foundation level tolerance
 * - Kicker: 75mm above ground (150mm below ground)
 * - Main bars normally straight (may be bobbed if required)
 * - Column starter bars with 450mm minimum horizontal leg
 * - H10 links at 300mm spacing (minimum 3 No.)
 * - Cover to starter bars specified from column faces
 */
export function DrawPadFootingMF1({
  footingLength = 2.5,
  footingWidth = 2.5,
  footingDepth = 0.5,
  columnWidth = 0.4,
  columnDepth = 0.4,
  kickerHeight = 0.075,
  kickerBelowGround = 0.15,
  bottomCover = 0.075,
  sideCover = 0.075,
  starterBarDiameter = 0.02,
  numStarterBarsX = 4,
  numStarterBarsY = 4,
  starterBarProjection = 1.0,
  starterBarHorizontalLeg = 0.45,
  linkDiameter = 0.01,
  linkSpacing = 0.3,
  mainBarDiameterX = 0.02,
  mainBarSpacingX = 0.2,
  mainBarDiameterY = 0.02,
  mainBarSpacingY = 0.2,
  bobEnds = false,
  bobLength = 0.2,
  colors = {
    concrete: "#b8b8b8",
    kicker: "#a0a0a0",
    mainBars: "#cc3333",
    starterBars: "#3366cc",
    links: "#cc8833",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.5,
}) {
  const compressionLap = starterBarDiameter * 42; // Typical compression lap
  const toleranceAllowance = 0.15; // 150mm for foundation level tolerance
  const totalStarterLength = compressionLap + toleranceAllowance;

  // Geometries
  const footingGeometry = useMemo(
    () => new THREE.BoxGeometry(footingLength, footingWidth, footingDepth),
    [footingLength, footingWidth, footingDepth]
  );

  const kickerGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, kickerHeight),
    [columnWidth, columnDepth, kickerHeight]
  );

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

  const kickerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.kicker,
        transparent: true,
        opacity: opacity * 0.9,
        wireframe: wireframe,
      }),
    [colors.kicker, opacity, wireframe]
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

  const starterBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.starterBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.starterBars]
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

  // Calculate number of bars
  const numMainBarsX = Math.floor(footingLength / mainBarSpacingX) + 1;
  const numMainBarsY = Math.floor(footingWidth / mainBarSpacingY) + 1;
  const numLinks = Math.max(
    3,
    Math.floor((totalStarterLength + kickerHeight) / linkSpacing)
  );

  // Create L-shaped starter bar path
  const createStarterBarPath = () => {
    const path = new THREE.CurvePath();

    // Horizontal leg in footing
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(starterBarHorizontalLeg, 0, 0)
      )
    );

    // Vertical leg projecting up
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(starterBarHorizontalLeg, 0, 0),
        new THREE.Vector3(
          starterBarHorizontalLeg,
          0,
          footingDepth + kickerHeight + totalStarterLength
        )
      )
    );

    return path;
  };

  const starterBarPath = createStarterBarPath();

  // Create bobbed bar end path (if required)
  const createBobbedBarPath = (barLength, isYDirection = false) => {
    const path = new THREE.CurvePath();
    const bendRadius = mainBarDiameterX * 2;

    // Main horizontal section
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(barLength - bobLength - bendRadius, 0, 0)
      )
    );

    // Bend up
    const arc = new THREE.ArcCurve(
      barLength - bobLength - bendRadius,
      0,
      bendRadius,
      0,
      Math.PI / 2,
      false
    );
    const arcPoints = arc.getPoints(8);
    const arc3D = arcPoints.map((p) => new THREE.Vector3(p.x, 0, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Vertical bob section
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(barLength - bobLength, 0, bendRadius),
        new THREE.Vector3(
          barLength - bobLength,
          0,
          bendRadius + bobLength - bendRadius
        )
      )
    );

    return path;
  };

  return (
    <group name="MF1-Pad-Footing">
      {/* Footing Base */}
      {showConcrete && (
        <mesh
          geometry={footingGeometry}
          material={concreteMaterial}
          position={[0, 0, footingDepth / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Kicker */}
      {showConcrete && (
        <mesh
          geometry={kickerGeometry}
          material={kickerMaterial}
          position={[0, 0, footingDepth + kickerHeight / 2]}
          castShadow
        />
      )}

      {/* Main Reinforcement */}
      {showRebar && (
        <group name="main-reinforcement">
          {/* Main bars parallel to X-axis (bottom layer) */}
          <group name="main-bars-x-direction">
            {Array.from({ length: numMainBarsY }).map((_, i) => {
              const y = -footingWidth / 2 + i * mainBarSpacingY;
              const z = bottomCover + mainBarDiameterX / 2;

              let barGeometry;
              if (bobEnds) {
                const bobbedPath = createBobbedBarPath(footingLength);
                barGeometry = new THREE.TubeGeometry(
                  bobbedPath,
                  64,
                  mainBarDiameterX / 2,
                  8,
                  false
                );
              } else {
                barGeometry = new THREE.CylinderGeometry(
                  mainBarDiameterX / 2,
                  mainBarDiameterX / 2,
                  footingLength,
                  16
                );
              }

              return (
                <mesh
                  key={`main-x-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={bobEnds ? [-footingLength / 2, y, z] : [0, y, z]}
                  rotation={bobEnds ? [0, 0, 0] : [0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Main bars parallel to Y-axis (top layer) */}
          <group name="main-bars-y-direction">
            {Array.from({ length: numMainBarsX }).map((_, i) => {
              const x = -footingLength / 2 + i * mainBarSpacingX;
              const z = bottomCover + mainBarDiameterX + mainBarDiameterY / 2;

              let barGeometry;
              if (bobEnds) {
                const bobbedPath = createBobbedBarPath(footingWidth);
                barGeometry = new THREE.TubeGeometry(
                  bobbedPath,
                  64,
                  mainBarDiameterY / 2,
                  8,
                  false
                );
              } else {
                barGeometry = new THREE.CylinderGeometry(
                  mainBarDiameterY / 2,
                  mainBarDiameterY / 2,
                  footingWidth,
                  16
                );
              }

              return (
                <mesh
                  key={`main-y-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={bobEnds ? [x, -footingWidth / 2, z] : [x, 0, z]}
                  rotation={bobEnds ? [0, Math.PI / 2, 0] : [Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Column Starter Bars */}
      {showRebar && (
        <group name="column-starter-bars">
          {/* Starter bars in X-direction */}
          {Array.from({ length: numStarterBarsY }).map((_, i) => {
            const y =
              -columnDepth / 2 + (columnDepth / (numStarterBarsY - 1)) * i;
            const z = bottomCover + mainBarDiameterX + mainBarDiameterY;

            // Calculate x positions for bars at column edges
            const positions = [
              -columnWidth / 2 + sideCover + starterBarDiameter / 2,
              columnWidth / 2 - sideCover - starterBarDiameter / 2,
            ];

            return positions.map((x, idx) => {
              const starterGeometry = new THREE.TubeGeometry(
                starterBarPath,
                64,
                starterBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`starter-x-${i}-${idx}`}
                  geometry={starterGeometry}
                  material={starterBarMaterial}
                  position={[x - starterBarHorizontalLeg, y, z]}
                />
              );
            });
          })}

          {/* Starter bars in Y-direction */}
          {Array.from({ length: numStarterBarsX }).map((_, i) => {
            const x =
              -columnWidth / 2 + (columnWidth / (numStarterBarsX - 1)) * i;
            const z = bottomCover + mainBarDiameterX + mainBarDiameterY;

            // Calculate y positions for bars at column edges
            const positions = [
              -columnDepth / 2 + sideCover + starterBarDiameter / 2,
              columnDepth / 2 - sideCover - starterBarDiameter / 2,
            ];

            return positions.map((y, idx) => {
              const starterGeometry = new THREE.TubeGeometry(
                starterBarPath,
                64,
                starterBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`starter-y-${i}-${idx}`}
                  geometry={starterGeometry}
                  material={starterBarMaterial}
                  position={[x, y - starterBarHorizontalLeg, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            });
          })}
        </group>
      )}

      {/* Links (H10 @ 300mm, minimum 3 No.) */}
      {showRebar && (
        <group name="links">
          {Array.from({ length: numLinks }).map((_, i) => {
            const z = footingDepth + kickerHeight + i * linkSpacing;
            const linkWidth = columnWidth - 2 * sideCover - starterBarDiameter;
            const linkDepth = columnDepth - 2 * sideCover - starterBarDiameter;

            // Create rectangular link path
            const linkPath = new THREE.CurvePath();
            const hw = linkWidth / 2;
            const hd = linkDepth / 2;

            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(-hw, -hd, 0),
                new THREE.Vector3(hw, -hd, 0)
              )
            );
            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(hw, -hd, 0),
                new THREE.Vector3(hw, hd, 0)
              )
            );
            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(hw, hd, 0),
                new THREE.Vector3(-hw, hd, 0)
              )
            );
            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(-hw, hd, 0),
                new THREE.Vector3(-hw, -hd, 0)
              )
            );

            const linkGeometry = new THREE.TubeGeometry(
              linkPath,
              32,
              linkDiameter / 2,
              8,
              true
            );

            return (
              <mesh
                key={`link-${i}`}
                geometry={linkGeometry}
                material={linkMaterial}
                position={[0, 0, z]}
              />
            );
          })}
        </group>
      )}

      {/* Labels and Annotations */}
      {showLabels && (
        <group name="labels">
          {/* Footing level label */}
          <Text
            position={[footingLength / 2 + 0.5, 0, footingDepth]}
            fontSize={0.12}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            Footing Level
          </Text>

          {/* 75mm cover annotation */}
          <Text
            position={[footingLength / 2 + 0.5, footingWidth / 2, bottomCover]}
            fontSize={0.1}
            color="red"
            anchorX="left"
            anchorY="middle"
          >
            75mm Cover
          </Text>

          {/* Kicker annotation */}
          <Text
            position={[
              -footingLength / 2 - 0.5,
              0,
              footingDepth + kickerHeight / 2,
            ]}
            fontSize={0.1}
            color="blue"
            anchorX="right"
            anchorY="middle"
          >
            Kicker: 75mm
          </Text>

          {/* Compression lap + 150 annotation */}
          <Text
            position={[
              columnWidth / 2 + 0.3,
              columnDepth / 2,
              footingDepth + kickerHeight + totalStarterLength / 2,
            ]}
            fontSize={0.09}
            color="blue"
            anchorX="left"
            anchorY="middle"
          >
            {`Comp. Lap + 150mm\n(${(totalStarterLength * 1000).toFixed(0)}mm)`}
          </Text>

          {/* 450mm min horizontal leg */}
          <Text
            position={[
              -columnWidth / 2 - starterBarHorizontalLeg / 2,
              -columnDepth / 2 - 0.2,
              bottomCover + mainBarDiameterX + mainBarDiameterY,
            ]}
            fontSize={0.08}
            color="blue"
            anchorX="center"
            anchorY="top"
          >
            450mm min.
          </Text>
        </group>
      )}

      {/* Dimension Lines */}
      {showLabels && (
        <group name="dimension-lines">
          {/* Footing length dimension */}
          <Line
            points={[
              [-footingLength / 2, -footingWidth / 2 - 0.3, 0],
              [footingLength / 2, -footingWidth / 2 - 0.3, 0],
            ]}
            color="black"
            lineWidth={1}
          />
          <Text
            position={[0, -footingWidth / 2 - 0.4, 0]}
            fontSize={0.1}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            {`${(footingLength * 1000).toFixed(0)}mm`}
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MF2: PILE CAPS
// ============================================================================

/**
 * MF2: Pile Caps
 * Features:
 * - 100mm bottom cover (allows for pile head projection)
 * - Main bars bent at both ends (bob specified by design)
 * - Bars rest on top of piles
 * - 2 layers of lacers (H12)
 * - Large radius bend if specified (corner bar shifted accordingly)
 * - Compression lap + 150mm for foundation level tolerance
 * - Kicker: 75mm above (150mm below ground)
 * - H10 links @ 300mm (minimum 3 No.)
 */
export function DrawPileCapMF2({
  pileCapLength = 3.0,
  pileCapWidth = 3.0,
  pileCapDepth = 0.8,
  columnWidth = 0.4,
  columnDepth = 0.4,
  numPiles = 4,
  pilePositions = [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ],
  pileDiameter = 0.45,
  pileProjection = 0.1,
  kickerHeight = 0.075,
  kickerBelowGround = 0.15,
  bottomCover = 0.1,
  sideCover = 0.075,
  starterBarDiameter = 0.025,
  numStarterBarsX = 4,
  numStarterBarsY = 4,
  starterBarProjection = 1.0,
  mainBarDiameterX = 0.025,
  mainBarSpacingX = 0.2,
  mainBarDiameterY = 0.025,
  mainBarSpacingY = 0.2,
  bobLength = 0.25,
  lacerDiameter = 0.012,
  linkDiameter = 0.01,
  linkSpacing = 0.3,
  largeRadiusBend = false,
  bendRadius = 0.1,
  colors = {
    concrete: "#b8b8b8",
    piles: "#888888",
    kicker: "#a0a0a0",
    mainBars: "#cc3333",
    starterBars: "#3366cc",
    lacers: "#ff6600",
    links: "#cc8833",
  },
  showConcrete = true,
  showRebar = true,
  showPiles = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.5,
}) {
  const compressionLap = starterBarDiameter * 42;
  const totalStarterLength = compressionLap + 0.15; // + 150mm tolerance

  // Geometries
  const pileCapGeometry = useMemo(
    () => new THREE.BoxGeometry(pileCapLength, pileCapWidth, pileCapDepth),
    [pileCapLength, pileCapWidth, pileCapDepth]
  );

  const kickerGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, kickerHeight),
    [columnWidth, columnDepth, kickerHeight]
  );

  const pileGeometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        pileDiameter / 2,
        pileDiameter / 2,
        pileProjection + 0.5,
        32
      ),
    [pileDiameter, pileProjection]
  );

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

  const pileMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.piles,
        transparent: true,
        opacity: opacity * 0.8,
      }),
    [colors.piles, opacity]
  );

  const kickerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.kicker,
        transparent: true,
        opacity: opacity * 0.9,
      }),
    [colors.kicker, opacity]
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

  const starterBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.starterBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.starterBars]
  );

  const lacerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.lacers,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.lacers]
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

  const numMainBarsX = Math.floor(pileCapLength / mainBarSpacingX) + 1;
  const numMainBarsY = Math.floor(pileCapWidth / mainBarSpacingY) + 1;
  const numLinks = Math.max(
    3,
    Math.floor((totalStarterLength + kickerHeight) / linkSpacing)
  );

  // Create bobbed bar path for pile caps
  const createPileCapBobbedBar = (barLength, diameter) => {
    const path = new THREE.CurvePath();
    const radius = largeRadiusBend ? bendRadius : diameter * 2;
    const anchorageFromEdge = 0.075; // Distance from edge to start of bob

    // Start bob (left side)
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-barLength / 2, 0, bobLength),
        new THREE.Vector3(-barLength / 2, 0, radius)
      )
    );

    // Bend down (left)
    const arcLeft = new THREE.ArcCurve(
      -barLength / 2 + radius,
      0,
      radius,
      Math.PI / 2,
      0,
      true
    );
    const arcLeftPoints = arcLeft.getPoints(8);
    const arcLeft3D = arcLeftPoints.map((p) => new THREE.Vector3(p.x, 0, p.y));
    for (let i = 0; i < arcLeft3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arcLeft3D[i], arcLeft3D[i + 1]));
    }

    // Horizontal main section
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-barLength / 2 + radius, 0, 0),
        new THREE.Vector3(barLength / 2 - radius, 0, 0)
      )
    );

    // Bend up (right)
    const arcRight = new THREE.ArcCurve(
      barLength / 2 - radius,
      0,
      radius,
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

    // End bob (right side)
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(barLength / 2, 0, radius),
        new THREE.Vector3(barLength / 2, 0, bobLength)
      )
    );

    return path;
  };

  // Create L-shaped starter bar
  const createStarterBarPath = () => {
    const path = new THREE.CurvePath();
    const horizontalLeg = 0.45; // 450mm minimum

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(horizontalLeg, 0, 0)
      )
    );

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(horizontalLeg, 0, 0),
        new THREE.Vector3(
          horizontalLeg,
          0,
          pileCapDepth + kickerHeight + totalStarterLength
        )
      )
    );

    return path;
  };

  const starterBarPath = createStarterBarPath();

  return (
    <group name="MF2-Pile-Cap">
      {/* Pile Cap */}
      {showConcrete && (
        <mesh
          geometry={pileCapGeometry}
          material={concreteMaterial}
          position={[0, 0, pileCapDepth / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Kicker */}
      {showConcrete && (
        <mesh
          geometry={kickerGeometry}
          material={kickerMaterial}
          position={[0, 0, pileCapDepth + kickerHeight / 2]}
          castShadow
        />
      )}

      {/* Piles */}
      {showPiles &&
        pilePositions.map((pos, idx) => (
          <mesh
            key={`pile-${idx}`}
            geometry={pileGeometry}
            material={pileMaterial}
            position={[
              pos[0],
              pos[1],
              -(pileProjection + 0.5) / 2 + pileProjection,
            ]}
          />
        ))}

      {/* Main Reinforcement with Bobbed Ends */}
      {showRebar && (
        <group name="main-reinforcement">
          {/* Main bars in X-direction (bottom layer) */}
          <group name="main-bars-x">
            {Array.from({ length: numMainBarsY }).map((_, i) => {
              const y = -pileCapWidth / 2 + i * mainBarSpacingY;
              const z = bottomCover + mainBarDiameterX / 2;

              const barPath = createPileCapBobbedBar(
                pileCapLength,
                mainBarDiameterX
              );
              const barGeometry = new THREE.TubeGeometry(
                barPath,
                64,
                mainBarDiameterX / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`main-x-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={[0, y, z]}
                />
              );
            })}
          </group>

          {/* Main bars in Y-direction (top layer) */}
          <group name="main-bars-y">
            {Array.from({ length: numMainBarsX }).map((_, i) => {
              const x = -pileCapLength / 2 + i * mainBarSpacingX;
              const z = bottomCover + mainBarDiameterX + mainBarDiameterY / 2;

              const barPath = createPileCapBobbedBar(
                pileCapWidth,
                mainBarDiameterY
              );
              const barGeometry = new THREE.TubeGeometry(
                barPath,
                64,
                mainBarDiameterY / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`main-y-${i}`}
                  geometry={barGeometry}
                  material={mainBarMaterial}
                  position={[x, 0, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* 2 Layers of Lacers (H12) */}
      {showRebar && (
        <group name="lacers">
          {/* First layer of lacers - X direction */}
          <group name="lacer-layer-1-x">
            {Array.from({ length: 3 }).map((_, i) => {
              const y = -pileCapWidth / 3 + i * (pileCapWidth / 3);
              const z =
                bottomCover +
                mainBarDiameterX +
                mainBarDiameterY +
                lacerDiameter / 2;

              const lacerGeometry = new THREE.CylinderGeometry(
                lacerDiameter / 2,
                lacerDiameter / 2,
                pileCapLength - 2 * sideCover,
                16
              );

              return (
                <mesh
                  key={`lacer-1x-${i}`}
                  geometry={lacerGeometry}
                  material={lacerMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Second layer of lacers - Y direction */}
          <group name="lacer-layer-2-y">
            {Array.from({ length: 3 }).map((_, i) => {
              const x = -pileCapLength / 3 + i * (pileCapLength / 3);
              const z =
                bottomCover +
                mainBarDiameterX +
                mainBarDiameterY +
                lacerDiameter * 1.5;

              const lacerGeometry = new THREE.CylinderGeometry(
                lacerDiameter / 2,
                lacerDiameter / 2,
                pileCapWidth - 2 * sideCover,
                16
              );

              return (
                <mesh
                  key={`lacer-2y-${i}`}
                  geometry={lacerGeometry}
                  material={lacerMaterial}
                  position={[x, 0, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Column Starter Bars */}
      {showRebar && (
        <group name="column-starters">
          {/* Corner starter bars */}
          {Array.from({ length: numStarterBarsY }).map((_, i) => {
            const y =
              -columnDepth / 2 + (columnDepth / (numStarterBarsY - 1)) * i;
            const z =
              bottomCover +
              mainBarDiameterX +
              mainBarDiameterY +
              lacerDiameter * 2;

            const positions = [
              -columnWidth / 2 + sideCover,
              columnWidth / 2 - sideCover,
            ];

            return positions.map((x, idx) => {
              const starterGeometry = new THREE.TubeGeometry(
                starterBarPath,
                64,
                starterBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`starter-x-${i}-${idx}`}
                  geometry={starterGeometry}
                  material={starterBarMaterial}
                  position={[x - 0.45, y, z]}
                />
              );
            });
          })}

          {Array.from({ length: numStarterBarsX }).map((_, i) => {
            const x =
              -columnWidth / 2 + (columnWidth / (numStarterBarsX - 1)) * i;
            const z =
              bottomCover +
              mainBarDiameterX +
              mainBarDiameterY +
              lacerDiameter * 2;

            const positions = [
              -columnDepth / 2 + sideCover,
              columnDepth / 2 - sideCover,
            ];

            return positions.map((y, idx) => {
              const starterGeometry = new THREE.TubeGeometry(
                starterBarPath,
                64,
                starterBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`starter-y-${i}-${idx}`}
                  geometry={starterGeometry}
                  material={starterBarMaterial}
                  position={[x, y - 0.45, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            });
          })}
        </group>
      )}

      {/* Links */}
      {showRebar && (
        <group name="links">
          {Array.from({ length: numLinks }).map((_, i) => {
            const z = pileCapDepth + kickerHeight + i * linkSpacing;
            const linkWidth = columnWidth - 2 * sideCover - starterBarDiameter;
            const linkDepth = columnDepth - 2 * sideCover - starterBarDiameter;

            const linkPath = new THREE.CurvePath();
            const hw = linkWidth / 2;
            const hd = linkDepth / 2;

            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(-hw, -hd, 0),
                new THREE.Vector3(hw, -hd, 0)
              )
            );
            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(hw, -hd, 0),
                new THREE.Vector3(hw, hd, 0)
              )
            );
            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(hw, hd, 0),
                new THREE.Vector3(-hw, hd, 0)
              )
            );
            linkPath.add(
              new THREE.LineCurve3(
                new THREE.Vector3(-hw, hd, 0),
                new THREE.Vector3(-hw, -hd, 0)
              )
            );

            const linkGeometry = new THREE.TubeGeometry(
              linkPath,
              32,
              linkDiameter / 2,
              8,
              true
            );

            return (
              <mesh
                key={`link-${i}`}
                geometry={linkGeometry}
                material={linkMaterial}
                position={[0, 0, z]}
              />
            );
          })}
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          <Text
            position={[pileCapLength / 2 + 0.5, 0, pileCapDepth]}
            fontSize={0.12}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            Pile Cap Level
          </Text>

          <Text
            position={[pileCapLength / 2 + 0.5, pileCapWidth / 2, bottomCover]}
            fontSize={0.1}
            color="red"
            anchorX="left"
            anchorY="middle"
          >
            100mm Cover
          </Text>

          <Text
            position={[
              -pileCapLength / 2 - 0.5,
              0,
              pileCapDepth + kickerHeight / 2,
            ]}
            fontSize={0.1}
            color="blue"
            anchorX="right"
            anchorY="middle"
          >
            Kicker: 75mm\n(150 below ground)
          </Text>

          <Text
            position={[
              0,
              -pileCapWidth / 2 - 0.3,
              bottomCover + mainBarDiameterX / 2,
            ]}
            fontSize={0.09}
            color="red"
            anchorX="center"
            anchorY="top"
          >
            Bars rest on piles
          </Text>

          <Text
            position={[
              -pileCapLength / 2 - 0.3,
              0,
              bottomCover + mainBarDiameterX + mainBarDiameterY + lacerDiameter,
            ]}
            fontSize={0.08}
            color="orange"
            anchorX="right"
            anchorY="middle"
          >
            2 Layers H12 Lacers
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MF3: MULTI-COLUMN BASE
// ============================================================================

/**
 * MF3: Multi-Column Base (Raft Foundation)
 * Features:
 * - 75mm bottom cover
 * - 40mm top cover (exposed concrete) / 50mm (buried concrete)
 * - 300mm minimum overlap at joints
 * - Distribution bars H16 @ 300mm centers
 * - Two layers of lacers (H12)
 * - Column starter bars as per MF1
 */
export function DrawMultiColumnBaseMF3({
  baseLength = 8.0,
  baseWidth = 6.0,
  baseDepth = 0.6,
  columnPositions = [
    [-2.5, -2.0],
    [2.5, -2.0],
    [-2.5, 2.0],
    [2.5, 2.0],
  ],
  columnWidth = 0.4,
  columnDepth = 0.4,
  kickerHeight = 0.075,
  bottomCover = 0.075,
  topCover = 0.04,
  sideCover = 0.075,
  mainBarDiameterX = 0.02,
  mainBarSpacingX = 0.2,
  mainBarDiameterY = 0.02,
  mainBarSpacingY = 0.2,
  distributionBarDiameter = 0.016,
  distributionBarSpacing = 0.3,
  lacerDiameter = 0.012,
  overlapLength = 0.3,
  starterBarDiameter = 0.02,
  numStarterBarsPerColumn = 4,
  colors = {
    concrete: "#b8b8b8",
    kicker: "#a0a0a0",
    bottomBars: "#cc3333",
    topBars: "#3366cc",
    distributionBars: "#ff6600",
    lacers: "#cc8833",
    starterBars: "#3366cc",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.5,
}) {
  const baseGeometry = useMemo(
    () => new THREE.BoxGeometry(baseLength, baseWidth, baseDepth),
    [baseLength, baseWidth, baseDepth]
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

  const kickerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.kicker,
        transparent: true,
        opacity: opacity * 0.9,
      }),
    [colors.kicker, opacity]
  );

  const bottomBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.bottomBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.bottomBars]
  );

  const topBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.topBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.topBars]
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

  const lacerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.lacers,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.lacers]
  );

  const starterBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.starterBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.starterBars]
  );

  const numMainBarsX = Math.floor(baseLength / mainBarSpacingX) + 1;
  const numMainBarsY = Math.floor(baseWidth / mainBarSpacingY) + 1;
  const numDistributionBarsX =
    Math.floor(baseLength / distributionBarSpacing) + 1;
  const numDistributionBarsY =
    Math.floor(baseWidth / distributionBarSpacing) + 1;

  return (
    <group name="MF3-Multi-Column-Base">
      {/* Base Slab */}
      {showConcrete && (
        <mesh
          geometry={baseGeometry}
          material={concreteMaterial}
          position={[0, 0, baseDepth / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Kickers for each column */}
      {showConcrete &&
        columnPositions.map((pos, idx) => {
          const kickerGeometry = new THREE.BoxGeometry(
            columnWidth,
            columnDepth,
            kickerHeight
          );
          return (
            <mesh
              key={`kicker-${idx}`}
              geometry={kickerGeometry}
              material={kickerMaterial}
              position={[pos[0], pos[1], baseDepth + kickerHeight / 2]}
              castShadow
            />
          );
        })}

      {/* Bottom Reinforcement */}
      {showRebar && (
        <group name="bottom-reinforcement">
          {/* Bottom bars in X direction */}
          <group name="bottom-bars-x">
            {Array.from({ length: numMainBarsY }).map((_, i) => {
              const y = -baseWidth / 2 + i * mainBarSpacingY;
              const z = bottomCover + mainBarDiameterX / 2;

              const barGeometry = new THREE.CylinderGeometry(
                mainBarDiameterX / 2,
                mainBarDiameterX / 2,
                baseLength - 2 * sideCover,
                16
              );

              return (
                <mesh
                  key={`bottom-x-${i}`}
                  geometry={barGeometry}
                  material={bottomBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Bottom bars in Y direction */}
          <group name="bottom-bars-y">
            {Array.from({ length: numMainBarsX }).map((_, i) => {
              const x = -baseLength / 2 + i * mainBarSpacingX;
              const z = bottomCover + mainBarDiameterX + mainBarDiameterY / 2;

              const barGeometry = new THREE.CylinderGeometry(
                mainBarDiameterY / 2,
                mainBarDiameterY / 2,
                baseWidth - 2 * sideCover,
                16
              );

              return (
                <mesh
                  key={`bottom-y-${i}`}
                  geometry={barGeometry}
                  material={bottomBarMaterial}
                  position={[x, 0, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Top Reinforcement (Distribution Bars H16 @ 300) */}
      {showRebar && (
        <group name="top-reinforcement">
          {/* Distribution bars in X direction */}
          <group name="distribution-bars-x">
            {Array.from({ length: numDistributionBarsY }).map((_, i) => {
              const y = -baseWidth / 2 + i * distributionBarSpacing;
              const z = baseDepth - topCover - distributionBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                distributionBarDiameter / 2,
                distributionBarDiameter / 2,
                baseLength - 2 * sideCover,
                16
              );

              return (
                <mesh
                  key={`dist-x-${i}`}
                  geometry={barGeometry}
                  material={distributionBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Distribution bars in Y direction */}
          <group name="distribution-bars-y">
            {Array.from({ length: numDistributionBarsX }).map((_, i) => {
              const x = -baseLength / 2 + i * distributionBarSpacing;
              const z = baseDepth - topCover - distributionBarDiameter * 1.5;

              const barGeometry = new THREE.CylinderGeometry(
                distributionBarDiameter / 2,
                distributionBarDiameter / 2,
                baseWidth - 2 * sideCover,
                16
              );

              return (
                <mesh
                  key={`dist-y-${i}`}
                  geometry={barGeometry}
                  material={distributionBarMaterial}
                  position={[x, 0, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Two Layers of Lacers (H12) */}
      {showRebar && (
        <group name="lacers">
          {/* First layer - X direction */}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = -baseWidth / 2 + (i + 1) * (baseWidth / 6);
            const z =
              bottomCover +
              mainBarDiameterX +
              mainBarDiameterY +
              lacerDiameter / 2;

            const lacerGeometry = new THREE.CylinderGeometry(
              lacerDiameter / 2,
              lacerDiameter / 2,
              baseLength - 2 * sideCover,
              16
            );

            return (
              <mesh
                key={`lacer-x-${i}`}
                geometry={lacerGeometry}
                material={lacerMaterial}
                position={[0, y, z]}
                rotation={[0, 0, Math.PI / 2]}
              />
            );
          })}

          {/* Second layer - Y direction */}
          {Array.from({ length: 5 }).map((_, i) => {
            const x = -baseLength / 2 + (i + 1) * (baseLength / 6);
            const z =
              bottomCover +
              mainBarDiameterX +
              mainBarDiameterY +
              lacerDiameter * 1.5;

            const lacerGeometry = new THREE.CylinderGeometry(
              lacerDiameter / 2,
              lacerDiameter / 2,
              baseWidth - 2 * sideCover,
              16
            );

            return (
              <mesh
                key={`lacer-y-${i}`}
                geometry={lacerGeometry}
                material={lacerMaterial}
                position={[x, 0, z]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            );
          })}
        </group>
      )}

      {/* Column Starter Bars */}
      {showRebar &&
        columnPositions.map((colPos, colIdx) => {
          const compressionLap = starterBarDiameter * 42;
          const totalStarterLength = compressionLap + 0.15;

          return (
            <group
              key={`starters-col-${colIdx}`}
              name={`column-${colIdx}-starters`}
            >
              {Array.from({ length: numStarterBarsPerColumn }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / numStarterBarsPerColumn;
                const radius =
                  columnWidth / 2 - sideCover - starterBarDiameter / 2;
                const x = colPos[0] + radius * Math.cos(angle);
                const y = colPos[1] + radius * Math.sin(angle);

                // Create L-bar path
                const starterPath = new THREE.CurvePath();
                starterPath.add(
                  new THREE.LineCurve3(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0.45, 0, 0)
                  )
                );
                starterPath.add(
                  new THREE.LineCurve3(
                    new THREE.Vector3(0.45, 0, 0),
                    new THREE.Vector3(
                      0.45,
                      0,
                      baseDepth + kickerHeight + totalStarterLength
                    )
                  )
                );

                const starterGeometry = new THREE.TubeGeometry(
                  starterPath,
                  64,
                  starterBarDiameter / 2,
                  8,
                  false
                );

                return (
                  <mesh
                    key={`starter-${colIdx}-${i}`}
                    geometry={starterGeometry}
                    material={starterBarMaterial}
                    position={[
                      x - 0.45 * Math.cos(angle),
                      y - 0.45 * Math.sin(angle),
                      bottomCover +
                      mainBarDiameterX +
                      mainBarDiameterY +
                      lacerDiameter * 2,
                    ]}
                    rotation={[0, 0, angle]}
                  />
                );
              })}
            </group>
          );
        })}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          <Text
            position={[baseLength / 2 + 0.5, 0, baseDepth]}
            fontSize={0.15}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            Foundation Level
          </Text>

          <Text
            position={[baseLength / 2 + 0.5, baseWidth / 2, bottomCover]}
            fontSize={0.12}
            color="red"
            anchorX="left"
            anchorY="middle"
          >
            75mm Cover
          </Text>

          <Text
            position={[
              baseLength / 2 + 0.5,
              baseWidth / 2,
              baseDepth - topCover,
            ]}
            fontSize={0.12}
            color="blue"
            anchorX="left"
            anchorY="middle"
          >
            40mm Exposed\n50mm Buried
          </Text>

          <Text
            position={[
              0,
              baseWidth / 2 + 0.4,
              baseDepth - topCover - distributionBarDiameter,
            ]}
            fontSize={0.1}
            color="orange"
            anchorX="center"
            anchorY="bottom"
          >
            H16 Distribution @ 300
          </Text>

          <Text
            position={[
              -baseLength / 2 - 0.3,
              0,
              bottomCover + mainBarDiameterX + mainBarDiameterY + lacerDiameter,
            ]}
            fontSize={0.09}
            color="#cc8833"
            anchorX="right"
            anchorY="middle"
          >
            2 Layers H12 Lacers
          </Text>

          <Text
            position={[0, -baseWidth / 2 - 0.5, baseDepth / 2]}
            fontSize={0.1}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            300mm min. overlap at joints
          </Text>
        </group>
      )}

      {/* Overlap annotation lines */}
      {showLabels && (
        <group name="overlap-indicators">
          <Line
            points={[
              [-baseLength / 2, 0, baseDepth + 0.1],
              [-baseLength / 2 + overlapLength, 0, baseDepth + 0.1],
            ]}
            color="black"
            lineWidth={2}
          />
          <Text
            position={[
              -baseLength / 2 + overlapLength / 2,
              -0.2,
              baseDepth + 0.1,
            ]}
            fontSize={0.08}
            color="black"
            anchorX="center"
            anchorY="top"
          >
            300mm overlap
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MF4: GROUND SLAB AND BEAM
// ============================================================================

/**
 * MF4: Ground Slab and Beam
 * Features:
 * - 75mm bottom cover
 * - 40mm exposed concrete / 50mm buried concrete
 * - Mesh fabric A193 unless specified
 * - Tension lap for fabric
 * - Ground beam with main reinforcement
 * - Extension to link not required if width ≥ 300mm
 */
export function DrawGroundSlabBeamMF4({
  slabLength = 8.0,
  slabWidth = 6.0,
  slabThickness = 0.15,
  beamWidth = 0.3,
  beamDepth = 0.45,
  beamPositionY = 0,
  bottomCover = 0.075,
  topCover = 0.04,
  fabricMeshSize = 0.05, // Grid spacing for visualization
  beamMainBarDiameter = 0.02,
  numBeamTopBars = 2,
  numBeamBottomBars = 2,
  beamLinkDiameter = 0.01,
  beamLinkSpacing = 0.2,
  colors = {
    concrete: "#b8b8b8",
    beam: "#999999",
    fabric: "#cc3333",
    beamBars: "#3366cc",
    links: "#cc8833",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.5,
}) {
  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(slabLength, slabWidth, slabThickness),
    [slabLength, slabWidth, slabThickness]
  );

  const beamGeometry = useMemo(
    () => new THREE.BoxGeometry(slabLength, beamWidth, beamDepth),
    [slabLength, beamWidth, beamDepth]
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

  const beamMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.beam,
        transparent: true,
        opacity: opacity * 0.9,
        wireframe: wireframe,
      }),
    [colors.beam, opacity, wireframe]
  );

  const fabricMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.fabric,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.fabric]
  );

  const beamBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.beamBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.beamBars]
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

  const numFabricLinesX = Math.floor(slabLength / fabricMeshSize) + 1;
  const numFabricLinesY = Math.floor(slabWidth / fabricMeshSize) + 1;
  const numBeamLinks = Math.floor(slabLength / beamLinkSpacing) + 1;
  const tensionLap = 0.3; // 300mm minimum lap

  return (
    <group name="MF4-Ground-Slab-and-Beam">
      {/* Ground Beam */}
      {showConcrete && (
        <mesh
          geometry={beamGeometry}
          material={beamMaterial}
          position={[0, beamPositionY, beamDepth / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Ground Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[0, 0, beamDepth + slabThickness / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Mesh Fabric Reinforcement (A193) */}
      {showRebar && (
        <group name="fabric-mesh">
          {/* Fabric wires in X direction */}
          <group name="fabric-x">
            {Array.from({ length: numFabricLinesY }).map((_, i) => {
              const y = -slabWidth / 2 + i * fabricMeshSize;
              const z = beamDepth + slabThickness / 2;

              const wireGeometry = new THREE.CylinderGeometry(
                0.003,
                0.003,
                slabLength,
                8
              );

              return (
                <mesh
                  key={`fabric-x-${i}`}
                  geometry={wireGeometry}
                  material={fabricMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Fabric wires in Y direction */}
          <group name="fabric-y">
            {Array.from({ length: numFabricLinesX }).map((_, i) => {
              const x = -slabLength / 2 + i * fabricMeshSize;
              const z = beamDepth + slabThickness / 2;

              const wireGeometry = new THREE.CylinderGeometry(
                0.003,
                0.003,
                slabWidth,
                8
              );

              return (
                <mesh
                  key={`fabric-y-${i}`}
                  geometry={wireGeometry}
                  material={fabricMaterial}
                  position={[x, 0, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Ground Beam Reinforcement */}
      {/* Ground Beam Reinforcement */}
      {showRebar && (
        <group name="beam-reinforcement">
          {/* Top bars */}
          <group name="beam-top-bars">
            {Array.from({ length: numBeamTopBars }).map((_, i) => {
              const y =
                beamPositionY +
                (-beamWidth / 2 + (beamWidth / (numBeamTopBars + 1)) * (i + 1));
              const z = beamDepth - bottomCover - beamMainBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                beamMainBarDiameter / 2,
                beamMainBarDiameter / 2,
                slabLength,
                16
              );

              return (
                <mesh
                  key={`beam-top-${i}`}
                  geometry={barGeometry}
                  material={beamBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Bottom bars */}
          <group name="beam-bottom-bars">
            {Array.from({ length: numBeamBottomBars }).map((_, i) => {
              const y =
                beamPositionY +
                (-beamWidth / 2 +
                  (beamWidth / (numBeamBottomBars + 1)) * (i + 1));
              const z = bottomCover + beamMainBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                beamMainBarDiameter / 2,
                beamMainBarDiameter / 2,
                slabLength,
                16
              );

              return (
                <mesh
                  key={`beam-bottom-${i}`}
                  geometry={barGeometry}
                  material={beamBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Links */}
          <group name="beam-links">
            {Array.from({ length: numBeamLinks }).map((_, i) => {
              const x = -slabLength / 2 + i * beamLinkSpacing;

              // Create rectangular link
              const linkPath = new THREE.CurvePath();
              const hw =
                (beamWidth - 2 * bottomCover - beamMainBarDiameter) / 2;
              const hh =
                (beamDepth - 2 * bottomCover - beamMainBarDiameter) / 2;

              linkPath.add(
                new THREE.LineCurve3(
                  new THREE.Vector3(0, -hw, -hh),
                  new THREE.Vector3(0, hw, -hh)
                )
              );
              linkPath.add(
                new THREE.LineCurve3(
                  new THREE.Vector3(0, hw, -hh),
                  new THREE.Vector3(0, hw, hh)
                )
              );
              linkPath.add(
                new THREE.LineCurve3(
                  new THREE.Vector3(0, hw, hh),
                  new THREE.Vector3(0, -hw, hh)
                )
              );
              linkPath.add(
                new THREE.LineCurve3(
                  new THREE.Vector3(0, -hw, hh),
                  new THREE.Vector3(0, -hw, -hh)
                )
              );

              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                32,
                beamLinkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[x, beamPositionY, beamDepth / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          <Text
            position={[slabLength / 2 + 0.5, 0, beamDepth + slabThickness]}
            fontSize={0.15}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            Ground Slab Level
          </Text>

          <Text
            position={[
              slabLength / 2 + 0.5,
              slabWidth / 2,
              beamDepth + slabThickness / 2,
            ]}
            fontSize={0.1}
            color="red"
            anchorX="left"
            anchorY="middle"
          >
            Mesh Fabric A193\nTension Lap: 300mm
          </Text>

          <Text
            position={[-slabLength / 2 - 0.5, beamPositionY, beamDepth / 2]}
            fontSize={0.12}
            color="blue"
            anchorX="right"
            anchorY="middle"
          >
            Ground Beam\n75mm Cover
          </Text>

          <Text
            position={[0, beamPositionY + beamWidth / 2 + 0.3, bottomCover]}
            fontSize={0.09}
            color="black"
            anchorX="center"
            anchorY="bottom"
          >
            40mm Exposed / 50mm Buried
          </Text>
        </group>
      )}

      {/* Tension Lap Indicator */}
      {showLabels && (
        <group name="tension-lap-indicator">
          <Line
            points={[
              [0, slabWidth / 2 - 0.5, beamDepth + slabThickness / 2],
              [tensionLap, slabWidth / 2 - 0.5, beamDepth + slabThickness / 2],
            ]}
            color="red"
            lineWidth={2}
          />
          <Text
            position={[
              tensionLap / 2,
              slabWidth / 2 - 0.6,
              beamDepth + slabThickness / 2,
            ]}
            fontSize={0.08}
            color="red"
            anchorX="center"
            anchorY="top"
          >
            TL (300mm)
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MF5: TRENCHES - DETAIL A & B
// ============================================================================

/**
 * MF5A: Trenches - Wall thickness 150mm or less
 * Single layer of reinforcement
 * Tension lap = 1.4 x Anchorage length
 * 25mm internal faces / 40mm external exposed / 50mm buried
 */
export function DrawTrenchMF5A({
  trenchLength = 4.0,
  trenchWidth = 1.0,
  trenchDepth = 0.8,
  wallThickness = 0.15,
  slabThickness = 0.15,
  internalCover = 0.025,
  externalCover = 0.04,
  buriedCover = 0.05,
  verticalBarDiameter = 0.012,
  verticalBarSpacing = 0.2,
  horizontalBarDiameter = 0.01,
  horizontalBarSpacing = 0.2,
  colors = {
    concrete: "#b8b8b8",
    verticalBars: "#cc3333",
    horizontalBars: "#3366cc",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.5,
}) {
  const tensionLap = verticalBarDiameter * 42 * 1.4; // 1.4 x anchorage length

  // Geometries
  const baseGeometry = useMemo(
    () => new THREE.BoxGeometry(trenchLength, trenchWidth, slabThickness),
    [trenchLength, trenchWidth, slabThickness]
  );

  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(trenchLength, wallThickness, trenchDepth),
    [trenchLength, wallThickness, trenchDepth]
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
        color: colors.verticalBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.verticalBars]
  );

  const horizontalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.horizontalBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.horizontalBars]
  );

  const numVerticalBars = Math.floor(trenchLength / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(trenchDepth / horizontalBarSpacing) + 1;

  return (
    <group name="MF5A-Trench-Detail-A">
      {/* Base Slab */}
      {showConcrete && (
        <mesh
          geometry={baseGeometry}
          material={concreteMaterial}
          position={[0, 0, slabThickness / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Two Walls */}
      {showConcrete && (
        <>
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[
              0,
              -trenchWidth / 2 + wallThickness / 2,
              slabThickness + trenchDepth / 2,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          />
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[
              0,
              trenchWidth / 2 - wallThickness / 2,
              slabThickness + trenchDepth / 2,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          />
        </>
      )}

      {/* Single Layer Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical bars in walls - single central layer */}
          <group name="vertical-bars">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -trenchLength / 2 + i * verticalBarSpacing;

              // Left wall
              const barGeometry1 = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                trenchDepth + tensionLap,
                16
              );

              // Right wall
              const barGeometry2 = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                trenchDepth + tensionLap,
                16
              );

              return (
                <React.Fragment key={`vert-${i}`}>
                  <mesh
                    geometry={barGeometry1}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      -trenchWidth / 2 + wallThickness / 2,
                      slabThickness +
                      (trenchDepth + tensionLap) / 2 -
                      tensionLap / 2,
                    ]}
                  />
                  <mesh
                    geometry={barGeometry2}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      trenchWidth / 2 - wallThickness / 2,
                      slabThickness +
                      (trenchDepth + tensionLap) / 2 -
                      tensionLap / 2,
                    ]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Horizontal bars */}
          <group name="horizontal-bars">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = slabThickness + i * horizontalBarSpacing;

              const barGeometry = new THREE.CylinderGeometry(
                horizontalBarDiameter / 2,
                horizontalBarDiameter / 2,
                trenchLength,
                16
              );

              return (
                <React.Fragment key={`horiz-${i}`}>
                  <mesh
                    geometry={barGeometry}
                    material={horizontalBarMaterial}
                    position={[0, -trenchWidth / 2 + wallThickness / 2, z]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  <mesh
                    geometry={barGeometry}
                    material={horizontalBarMaterial}
                    position={[0, trenchWidth / 2 - wallThickness / 2, z]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Base slab bars */}
          <group name="base-bars">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -trenchLength / 2 + i * verticalBarSpacing;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                trenchWidth,
                16
              );

              return (
                <mesh
                  key={`base-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, 0, slabThickness / 2]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          <Text
            position={[
              trenchLength / 2 + 0.5,
              0,
              slabThickness + trenchDepth / 2,
            ]}
            fontSize={0.15}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            DETAIL A
          </Text>

          <Text
            position={[
              trenchLength / 2 + 0.5,
              0,
              slabThickness + trenchDepth / 2 - 0.3,
            ]}
            fontSize={0.12}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            Wall ≤ 150mm
          </Text>

          <Text
            position={[
              -trenchLength / 2 - 0.3,
              -trenchWidth / 2 + wallThickness / 2,
              slabThickness + trenchDepth,
            ]}
            fontSize={0.1}
            color="red"
            anchorX="right"
            anchorY="middle"
          >
            Tension Lap\n1.4 x Anch. Length
          </Text>

          <Text
            position={[0, -trenchWidth / 2 - 0.3, slabThickness / 2]}
            fontSize={0.09}
            color="blue"
            anchorX="center"
            anchorY="top"
          >
            50mm Buried Cover
          </Text>

          <Text
            position={[0, trenchWidth / 2 + 0.3, slabThickness / 2]}
            fontSize={0.09}
            color="blue"
            anchorX="center"
            anchorY="bottom"
          >
            25mm Internal / 40mm External
          </Text>
        </group>
      )}

      {/* Tension Lap Indicator */}
      {showLabels && (
        <Line
          points={[
            [
              -trenchLength / 2 - 0.2,
              -trenchWidth / 2 + wallThickness / 2,
              slabThickness,
            ],
            [
              -trenchLength / 2 - 0.2,
              -trenchWidth / 2 + wallThickness / 2,
              slabThickness + tensionLap,
            ],
          ]}
          color="red"
          lineWidth={2}
        />
      )}
    </group>
  );
}

/**
 * MF5B: Trenches - Wall thickness more than 150mm
 * Two layers of reinforcement
 * Splay bars when design moment specified
 * Tension lap = 1.4 x Anchorage length
 */
export function DrawTrenchMF5B({
  trenchLength = 4.0,
  trenchWidth = 1.2,
  trenchDepth = 1.0,
  wallThickness = 0.25,
  slabThickness = 0.2,
  internalCover = 0.025,
  externalCover = 0.04,
  buriedCover = 0.05,
  verticalBarDiameter = 0.016,
  verticalBarSpacing = 0.15,
  horizontalBarDiameter = 0.012,
  horizontalBarSpacing = 0.2,
  splayBars = true,
  splayBarDiameter = 0.016,
  splayLength = 0.6,
  colors = {
    concrete: "#b8b8b8",
    verticalBars: "#cc3333",
    horizontalBars: "#3366cc",
    splayBars: "#ff6600",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.5,
}) {
  const tensionLap = verticalBarDiameter * 42 * 1.4;

  const baseGeometry = useMemo(
    () => new THREE.BoxGeometry(trenchLength, trenchWidth, slabThickness),
    [trenchLength, trenchWidth, slabThickness]
  );

  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(trenchLength, wallThickness, trenchDepth),
    [trenchLength, wallThickness, trenchDepth]
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
        color: colors.verticalBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.verticalBars]
  );

  const horizontalBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.horizontalBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.horizontalBars]
  );

  const splayBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.splayBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.splayBars]
  );

  const numVerticalBars = Math.floor(trenchLength / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(trenchDepth / horizontalBarSpacing) + 1;

  // Create splay bar path (diagonal from corner)
  const createSplayBarPath = () => {
    const path = new THREE.CurvePath();
    const angle = Math.PI / 4; // 45 degree splay

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, splayLength)
      )
    );

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, splayLength),
        new THREE.Vector3(
          0,
          splayLength * Math.sin(angle),
          splayLength + splayLength * Math.cos(angle)
        )
      )
    );

    return path;
  };

  const splayBarPath = createSplayBarPath();

  return (
    <group name="MF5B-Trench-Detail-B">
      {/* Base Slab */}
      {showConcrete && (
        <mesh
          geometry={baseGeometry}
          material={concreteMaterial}
          position={[0, 0, slabThickness / 2]}
          castShadow
          receiveShadow
        />
      )}

      {/* Two Walls */}
      {showConcrete && (
        <>
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[
              0,
              -trenchWidth / 2 + wallThickness / 2,
              slabThickness + trenchDepth / 2,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          />
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[
              0,
              trenchWidth / 2 - wallThickness / 2,
              slabThickness + trenchDepth / 2,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          />
        </>
      )}

      {/* Two Layers of Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical bars - Outer face */}
          <group name="vertical-bars-outer">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -trenchLength / 2 + i * verticalBarSpacing;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                trenchDepth + tensionLap,
                16
              );

              return (
                <React.Fragment key={`vert-outer-${i}`}>
                  <mesh
                    geometry={barGeometry}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      -trenchWidth / 2 +
                      wallThickness / 2 -
                      buriedCover -
                      verticalBarDiameter / 2,
                      slabThickness +
                      (trenchDepth + tensionLap) / 2 -
                      tensionLap / 2,
                    ]}
                  />
                  <mesh
                    geometry={barGeometry}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      trenchWidth / 2 -
                      wallThickness / 2 +
                      internalCover +
                      verticalBarDiameter / 2,
                      slabThickness +
                      (trenchDepth + tensionLap) / 2 -
                      tensionLap / 2,
                    ]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Vertical bars - Inner face */}
          <group name="vertical-bars-inner">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -trenchLength / 2 + i * verticalBarSpacing;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                trenchDepth + tensionLap,
                16
              );

              return (
                <React.Fragment key={`vert-inner-${i}`}>
                  <mesh
                    geometry={barGeometry}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      -trenchWidth / 2 +
                      wallThickness / 2 +
                      internalCover +
                      verticalBarDiameter / 2,
                      slabThickness +
                      (trenchDepth + tensionLap) / 2 -
                      tensionLap / 2,
                    ]}
                  />
                  <mesh
                    geometry={barGeometry}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      trenchWidth / 2 -
                      wallThickness / 2 -
                      buriedCover -
                      verticalBarDiameter / 2,
                      slabThickness +
                      (trenchDepth + tensionLap) / 2 -
                      tensionLap / 2,
                    ]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Horizontal bars - both faces */}
          <group name="horizontal-bars">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = slabThickness + i * horizontalBarSpacing;

              const barGeometry = new THREE.CylinderGeometry(
                horizontalBarDiameter / 2,
                horizontalBarDiameter / 2,
                trenchLength,
                16
              );

              return (
                <React.Fragment key={`horiz-${i}`}>
                  {/* Left wall - outer */}
                  <mesh
                    geometry={barGeometry}
                    material={horizontalBarMaterial}
                    position={[
                      0,
                      -trenchWidth / 2 +
                      wallThickness / 2 -
                      buriedCover -
                      verticalBarDiameter -
                      horizontalBarDiameter / 2,
                      z,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  {/* Left wall - inner */}
                  <mesh
                    geometry={barGeometry}
                    material={horizontalBarMaterial}
                    position={[
                      0,
                      -trenchWidth / 2 +
                      wallThickness / 2 +
                      internalCover +
                      verticalBarDiameter +
                      horizontalBarDiameter / 2,
                      z,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  {/* Right wall - outer */}
                  <mesh
                    geometry={barGeometry}
                    material={horizontalBarMaterial}
                    position={[
                      0,
                      trenchWidth / 2 -
                      wallThickness / 2 -
                      buriedCover -
                      verticalBarDiameter -
                      horizontalBarDiameter / 2,
                      z,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  {/* Right wall - inner */}
                  <mesh
                    geometry={barGeometry}
                    material={horizontalBarMaterial}
                    position={[
                      0,
                      trenchWidth / 2 -
                      wallThickness / 2 +
                      internalCover +
                      verticalBarDiameter +
                      horizontalBarDiameter / 2,
                      z,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Splay bars at corners (when design moment specified) */}
          {splayBars && (
            <group name="splay-bars">
              {Array.from({ length: Math.floor(trenchLength / 0.3) }).map(
                (_, i) => {
                  const x = -trenchLength / 2 + i * 0.3;

                  const splayGeometry = new THREE.TubeGeometry(
                    splayBarPath,
                    32,
                    splayBarDiameter / 2,
                    8,
                    false
                  );

                  return (
                    <React.Fragment key={`splay-${i}`}>
                      {/* Left corner - bottom */}
                      <mesh
                        geometry={splayGeometry}
                        material={splayBarMaterial}
                        position={[
                          x,
                          -trenchWidth / 2 + wallThickness / 2,
                          slabThickness,
                        ]}
                        rotation={[0, -Math.PI / 2, 0]}
                      />
                      {/* Right corner - bottom */}
                      <mesh
                        geometry={splayGeometry}
                        material={splayBarMaterial}
                        position={[
                          x,
                          trenchWidth / 2 - wallThickness / 2,
                          slabThickness,
                        ]}
                        rotation={[0, Math.PI / 2, 0]}
                      />
                    </React.Fragment>
                  );
                }
              )}
            </group>
          )}
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          <Text
            position={[
              trenchLength / 2 + 0.5,
              0,
              slabThickness + trenchDepth / 2,
            ]}
            fontSize={0.15}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            DETAIL B
          </Text>

          <Text
            position={[
              trenchLength / 2 + 0.5,
              0,
              slabThickness + trenchDepth / 2 - 0.3,
            ]}
            fontSize={0.12}
            color="black"
            anchorX="left"
            anchorY="middle"
          >
            Wall 150mm
          </Text>

          <Text
            position={[
              -trenchLength / 2 - 0.3,
              -trenchWidth / 2 + wallThickness / 2,
              slabThickness + trenchDepth,
            ]}
            fontSize={0.1}
            color="red"
            anchorX="right"
            anchorY="middle"
          >
            Tension Lap\n1.4 x Anch. Length
          </Text>

          <Text
            position={[0, -trenchWidth / 2 - 0.4, slabThickness / 2]}
            fontSize={0.09}
            color="blue"
            anchorX="center"
            anchorY="top"
          >
            Two Layers:\n50mm Buried / 25mm Internal
          </Text>

          {splayBars && (
            <Text
              position={[
                0,
                -trenchWidth / 2 + wallThickness / 2 + 0.4,
                slabThickness + splayLength / 2,
              ]}
              fontSize={0.09}
              color="orange"
              anchorX="center"
              anchorY="bottom"
            >
              Splay Bars\n(When moment specified)
            </Text>
          )}
        </group>
      )}
    </group>
  );
}
