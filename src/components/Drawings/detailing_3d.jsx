import React from "react";
import * as THREE from "three";
import { useMemo, useRef, useLayoutEffect } from "react";

//////////// Draw Beam ////////////

export function DrawBeam({
  dimensions = {
    span: 5.0,
    width: 0.3,
    depth: 0.5,
    cover: 0.025,
  },
  reinforcement = {
    bottomCount: 4,
    bottomDia: 0.02,
    bottomFullFraction: 0.3,
    bottomCurtailedFraction: 0.15,
    topCount: 2,
    topDia: 0.016,
    topExtendFraction: 0.25,
    stirrupDia: 0.01,
    stirrupSpacing: 0.15,
    hangerCount: 2,
    hangerDia: 0.016,
    closerCount: 2,
    closerDia: 0.01,
    uBarCount: 2,
    uBarDia: 0.016,
    lapLength: 0.5,
    sideBarDia: 0.012,
    sideBarSpacing: 0.15,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#66cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { span, width, depth, cover } = dimensions;
  const {
    bottomCount,
    bottomDia,
    bottomFullFraction,
    bottomCurtailedFraction,
    topCount,
    topDia,
    topExtendFraction,
    stirrupDia,
    stirrupSpacing,
    hangerCount,
    hangerDia,
    closerCount,
    closerDia,
    uBarCount,
    uBarDia,
    lapLength,
    sideBarDia,
    sideBarSpacing,
  } = reinforcement;

  // Calculate counts for bottom bars
  const bottomFullCount = Math.round(bottomCount * bottomFullFraction);
  const bottomCurtailedCount = bottomCount - bottomFullCount;
  const bottomCurtailedLength = span - 2 * bottomCurtailedFraction * span;

  // Calculate top length
  const topLength = topExtendFraction * span;

  // Calculate number of stirrups
  const numStirrups = Math.floor(span / stirrupSpacing) + 1;

  // Stirrup radii and inner dimensions
  const stirrupR = stirrupDia / 2;
  const innerWidth = width - 2 * cover - stirrupDia;
  const innerDepth = depth - 2 * cover - stirrupDia;

  // Use open links if width >= 300mm
  const useOpenLinks = width >= 0.3;

  // Side bars if depth >= 1000mm
  const useSideBars = depth >= 1.0 && sideBarDia > 0;
  const sideBarCount = useSideBars
    ? Math.floor(innerDepth / sideBarSpacing) + 1
    : 0;

  // Geometries (memoized)
  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(width, depth, span),
    [width, depth, span]
  );

  const bottomFullGeo = React.useMemo(
    () => new THREE.CylinderGeometry(bottomDia / 2, bottomDia / 2, span, 8, 1),
    [bottomDia, span]
  );
  const bottomCurtailedGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        bottomDia / 2,
        bottomDia / 2,
        bottomCurtailedLength,
        8,
        1
      ),
    [bottomDia, bottomCurtailedLength]
  );

  const topGeo = React.useMemo(
    () => new THREE.CylinderGeometry(topDia / 2, topDia / 2, topLength, 8, 1),
    [topDia, topLength]
  );

  const hangerGeo = React.useMemo(
    () => new THREE.CylinderGeometry(hangerDia / 2, hangerDia / 2, span, 8, 1),
    [hangerDia, span]
  );

  const closerGeo = React.useMemo(
    () => new THREE.CylinderGeometry(closerDia / 2, closerDia / 2, span, 8, 1),
    [closerDia, span]
  );

  const sideBarGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(sideBarDia / 2, sideBarDia / 2, span, 8, 1),
    [sideBarDia, span]
  );

  const stirrupHorizontalGeo = React.useMemo(
    () => new THREE.CylinderGeometry(stirrupR, stirrupR, innerWidth, 8, 1),
    [stirrupR, innerWidth]
  );
  const stirrupVerticalGeo = React.useMemo(
    () => new THREE.CylinderGeometry(stirrupR, stirrupR, innerDepth, 8, 1),
    [stirrupR, innerDepth]
  );

  const uBottomGeo = React.useMemo(
    () => new THREE.CylinderGeometry(uBarDia / 2, uBarDia / 2, lapLength, 8, 1),
    [uBarDia, lapLength]
  );
  const uTopGeo = React.useMemo(
    () => new THREE.CylinderGeometry(uBarDia / 2, uBarDia / 2, lapLength, 8, 1),
    [uBarDia, lapLength]
  );
  const uVerticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(uBarDia / 2, uBarDia / 2, innerDepth, 8, 1),
    [uBarDia, innerDepth]
  );

  // Materials (memoized)
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const stirrupMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Refs for instanced meshes
  const bottomFullRef = React.useRef();
  const bottomCurtailedRef = React.useRef();
  const topLeftRef = React.useRef();
  const topRightRef = React.useRef();
  const hangerRef = React.useRef();
  const closerRef = React.useRef();
  const sideBarRef = React.useRef();
  const stirrupVertRef = React.useRef();
  const stirrupBottomRef = React.useRef();
  const stirrupTopRef = React.useRef();
  const uBottomRef = React.useRef();
  const uTopRef = React.useRef();
  const uVerticalRef = React.useRef();

  // Setup instances with useLayoutEffect
  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();

    // Bottom bars positions
    const bottomSpacing = (width - 2 * cover - bottomDia) / (bottomCount - 1);
    const bottomX = [];
    for (let i = 0; i < bottomCount; i++) {
      bottomX.push(-width / 2 + cover + bottomDia / 2 + i * bottomSpacing);
    }

    // Assign full and curtailed (outer full, inner curtailed)
    const fullPerSide = Math.floor(bottomFullCount / 2);
    const fullX = bottomX
      .slice(0, fullPerSide)
      .concat(bottomX.slice(-fullPerSide));
    const curtailedX = bottomX.slice(fullPerSide, bottomCount - fullPerSide);

    const yBottom = -depth / 2 + cover + bottomDia / 2;

    // Bottom full bars
    for (let i = 0; i < fullX.length; i++) {
      temp.position.set(fullX[i], yBottom, 0);
      temp.rotation.x = Math.PI / 2;
      temp.updateMatrix();
      bottomFullRef.current.setMatrixAt(i, temp.matrix);
    }
    bottomFullRef.current.instanceMatrix.needsUpdate = true;

    // Bottom curtailed bars
    for (let i = 0; i < curtailedX.length; i++) {
      temp.position.set(curtailedX[i], yBottom, 0);
      temp.rotation.x = Math.PI / 2;
      temp.updateMatrix();
      bottomCurtailedRef.current.setMatrixAt(i, temp.matrix);
    }
    bottomCurtailedRef.current.instanceMatrix.needsUpdate = true;

    // Top bars positions
    const topSpacing = (width - 2 * cover - topDia) / (topCount - 1);
    const topX = [];
    for (let i = 0; i < topCount; i++) {
      topX.push(-width / 2 + cover + topDia / 2 + i * topSpacing);
    }

    const yTop = depth / 2 - cover - topDia / 2;

    // Top left bars
    const leftZ = -span / 2 + topLength / 2;
    for (let i = 0; i < topCount; i++) {
      temp.position.set(topX[i], yTop, leftZ);
      temp.rotation.x = Math.PI / 2;
      temp.updateMatrix();
      topLeftRef.current.setMatrixAt(i, temp.matrix);
    }
    topLeftRef.current.instanceMatrix.needsUpdate = true;

    // Top right bars
    const rightZ = span / 2 - topLength / 2;
    for (let i = 0; i < topCount; i++) {
      temp.position.set(topX[i], yTop, rightZ);
      temp.rotation.x = Math.PI / 2;
      temp.updateMatrix();
      topRightRef.current.setMatrixAt(i, temp.matrix);
    }
    topRightRef.current.instanceMatrix.needsUpdate = true;

    // Hanger bars
    if (hangerCount > 0) {
      const hangerSpacing = (width - 2 * cover - hangerDia) / (hangerCount - 1);
      const hangerX = [];
      for (let i = 0; i < hangerCount; i++) {
        hangerX.push(-width / 2 + cover + hangerDia / 2 + i * hangerSpacing);
      }

      const yHanger = depth / 2 - cover - hangerDia / 2;

      for (let i = 0; i < hangerCount; i++) {
        temp.position.set(hangerX[i], yHanger, 0);
        temp.rotation.x = Math.PI / 2;
        temp.updateMatrix();
        hangerRef.current.setMatrixAt(i, temp.matrix);
      }
      hangerRef.current.instanceMatrix.needsUpdate = true;
    }

    // Closer bars if open links
    if (useOpenLinks && closerCount > 0) {
      const closerSpacing = (width - 2 * cover - closerDia) / (closerCount - 1);
      const closerX = [];
      for (let i = 0; i < closerCount; i++) {
        closerX.push(-width / 2 + cover + closerDia / 2 + i * closerSpacing);
      }

      const yCloser = depth / 2 - cover - closerDia / 2;

      for (let i = 0; i < closerCount; i++) {
        temp.position.set(closerX[i], yCloser, 0);
        temp.rotation.x = Math.PI / 2;
        temp.updateMatrix();
        closerRef.current.setMatrixAt(i, temp.matrix);
      }
      closerRef.current.instanceMatrix.needsUpdate = true;
    }

    // Side bars if applicable
    if (useSideBars && sideBarCount > 0) {
      const sideSpacing = (depth - 2 * cover - sideBarDia) / (sideBarCount - 1);
      const sideY = [];
      for (let i = 0; i < sideBarCount; i++) {
        sideY.push(-depth / 2 + cover + sideBarDia / 2 + i * sideSpacing);
      }

      const leftX = -width / 2 + cover + sideBarDia / 2;
      const rightX = width / 2 - cover - sideBarDia / 2;

      let index = 0;
      for (let j = 0; j < sideBarCount; j++) {
        // Left side
        temp.position.set(leftX, sideY[j], 0);
        temp.rotation.x = Math.PI / 2;
        temp.updateMatrix();
        sideBarRef.current.setMatrixAt(index, temp.matrix);
        index++;
        // Right side
        temp.position.set(rightX, sideY[j], 0);
        temp.updateMatrix();
        sideBarRef.current.setMatrixAt(index, temp.matrix);
        index++;
      }
      sideBarRef.current.instanceMatrix.needsUpdate = true;
    }

    // Stirrups
    const stirrupStep = span / (numStirrups - 1);
    const firstZ = -span / 2 + stirrupSpacing / 2; // Start slightly inside
    const xLeft = -width / 2 + cover + stirrupR;
    const xRight = width / 2 - cover - stirrupR;
    const yStirBottom = -depth / 2 + cover + stirrupR;
    const yStirTop = depth / 2 - cover - stirrupR;

    // Vertical legs
    let vertIndex = 0;
    for (let j = 0; j < numStirrups; j++) {
      const z = firstZ + j * stirrupStep;
      // Left
      temp.position.set(xLeft, 0, z);
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      stirrupVertRef.current.setMatrixAt(vertIndex, temp.matrix);
      vertIndex++;
      // Right
      temp.position.set(xRight, 0, z);
      temp.updateMatrix();
      stirrupVertRef.current.setMatrixAt(vertIndex, temp.matrix);
      vertIndex++;
    }
    stirrupVertRef.current.instanceMatrix.needsUpdate = true;

    // Bottom horizontals
    for (let j = 0; j < numStirrups; j++) {
      const z = firstZ + j * stirrupStep;
      temp.position.set(0, yStirBottom, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      stirrupBottomRef.current.setMatrixAt(j, temp.matrix);
    }
    stirrupBottomRef.current.instanceMatrix.needsUpdate = true;

    // Top horizontals if not open
    if (!useOpenLinks) {
      for (let j = 0; j < numStirrups; j++) {
        const z = firstZ + j * stirrupStep;
        temp.position.set(0, yStirTop, z);
        temp.rotation.z = Math.PI / 2;
        temp.updateMatrix();
        stirrupTopRef.current.setMatrixAt(j, temp.matrix);
      }
      stirrupTopRef.current.instanceMatrix.needsUpdate = true;
    }

    // U bars if present
    if (uBarCount > 0) {
      const uSpacing = (width - 2 * cover - uBarDia) / (uBarCount - 1);
      const uX = [];
      for (let i = 0; i < uBarCount; i++) {
        uX.push(-width / 2 + cover + uBarDia / 2 + i * uSpacing);
      }

      const leftUZ = -span / 2 + lapLength / 2;
      const rightUZ = span / 2 - lapLength / 2;
      const leftVerticalZ = -span / 2 + lapLength;
      const rightVerticalZ = span / 2 - lapLength;
      const yUBottom = -depth / 2 + cover + uBarDia / 2;
      const yUTop = depth / 2 - cover - uBarDia / 2;

      // U bottom horizontals
      for (let i = 0; i < uBarCount; i++) {
        // Left
        temp.position.set(uX[i], yUBottom, leftUZ);
        temp.rotation.x = Math.PI / 2;
        temp.updateMatrix();
        uBottomRef.current.setMatrixAt(i, temp.matrix);
        // Right
        temp.position.set(uX[i], yUBottom, rightUZ);
        temp.updateMatrix();
        uBottomRef.current.setMatrixAt(uBarCount + i, temp.matrix);
      }
      uBottomRef.current.instanceMatrix.needsUpdate = true;

      // U top horizontals
      for (let i = 0; i < uBarCount; i++) {
        // Left
        temp.position.set(uX[i], yUTop, leftUZ);
        temp.rotation.x = Math.PI / 2;
        temp.updateMatrix();
        uTopRef.current.setMatrixAt(i, temp.matrix);
        // Right
        temp.position.set(uX[i], yUTop, rightUZ);
        temp.updateMatrix();
        uTopRef.current.setMatrixAt(uBarCount + i, temp.matrix);
      }
      uTopRef.current.instanceMatrix.needsUpdate = true;

      // U verticals
      for (let i = 0; i < uBarCount; i++) {
        // Left
        temp.position.set(uX[i], 0, leftVerticalZ);
        temp.rotation.set(0, 0, 0);
        temp.updateMatrix();
        uVerticalRef.current.setMatrixAt(i, temp.matrix);
        // Right
        temp.position.set(uX[i], 0, rightVerticalZ);
        temp.updateMatrix();
        uVerticalRef.current.setMatrixAt(uBarCount + i, temp.matrix);
      }
      uVerticalRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [
    span,
    width,
    depth,
    cover,
    bottomCount,
    bottomDia,
    bottomFullFraction,
    bottomCurtailedFraction,
    topCount,
    topDia,
    topExtendFraction,
    stirrupDia,
    stirrupSpacing,
    numStirrups,
    hangerCount,
    hangerDia,
    closerCount,
    closerDia,
    uBarCount,
    uBarDia,
    lapLength,
    sideBarDia,
    sideBarSpacing,
    sideBarCount,
    useOpenLinks,
    useSideBars,
  ]);

  return (
    <group name="beam">
      {showConcrete && (
        <mesh geometry={concreteGeometry} material={concreteMaterial} />
      )}

      {showRebar && (
        <group name="reinforcement">
          {/* Bottom full */}
          <instancedMesh
            ref={bottomFullRef}
            args={[bottomFullGeo, mainRebarMaterial, bottomFullCount]}
          />

          {/* Bottom curtailed */}
          <instancedMesh
            ref={bottomCurtailedRef}
            args={[bottomCurtailedGeo, mainRebarMaterial, bottomCurtailedCount]}
          />

          {/* Top left */}
          <instancedMesh
            ref={topLeftRef}
            args={[topGeo, mainRebarMaterial, topCount]}
          />

          {/* Top right */}
          <instancedMesh
            ref={topRightRef}
            args={[topGeo, mainRebarMaterial, topCount]}
          />

          {/* Hanger */}
          {hangerCount > 0 && (
            <instancedMesh
              ref={hangerRef}
              args={[hangerGeo, distributionMaterial, hangerCount]}
            />
          )}

          {/* Closer */}
          {useOpenLinks && closerCount > 0 && (
            <instancedMesh
              ref={closerRef}
              args={[closerGeo, stirrupMaterial, closerCount]}
            />
          )}

          {/* Side bars */}
          {useSideBars && sideBarCount > 0 && (
            <instancedMesh
              ref={sideBarRef}
              args={[sideBarGeo, distributionMaterial, sideBarCount * 2]}
            />
          )}

          {/* Stirrup verticals */}
          <instancedMesh
            ref={stirrupVertRef}
            args={[stirrupVerticalGeo, stirrupMaterial, numStirrups * 2]}
          />

          {/* Stirrup bottoms */}
          <instancedMesh
            ref={stirrupBottomRef}
            args={[stirrupHorizontalGeo, stirrupMaterial, numStirrups]}
          />

          {/* Stirrup tops if not open */}
          {!useOpenLinks && (
            <instancedMesh
              ref={stirrupTopRef}
              args={[stirrupHorizontalGeo, stirrupMaterial, numStirrups]}
            />
          )}

          {/* U bottom */}
          {uBarCount > 0 && (
            <instancedMesh
              ref={uBottomRef}
              args={[uBottomGeo, mainRebarMaterial, uBarCount * 2]}
            />
          )}

          {/* U top */}
          {uBarCount > 0 && (
            <instancedMesh
              ref={uTopRef}
              args={[uTopGeo, mainRebarMaterial, uBarCount * 2]}
            />
          )}

          {/* U vertical */}
          {uBarCount > 0 && (
            <instancedMesh
              ref={uVerticalRef}
              args={[uVerticalGeo, mainRebarMaterial, uBarCount * 2]}
            />
          )}
        </group>
      )}
    </group>
  );
}

//////////// Draw Beam ////////////

/////////// Draw Flat Slab ////////////

export function DrawFlatSlab({
  dimensions = {
    slabThickness: 0.3, // Slab thickness (h)
    effectiveDepth: 0.25, // Effective depth (d)
    cover: 0.025, // Concrete cover
    columnSide: 0.4, // Square column side length
    visSide: 4.0, // Visualization square side length
  },
  reinforcement = {
    linkDia: 0.01, // Diameter of shear links
    firstDist: 0.125, // Distance from column face to first perimeter (default 0.5d)
    radialSpacing: 0.1875, // Spacing between perimeters (default 0.75d)
    numPerimeters: 3, // Number of shear reinforcement perimeters
    innerZone: 0.5, // Inner zone distance from column face (default 2d)
    innerPitch: 0.375, // Max tangential pitch in inner zone (default 1.5d)
    outerPitch: 0.5, // Max tangential pitch in outer zone (default 2d)
    fixingDia: 0.012, // Diameter of fixing bars
    anchorageLength: 0.5, // Tension anchorage length beyond last link
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#66cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { slabThickness, effectiveDepth, cover, columnSide, visSide } =
    dimensions;
  const {
    linkDia,
    firstDist,
    radialSpacing,
    numPerimeters,
    innerZone,
    innerPitch,
    outerPitch,
    fixingDia,
    anchorageLength,
  } = reinforcement;

  // Calculate inner height for link legs
  const innerHeight = slabThickness - 2 * cover;

  // Calculate max r
  const rMax = firstDist + (numPerimeters - 1) * radialSpacing;

  // Fixing bar length
  const fixingLength = rMax + anchorageLength;

  // Bottom and top y positions for fixing bars
  const yBottom = -slabThickness / 2 + cover + fixingDia / 2;
  const yTop = slabThickness / 2 - cover - fixingDia / 2;

  // Geometries
  const slabGeometry = React.useMemo(
    () => new THREE.BoxGeometry(visSide, slabThickness, visSide),
    [visSide, slabThickness]
  );

  const columnGeometry = React.useMemo(
    () => new THREE.BoxGeometry(columnSide, slabThickness, columnSide),
    [columnSide, slabThickness]
  );

  const legGeometry = React.useMemo(
    () =>
      new THREE.CylinderGeometry(linkDia / 2, linkDia / 2, innerHeight, 8, 1),
    [linkDia, innerHeight]
  );

  const fixingGeometry = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        fixingDia / 2,
        fixingDia / 2,
        fixingLength,
        8,
        1
      ),
    [fixingDia, fixingLength]
  );

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const stirrupMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Refs
  const legsRef = React.useRef();
  const fixingRef = React.useRef();

  // Calculate total legs
  let totalLegs = 0;
  for (let i = 0; i < numPerimeters; i++) {
    const r = firstDist + i * radialSpacing;
    const pitch = r < innerZone ? innerPitch : outerPitch;
    const halfSide = columnSide / 2 + r;
    const sideLength = 2 * halfSide;
    const perimeterLength = 4 * sideLength;
    const numLegsPerPerimeter = Math.round(perimeterLength / pitch);
    totalLegs += numLegsPerPerimeter;
  }

  // Setup instances
  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    let index = 0;

    // Place link legs
    for (let i = 0; i < numPerimeters; i++) {
      const r = firstDist + i * radialSpacing;
      const pitch = r < innerZone ? innerPitch : outerPitch;
      const halfSide = columnSide / 2 + r;
      const sideLength = 2 * halfSide;
      const perimeterLength = 4 * sideLength;
      const numLegsPerPerimeter = Math.round(perimeterLength / pitch);
      const actualSpacing = perimeterLength / numLegsPerPerimeter;

      for (let j = 0; j < numLegsPerPerimeter; j++) {
        const s = j * actualSpacing;
        let x, z;
        if (s < sideLength) {
          // Bottom side
          x = -halfSide + s;
          z = -halfSide;
        } else if (s < 2 * sideLength) {
          // Right side
          const s2 = s - sideLength;
          x = halfSide;
          z = -halfSide + s2;
        } else if (s < 3 * sideLength) {
          // Top side
          const s3 = s - 2 * sideLength;
          x = halfSide - s3;
          z = halfSide;
        } else {
          // Left side
          const s4 = s - 3 * sideLength;
          x = -halfSide;
          z = halfSide - s4;
        }
        temp.position.set(x, 0, z);
        temp.updateMatrix();
        legsRef.current.setMatrixAt(index, temp.matrix);
        index++;
      }
    }
    legsRef.current.instanceMatrix.needsUpdate = true;

    // Place fixing bars (4 at bottom, 4 at top, one per direction)
    const fixingPositions = [
      // Bottom
      {
        pos: [0, yBottom, columnSide / 2 + fixingLength / 2],
        rot: [Math.PI / 2, 0, 0],
      }, // +z
      {
        pos: [0, yBottom, -(columnSide / 2 + fixingLength / 2)],
        rot: [Math.PI / 2, 0, 0],
      }, // -z
      {
        pos: [columnSide / 2 + fixingLength / 2, yBottom, 0],
        rot: [0, 0, Math.PI / 2],
      }, // +x
      {
        pos: [-(columnSide / 2 + fixingLength / 2), yBottom, 0],
        rot: [0, 0, Math.PI / 2],
      }, // -x
      // Top
      {
        pos: [0, yTop, columnSide / 2 + fixingLength / 2],
        rot: [Math.PI / 2, 0, 0],
      }, // +z
      {
        pos: [0, yTop, -(columnSide / 2 + fixingLength / 2)],
        rot: [Math.PI / 2, 0, 0],
      }, // -z
      {
        pos: [columnSide / 2 + fixingLength / 2, yTop, 0],
        rot: [0, 0, Math.PI / 2],
      }, // +x
      {
        pos: [-(columnSide / 2 + fixingLength / 2), yTop, 0],
        rot: [0, 0, Math.PI / 2],
      }, // -x
    ];

    for (let k = 0; k < fixingPositions.length; k++) {
      const { pos, rot } = fixingPositions[k];
      temp.position.set(...pos);
      temp.rotation.set(...rot);
      temp.updateMatrix();
      fixingRef.current.setMatrixAt(k, temp.matrix);
    }
    fixingRef.current.instanceMatrix.needsUpdate = true;
  }, [
    slabThickness,
    cover,
    columnSide,
    visSide,
    linkDia,
    firstDist,
    radialSpacing,
    numPerimeters,
    innerZone,
    innerPitch,
    outerPitch,
    fixingDia,
    anchorageLength,
  ]);

  return (
    <group name="flatSlab">
      {showConcrete && (
        <>
          <mesh geometry={slabGeometry} material={concreteMaterial} />
          <mesh geometry={columnGeometry} material={concreteMaterial} />
        </>
      )}

      {showRebar && (
        <group name="reinforcement">
          {/* Shear link legs */}
          <instancedMesh
            ref={legsRef}
            args={[legGeometry, stirrupMaterial, totalLegs]}
          />

          {/* Fixing bars */}
          <instancedMesh
            ref={fixingRef}
            args={[fixingGeometry, distributionMaterial, 8]}
          />
        </group>
      )}
    </group>
  );
}

