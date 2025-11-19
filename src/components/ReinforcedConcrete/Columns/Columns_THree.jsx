import * as THREE from 'three';
import { useMemo } from 'react';

// ============================================================================
// MC1: COLUMNS - BOTTOM DETAIL (Foundation to First Floor)
// ============================================================================

/**
 * MC1: Columns - Bottom Detail
 * Shows starter bars from foundation with:
 * - Compression lap + 150mm for foundation level tolerance
 * - Kicker height 75mm (150mm below ground)
 * - At least 3 links at lap (spacing ≤ 12ø, 0.6 x lesser dimension, 240mm)
 * - 450mm minimum horizontal leg in foundation
 */
export function DrawColumnMC1({
  columnWidth = 0.400,
  columnDepth = 0.400,
  firstLiftHeight = 3.0,
  foundationThickness = 0.600,
  cover = 0.035,
  barCount = 8,
  barDiameter = 0.020,
  linkDiameter = 0.010,
  linkSpacing = 0.200,
  kickerHeight = 0.075,
  colors = {
    concrete: '#a8a8a8',
    foundation: '#999999',
    mainRebar: '#cc3333',
    links: '#3366cc',
    starterBars: '#ff6600',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const compressionLap = barDiameter * 35; // Simplified for C30/37
  const starterLength = compressionLap + 0.150; // Add 150mm tolerance
  const horizontalLeg = 0.450; // Minimum 450mm

  const columnGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, firstLiftHeight),
    [columnWidth, columnDepth, firstLiftHeight]
  );

  const foundationGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth * 2, columnDepth * 2, foundationThickness),
    [columnWidth, columnDepth, foundationThickness]
  );

  const kickerGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, kickerHeight),
    [columnWidth, columnDepth, kickerHeight]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const foundationMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.foundation,
      transparent: true,
      opacity: opacity * 0.8,
      wireframe: wireframe
    }),
    [colors.foundation, opacity, wireframe]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const starterMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.starterBars,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.starterBars, wireframe]
  );

  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.links,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.links, wireframe]
  );

  // Calculate bar positions around column perimeter
  const barPositions = useMemo(() => {
    const positions = [];
    const offset = columnWidth / 2 - cover - linkDiameter - barDiameter / 2;
    const offsetD = columnDepth / 2 - cover - linkDiameter - barDiameter / 2;
    
    if (barCount === 4) {
      positions.push(
        [-offset, -offsetD],
        [offset, -offsetD],
        [offset, offsetD],
        [-offset, offsetD]
      );
    } else {
      const barsPerSide = Math.floor(barCount / 4);
      
      // Bottom edge
      for (let i = 0; i < barsPerSide; i++) {
        const x = -offset + (i / (barsPerSide - 1 || 1)) * (2 * offset);
        positions.push([x, -offsetD]);
      }
      // Right edge
      for (let i = 1; i < barsPerSide; i++) {
        const y = -offsetD + (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
        positions.push([offset, y]);
      }
      // Top edge
      for (let i = 1; i < barsPerSide; i++) {
        const x = offset - (i / (barsPerSide - 1 || 1)) * (2 * offset);
        positions.push([x, offsetD]);
      }
      // Left edge
      for (let i = 1; i < barsPerSide; i++) {
        const y = offsetD - (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
        positions.push([-offset, y]);
      }
    }
    
    return positions.slice(0, barCount);
  }, [barCount, columnWidth, columnDepth, cover, linkDiameter, barDiameter]);

  // Create link path
  const createLinkPath = () => {
    const path = new THREE.CurvePath();
    const linkWidth = columnWidth - 2 * cover - linkDiameter;
    const linkDepth = columnDepth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hd = linkDepth / 2;

    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  const linkPath = createLinkPath();

  // Create L-bar starter path
  const createStarterPath = (x, y) => {
    const path = new THREE.CurvePath();
    const bendRadius = barDiameter * 2;

    // Horizontal leg in foundation
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(horizontalLeg, 0, 0)
    ));

    // 90 degree bend
    const arc = new THREE.ArcCurve(
      horizontalLeg, bendRadius,
      bendRadius,
      -Math.PI / 2, 0,
      false
    );
    const arcPoints = arc.getPoints(12);
    const arc3D = arcPoints.map(p => new THREE.Vector3(p.x, 0, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Vertical leg
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(horizontalLeg + bendRadius, 0, bendRadius),
      new THREE.Vector3(horizontalLeg + bendRadius, 0, bendRadius + starterLength)
    ));

    return path;
  };

  return (
    <group name="MC1-Column-Bottom-Detail">
      {/* Foundation */}
      {showConcrete && (
        <mesh
          geometry={foundationGeometry}
          material={foundationMaterial}
          position={[0, 0, -foundationThickness / 2]}
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

      {/* Column First Lift */}
      {showConcrete && (
        <mesh
          geometry={columnGeometry}
          material={concreteMaterial}
          position={[0, 0, kickerHeight + firstLiftHeight / 2]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Starter Bars from Foundation */}
          <group name="starter-bars">
            {barPositions.map(([x, y], i) => {
              const angle = Math.atan2(y, x);
              const starterPath = createStarterPath(x, y);
              
              const starterGeometry = new THREE.TubeGeometry(
                starterPath,
                64,
                barDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`starter-${i}`}
                  geometry={starterGeometry}
                  material={starterMaterial}
                  position={[x, y, -foundationThickness / 2 + cover]}
                  rotation={[0, 0, angle]}
                />
              );
            })}
          </group>

          {/* Main Column Bars (First Lift) */}
          <group name="main-column-bars">
            {barPositions.map(([x, y], i) => {
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                firstLiftHeight,
                16
              );

              return (
                <mesh
                  key={`main-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x, y, kickerHeight + firstLiftHeight / 2]}
                />
              );
            })}
          </group>

          {/* Links in Column */}
          <group name="column-links">
            {Array.from({ length: Math.floor(firstLiftHeight / linkSpacing) + 1 }).map((_, i) => {
              const z = kickerHeight + i * linkSpacing + 0.05;
              
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
                />
              );
            })}
          </group>

          {/* Special lap links (at least 3, closer spacing) */}
          <group name="lap-links">
            {Array.from({ length: 3 }).map((_, i) => {
              const lapLinkSpacing = Math.min(
                12 * barDiameter,
                0.6 * Math.min(columnWidth, columnDepth),
                0.240
              );
              const z = kickerHeight + i * lapLinkSpacing;
              
              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`lap-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
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
          {/* Kicker height: 75mm (150 below ground) */}
          {/* 450mm minimum horizontal leg */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MC2: COLUMNS - INTERMEDIATE DETAIL (Concentric, Same Dimensions)
// ============================================================================

/**
 * MC2: Columns - Intermediate Detail
 * Shows typical floor-to-floor column with:
 * - Crank at bottom of lift (10 x offset for crank length)
 * - Link at knuckle of crank
 * - Spacing at lap zone (at least 3 links)
 * - No special link at crank if crank ≤ 1 in 12
 * - Main bars rest on kicker
 */
export function DrawColumnMC2({
  columnWidth = 0.400,
  columnDepth = 0.400,
  liftHeight = 3.0,
  slabThickness = 0.225,
  cover = 0.035,
  barCount = 8,
  barDiameter = 0.020,
  linkDiameter = 0.010,
  linkSpacing = 0.200,
  kickerHeight = 0.075,
  hasCrank = false,
  crankOffset = 0.050,
  colors = {
    concrete: '#a8a8a8',
    slab: '#999999',
    mainRebar: '#cc3333',
    links: '#3366cc',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const compressionLap = barDiameter * 35;
  const crankLength = hasCrank ? 10 * crankOffset : 0;
  const projectionAboveSlab = compressionLap + kickerHeight;

  const columnGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, liftHeight),
    [columnWidth, columnDepth, liftHeight]
  );

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth * 3, columnDepth * 3, slabThickness),
    [columnWidth, columnDepth, slabThickness]
  );

  const kickerGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, kickerHeight),
    [columnWidth, columnDepth, kickerHeight]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const slabMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.slab,
      transparent: true,
      opacity: opacity * 0.7,
      wireframe: wireframe
    }),
    [colors.slab, opacity, wireframe]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.links,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.links, wireframe]
  );

  // Calculate bar positions
  const barPositions = useMemo(() => {
    const positions = [];
    const offset = columnWidth / 2 - cover - linkDiameter - barDiameter / 2;
    const offsetD = columnDepth / 2 - cover - linkDiameter - barDiameter / 2;
    
    if (barCount === 4) {
      positions.push(
        [-offset, -offsetD],
        [offset, -offsetD],
        [offset, offsetD],
        [-offset, offsetD]
      );
    } else {
      const barsPerSide = Math.floor(barCount / 4);
      
      for (let i = 0; i < barsPerSide; i++) {
        const x = -offset + (i / (barsPerSide - 1 || 1)) * (2 * offset);
        positions.push([x, -offsetD]);
      }
      for (let i = 1; i < barsPerSide; i++) {
        const y = -offsetD + (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
        positions.push([offset, y]);
      }
      for (let i = 1; i < barsPerSide; i++) {
        const x = offset - (i / (barsPerSide - 1 || 1)) * (2 * offset);
        positions.push([x, offsetD]);
      }
      for (let i = 1; i < barsPerSide; i++) {
        const y = offsetD - (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
        positions.push([-offset, y]);
      }
    }
    
    return positions.slice(0, barCount);
  }, [barCount, columnWidth, columnDepth, cover, linkDiameter, barDiameter]);

  // Create link path
  const createLinkPath = () => {
    const path = new THREE.CurvePath();
    const linkWidth = columnWidth - 2 * cover - linkDiameter;
    const linkDepth = columnDepth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hd = linkDepth / 2;

    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  const linkPath = createLinkPath();

  // Create cranked bar path
  const createCrankedBarPath = (x, y) => {
    if (!hasCrank) {
      // Straight bar
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, liftHeight)
      ));
      return path;
    }

    const path = new THREE.CurvePath();
    const angle = Math.atan(crankOffset / crankLength);

    // Vertical section before crank
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, kickerHeight)
    ));

    // Crank section (inclined)
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(0, 0, kickerHeight),
      new THREE.Vector3(crankOffset, 0, kickerHeight + crankLength)
    ));

    // Vertical section after crank
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(crankOffset, 0, kickerHeight + crankLength),
      new THREE.Vector3(crankOffset, 0, liftHeight)
    ));

    return path;
  };

  return (
    <group name="MC2-Column-Intermediate-Detail">
      {/* Slab/Floor Below */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={slabMaterial}
          position={[0, 0, -slabThickness / 2]}
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

      {/* Column Lift */}
      {showConcrete && (
        <mesh
          geometry={columnGeometry}
          material={concreteMaterial}
          position={[0, 0, liftHeight / 2 + kickerHeight]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Main Column Bars */}
          <group name="main-bars">
            {barPositions.map(([x, y], i) => {
              if (hasCrank) {
                const crankedPath = createCrankedBarPath(x, y);
                const barGeometry = new THREE.TubeGeometry(
                  crankedPath,
                  64,
                  barDiameter / 2,
                  8,
                  false
                );

return (
                  <mesh
                    key={`main-bar-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, 0]}
                  />
                );
              } else {
                const barGeometry = new THREE.CylinderGeometry(
                  barDiameter / 2,
                  barDiameter / 2,
                  liftHeight,
                  16
                );

                return (
                  <mesh
                    key={`main-bar-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, kickerHeight + liftHeight / 2]}
                  />
                );
              }
            })}
          </group>

          {/* Links in Column */}
          <group name="column-links">
            {Array.from({ length: Math.floor(liftHeight / linkSpacing) + 1 }).map((_, i) => {
              const z = kickerHeight + i * linkSpacing + 0.05;
              
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
                />
              );
            })}
          </group>

          {/* Lap Zone Links (at least 3, closer spacing) */}
          <group name="lap-links">
            {Array.from({ length: 3 }).map((_, i) => {
              const lapLinkSpacing = Math.min(
                12 * barDiameter,
                0.6 * Math.min(columnWidth, columnDepth),
                0.240
              );
              const z = kickerHeight + i * lapLinkSpacing;
              
              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`lap-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
                />
              );
            })}
          </group>

          {/* Link at crank knuckle (if crank > 1 in 12) */}
          {hasCrank && (crankOffset / crankLength > 1 / 12) && (
            <mesh
              geometry={new THREE.TubeGeometry(linkPath, 64, linkDiameter / 2, 8, true)}
              material={linkMaterial}
              position={[crankOffset / 2, 0, kickerHeight + crankLength / 2]}
            />
          )}

          {/* Bars projecting above slab (for next lift) */}
          <group name="projection-bars">
            {barPositions.map(([x, y], i) => {
              const xOffset = hasCrank ? crankOffset : 0;
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                projectionAboveSlab,
                16
              );

              return (
                <mesh
                  key={`projection-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x + xOffset, y, liftHeight + kickerHeight + projectionAboveSlab / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Crank length: 10 x offset */}
          {/* Link at knuckle if crank > 1:12 */}
          {/* 50mm to start link run */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MC3: COLUMNS - INTERMEDIATE DETAIL (Stepped/Offset Columns)
// ============================================================================

/**
 * MC3: Columns - Stepped or Offset Columns
 * Shows column with change in section:
 * - Splice bars located by dimensions from face of lower column
 * - Minimum 3 locating links
 * - Fixing dimension = compression lap + 75mm
 */
export function DrawColumnMC3({
  lowerColumnWidth = 0.400,
  lowerColumnDepth = 0.400,
  upperColumnWidth = 0.350,
  upperColumnDepth = 0.350,
  lowerLiftHeight = 3.0,
  upperLiftHeight = 3.0,
  slabThickness = 0.225,
  offsetX = 0.050,
  offsetY = 0.050,
  cover = 0.035,
  barCount = 8,
  barDiameter = 0.020,
  linkDiameter = 0.010,
  linkSpacing = 0.200,
  kickerHeight = 0.075,
  colors = {
    concrete: '#a8a8a8',
    slab: '#999999',
    mainRebar: '#cc3333',
    links: '#3366cc',
    spliceBars: '#ff6600',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const compressionLap = barDiameter * 35;
  const spliceBarsFixing = compressionLap + 0.075;

  const lowerColumnGeometry = useMemo(
    () => new THREE.BoxGeometry(lowerColumnWidth, lowerColumnDepth, lowerLiftHeight),
    [lowerColumnWidth, lowerColumnDepth, lowerLiftHeight]
  );

  const upperColumnGeometry = useMemo(
    () => new THREE.BoxGeometry(upperColumnWidth, upperColumnDepth, upperLiftHeight),
    [upperColumnWidth, upperColumnDepth, upperLiftHeight]
  );

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(
      Math.max(lowerColumnWidth, upperColumnWidth) * 3,
      Math.max(lowerColumnDepth, upperColumnDepth) * 3,
      slabThickness
    ),
    [lowerColumnWidth, lowerColumnDepth, upperColumnWidth, upperColumnDepth, slabThickness]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const slabMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.slab,
      transparent: true,
      opacity: opacity * 0.7,
      wireframe: wireframe
    }),
    [colors.slab, opacity, wireframe]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const spliceMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.spliceBars,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.spliceBars, wireframe]
  );

  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.links,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.links, wireframe]
  );

  // Bar positions for lower column
  const lowerBarPositions = useMemo(() => {
    const positions = [];
    const offset = lowerColumnWidth / 2 - cover - linkDiameter - barDiameter / 2;
    const offsetD = lowerColumnDepth / 2 - cover - linkDiameter - barDiameter / 2;
    
    const barsPerSide = Math.floor(barCount / 4);
    
    for (let i = 0; i < barsPerSide; i++) {
      const x = -offset + (i / (barsPerSide - 1 || 1)) * (2 * offset);
      positions.push([x, -offsetD]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const y = -offsetD + (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
      positions.push([offset, y]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const x = offset - (i / (barsPerSide - 1 || 1)) * (2 * offset);
      positions.push([x, offsetD]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const y = offsetD - (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
      positions.push([-offset, y]);
    }
    
    return positions.slice(0, barCount);
  }, [barCount, lowerColumnWidth, lowerColumnDepth, cover, linkDiameter, barDiameter]);

  // Bar positions for upper column
  const upperBarPositions = useMemo(() => {
    const positions = [];
    const offset = upperColumnWidth / 2 - cover - linkDiameter - barDiameter / 2;
    const offsetD = upperColumnDepth / 2 - cover - linkDiameter - barDiameter / 2;
    
    const barsPerSide = Math.floor(barCount / 4);
    
    for (let i = 0; i < barsPerSide; i++) {
      const x = -offset + (i / (barsPerSide - 1 || 1)) * (2 * offset);
      positions.push([x, -offsetD]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const y = -offsetD + (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
      positions.push([offset, y]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const x = offset - (i / (barsPerSide - 1 || 1)) * (2 * offset);
      positions.push([x, offsetD]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const y = offsetD - (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
      positions.push([-offset, y]);
    }
    
    return positions.slice(0, barCount);
  }, [barCount, upperColumnWidth, upperColumnDepth, cover, linkDiameter, barDiameter]);

  // Create link paths
  const createLinkPath = (width, depth) => {
    const path = new THREE.CurvePath();
    const linkWidth = width - 2 * cover - linkDiameter;
    const linkDepth = depth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hd = linkDepth / 2;

    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  const lowerLinkPath = createLinkPath(lowerColumnWidth, lowerColumnDepth);
  const upperLinkPath = createLinkPath(upperColumnWidth, upperColumnDepth);

  return (
    <group name="MC3-Column-Stepped-Offset">
      {/* Lower Column */}
      {showConcrete && (
        <mesh
          geometry={lowerColumnGeometry}
          material={concreteMaterial}
          position={[0, 0, lowerLiftHeight / 2]}
        />
      )}

      {/* Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={slabMaterial}
          position={[offsetX / 2, offsetY / 2, lowerLiftHeight + slabThickness / 2]}
        />
      )}

      {/* Upper Column (offset) */}
      {showConcrete && (
        <mesh
          geometry={upperColumnGeometry}
          material={concreteMaterial}
          position={[
            offsetX,
            offsetY,
            lowerLiftHeight + slabThickness + kickerHeight + upperLiftHeight / 2
          ]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Lower Column Main Bars */}
          <group name="lower-column-bars">
            {lowerBarPositions.map(([x, y], i) => {
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                lowerLiftHeight,
                16
              );

              return (
                <mesh
                  key={`lower-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x, y, lowerLiftHeight / 2]}
                />
              );
            })}
          </group>

          {/* Splice Bars extending into slab */}
          <group name="splice-bars">
            {upperBarPositions.map(([x, y], i) => {
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                spliceBarsFixing,
                16
              );

              // Position relative to upper column but extending down into slab
              return (
                <mesh
                  key={`splice-${i}`}
                  geometry={barGeometry}
                  material={spliceMaterial}
                  position={[
                    offsetX + x,
                    offsetY + y,
                    lowerLiftHeight + slabThickness + kickerHeight - spliceBarsFixing / 2
                  ]}
                />
              );
            })}
          </group>

          {/* Upper Column Main Bars */}
          <group name="upper-column-bars">
            {upperBarPositions.map(([x, y], i) => {
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                upperLiftHeight,
                16
              );

              return (
                <mesh
                  key={`upper-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[
                    offsetX + x,
                    offsetY + y,
                    lowerLiftHeight + slabThickness + kickerHeight + upperLiftHeight / 2
                  ]}
                />
              );
            })}
          </group>

          {/* Lower Column Links */}
          <group name="lower-links">
            {Array.from({ length: Math.floor(lowerLiftHeight / linkSpacing) + 1 }).map((_, i) => {
              const z = i * linkSpacing + 0.05;
              
              const linkGeometry = new THREE.TubeGeometry(
                lowerLinkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`lower-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
                />
              );
            })}
          </group>

          {/* Upper Column Links */}
          <group name="upper-links">
            {Array.from({ length: Math.floor(upperLiftHeight / linkSpacing) + 1 }).map((_, i) => {
              const z = lowerLiftHeight + slabThickness + kickerHeight + i * linkSpacing + 0.05;
              
              const linkGeometry = new THREE.TubeGeometry(
                upperLinkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`upper-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[offsetX, offsetY, z]}
                />
              );
            })}
          </group>

          {/* Locating Links (minimum 3 in slab zone) */}
          <group name="locating-links">
            {Array.from({ length: 3 }).map((_, i) => {
              const z = lowerLiftHeight + slabThickness / 2 + (i - 1) * 0.075;
              
              const linkGeometry = new THREE.TubeGeometry(
                upperLinkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`locating-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[offsetX, offsetY, z]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Offset dimensions */}
          {/* Splice bar fixing dimension */}
          {/* Minimum 3 locating links */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MC4: COLUMNS - TOP DETAIL
// ============================================================================

/**
 * MC4: Columns - Top Detail (Details A and B)
 * Shows top termination of column with:
 * - Detail A: For adequate slab depth (bars turned into slab)
 * - Detail B: For thin slabs (bars project above slab)
 * - Tension lap for edge/corner columns (1.4 x anchorage for ≥25mm bars)
 * - Lap link spacing requirements
 */
export function DrawColumnMC4({
  columnWidth = 0.400,
  columnDepth = 0.400,
  columnHeight = 3.0,
  slabThickness = 0.250,
  roofLevel = true,
  cover = 0.035,
  barCount = 8,
  barDiameter = 0.020,
  linkDiameter = 0.010,
  linkSpacing = 0.200,
  detailType = 'A', // 'A' or 'B'
  isEdgeColumn = false,
  colors = {
    concrete: '#a8a8a8',
    slab: '#999999',
    mainRebar: '#cc3333',
    links: '#3366cc',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const tensionLap = barDiameter * 42; // Simplified
  const tensionLapEdge = isEdgeColumn && barDiameter >= 0.025 ? tensionLap * 1.4 : tensionLap;
  
  // Minimum slab depths for Detail A
  const minSlabDepthFor20mm = 0.200;
  const minSlabDepthFor25mm = 0.250;
  const minSlabDepthFor32mm = 0.300;
  
  // Determine if Detail A is applicable
  const canUseDetailA = 
    (barDiameter <= 0.020 && slabThickness >= minSlabDepthFor20mm) ||
    (barDiameter <= 0.025 && slabThickness >= minSlabDepthFor25mm) ||
    (barDiameter <= 0.032 && slabThickness >= minSlabDepthFor32mm);

  const actualDetailType = canUseDetailA ? detailType : 'B';

  const columnGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, columnDepth, columnHeight),
    [columnWidth, columnDepth, columnHeight]
  );

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth * 3, columnDepth * 3, slabThickness),
    [columnWidth, columnDepth, slabThickness]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const slabMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.slab,
      transparent: true,
      opacity: opacity * 0.7,
      wireframe: wireframe
    }),
    [colors.slab, opacity, wireframe]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.links,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.links, wireframe]
  );

  // Bar positions
  const barPositions = useMemo(() => {
    const positions = [];
    const offset = columnWidth / 2 - cover - linkDiameter - barDiameter / 2;
    const offsetD = columnDepth / 2 - cover - linkDiameter - barDiameter / 2;
    
    const barsPerSide = Math.floor(barCount / 4);
    
    for (let i = 0; i < barsPerSide; i++) {
      const x = -offset + (i / (barsPerSide - 1 || 1)) * (2 * offset);
      positions.push([x, -offsetD]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const y = -offsetD + (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
      positions.push([offset, y]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const x = offset - (i / (barsPerSide - 1 || 1)) * (2 * offset);
      positions.push([x, offsetD]);
    }
    for (let i = 1; i < barsPerSide; i++) {
      const y = offsetD - (i / (barsPerSide - 1 || 1)) * (2 * offsetD);
      positions.push([-offset, y]);
    }
    
    return positions.slice(0, barCount);
  }, [barCount, columnWidth, columnDepth, cover, linkDiameter, barDiameter]);

  // Create link path
  const createLinkPath = () => {
    const path = new THREE.CurvePath();
    const linkWidth = columnWidth - 2 * cover - linkDiameter;
    const linkDepth = columnDepth - 2 * cover - linkDiameter;
    const hw = linkWidth / 2;
    const hd = linkDepth / 2;

    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  const linkPath = createLinkPath();

  // Create L-bar termination path for Detail A
  const createLBarTermination = () => {
    const path = new THREE.CurvePath();
    const bendRadius = barDiameter * 2;
    const horizontalLength = slabThickness - cover * 2 - barDiameter;

    // Vertical section
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, columnHeight - cover - bendRadius)
    ));

    // 90 degree bend
    const arc = new THREE.ArcCurve(
      bendRadius, columnHeight - cover - bendRadius,
      bendRadius,
      Math.PI, Math.PI / 2,
      true
    );
    const arcPoints = arc.getPoints(12);
    const arc3D = arcPoints.map(p => new THREE.Vector3(p.x, 0, p.y));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Horizontal section into slab
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(bendRadius, 0, columnHeight - cover),
      new THREE.Vector3(bendRadius + horizontalLength, 0, columnHeight - cover)
    ));

    return path;
  };

  return (
    <group name="MC4-Column-Top-Detail">
      {/* Column */}
      {showConcrete && (
        <mesh
          geometry={columnGeometry}
          material={concreteMaterial}
          position={[0, 0, columnHeight / 2]}
        />
      )}

      {/* Roof Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={slabMaterial}
          position={[0, 0, columnHeight + slabThickness / 2]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Main Column Bars */}
          <group name="main-bars">
            {barPositions.map(([x, y], i) => {
              if (actualDetailType === 'A') {
                // Detail A: Bars turned into slab
                const lBarPath = createLBarTermination();
                const barGeometry = new THREE.TubeGeometry(
                  lBarPath,
                  64,
                  barDiameter / 2,
                  8,
                  false
                );

                const angle = Math.atan2(y, x);

                return (
                  <mesh
                    key={`main-bar-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, 0]}
                    rotation={[0, 0, angle]}
                  />
                );
              } else {
                // Detail B: Bars project above slab
                const totalLength = columnHeight + slabThickness + tensionLapEdge;
                const barGeometry = new THREE.CylinderGeometry(
                  barDiameter / 2,
                  barDiameter / 2,
                  totalLength,
                  16
                );

                return (
                  <mesh
                    key={`main-bar-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, totalLength / 2]}
                  />
                );
              }
            })}
          </group>

          {/* Column Links */}
          <group name="column-links">
            {Array.from({ length: Math.floor(columnHeight / linkSpacing) + 1 }).map((_, i) => {
              const z = i * linkSpacing + 0.05;
              
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
                />
              );
            })}
          </group>

          {/* Lap Zone Links (at least 3 near top) */}
          <group name="lap-links">
            {Array.from({ length: 3 }).map((_, i) => {
              const lapLinkSpacing = Math.min(
                12 * barDiameter,
                0.6 * Math.min(columnWidth, columnDepth),
                0.240
              );
              const z = columnHeight - (2 - i) * lapLinkSpacing;
              
              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`lap-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
                />
              );
            })}
          </group>

          {/* Links extending into slab for Detail B */}
          {actualDetailType === 'B' && (
            <group name="slab-links">
              {Array.from({ length: Math.floor(tensionLapEdge / linkSpacing) }).map((_, i) => {
                const z = columnHeight + i * linkSpacing;
                
                const linkGeometry = new THREE.TubeGeometry(
                  linkPath,
                  64,
                  linkDiameter / 2,
                  8,
                  true
                );

                return (
                  <mesh
                    key={`slab-link-${i}`}
                    geometry={linkGeometry}
                    material={linkMaterial}
                    position={[0, 0, z]}
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
          {/* Detail type indicator */}
          {/* Tension lap length */}
          {/* Slab depth requirements */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MC5: COLUMNS - TOP DETAIL (Single Storey/Splice Bars Below)
// ============================================================================

/**
 * MC5: Columns - Top Detail for Single Storey Buildings
 * Shows termination where splice bars were used at floor below:
 * - Bars turned as per MC4 Detail A/B table
 * - Level of top bar depends on vertical leg length accuracy
 * - Kicker height 75mm
 */
export function DrawColumnMC5({
  columnWidth = 0.400,
  columnDepth = 0.400,
  columnHeight = 3.0,
  slabThickness = 0.250,
  cover = 0.035,
  barCount = 8,
  barDiameter = 0.020,
  linkDiameter = 0.010,
  linkSpacing = 0.200,
  kickerHeight = 0.075,
  colors = {
    concrete: '#a8a8a8',
    slab: '#999999',
    mainRebar: '#cc3333',
    links: '#3366cc',
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4
}) {

  // This is essentially MC4 Detail A with splice bar consideration
  // Reuse MC4 logic but indicate this is for single storey
  return (
    <DrawColumnMC4
      columnWidth={columnWidth}
      columnDepth={columnDepth}
      columnHeight={columnHeight}
      slabThickness={slabThickness}
      roofLevel={true}
      cover={cover}
      barCount={barCount}
      barDiameter={barDiameter}
      linkDiameter={linkDiameter}
      linkSpacing={linkSpacing}
      detailType="A"
      isEdgeColumn={false}
      colors={colors}
      showConcrete={showConcrete}
      showRebar={showRebar}
      showLabels={true}
      wireframe={wireframe}
      opacity={opacity}
    />
  );
}

// ============================================================================
// MC6: CIRCULAR COLUMNS
// ============================================================================

/**
 * MC6: Circular Columns
 * Shows circular column reinforcement with:
 * - Helical binders (preferred) or circular links
 * - Main bars scheduled straight
 * - Cage rotated to lap with cage below
 * - Helical pitch (p) shown
 * - Helical binders scheduled in 12m lengths
 * - Tension lap required between helical binders
 */
export function DrawColumnMC6({
  columnDiameter = 0.400,
  liftHeight = 3.0,
  cover = 0.035,
  barCount = 8,
  barDiameter = 0.020,
  helixDiameter = 0.010,
  helixPitch = 0.150,
  kickerHeight = 0.075,
  useHelicalBinders = true,
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    helix: '#3366cc',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const radius = columnDiameter / 2;
  const barRadius = radius - cover - helixDiameter - barDiameter / 2;

  const columnGeometry = useMemo(
    () => new THREE.CylinderGeometry(radius, radius, liftHeight, 32),
    [radius, liftHeight]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const helixMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.helix,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.helix, wireframe]
  );

  // Calculate bar positions around circumference
  const barPositions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const x = Math.cos(angle) * barRadius;
      const y = Math.sin(angle) * barRadius;
      positions.push([x, y, angle]);
    }
    return positions;
  }, [barCount, barRadius]);

  // Create helical binder path
  const createHelixPath = () => {
    const path = new THREE.CurvePath();
    const turns = liftHeight / helixPitch;
    const segments = Math.floor(turns * 32);
    
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      
      const z1 = t1 * liftHeight;
      const z2 = t2 * liftHeight;
      
      const angle1 = t1 * turns * Math.PI * 2;
      const angle2 = t2 * turns * Math.PI * 2;
      
      const helixRadius = radius - cover - helixDiameter / 2;
      
      const x1 = Math.cos(angle1) * helixRadius;
      const y1 = Math.sin(angle1) * helixRadius;
      const x2 = Math.cos(angle2) * helixRadius;
      const y2 = Math.sin(angle2) * helixRadius;
      
      path.add(new THREE.LineCurve3(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y2, z2)
      ));
    }
    
    return path;
  };

  return (
    <group name="MC6-Circular-Column">
      {/* Concrete Column */}
      {showConcrete && (
        <mesh
          geometry={columnGeometry}
          material={concreteMaterial}
          position={[0, 0, liftHeight / 2 + kickerHeight]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Main Longitudinal Bars */}
          <group name="main-bars">
            {barPositions.map(([x, y, angle], i) => {
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                liftHeight,
                16
              );

              return (
                <mesh
                  key={`main-bar-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x, y, liftHeight / 2 + kickerHeight]}
                />
              );
            })}
          </group>

          {/* Helical Binders or Circular Links */}
          {useHelicalBinders ? (
            <group name="helical-binders">
              <mesh
                geometry={new THREE.TubeGeometry(
                  createHelixPath(),
                  256,
                  helixDiameter / 2,
                  8,
                  false
                )}
                material={helixMaterial}
                position={[0, 0, kickerHeight]}
              />
            </group>
          ) : (
            <group name="circular-links">
              {Array.from({ length: Math.floor(liftHeight / helixPitch) + 1 }).map((_, i) => {
                const z = kickerHeight + i * helixPitch;
                const linkRadius = radius - cover - helixDiameter / 2;
                
                const linkGeometry = new THREE.TorusGeometry(
                  linkRadius,
                  helixDiameter / 2,
                  16,
                  32
                );

                return (                return (
                  <mesh
                    key={`main-bar-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, 0]}
                  />
                );
              } else {
                const barGeometry = new THREE.CylinderGeometry(
                  barDiameter / 2,
                  barDiameter / 2,
                  liftHeight,
                  16
                );

                return (
                  <mesh
                    key={`main-bar-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[x, y, kickerHeight + liftHeight / 2]}
                  />
                );
              }
            })
          </group>

          {/* Links in Column */}
          <group name="column-links">
            {Array.from({ length: Math.floor(liftHeight / linkSpacing) + 1 }).map((_, i) => {
              const z = kickerHeight + i * linkSpacing + 0.05;
              
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
                />
              );
            })}
          </group>

          {/* Lap Zone Links (at least 3, closer spacing) */}
          <group name="lap-links">
            {Array.from({ length: 3 }).map((_, i) => {
              const lapLinkSpacing = Math.min(
                12 * barDiameter,
                0.6 * Math.min(columnWidth, columnDepth),
                0.240
              );
              const z = kickerHeight + i * lapLinkSpacing;
              
              const linkGeometry = new THREE.TubeGeometry(
                linkPath,
                64,
                linkDiameter / 2,
                8,
                true
              );

              return (
                <mesh
                  key={`lap-link-${i}`}
                  geometry={linkGeometry}
                  material={linkMaterial}
                  position={[0, 0, z]}
                />
              );
            })}
          </group>

          {/* Link at crank knuckle (if crank > 1 in 12) */}
          {hasCrank && (crankOffset / crankLength > 1 / 12) && (
            <mesh
              geometry={new THREE.TubeGeometry(linkPath, 64, linkDiameter / 2, 8, true)}
              material={linkMaterial}
              position={[crankOffset / 2, 0, kickerHeight + crankLength / 2]}
            />
          )}

          {/* Bars projecting above slab (for next lift) */}
          <group name="projection-bars">
            {barPositions.map(([x, y], i) => {
              const xOffset = hasCrank ? crankOffset : 0;
              const barGeometry = new THREE.CylinderGeometry(
                barDiameter / 2,
                barDiameter / 2,
                projectionAboveSlab,
                16
              );

              return (
                <mesh
                  key={`projection-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[x + xOffset, y, liftHeight + kickerHeight + projectionAboveSlab / 2]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Crank length: 10 x offset */}
          {/* Link at knuckle if crank > 1:12 */}
          {/* 50mm to start link run */}
        </group>
      )}
    </group>
  )
};