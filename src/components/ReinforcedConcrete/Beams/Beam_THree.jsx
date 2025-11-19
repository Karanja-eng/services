import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * BEAM AND COLUMN DETAILING MODELS - MB1-MB3, MC1-MC6
 * Based on IStructE/Concrete Society Standard Method of Detailing Structural Concrete
 *
 * These components visualize standard reinforcement details for concrete beams and columns
 * following BS EN 1992 (Eurocode 2) practices.
 */

// ============================================================================
// MB1: BEAMS - SPAN AND SUPPORT DETAILS (Sections A-A and B-B)
// ============================================================================

/**
 * MB1: Beams - Span and Support Details
 * Shows typical beam reinforcement with:
 * - Section A-A: Cross-section showing main bars, links, spacers, hanger bars
 * - Section B-B: Cross-section for broad beams
 * - Bottom bars in span
 * - Top bars at supports (60% continuing, 40% curtailed)
 * - U-bars at end supports
 * - Links with proper spacing
 * - Hanger bars (20% of max support area, min 2H16)
 *
 * @param {Object} props
 */
export function DrawBeamMB1({
  span = 6.0,
  beamWidth = 0.3,
  beamDepth = 0.6,
  cover = 0.035,
  bottomBarCount = 4,
  bottomBarDiameter = 0.025,
  topBarCount = 4,
  topBarDiameter = 0.02,
  hangerBarCount = 2,
  hangerBarDiameter = 0.016,
  linkDiameter = 0.01,
  linkSpacing = 0.2,
  spacerDiameter = 0.025,
  showSectionAA = true,
  showSectionBB = false,
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    links: "#3366cc",
    hangerBars: "#cc8833",
    spacers: "#999999",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const effectiveDepth =
    beamDepth - cover - linkDiameter - bottomBarDiameter / 2;
  const tensionLap = bottomBarDiameter * 42; // Simplified for C30/37

  // Concrete geometry
  const beamGeometry = useMemo(
    () => new THREE.BoxGeometry(beamWidth, beamDepth, span),
    [beamWidth, beamDepth, span]
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

  const barMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.links,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.links, wireframe]
  );

  const hangerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.hangerBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.hangerBars, wireframe]
  );

  const spacerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.spacers,
        metalness: 0.6,
        roughness: 0.4,
        wireframe: wireframe,
      }),
    [colors.spacers, wireframe]
  );

  // Calculate bar positions
  const bottomBarPositions = useMemo(() => {
    const positions = [];
    if (bottomBarCount === 1) {
      positions.push(0);
    } else {
      const availableWidth =
        beamWidth - 2 * (cover + linkDiameter + bottomBarDiameter / 2);
      const spacing = availableWidth / (bottomBarCount - 1);
      for (let i = 0; i < bottomBarCount; i++) {
        positions.push(-availableWidth / 2 + i * spacing);
      }
    }
    return positions;
  }, [bottomBarCount, beamWidth, cover, linkDiameter, bottomBarDiameter]);

  const topBarPositions = useMemo(() => {
    const positions = [];
    if (topBarCount === 1) {
      positions.push(0);
    } else {
      const availableWidth =
        beamWidth - 2 * (cover + linkDiameter + topBarDiameter / 2);
      const spacing = availableWidth / (topBarCount - 1);
      for (let i = 0; i < topBarCount; i++) {
        positions.push(-availableWidth / 2 + i * spacing);
      }
    }
    return positions;
  }, [topBarCount, beamWidth, cover, linkDiameter, topBarDiameter]);

  // Create rectangular link path
  const createLinkPath = () => {
    const path = new THREE.CurvePath();
    const linkWidth = beamWidth - 2 * cover - linkDiameter;
    const linkHeight = beamDepth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hh = linkHeight / 2;

    const points = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  // Create U-bar path for end supports
  const createUBarPath = () => {
    const path = new THREE.CurvePath();
    const bendRadius = topBarDiameter * 2;
    const topY = beamDepth / 2 - cover - linkDiameter - topBarDiameter / 2;
    const bottomY =
      -beamDepth / 2 + cover + linkDiameter + bottomBarDiameter / 2;
    const horizontalLength = 0.3 * span; // Top leg length

    // Bottom horizontal
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-horizontalLength / 2, bottomY, 0),
        new THREE.Vector3(-bendRadius, bottomY, 0)
      )
    );

    // Left bend
    const leftArc = new THREE.ArcCurve(
      -bendRadius,
      bottomY + bendRadius,
      bendRadius,
      -Math.PI / 2,
      0,
      false
    );
    const leftArcPoints = leftArc.getPoints(12);
    const leftArc3D = leftArcPoints.map((p) => new THREE.Vector3(p.x, p.y, 0));
    for (let i = 0; i < leftArc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(leftArc3D[i], leftArc3D[i + 1]));
    }

    // Vertical left
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-bendRadius * 2, bottomY + bendRadius, 0),
        new THREE.Vector3(-bendRadius * 2, topY - bendRadius, 0)
      )
    );

    // Top left bend
    const topLeftArc = new THREE.ArcCurve(
      -bendRadius,
      topY - bendRadius,
      bendRadius,
      0,
      Math.PI / 2,
      false
    );
    const topLeftArcPoints = topLeftArc.getPoints(12);
    const topLeftArc3D = topLeftArcPoints.map(
      (p) => new THREE.Vector3(p.x, p.y, 0)
    );
    for (let i = 0; i < topLeftArc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(topLeftArc3D[i], topLeftArc3D[i + 1]));
    }

    // Top horizontal
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-bendRadius, topY, 0),
        new THREE.Vector3(bendRadius, topY, 0)
      )
    );

    // Top right bend
    const topRightArc = new THREE.ArcCurve(
      bendRadius,
      topY - bendRadius,
      bendRadius,
      Math.PI / 2,
      Math.PI,
      false
    );
    const topRightArcPoints = topRightArc.getPoints(12);
    const topRightArc3D = topRightArcPoints.map(
      (p) => new THREE.Vector3(p.x, p.y, 0)
    );
    for (let i = 0; i < topRightArc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(topRightArc3D[i], topRightArc3D[i + 1]));
    }

    // Vertical right
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(bendRadius * 2, topY - bendRadius, 0),
        new THREE.Vector3(bendRadius * 2, bottomY + bendRadius, 0)
      )
    );

    // Right bend
    const rightArc = new THREE.ArcCurve(
      bendRadius,
      bottomY + bendRadius,
      bendRadius,
      Math.PI,
      Math.PI * 1.5,
      false
    );
    const rightArcPoints = rightArc.getPoints(12);
    const rightArc3D = rightArcPoints.map(
      (p) => new THREE.Vector3(p.x, p.y, 0)
    );
    for (let i = 0; i < rightArc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(rightArc3D[i], rightArc3D[i + 1]));
    }

    // Bottom horizontal right
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(bendRadius, bottomY, 0),
        new THREE.Vector3(horizontalLength / 2, bottomY, 0)
      )
    );

    return path;
  };

  const linkPath = createLinkPath();
  const uBarPath = createUBarPath();

  return (
    <group name="MB1-Beam">
      {/* Concrete Beam */}
      {showConcrete && (
        <mesh
          geometry={beamGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Bottom Span Bars */}
          <group name="bottom-span-bars">
            {bottomBarPositions.map((x, i) => {
              const y =
                -beamDepth / 2 + cover + linkDiameter + bottomBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                bottomBarDiameter / 2,
                bottomBarDiameter / 2,
                span,
                16
              );

              return (
                <mesh
                  key={`bottom-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Top Support Bars - 60% continuing full length */}
          <group name="top-support-bars">
            {topBarPositions.map((x, i) => {
              const y =
                beamDepth / 2 - cover - linkDiameter - topBarDiameter / 2;

              // 60% of bars continue full length
              const isContinuous = i < Math.ceil(topBarCount * 0.6);
              const barLength = isContinuous ? span : 0.25 * span; // 0.25L from support

              const barGeometry = new THREE.CylinderGeometry(
                topBarDiameter / 2,
                topBarDiameter / 2,
                barLength,
                16
              );

              if (isContinuous) {
                return (
                  <mesh
                    key={`top-bar-cont-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              } else {
                // Curtailed bars at both supports
                return (
                  <React.Fragment key={`top-bar-curt-${i}`}>
                    <mesh
                      geometry={barGeometry}
                      material={barMaterial}
                      position={[x, y, -span / 2 + barLength / 2]}
                      rotation={[Math.PI / 2, 0, 0]}
                    />
                    <mesh
                      geometry={barGeometry}
                      material={barMaterial}
                      position={[x, y, span / 2 - barLength / 2]}
                      rotation={[Math.PI / 2, 0, 0]}
                    />
                  </React.Fragment>
                );
              }
            })}
          </group>

          {/* Hanger Bars - Minimum 2H16, 20% of max support area */}
          <group name="hanger-bars">
            {Array.from({ length: hangerBarCount }).map((_, i) => {
              const x = i === 0 ? -beamWidth / 4 : beamWidth / 4;
              const y =
                beamDepth / 2 - cover - linkDiameter - hangerBarDiameter / 2;

              const hangerGeometry = new THREE.CylinderGeometry(
                hangerBarDiameter / 2,
                hangerBarDiameter / 2,
                span - 0.05, // 25mm from each support
                16
              );

              return (
                <mesh
                  key={`hanger-${i}`}
                  geometry={hangerGeometry}
                  material={hangerMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Links */}
          <group name="links">
            {Array.from({ length: Math.floor(span / linkSpacing) + 1 }).map(
              (_, i) => {
                const z = -span / 2 + i * linkSpacing + 0.05; // 50mm from end

                const linkGeometry = new THREE.TubeGeometry(
                  linkPath,
                  64,
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
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              }
            )}
          </group>

          {/* U-bars at end supports */}
          <group name="u-bars">
            {["left", "right"].map((side) => {
              const alternatePositions = topBarPositions.filter(
                (_, idx) => idx % 2 === 0
              );

              return alternatePositions.map((x, i) => {
                const zPos = side === "left" ? -span / 2 : span / 2;
                const rotation = side === "right" ? Math.PI : 0;

                const uBarGeometry = new THREE.TubeGeometry(
                  uBarPath,
                  128,
                  topBarDiameter / 2,
                  8,
                  false
                );

                return (
                  <mesh
                    key={`u-bar-${side}-${i}`}
                    geometry={uBarGeometry}
                    material={barMaterial}
                    position={[x, 0, zPos]}
                    rotation={[Math.PI / 2, rotation, 0]}
                  />
                );
              });
            })}
          </group>

          {/* Spacers (for multiple layers of bars) */}
          {bottomBarCount > 4 && (
            <group name="spacers">
              {bottomBarPositions.slice(0, -1).map((x, i) => {
                const y =
                  -beamDepth / 2 +
                  cover +
                  linkDiameter +
                  bottomBarDiameter * 1.5;
                const spacerLength = Math.max(
                  spacerDiameter,
                  bottomBarDiameter
                );

                const spacerGeometry = new THREE.CylinderGeometry(
                  spacerDiameter / 2,
                  spacerDiameter / 2,
                  spacerLength,
                  16
                );

                return (
                  <mesh
                    key={`spacer-${i}`}
                    geometry={spacerGeometry}
                    material={spacerMaterial}
                    position={[x + bottomBarDiameter, y, 0]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                );
              })}
            </group>
          )}

          {/* Bottom splice bars at internal supports (30% of max span area) */}
          <group name="bottom-splice-bars">
            {bottomBarPositions
              .slice(0, Math.ceil(bottomBarCount * 0.3))
              .map((x, i) => {
                const y =
                  -beamDepth / 2 + cover + linkDiameter + bottomBarDiameter / 2;
                const spliceLength = tensionLap;

                const spliceGeometry = new THREE.CylinderGeometry(
                  bottomBarDiameter / 2,
                  bottomBarDiameter / 2,
                  spliceLength,
                  16
                );

                return (
                  <mesh
                    key={`splice-${i}`}
                    geometry={spliceGeometry}
                    material={barMaterial}
                    position={[x, y, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              })}
          </group>
        </group>
      )}

      {/* Section A-A Indicator */}
      {showSectionAA && showLabels && (
        <group name="section-aa-indicator" position={[0, 0, span / 3]}>
          {/* Visual marker for Section A-A */}
        </group>
      )}

      {/* Section B-B Indicator */}
      {showSectionBB && showLabels && (
        <group name="section-bb-indicator" position={[0, 0, -span / 3]}>
          {/* Visual marker for Section B-B */}
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Cover dimensions */}
          {/* Bar specifications */}
          {/* Link spacing */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MB2: BROAD SHALLOW BEAMS
// ============================================================================

/**
 * MB2: Broad Shallow Beams
 * Shows reinforcement for wide beams with:
 * - Multiple layers of internal links
 * - Closer bars for open links (beam width ≥ 300mm)
 * - Maximum lateral spacing of link legs
 * - Proper arrangement to avoid overlap
 */
export function DrawBeamMB2({
  span = 6.0,
  beamWidth = 0.8,
  beamDepth = 0.4,
  cover = 0.035,
  bottomBarCount = 6,
  bottomBarDiameter = 0.025,
  topBarCount = 4,
  topBarDiameter = 0.02,
  linkDiameter = 0.01,
  linkSpacing = 0.15,
  useOpenLinks = true,
  closerBarDiameter = 0.01,
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    links: "#3366cc",
    closerBars: "#999999",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const effectiveDepth =
    beamDepth - cover - linkDiameter - bottomBarDiameter / 2;

  // For broad beams, maximum lateral spacing = effective depth
  // Distance of tension bar from vertical leg ≤ 150mm
  const numInternalLinks = Math.floor((beamWidth - 2 * cover) / effectiveDepth);

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

  const barMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.links,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.links, wireframe]
  );

  const closerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.closerBars,
        metalness: 0.6,
        roughness: 0.4,
        wireframe: wireframe,
      }),
    [colors.closerBars, wireframe]
  );

  const beamGeometry = useMemo(
    () => new THREE.BoxGeometry(beamWidth, beamDepth, span),
    [beamWidth, beamDepth, span]
  );

  // Calculate bar positions across wide beam
  const bottomBarPositions = useMemo(() => {
    const positions = [];
    const availableWidth =
      beamWidth - 2 * (cover + linkDiameter + bottomBarDiameter / 2);
    const spacing = availableWidth / (bottomBarCount - 1);
    for (let i = 0; i < bottomBarCount; i++) {
      positions.push(-availableWidth / 2 + i * spacing);
    }
    return positions;
  }, [bottomBarCount, beamWidth, cover, linkDiameter, bottomBarDiameter]);

  const topBarPositions = useMemo(() => {
    const positions = [];
    const availableWidth =
      beamWidth - 2 * (cover + linkDiameter + topBarDiameter / 2);
    const spacing = availableWidth / (topBarCount - 1);
    for (let i = 0; i < topBarCount; i++) {
      positions.push(-availableWidth / 2 + i * spacing);
    }
    return positions;
  }, [topBarCount, beamWidth, cover, linkDiameter, topBarDiameter]);

  // Create link system for broad beam
  const createBroadBeamLinks = (xOffset = 0) => {
    const path = new THREE.CurvePath();
    const linkWidth = beamWidth / (numInternalLinks + 1) - linkDiameter;
    const linkHeight = beamDepth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hh = linkHeight / 2;

    if (useOpenLinks) {
      // Open U-shaped link
      path.add(
        new THREE.LineCurve3(
          new THREE.Vector3(-hw, -hh, 0),
          new THREE.Vector3(-hw, hh, 0)
        )
      );
      path.add(
        new THREE.LineCurve3(
          new THREE.Vector3(-hw, hh, 0),
          new THREE.Vector3(hw, hh, 0)
        )
      );
      path.add(
        new THREE.LineCurve3(
          new THREE.Vector3(hw, hh, 0),
          new THREE.Vector3(hw, -hh, 0)
        )
      );
    } else {
      // Closed rectangular link
      const points = [
        new THREE.Vector3(-hw, -hh, 0),
        new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0),
        new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];

      for (let i = 0; i < points.length - 1; i++) {
        path.add(new THREE.LineCurve3(points[i], points[i + 1]));
      }
    }

    return path;
  };

  return (
    <group name="MB2-Broad-Beam">
      {/* Concrete Beam */}
      {showConcrete && (
        <mesh
          geometry={beamGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Bottom Bars */}
          <group name="bottom-bars">
            {bottomBarPositions.map((x, i) => {
              const y =
                -beamDepth / 2 + cover + linkDiameter + bottomBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                bottomBarDiameter / 2,
                bottomBarDiameter / 2,
                span,
                16
              );

              return (
                <mesh
                  key={`bottom-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Top Bars */}
          <group name="top-bars">
            {topBarPositions.map((x, i) => {
              const y =
                beamDepth / 2 - cover - linkDiameter - topBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                topBarDiameter / 2,
                topBarDiameter / 2,
                span,
                16
              );

              return (
                <mesh
                  key={`top-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Multiple Link Legs - arranged to not overlap */}
          <group name="link-system">
            {Array.from({ length: Math.floor(span / linkSpacing) + 1 }).map(
              (_, linkSet) => {
                const z = -span / 2 + linkSet * linkSpacing + 0.05;

                return (
                  <group key={`link-set-${linkSet}`}>
                    {/* Outer enclosing link */}
                    <mesh
                      geometry={
                        new THREE.TubeGeometry(
                          createBroadBeamLinks(0),
                          64,
                          linkDiameter / 2,
                          8,
                          useOpenLinks ? false : true
                        )
                      }
                      material={linkMaterial}
                      position={[0, 0, z]}
                      rotation={[Math.PI / 2, 0, 0]}
                    />

                    {/* Internal links */}
                    {Array.from({ length: numInternalLinks }).map(
                      (_, internalIdx) => {
                        const xOffset =
                          -beamWidth / 2 +
                          (internalIdx + 1) *
                            (beamWidth / (numInternalLinks + 1));

                        return (
                          <mesh
                            key={`internal-link-${internalIdx}`}
                            geometry={
                              new THREE.TubeGeometry(
                                createBroadBeamLinks(xOffset),
                                64,
                                linkDiameter / 2,
                                8,
                                useOpenLinks ? false : true
                              )
                            }
                            material={linkMaterial}
                            position={[xOffset, 0, z]}
                            rotation={[Math.PI / 2, 0, 0]}
                          />
                        );
                      }
                    )}
                  </group>
                );
              }
            )}
          </group>

          {/* Closer Bars (for open links, beam width ≥ 300mm) */}
          {useOpenLinks && beamWidth >= 0.3 && (
            <group name="closer-bars">
              {Array.from({ length: Math.floor(span / linkSpacing) }).map(
                (_, i) => {
                  const z = -span / 2 + (i + 0.5) * linkSpacing;
                  const y =
                    beamDepth / 2 -
                    cover -
                    linkDiameter -
                    closerBarDiameter / 2;

                  const closerGeometry = new THREE.CylinderGeometry(
                    closerBarDiameter / 2,
                    closerBarDiameter / 2,
                    beamWidth - 2 * cover - 2 * linkDiameter,
                    16
                  );

                  return (
                    <mesh
                      key={`closer-${i}`}
                      geometry={closerGeometry}
                      material={closerMaterial}
                      position={[0, y, z]}
                      rotation={[0, 0, Math.PI / 2]}
                    />
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
          {/* Maximum lateral spacing indicator */}
          {/* Link arrangement notes */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MB3: CANTILEVER BEAMS
// ============================================================================

/**
 * MB3: Cantilever Beams
 * Shows cantilever reinforcement with:
 * - Top bars (main tension) extending at least 1.5 x cantilever length
 * - Bottom bars (minimum 2H16)
 * - At least 50% of cantilever bars anchored a distance of 1.5 x cantilever
 * - No reinforcement stopped less than 0.75 x cantilever
 */
export function DrawBeamMB3({
  cantileverLength = 2.5,
  backspan = 3.0,
  beamWidth = 0.3,
  beamDepth = 0.6,
  cover = 0.035,
  topBarCount = 4,
  topBarDiameter = 0.025,
  bottomBarCount = 2,
  bottomBarDiameter = 0.016,
  linkDiameter = 0.01,
  linkSpacing = 0.15,
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    links: "#3366cc",
    bottomBars: "#cc8833",
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const totalLength = cantileverLength + backspan;
  const tensionLap = topBarDiameter * 42;

  const beamGeometry = useMemo(
    () => new THREE.BoxGeometry(beamWidth, beamDepth, totalLength),
    [beamWidth, beamDepth, totalLength]
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

  const topBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const bottomBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.bottomBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.bottomBars, wireframe]
  );

  const linkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.links,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.links, wireframe]
  );

  // Calculate bar positions
  const topBarPositions = useMemo(() => {
    const positions = [];
    const availableWidth =
      beamWidth - 2 * (cover + linkDiameter + topBarDiameter / 2);
    const spacing = availableWidth / (topBarCount - 1);
    for (let i = 0; i < topBarCount; i++) {
      positions.push(-availableWidth / 2 + i * spacing);
    }
    return positions;
  }, [topBarCount, beamWidth, cover, linkDiameter, topBarDiameter]);

  const bottomBarPositions = useMemo(() => {
    const positions = [];
    const availableWidth =
      beamWidth - 2 * (cover + linkDiameter + bottomBarDiameter / 2);
    if (bottomBarCount === 2) {
      positions.push(-availableWidth / 2, availableWidth / 2);
    } else {
      const spacing = availableWidth / (bottomBarCount - 1);
      for (let i = 0; i < bottomBarCount; i++) {
        positions.push(-availableWidth / 2 + i * spacing);
      }
    }
    return positions;
  }, [bottomBarCount, beamWidth, cover, linkDiameter, bottomBarDiameter]);

  // Create link path
  const createLinkPath = () => {
    const path = new THREE.CurvePath();
    const linkWidth = beamWidth - 2 * cover - linkDiameter;
    const linkHeight = beamDepth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hh = linkHeight / 2;

    const points = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  const linkPath = createLinkPath();

  return (
    <group name="MB3-Cantilever-Beam">
      {/* Concrete Beam - positioned with cantilever extending in +Z direction */}
      {showConcrete && (
        <mesh
          geometry={beamGeometry}
          material={concreteMaterial}
          position={[0, 0, (cantileverLength - backspan) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Top Cantilever Bars (Main Tension Reinforcement) */}
          <group name="top-cantilever-bars">
            {topBarPositions.map((x, i) => {
              const y =
                beamDepth / 2 - cover - linkDiameter - topBarDiameter / 2;

              // At least 50% extend 1.5 x cantilever into backspan
              const isLongBar = i < Math.ceil(topBarCount * 0.5);
              const barLength = isLongBar
                ? cantileverLength + Math.min(1.5 * cantileverLength, backspan)
                : cantileverLength + 0.75 * cantileverLength; // Minimum 0.75 x cant

              const zPosition = cantileverLength / 2 - barLength / 2;

              const barGeometry = new THREE.CylinderGeometry(
                topBarDiameter / 2,
                topBarDiameter / 2,
                barLength,
                16
              );

              return (
                <mesh
                  key={`top-bar-${i}`}
                  geometry={barGeometry}
                  material={topBarMaterial}
                  position={[x, y, zPosition]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Bottom Bars (Minimum 2H16) */}
          <group name="bottom-bars">
            {bottomBarPositions.map((x, i) => {
              const y =
                -beamDepth / 2 + cover + linkDiameter + bottomBarDiameter / 2;
              const barLength = backspan * 0.8; // Extend into backspan
              const zPosition = cantileverLength / 2 - backspan / 2;

              const barGeometry = new THREE.CylinderGeometry(
                bottomBarDiameter / 2,
                bottomBarDiameter / 2,
                barLength,
                16
              );

              return (
                <mesh
                  key={`bottom-bar-${i}`}
                  geometry={barGeometry}
                  material={bottomBarMaterial}
                  position={[x, y, zPosition]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Links - closer spacing near support */}
          <group name="links">
            {/* Dense spacing in cantilever (0.75d typically) */}
            {Array.from({
              length: Math.floor(cantileverLength / linkSpacing) + 1,
            }).map((_, i) => {
              const z = i * linkSpacing;

              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`link-cant-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}

            {/* Normal spacing in backspan */}
            {Array.from({
              length: Math.floor(backspan / (linkSpacing * 2)),
            }).map((_, i) => {
              const z = cantileverLength + i * linkSpacing * 2;

              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`link-back-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
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
          {/* Cantilever length marker */}
          {/* Bar curtailment annotations */}
        </group>
      )}
    </group>
  );
}