/////////// Draw Flat Slab ////////////

////////c/// Draw Column ////////////

export function DrawColumn({
  dimensions = {
    totalHeight: 3.5, // Total height including projection above slab (m)
    lowerWidth: 0.4, // Lower column width (m)
    upperWidth: 0.3, // Upper column width (m)
    depth: 0.3, // Column depth (assuming constant) (m)
    cover: 0.025, // Concrete cover (m)
    crankStartY: 0.5, // Height from bottom to start of crank (m)
    offset: 0.05, // Offset per side (m)
    projectionAbove: 0.5, // Projection above slab level (compression lap + kicker height) (m)
    kickerHeight: 0.075, // Kicker height at bottom (m)
  },
  reinforcement = {
    mainBarDiameter: 0.02, // Diameter of main longitudinal bars (m)
    linkDiameter: 0.01, // Diameter of links (m)
    linkSpacing: 0.3, // Normal link spacing (m)
    compressionLap: 0.5, // Compression lap length (m)
    minLinksAtSpecial: 3, // Minimum number of links at lap areas
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    totalHeight,
    lowerWidth,
    upperWidth,
    depth,
    cover,
    crankStartY,
    offset,
    projectionAbove,
    kickerHeight,
  } = dimensions;
  const {
    mainBarDiameter,
    linkDiameter,
    linkSpacing,
    compressionLap,
    minLinksAtSpecial,
  } = reinforcement;

  // Calculate crank parameters
  const crankLength = 10 * offset;
  const crankVertical = Math.sqrt(crankLength ** 2 - offset ** 2);

  const upperStartY = crankStartY + crankVertical;
  const slabLevel = totalHeight - projectionAbove;
  const lowerConcreteHeight = upperStartY;
  const upperConcreteHeight = slabLevel - upperStartY;

  // Validate heights
  if (upperConcreteHeight < 0 || slabLevel < upperStartY) {
    console.warn("Invalid height configuration for stepped column");
  }

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const rebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Concrete geometries
  const lowerConcreteGeometry = React.useMemo(
    () =>
      new THREE.BoxGeometry(
        lowerWidth,
        lowerConcreteHeight + kickerHeight,
        depth
      ),
    [lowerWidth, lowerConcreteHeight, kickerHeight, depth]
  );

  const upperConcreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(upperWidth, upperConcreteHeight, depth),
    [upperWidth, upperConcreteHeight, depth]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Bar positions (assuming 4 corner bars, symmetric)
  const xLowerPos = lowerWidth / 2 - cover - mainBarDiameter / 2;
  const xLowerNeg = -xLowerPos;
  const xUpperPos = upperWidth / 2 - cover - mainBarDiameter / 2;
  const xUpperNeg = -xUpperPos;
  const zPos = depth / 2 - cover - mainBarDiameter / 2;
  const zNeg = -zPos;

  // Delta x for crank (positive for negative x side, negative for positive x side)
  const deltaXNeg = xUpperNeg - xLowerNeg; // Positive offset towards center
  const deltaXPos = xUpperPos - xLowerPos; // Negative offset towards center

  // Generate main bars (4 corners)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const corners = [
      { xLower: xLowerNeg, xUpper: xUpperNeg, deltaX: deltaXNeg, z: zNeg },
      { xLower: xLowerNeg, xUpper: xUpperNeg, deltaX: deltaXNeg, z: zPos },
      { xLower: xLowerPos, xUpper: xUpperPos, deltaX: deltaXPos, z: zNeg },
      { xLower: xLowerPos, xUpper: xUpperPos, deltaX: deltaXPos, z: zPos },
    ];

    corners.forEach(({ xLower, xUpper, z }) => {
      // Lower straight
      const lowerP1 = new THREE.Vector3(xLower, kickerHeight, z);
      const lowerP2 = new THREE.Vector3(xLower, crankStartY + kickerHeight, z);
      bars.push(
        createCylinderBetweenPoints(
          lowerP1,
          lowerP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );

      // Crank slanted
      const crankP1 = new THREE.Vector3(xLower, crankStartY + kickerHeight, z);
      const crankP2 = new THREE.Vector3(xUpper, upperStartY + kickerHeight, z);
      bars.push(
        createCylinderBetweenPoints(
          crankP1,
          crankP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );

      // Upper straight
      const upperP1 = new THREE.Vector3(xUpper, upperStartY + kickerHeight, z);
      const upperP2 = new THREE.Vector3(xUpper, totalHeight, z);
      bars.push(
        createCylinderBetweenPoints(
          upperP1,
          upperP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );
    });

    return bars.filter(Boolean);
  }, [
    kickerHeight,
    crankStartY,
    upperStartY,
    totalHeight,
    xLowerNeg,
    xLowerPos,
    xUpperNeg,
    xUpperPos,
    zNeg,
    zPos,
    mainBarDiameter,
    rebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Function to get bar x at y for left and right
  const getXAtY = React.useCallback(
    (y, isNegSide) => {
      const adjustedY = y - kickerHeight;
      if (adjustedY < crankStartY) {
        return isNegSide ? xLowerNeg : xLowerPos;
      } else if (adjustedY > upperStartY) {
        return isNegSide ? xUpperNeg : xUpperPos;
      } else {
        const t = (adjustedY - crankStartY) / crankVertical;
        const xLower = isNegSide ? xLowerNeg : xLowerPos;
        const xUpper = isNegSide ? xUpperNeg : xUpperPos;
        return xLower + t * (xUpper - xLower);
      }
    },
    [
      kickerHeight,
      crankStartY,
      upperStartY,
      crankVertical,
      xLowerNeg,
      xLowerPos,
      xUpperNeg,
      xUpperPos,
    ]
  );

  // Generate link Y positions
  const linkYs = React.useMemo(() => {
    const ys = new Set();

    // Normal spacing starting from 0.05 above kicker
    for (let y = kickerHeight + 0.05; y < slabLevel; y += linkSpacing) {
      ys.add(y);
    }

    // Lap area closer spacing
    const lesserDim = Math.min(upperWidth, depth);
    const lapSpacingMax = Math.min(12 * mainBarDiameter, 0.6 * lesserDim, 0.24);
    const lapStart = slabLevel - compressionLap;
    const lapSpacing = Math.min(
      lapSpacingMax,
      compressionLap / (minLinksAtSpecial - 1)
    ); // Ensure at least min links
    for (
      let y = Math.max(lapStart, kickerHeight + 0.05);
      y < slabLevel;
      y += lapSpacing
    ) {
      ys.add(y);
    }

    // Special link at knuckle of crank
    ys.add(crankStartY + crankVertical / 2 + kickerHeight);

    // At least 3 links in lap area
    if (compressionLap > 0) {
      ys.add(lapStart + lapSpacing / 2);
      ys.add(lapStart + compressionLap / 2);
      ys.add(slabLevel - lapSpacing / 2);
    }

    return Array.from(ys).sort((a, b) => a - b);
  }, [
    kickerHeight,
    slabLevel,
    linkSpacing,
    compressionLap,
    mainBarDiameter,
    upperWidth,
    depth,
    minLinksAtSpecial,
    crankStartY,
    crankVertical,
  ]);

  // Generate links
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;

    linkYs.forEach((y) => {
      const xLeft = getXAtY(y, true);
      const xRight = getXAtY(y, false);
      const linkOffset = linkDiameter / 2;
      const linkLeftX = xLeft - linkOffset;
      const linkRightX = xRight + linkOffset;
      const linkFrontZ = zNeg - linkOffset;
      const linkBackZ = zPos + linkOffset;

      // Horizontal along Z at left and right
      const horizLength = linkBackZ - linkFrontZ;
      const horizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        horizLength,
        8,
        1
      );

      // Left horizontal
      const leftHoriz = new THREE.Mesh(horizGeom, linkMaterial);
      leftHoriz.position.set(linkLeftX, y, (linkFrontZ + linkBackZ) / 2);
      leftHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(leftHoriz);

      // Right horizontal
      const rightHoriz = new THREE.Mesh(horizGeom, linkMaterial);
      rightHoriz.position.set(linkRightX, y, (linkFrontZ + linkBackZ) / 2);
      rightHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(rightHoriz);

      // Horizontal along X at front and back
      const vertLength = linkRightX - linkLeftX;
      const vertGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        vertLength,
        8,
        1
      );

      // Front horizontal
      const frontVert = new THREE.Mesh(vertGeom, linkMaterial);
      frontVert.position.set((linkLeftX + linkRightX) / 2, y, linkFrontZ);
      frontVert.rotation.z = Math.PI / 2;
      linkComponents.push(frontVert);

      // Back horizontal
      const backVert = new THREE.Mesh(vertGeom, linkMaterial);
      backVert.position.set((linkLeftX + linkRightX) / 2, y, linkBackZ);
      backVert.rotation.z = Math.PI / 2;
      linkComponents.push(backVert);
    });

    return linkComponents;
  }, [linkYs, getXAtY, linkDiameter, zNeg, zPos, linkMaterial]);

  return (
    <group name="column" position={[0, 0, 0]}>
      {/* Concrete */}
      {showConcrete && (
        <>
          {/* Lower concrete including kicker */}
          <mesh
            geometry={lowerConcreteGeometry}
            material={concreteMaterial}
            position={[0, (lowerConcreteHeight + kickerHeight) / 2, 0]}
          />
          {/* Upper concrete */}
          <mesh
            geometry={upperConcreteGeometry}
            material={concreteMaterial}
            position={[
              0,
              upperStartY + kickerHeight + upperConcreteHeight / 2,
              0,
            ]}
          />
        </>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`bar-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}

////////c/// Draw Column ////////////

//////Draaw wall //////////////

export function DrawWall({
  dimensions = {
    length: 5.0, // Length along x (m)
    thickness: 0.2, // Thickness along z (m)
    height: 3.0, // Height from kicker top to structural floor level (m)
    cover: 0.025, // Concrete cover (m)
    kickerHeight: 0.075, // Kicker height (m)
    compressionLap: 0.5, // Compression lap length (m)
    foundationTolerance: 0.15, // Foundation level tolerance (m)
    lBarHorizontalLength: 0.45, // Length of horizontal leg for L bars (m)
    uBarLegLength: 0.45, // Length of legs for U bars (m)
    uBarBendWidth: 0.05, // Width of bend for U bars (small horizontal) (m)
  },
  reinforcement = {
    verticalBarDiameter: 0.012, // Diameter of vertical bars (m)
    verticalBarPitch: 0.2, // Pitch of vertical bars (m)
    horizontalBarDiameter: 0.01, // Diameter of horizontal bars (m)
    horizontalBarPitch: 0.2, // Pitch of horizontal bars (m)
    // Table for reference (wall thickness ranges and bar details from image):
    // Thickness | Vert Dia | Vert Pitch | Horiz Dia | Horiz Pitch
    // 150-175   | 12       | 300        | 10        | 200
    // 175-200   | 12       | 250        | 10        | 200
    // 200-250   | 12       | 200        | 10        | 200
    // 250-300   | 16       | 300        | 12        | 200
    // 300-400   | 16       | 250        | 12        | 200
    // 400-500   | 16       | 200        | 12        | 150
    // 500-600   | 20       | 250        | 16        | 200
    // 600-700   | 20       | 200        | 16        | 200
    // 700-800   | 20       | 200        | 16        | 200
    // All dimensions in mm; convert to m in code if needed
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    thickness,
    height,
    cover,
    kickerHeight,
    compressionLap,
    foundationTolerance,
    lBarHorizontalLength,
    uBarLegLength,
    uBarBendWidth,
  } = dimensions;
  const {
    verticalBarDiameter,
    verticalBarPitch,
    horizontalBarDiameter,
    horizontalBarPitch,
  } = reinforcement;

  const projectionAbove = compressionLap + kickerHeight;
  const bottomExtension = compressionLap + foundationTolerance;
  const totalConcreteHeight = kickerHeight + height;
  const totalBarHeight = totalConcreteHeight + projectionAbove;
  const lapStartAtBottom = bottomExtension - compressionLap;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Concrete geometry
  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, totalConcreteHeight, thickness),
    [length, totalConcreteHeight, thickness]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Face signs
  const faces = [1, -1];

  // Generate vertical bar positions for one face (x positions)
  const halfLength = length / 2;
  const startX = -halfLength + cover + verticalBarDiameter / 2;
  const endX = halfLength - cover - verticalBarDiameter / 2;
  const verticalXPositions = React.useMemo(() => {
    const positions = [];
    for (let x = startX; x <= endX + 0.0001; x += verticalBarPitch) {
      positions.push(x);
    }
    return positions;
  }, [startX, endX, verticalBarPitch]);

  // Z positions for vertical and horizontal
  const zH = (sign) =>
    sign * (thickness / 2 - cover - horizontalBarDiameter / 2);
  const zV = (sign) =>
    sign *
    (thickness / 2 - cover - horizontalBarDiameter - verticalBarDiameter / 2);

  // Starter bars: L shaped on each face at each x position
  const starterBars = React.useMemo(() => {
    const bars = [];
    verticalXPositions.forEach((x) => {
      faces.forEach((sign) => {
        const z = zV(sign);
        // Horizontal leg (L bend)
        const hP1 = new THREE.Vector3(x - lBarHorizontalLength, 0, z);
        const hP2 = new THREE.Vector3(x, 0, z);
        bars.push(
          createCylinderBetweenPoints(
            hP1,
            hP2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );

        // Vertical leg
        const vP1 = new THREE.Vector3(x, 0, z);
        const vP2 = new THREE.Vector3(x, bottomExtension, z);
        bars.push(
          createCylinderBetweenPoints(
            vP1,
            vP2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      });
    });
    return bars.filter(Boolean);
  }, [
    verticalXPositions,
    faces,
    lBarHorizontalLength,
    bottomExtension,
    verticalBarDiameter,
    mainRebarMaterial,
    createCylinderBetweenPoints,
    thickness,
    cover,
    horizontalBarDiameter,
  ]);

  // Main vertical bars
  const mainVerticalBars = React.useMemo(() => {
    const bars = [];
    verticalXPositions.forEach((x) => {
      faces.forEach((sign) => {
        const z = zV(sign);
        const p1 = new THREE.Vector3(x, lapStartAtBottom, z);
        const p2 = new THREE.Vector3(x, totalBarHeight, z);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      });
    });
    return bars.filter(Boolean);
  }, [
    verticalXPositions,
    faces,
    lapStartAtBottom,
    totalBarHeight,
    verticalBarDiameter,
    mainRebarMaterial,
    createCylinderBetweenPoints,
    thickness,
    cover,
    horizontalBarDiameter,
  ]);

  // U bars at top
  const uBars = React.useMemo(() => {
    const bars = [];
    verticalXPositions.forEach((x) => {
      faces.forEach((sign) => {
        const z = zV(sign);
        // Left leg
        const leftP1 = new THREE.Vector3(
          x - uBarBendWidth / 2,
          totalConcreteHeight,
          z
        );
        const leftP2 = new THREE.Vector3(
          x - uBarBendWidth / 2,
          totalConcreteHeight - uBarLegLength,
          z
        );
        bars.push(
          createCylinderBetweenPoints(
            leftP1,
            leftP2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );

        // Right leg
        const rightP1 = new THREE.Vector3(
          x + uBarBendWidth / 2,
          totalConcreteHeight,
          z
        );
        const rightP2 = new THREE.Vector3(
          x + uBarBendWidth / 2,
          totalConcreteHeight - uBarLegLength,
          z
        );
        bars.push(
          createCylinderBetweenPoints(
            rightP1,
            rightP2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );

        // Horizontal bend at top
        const horizP1 = new THREE.Vector3(
          x - uBarBendWidth / 2,
          totalConcreteHeight,
          z
        );
        const horizP2 = new THREE.Vector3(
          x + uBarBendWidth / 2,
          totalConcreteHeight,
          z
        );
        bars.push(
          createCylinderBetweenPoints(
            horizP1,
            horizP2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      });
    });
    return bars.filter(Boolean);
  }, [
    verticalXPositions,
    faces,
    totalConcreteHeight,
    uBarBendWidth,
    uBarLegLength,
    verticalBarDiameter,
    mainRebarMaterial,
    createCylinderBetweenPoints,
    thickness,
    cover,
    horizontalBarDiameter,
  ]);

  // Horizontal bars positions (y positions)
  const startY = kickerHeight + cover + horizontalBarDiameter / 2;
  const endY = totalConcreteHeight - cover - horizontalBarDiameter / 2;
  const horizontalYPositions = React.useMemo(() => {
    const positions = [];
    for (let y = startY; y <= endY + 0.0001; y += horizontalBarPitch) {
      positions.push(y);
    }
    return positions;
  }, [startY, endY, horizontalBarPitch]);

  // Horizontal bars length
  const horizBarLength = length - 2 * cover;

  // Horizontal bars
  const horizontalBars = React.useMemo(() => {
    const bars = [];
    horizontalYPositions.forEach((y) => {
      faces.forEach((sign) => {
        const z = zH(sign);
        const p1 = new THREE.Vector3(-horizBarLength / 2, y, z);
        const p2 = new THREE.Vector3(horizBarLength / 2, y, z);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );
      });
    });
    return bars.filter(Boolean);
  }, [
    horizontalYPositions,
    faces,
    horizBarLength,
    horizontalBarDiameter,
    distributionMaterial,
    createCylinderBetweenPoints,
    thickness,
    cover,
  ]);

  return (
    <group name="wall">
      {/* Concrete */}
      {showConcrete && (
        <mesh
          geometry={concreteGeometry}
          material={concreteMaterial}
          position={[0, totalConcreteHeight / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {starterBars.map((bar, index) => (
            <primitive key={`starter-${index}`} object={bar} />
          ))}
          {mainVerticalBars.map((bar, index) => (
            <primitive key={`main-vertical-${index}`} object={bar} />
          ))}
          {uBars.map((bar, index) => (
            <primitive key={`u-${index}`} object={bar} />
          ))}
          {horizontalBars.map((bar, index) => (
            <primitive key={`horizontal-${index}`} object={bar} />
          ))}
        </group>
      )}
    </group>
  );
}

//////Draaw wall //////////////

//////// stepped column ////////////

export function DrawSteppedColumn({
  dimensions = {
    totalHeight: 3.0, // Total height from kicker to nominal floor level (m)
    lowerWidth: 0.4, // Lower column width (m)
    upperWidth: 0.3, // Upper column width (m)
    depth: 0.3, // Column depth (assuming constant) (m)
    cover: 0.025, // Concrete cover (m)
    offset: 0.075, // Offset at step (m)
    kickerHeight: 0.075, // Kicker height at bottom (m)
    compressionLap: 0.5, // Compression lap length (m)
    projectionAbove: 0.075, // Projection above nominal floor level (m)
    lapPlus75: 0.575, // Compression lap + 75mm unless specified
  },
  reinforcement = {
    mainBarDiameter: 0.02, // Diameter of main longitudinal bars (m)
    linkDiameter: 0.01, // Diameter of links (m)
    linkSpacing: 0.3, // Normal link spacing (m)
    minLinksAtLap: 3, // Minimum number of links at lap areas
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    totalHeight,
    lowerWidth,
    upperWidth,
    depth,
    cover,
    offset,
    kickerHeight,
    compressionLap,
    projectionAbove,
    lapPlus75,
  } = dimensions;
  const { mainBarDiameter, linkDiameter, linkSpacing, minLinksAtLap } =
    reinforcement;

  // Calculate step parameters
  const stepHeight = 0.75; // Assuming step occurs at 75cm from bottom based on image
  const lowerHeight = stepHeight + kickerHeight;
  const upperHeight = totalHeight - lowerHeight + projectionAbove;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const rebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Concrete geometries
  const lowerConcreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(lowerWidth, lowerHeight, depth),
    [lowerWidth, lowerHeight, depth]
  );

  const upperConcreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(upperWidth, upperHeight, depth),
    [upperWidth, upperHeight, depth]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Bar positions (assuming 4 corner bars, symmetric)
  const xLowerPos = lowerWidth / 2 - cover - mainBarDiameter / 2;
  const xLowerNeg = -xLowerPos;
  const xUpperPos = upperWidth / 2 - cover - mainBarDiameter / 2 - offset; // Adjusted for offset
  const xUpperNeg = -xUpperPos;
  const zPos = depth / 2 - cover - mainBarDiameter / 2;
  const zNeg = -zPos;

  // Generate main bars (4 corners)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const corners = [
      { xLower: xLowerNeg, xUpper: xUpperNeg, z: zNeg },
      { xLower: xLowerNeg, xUpper: xUpperNeg, z: zPos },
      { xLower: xLowerPos, xUpper: xUpperPos, z: zNeg },
      { xLower: xLowerPos, xUpper: xUpperPos, z: zPos },
    ];

    corners.forEach(({ xLower, xUpper, z }) => {
      // Lower straight
      const lowerP1 = new THREE.Vector3(xLower, kickerHeight, z);
      const lowerP2 = new THREE.Vector3(xLower, stepHeight + kickerHeight, z);
      bars.push(
        createCylinderBetweenPoints(
          lowerP1,
          lowerP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );

      // Upper straight
      const upperP1 = new THREE.Vector3(xUpper, stepHeight + kickerHeight, z);
      const upperP2 = new THREE.Vector3(
        xUpper,
        totalHeight + projectionAbove,
        z
      );
      bars.push(
        createCylinderBetweenPoints(
          upperP1,
          upperP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );
    });

    return bars.filter(Boolean);
  }, [
    kickerHeight,
    stepHeight,
    totalHeight,
    projectionAbove,
    xLowerNeg,
    xLowerPos,
    xUpperNeg,
    xUpperPos,
    zNeg,
    zPos,
    mainBarDiameter,
    rebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Function to get bar x at y for left and right
  const getXAtY = React.useCallback(
    (y, isNegSide) => {
      const adjustedY = y - kickerHeight;
      if (adjustedY < stepHeight) {
        return isNegSide ? xLowerNeg : xLowerPos;
      } else {
        return isNegSide ? xUpperNeg : xUpperPos;
      }
    },
    [kickerHeight, stepHeight, xLowerNeg, xLowerPos, xUpperNeg, xUpperPos]
  );

  // Generate link Y positions
  const linkYs = React.useMemo(() => {
    const ys = new Set();

    // Normal spacing starting from 0.05 above kicker
    for (
      let y = kickerHeight + 0.05;
      y < totalHeight + projectionAbove;
      y += linkSpacing
    ) {
      ys.add(y);
    }

    // Lap area closer spacing
    const lesserDim = Math.min(upperWidth, depth);
    const lapSpacingMax = Math.min(12 * mainBarDiameter, 0.6 * lesserDim, 0.24);
    const lapStart = totalHeight - compressionLap;
    const lapSpacing = Math.min(
      lapSpacingMax,
      compressionLap / (minLinksAtLap - 1)
    ); // Ensure at least min links
    for (
      let y = Math.max(lapStart, kickerHeight + 0.05);
      y < totalHeight + projectionAbove;
      y += lapSpacing
    ) {
      ys.add(y);
    }

    return Array.from(ys).sort((a, b) => a - b);
  }, [
    kickerHeight,
    totalHeight,
    projectionAbove,
    linkSpacing,
    compressionLap,
    mainBarDiameter,
    upperWidth,
    depth,
    minLinksAtLap,
  ]);

  // Generate links
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;

    linkYs.forEach((y) => {
      const xLeft = getXAtY(y, true);
      const xRight = getXAtY(y, false);
      const linkOffset = linkDiameter / 2;
      const linkLeftX = xLeft - linkOffset;
      const linkRightX = xRight + linkOffset;
      const linkFrontZ = zNeg - linkOffset;
      const linkBackZ = zPos + linkOffset;

      // Horizontal along Z at left and right
      const horizLength = linkBackZ - linkFrontZ;
      const horizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        horizLength,
        8,
        1
      );

      // Left horizontal
      const leftHoriz = new THREE.Mesh(horizGeom, linkMaterial);
      leftHoriz.position.set(linkLeftX, y, (linkFrontZ + linkBackZ) / 2);
      leftHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(leftHoriz);

      // Right horizontal
      const rightHoriz = new THREE.Mesh(horizGeom, linkMaterial);
      rightHoriz.position.set(linkRightX, y, (linkFrontZ + linkBackZ) / 2);
      rightHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(rightHoriz);

      // Horizontal along X at front and back
      const vertLength = linkRightX - linkLeftX;
      const vertGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        vertLength,
        8,
        1
      );

      // Front horizontal
      const frontVert = new THREE.Mesh(vertGeom, linkMaterial);
      frontVert.position.set((linkLeftX + linkRightX) / 2, y, linkFrontZ);
      frontVert.rotation.z = Math.PI / 2;
      linkComponents.push(frontVert);

      // Back horizontal
      const backVert = new THREE.Mesh(vertGeom, linkMaterial);
      backVert.position.set((linkLeftX + linkRightX) / 2, y, linkBackZ);
      backVert.rotation.z = Math.PI / 2;
      linkComponents.push(backVert);
    });

    return linkComponents;
  }, [linkYs, getXAtY, linkDiameter, zNeg, zPos, linkMaterial]);

  return (
    <group name="steppedColumn" position={[0, 0, 0]}>
      {/* Concrete */}
      {showConcrete && (
        <>
          {/* Lower concrete including kicker */}
          <mesh
            geometry={lowerConcreteGeometry}
            material={concreteMaterial}
            position={[0, lowerHeight / 2, 0]}
          />
          {/* Upper concrete */}
          <mesh
            geometry={upperConcreteGeometry}
            material={concreteMaterial}
            position={[offset, lowerHeight + upperHeight / 2, 0]}
          />
        </>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`bar-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}
//////// stepped column ////////////

/////////// wall corner ////////////
export function DrawWallCorner({
  dimensions = {
    armLength: 5.0,
    thickness: 0.3,
    height: 3.0,
    cover: 0.025,
    tensionLap: 0.5,
    uLoopLength: 0.3,
    uLoopWidth: 0.1,
    uReturnLength: 0.2,
    diagonalLength: 0.3,
  },
  reinforcement = {
    verticalBarDiameter: 0.012,
    verticalBarPitch: 0.2,
    horizontalBarDiameter: 0.01,
    horizontalBarPitch: 0.2,
    detailType: "A", // 'A' or 'B'
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    armLength,
    thickness,
    height,
    cover,
    tensionLap,
    uLoopLength,
    uLoopWidth,
    uReturnLength,
    diagonalLength,
  } = dimensions;
  const {
    verticalBarDiameter,
    verticalBarPitch,
    horizontalBarDiameter,
    horizontalBarPitch,
    detailType,
  } = reinforcement;

  const numAdditionalBars = thickness <= 0.3 ? 2 : 4;
  const cornerBarSpacing =
    (thickness - 2 * cover - verticalBarDiameter) /
    (numAdditionalBars - 1 || 1);

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Concrete arms
  const armGeometry = React.useMemo(
    () => new THREE.BoxGeometry(armLength, height, thickness),
    [armLength, height, thickness]
  );

  // Cylinder function
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);
      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Vertical bars
  const verticalBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1]; // sign for inner and outer

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - verticalBarDiameter / 2);

      // x-arm vertical bars
      for (
        let x = cover + verticalBarDiameter / 2;
        x <= armLength - cover - verticalBarDiameter / 2 + 0.0001;
        x += verticalBarPitch
      ) {
        const p1 = new THREE.Vector3(x, -height / 2, layerZ);
        const p2 = new THREE.Vector3(x, height / 2, layerZ);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      }

      // z-arm vertical bars
      for (
        let z = cover + verticalBarDiameter / 2;
        z <= armLength - cover - verticalBarDiameter / 2 + 0.0001;
        z += verticalBarPitch
      ) {
        const p1 = new THREE.Vector3(layerZ, -height / 2, z);
        const p2 = new THREE.Vector3(layerZ, height / 2, z);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      }
    });

    return bars.filter(Boolean);
  }, [
    armLength,
    thickness,
    height,
    cover,
    verticalBarDiameter,
    verticalBarPitch,
    mainRebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Horizontal bars with lap
  const horizontalYs = React.useMemo(() => {
    const ys = [];
    for (
      let y = -height / 2 + cover + horizontalBarDiameter / 2;
      y <= height / 2 - cover - horizontalBarDiameter / 2 + 0.0001;
      y += horizontalBarPitch
    ) {
      ys.push(y);
    }
    return ys;
  }, [height, cover, horizontalBarDiameter, horizontalBarPitch]);

  const horizontalBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1];

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - horizontalBarDiameter / 2);

      horizontalYs.forEach((y) => {
        // x-arm horizontal
        const p1 = new THREE.Vector3(0 - armLength, y, layerZ);
        const p2 = new THREE.Vector3(tensionLap, y, layerZ);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );

        // z-arm horizontal
        const p3 = new THREE.Vector3(layerZ, y, 0 - armLength);
        const p4 = new THREE.Vector3(layerZ, y, tensionLap);
        bars.push(
          createCylinderBetweenPoints(
            p3,
            p4,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    armLength,
    thickness,
    cover,
    horizontalBarDiameter,
    tensionLap,
    horizontalYs,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  // Additional corner vertical bars
  const additionalVerticalBars = React.useMemo(() => {
    const bars = [];
    for (let i = 0; (i = numAdditionalBars); i++) {
      const z = cover + verticalBarDiameter / 2 + i * cornerBarSpacing;
      const p1 = new THREE.Vector3(-uLoopLength / 2, -height / 2, z);
      const p2 = new THREE.Vector3(-uLoopLength / 2, height / 2, z);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          verticalBarDiameter / 2,
          mainRebarMaterial
        )
      );

      // For the other arm
      const p3 = new THREE.Vector3(z, -height / 2, -uLoopLength / 2);
      const p4 = new THREE.Vector3(z, height / 2, -uLoopLength / 2);
      bars.push(
        createCylinderBetweenPoints(
          p3,
          p4,
          verticalBarDiameter / 2,
          mainRebarMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    numAdditionalBars,
    cover,
    verticalBarDiameter,
    cornerBarSpacing,
    height,
    uLoopLength,
    mainRebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // U loop bars
  const uLoopBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1];

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - horizontalBarDiameter / 2);

      horizontalYs.forEach((y) => {
        // Long leg
        const p1 = new THREE.Vector3(0 - tensionLap, y, layerZ);
        const p2 = new THREE.Vector3(-uLoopLength, y, layerZ);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );

        // Cross
        const p3 = new THREE.Vector3(-uLoopLength, y, layerZ - uLoopWidth);
        bars.push(
          createCylinderBetweenPoints(
            p2,
            p3,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );

        // Return
        const p4 = new THREE.Vector3(
          -uLoopLength - uReturnLength,
          y,
          layerZ - uLoopWidth
        );
        bars.push(
          createCylinderBetweenPoints(
            p3,
            p4,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    thickness,
    cover,
    horizontalBarDiameter,
    tensionLap,
    uLoopLength,
    uLoopWidth,
    uReturnLength,
    horizontalYs,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  // Diagonal for type 'B'
  const diagonalBars = React.useMemo(() => {
    const bars = [];
    if (detailType !== "B") return bars;

    const faces = [1, -1];

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - horizontalBarDiameter / 2);

      horizontalYs.forEach((y) => {
        const p1 = new THREE.Vector3(-uLoopLength, y, layerZ - uLoopWidth);
        const p2 = new THREE.Vector3(
          -uLoopLength / 2,
          y,
          layerZ - uLoopWidth / 2
        );
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    detailType,
    thickness,
    cover,
    horizontalBarDiameter,
    uLoopLength,
    uLoopWidth,
    horizontalYs,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  return (
    <group name="wallCorner" position={[-armLength / 2, 0, -armLength / 2]}>
      {showConcrete && (
        <group>
          <mesh
            geometry={armGeometry}
            material={concreteMaterial}
            position={[armLength / 2, 0, thickness / 2]}
          />
          <mesh
            geometry={armGeometry}
            material={concreteMaterial}
            position={[thickness / 2, 0, armLength / 2]}
            rotation={[0, Math.PI / 2, 0]}
          />
        </group>
      )}

      {showRebar && (
        <group name="reinforcement">
          {verticalBars.map((bar, index) => (
            <primitive key={`vertical-${index}`} object={bar} />
          ))}
          {horizontalBars.map((bar, index) => (
            <primitive key={`horizontal-${index}`} object={bar} />
          ))}
          {additionalVerticalBars.map((bar, index) => (
            <primitive key={`additional-${index}`} object={bar} />
          ))}
          {uLoopBars.map((bar, index) => (
            <primitive key={`uloop-${index}`} object={bar} />
          ))}
          {diagonalBars.map((bar, index) => (
            <primitive key={`diagonal-${index}`} object={bar} />
          ))}
        </group>
      )}
    </group>
  );
}

/////////// wall corner ////////////
////////// retaining wall ////////////

export function DrawRetainingWall({
  dimensions = {
    length: 5.0, // Length along x (m)
    thickness: 0.3, // Thickness along z (m)
    height: 3.0, // Total height including kicker (m)
    kickerHeight: 0.15, // Kicker height (m)
    cover: 0.025, // Concrete cover (m)
    tensionLap: 0.4, // Tension lap length (m)
    projectionAbove: 0.05, // Projection above ground level (m)
    granularFillDepth: 0.5, // Depth of granular fill (m)
    largeBendRadius: 0.1, // Large radius of bend if specified (m)
  },
  reinforcement = {
    verticalBarDiameter: 0.012, // Diameter of vertical bars (m)
    verticalBarPitchExposed: 0.04, // Pitch for externally exposed faces (m)
    verticalBarPitchBuried: 0.05, // Pitch for buried faces (m)
    horizontalBarDiameter: 0.01, // Diameter of horizontal bars (m)
    horizontalBarPitch: 0.075, // Pitch of horizontal bars (m)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    thickness,
    height,
    kickerHeight,
    cover,
    tensionLap,
    projectionAbove,
    granularFillDepth,
    largeBendRadius,
  } = dimensions;
  const {
    verticalBarDiameter,
    verticalBarPitchExposed,
    verticalBarPitchBuried,
    horizontalBarDiameter,
    horizontalBarPitch,
  } = reinforcement;

  const totalHeight = height + projectionAbove;
  const groundLevel = kickerHeight;
  const exposedHeight = totalHeight - groundLevel - granularFillDepth;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Concrete geometry
  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, totalHeight, thickness),
    [length, totalHeight, thickness]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Vertical bar positions for exposed face
  const verticalXPositionsExposed = React.useMemo(() => {
    const positions = [];
    const startX = cover + verticalBarDiameter / 2;
    const endX = length - cover - verticalBarDiameter / 2;
    for (let x = startX; x <= endX + 0.0001; x += verticalBarPitchExposed) {
      positions.push(x);
    }
    return positions;
  }, [cover, verticalBarDiameter, length, verticalBarPitchExposed]);

  // Vertical bar positions for buried face
  const verticalXPositionsBuried = React.useMemo(() => {
    const positions = [];
    const startX = cover + verticalBarDiameter / 2;
    const endX = length - cover - verticalBarDiameter / 2;
    for (let x = startX; x <= endX + 0.0001; x += verticalBarPitchBuried) {
      positions.push(x);
    }
    return positions;
  }, [cover, verticalBarDiameter, length, verticalBarPitchBuried]);

  // Vertical bars
  const verticalBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1]; // Inner and outer faces

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - verticalBarDiameter / 2);
      const positions =
        sign === 1 ? verticalXPositionsExposed : verticalXPositionsBuried;
      const barHeight = sign === 1 ? exposedHeight : granularFillDepth;

      positions.forEach((x) => {
        const p1 = new THREE.Vector3(
          x,
          groundLevel + (sign === 1 ? 0 : granularFillDepth),
          layerZ
        );
        const p2 = new THREE.Vector3(
          x,
          groundLevel +
            (sign === 1 ? exposedHeight : granularFillDepth) +
            tensionLap,
          layerZ
        );
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    groundLevel,
    exposedHeight,
    granularFillDepth,
    tensionLap,
    verticalBarDiameter,
    mainRebarMaterial,
    createCylinderBetweenPoints,
    verticalXPositionsExposed,
    verticalXPositionsBuried,
    thickness,
    cover,
  ]);

  // Horizontal bar positions
  const horizontalYs = React.useMemo(() => {
    const ys = [];
    for (
      let y = groundLevel + cover + horizontalBarDiameter / 2;
      y <= totalHeight - cover - horizontalBarDiameter / 2 + 0.0001;
      y += horizontalBarPitch
    ) {
      ys.push(y);
    }
    return ys;
  }, [
    groundLevel,
    totalHeight,
    cover,
    horizontalBarDiameter,
    horizontalBarPitch,
  ]);

  // Horizontal bars
  const horizontalBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1];

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - horizontalBarDiameter / 2);

      horizontalYs.forEach((y) => {
        const p1 = new THREE.Vector3(
          cover + horizontalBarDiameter / 2,
          y,
          layerZ
        );
        const p2 = new THREE.Vector3(
          length - cover - horizontalBarDiameter / 2,
          y,
          layerZ
        );
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    length,
    thickness,
    cover,
    horizontalBarDiameter,
    horizontalYs,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  return (
    <group name="retainingWall" position={[0, -groundLevel / 2, 0]}>
      {/* Concrete */}
      {showConcrete && (
        <mesh
          geometry={concreteGeometry}
          material={concreteMaterial}
          position={[0, totalHeight / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {verticalBars.map((bar, index) => (
            <primitive key={`vertical-${index}`} object={bar} />
          ))}
          {horizontalBars.map((bar, index) => (
            <primitive key={`horizontal-${index}`} object={bar} />
          ))}
        </group>
      )}
    </group>
  );
}

////////// retaining wall ////////////
////////// basement retaining wall ////////////

export function DrawBasementRetainingWall({
  dimensions = {
    length: 5.0, // Length along x (m)
    thickness: 0.3, // Thickness along z (m)
    totalHeight: 3.0, // Total height including kicker (m)
    kickerHeight: 0.15, // Kicker height (m)
    cover: 0.025, // Concrete cover (m)
    tensionLap: 0.075, // Tension lap length (m)
    projectionAbove: 0.05, // Projection above ground level (m)
    groundBeamWidth: 0.3, // Width of ground beam (m)
    groundBeamDepth: 0.75, // Depth of ground beam (m)
    minimumOverlap: 0.3, // Minimum overlap (m)
  },
  reinforcement = {
    verticalBarDiameter: 0.012, // Diameter of vertical bars (m)
    verticalBarPitchInternal: 0.025, // Pitch for internal faces (m)
    verticalBarPitchExternal: 0.04, // Pitch for external exposed faces (m)
    horizontalBarDiameter: 0.01, // Diameter of horizontal bars (m)
    horizontalBarPitch: 0.075, // Pitch of horizontal bars (m)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    thickness,
    totalHeight,
    kickerHeight,
    cover,
    tensionLap,
    projectionAbove,
    groundBeamWidth,
    groundBeamDepth,
    minimumOverlap,
  } = dimensions;
  const {
    verticalBarDiameter,
    verticalBarPitchInternal,
    verticalBarPitchExternal,
    horizontalBarDiameter,
    horizontalBarPitch,
  } = reinforcement;

  const groundLevel = kickerHeight;
  const wallHeightAboveKicker = totalHeight - kickerHeight + projectionAbove;
  const groundBeamBottom = -groundBeamDepth;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Concrete geometries
  const wallGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, wallHeightAboveKicker, thickness),
    [length, wallHeightAboveKicker, thickness]
  );

  const groundBeamGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, groundBeamDepth, groundBeamWidth),
    [length, groundBeamDepth, groundBeamWidth]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Vertical bar positions for internal and external faces
  const verticalXPositionsInternal = React.useMemo(() => {
    const positions = [];
    const startX = cover + verticalBarDiameter / 2;
    const endX = length - cover - verticalBarDiameter / 2;
    for (let x = startX; x <= endX + 0.0001; x += verticalBarPitchInternal) {
      positions.push(x);
    }
    return positions;
  }, [cover, verticalBarDiameter, length, verticalBarPitchInternal]);

  const verticalXPositionsExternal = React.useMemo(() => {
    const positions = [];
    const startX = cover + verticalBarDiameter / 2;
    const endX = length - cover - verticalBarDiameter / 2;
    for (let x = startX; x <= endX + 0.0001; x += verticalBarPitchExternal) {
      positions.push(x);
    }
    return positions;
  }, [cover, verticalBarDiameter, length, verticalBarPitchExternal]);

  // Vertical bars
  const verticalBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1]; // Inner (internal) and outer (external) faces

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - verticalBarDiameter / 2);
      const positions =
        sign === -1 ? verticalXPositionsInternal : verticalXPositionsExternal;
      const pitch =
        sign === -1 ? verticalBarPitchInternal : verticalBarPitchExternal;

      positions.forEach((x) => {
        const p1 = new THREE.Vector3(x, groundLevel, layerZ);
        const p2 = new THREE.Vector3(x, totalHeight + tensionLap, layerZ);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            verticalBarDiameter / 2,
            mainRebarMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    groundLevel,
    totalHeight,
    tensionLap,
    verticalBarDiameter,
    mainRebarMaterial,
    createCylinderBetweenPoints,
    verticalXPositionsInternal,
    verticalXPositionsExternal,
    thickness,
    cover,
  ]);

  // Horizontal bar positions
  const horizontalYs = React.useMemo(() => {
    const ys = [];
    for (
      let y = groundLevel + cover + horizontalBarDiameter / 2;
      y <= totalHeight - cover - horizontalBarDiameter / 2 + 0.0001;
      y += horizontalBarPitch
    ) {
      ys.push(y);
    }
    return ys;
  }, [
    groundLevel,
    totalHeight,
    cover,
    horizontalBarDiameter,
    horizontalBarPitch,
  ]);

  // Horizontal bars
  const horizontalBars = React.useMemo(() => {
    const bars = [];
    const faces = [1, -1];

    faces.forEach((sign) => {
      const layerZ = sign * (thickness / 2 - cover - horizontalBarDiameter / 2);

      horizontalYs.forEach((y) => {
        const p1 = new THREE.Vector3(
          cover + horizontalBarDiameter / 2,
          y,
          layerZ
        );
        const p2 = new THREE.Vector3(
          length - cover - horizontalBarDiameter / 2,
          y,
          layerZ
        );
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            horizontalBarDiameter / 2,
            distributionMaterial
          )
        );
      });
    });

    return bars.filter(Boolean);
  }, [
    length,
    thickness,
    cover,
    horizontalBarDiameter,
    horizontalYs,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  return (
    <group name="basementRetainingWall" position={[0, -groundBeamDepth / 2, 0]}>
      {/* Ground Beam */}
      {showConcrete && (
        <mesh
          geometry={groundBeamGeometry}
          material={concreteMaterial}
          position={[0, groundBeamBottom + groundBeamDepth / 2, 0]}
        />
      )}

      {/* Wall */}
      {showConcrete && (
        <mesh
          geometry={wallGeometry}
          material={concreteMaterial}
          position={[0, groundLevel + wallHeightAboveKicker / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {verticalBars.map((bar, index) => (
            <primitive key={`vertical-${index}`} object={bar} />
          ))}
          {horizontalBars.map((bar, index) => (
            <primitive key={`horizontal-${index}`} object={bar} />
          ))}
        </group>
      )}
    </group>
  );
}
////////// basement retaining wall ////////////
//////////// column starter ////////////

export function DrawColumnStarter({
  dimensions = {
    footingSide: 2.0, // Square footing side length (m)
    footingDepth: 0.5, // Footing depth (m)
    columnSide: 0.4, // Square column side (m)
    kickerHeight: 0.075, // Kicker height (m)
    compressionLap: 0.5, // Compression lap length (m)
    tolerance: 0.15, // Foundation level tolerance (m)
    anchorageLength: 0.45, // Minimum anchorage length (m)
    cover: 0.075, // Concrete cover (m)
  },
  reinforcement = {
    mainBarDiameter: 0.02, // Diameter of main bars (m)
    linkDiameter: 0.01, // Diameter of links (m)
    linkSpacing: 0.3, // Link spacing (m)
    minLinks: 3, // Minimum number of links
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    footingSide,
    footingDepth,
    columnSide,
    kickerHeight,
    compressionLap,
    tolerance,
    anchorageLength,
    cover,
  } = dimensions;
  const { mainBarDiameter, linkDiameter, linkSpacing, minLinks } =
    reinforcement;

  const starterHeight = compressionLap + tolerance;
  const bottomY = -footingDepth + cover + mainBarDiameter / 2;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const rebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Concrete geometries
  const footingGeometry = React.useMemo(
    () => new THREE.BoxGeometry(footingSide, footingDepth, footingSide),
    [footingSide, footingDepth]
  );

  const kickerGeometry = React.useMemo(
    () => new THREE.BoxGeometry(columnSide, kickerHeight, columnSide),
    [columnSide, kickerHeight]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Main bar positions (assuming 4 corners for square column)
  const halfColumn = columnSide / 2 - cover - mainBarDiameter / 2;
  const corners = [
    { x: -halfColumn, z: -halfColumn, bendDirX: -1, bendDirZ: 0 },
    { x: -halfColumn, z: halfColumn, bendDirX: -1, bendDirZ: 0 },
    { x: halfColumn, z: -halfColumn, bendDirX: 1, bendDirZ: 0 },
    { x: halfColumn, z: halfColumn, bendDirX: 1, bendDirZ: 0 },
  ];

  const mainBars = React.useMemo(() => {
    const bars = [];
    corners.forEach(({ x, z, bendDirX }) => {
      // Horizontal anchorage (bent along x direction)
      const horizP1 = new THREE.Vector3(x, bottomY, z);
      const horizP2 = new THREE.Vector3(
        x + bendDirX * anchorageLength,
        bottomY,
        z
      );
      bars.push(
        createCylinderBetweenPoints(
          horizP1,
          horizP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );

      // Vertical part
      const vertP1 = new THREE.Vector3(x, bottomY, z);
      const vertP2 = new THREE.Vector3(x, kickerHeight + starterHeight, z);
      bars.push(
        createCylinderBetweenPoints(
          vertP1,
          vertP2,
          mainBarDiameter / 2,
          rebarMaterial
        )
      );
    });
    return bars.filter(Boolean);
  }, [
    anchorageLength,
    bottomY,
    kickerHeight,
    starterHeight,
    mainBarDiameter,
    rebarMaterial,
    createCylinderBetweenPoints,
    halfColumn,
  ]);

  // Link Y positions (above footing level)
  const linkYs = React.useMemo(() => {
    const ys = [];
    const numLinks = Math.max(
      minLinks,
      Math.ceil(starterHeight / linkSpacing) + 1
    );
    const actualSpacing = starterHeight / (numLinks - 1);
    for (let i = 0; i < numLinks; i++) {
      ys.push(0.05 + i * actualSpacing); // Start slightly above footing
    }
    return ys;
  }, [starterHeight, linkSpacing, minLinks]);

  // Generate links
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;
    const linkLeftX = -halfColumn - radius;
    const linkRightX = halfColumn + radius;
    const linkFrontZ = -halfColumn - radius;
    const linkBackZ = halfColumn + radius;

    linkYs.forEach((y) => {
      // Horizontals along z (left and right)
      const horizLength = linkBackZ - linkFrontZ;
      const horizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        horizLength,
        8,
        1
      );

      const leftHoriz = new THREE.Mesh(horizGeom, linkMaterial);
      leftHoriz.position.set(linkLeftX, y, (linkFrontZ + linkBackZ) / 2);
      leftHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(leftHoriz);

      const rightHoriz = new THREE.Mesh(horizGeom, linkMaterial);
      rightHoriz.position.set(linkRightX, y, (linkFrontZ + linkBackZ) / 2);
      rightHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(rightHoriz);

      // Verticals along x (front and back)
      const vertLength = linkRightX - linkLeftX;
      const vertGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        vertLength,
        8,
        1
      );

      const frontVert = new THREE.Mesh(vertGeom, linkMaterial);
      frontVert.position.set((linkLeftX + linkRightX) / 2, y, linkFrontZ);
      frontVert.rotation.z = Math.PI / 2;
      linkComponents.push(frontVert);

      const backVert = new THREE.Mesh(vertGeom, linkMaterial);
      backVert.position.set((linkLeftX + linkRightX) / 2, y, linkBackZ);
      backVert.rotation.z = Math.PI / 2;
      linkComponents.push(backVert);
    });

    return linkComponents;
  }, [linkYs, halfColumn, linkDiameter, linkMaterial]);

  return (
    <group name="columnStarter">
      {/* Concrete */}
      {showConcrete && (
        <>
          {/* Footing */}
          <mesh
            geometry={footingGeometry}
            material={concreteMaterial}
            position={[0, -footingDepth / 2, 0]}
          />
          {/* Kicker */}
          <mesh
            geometry={kickerGeometry}
            material={concreteMaterial}
            position={[0, kickerHeight / 2, 0]}
          />
        </>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`bar-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}
//////////// column starter ////////////

//////////// pile cap ////////////import React from 'react';

export function DrawPileCap({
  dimensions = {
    length: 2.5, // Length along x (m)
    width: 2.5, // Width along z (m)
    depth: 0.8, // Depth of pile cap (m)
    cover: 0.05, // Concrete cover (m)
    pileDiameter: 0.4, // Diameter of each pile (m)
    tensionLap: 0.5, // Tension lap length (m)
    projectionAbove: 0.1, // Projection above ground level (m)
  },
  reinforcement = {
    mainBarDiameter: 0.02, // Diameter of main bars (m)
    linkDiameter: 0.012, // Diameter of links (m)
    linkSpacing: 0.2, // Link spacing (m)
    minLinks: 4, // Minimum number of links
    pileCount: 4, // Number of piles (e.g., 2x2 grid)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    width,
    depth,
    cover,
    pileDiameter,
    tensionLap,
    projectionAbove,
  } = dimensions;
  const { mainBarDiameter, linkDiameter, linkSpacing, minLinks, pileCount } =
    reinforcement;

  const totalDepth = depth + projectionAbove;
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const pileRadius = pileDiameter / 2;
  const bottomY = -depth + cover + mainBarDiameter / 2;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const rebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Concrete geometry
  const pileCapGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, totalDepth, width),
    [length, totalDepth, width]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Pile positions (2x2 grid centered)
  const pilePositions = React.useMemo(() => {
    const positions = [];
    const pileSpacingX = (length - 2 * pileRadius) / 1; // Adjusted for 2 piles in x
    const pileSpacingZ = (width - 2 * pileRadius) / 1; // Adjusted for 2 piles in z
    const offsetX = -pileSpacingX / 2;
    const offsetZ = -pileSpacingZ / 2;

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = offsetX + i * pileSpacingX;
        const z = offsetZ + j * pileSpacingZ;
        positions.push({ x, z });
      }
    }
    return positions;
  }, [length, width, pileRadius]);

  // Main bars (top and bottom mats, assuming 2 layers)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const layers = [bottomY, bottomY + (depth - 2 * cover) / 2]; // Bottom and middle layers

    layers.forEach((y) => {
      // Along x direction
      for (
        let z = -halfWidth + cover + mainBarDiameter / 2;
        z <= halfWidth - cover - mainBarDiameter / 2 + 0.0001;
        z += 0.2
      ) {
        const p1 = new THREE.Vector3(-halfLength, y, z);
        const p2 = new THREE.Vector3(halfLength + tensionLap, y, z);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            mainBarDiameter / 2,
            rebarMaterial
          )
        );
      }

      // Along z direction
      for (
        let x = -halfLength + cover + mainBarDiameter / 2;
        x <= halfLength - cover - mainBarDiameter / 2 + 0.0001;
        x += 0.2
      ) {
        const p1 = new THREE.Vector3(x, y, -halfWidth);
        const p2 = new THREE.Vector3(x, y, halfWidth + tensionLap);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            mainBarDiameter / 2,
            rebarMaterial
          )
        );
      }
    });

    return bars.filter(Boolean);
  }, [
    halfLength,
    halfWidth,
    bottomY,
    depth,
    cover,
    mainBarDiameter,
    tensionLap,
    rebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Link Y positions
  const linkYs = React.useMemo(() => {
    const ys = [];
    const numLinks = Math.max(minLinks, Math.ceil(depth / linkSpacing) + 1);
    const actualSpacing = depth / (numLinks - 1);
    for (let i = 0; i < numLinks; i++) {
      ys.push(-depth + cover + i * actualSpacing);
    }
    return ys;
  }, [depth, linkSpacing, minLinks, cover]);

  // Generate links (assuming a perimeter link around pile cap)
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;
    const linkInnerX = -halfLength + cover + radius;
    const linkInnerZ = -halfWidth + cover + radius;
    const linkOuterX = halfLength - cover - radius;
    const linkOuterZ = halfWidth - cover - radius;

    linkYs.forEach((y) => {
      // Top and bottom horizontals along z
      const topHorizLength = linkOuterZ - linkInnerZ;
      const topHorizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        topHorizLength,
        8,
        1
      );
      const topLeftHoriz = new THREE.Mesh(topHorizGeom, linkMaterial);
      topLeftHoriz.position.set(linkInnerX, y, (linkInnerZ + linkOuterZ) / 2);
      topLeftHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(topLeftHoriz);

      const topRightHoriz = new THREE.Mesh(topHorizGeom, linkMaterial);
      topRightHoriz.position.set(linkOuterX, y, (linkInnerZ + linkOuterZ) / 2);
      topRightHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(topRightHoriz);

      // Side horizontals along x
      const sideHorizLength = linkOuterX - linkInnerX;
      const sideHorizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        sideHorizLength,
        8,
        1
      );
      const leftSideHoriz = new THREE.Mesh(sideHorizGeom, linkMaterial);
      leftSideHoriz.position.set((linkInnerX + linkOuterX) / 2, y, linkInnerZ);
      leftSideHoriz.rotation.z = Math.PI / 2;
      linkComponents.push(leftSideHoriz);

      const rightSideHoriz = new THREE.Mesh(sideHorizGeom, linkMaterial);
      rightSideHoriz.position.set((linkInnerX + linkOuterX) / 2, y, linkOuterZ);
      rightSideHoriz.rotation.z = Math.PI / 2;
      linkComponents.push(rightSideHoriz);
    });

    return linkComponents;
  }, [linkYs, halfLength, halfWidth, cover, linkDiameter, linkMaterial]);

  return (
    <group name="pileCap" position={[0, -depth / 2, 0]}>
      {/* Concrete */}
      {showConcrete && (
        <mesh
          geometry={pileCapGeometry}
          material={concreteMaterial}
          position={[0, totalDepth / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`main-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}

//////////// pile cap ////////////import React from 'react';

////////// combined footing ////////////

export function DrawCombinedFooting({
  dimensions = {
    length: 4.0, // Total length along x (m)
    width: 2.0, // Total width along z (m)
    depth: 0.6, // Depth of footing (m)
    cover: 0.05, // Concrete cover (m)
    column1OffsetX: 1.0, // Offset of first column from left edge (m)
    column2OffsetX: 3.0, // Offset of second column from left edge (m)
    columnSide: 0.4, // Square column side length (m)
    tensionLap: 0.5, // Tension lap length (m)
    projectionAbove: 0.1, // Projection above ground level (m)
  },
  reinforcement = {
    mainBarDiameter: 0.02, // Diameter of main bars (m)
    linkDiameter: 0.012, // Diameter of links (m)
    linkSpacing: 0.2, // Link spacing (m)
    minLinks: 3, // Minimum number of links
    barSpacing: 0.2, // Spacing between main bars (m)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    width,
    depth,
    cover,
    column1OffsetX,
    column2OffsetX,
    columnSide,
    tensionLap,
    projectionAbove,
  } = dimensions;
  const { mainBarDiameter, linkDiameter, linkSpacing, minLinks, barSpacing } =
    reinforcement;

  const totalDepth = depth + projectionAbove;
  const halfWidth = width / 2;
  const bottomY = -depth + cover + mainBarDiameter / 2;
  const halfColumn = columnSide / 2;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const rebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Concrete geometry
  const footingGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, totalDepth, width),
    [length, totalDepth, width]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Main bars (top and bottom mats along x direction)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const layers = [bottomY, bottomY + (depth - 2 * cover) / 2]; // Bottom and middle layers

    layers.forEach((y) => {
      for (
        let z = -halfWidth + cover + mainBarDiameter / 2;
        z <= halfWidth - cover - mainBarDiameter / 2 + 0.0001;
        z += barSpacing
      ) {
        const p1 = new THREE.Vector3(-length / 2, y, z);
        const p2 = new THREE.Vector3(length / 2 + tensionLap, y, z);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            mainBarDiameter / 2,
            rebarMaterial
          )
        );
      }
    });

    return bars.filter(Boolean);
  }, [
    length,
    halfWidth,
    bottomY,
    depth,
    cover,
    mainBarDiameter,
    tensionLap,
    barSpacing,
    rebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Distribution bars (along z direction)
  const distributionBars = React.useMemo(() => {
    const bars = [];
    const layers = [bottomY, bottomY + (depth - 2 * cover) / 2];

    layers.forEach((y) => {
      for (
        let x = -length / 2 + cover + mainBarDiameter / 2;
        x <= length / 2 - cover - mainBarDiameter / 2 + 0.0001;
        x += barSpacing
      ) {
        const p1 = new THREE.Vector3(x, y, -halfWidth);
        const p2 = new THREE.Vector3(x, y, halfWidth + tensionLap);
        bars.push(
          createCylinderBetweenPoints(
            p1,
            p2,
            mainBarDiameter / 2,
            rebarMaterial
          )
        );
      }
    });

    return bars.filter(Boolean);
  }, [
    length,
    halfWidth,
    bottomY,
    depth,
    cover,
    mainBarDiameter,
    tensionLap,
    barSpacing,
    rebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Link Y positions
  const linkYs = React.useMemo(() => {
    const ys = [];
    const numLinks = Math.max(minLinks, Math.ceil(depth / linkSpacing) + 1);
    const actualSpacing = depth / (numLinks - 1);
    for (let i = 0; i < numLinks; i++) {
      ys.push(-depth + cover + i * actualSpacing);
    }
    return ys;
  }, [depth, linkSpacing, minLinks, cover]);

  // Generate links (perimeter links around footing)
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;
    const linkInnerX = -length / 2 + cover + radius;
    const linkInnerZ = -halfWidth + cover + radius;
    const linkOuterX = length / 2 - cover - radius;
    const linkOuterZ = halfWidth - cover - radius;

    linkYs.forEach((y) => {
      // Top and bottom horizontals along z
      const topHorizLength = linkOuterZ - linkInnerZ;
      const topHorizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        topHorizLength,
        8,
        1
      );
      const topLeftHoriz = new THREE.Mesh(topHorizGeom, linkMaterial);
      topLeftHoriz.position.set(linkInnerX, y, (linkInnerZ + linkOuterZ) / 2);
      topLeftHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(topLeftHoriz);

      const topRightHoriz = new THREE.Mesh(topHorizGeom, linkMaterial);
      topRightHoriz.position.set(linkOuterX, y, (linkInnerZ + linkOuterZ) / 2);
      topRightHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(topRightHoriz);

      // Side horizontals along x
      const sideHorizLength = linkOuterX - linkInnerX;
      const sideHorizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        sideHorizLength,
        8,
        1
      );
      const leftSideHoriz = new THREE.Mesh(sideHorizGeom, linkMaterial);
      leftSideHoriz.position.set((linkInnerX + linkOuterX) / 2, y, linkInnerZ);
      leftSideHoriz.rotation.z = Math.PI / 2;
      linkComponents.push(leftSideHoriz);

      const rightSideHoriz = new THREE.Mesh(sideHorizGeom, linkMaterial);
      rightSideHoriz.position.set((linkInnerX + linkOuterX) / 2, y, linkOuterZ);
      rightSideHoriz.rotation.z = Math.PI / 2;
      linkComponents.push(rightSideHoriz);
    });

    return linkComponents;
  }, [linkYs, length, halfWidth, cover, linkDiameter, linkMaterial]);

  return (
    <group name="combinedFooting" position={[0, -depth / 2, 0]}>
      {/* Concrete */}
      {showConcrete && (
        <mesh
          geometry={footingGeometry}
          material={concreteMaterial}
          position={[0, totalDepth / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`main-${index}`} object={bar} />
          ))}
          {distributionBars.map((bar, index) => (
            <primitive key={`dist-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}
////////// combined footing ////////////

//////////// simply supported RC stairs ////////////
export function DrawSimplySupportedRCStairs({
  dimensions = {
    totalRise: 2.0, // Total height rise (m)
    totalRun: 4.0, // Total horizontal run (m)
    treadDepth: 0.3, // Depth of each tread (m)
    riserHeight: 0.15, // Height of each riser (m)
    slabThickness: 0.15, // Thickness of stair slab (m)
    landingLength: 1.0, // Length of landing (m)
    cover: 0.025, // Concrete cover (m)
    tensionLap: 0.4, // Tension lap length (m)
  },
  reinforcement = {
    mainBarDiameter: 0.012, // Diameter of main bars (m)
    distributionBarDiameter: 0.01, // Diameter of distribution bars (m)
    barSpacing: 0.2, // Spacing between bars (m)
    linkDiameter: 0.008, // Diameter of links (m)
    linkSpacing: 0.15, // Link spacing (m)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    totalRise,
    totalRun,
    treadDepth,
    riserHeight,
    slabThickness,
    landingLength,
    cover,
    tensionLap,
  } = dimensions;
  const {
    mainBarDiameter,
    distributionBarDiameter,
    barSpacing,
    linkDiameter,
    linkSpacing,
  } = reinforcement;

  const numSteps = Math.floor(totalRise / riserHeight);
  const actualRiserHeight = totalRise / numSteps;
  const actualTreadDepth = totalRun / numSteps - slabThickness; // Adjusted for slab thickness overlap
  const landingOffset = totalRun - landingLength;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Concrete geometry (simplified as a sloped slab with landing)
  const stairGeometry = React.useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(totalRun, totalRise);
    shape.lineTo(totalRun - landingLength, totalRise);
    shape.lineTo(landingOffset, 0);
    shape.lineTo(0, 0);

    const extrudeSettings = { depth: slabThickness, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [totalRun, totalRise, landingLength, landingOffset, slabThickness]);

  // Main bars (along slope direction)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const startY = cover + mainBarDiameter / 2;
    const endY = totalRise - cover - mainBarDiameter / 2;
    const slope = totalRise / totalRun;

    for (
      let z = cover + mainBarDiameter / 2;
      z <= totalRun - cover - mainBarDiameter / 2 + 0.0001;
      z += barSpacing
    ) {
      const x = 0;
      const y = slope * z;
      const p1 = new THREE.Vector3(x, y, z);
      const p2 = new THREE.Vector3(totalRun + tensionLap, totalRise, z);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          mainBarDiameter / 2,
          mainRebarMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    totalRun,
    totalRise,
    cover,
    mainBarDiameter,
    tensionLap,
    barSpacing,
    mainRebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Distribution bars (perpendicular to slope)
  const distributionBars = React.useMemo(() => {
    const bars = [];
    const startX = cover + distributionBarDiameter / 2;
    const endX = totalRun - cover - distributionBarDiameter / 2;

    for (
      let y = cover + distributionBarDiameter / 2;
      y <= totalRise - cover - distributionBarDiameter / 2 + 0.0001;
      y += barSpacing
    ) {
      const x = 0;
      const z = y / slope;
      const p1 = new THREE.Vector3(x, y, z);
      const p2 = new THREE.Vector3(endX, y, z + endX / slope);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          distributionBarDiameter / 2,
          distributionMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    totalRun,
    totalRise,
    cover,
    distributionBarDiameter,
    barSpacing,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  // Link Y positions (along height)
  const linkYs = React.useMemo(() => {
    const ys = [];
    const numLinks = Math.ceil(totalRise / linkSpacing) + 1;
    const actualSpacing = totalRise / (numLinks - 1);
    for (let i = 0; i < numLinks; i++) {
      ys.push(i * actualSpacing);
    }
    return ys;
  }, [totalRise, linkSpacing]);

  // Generate links (simplified as vertical supports)
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;

    linkYs.forEach((y) => {
      const z = y / slope;
      const p1 = new THREE.Vector3(0, y, z);
      const p2 = new THREE.Vector3(0, y, z + linkSpacing);
      const link = createCylinderBetweenPoints(p1, p2, radius, linkMaterial);
      if (link) linkComponents.push(link);
    });

    return linkComponents;
  }, [
    linkYs,
    slope,
    linkSpacing,
    linkDiameter,
    linkMaterial,
    createCylinderBetweenPoints,
  ]);

  return (
    <group
      name="simplySupportedRCStairs"
      rotation={[0, 0, -Math.atan(totalRise / totalRun)]}
    >
      {/* Concrete */}
      {showConcrete && (
        <mesh
          geometry={stairGeometry}
          material={concreteMaterial}
          position={[0, -slabThickness / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`main-${index}`} object={bar} />
          ))}
          {distributionBars.map((bar, index) => (
            <primitive key={`dist-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}
//////////// simply supported RC stairs ////////////

//////////// cantilever stair ////////////
export function DrawCantileverStair({
  dimensions = {
    totalRise: 2.0, // Total height rise (m)
    totalRun: 3.0, // Total horizontal run (m)
    treadDepth: 0.25, // Depth of each tread (m)
    riserHeight: 0.15, // Height of each riser (m)
    slabThickness: 0.2, // Thickness of stair slab (m)
    supportWidth: 0.5, // Width of support wall (m)
    cover: 0.025, // Concrete cover (m)
    tensionLap: 0.4, // Tension lap length (m)
  },
  reinforcement = {
    mainBarDiameter: 0.016, // Diameter of main bars (m)
    distributionBarDiameter: 0.01, // Diameter of distribution bars (m)
    barSpacing: 0.2, // Spacing between bars (m)
    linkDiameter: 0.01, // Diameter of links (m)
    linkSpacing: 0.15, // Link spacing (m)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    totalRise,
    totalRun,
    treadDepth,
    riserHeight,
    slabThickness,
    supportWidth,
    cover,
    tensionLap,
  } = dimensions;
  const {
    mainBarDiameter,
    distributionBarDiameter,
    barSpacing,
    linkDiameter,
    linkSpacing,
  } = reinforcement;

  const numSteps = Math.floor(totalRise / riserHeight);
  const actualRiserHeight = totalRise / numSteps;
  const actualTreadDepth = totalRun / numSteps;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Concrete geometry (simplified as a sloped slab cantilevered from support)
  const stairGeometry = React.useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(totalRun, totalRise);
    shape.lineTo(totalRun, totalRise - slabThickness);
    shape.lineTo(0, -slabThickness);
    shape.lineTo(0, 0);

    const extrudeSettings = { depth: supportWidth, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [totalRun, totalRise, slabThickness, supportWidth]);

  // Support wall geometry
  const supportGeometry = React.useMemo(
    () => new THREE.BoxGeometry(supportWidth, totalRise + slabThickness, 0.1),
    [supportWidth, totalRise, slabThickness]
  );

  // Main bars (along slope direction, anchored into support)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const startY = cover + mainBarDiameter / 2;
    const endY = totalRise - cover - mainBarDiameter / 2;
    const slope = totalRise / totalRun;

    for (
      let z = cover + mainBarDiameter / 2;
      z <= totalRun - cover - mainBarDiameter / 2 + 0.0001;
      z += barSpacing
    ) {
      const x = 0;
      const y = slope * z;
      const p1 = new THREE.Vector3(-tensionLap, y, z); // Anchored into support
      const p2 = new THREE.Vector3(totalRun, y, z);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          mainBarDiameter / 2,
          mainRebarMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    totalRun,
    totalRise,
    cover,
    mainBarDiameter,
    tensionLap,
    barSpacing,
    mainRebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Distribution bars (perpendicular to slope)
  const distributionBars = React.useMemo(() => {
    const bars = [];
    const startX = -tensionLap;
    const endX = totalRun - cover - distributionBarDiameter / 2;

    for (
      let y = cover + distributionBarDiameter / 2;
      y <= totalRise - cover - distributionBarDiameter / 2 + 0.0001;
      y += barSpacing
    ) {
      const z = y / slope;
      const p1 = new THREE.Vector3(startX, y, z);
      const p2 = new THREE.Vector3(endX, y, z + endX / slope);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          distributionBarDiameter / 2,
          distributionMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    totalRun,
    totalRise,
    cover,
    distributionBarDiameter,
    tensionLap,
    barSpacing,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  // Link Y positions (along height within slab)
  const linkYs = React.useMemo(() => {
    const ys = [];
    const numLinks = Math.ceil(totalRise / linkSpacing) + 1;
    const actualSpacing = totalRise / (numLinks - 1);
    for (let i = 0; i < numLinks; i++) {
      ys.push(i * actualSpacing);
    }
    return ys;
  }, [totalRise, linkSpacing]);

  // Generate links (vertical supports within slab thickness)
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;

    linkYs.forEach((y) => {
      const z = y / slope;
      const p1 = new THREE.Vector3(0, y, z);
      const p2 = new THREE.Vector3(0, y, z + linkSpacing);
      const link = createCylinderBetweenPoints(p1, p2, radius, linkMaterial);
      if (link) linkComponents.push(link);
    });

    return linkComponents;
  }, [
    linkYs,
    slope,
    linkSpacing,
    linkDiameter,
    linkMaterial,
    createCylinderBetweenPoints,
  ]);

  return (
    <group
      name="cantileverStair"
      rotation={[0, 0, -Math.atan(totalRise / totalRun)]}
    >
      {/* Support Wall */}
      {showConcrete && (
        <mesh
          geometry={supportGeometry}
          material={concreteMaterial}
          position={[-supportWidth / 2, (totalRise + slabThickness) / 2, 0]}
        />
      )}

      {/* Stair Slab */}
      {showConcrete && (
        <mesh
          geometry={stairGeometry}
          material={concreteMaterial}
          position={[0, -slabThickness / 2, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`main-${index}`} object={bar} />
          ))}
          {distributionBars.map((bar, index) => (
            <primitive key={`dist-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}
/////////// cantilever RC stairs ////////////

//////////// flat slab with column drop /////////
export function DrawFlatSlabWithColumnDrop({
  dimensions = {
    slabLength: 6.0, // Length along x (m)
    slabWidth: 6.0, // Width along z (m)
    slabThickness: 0.2, // Thickness of flat slab (m)
    dropThickness: 0.4, // Thickness of column drop (m)
    dropSide: 2.0, // Side length of square column drop (m)
    columnSide: 0.4, // Side length of column (m)
    cover: 0.025, // Concrete cover (m)
    tensionLap: 0.5, // Tension lap length (m)
  },
  reinforcement = {
    mainBarDiameter: 0.016, // Diameter of main bars (m)
    distributionBarDiameter: 0.012, // Diameter of distribution bars (m)
    barSpacing: 0.2, // Spacing between bars (m)
    linkDiameter: 0.01, // Diameter of links (m)
    linkSpacing: 0.15, // Link spacing (m)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    slabLength,
    slabWidth,
    slabThickness,
    dropThickness,
    dropSide,
    columnSide,
    cover,
    tensionLap,
  } = dimensions;
  const {
    mainBarDiameter,
    distributionBarDiameter,
    barSpacing,
    linkDiameter,
    linkSpacing,
  } = reinforcement;

  const halfSlabLength = slabLength / 2;
  const halfSlabWidth = slabWidth / 2;
  const dropOffsetY = slabThickness - dropThickness;
  const halfDropSide = dropSide / 2;
  const halfColumnSide = columnSide / 2;
  const bottomY = -slabThickness + cover + mainBarDiameter / 2;

  // Materials
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );

  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  const linkMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Function to create cylinder between two points
  const createCylinderBetweenPoints = React.useCallback(
    (p1, p2, radius, material) => {
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      if (length === 0) return null;

      const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      const mesh = new THREE.Mesh(geometry, material);

      const midpoint = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const axis = new THREE.Vector3()
        .crossVectors(defaultAxis, normalizedDirection)
        .normalize();
      const angle = Math.acos(defaultAxis.dot(normalizedDirection));

      if (axis.lengthSq() > 0.0001) {
        mesh.quaternion.setFromAxisAngle(axis, angle);
      }

      return mesh;
    },
    []
  );

  // Concrete geometries
  const slabGeometry = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, slabWidth),
    [slabLength, slabThickness, slabWidth]
  );

  const dropGeometry = React.useMemo(
    () => new THREE.BoxGeometry(dropSide, dropThickness, dropSide),
    [dropSide, dropThickness]
  );

  const columnGeometry = React.useMemo(
    () => new THREE.BoxGeometry(columnSide, 0.5, columnSide), // Partial column height for visualization
    [columnSide]
  );

  // Main bars (top layer along x direction)
  const mainBars = React.useMemo(() => {
    const bars = [];
    const y = bottomY + (slabThickness - 2 * cover) / 2; // Middle of slab thickness

    for (
      let z = -halfSlabWidth + cover + mainBarDiameter / 2;
      z <= halfSlabWidth - cover - mainBarDiameter / 2 + 0.0001;
      z += barSpacing
    ) {
      const p1 = new THREE.Vector3(-halfSlabLength, y, z);
      const p2 = new THREE.Vector3(halfSlabLength + tensionLap, y, z);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          mainBarDiameter / 2,
          mainRebarMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    halfSlabLength,
    halfSlabWidth,
    bottomY,
    slabThickness,
    cover,
    mainBarDiameter,
    tensionLap,
    barSpacing,
    mainRebarMaterial,
    createCylinderBetweenPoints,
  ]);

  // Distribution bars (along z direction)
  const distributionBars = React.useMemo(() => {
    const bars = [];
    const y = bottomY + (slabThickness - 2 * cover) / 2;

    for (
      let x = -halfSlabLength + cover + distributionBarDiameter / 2;
      x <= halfSlabLength - cover - distributionBarDiameter / 2 + 0.0001;
      x += barSpacing
    ) {
      const p1 = new THREE.Vector3(x, y, -halfSlabWidth);
      const p2 = new THREE.Vector3(x, y, halfSlabWidth + tensionLap);
      bars.push(
        createCylinderBetweenPoints(
          p1,
          p2,
          distributionBarDiameter / 2,
          distributionMaterial
        )
      );
    }

    return bars.filter(Boolean);
  }, [
    halfSlabLength,
    halfSlabWidth,
    bottomY,
    slabThickness,
    cover,
    distributionBarDiameter,
    tensionLap,
    barSpacing,
    distributionMaterial,
    createCylinderBetweenPoints,
  ]);

  // Link Y positions (within drop thickness)
  const linkYs = React.useMemo(() => {
    const ys = [];
    const numLinks = Math.ceil(dropThickness / linkSpacing) + 1;
    const actualSpacing = dropThickness / (numLinks - 1);
    for (let i = 0; i < numLinks; i++) {
      ys.push(dropOffsetY + i * actualSpacing);
    }
    return ys;
  }, [dropThickness, linkSpacing, dropOffsetY]);

  // Generate links (around column drop)
  const links = React.useMemo(() => {
    const linkComponents = [];
    const radius = linkDiameter / 2;
    const linkInnerX = -halfDropSide + cover + radius;
    const linkInnerZ = -halfDropSide + cover + radius;
    const linkOuterX = halfDropSide - cover - radius;
    const linkOuterZ = halfDropSide - cover - radius;

    linkYs.forEach((y) => {
      // Top and bottom horizontals along z
      const topHorizLength = linkOuterZ - linkInnerZ;
      const topHorizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        topHorizLength,
        8,
        1
      );
      const topLeftHoriz = new THREE.Mesh(topHorizGeom, linkMaterial);
      topLeftHoriz.position.set(linkInnerX, y, (linkInnerZ + linkOuterZ) / 2);
      topLeftHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(topLeftHoriz);

      const topRightHoriz = new THREE.Mesh(topHorizGeom, linkMaterial);
      topRightHoriz.position.set(linkOuterX, y, (linkInnerZ + linkOuterZ) / 2);
      topRightHoriz.rotation.x = Math.PI / 2;
      linkComponents.push(topRightHoriz);

      // Side horizontals along x
      const sideHorizLength = linkOuterX - linkInnerX;
      const sideHorizGeom = new THREE.CylinderGeometry(
        radius,
        radius,
        sideHorizLength,
        8,
        1
      );
      const leftSideHoriz = new THREE.Mesh(sideHorizGeom, linkMaterial);
      leftSideHoriz.position.set((linkInnerX + linkOuterX) / 2, y, linkInnerZ);
      leftSideHoriz.rotation.z = Math.PI / 2;
      linkComponents.push(leftSideHoriz);

      const rightSideHoriz = new THREE.Mesh(sideHorizGeom, linkMaterial);
      rightSideHoriz.position.set((linkInnerX + linkOuterX) / 2, y, linkOuterZ);
      rightSideHoriz.rotation.z = Math.PI / 2;
      linkComponents.push(rightSideHoriz);
    });

    return linkComponents;
  }, [linkYs, halfDropSide, cover, linkDiameter, linkMaterial]);

  return (
    <group name="flatSlabWithColumnDrop" position={[0, -slabThickness / 2, 0]}>
      {/* Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[0, slabThickness / 2, 0]}
        />
      )}

      {/* Column Drop */}
      {showConcrete && (
        <mesh
          geometry={dropGeometry}
          material={concreteMaterial}
          position={[0, dropOffsetY + dropThickness / 2, 0]}
        />
      )}

      {/* Column (partial for visualization) */}
      {showConcrete && (
        <mesh
          geometry={columnGeometry}
          material={concreteMaterial}
          position={[0, dropOffsetY + dropThickness + 0.25, 0]} // Positioned above drop
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {mainBars.map((bar, index) => (
            <primitive key={`main-${index}`} object={bar} />
          ))}
          {distributionBars.map((bar, index) => (
            <primitive key={`dist-${index}`} object={bar} />
          ))}
          {links.map((link, index) => (
            <primitive key={`link-${index}`} object={link} />
          ))}
        </group>
      )}
    </group>
  );
}
//////////Flat slab with column drop ////////////

///// slab detail components /////////

function DrawSlabDetailA({
  dimensions = {
    slabLength: 5.0,
    slabThickness: 0.3,
    wallThickness: 0.3,
    wallHeight: 1.0,
    cover: 0.025,
    P: 0.5, // Parameter P for offsets
  },
  reinforcement = {
    topBarDia: 0.016,
    topBarCount: 4,
    uBarDia: 0.016,
    uBarCount: 2, // Half of top bars typically
    lapLength: 0.5, // 500 or tension lap
    anchorageLength: 0.5,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { slabLength, slabThickness, wallThickness, wallHeight, cover, P } =
    dimensions;
  const {
    topBarDia,
    topBarCount,
    uBarDia,
    uBarCount,
    lapLength,
    anchorageLength,
  } = reinforcement;

  // Geometries
  const slabGeo = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, 1.0),
    [slabLength, slabThickness]
  );
  const wallGeo = React.useMemo(
    () => new THREE.BoxGeometry(wallThickness, wallHeight, 1.0),
    [wallThickness, wallHeight]
  );

  const barGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(topBarDia / 2, topBarDia / 2, slabLength, 8),
    [topBarDia, slabLength]
  );
  const uHorizontalGeo = React.useMemo(
    () => new THREE.CylinderGeometry(uBarDia / 2, uBarDia / 2, lapLength, 8),
    [uBarDia, lapLength]
  );
  const uVerticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        uBarDia / 2,
        uBarDia / 2,
        wallHeight - cover * 2,
        8
      ),
    [uBarDia, wallHeight, cover]
  );

  // Materials
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors, opacity, wireframe]
  );
  const rebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors, wireframe]
  );

  // Refs
  const topBarsRef = React.useRef();
  const uHorizRef = React.useRef();
  const uVertRef = React.useRef();

  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    const spacing = (1.0 - 2 * cover - topBarDia) / (topBarCount - 1);
    const yTop = slabThickness / 2 - cover - topBarDia / 2;

    // Top bars
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(0, yTop, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      topBarsRef.current.setMatrixAt(i, temp.matrix);
    }
    topBarsRef.current.instanceMatrix.needsUpdate = true;

    // U-bars alternately placed
    const uSpacing = spacing * 2; // Every other
    const offset = 0.5 * P;
    const vertLength = wallHeight - cover * 2;
    for (let i = 0; i < uBarCount; i++) {
      const z = -0.5 + cover + uBarDia / 2 + i * uSpacing;
      // Horizontal in slab
      temp.position.set(slabLength / 2 - offset - lapLength / 2, yTop, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      uHorizRef.current.setMatrixAt(i * 2, temp.matrix);
      // Horizontal in wall
      temp.position.set(
        slabLength / 2 - wallThickness / 2,
        -wallHeight / 2 + cover + uBarDia / 2,
        z
      );
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      uHorizRef.current.setMatrixAt(i * 2 + 1, temp.matrix);
      // Vertical
      temp.position.set(
        slabLength / 2 - wallThickness / 2 + lapLength / 2,
        -vertLength / 2,
        z
      );
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      uVertRef.current.setMatrixAt(i, temp.matrix);
    }
    uHorizRef.current.instanceMatrix.needsUpdate = true;
    uVertRef.current.instanceMatrix.needsUpdate = true;
  }, [dimensions, reinforcement]);

  return (
    <group position={[0, 0, 0]}>
      {showConcrete && (
        <>
          <mesh
            geometry={slabGeo}
            material={concreteMat}
            position={[0, 0, 0]}
          />
          <mesh
            geometry={wallGeo}
            material={concreteMat}
            position={[
              slabLength / 2 - wallThickness / 2,
              -wallHeight / 2 - slabThickness / 2,
              0,
            ]}
          />
        </>
      )}
      {showRebar && (
        <group>
          <instancedMesh
            ref={topBarsRef}
            args={[barGeo, rebarMat, topBarCount]}
          />
          <instancedMesh
            ref={uHorizRef}
            args={[uHorizontalGeo, rebarMat, uBarCount * 2]}
          />
          <instancedMesh
            ref={uVertRef}
            args={[uVerticalGeo, rebarMat, uBarCount]}
          />
        </group>
      )}
    </group>
  );
}

function DrawSlabDetailB({
  dimensions = {
    slabLength: 5.0,
    slabThickness: 0.3,
    wallThickness: 0.3,
    wallHeight: 1.0,
    cover: 0.025,
    P: 0.5,
    bendRadius: 0.1, // Standard bend radius
  },
  reinforcement = {
    topBarDia: 0.016,
    topBarCount: 4,
    anchorageLength: 0.5,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    slabLength,
    slabThickness,
    wallThickness,
    wallHeight,
    cover,
    P,
    bendRadius,
  } = dimensions;
  const { topBarDia, topBarCount, anchorageLength } = reinforcement;

  // Geometries - For bent bars, use TubeGeometry for bend
  const slabGeo = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, 1.0),
    [slabLength, slabThickness]
  );
  const wallGeo = React.useMemo(
    () => new THREE.BoxGeometry(wallThickness, wallHeight, 1.0),
    [wallThickness, wallHeight]
  );

  const straightGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        topBarDia / 2,
        topBarDia / 2,
        slabLength - bendRadius,
        8
      ),
    [topBarDia, slabLength, bendRadius]
  );
  const bendPath = React.useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(
        slabLength / 2 - bendRadius,
        slabThickness / 2 - cover - topBarDia / 2,
        0
      ),
      new THREE.Vector3(
        slabLength / 2,
        slabThickness / 2 - cover - topBarDia / 2 - bendRadius,
        0
      ),
      new THREE.Vector3(
        slabLength / 2,
        slabThickness / 2 - bendRadius - anchorageLength,
        0
      )
    );
    return new THREE.TubeGeometry(curve, 20, topBarDia / 2, 8, false);
  }, [
    slabLength,
    slabThickness,
    cover,
    topBarDia,
    bendRadius,
    anchorageLength,
  ]);
  const verticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        topBarDia / 2,
        topBarDia / 2,
        wallHeight - anchorageLength - cover,
        8
      ),
    [topBarDia, wallHeight, anchorageLength, cover]
  );

  // Materials
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors, opacity, wireframe]
  );
  const rebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors, wireframe]
  );

  // Refs
  const straightRef = React.useRef();
  const bendRef = React.useRef();
  const vertRef = React.useRef();

  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    const spacing = (1.0 - 2 * cover - topBarDia) / (topBarCount - 1);
    const yTop = slabThickness / 2 - cover - topBarDia / 2;

    // Straight parts
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(-(slabLength - bendRadius) / 2, yTop, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      straightRef.current.setMatrixAt(i, temp.matrix);
    }
    straightRef.current.instanceMatrix.needsUpdate = true;

    // Bends
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(0, 0, z);
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      bendRef.current.setMatrixAt(i, temp.matrix);
    }
    bendRef.current.instanceMatrix.needsUpdate = true;

    // Verticals
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(
        slabLength / 2,
        -(wallHeight - anchorageLength - cover) / 2 - slabThickness / 2,
        z
      );
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      vertRef.current.setMatrixAt(i, temp.matrix);
    }
    vertRef.current.instanceMatrix.needsUpdate = true;
  }, [dimensions, reinforcement]);

  return (
    <group position={[0, 0, 0]}>
      {showConcrete && (
        <>
          <mesh
            geometry={slabGeo}
            material={concreteMat}
            position={[0, 0, 0]}
          />
          <mesh
            geometry={wallGeo}
            material={concreteMat}
            position={[
              slabLength / 2 - wallThickness / 2,
              -wallHeight / 2 - slabThickness / 2,
              0,
            ]}
          />
        </>
      )}
      {showRebar && (
        <group>
          <instancedMesh
            ref={straightRef}
            args={[straightGeo, rebarMat, topBarCount]}
          />
          <instancedMesh
            ref={bendRef}
            args={[bendPath, rebarMat, topBarCount]}
          />
          <instancedMesh
            ref={vertRef}
            args={[verticalGeo, rebarMat, topBarCount]}
          />
        </group>
      )}
    </group>
  );
}

function DrawSlabDetailC({
  dimensions = {
    slabLength: 5.0,
    slabThickness: 0.3,
    wallThickness: 0.3,
    wallHeight: 1.0,
    cover: 0.025,
    P: 0.5,
    bendRadius: 0.2, // Non-standard larger radius
  },
  reinforcement = {
    topBarDia: 0.016,
    topBarCount: 4,
    anchorageLength: 0.5,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    slabLength,
    slabThickness,
    wallThickness,
    wallHeight,
    cover,
    P,
    bendRadius,
  } = dimensions;
  const { topBarDia, topBarCount, anchorageLength } = reinforcement;

  // Similar to B but larger bend radius
  const slabGeo = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, 1.0),
    [slabLength, slabThickness]
  );
  const wallGeo = React.useMemo(
    () => new THREE.BoxGeometry(wallThickness, wallHeight, 1.0),
    [wallThickness, wallHeight]
  );

  const straightGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        topBarDia / 2,
        topBarDia / 2,
        slabLength - bendRadius,
        8
      ),
    [topBarDia, slabLength, bendRadius]
  );
  const bendPath = React.useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(
        slabLength / 2 - bendRadius,
        slabThickness / 2 - cover - topBarDia / 2,
        0
      ),
      new THREE.Vector3(
        slabLength / 2,
        slabThickness / 2 - cover - topBarDia / 2 - bendRadius,
        0
      ),
      new THREE.Vector3(
        slabLength / 2,
        slabThickness / 2 - bendRadius - anchorageLength,
        0
      )
    );
    return new THREE.TubeGeometry(curve, 20, topBarDia / 2, 8, false);
  }, [
    slabLength,
    slabThickness,
    cover,
    topBarDia,
    bendRadius,
    anchorageLength,
  ]);
  const verticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        topBarDia / 2,
        topBarDia / 2,
        wallHeight - anchorageLength - cover,
        8
      ),
    [topBarDia, wallHeight, anchorageLength, cover]
  );

  // Materials
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors, opacity, wireframe]
  );
  const rebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors, wireframe]
  );

  // Refs same as B
  const straightRef = React.useRef();
  const bendRef = React.useRef();
  const vertRef = React.useRef();

  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    const spacing = (1.0 - 2 * cover - topBarDia) / (topBarCount - 1);
    const yTop = slabThickness / 2 - cover - topBarDia / 2;

    // Straight
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(-(slabLength - bendRadius) / 2, yTop, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      straightRef.current.setMatrixAt(i, temp.matrix);
    }
    straightRef.current.instanceMatrix.needsUpdate = true;

    // Bends
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(0, 0, z);
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      bendRef.current.setMatrixAt(i, temp.matrix);
    }
    bendRef.current.instanceMatrix.needsUpdate = true;

    // Verticals
    for (let i = 0; i < topBarCount; i++) {
      const z = -0.5 + cover + topBarDia / 2 + i * spacing;
      temp.position.set(
        slabLength / 2,
        -(wallHeight - anchorageLength - cover) / 2 - slabThickness / 2,
        z
      );
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      vertRef.current.setMatrixAt(i, temp.matrix);
    }
    vertRef.current.instanceMatrix.needsUpdate = true;
  }, [dimensions, reinforcement]);

  return (
    <group position={[0, 0, 0]}>
      {showConcrete && (
        <>
          <mesh
            geometry={slabGeo}
            material={concreteMat}
            position={[0, 0, 0]}
          />
          <mesh
            geometry={wallGeo}
            material={concreteMat}
            position={[
              slabLength / 2 - wallThickness / 2,
              -wallHeight / 2 - slabThickness / 2,
              0,
            ]}
          />
        </>
      )}
      {showRebar && (
        <group>
          <instancedMesh
            ref={straightRef}
            args={[straightGeo, rebarMat, topBarCount]}
          />
          <instancedMesh
            ref={bendRef}
            args={[bendPath, rebarMat, topBarCount]}
          />
          <instancedMesh
            ref={vertRef}
            args={[verticalGeo, rebarMat, topBarCount]}
          />
        </group>
      )}
    </group>
  );
}

// Main component with switch
export function SlabDetailsViewer({ selectedDetail = "A", ...props }) {
  switch (selectedDetail) {
    case "A":
      return <DrawSlabDetailA {...props} />;
    case "B":
      return <DrawSlabDetailB {...props} />;
    case "C":
      return <DrawSlabDetailC {...props} />;
    default:
      return null;
  }
}

// // Usage example
// function App() {
//   const [selected, setSelected] = useState('A');
//   return (
//     <>
//       <select value={selected} onChange={e => setSelected(e.target.value)}>
//         <option value="A">Detail A</option>
//         <option value="B">Detail B</option>
//         <option value="C">Detail C</option>
//       </select>
//       <SlabDetailsViewer selectedDetail={selected} />
//     </>
//   );
// }

///// slab detail components /////////

////////unrestrained slab support components /////////
function DrawSlabSupportA({
  dimensions = {
    slabLength: 5.0,
    slabThickness: 0.3,
    supportWidth: 0.5,
    cover: 0.025,
  },
  reinforcement = {
    uBarDia: 0.016,
    bottomBarDia: 0.016,
    uBarCount: 2,
    bottomBarCount: 4,
    lapLength: 0.5, // 500 or tension lap
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { slabLength, slabThickness, supportWidth, cover } = dimensions;
  const { uBarDia, bottomBarDia, uBarCount, bottomBarCount, lapLength } =
    reinforcement;

  // Geometries
  const slabGeo = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, 1.0),
    [slabLength, slabThickness]
  );
  const supportGeo = React.useMemo(
    () => new THREE.BoxGeometry(supportWidth, slabThickness, 1.0),
    [supportWidth, slabThickness]
  );

  const barGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        bottomBarDia / 2,
        bottomBarDia / 2,
        slabLength,
        8
      ),
    [bottomBarDia, slabLength]
  );
  const uHorizontalGeo = React.useMemo(
    () => new THREE.CylinderGeometry(uBarDia / 2, uBarDia / 2, lapLength, 8),
    [uBarDia, lapLength]
  );
  const uVerticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        uBarDia / 2,
        uBarDia / 2,
        slabThickness - 2 * cover,
        8
      ),
    [uBarDia, slabThickness, cover]
  );

  // Materials
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors, opacity, wireframe]
  );
  const rebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors, wireframe]
  );

  // Refs
  const bottomBarsRef = React.useRef();
  const uHorizRef = React.useRef();
  const uVertRef = React.useRef();

  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    const spacing = (1.0 - 2 * cover - bottomBarDia) / (bottomBarCount - 1);
    const yBottom = -slabThickness / 2 + cover + bottomBarDia / 2;

    // Bottom bars
    for (let i = 0; i < bottomBarCount; i++) {
      const z = -0.5 + cover + bottomBarDia / 2 + i * spacing;
      temp.position.set(0, yBottom, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      bottomBarsRef.current.setMatrixAt(i, temp.matrix);
    }
    bottomBarsRef.current.instanceMatrix.needsUpdate = true;

    // U-bars
    const uSpacing = (1.0 - 2 * cover - uBarDia) / (uBarCount - 1);
    const yTop = slabThickness / 2 - cover - uBarDia / 2;
    const offset = 0.1 * slabLength; // 0.1 x span offset
    for (let i = 0; i < uBarCount; i++) {
      const z = -0.5 + cover + uBarDia / 2 + i * uSpacing;
      // Horizontal
      temp.position.set(-offset - lapLength / 2, yTop, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      uHorizRef.current.setMatrixAt(i, temp.matrix);
      // Vertical
      temp.position.set(-offset, 0, z);
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      uVertRef.current.setMatrixAt(i, temp.matrix);
    }
    uHorizRef.current.instanceMatrix.needsUpdate = true;
    uVertRef.current.instanceMatrix.needsUpdate = true;
  }, [dimensions, reinforcement]);

  return (
    <group position={[0, 0, 0]}>
      {showConcrete && (
        <>
          <mesh
            geometry={slabGeo}
            material={concreteMat}
            position={[0, 0, 0]}
          />
          <mesh
            geometry={supportGeo}
            material={concreteMat}
            position={[-supportWidth / 2, -slabThickness / 2, 0]}
          />
        </>
      )}
      {showRebar && (
        <group>
          <instancedMesh
            ref={bottomBarsRef}
            args={[barGeo, rebarMat, bottomBarCount]}
          />
          <instancedMesh
            ref={uHorizRef}
            args={[uHorizontalGeo, rebarMat, uBarCount]}
          />
          <instancedMesh
            ref={uVertRef}
            args={[uVerticalGeo, rebarMat, uBarCount]}
          />
        </group>
      )}
    </group>
  );
}

function DrawSlabSupportB({
  dimensions = {
    slabLength: 5.0,
    slabThickness: 0.15,
    supportWidth: 0.5,
    cover: 0.025,
  },
  reinforcement = {
    uBarDia: 0.016,
    bottomBarDia: 0.016,
    uBarCount: 2,
    bottomBarCount: 4,
    lapLength: 0.5, // 500 or tension lap
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { slabLength, slabThickness, supportWidth, cover } = dimensions;
  const { uBarDia, bottomBarDia, uBarCount, bottomBarCount, lapLength } =
    reinforcement;

  // Geometries
  const slabGeo = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, 1.0),
    [slabLength, slabThickness]
  );
  const supportGeo = React.useMemo(
    () => new THREE.BoxGeometry(supportWidth, slabThickness, 1.0),
    [supportWidth, slabThickness]
  );

  const barGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        bottomBarDia / 2,
        bottomBarDia / 2,
        slabLength,
        8
      ),
    [bottomBarDia, slabLength]
  );
  const uHorizontalGeo = React.useMemo(
    () => new THREE.CylinderGeometry(uBarDia / 2, uBarDia / 2, lapLength, 8),
    [uBarDia, lapLength]
  );
  const uVerticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        uBarDia / 2,
        uBarDia / 2,
        slabThickness - 2 * cover,
        8
      ),
    [uBarDia, slabThickness, cover]
  );

  // Materials
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors, opacity, wireframe]
  );
  const rebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors, wireframe]
  );

  // Refs
  const bottomBarsRef = React.useRef();
  const uHorizRef = React.useRef();
  const uVertRef = React.useRef();

  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    const spacing = (1.0 - 2 * cover - bottomBarDia) / (bottomBarCount - 1);
    const yBottom = -slabThickness / 2 + cover + bottomBarDia / 2;

    // Bottom bars
    for (let i = 0; i < bottomBarCount; i++) {
      const z = -0.5 + cover + bottomBarDia / 2 + i * spacing;
      temp.position.set(0, yBottom, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      bottomBarsRef.current.setMatrixAt(i, temp.matrix);
    }
    bottomBarsRef.current.instanceMatrix.needsUpdate = true;

    // U-bars with 0.3 lb, rqd, or 10 times dia
    const uSpacing = (1.0 - 2 * cover - uBarDia) / (uBarCount - 1);
    const yTop = slabThickness / 2 - cover - uBarDia / 2;
    const offset = 0.1 * slabLength; // 0.1 x span
    for (let i = 0; i < uBarCount; i++) {
      const z = -0.5 + cover + uBarDia / 2 + i * uSpacing;
      // Horizontal
      temp.position.set(-offset - lapLength / 2, yTop, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      uHorizRef.current.setMatrixAt(i, temp.matrix);
      // Vertical
      temp.position.set(-offset, 0, z);
      temp.rotation.set(0, 0, 0);
      temp.updateMatrix();
      uVertRef.current.setMatrixAt(i, temp.matrix);
    }
    uHorizRef.current.instanceMatrix.needsUpdate = true;
    uVertRef.current.instanceMatrix.needsUpdate = true;
  }, [dimensions, reinforcement]);

  return (
    <group position={[0, 0, 0]}>
      {showConcrete && (
        <>
          <mesh
            geometry={slabGeo}
            material={concreteMat}
            position={[0, 0, 0]}
          />
          <mesh
            geometry={supportGeo}
            material={concreteMat}
            position={[-supportWidth / 2, -slabThickness / 2, 0]}
          />
        </>
      )}
      {showRebar && (
        <group>
          <instancedMesh
            ref={bottomBarsRef}
            args={[barGeo, rebarMat, bottomBarCount]}
          />
          <instancedMesh
            ref={uHorizRef}
            args={[uHorizontalGeo, rebarMat, uBarCount]}
          />
          <instancedMesh
            ref={uVertRef}
            args={[uVerticalGeo, rebarMat, uBarCount]}
          />
        </group>
      )}
    </group>
  );
}

function DrawSlabSupportC({
  dimensions = {
    slabLength: 5.0,
    slabThickness: 0.15,
    supportWidth: 0.25,
    cover: 0.025,
  },
  reinforcement = {
    bottomBarDia: 0.016,
    bottomBarCount: 4,
    fabricWidth: 0.2,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { slabLength, slabThickness, supportWidth, cover } = dimensions;
  const { bottomBarDia, bottomBarCount, fabricWidth } = reinforcement;

  // Geometries
  const slabGeo = React.useMemo(
    () => new THREE.BoxGeometry(slabLength, slabThickness, 1.0),
    [slabLength, slabThickness]
  );
  const supportGeo = React.useMemo(
    () => new THREE.BoxGeometry(supportWidth, slabThickness, 1.0),
    [supportWidth, slabThickness]
  );
  const barGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        bottomBarDia / 2,
        bottomBarDia / 2,
        slabLength,
        8
      ),
    [bottomBarDia, slabLength]
  );
  const fabricGeo = React.useMemo(
    () => new THREE.PlaneGeometry(fabricWidth, 1.0 - 2 * cover),
    [fabricWidth, cover]
  );

  // Materials
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors, opacity, wireframe]
  );
  const rebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors, wireframe]
  );

  // Refs
  const bottomBarsRef = React.useRef();
  const fabricRef = React.useRef();

  React.useLayoutEffect(() => {
    const temp = new THREE.Object3D();
    const spacing = (1.0 - 2 * cover - bottomBarDia) / (bottomBarCount - 1);
    const yBottom = -slabThickness / 2 + cover + bottomBarDia / 2;

    // Bottom bars
    for (let i = 0; i < bottomBarCount; i++) {
      const z = -0.5 + cover + bottomBarDia / 2 + i * spacing;
      temp.position.set(0, yBottom, z);
      temp.rotation.z = Math.PI / 2;
      temp.updateMatrix();
      bottomBarsRef.current.setMatrixAt(i, temp.matrix);
    }
    bottomBarsRef.current.instanceMatrix.needsUpdate = true;

    // Fabric
    temp.position.set(-supportWidth / 2, yBottom, 0);
    temp.rotation.set(Math.PI / 2, 0, 0);
    temp.updateMatrix();
    fabricRef.current.setMatrixAt(0, temp.matrix);
    fabricRef.current.instanceMatrix.needsUpdate = true;
  }, [dimensions, reinforcement]);

  return (
    <group position={[0, 0, 0]}>
      {showConcrete && (
        <>
          <mesh
            geometry={slabGeo}
            material={concreteMat}
            position={[0, 0, 0]}
          />
          <mesh
            geometry={supportGeo}
            material={concreteMat}
            position={[-supportWidth / 2, -slabThickness / 2, 0]}
          />
        </>
      )}
      {showRebar && (
        <group>
          <instancedMesh
            ref={bottomBarsRef}
            args={[barGeo, rebarMat, bottomBarCount]}
          />
          <instancedMesh ref={fabricRef} args={[fabricGeo, rebarMat, 1]} />
        </group>
      )}
    </group>
  );
}

// Main component with switch
export function UnrestrainedSlabSupportViewer({
  selectedDetail = "A",
  ...props
}) {
  switch (selectedDetail) {
    case "A":
      return <DrawSlabSupportA {...props} />;
    case "B":
      return <DrawSlabSupportB {...props} />;
    case "C":
      return <DrawSlabSupportC {...props} />;
    default:
      return null;
  }
}

// Usage example
// function App() {
//   const [selected, setSelected] = useState('A');
//   return (
//     <>
//       <select value={selected} onChange={e => setSelected(e.target.value)}>
//         <option value="A">Support A (Depth ≥ 150)</option>
//         <option value="B">Support B (Depth < 150)</option>
//         <option value="C">Support C (Width ≥ 200)</option>
//       </select>
//       <UnrestrainedSlabSupportViewer selectedDetail={selected} />
//     </>
//   );
// }

///////unrestrained slab support components /////////

///// cantilever beam component /////////

export function DrawCantileverBeam({
  dimensions = {
    span: 5.0,
    cantileverLength: 2.0,
    width: 0.3,
    depth: 0.5,
    cover: 0.025,
  },
  reinforcement = {
    bottomBarCount: 2,
    bottomBarDiameter: 0.016,
    topBarCount: 4,
    topBarDiameter: 0.02,
    stirrupDiameter: 0.01,
    stirrupSpacing: 0.15,
    uBarDiameter: 0.016,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { span, width, depth, cover, cantileverLength } = dimensions;
  const {
    bottomBarCount,
    bottomBarDiameter,
    topBarCount,
    topBarDiameter,
    stirrupDiameter,
    stirrupSpacing,
    uBarDiameter,
  } = reinforcement;
  const concreteGeo = React.useMemo(
    () => new THREE.BoxGeometry(width, depth, span),
    [width, depth, span]
  );
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );
  const mainRebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.mainRebar, wireframe]
  );
  const distributionMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.distributionBars, wireframe]
  );
  const stirrupMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.stirrups, wireframe]
  );
  const bottomBarGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        bottomBarDiameter / 2,
        bottomBarDiameter / 2,
        span,
        8
      ),
    [bottomBarDiameter, span]
  );
  const bottomBarY = -depth / 2 + cover + bottomBarDiameter / 2;
  const bottomSpacing =
    bottomBarCount > 1
      ? (width - 2 * cover - bottomBarDiameter) / (bottomBarCount - 1)
      : 0;
  const bottomStartX = -width / 2 + cover + bottomBarDiameter / 2;
  const bottomBarsRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < bottomBarCount; i++) {
      matrix.setPosition(bottomStartX + i * bottomSpacing, bottomBarY, 0);
      bottomBarsRef.current.setMatrixAt(i, matrix);
    }
    bottomBarsRef.current.instanceMatrix.needsUpdate = true;
  }, [bottomBarCount, bottomSpacing, bottomStartX, bottomBarY]);
  const topBarY = depth / 2 - cover - topBarDiameter / 2;
  const topSpacing =
    topBarCount > 1
      ? (width - 2 * cover - topBarDiameter) / (topBarCount - 1)
      : 0;
  const topStartX = -width / 2 + cover + topBarDiameter / 2;
  const longLength = span;
  const shortLength = span - 0.5 * cantileverLength;
  const longGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        topBarDiameter / 2,
        topBarDiameter / 2,
        longLength,
        8
      ),
    [topBarDiameter, longLength]
  );
  const shortGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        topBarDiameter / 2,
        topBarDiameter / 2,
        shortLength,
        8
      ),
    [topBarDiameter, shortLength]
  );
  const longRef = React.useRef();
  const shortRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let longIndex = 0;
    let shortIndex = 0;
    for (let i = 0; i < topBarCount; i++) {
      const x = topStartX + i * topSpacing;
      if (i % 2 === 0) {
        matrix.setPosition(x, topBarY, 0);
        longRef.current.setMatrixAt(longIndex++, matrix);
      } else {
        const shortZ = -span / 2 + shortLength / 2;
        matrix.setPosition(x, topBarY, shortZ);
        shortRef.current.setMatrixAt(shortIndex++, matrix);
      }
    }
    longRef.current.instanceMatrix.needsUpdate = true;
    shortRef.current.instanceMatrix.needsUpdate = true;
  }, [topBarCount, topSpacing, topStartX, topBarY, span, shortLength]);
  const verticalLength = depth - 2 * cover - stirrupDiameter;
  const horizontalLength = width - 2 * cover - stirrupDiameter;
  const verticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        stirrupDiameter / 2,
        stirrupDiameter / 2,
        verticalLength,
        8
      ),
    [stirrupDiameter, verticalLength]
  );
  const horizontalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        stirrupDiameter / 2,
        stirrupDiameter / 2,
        horizontalLength,
        8
      ),
    [stirrupDiameter, horizontalLength]
  );
  const stirrupPositions = React.useMemo(() => {
    const positions = [];
    for (
      let z = -span / 2 + stirrupSpacing / 2;
      z < span / 2;
      z += stirrupSpacing
    ) {
      positions.push(z);
    }
    return positions;
  }, [span, stirrupSpacing]);
  const numStirrups = stirrupPositions.length;
  const verticalRef = React.useRef();
  const bottomHorizontalRef = React.useRef();
  const topHorizontalRef = React.useRef();
  const leftX = -width / 2 + cover + stirrupDiameter / 2;
  const rightX = width / 2 - cover - stirrupDiameter / 2;
  const bottomY = -depth / 2 + cover + stirrupDiameter / 2;
  const topY = depth / 2 - cover - stirrupDiameter / 2;
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (let z of stirrupPositions) {
      matrix.setPosition(leftX, 0, z);
      verticalRef.current.setMatrixAt(index++, matrix);
      matrix.setPosition(rightX, 0, z);
      verticalRef.current.setMatrixAt(index++, matrix);
    }
    verticalRef.current.instanceMatrix.needsUpdate = true;
    index = 0;
    for (let z of stirrupPositions) {
      matrix.setPosition(0, bottomY, z);
      bottomHorizontalRef.current.setMatrixAt(index++, matrix);
    }
    bottomHorizontalRef.current.instanceMatrix.needsUpdate = true;
    index = 0;
    for (let z of stirrupPositions) {
      matrix.setPosition(0, topY, z);
      topHorizontalRef.current.setMatrixAt(index++, matrix);
    }
    topHorizontalRef.current.instanceMatrix.needsUpdate = true;
  }, [stirrupPositions, leftX, rightX, bottomY, topY]);
  const uBarVerticalLength = depth - 2 * cover - uBarDiameter;
  const uBarHorizontalLength = width - 2 * cover - uBarDiameter;
  const uBarHorizontalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        uBarDiameter / 2,
        uBarDiameter / 2,
        uBarHorizontalLength,
        8
      ),
    [uBarDiameter, uBarHorizontalLength]
  );
  const uBarVerticalGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        uBarDiameter / 2,
        uBarDiameter / 2,
        uBarVerticalLength,
        8
      ),
    [uBarDiameter, uBarVerticalLength]
  );
  const uBarZ = -span / 2;
  const uBarHorizontalY = -depth / 2 + cover + uBarDiameter / 2;
  const uBarVerticalY = uBarHorizontalY + uBarVerticalLength / 2;
  const uBarLeftX = -width / 2 + cover + uBarDiameter / 2;
  const uBarRightX = width / 2 - cover - uBarDiameter / 2;
  return (
    <group name="cantileverBeam">
      {showConcrete && <mesh geometry={concreteGeo} material={concreteMat} />}
      {showRebar && (
        <group name="reinforcement">
          <instancedMesh
            ref={bottomBarsRef}
            args={[bottomBarGeo, distributionMat, bottomBarCount]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={longRef}
            args={[longGeo, mainRebarMat, Math.ceil(topBarCount / 2)]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={shortRef}
            args={[shortGeo, mainRebarMat, Math.floor(topBarCount / 2)]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={verticalRef}
            args={[verticalGeo, stirrupMat, numStirrups * 2]}
          />
          <instancedMesh
            ref={bottomHorizontalRef}
            args={[horizontalGeo, stirrupMat, numStirrups]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <instancedMesh
            ref={topHorizontalRef}
            args={[horizontalGeo, stirrupMat, numStirrups]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <group name="uBar" position={[0, 0, uBarZ]}>
            <mesh
              geometry={uBarHorizontalGeo}
              material={mainRebarMat}
              position={[0, uBarHorizontalY, 0]}
              rotation={[0, Math.PI / 2, 0]}
            />
            <mesh
              geometry={uBarVerticalGeo}
              material={mainRebarMat}
              position={[uBarLeftX, uBarVerticalY, 0]}
            />
            <mesh
              geometry={uBarVerticalGeo}
              material={mainRebarMat}
              position={[uBarRightX, uBarVerticalY, 0]}
            />
          </group>
        </group>
      )}
    </group>
  );
}
///// cantilever beam component /////////

///// flat slab component /////////

export function DrawFlatSlabSupport({
  dimensions = {
    span: 6.0,
    panelWidth: 6.0,
    thickness: 0.2,
    cover: 0.025,
    columnDia: 0.3, // Equivalent column diameter
  },
  reinforcement = {
    p1Diameter: 0.016, // Diameter for p1 bars
    p2Diameter: 0.02, // Diameter for p2 bars (e.g., bars passing through column)
    distDiameter: 0.01, // Diameter for distribution bars
    middleSpacing: 0.2, // Spacing in middle strip
    columnSpacing: 0.15, // Spacing in column strip
    distSpacing: 0.2, // Spacing for distribution bars
    optionalMesh: false, // Toggle optional mesh (perpendicular distribution)
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { span, panelWidth, thickness, cover, columnDia } = dimensions;
  const {
    p1Diameter,
    p2Diameter,
    distDiameter,
    middleSpacing,
    columnSpacing,
    distSpacing,
    optionalMesh,
  } = reinforcement;

  // Concrete geometry and material
  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(panelWidth, thickness, span),
    [panelWidth, thickness, span]
  );
  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: opacity,
        wireframe: wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  // Materials for rebar
  const mainRebarMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.mainRebar, wireframe]
  );
  const distributionMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: wireframe,
      }),
    [colors.distributionBars, wireframe]
  );

  // Bottom main bars geometries (full span)
  const p1Geo = React.useMemo(
    () => new THREE.CylinderGeometry(p1Diameter / 2, p1Diameter / 2, span, 8),
    [p1Diameter, span]
  );
  const p2Geo = React.useMemo(
    () => new THREE.CylinderGeometry(p2Diameter / 2, p2Diameter / 2, span, 8),
    [p2Diameter, span]
  );

  // Top distribution bars geometry (0.6 x span)
  const distGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        distDiameter / 2,
        distDiameter / 2,
        0.6 * span,
        8
      ),
    [distDiameter, span]
  );

  // Optional mesh geometry (perpendicular bars, full panelWidth)
  const meshGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        distDiameter / 2,
        distDiameter / 2,
        panelWidth,
        8
      ),
    [distDiameter, panelWidth]
  );

  // Calculate isSmallColumn
  const isSmallColumn = columnDia < 0.15 * panelWidth;

  // Middle strip bars positions (all p1)
  const middleStripWidth = panelWidth / 2;
  const numMiddle = Math.floor(middleStripWidth / middleSpacing) + 1;
  const actualMiddleSpacing =
    numMiddle > 1 ? middleStripWidth / (numMiddle - 1) : 0;
  const middleStartX = -panelWidth / 2 + cover + p1Diameter / 2;
  const middlePositions = [];
  for (let i = 0; i < numMiddle; i++) {
    middlePositions.push(middleStartX + i * actualMiddleSpacing);
  }

  // Column strip bars positions
  const columnStripWidth = panelWidth / 2;
  let totalBarsColumn = Math.floor(columnStripWidth / columnSpacing) + 1;
  let columnPositions = [];
  let outerNum = Math.floor(totalBarsColumn / 3); // 1/3 in outer
  let centerNum = totalBarsColumn - outerNum; // 2/3 in center
  const halfWidth = columnStripWidth / 2;
  if (isSmallColumn) {
    const outerSpacing =
      outerNum > 1 ? halfWidth / (outerNum - 1) : halfWidth / 2; // Center if 1
    const centerSpacing =
      centerNum > 1 ? halfWidth / (centerNum - 1) : halfWidth / 2;
    const outerStartX = 0 + cover + p1Diameter / 2; // Start from left of column strip
    for (let i = 0; i < outerNum; i++) {
      columnPositions.push(outerStartX + i * outerSpacing);
    }
    const centerStartX = halfWidth + cover + p1Diameter / 2;
    for (let i = 0; i < centerNum; i++) {
      columnPositions.push(centerStartX + i * centerSpacing);
    }
  } else {
    const actualColumnSpacing =
      totalBarsColumn > 1 ? columnStripWidth / (totalBarsColumn - 1) : 0;
    const columnStartX = 0 + cover + p1Diameter / 2;
    for (let i = 0; i < totalBarsColumn; i++) {
      columnPositions.push(columnStartX + i * actualColumnSpacing);
    }
  }

  // Separate p2 for the last two in column strip (bars passing through column)
  const p1ColumnPositions = columnPositions.slice(0, -2);
  const p2ColumnPositions = columnPositions.slice(-2);

  // All p1 positions (middle + p1 column)
  const p1Positions = middlePositions.concat(p1ColumnPositions);

  // Y positions
  const bottomY = -thickness / 2 + cover + p1Diameter / 2; // Use p1 for average
  const topY = thickness / 2 - cover - distDiameter / 2;

  // Instanced refs for main bars
  const p1Ref = React.useRef();
  const p2Ref = React.useRef();

  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    p1Positions.forEach((x, i) => {
      matrix.setPosition(x, bottomY, 0);
      p1Ref.current.setMatrixAt(i, matrix);
    });
    p1Ref.current.instanceMatrix.needsUpdate = true;
  }, [p1Positions, bottomY]);

  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    p2ColumnPositions.forEach((x, i) => {
      matrix.setPosition(x, bottomY, 0);
      p2Ref.current.setMatrixAt(i, matrix);
    });
    p2Ref.current.instanceMatrix.needsUpdate = true;
  }, [p2ColumnPositions, bottomY]);

  // Distribution bars positions (across panelWidth)
  const numDist = Math.floor(panelWidth / distSpacing) + 1;
  const actualDistSpacing = numDist > 1 ? panelWidth / (numDist - 1) : 0;
  const distStartX = -panelWidth / 2 + cover + distDiameter / 2;
  const distPositions = [];
  for (let i = 0; i < numDist; i++) {
    distPositions.push(distStartX + i * actualDistSpacing);
  }

  // Refs for left and right distribution (for interior panel)
  const distLeftRef = React.useRef();
  const distRightRef = React.useRef();

  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    distPositions.forEach((x, i) => {
      matrix.setPosition(x, 0, 0);
      distLeftRef.current.setMatrixAt(i, matrix);
    });
    distLeftRef.current.instanceMatrix.needsUpdate = true;
  }, [distPositions]);

  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    distPositions.forEach((x, i) => {
      matrix.setPosition(x, 0, 0);
      distRightRef.current.setMatrixAt(i, matrix);
    });
    distRightRef.current.instanceMatrix.needsUpdate = true;
  }, [distPositions]);

  // Optional mesh (perpendicular bars at top)
  let meshPositions = [];
  if (optionalMesh) {
    const numMesh = Math.floor(span / distSpacing) + 1;
    const actualMeshSpacing = numMesh > 1 ? span / (numMesh - 1) : 0;
    const meshStartZ = -span / 2 + cover + distDiameter / 2;
    for (let i = 0; i < numMesh; i++) {
      meshPositions.push(meshStartZ + i * actualMeshSpacing);
    }
  }
  const meshRef = React.useRef();

  React.useLayoutEffect(() => {
    if (optionalMesh) {
      const matrix = new THREE.Matrix4();
      meshPositions.forEach((z, i) => {
        matrix.setPosition(0, 0, z);
        meshRef.current.setMatrixAt(i, matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [meshPositions, optionalMesh]);

  return (
    <group name="flatSlab">
      {showConcrete && (
        <mesh geometry={concreteGeometry} material={concreteMaterial} />
      )}

      {showRebar && (
        <group name="reinforcement">
          {/* Bottom main bars */}
          <instancedMesh
            ref={p1Ref}
            args={[p1Geo, mainRebarMaterial, p1Positions.length]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={p2Ref}
            args={[p2Geo, mainRebarMaterial, p2ColumnPositions.length]}
            rotation={[Math.PI / 2, 0, 0]}
          />

          {/* Top distribution bars left and right */}
          <group position={[0, topY, -span / 2 + 0.3 * span]}>
            <instancedMesh
              ref={distLeftRef}
              args={[distGeo, distributionMaterial, numDist]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          </group>
          <group position={[0, topY, span / 2 - 0.3 * span]}>
            <instancedMesh
              ref={distRightRef}
              args={[distGeo, distributionMaterial, numDist]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          </group>

          {/* Optional mesh (perpendicular at top) */}
          {optionalMesh && (
            <group position={[0, topY, 0]}>
              <instancedMesh
                ref={meshRef}
                args={[meshGeo, distributionMaterial, meshPositions.length]}
                rotation={[0, Math.PI / 2, 0]}
              />
            </group>
          )}
        </group>
      )}
    </group>
  );
}

///// flat slab support component /////////

export function DrawRibbedSlab({
  dimensions = {
    length: 5.0, // Z direction
    width: 4.0, // X direction, total width
    topThickness: 0.075,
    ribDepth: 0.3,
    ribWidth: 0.125, // Min 0.075 for 1 bar, 0.125 for 2
    ribSpacing: 0.6, // Center to center
    cover: 0.025,
  },
  reinforcement = {
    bottomBarDiameter: 0.016,
    barsPerRib: 2,
    meshBarDiameter: 0.008, // For A252
    meshSpacing: 0.2,
    stirrupDiameter: 0.008,
    stirrupSpacing: 0.15,
    closedLinks: true, // For shear if required
    lacingDiameter: 0.012,
    lacingSpacing: 0.75,
    supplementaryDiameter: 0.006,
    supplementaryPitch: 0.2,
    lapLength: 0.3, // For overlaps, but shown continuous
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const { length, width, topThickness, ribDepth, ribWidth, ribSpacing, cover } =
    dimensions;
  const {
    bottomBarDiameter,
    barsPerRib,
    meshBarDiameter,
    meshSpacing,
    stirrupDiameter,
    stirrupSpacing,
    closedLinks,
    lacingDiameter,
    lacingSpacing,
    supplementaryDiameter,
    supplementaryPitch,
    lapLength,
  } = reinforcement;

  const totalDepth = topThickness + ribDepth;
  const useLacing = totalDepth > 0.75;
  const useSupplementary = cover > 0.04;

  // Rib positions
  const numRibs = Math.floor((width - ribWidth) / ribSpacing) + 1;
  const actualRibSpacing = (width - ribWidth) / (numRibs - 1);
  const ribPositions = [];
  const firstRibX = -width / 2 + ribWidth / 2;
  for (let i = 0; i < numRibs; i++) {
    ribPositions.push(firstRibX + i * actualRibSpacing);
  }

  // Concrete geometries and material
  const topGeo = React.useMemo(
    () => new THREE.BoxGeometry(width, topThickness, length),
    [width, topThickness, length]
  );
  const ribGeo = React.useMemo(
    () => new THREE.BoxGeometry(ribWidth, ribDepth, length),
    [ribWidth, ribDepth, length]
  );
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const topY = totalDepth / 2 - topThickness / 2;
  const ribY = topY - topThickness / 2 - ribDepth / 2;

  const ribRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    ribPositions.forEach((x, i) => {
      matrix.setPosition(x, ribY, 0);
      ribRef.current.setMatrixAt(i, matrix);
    });
    ribRef.current.instanceMatrix.needsUpdate = true;
  }, [ribPositions, ribY]);

  // Materials
  const mainRebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.mainRebar, wireframe]
  );
  const distMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.distributionBars, wireframe]
  );
  const stirrupMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Bottom bars
  const bottomGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        bottomBarDiameter / 2,
        bottomBarDiameter / 2,
        length,
        8
      ),
    [bottomBarDiameter, length]
  );
  const bottomY = -totalDepth / 2 + cover + bottomBarDiameter / 2;
  const bottomBarSpacing =
    barsPerRib > 1
      ? (ribWidth - 2 * cover - barsPerRib * bottomBarDiameter) /
        (barsPerRib - 1)
      : 0;
  const bottomRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (let ribX of ribPositions) {
      const startOffset = (-(barsPerRib - 1) * bottomBarSpacing) / 2;
      for (let j = 0; j < barsPerRib; j++) {
        const x = ribX + startOffset + j * bottomBarSpacing;
        matrix.setPosition(x, bottomY, 0);
        bottomRef.current.setMatrixAt(index++, matrix);
      }
    }
    bottomRef.current.instanceMatrix.needsUpdate = true;
  }, [ribPositions, barsPerRib, bottomBarSpacing, bottomY]);

  // Mesh bars - longitudinal (along Z)
  const numLongMesh = Math.floor((width - 2 * cover) / meshSpacing) + 1;
  const longMeshSpacing = (width - 2 * cover) / (numLongMesh - 1);
  const longMeshGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        meshBarDiameter / 2,
        meshBarDiameter / 2,
        length,
        8
      ),
    [meshBarDiameter, length]
  );
  const meshY = totalDepth / 2 - cover - meshBarDiameter / 2;
  const longMeshStartX = -width / 2 + cover + meshBarDiameter / 2;
  const longMeshRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < numLongMesh; i++) {
      const x = longMeshStartX + i * longMeshSpacing;
      matrix.setPosition(x, meshY, 0);
      longMeshRef.current.setMatrixAt(i, matrix);
    }
    longMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [numLongMesh, longMeshSpacing, longMeshStartX, meshY]);

  // Mesh bars - transverse (along X)
  const numTransMesh = Math.floor((length - 2 * cover) / meshSpacing) + 1;
  const transMeshSpacing = (length - 2 * cover) / (numTransMesh - 1);
  const transMeshGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(
        meshBarDiameter / 2,
        meshBarDiameter / 2,
        width,
        8
      ),
    [meshBarDiameter, width]
  );
  const transMeshStartZ = -length / 2 + cover + meshBarDiameter / 2;
  const transMeshRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < numTransMesh; i++) {
      const z = transMeshStartZ + i * transMeshSpacing;
      matrix.setPosition(0, meshY, z);
      transMeshRef.current.setMatrixAt(i, matrix);
    }
    transMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [numTransMesh, transMeshSpacing, transMeshStartZ, meshY]);

  // Closed links (stirrups) if enabled
  let stirrupElements = null;
  if (closedLinks) {
    const horizLength = ribWidth - 2 * cover - stirrupDiameter;
    const vertLength = ribDepth - 2 * cover - stirrupDiameter;
    const horizGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          horizLength,
          8
        ),
      [stirrupDiameter, horizLength]
    );
    const vertGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          vertLength,
          8
        ),
      [stirrupDiameter, vertLength]
    );

    const stirrupZ = [];
    for (
      let z = -length / 2 + stirrupSpacing / 2;
      z < length / 2;
      z += stirrupSpacing
    ) {
      stirrupZ.push(z);
    }
    const numPerRib = stirrupZ.length;

    const bottomYStir = -totalDepth / 2 + cover + stirrupDiameter / 2;
    const topYStir = bottomYStir + vertLength;
    const vertYStir = bottomYStir + vertLength / 2;
    const leftX = -horizLength / 2;
    const rightX = horizLength / 2;

    const bottomHorizRef = React.useRef();
    const topHorizRef = React.useRef();
    const vertRef = React.useRef();

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      for (let ribX of ribPositions) {
        for (let z of stirrupZ) {
          matrix.setPosition(ribX, bottomYStir, z);
          bottomHorizRef.current.setMatrixAt(index, matrix);

          matrix.setPosition(ribX, topYStir, z);
          topHorizRef.current.setMatrixAt(index, matrix);
          index++;
        }
      }
      bottomHorizRef.current.instanceMatrix.needsUpdate = true;
      topHorizRef.current.instanceMatrix.needsUpdate = true;
    }, [ribPositions, stirrupZ, bottomYStir, topYStir]);

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      for (let ribX of ribPositions) {
        for (let z of stirrupZ) {
          matrix.setPosition(ribX + leftX, vertYStir, z);
          vertRef.current.setMatrixAt(index++, matrix);

          matrix.setPosition(ribX + rightX, vertYStir, z);
          vertRef.current.setMatrixAt(index++, matrix);
        }
      }
      vertRef.current.instanceMatrix.needsUpdate = true;
    }, [ribPositions, stirrupZ, leftX, rightX, vertYStir]);

    stirrupElements = (
      <>
        <instancedMesh
          ref={bottomHorizRef}
          args={[horizGeo, stirrupMat, numRibs * numPerRib]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={topHorizRef}
          args={[horizGeo, stirrupMat, numRibs * numPerRib]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={vertRef}
          args={[vertGeo, stirrupMat, numRibs * numPerRib * 2]}
        />
      </>
    );
  }

  // Lacing bars if enabled
  let lacingElements = null;
  if (useLacing) {
    const vertLength = ribDepth - 2 * cover - lacingDiameter; // Approximate
    const lacingLength = Math.sqrt(vertLength ** 2 + lacingSpacing ** 2);
    const angle = Math.atan(lacingSpacing / vertLength);
    const lacingGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          lacingDiameter / 2,
          lacingDiameter / 2,
          lacingLength,
          8
        ),
      [lacingDiameter, lacingLength]
    );

    const lacingZ = [];
    for (
      let z = -length / 2 + lacingSpacing / 2;
      z < length / 2;
      z += lacingSpacing
    ) {
      lacingZ.push(z);
    }
    const numLacingPerRib = lacingZ.length;

    const bottomYLace = -totalDepth / 2 + cover + lacingDiameter / 2;
    const vertYLace = bottomYLace + vertLength / 2;

    const lacingRef = React.useRef();
    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      let isPositive = true;
      for (let ribX of ribPositions) {
        isPositive = true;
        for (let z of lacingZ) {
          const dir = isPositive ? 1 : -1;
          const rot = dir * angle;
          const dz = (dir * lacingSpacing) / 2;
          matrix.identity();
          matrix.makeRotationX(rot);
          matrix.scale(1, lacingLength, 1);
          matrix.setPosition(ribX, vertYLace, z + dz);
          lacingRef.current.setMatrixAt(index++, matrix);
          isPositive = !isPositive;
        }
      }
      lacingRef.current.instanceMatrix.needsUpdate = true;
    }, [ribPositions, lacingZ, angle, lacingLength, vertYLace]);

    lacingElements = (
      <instancedMesh
        ref={lacingRef}
        args={[lacingGeo, stirrupMat, numRibs * numLacingPerRib]}
      />
    );
  }

  // Supplementary links if enabled
  let suppElements = null;
  if (useSupplementary) {
    const suppVertLength = 0.12; // Minimum as per detail
    const suppHorizLength =
      barsPerRib === 2 ? bottomBarSpacing + bottomBarDiameter : 0.05;
    const suppHorizGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          supplementaryDiameter / 2,
          supplementaryDiameter / 2,
          suppHorizLength,
          8
        ),
      [supplementaryDiameter, suppHorizLength]
    );
    const suppVertGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          supplementaryDiameter / 2,
          supplementaryDiameter / 2,
          suppVertLength,
          8
        ),
      [supplementaryDiameter, suppVertLength]
    );

    const suppZ = [];
    for (
      let z = -length / 2 + supplementaryPitch / 2;
      z < length / 2;
      z += supplementaryPitch
    ) {
      suppZ.push(z);
    }
    const numSuppPerRib = suppZ.length;

    const suppBottomY =
      bottomY - bottomBarDiameter / 2 - supplementaryDiameter / 2;
    const suppVertY = suppBottomY + suppVertLength / 2;
    const suppLeftX = -suppHorizLength / 2;
    const suppRightX = suppHorizLength / 2;

    const suppHorizRef = React.useRef();
    const suppVertRef = React.useRef();

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      for (let ribX of ribPositions) {
        const offset = barsPerRib === 2 ? 0 : 0; // Centered
        for (let z of suppZ) {
          matrix.setPosition(ribX + offset, suppBottomY, z);
          suppHorizRef.current.setMatrixAt(index++, matrix);
        }
      }
      suppHorizRef.current.instanceMatrix.needsUpdate = true;
    }, [ribPositions, suppZ, suppBottomY]);

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      for (let ribX of ribPositions) {
        const offset = barsPerRib === 2 ? 0 : 0;
        for (let z of suppZ) {
          matrix.setPosition(ribX + offset + suppLeftX, suppVertY, z);
          suppVertRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(ribX + offset + suppRightX, suppVertY, z);
          suppVertRef.current.setMatrixAt(index++, matrix);
        }
      }
      suppVertRef.current.instanceMatrix.needsUpdate = true;
    }, [ribPositions, suppZ, suppLeftX, suppRightX, suppVertY]);

    suppElements = (
      <>
        <instancedMesh
          ref={suppHorizRef}
          args={[suppHorizGeo, stirrupMat, numRibs * numSuppPerRib]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={suppVertRef}
          args={[suppVertGeo, stirrupMat, numRibs * numSuppPerRib * 2]}
        />
      </>
    );
  }

  return (
    <group name="ribbedSlab">
      {showConcrete && (
        <group>
          <mesh
            geometry={topGeo}
            material={concreteMat}
            position={[0, topY, 0]}
          />
          <instancedMesh ref={ribRef} args={[ribGeo, concreteMat, numRibs]} />
        </group>
      )}
      {showRebar && (
        <group name="reinforcement">
          <instancedMesh
            ref={bottomRef}
            args={[bottomGeo, mainRebarMat, numRibs * barsPerRib]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={longMeshRef}
            args={[longMeshGeo, distMat, numLongMesh]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={transMeshRef}
            args={[transMeshGeo, distMat, numTransMesh]}
            rotation={[0, Math.PI / 2, 0]}
          />
          {stirrupElements}
          {lacingElements}
          {suppElements}
        </group>
      )}
    </group>
  );
}

////// Draw Coffered Slab //////////

export function DrawCofferedSlab({
  dimensions = {
    length: 5.0, // Z direction
    width: 5.0, // X direction
    topThickness: 0.075,
    ribDepth: 0.3,
    ribWidthX: 0.125, // Width of ribs along X (transverse ribs)
    ribWidthZ: 0.125, // Width of ribs along Z (longitudinal ribs)
    ribSpacingX: 0.6, // Spacing center-to-center along X
    ribSpacingZ: 0.6, // Spacing center-to-center along Z
    cover: 0.025,
  },
  reinforcement = {
    barDiameterX: 0.016, // Diameter for bars in X-direction ribs
    barDiameterZ: 0.016, // Diameter for bars in Z-direction ribs
    barsPerRibX: 2,
    barsPerRibZ: 2,
    meshDiameter: 0.008,
    meshSpacing: 0.2,
    stirrupDiameter: 0.008,
    stirrupSpacing: 0.15,
    closedLinks: true,
    lacingDiameter: 0.012,
    lacingSpacing: 0.75,
    supplementaryDiameter: 0.006,
    supplementaryPitch: 0.2,
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    width,
    topThickness,
    ribDepth,
    ribWidthX,
    ribWidthZ,
    ribSpacingX,
    ribSpacingZ,
    cover,
  } = dimensions;
  const {
    barDiameterX,
    barDiameterZ,
    barsPerRibX,
    barsPerRibZ,
    meshDiameter,
    meshSpacing,
    stirrupDiameter,
    stirrupSpacing,
    closedLinks,
    lacingDiameter,
    lacingSpacing,
    supplementaryDiameter,
    supplementaryPitch,
  } = reinforcement;

  const totalDepth = topThickness + ribDepth;
  const useLacing = totalDepth > 0.75;
  const useSupplementary = cover > 0.04;

  // Longitudinal ribs (along Z, spaced in X)
  const numRibsZ = Math.floor((width - ribWidthZ) / ribSpacingX) + 1;
  const actualSpacingX =
    numRibsZ > 1 ? (width - ribWidthZ) / (numRibsZ - 1) : 0;
  const ribZPositions = [];
  for (let i = 0; i < numRibsZ; i++) {
    ribZPositions.push(-width / 2 + ribWidthZ / 2 + i * actualSpacingX);
  }

  // Transverse ribs (along X, spaced in Z)
  const numRibsX = Math.floor((length - ribWidthX) / ribSpacingZ) + 1;
  const actualSpacingZ =
    numRibsX > 1 ? (length - ribWidthX) / (numRibsX - 1) : 0;
  const ribXPositions = [];
  for (let i = 0; i < numRibsX; i++) {
    ribXPositions.push(-length / 2 + ribWidthX / 2 + i * actualSpacingZ);
  }

  // Concrete geometries
  const topGeo = React.useMemo(
    () => new THREE.BoxGeometry(width, topThickness, length),
    [width, topThickness, length]
  );
  const ribZGeo = React.useMemo(
    () => new THREE.BoxGeometry(ribWidthZ, ribDepth, length),
    [ribWidthZ, ribDepth, length]
  );
  const ribXGeo = React.useMemo(
    () => new THREE.BoxGeometry(width, ribDepth, ribWidthX),
    [width, ribDepth, ribWidthX]
  );
  const concreteMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );

  const topY = ribDepth / 2 + topThickness / 2;
  const ribY = ribDepth / 2;

  const ribZRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    ribZPositions.forEach((x, i) => {
      matrix.setPosition(x, -ribY, 0);
      ribZRef.current.setMatrixAt(i, matrix);
    });
    ribZRef.current.instanceMatrix.needsUpdate = true;
  }, [ribZPositions, ribY]);

  const ribXRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    ribXPositions.forEach((z, i) => {
      matrix.setPosition(0, -ribY, z);
      ribXRef.current.setMatrixAt(i, matrix);
    });
    ribXRef.current.instanceMatrix.needsUpdate = true;
  }, [ribXPositions, ribY]);

  // Materials
  const mainRebarMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.mainRebar, wireframe]
  );
  const distMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.distributionBars, wireframe]
  );
  const stirrupMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  // Bottom bars for Z-ribs (along Z)
  const barZGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(barDiameterZ / 2, barDiameterZ / 2, length, 8),
    [barDiameterZ, length]
  );
  const bottomY = -totalDepth / 2 + cover + barDiameterZ / 2;
  const barSpacingZ =
    barsPerRibZ > 1
      ? (ribWidthZ - 2 * cover - barDiameterZ) / (barsPerRibZ - 1)
      : 0;
  const barZRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let index = 0;
    ribZPositions.forEach((ribX) => {
      const startOffset = (-(barsPerRibZ - 1) * barSpacingZ) / 2;
      for (let j = 0; j < barsPerRibZ; j++) {
        matrix.setPosition(ribX + startOffset + j * barSpacingZ, bottomY, 0);
        barZRef.current.setMatrixAt(index++, matrix);
      }
    });
    barZRef.current.instanceMatrix.needsUpdate = true;
  }, [ribZPositions, barsPerRibZ, barSpacingZ, bottomY]);

  // Bottom bars for X-ribs (along X)
  const barXGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(barDiameterX / 2, barDiameterX / 2, width, 8),
    [barDiameterX, width]
  );
  const barSpacingX =
    barsPerRibX > 1
      ? (ribWidthX - 2 * cover - barDiameterX) / (barsPerRibX - 1)
      : 0;
  const barXRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let index = 0;
    ribXPositions.forEach((ribZ) => {
      const startOffset = (-(barsPerRibX - 1) * barSpacingX) / 2;
      for (let j = 0; j < barsPerRibX; j++) {
        matrix.setPosition(0, bottomY, ribZ + startOffset + j * barSpacingX);
        barXRef.current.setMatrixAt(index++, matrix);
      }
    });
    barXRef.current.instanceMatrix.needsUpdate = true;
  }, [ribXPositions, barsPerRibX, barSpacingX, bottomY]);

  // Top mesh - longitudinal (along Z)
  const numMeshZ = Math.floor((width - 2 * cover) / meshSpacing) + 1;
  const meshSpacingZ = (width - 2 * cover) / (numMeshZ - 1);
  const meshZGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(meshDiameter / 2, meshDiameter / 2, length, 8),
    [meshDiameter, length]
  );
  const meshY = -ribDepth / 2 + cover + meshDiameter / 2;
  const meshZStartX = -width / 2 + cover + meshDiameter / 2;
  const meshZRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < numMeshZ; i++) {
      matrix.setPosition(meshZStartX + i * meshSpacingZ, meshY, 0);
      meshZRef.current.setMatrixAt(i, matrix);
    }
    meshZRef.current.instanceMatrix.needsUpdate = true;
  }, [numMeshZ, meshSpacingZ, meshZStartX, meshY]);

  // Top mesh - transverse (along X)
  const numMeshX = Math.floor((length - 2 * cover) / meshSpacing) + 1;
  const meshSpacingX = (length - 2 * cover) / (numMeshX - 1);
  const meshXGeo = React.useMemo(
    () =>
      new THREE.CylinderGeometry(meshDiameter / 2, meshDiameter / 2, width, 8),
    [meshDiameter, width]
  );
  const meshXStartZ = -length / 2 + cover + meshDiameter / 2;
  const meshXRef = React.useRef();
  React.useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < numMeshX; i++) {
      matrix.setPosition(0, meshY, meshXStartZ + i * meshSpacingX);
      meshXRef.current.setMatrixAt(i, matrix);
    }
    meshXRef.current.instanceMatrix.needsUpdate = true;
  }, [numMeshX, meshSpacingX, meshXStartZ, meshY]);

  // Closed links (stirrups) if enabled
  let stirrupElements = null;
  if (closedLinks) {
    // For simplicity, add stirrups to both sets of ribs
    // Stirrups for Z-ribs
    const horizLengthZ = ribWidthZ - 2 * cover - stirrupDiameter;
    const vertLength = ribDepth - 2 * cover - stirrupDiameter;
    const horizZGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          horizLengthZ,
          8
        ),
      [stirrupDiameter, horizLengthZ]
    );
    const vertGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          vertLength,
          8
        ),
      [stirrupDiameter, vertLength]
    );

    const stirrupZZ = [];
    for (
      let z = -length / 2 + stirrupSpacing / 2;
      z < length / 2;
      z += stirrupSpacing
    ) {
      stirrupZZ.push(z);
    }
    const numPerRibZ = stirrupZZ.length;

    const bottomYStir = bottomY + barDiameterZ / 2 + stirrupDiameter / 2; // Adjust to be around bars
    const topYStir = bottomYStir + vertLength;
    const vertYStir = bottomYStir + vertLength / 2;
    const leftXZ = -horizLengthZ / 2;
    const rightXZ = horizLengthZ / 2;

    const bottomHorizZRef = React.useRef();
    const topHorizZRef = React.useRef();
    const vertZRef = React.useRef();

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        stirrupZZ.forEach((z) => {
          matrix.setPosition(ribX, bottomYStir, z);
          bottomHorizZRef.current.setMatrixAt(index, matrix);
          matrix.setPosition(ribX, topYStir, z);
          topHorizZRef.current.setMatrixAt(index++, matrix);
        });
      });
      bottomHorizZRef.current.instanceMatrix.needsUpdate = true;
      topHorizZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, stirrupZZ, bottomYStir, topYStir]);

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        stirrupZZ.forEach((z) => {
          matrix.setPosition(ribX + leftXZ, vertYStir, z);
          vertZRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(ribX + rightXZ, vertYStir, z);
          vertZRef.current.setMatrixAt(index++, matrix);
        });
      });
      vertZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, stirrupZZ, leftXZ, rightXZ, vertYStir]);

    // Similar for X-ribs
    const horizLengthX = ribWidthX - 2 * cover - stirrupDiameter;
    const horizXGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          horizLengthX,
          8
        ),
      [stirrupDiameter, horizLengthX]
    );

    const stirrupXX = [];
    for (
      let x = -width / 2 + stirrupSpacing / 2;
      x < width / 2;
      x += stirrupSpacing
    ) {
      stirrupXX.push(x);
    }
    const numPerRibX = stirrupXX.length;

    const leftXX = -horizLengthX / 2;
    const rightXX = horizLengthX / 2;

    const bottomHorizXRef = React.useRef();
    const topHorizXRef = React.useRef();
    const vertXRef = React.useRef();

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribXPositions.forEach((ribZ) => {
        stirrupXX.forEach((x) => {
          matrix.setPosition(x, bottomYStir, ribZ);
          bottomHorizXRef.current.setMatrixAt(index, matrix);
          matrix.setPosition(x, topYStir, ribZ);
          topHorizXRef.current.setMatrixAt(index++, matrix);
        });
      });
      bottomHorizXRef.current.instanceMatrix.needsUpdate = true;
      topHorizXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, stirrupXX, bottomYStir, topYStir]);

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribXPositions.forEach((ribZ) => {
        stirrupXX.forEach((x) => {
          matrix.setPosition(x, vertYStir, ribZ + leftXX);
          vertXRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(x, vertYStir, ribZ + rightXX);
          vertXRef.current.setMatrixAt(index++, matrix);
        });
      });
      vertXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, stirrupXX, leftXX, rightXX, vertYStir]);

    stirrupElements = (
      <>
        <instancedMesh
          ref={bottomHorizZRef}
          args={[horizZGeo, stirrupMat, numRibsZ * numPerRibZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={topHorizZRef}
          args={[horizZGeo, stirrupMat, numRibsZ * numPerRibZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={vertZRef}
          args={[vertGeo, stirrupMat, numRibsZ * numPerRibZ * 2]}
        />
        <instancedMesh
          ref={bottomHorizXRef}
          args={[horizXGeo, stirrupMat, numRibsX * numPerRibX]}
        />
        <instancedMesh
          ref={topHorizXRef}
          args={[horizXGeo, stirrupMat, numRibsX * numPerRibX]}
        />
        <instancedMesh
          ref={vertXRef}
          args={[vertGeo, stirrupMat, numRibsX * numPerRibX * 2]}
          rotation={[0, 0, Math.PI / 2]}
        />
      </>
    );
  }

  // Lacing bars if enabled (diagonal in ribs)
  let lacingElements = null;
  if (useLacing) {
    const vertLength = ribDepth - 2 * cover;
    const lacingLengthZ = Math.sqrt(vertLength ** 2 + lacingSpacing ** 2);
    const angleZ = Math.atan(lacingSpacing / vertLength);
    const lacingZGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          lacingDiameter / 2,
          lacingDiameter / 2,
          lacingLengthZ,
          8
        ),
      [lacingDiameter, lacingLengthZ]
    );

    const lacingZZ = [];
    for (
      let z = -length / 2 + lacingSpacing / 2;
      z < length / 2;
      z += lacingSpacing
    ) {
      lacingZZ.push(z);
    }
    const numLacingPerRibZ = lacingZZ.length;

    const bottomYLace = bottomY + barDiameterZ / 2 + lacingDiameter / 2;
    const vertYLace = bottomYLace + vertLength / 2;

    const lacingZRef = React.useRef();
    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      let isPositive = true;
      ribZPositions.forEach((ribX) => {
        isPositive = true;
        lacingZZ.forEach((z) => {
          const dir = isPositive ? 1 : -1;
          matrix.makeRotationX(dir * angleZ);
          matrix.setPosition(ribX, vertYLace, z + (dir * lacingSpacing) / 2);
          lacingZRef.current.setMatrixAt(index++, matrix);
          isPositive = !isPositive;
        });
      });
      lacingZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, lacingZZ, angleZ, vertYLace, lacingSpacing]);

    // Similar for X-ribs
    const lacingLengthX = lacingLengthZ; // Assume same
    const angleX = angleZ;
    const lacingXGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          lacingDiameter / 2,
          lacingDiameter / 2,
          lacingLengthX,
          8
        ),
      [lacingDiameter, lacingLengthX]
    );

    const lacingXX = [];
    for (
      let x = -width / 2 + lacingSpacing / 2;
      x < width / 2;
      x += lacingSpacing
    ) {
      lacingXX.push(x);
    }
    const numLacingPerRibX = lacingXX.length;

    const lacingXRef = React.useRef();
    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      let isPositive = true;
      ribXPositions.forEach((ribZ) => {
        isPositive = true;
        lacingXX.forEach((x) => {
          const dir = isPositive ? 1 : -1;
          matrix.makeRotationZ(dir * angleX);
          matrix.setPosition(x + (dir * lacingSpacing) / 2, vertYLace, ribZ);
          lacingXRef.current.setMatrixAt(index++, matrix);
          isPositive = !isPositive;
        });
      });
      lacingXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, lacingXX, angleX, vertYLace, lacingSpacing]);

    lacingElements = (
      <>
        <instancedMesh
          ref={lacingZRef}
          args={[lacingZGeo, stirrupMat, numRibsZ * numLacingPerRibZ]}
        />
        <instancedMesh
          ref={lacingXRef}
          args={[lacingXGeo, stirrupMat, numRibsX * numLacingPerRibX]}
        />
      </>
    );
  }

  // Supplementary links if enabled
  let suppElements = null;
  if (useSupplementary) {
    const suppVertLength = 0.12;
    const suppHorizLengthZ = barsPerRibZ > 1 ? barSpacingZ : 0.05;
    const suppHorizZGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          supplementaryDiameter / 2,
          supplementaryDiameter / 2,
          suppHorizLengthZ,
          8
        ),
      [supplementaryDiameter, suppHorizLengthZ]
    );
    const suppVertGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          supplementaryDiameter / 2,
          supplementaryDiameter / 2,
          suppVertLength,
          8
        ),
      [supplementaryDiameter, suppVertLength]
    );

    const suppZZ = [];
    for (
      let z = -length / 2 + supplementaryPitch / 2;
      z < length / 2;
      z += supplementaryPitch
    ) {
      suppZZ.push(z);
    }
    const numSuppPerRibZ = suppZZ.length;

    const suppBottomY = bottomY - barDiameterZ / 2 - supplementaryDiameter / 2;
    const suppVertY = suppBottomY + suppVertLength / 2;
    const suppLeftZ = -suppHorizLengthZ / 2;
    const suppRightZ = suppHorizLengthZ / 2;

    const suppHorizZRef = React.useRef();
    const suppVertZRef = React.useRef();

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        suppZZ.forEach((z) => {
          matrix.setPosition(ribX, suppBottomY, z);
          suppHorizZRef.current.setMatrixAt(index++, matrix);
        });
      });
      suppHorizZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, suppZZ, suppBottomY]);

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        suppZZ.forEach((z) => {
          matrix.setPosition(ribX + suppLeftZ, suppVertY, z);
          suppVertZRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(ribX + suppRightZ, suppVertY, z);
          suppVertZRef.current.setMatrixAt(index++, matrix);
        });
      });
      suppVertZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, suppZZ, suppLeftZ, suppRightZ, suppVertY]);

    // For X-ribs
    const suppHorizLengthX = barsPerRibX > 1 ? barSpacingX : 0.05;
    const suppHorizXGeo = React.useMemo(
      () =>
        new THREE.CylinderGeometry(
          supplementaryDiameter / 2,
          supplementaryDiameter / 2,
          suppHorizLengthX,
          8
        ),
      [supplementaryDiameter, suppHorizLengthX]
    );

    const suppXX = [];
    for (
      let x = -width / 2 + supplementaryPitch / 2;
      x < width / 2;
      x += supplementaryPitch
    ) {
      suppXX.push(x);
    }
    const numSuppPerRibX = suppXX.length;

    const suppLeftX = -suppHorizLengthX / 2;
    const suppRightX = suppHorizLengthX / 2;

    const suppHorizXRef = React.useRef();
    const suppVertXRef = React.useRef();

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribXPositions.forEach((ribZ) => {
        suppXX.forEach((x) => {
          matrix.setPosition(x, suppBottomY, ribZ);
          suppHorizXRef.current.setMatrixAt(index++, matrix);
        });
      });
      suppHorizXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, suppXX, suppBottomY]);

    React.useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribXPositions.forEach((ribZ) => {
        suppXX.forEach((x) => {
          matrix.setPosition(x, suppVertY, ribZ + suppLeftX);
          suppVertXRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(x, suppVertY, ribZ + suppRightX);
          suppVertXRef.current.setMatrixAt(index++, matrix);
        });
      });
      suppVertXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, suppXX, suppLeftX, suppRightX, suppVertY]);

    suppElements = (
      <>
        <instancedMesh
          ref={suppHorizZRef}
          args={[suppHorizZGeo, stirrupMat, numRibsZ * numSuppPerRibZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={suppVertZRef}
          args={[suppVertGeo, stirrupMat, numRibsZ * numSuppPerRibZ * 2]}
        />
        <instancedMesh
          ref={suppHorizXRef}
          args={[suppHorizXGeo, stirrupMat, numRibsX * numSuppPerRibX]}
        />
        <instancedMesh
          ref={suppVertXRef}
          args={[suppVertGeo, stirrupMat, numRibsX * numSuppPerRibX * 2]}
          rotation={[0, 0, Math.PI / 2]}
        />
      </>
    );
  }

  return (
    <group name="cofferedSlab" rotation={[Math.PI, 0, 0]}>
      {" "}
      {/* Rotate to have top up if needed */}
      {showConcrete && (
        <group>
          <mesh
            geometry={topGeo}
            material={concreteMat}
            position={[0, topY, 0]}
          />
          <instancedMesh
            ref={ribZRef}
            args={[ribZGeo, concreteMat, numRibsZ]}
          />
          <instancedMesh
            ref={ribXRef}
            args={[ribXGeo, concreteMat, numRibsX]}
          />
        </group>
      )}
      {showRebar && (
        <group name="reinforcement">
          <instancedMesh
            ref={barZRef}
            args={[barZGeo, mainRebarMat, numRibsZ * barsPerRibZ]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={barXRef}
            args={[barXGeo, mainRebarMat, numRibsX * barsPerRibX]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <instancedMesh
            ref={meshZRef}
            args={[meshZGeo, distMat, numMeshZ]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={meshXRef}
            args={[meshXGeo, distMat, numMeshX]}
            rotation={[0, Math.PI / 2, 0]}
          />
          {stirrupElements}
          {lacingElements}
          {suppElements}
        </group>
      )}
    </group>
  );
}

////// Draw Coffered Slab //////////

export function DrawWaffleSlab({
  dimensions = {
    length: 5.0, // Z direction
    width: 5.0, // X direction
    topThickness: 0.075,
    ribDepth: 0.3,
    ribTopWidth: 0.15, // Top width of trapezoidal rib
    ribBottomWidth: 0.1, // Bottom width of trapezoidal rib
    ribSpacingX: 0.6, // Spacing center-to-center along X for Z-ribs
    ribSpacingZ: 0.6, // Spacing center-to-center along Z for X-ribs
    cover: 0.025,
  },
  reinforcement = {
    barDiameterX: 0.016,
    barDiameterZ: 0.016,
    barsPerRibX: 2,
    barsPerRibZ: 2,
    meshDiameter: 0.008,
    meshSpacing: 0.25, // As per image, every 25 cm
    stirrupDiameter: 0.008,
    stirrupSpacing: 0.15,
    closedLinks: true,
    continuousBottom: false, // Toggle for cut or continuous bottom reinforcement
    verticalReinfDiameter: 0.01, // For continuous case
  },
  colors = {
    concrete: "#a8a8a8",
    mainRebar: "#cc3333",
    stirrups: "#3366cc",
    distributionBars: "#33cc33",
  },
  showConcrete = true,
  showRebar = true,
  wireframe = false,
  opacity = 0.4,
}) {
  const {
    length,
    width,
    topThickness,
    ribDepth,
    ribTopWidth,
    ribBottomWidth,
    ribSpacingX,
    ribSpacingZ,
    cover,
  } = dimensions;
  const {
    barDiameterX,
    barDiameterZ,
    barsPerRibX,
    barsPerRibZ,
    meshDiameter,
    meshSpacing,
    stirrupDiameter,
    stirrupSpacing,
    closedLinks,
    continuousBottom,
    verticalReinfDiameter,
  } = reinforcement;

  const totalDepth = topThickness + ribDepth;

  // Geometries and Materials (always called in same order)
  const ribShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-ribTopWidth / 2, 0);
    shape.lineTo(ribTopWidth / 2, 0);
    shape.lineTo(ribBottomWidth / 2, -ribDepth);
    shape.lineTo(-ribBottomWidth / 2, -ribDepth);
    shape.closePath();
    return shape;
  }, [ribTopWidth, ribBottomWidth, ribDepth]);

  const extrudeSettings = { steps: 1, depth: length, bevelEnabled: false };
  const ribZGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(ribShape, {
        ...extrudeSettings,
        depth: length,
      }),
    [ribShape, length]
  );
  const ribXShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-ribTopWidth / 2, 0);
    shape.lineTo(ribTopWidth / 2, 0);
    shape.lineTo(ribBottomWidth / 2, -ribDepth);
    shape.lineTo(-ribBottomWidth / 2, -ribDepth);
    shape.closePath();
    return shape;
  }, [ribTopWidth, ribBottomWidth, ribDepth]);
  const ribXGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(ribXShape, {
        ...extrudeSettings,
        depth: width,
      }),
    [ribXShape, width]
  );
  const topGeo = useMemo(
    () => new THREE.BoxGeometry(width, topThickness, length),
    [width, topThickness, length]
  );
  const concreteMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity,
        wireframe,
      }),
    [colors.concrete, opacity, wireframe]
  );
  const mainRebarMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.mainRebar,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.mainRebar, wireframe]
  );
  const distMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.distributionBars,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.distributionBars, wireframe]
  );
  const stirrupMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.stirrups,
        metalness: 0.7,
        roughness: 0.3,
        wireframe,
      }),
    [colors.stirrups, wireframe]
  );

  const barLengthZ = continuousBottom ? length : length - 0.5;
  const barZGeo = useMemo(
    () =>
      new THREE.CylinderGeometry(
        barDiameterZ / 2,
        barDiameterZ / 2,
        barLengthZ,
        8
      ),
    [barDiameterZ, barLengthZ]
  );
  const barLengthX = continuousBottom ? width : width - 0.5;
  const barXGeo = useMemo(
    () =>
      new THREE.CylinderGeometry(
        barDiameterX / 2,
        barDiameterX / 2,
        barLengthX,
        8
      ),
    [barDiameterX, barLengthX]
  );
  const meshXGeo = useMemo(
    () =>
      new THREE.CylinderGeometry(meshDiameter / 2, meshDiameter / 2, length, 8),
    [meshDiameter, length]
  );
  const meshZGeo = useMemo(
    () =>
      new THREE.CylinderGeometry(meshDiameter / 2, meshDiameter / 2, width, 8),
    [meshDiameter, width]
  );

  const numMeshX = Math.floor((width - 2 * cover) / meshSpacing) + 1;
  const meshSpacingXActual = (width - 2 * cover) / (numMeshX - 1);
  const numMeshZ = Math.floor((length - 2 * cover) / meshSpacing) + 1;
  const meshSpacingZActual = (length - 2 * cover) / (numMeshZ - 1);

  const topY = totalDepth / 2 - topThickness / 2;
  const ribY = 0; // Since extrude is from 0 down
  const bottomY = -totalDepth / 2 + cover + barDiameterZ / 2;
  const barSpacingZ =
    barsPerRibZ > 1 ? (ribBottomWidth - 2 * cover) / (barsPerRibZ - 1) : 0;
  const barSpacingX =
    barsPerRibX > 1 ? (ribBottomWidth - 2 * cover) / (barsPerRibX - 1) : 0;
  const meshY =
    -ribDepth / 2 - topThickness / 2 + topThickness - cover - meshDiameter / 2;
  const meshXStart = -width / 2 + cover + meshDiameter / 2;
  const meshZStart = -length / 2 + cover + meshDiameter / 2;

  // Rib positions
  const numRibsZ = Math.floor((width - ribTopWidth) / ribSpacingX) + 1;
  const actualSpacingX =
    numRibsZ > 1 ? (width - ribTopWidth) / (numRibsZ - 1) : 0;
  const ribZPositions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < numRibsZ; i++) {
      positions.push(-width / 2 + ribTopWidth / 2 + i * actualSpacingX);
    }
    return positions;
  }, [width, ribTopWidth, ribSpacingX, numRibsZ]);

  const numRibsX = Math.floor((length - ribTopWidth) / ribSpacingZ) + 1;
  const actualSpacingZ =
    numRibsX > 1 ? (length - ribTopWidth) / (numRibsX - 1) : 0;
  const ribXPositions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < numRibsX; i++) {
      positions.push(-length / 2 + ribTopWidth / 2 + i * actualSpacingZ);
    }
    return positions;
  }, [length, ribTopWidth, ribSpacingZ, numRibsX]);

  // Refs
  const ribZRef = useRef();
  const ribXRef = useRef();
  const barZRef = useRef();
  const barXRef = useRef();
  const meshXRef = useRef();
  const meshZRef = useRef();

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    ribZPositions.forEach((x, i) => {
      matrix.setPosition(x, -ribDepth / 2 - topThickness / 2, 0);
      ribZRef.current.setMatrixAt(i, matrix);
    });
    ribZRef.current.instanceMatrix.needsUpdate = true;
  }, [ribZPositions]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    ribXPositions.forEach((z, i) => {
      matrix.setPosition(0, -ribDepth / 2 - topThickness / 2, z);
      ribXRef.current.setMatrixAt(i, matrix);
    });
    ribXRef.current.instanceMatrix.needsUpdate = true;
  }, [ribXPositions]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let index = 0;
    ribZPositions.forEach((ribX) => {
      const startOffset = (-(barsPerRibZ - 1) * barSpacingZ) / 2;
      for (let j = 0; j < barsPerRibZ; j++) {
        matrix.setPosition(
          ribX + startOffset + j * barSpacingZ,
          bottomY,
          continuousBottom ? 0 : 0.25
        );
        barZRef.current.setMatrixAt(index++, matrix);
      }
    });
    barZRef.current.instanceMatrix.needsUpdate = true;
  }, [ribZPositions, barsPerRibZ, barSpacingZ, bottomY, continuousBottom]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    let index = 0;
    ribXPositions.forEach((ribZ) => {
      const startOffset = (-(barsPerRibX - 1) * barSpacingX) / 2;
      for (let j = 0; j < barsPerRibX; j++) {
        matrix.setPosition(
          continuousBottom ? 0 : 0.25,
          bottomY,
          ribZ + startOffset + j * barSpacingX
        );
        barXRef.current.setMatrixAt(index++, matrix);
      }
    });
    barXRef.current.instanceMatrix.needsUpdate = true;
  }, [ribXPositions, barsPerRibX, barSpacingX, bottomY, continuousBottom]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < numMeshX; i++) {
      matrix.setPosition(meshXStart + i * meshSpacingXActual, meshY, 0);
      meshXRef.current.setMatrixAt(i, matrix);
    }
    meshXRef.current.instanceMatrix.needsUpdate = true;
  }, [numMeshX, meshSpacingXActual, meshXStart, meshY]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < numMeshZ; i++) {
      matrix.setPosition(0, meshY, meshZStart + i * meshSpacingZActual);
      meshZRef.current.setMatrixAt(i, matrix);
    }
    meshZRef.current.instanceMatrix.needsUpdate = true;
  }, [numMeshZ, meshSpacingZActual, meshZStart, meshY]);

  // Stirrup elements
  let stirrupElements = null;
  if (closedLinks) {
    const avgRibWidth = (ribTopWidth + ribBottomWidth) / 2;
    const horizLength = avgRibWidth - 2 * cover - stirrupDiameter;
    const vertLength = ribDepth - 2 * cover - stirrupDiameter;
    const horizGeo = useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          horizLength,
          8
        ),
      [stirrupDiameter, horizLength]
    );
    const vertGeo = useMemo(
      () =>
        new THREE.CylinderGeometry(
          stirrupDiameter / 2,
          stirrupDiameter / 2,
          vertLength,
          8
        ),
      [stirrupDiameter, vertLength]
    );

    const stirrupPositionsZ = useMemo(() => {
      const positions = [];
      for (
        let z = -length / 2 + stirrupSpacing / 2;
        z < length / 2;
        z += stirrupSpacing
      ) {
        positions.push(z);
      }
      return positions;
    }, [length, stirrupSpacing]);
    const numPerRibZ = stirrupPositionsZ.length;

    const stirrupPositionsX = useMemo(() => {
      const positions = [];
      for (
        let x = -width / 2 + stirrupSpacing / 2;
        x < width / 2;
        x += stirrupSpacing
      ) {
        positions.push(x);
      }
      return positions;
    }, [width, stirrupSpacing]);
    const numPerRibX = stirrupPositionsX.length;

    const bottomYStir = bottomY + barDiameterZ / 2 + stirrupDiameter / 2;
    const topYStir = bottomYStir + vertLength;
    const vertYStir = bottomYStir + vertLength / 2;
    const leftX = -horizLength / 2;
    const rightX = horizLength / 2;

    const bottomHorizZRef = useRef();
    const topHorizZRef = useRef();
    const vertZRef = useRef();
    const bottomHorizXRef = useRef();
    const topHorizXRef = useRef();
    const vertXRef = useRef();

    useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        stirrupPositionsZ.forEach((z) => {
          matrix.setPosition(ribX, bottomYStir, z);
          bottomHorizZRef.current.setMatrixAt(index, matrix);
          matrix.setPosition(ribX, topYStir, z);
          topHorizZRef.current.setMatrixAt(index++, matrix);
        });
      });
      bottomHorizZRef.current.instanceMatrix.needsUpdate = true;
      topHorizZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, stirrupPositionsZ, bottomYStir, topYStir]);

    useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        stirrupPositionsZ.forEach((z) => {
          matrix.setPosition(ribX + leftX, vertYStir, z);
          vertZRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(ribX + rightX, vertYStir, z);
          vertZRef.current.setMatrixAt(index++, matrix);
        });
      });
      vertZRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, stirrupPositionsZ, leftX, rightX, vertYStir]);

    useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribXPositions.forEach((ribZ) => {
        stirrupPositionsX.forEach((x) => {
          matrix.setPosition(x, bottomYStir, ribZ);
          bottomHorizXRef.current.setMatrixAt(index, matrix);
          matrix.setPosition(x, topYStir, ribZ);
          topHorizXRef.current.setMatrixAt(index++, matrix);
        });
      });
      bottomHorizXRef.current.instanceMatrix.needsUpdate = true;
      topHorizXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, stirrupPositionsX, bottomYStir, topYStir]);

    useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribXPositions.forEach((ribZ) => {
        stirrupPositionsX.forEach((x) => {
          matrix.setPosition(x, vertYStir, ribZ + leftX);
          vertXRef.current.setMatrixAt(index++, matrix);
          matrix.setPosition(x, vertYStir, ribZ + rightX);
          vertXRef.current.setMatrixAt(index++, matrix);
        });
      });
      vertXRef.current.instanceMatrix.needsUpdate = true;
    }, [ribXPositions, stirrupPositionsX, leftX, rightX, vertYStir]);

    stirrupElements = (
      <>
        <instancedMesh
          ref={bottomHorizZRef}
          args={[horizGeo, stirrupMat, numRibsZ * numPerRibZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={topHorizZRef}
          args={[horizGeo, stirrupMat, numRibsZ * numPerRibZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <instancedMesh
          ref={vertZRef}
          args={[vertGeo, stirrupMat, numRibsZ * numPerRibZ * 2]}
        />
        <instancedMesh
          ref={bottomHorizXRef}
          args={[horizGeo, stirrupMat, numRibsX * numPerRibX]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <instancedMesh
          ref={topHorizXRef}
          args={[horizGeo, stirrupMat, numRibsX * numPerRibX]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <instancedMesh
          ref={vertXRef}
          args={[vertGeo, stirrupMat, numRibsX * numPerRibX * 2]}
          rotation={[0, 0, Math.PI / 2]}
        />
      </>
    );
  }

  // Vertical reinforcement if continuous
  let verticalElements = null;
  if (continuousBottom) {
    const verticalGeo = useMemo(
      () =>
        new THREE.CylinderGeometry(
          verticalReinfDiameter / 2,
          verticalReinfDiameter / 2,
          ribDepth,
          8
        ),
      [verticalReinfDiameter, ribDepth]
    );
    const verticalRef = useRef();
    const verticalY = bottomY + ribDepth / 2;
    useLayoutEffect(() => {
      const matrix = new THREE.Matrix4();
      let index = 0;
      ribZPositions.forEach((ribX) => {
        matrix.setPosition(ribX, verticalY, -length / 2);
        verticalRef.current.setMatrixAt(index++, matrix);
        matrix.setPosition(ribX, verticalY, length / 2);
        verticalRef.current.setMatrixAt(index++, matrix);
      });
      ribXPositions.forEach((ribZ) => {
        matrix.setPosition(-width / 2, verticalY, ribZ);
        verticalRef.current.setMatrixAt(index++, matrix);
        matrix.setPosition(width / 2, verticalY, ribZ);
        verticalRef.current.setMatrixAt(index++, matrix);
      });
      verticalRef.current.instanceMatrix.needsUpdate = true;
    }, [ribZPositions, ribXPositions, verticalY, length, width]);
    verticalElements = (
      <instancedMesh
        ref={verticalRef}
        args={[verticalGeo, mainRebarMat, (numRibsZ + numRibsX) * 2]}
      />
    );
  }

  return (
    <group name="waffleSlab">
      {showConcrete && (
        <group>
          <mesh
            geometry={topGeo}
            material={concreteMat}
            position={[0, topY - totalDepth / 2 + topThickness / 2, 0]}
          />
          <instancedMesh
            ref={ribZRef}
            args={[ribZGeo, concreteMat, numRibsZ]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <instancedMesh
            ref={ribXRef}
            args={[ribXGeo, concreteMat, numRibsX]}
          />
        </group>
      )}
      {showRebar && (
        <group name="reinforcement">
          <instancedMesh
            ref={barZRef}
            args={[barZGeo, mainRebarMat, numRibsZ * barsPerRibZ]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={barXRef}
            args={[barXGeo, mainRebarMat, numRibsX * barsPerRibX]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <instancedMesh
            ref={meshXRef}
            args={[meshXGeo, distMat, numMeshX]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <instancedMesh
            ref={meshZRef}
            args={[meshZGeo, distMat, numMeshZ]}
            rotation={[0, Math.PI / 2, 0]}
          />
          {stirrupElements}
          {verticalElements}
        </group>
      )}
    </group>
  );
}

/////draw waffle slab ///////////
