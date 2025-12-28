import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * RETAINING WALL DETAILING MODELS - MRW1 to MRW3
 * Based on IStructE/Concrete Society Standard Method of Detailing Structural Concrete
 *
 * These components visualize standard reinforcement details for retaining walls
 * following BS EN 1992 (Eurocode 2) practices.
 */

// ============================================================================
// MRW1: EXTERNAL CANTILEVER WALL
// ============================================================================

/**
 * MRW1: External Cantilever Wall
 * Shows typical cantilever retaining wall with:
 * - Earth face bars (vertical) on outside
 * - Exposed face bars with 40mm cover
 * - Buried face bars with 50mm cover
 * - Granular fill behind wall
 * - Base slab with key (if required)
 * - Top bars in wall
 * - Bottom bars in base
 * - Tension laps throughout
 * - Large radius bends where specified
 * - Nominal reinforcement in base (unless stated otherwise)
 *
 * @param {Object} props
 */
export function DrawRetainingWallMRW1({
  wallHeight = 3.0,
  wallThickness = 0.3,
  baseWidth = 2.5,
  baseThickness = 0.5,
  heelLength = 1.5, // Behind wall
  toeLength = 1.0, // In front of wall
  keyDepth = 0.2,
  keyWidth = 0.3,
  hasKey = true,
  earthFaceCover = 0.05,
  exposedFaceCover = 0.04,
  verticalBarDiameter = 0.016,
  verticalBarSpacing = 0.15,
  horizontalBarDiameter = 0.012,
  horizontalBarSpacing = 0.2,
  baseBarDiameter = 0.016,
  baseBarSpacing = 0.15,
  colors = {
    concrete: "#a8a8a8",
    earthFill: "#8B7355",
    verticalRebar: "#cc3333",
    horizontalRebar: "#cc8833",
    baseBars: "#3366cc",
  },
  showConcrete = true,
  showRebar = true,
  showFill = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const tensionLap = verticalBarDiameter * 42;
  const wallLength = 4.0; // Typical section length for visualization

  // Wall geometry
  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
  );

  // Base geometry
  const baseGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, baseWidth, baseThickness),
    [wallLength, baseWidth, baseThickness]
  );

  // Key geometry (if present)
  const keyGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, keyWidth, keyDepth),
    [wallLength, keyWidth, keyDepth]
  );

  // Earth fill geometry
  const fillGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(wallLength, heelLength, wallHeight + baseThickness),
    [wallLength, heelLength, wallHeight, baseThickness]
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

  const fillMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.earthFill,
        transparent: true,
        opacity: 0.3,
        wireframe: false,
      }),
    [colors.earthFill]
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

  const baseBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.baseBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.baseBars, wireframe]
  );

  const numVerticalBars = Math.floor(wallLength / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(wallHeight / horizontalBarSpacing) + 1;
  const numBaseBars = Math.floor(wallLength / baseBarSpacing) + 1;

  // Create L-bar path from base into wall (earth face)
  const createBaseToWallLBar = () => {
    const path = new THREE.CurvePath();
    const bendRadius = verticalBarDiameter * 4; // Large radius as specified
    const horizontalInBase =
      baseThickness - earthFaceCover - verticalBarDiameter;
    const verticalInWall = wallHeight * 0.8;

    // Horizontal in base
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, horizontalInBase, 0)
      )
    );

    // Large radius bend
    const arc = new THREE.ArcCurve(
      bendRadius,
      horizontalInBase,
      bendRadius,
      Math.PI,
      Math.PI / 2,
      true
    );
    const arcPoints = arc.getPoints(16);
    const arc3D = arcPoints.map((p) => new THREE.Vector3(0, p.x, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Vertical in wall
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, bendRadius, horizontalInBase + bendRadius),
        new THREE.Vector3(
          0,
          bendRadius,
          horizontalInBase + bendRadius + verticalInWall
        )
      )
    );

    return path;
  };

  const baseToWallLBarPath = createBaseToWallLBar();

  // Calculate positions
  const wallCenterY = -baseWidth / 2 + toeLength + wallThickness / 2;
  const baseCenterZ = -baseThickness / 2;
  const wallCenterZ = baseThickness / 2 + wallHeight / 2;

  return (
    <group name="MRW1-External-Cantilever-Wall">
      {/* Base Slab */}
      {showConcrete && (
        <mesh
          geometry={baseGeometry}
          material={concreteMaterial}
          position={[0, 0, baseCenterZ]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Key (if required) */}
      {showConcrete && hasKey && (
        <mesh
          geometry={keyGeometry}
          material={concreteMaterial}
          position={[0, 0, -baseThickness / 2 - keyDepth / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Wall */}
      {showConcrete && (
        <mesh
          geometry={wallGeometry}
          material={concreteMaterial}
          position={[0, wallCenterY, wallCenterZ]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Granular Fill */}
      {showFill && (
        <mesh
          geometry={fillGeometry}
          material={fillMaterial}
          position={[
            0,
            wallCenterY + wallThickness / 2 + heelLength / 2,
            (wallHeight + baseThickness) / 2 - baseThickness / 2,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical Bars - Earth Face (main tension steel) */}
          <group name="vertical-earth-face">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y =
                wallCenterY +
                wallThickness / 2 -
                earthFaceCover -
                verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-earth-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallCenterZ]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Exposed Face */}
          <group name="vertical-exposed-face">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y =
                wallCenterY -
                wallThickness / 2 +
                exposedFaceCover +
                verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-exposed-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, wallCenterZ]}
                />
              );
            })}
          </group>

          {/* L-bars from base into wall (earth face) */}
          <group name="base-to-wall-l-bars">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y =
                wallCenterY +
                wallThickness / 2 -
                earthFaceCover -
                verticalBarDiameter / 2;

              const lBarGeometry = new THREE.TubeGeometry(
                baseToWallLBarPath,
                64,
                verticalBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`l-bar-${i}`}
                  geometry={lBarGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, -baseThickness / 2 + earthFaceCover]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Horizontal Bars - Earth Face (outside vertical) */}
          <group name="horizontal-earth-face">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = baseThickness / 2 + i * horizontalBarSpacing;
              const y =
                wallCenterY +
                wallThickness / 2 -
                earthFaceCover -
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
                  key={`horiz-earth-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Horizontal Bars - Exposed Face (outside vertical) */}
          <group name="horizontal-exposed-face">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = baseThickness / 2 + i * horizontalBarSpacing;
              const y =
                wallCenterY -
                wallThickness / 2 +
                exposedFaceCover +
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
                  key={`horiz-exposed-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Base Bottom Bars - Longitudinal */}
          <group name="base-bottom-longitudinal">
            {Array.from({ length: numBaseBars }).map((_, i) => {
              const x = -wallLength / 2 + i * baseBarSpacing;
              const z =
                -baseThickness / 2 + earthFaceCover + baseBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                baseBarDiameter / 2,
                baseBarDiameter / 2,
                baseWidth,
                16
              );

              return (
                <mesh
                  key={`base-long-${i}`}
                  geometry={barGeometry}
                  material={baseBarMaterial}
                  position={[x, 0, z]}
                  rotation={[0, 0, Math.PI / 2]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Base Bottom Bars - Transverse */}
          <group name="base-bottom-transverse">
            {Array.from({
              length: Math.floor(baseWidth / baseBarSpacing) + 1,
            }).map((_, i) => {
              const y = -baseWidth / 2 + i * baseBarSpacing;
              const z =
                -baseThickness / 2 + earthFaceCover + baseBarDiameter * 1.5;

              const barGeometry = new THREE.CylinderGeometry(
                baseBarDiameter / 2,
                baseBarDiameter / 2,
                wallLength,
                16
              );

              return (
                <mesh
                  key={`base-trans-${i}`}
                  geometry={barGeometry}
                  material={baseBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Base Top Bars (nominal unless specified) */}
          <group name="base-top-bars">
            {Array.from({ length: Math.floor(wallLength / 0.2) + 1 }).map(
              (_, i) => {
                const x = -wallLength / 2 + i * 0.2;
                const z = baseThickness / 2 - exposedFaceCover - 0.012 / 2;

                const barGeometry = new THREE.CylinderGeometry(
                  0.012 / 2,
                  0.012 / 2,
                  baseWidth,
                  16
                );

                return (
                  <mesh
                    key={`base-top-${i}`}
                    geometry={barGeometry}
                    material={baseBarMaterial}
                    position={[x, 0, z]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              }
            )}
          </group>

          {/* Key Reinforcement (if present) */}
          {hasKey && (
            <group name="key-reinforcement">
              {Array.from({ length: 3 }).map((_, i) => {
                const x = -wallLength / 2 + (i + 1) * (wallLength / 4);

                const barGeometry = new THREE.CylinderGeometry(
                  0.012 / 2,
                  0.012 / 2,
                  keyDepth,
                  16
                );

                return (
                  <mesh
                    key={`key-bar-${i}`}
                    geometry={barGeometry}
                    material={baseBarMaterial}
                    position={[x, 0, -baseThickness / 2 - keyDepth / 2]}
                  />
                );
              })}
            </group>
          )}
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Cover annotations: 50mm buried, 40mm exposed */}
          {/* Granular fill indicator */}
          {/* Tension lap locations */}
        </group>
      )}
    </group>
  );
}

// Imports moved to top

/**
 * MRW2: BASEMENT RETAINING WALL
 * Based on IStructE/Concrete Society Standard Method - Model Detail MRW2
 *
 * Features:
 * - Wall placed centrally on ground beam
 * - 25mm internal face cover
 * - 40mm external exposed face cover
 * - 50mm buried face cover
 * - Floor to falls (drainage)
 * - Cavity drain slot details
 * - Vertical reinforcement fixed first
 * - Large radius bends
 * - Kicker: 150mm below ground, 75mm above
 * - 300mm minimum overlap at joints
 */
export function DrawRetainingWallMRW2({
  wallLength = 6.0,
  wallHeight = 3.0,
  wallThickness = 0.3,
  groundBeamWidth = 0.6,
  groundBeamDepth = 0.6,
  internalSlabThickness = 0.2,
  kickerHeight = 0.075,
  kickerBelowGround = 0.15,
  internalCover = 0.025,
  externalCover = 0.04,
  buriedCover = 0.05,
  verticalBarDiameter = 0.016,
  verticalBarSpacing = 0.15,
  horizontalBarDiameter = 0.012,
  horizontalBarSpacing = 0.2,
  hasCavityDrain = true,
  colors = {
    concrete: "#a8a8a8",
    groundBeam: "#999999",
    slab: "#bbbbbb",
    verticalRebar: "#cc3333",
    horizontalRebar: "#cc8833",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const tensionLap = verticalBarDiameter * 42;

  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
  );

  const groundBeamGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, groundBeamWidth, groundBeamDepth),
    [wallLength, groundBeamWidth, groundBeamDepth]
  );

  const kickerGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, kickerHeight),
    [wallLength, wallThickness, kickerHeight]
  );

  const slabGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        wallLength,
        groundBeamWidth * 2,
        internalSlabThickness
      ),
    [wallLength, groundBeamWidth, internalSlabThickness]
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

  const groundBeamMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.groundBeam,
        transparent: true,
        opacity: opacity * 0.8,
        wireframe: wireframe,
      }),
    [colors.groundBeam, opacity, wireframe]
  );

  const slabMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.slab,
        transparent: true,
        opacity: opacity * 0.7,
        wireframe: wireframe,
      }),
    [colors.slab, opacity, wireframe]
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

  const numVerticalBars = Math.floor(wallLength / verticalBarSpacing) + 1;
  const numHorizontalBars = Math.floor(wallHeight / horizontalBarSpacing) + 1;

  // Create L-bar from ground beam into wall
  const createGroundBeamToWallLBar = () => {
    const path = new THREE.CurvePath();
    const bendRadius = verticalBarDiameter * 4;
    const horizontalInBeam =
      groundBeamDepth - buriedCover - verticalBarDiameter;
    const verticalInWall = wallHeight * 0.85;

    // Horizontal in ground beam
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, horizontalInBeam, 0)
      )
    );

    // Bend
    const arc = new THREE.ArcCurve(
      bendRadius,
      horizontalInBeam,
      bendRadius,
      Math.PI,
      Math.PI / 2,
      true
    );
    const arcPoints = arc.getPoints(16);
    const arc3D = arcPoints.map((p) => new THREE.Vector3(0, p.x, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Vertical in wall
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, bendRadius, horizontalInBeam + bendRadius),
        new THREE.Vector3(
          0,
          bendRadius,
          horizontalInBeam + bendRadius + verticalInWall
        )
      )
    );

    return path;
  };

  const groundBeamToWallLBarPath = createGroundBeamToWallLBar();

  return (
    <group name="MRW2-Basement-Retaining-Wall">
      {/* Ground Beam */}
      {showConcrete && (
        <mesh
          geometry={groundBeamGeometry}
          material={groundBeamMaterial}
          position={[0, 0, -groundBeamDepth / 2 - kickerBelowGround]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Kicker */}
      {showConcrete && (
        <mesh
          geometry={kickerGeometry}
          material={concreteMaterial}
          position={[0, 0, kickerHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Wall (centrally placed on ground beam) */}
      {showConcrete && (
        <mesh
          geometry={wallGeometry}
          material={concreteMaterial}
          position={[0, 0, kickerHeight + wallHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Internal Floor Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={slabMaterial}
          position={[
            0,
            wallThickness / 2 + groundBeamWidth,
            kickerHeight + internalSlabThickness / 2,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Cavity Drain Slot */}
      {showConcrete && hasCavityDrain && (
        <mesh
          geometry={new THREE.BoxGeometry(wallLength, 0.05, wallHeight * 0.9)}
          material={
            new THREE.MeshStandardMaterial({
              color: "#333333",
              opacity: 0.5,
              transparent: true,
            })
          }
          position={[
            0,
            -wallThickness / 2 - 0.025,
            kickerHeight + wallHeight / 2,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Vertical Bars - External Face (earth side) */}
          <group name="vertical-external-face">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y =
                -wallThickness / 2 + buriedCover + verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-ext-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, kickerHeight + wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* Vertical Bars - Internal Face */}
          <group name="vertical-internal-face">
            {Array.from({ length: numVerticalBars }).map((_, i) => {
              const x = -wallLength / 2 + i * verticalBarSpacing;
              const y =
                wallThickness / 2 - internalCover - verticalBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                verticalBarDiameter / 2,
                verticalBarDiameter / 2,
                wallHeight,
                16
              );

              return (
                <mesh
                  key={`vert-int-${i}`}
                  geometry={barGeometry}
                  material={verticalBarMaterial}
                  position={[x, y, kickerHeight + wallHeight / 2]}
                />
              );
            })}
          </group>

          {/* L-bars from ground beam into wall */}
          <group name="ground-beam-to-wall-l-bars">
            {Array.from({ length: Math.floor(numVerticalBars / 2) }).map(
              (_, i) => {
                const x = -wallLength / 2 + i * verticalBarSpacing * 2;
                const y =
                  -wallThickness / 2 + buriedCover + verticalBarDiameter / 2;

                const lBarGeometry = new THREE.TubeGeometry(
                  groundBeamToWallLBarPath,
                  64,
                  verticalBarDiameter / 2,
                  8,
                  false
                );

                return (
                  <mesh
                    key={`l-bar-beam-${i}`}
                    geometry={lBarGeometry}
                    material={verticalBarMaterial}
                    position={[
                      x,
                      y,
                      -groundBeamDepth - kickerBelowGround + buriedCover,
                    ]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              }
            )}
          </group>

          {/* Horizontal Bars - External Face */}
          <group name="horizontal-external-face">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = kickerHeight + i * horizontalBarSpacing;
              const y =
                -wallThickness / 2 +
                buriedCover +
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
                  key={`horiz-ext-${i}`}
                  geometry={barGeometry}
                  material={horizontalBarMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Horizontal Bars - Internal Face */}
          <group name="horizontal-internal-face">
            {Array.from({ length: numHorizontalBars }).map((_, i) => {
              const z = kickerHeight + i * horizontalBarSpacing;
              const y =
                wallThickness / 2 -
                internalCover -
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
                  key={`horiz-int-${i}`}
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
          <Text
            position={[0, wallThickness / 2 + 0.4, wallHeight / 2]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            DETAIL C
          </Text>
          <Text
            position={[0, wallThickness / 2 + 0.2, wallHeight / 2]}
            fontSize={0.12}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            Movement Joint
          </Text>
          <Text
            position={[0, -wallThickness / 2 - 0.2, wallHeight / 2]}
            fontSize={0.1}
            color="blue"
            anchorX="center"
            anchorY="middle"
          >
            500mm Splice Bars
          </Text>
          <Text
            position={[wallLength / 2 + 0.5, wallThickness / 2, wallHeight / 2]}
            fontSize={0.1}
            color="blue"
            anchorX="left"
            anchorY="middle"
          >
            Internal Water Bar
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// DEMO COMPONENT WITH CONTROLS
// ============================================================================

export default function RetainingWallDemo() {
  const [selectedDetail, setSelectedDetail] = useState("MRW2");
  const [showConcrete, setShowConcrete] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [opacity, setOpacity] = useState(0.4);

  return (
    <div style={{ width: "100%", height: "100vh", background: "#f0f0f0" }}>
      {/* Controls Panel */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          zIndex: 1000,
          maxWidth: "300px",
        }}
      >
        <h3
          style={{ margin: "0 0 15px 0", fontSize: "18px", fontWeight: "bold" }}
        >
          Retaining Wall Details
        </h3>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Select Detail:
          </label>
          <select
            value={selectedDetail}
            onChange={(e) => setSelectedDetail(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
            }}
          >
            <option value="MRW2">MRW2 - Basement Retaining Wall</option>
            <option value="MRW3A">MRW3A - Simple Construction Joint</option>
            <option value="MRW3B">MRW3B - Full Contraction Joint</option>
            <option value="MRW3C">MRW3C - Movement Joint</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <input
              type="checkbox"
              checked={showConcrete}
              onChange={(e) => setShowConcrete(e.target.checked)}
            />
            Show Concrete
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <input
              type="checkbox"
              checked={showRebar}
              onChange={(e) => setShowRebar(e.target.checked)}
            />
            Show Reinforcement
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Show Labels
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
            Wireframe Mode
          </label>
        </div>

        <div style={{ marginTop: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}
          >
            Concrete Opacity: {opacity.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            background: "#f5f5f5",
            borderRadius: "4px",
            fontSize: "12px",
            lineHeight: "1.5",
          }}
        >
          <strong>Current Detail:</strong>
          <div style={{ marginTop: "5px" }}>
            {selectedDetail === "MRW2" && (
              <>
                <div>• Wall centrally placed on ground beam</div>
                <div>• Kicker: 150mm below, 75mm above ground</div>
                <div>• Covers: 50mm buried, 40mm external, 25mm internal</div>
                <div>• Large radius bends specified</div>
              </>
            )}
            {selectedDetail === "MRW3A" && (
              <>
                <div>• Simple construction joint</div>
                <div>• Continuous vertical bars through joint</div>
                <div>• No movement provision</div>
              </>
            )}
            {selectedDetail === "MRW3B" && (
              <>
                <div>• Full contraction joint</div>
                <div>• H10 U-bars @ 500mm spacing</div>
                <div>• Maximum spacing: 30m</div>
                <div>• Expansion joint details as per CIRIA 139</div>
              </>
            )}
            {selectedDetail === "MRW3C" && (
              <>
                <div>• Movement joint with splice bars</div>
                <div>• 500mm splice bar length</div>
                <div>• Internal water bar provision</div>
                <div>• Same size/pitch as main bars</div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: "15px",
            padding: "8px",
            background: "#e3f2fd",
            borderRadius: "4px",
            fontSize: "11px",
            color: "#1976d2",
          }}
        >
          <strong>Controls:</strong>
          <div>• Left click + drag to rotate</div>
          <div>• Right click + drag to pan</div>
          <div>• Scroll to zoom</div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={50} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={30}
        />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 10, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-10, -10, -10]} intensity={0.3} />
        <hemisphereLight args={["#ffffff", "#8d8d8d", 0.4]} />

        {/* Ground Plane */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, -1]}
          receiveShadow
        >
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#8B7355" opacity={0.3} transparent />
        </mesh>

        {/* Grid Helper */}
        <gridHelper
          args={[20, 20, "#888888", "#cccccc"]}
          position={[0, 0, -1]}
        />

        {/* Render Selected Detail */}
        {selectedDetail === "MRW2" && (
          <DrawRetainingWallMRW2
            showConcrete={showConcrete}
            showRebar={showRebar}
            showLabels={showLabels}
            wireframe={wireframe}
            opacity={opacity}
          />
        )}

        {selectedDetail === "MRW3A" && (
          <DrawRetainingWallMRW3A
            showConcrete={showConcrete}
            showRebar={showRebar}
            showLabels={showLabels}
            wireframe={wireframe}
            opacity={opacity}
          />
        )}

        {selectedDetail === "MRW3B" && (
          <DrawRetainingWallMRW3B
            showConcrete={showConcrete}
            showRebar={showRebar}
            showLabels={showLabels}
            wireframe={wireframe}
            opacity={opacity}
          />
        )}

        {selectedDetail === "MRW3C" && (
          <DrawRetainingWallMRW3C
            showConcrete={showConcrete}
            showRebar={showRebar}
            showLabels={showLabels}
            wireframe={wireframe}
            opacity={opacity}
          />
        )}

        {/* Axes Helper */}
        <axesHelper args={[2]} />
      </Canvas>
    </div>
  );
}
/**
 * MRW3: VERTICAL CONSTRUCTION JOINTS
 * Three detail variations:
 * A - Simple construction joint
 * B - Full contraction joint (spacing 30m max)
 * C - Movement joint
 */

// MRW3 Detail A: Simple Construction Joint
export function DrawRetainingWallMRW3A({
  wallLength = 3.0,
  wallHeight = 3.0,
  wallThickness = 0.3,
  internalCover = 0.025,
  externalCover = 0.04,
  buriedCover = 0.05,
  verticalBarDiameter = 0.016,
  verticalBarSpacing = 0.15,
  colors = {
    concrete: "#a8a8a8",
    verticalRebar: "#cc3333",
    joint: "#666666",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
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
      }),
    [colors.verticalRebar]
  );

  const numVerticalBars = Math.floor(wallLength / verticalBarSpacing) + 1;

  return (
    <group name="MRW3A-Simple-Construction-Joint">
      {/* Wall sections on either side of joint */}
      {showConcrete && (
        <>
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[-wallLength / 2, 0, wallHeight / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[wallLength / 2, 0, wallHeight / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </>
      )}

      {/* Construction Joint Line */}
      {showConcrete && (
        <mesh
          geometry={new THREE.BoxGeometry(0.01, wallThickness, wallHeight)}
          material={new THREE.MeshStandardMaterial({ color: colors.joint })}
          position={[0, 0, wallHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Continuous vertical bars through joint */}
      {showRebar && (
        <group name="continuous-vertical-bars">
          {Array.from({ length: numVerticalBars }).map((_, i) => {
            const x = -wallLength + i * verticalBarSpacing;
            const y =
              -wallThickness / 2 + buriedCover + verticalBarDiameter / 2;

            const barGeometry = new THREE.CylinderGeometry(
              verticalBarDiameter / 2,
              verticalBarDiameter / 2,
              wallHeight,
              16
            );

            return (
              <mesh
                key={`vert-bar-${i}`}
                geometry={barGeometry}
                material={verticalBarMaterial}
                position={[x, y, wallHeight / 2]}
              />
            );
          })}
        </group>
      )}

      {showLabels && (
        <group name="labels">
          <Text
            position={[0, wallThickness / 2 + 0.4, wallHeight / 2]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            DETAIL A
          </Text>
          <Text
            position={[0, wallThickness / 2 + 0.2, wallHeight / 2]}
            fontSize={0.12}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            Simple Construction Joint
          </Text>
        </group>
      )}
    </group>
  );
}

// MRW3 Detail B: Full Contraction Joint
export function DrawRetainingWallMRW3B({
  wallLength = 3.0,
  wallHeight = 3.0,
  wallThickness = 0.3,
  internalCover = 0.025,
  externalCover = 0.04,
  buriedCover = 0.05,
  verticalBarDiameter = 0.016,
  verticalBarSpacing = 0.15,
  uBarDiameter = 0.01,
  uBarSpacing = 0.5,
  colors = {
    concrete: "#a8a8a8",
    verticalRebar: "#cc3333",
    uBars: "#3366cc",
    joint: "#444444",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
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
      }),
    [colors.verticalRebar]
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

  const jointGap = 0.025; // 25mm gap for contraction

  // Create U-bar path
  const createUBarPath = () => {
    const path = new THREE.CurvePath();
    const uBarWidth = wallThickness - 2 * buriedCover;
    const uBarDepth = 0.075; // 75mm depth

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, uBarDepth)
      )
    );

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, uBarDepth),
        new THREE.Vector3(0, uBarWidth, uBarDepth)
      )
    );

    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, uBarWidth, uBarDepth),
        new THREE.Vector3(0, uBarWidth, 0)
      )
    );

    return path;
  };

  const uBarPath = createUBarPath();
  const numUBars = Math.floor(wallHeight / uBarSpacing);

  return (
    <group name="MRW3B-Full-Contraction-Joint">
      {/* Wall sections with gap */}
      {showConcrete && (
        <>
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[-wallLength / 2 - jointGap / 2, 0, wallHeight / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[wallLength / 2 + jointGap / 2, 0, wallHeight / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </>
      )}

      {/* Joint Gap */}
      {showConcrete && (
        <mesh
          geometry={new THREE.BoxGeometry(jointGap, wallThickness, wallHeight)}
          material={
            new THREE.MeshStandardMaterial({
              color: colors.joint,
              transparent: true,
              opacity: 0.3,
            })
          }
          position={[0, 0, wallHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* H10 U-bars */}
      {showRebar && (
        <group name="u-bars">
          {Array.from({ length: numUBars }).map((_, i) => {
            const z = (i + 1) * uBarSpacing;
            const x = -jointGap / 2 - 0.05; // Offset from joint
            const y = -wallThickness / 2 + buriedCover;

            const uBarGeometry = new THREE.TubeGeometry(
              uBarPath,
              32,
              uBarDiameter / 2,
              8,
              false
            );

            return (
              <mesh
                key={`u-bar-${i}`}
                geometry={uBarGeometry}
                material={uBarMaterial}
                position={[x, y, z]}
                rotation={[0, Math.PI / 2, 0]}
              />
            );
          })}
        </group>
      )}

      {showLabels && (
        <group name="labels">
          <Text
            position={[0, wallThickness / 2 + 0.4, wallHeight / 2]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            DETAIL B
          </Text>
          <Text
            position={[0, wallThickness / 2 + 0.2, wallHeight / 2]}
            fontSize={0.12}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            Full Contraction Joint
          </Text>
          <Text
            position={[0, -wallThickness / 2 - 0.2, wallHeight / 2]}
            fontSize={0.1}
            color="blue"
            anchorX="center"
            anchorY="middle"
          >
            Spacing: 30m Max
          </Text>
          <Text
            position={[-wallLength / 2 - 0.5, 0, uBarSpacing]}
            fontSize={0.1}
            color="blue"
            anchorX="right"
            anchorY="middle"
          >
            H10 U-bars @ 500mm
          </Text>
        </group>
      )}
    </group>
  );
}

// MRW3 Detail C: Movement Joint
export function DrawRetainingWallMRW3C({
  wallLength = 3.0,
  wallHeight = 3.0,
  wallThickness = 0.3,
  internalCover = 0.025,
  externalCover = 0.04,
  buriedCover = 0.05,
  verticalBarDiameter = 0.016,
  verticalBarSpacing = 0.15,
  spliceBarSpacing = 0.5,
  colors = {
    concrete: "#a8a8a8",
    verticalRebar: "#cc3333",
    spliceBars: "#ff6600",
    joint: "#222222",
    waterBar: "#0066cc",
  },
  kickerHeight = 0.075,
  kickerBelowGround = 0.15,
  hasCavityDrain = true,
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const wallGeometry = useMemo(
    () => new THREE.BoxGeometry(wallLength, wallThickness, wallHeight),
    [wallLength, wallThickness, wallHeight]
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
      }),
    [colors.verticalRebar]
  );

  const spliceBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.spliceBars,
        metalness: 0.7,
        roughness: 0.3,
      }),
    [colors.spliceBars]
  );

  const jointWidth = 0.05; // 50mm movement joint
  const numSpliceBars = Math.floor(wallHeight / spliceBarSpacing);

  return (
    <group name="MRW3C-Movement-Joint">
      {/* Wall sections with movement gap */}
      {showConcrete && (
        <>
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[-wallLength / 2 - jointWidth / 2, 0, wallHeight / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            geometry={wallGeometry}
            material={concreteMaterial}
            position={[wallLength / 2 + jointWidth / 2, 0, wallHeight / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </>
      )}

      {/* Movement Joint Gap */}
      {showConcrete && (
        <mesh
          geometry={
            new THREE.BoxGeometry(jointWidth, wallThickness, wallHeight)
          }
          material={
            new THREE.MeshStandardMaterial({
              color: colors.joint,
              transparent: true,
              opacity: 0.2,
            })
          }
          position={[0, 0, wallHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Internal Water Bar (if required) */}
      {showConcrete && (
        <mesh
          geometry={new THREE.BoxGeometry(jointWidth * 3, 0.01, 0.15)}
          material={new THREE.MeshStandardMaterial({ color: colors.waterBar })}
          position={[0, wallThickness / 2 - 0.05, wallHeight / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Splice bars (same size and pitch as main bars) */}
      {showRebar && (
        <group name="splice-bars">
          {Array.from({ length: numSpliceBars }).map((_, i) => {
            const z = (i + 1) * spliceBarSpacing;
            const barLength = 0.5; // 500mm splice length

            const barGeometry = new THREE.CylinderGeometry(
              verticalBarDiameter / 2,
              verticalBarDiameter / 2,
              barLength,
              16
            );

            return (
              <mesh
                key={`splice-bar-${i}`}
                geometry={barGeometry}
                material={spliceBarMaterial}
                position={[
                  -jointWidth / 2 - barLength / 2,
                  -wallThickness / 2 + buriedCover,
                  z,
                ]}
                rotation={[0, 0, Math.PI / 2]}
              />
            );
          })}
        </group>
      )}

      {showLabels && (
        <group name="labels">
          <Text
            position={[0, -wallThickness / 2 - 0.3, wallHeight / 2]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            50mm Buried Cover
          </Text>
          <Text
            position={[0, wallThickness / 2 + 0.3, wallHeight / 2]}
            fontSize={0.15}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            25mm Internal Cover
          </Text>
          <Text
            position={[wallLength / 2 + 0.5, 0, kickerHeight / 2]}
            fontSize={0.12}
            color="blue"
            anchorX="left"
            anchorY="middle"
          >
            Kicker 75mm
          </Text>
          <Text
            position={[wallLength / 2 + 0.5, 0, -kickerBelowGround / 2]}
            fontSize={0.12}
            color="blue"
            anchorX="left"
            anchorY="middle"
          >
            150mm Below Ground
          </Text>
          {hasCavityDrain && (
            <Text
              position={[
                -wallLength / 2 - 0.5,
                -wallThickness / 2 - 0.025,
                wallHeight / 2,
              ]}
              fontSize={0.12}
              color="green"
              anchorX="right"
              anchorY="middle"
            >
              Cavity Drain Slot
            </Text>
          )}
        </group>
      )}
    </group>
  );
}
