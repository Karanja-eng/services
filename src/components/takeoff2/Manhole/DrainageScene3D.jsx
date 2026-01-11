import React, { useRef, useMemo } from "react";
import * as THREE from "three";

const DrainageScene3D = ({ projectData, calculationResults }) => {
  const groupRef = useRef();

  // Color scheme
  const colors = {
    ground: 0x8b7355,
    concrete: 0xa9a9a9,
    steel: 0x708090,
    pipe_upvc: 0xff8c00,
    pipe_pcc: 0x696969,
    excavation: 0xd2691e,
    water: 0x4682b4,
    house: 0xdeb887,
    manhole_cover: 0x2f4f4f,
    benching: 0xc0c0c0,
    rock: 0x654321,
  };

  // Helper function to create manhole geometry
  const createManhole = (mh, result) => {
    const components = [];
    const groundLevel = mh.ground_level;
    const invertLevel = mh.invert_level;
    const depth = groundLevel - invertLevel;

    // Determine dimensions
    let intL, intW, intDiam;
    if (mh.type === "circ") {
      intDiam = mh.internal_diameter;
      intL = intW = intDiam;
    } else {
      intL = mh.internal_length;
      intW = mh.internal_width;
      intDiam = 0;
    }

    const wallThick = mh.wall_thickness;
    const bedThick = mh.bed_thickness;
    const slabThick = mh.slab_thickness;

    // Position at ground level
    const posX = mh.position_x;
    const posZ = mh.position_y;
    const posY = groundLevel;

    // 1. Concrete Bed
    if (mh.type === "circ") {
      const bedGeom = new THREE.CylinderGeometry(
        intDiam / 2 + wallThick,
        intDiam / 2 + wallThick,
        bedThick,
        32
      );
      const bedMat = new THREE.MeshStandardMaterial({ color: colors.concrete });
      const bed = new THREE.Mesh(bedGeom, bedMat);
      bed.position.set(posX, invertLevel + bedThick / 2, posZ);
      components.push(bed);
    } else {
      const extL = intL + 2 * wallThick;
      const extW = intW + 2 * wallThick;
      const bedGeom = new THREE.BoxGeometry(extL, bedThick, extW);
      const bedMat = new THREE.MeshStandardMaterial({ color: colors.concrete });
      const bed = new THREE.Mesh(bedGeom, bedMat);
      bed.position.set(posX, invertLevel + bedThick / 2, posZ);
      components.push(bed);
    }

    // 2. Walls
    const wallHeight = depth - slabThick;
    const wallY = invertLevel + bedThick + wallHeight / 2;

    if (mh.type === "circ") {
      // Circular wall
      const outerRad = intDiam / 2 + wallThick;
      const innerRad = intDiam / 2;
      const wallGeom = new THREE.CylinderGeometry(
        outerRad,
        outerRad,
        wallHeight,
        32
      );
      const holeGeom = new THREE.CylinderGeometry(
        innerRad,
        innerRad,
        wallHeight + 0.1,
        32
      );

      const wallMesh = new THREE.Mesh(
        wallGeom,
        new THREE.MeshStandardMaterial({ color: colors.concrete })
      );
      wallMesh.position.set(posX, wallY, posZ);
      components.push(wallMesh);
    } else {
      // Rectangular walls - four sides
      const extL = intL + 2 * wallThick;
      const extW = intW + 2 * wallThick;

      // Front and back walls
      const wallFBGeom = new THREE.BoxGeometry(extL, wallHeight, wallThick);
      const wallMat = new THREE.MeshStandardMaterial({
        color: colors.concrete,
      });

      const wallFront = new THREE.Mesh(wallFBGeom, wallMat);
      wallFront.position.set(posX, wallY, posZ + extW / 2 - wallThick / 2);
      components.push(wallFront);

      const wallBack = new THREE.Mesh(wallFBGeom, wallMat);
      wallBack.position.set(posX, wallY, posZ - extW / 2 + wallThick / 2);
      components.push(wallBack);

      // Left and right walls
      const wallLRGeom = new THREE.BoxGeometry(wallThick, wallHeight, intW);
      const wallLeft = new THREE.Mesh(wallLRGeom, wallMat);
      wallLeft.position.set(posX - extL / 2 + wallThick / 2, wallY, posZ);
      components.push(wallLeft);

      const wallRight = new THREE.Mesh(wallLRGeom, wallMat);
      wallRight.position.set(posX + extL / 2 - wallThick / 2, wallY, posZ);
      components.push(wallRight);
    }

    // 3. Benching (if present)
    if (mh.has_benching) {
      const benchH = mh.benching_avg_height;
      const benchY = invertLevel + bedThick + benchH / 2;

      if (mh.type === "circ") {
        const benchGeom = new THREE.CylinderGeometry(
          intDiam / 2,
          intDiam / 2,
          benchH,
          32
        );
        const benchMat = new THREE.MeshStandardMaterial({
          color: colors.benching,
        });
        const bench = new THREE.Mesh(benchGeom, benchMat);
        bench.position.set(posX, benchY, posZ);
        components.push(bench);
      } else {
        const benchGeom = new THREE.BoxGeometry(intL * 0.9, benchH, intW * 0.9);
        const benchMat = new THREE.MeshStandardMaterial({
          color: colors.benching,
        });
        const bench = new THREE.Mesh(benchGeom, benchMat);
        bench.position.set(posX, benchY, posZ);
        components.push(bench);
      }
    }

    // 4. Channel (simplified as a groove)
    if (mh.has_channel) {
      const channelWidth = 0.15;
      const channelDepth = 0.1;
      const channelLen = mh.channel_length || intL;
      const channelGeom = new THREE.BoxGeometry(
        channelLen,
        channelDepth,
        channelWidth
      );
      const channelMat = new THREE.MeshStandardMaterial({
        color: colors.concrete,
      });
      const channel = new THREE.Mesh(channelGeom, channelMat);
      const channelY =
        invertLevel +
        bedThick +
        (mh.has_benching ? mh.benching_avg_height : 0) +
        channelDepth / 2;
      channel.position.set(posX, channelY, posZ);
      components.push(channel);
    }

    // 5. Top Slab
    const slabY = groundLevel - slabThick / 2;
    if (mh.type === "circ") {
      const extDiam = intDiam + 2 * wallThick;
      const slabGeom = new THREE.CylinderGeometry(
        extDiam / 2,
        extDiam / 2,
        slabThick,
        32
      );
      const slabMat = new THREE.MeshStandardMaterial({
        color: colors.concrete,
      });
      const slab = new THREE.Mesh(slabGeom, slabMat);
      slab.position.set(posX, slabY, posZ);
      components.push(slab);
    } else {
      const extL = intL + 2 * wallThick;
      const extW = intW + 2 * wallThick;
      const slabGeom = new THREE.BoxGeometry(extL, slabThick, extW);
      const slabMat = new THREE.MeshStandardMaterial({
        color: colors.concrete,
      });
      const slab = new THREE.Mesh(slabGeom, slabMat);
      slab.position.set(posX, slabY, posZ);
      components.push(slab);
    }

    // 6. Manhole Cover
    const coverGeom = new THREE.BoxGeometry(
      mh.cover_length,
      0.05,
      mh.cover_width
    );
    const coverMat = new THREE.MeshStandardMaterial({
      color: colors.manhole_cover,
      metalness: 0.8,
      roughness: 0.3,
    });
    const cover = new THREE.Mesh(coverGeom, coverMat);
    cover.position.set(posX, groundLevel + 0.025, posZ);
    components.push(cover);

    // 7. Step Irons (if depth > 1m)
    if (mh.has_step_irons && depth > 1.0) {
      const numSteps = Math.ceil((depth - 0.45) / 0.3);
      const stepGeom = new THREE.BoxGeometry(0.3, 0.02, 0.05);
      const stepMat = new THREE.MeshStandardMaterial({
        color: colors.steel,
        metalness: 0.9,
      });

      for (let i = 0; i < numSteps; i++) {
        const stepY = groundLevel - 0.45 - i * 0.3;
        const step = new THREE.Mesh(stepGeom, stepMat);
        const offsetX = mh.type === "circ" ? intDiam / 2 : intL / 2 - 0.1;
        step.position.set(posX + offsetX, stepY, posZ);
        components.push(step);
      }
    }

    // 8. Excavation outline (wireframe)
    const excProjThick = mh.projection_thickness || 0.1;
    const excExtL = intL + 2 * (wallThick + excProjThick);
    const excExtW = intW + 2 * (wallThick + excProjThick);
    const excDepth = depth + bedThick;

    const excGeom = new THREE.BoxGeometry(excExtL, excDepth, excExtW);
    const excEdges = new THREE.EdgesGeometry(excGeom);
    const excLine = new THREE.LineSegments(
      excEdges,
      new THREE.LineBasicMaterial({ color: colors.excavation, linewidth: 2 })
    );
    excLine.position.set(posX, invertLevel + excDepth / 2, posZ);
    components.push(excLine);

    // Add label
    const label = createTextSprite(mh.id, 0.5);
    label.position.set(posX, groundLevel + 0.5, posZ);
    components.push(label);

    return components;
  };

  // Helper function to create pipe geometry
  const createPipe = (pipe, manholes) => {
    const components = [];

    // Find start and end positions
    const fromMH = manholes.find((m) => m.id === pipe.from_point);
    const toMH = manholes.find((m) => m.id === pipe.to_point);

    if (!fromMH && !toMH) return components; // Need at least one manhole

    // Determine start and end positions
    let startX, startY, startZ, endX, endY, endZ;

    if (fromMH) {
      startX = fromMH.position_x;
      startZ = fromMH.position_y;
      startY = fromMH.invert_level;
    } else {
      // From house - offset from first manhole
      startX = toMH.position_x - pipe.length;
      startZ = toMH.position_y;
      startY = toMH.invert_level + (pipe.length * pipe.gradient) / 100;
    }

    if (toMH) {
      endX = toMH.position_x;
      endZ = toMH.position_y;
      endY = toMH.invert_level;
    } else {
      // To next point
      endX = fromMH.position_x + pipe.length;
      endZ = fromMH.position_y;
      endY = fromMH.invert_level - (pipe.length * pipe.gradient) / 100;
    }

    const length = Math.sqrt(
      Math.pow(endX - startX, 2) +
      Math.pow(endY - startY, 2) +
      Math.pow(endZ - startZ, 2)
    );

    const diam = (pipe.diameter_mm || 150) / 1000;

    // Create pipe
    const pipeGeom = new THREE.CylinderGeometry(diam / 2, diam / 2, length, 16);
    const pipeColor = pipe.pipe_material?.toLowerCase().includes("pvc")
      ? colors.pipe_upvc
      : colors.pipe_pcc;
    const pipeMat = new THREE.MeshStandardMaterial({ color: pipeColor });
    const pipeMesh = new THREE.Mesh(pipeGeom, pipeMat);

    // Position and rotate pipe
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const midZ = (startZ + endZ) / 2;
    pipeMesh.position.set(midX, midY, midZ);

    // Calculate rotation
    const direction = new THREE.Vector3(
      endX - startX,
      endY - startY,
      endZ - startZ
    ).normalize();
    const axis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      axis,
      direction
    );
    pipeMesh.setRotationFromQuaternion(quaternion);

    components.push(pipeMesh);

    // Bedding visualization (simplified)
    if (
      pipe.bedding_type === "concrete_surround" ||
      pipe.bedding_type === "concrete_bed"
    ) {
      const beddingDiam = diam + 2 * 0.15;
      const beddingGeom = new THREE.CylinderGeometry(
        beddingDiam / 2,
        beddingDiam / 2,
        length,
        16
      );
      const beddingMat = new THREE.MeshStandardMaterial({
        color: colors.concrete,
        transparent: true,
        opacity: 0.5,
      });
      const beddingMesh = new THREE.Mesh(beddingGeom, beddingMat);
      beddingMesh.position.copy(pipeMesh.position);
      beddingMesh.setRotationFromQuaternion(quaternion);
      components.push(beddingMesh);
    }

    // Trench outline
    const trenchWidth = pipe.trench_width;
    const avgDepth = (pipe.trench_depth_start + pipe.trench_depth_end) / 2;
    const trenchPath = new THREE.LineCurve3(
      new THREE.Vector3(startX, startY, startZ),
      new THREE.Vector3(endX, endY, endZ)
    );
    const trenchGeom = new THREE.TubeGeometry(
      trenchPath,
      8,
      trenchWidth / 2,
      8,
      false
    );
    const trenchEdges = new THREE.EdgesGeometry(trenchGeom);
    const trenchLine = new THREE.LineSegments(
      trenchEdges,
      new THREE.LineBasicMaterial({ color: colors.excavation, linewidth: 1 })
    );
    components.push(trenchLine);

    return components;
  };

  // Create text sprite for labels
  const createTextSprite = (text, scale = 1) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 256;
    canvas.height = 128;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = "Bold 48px Arial";
    context.fillStyle = "#000000";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(scale * 2, scale, 1);

    return sprite;
  };

  // Create house placeholder
  const createHouse = (x, z, groundLevel) => {
    const components = [];

    // House base
    const houseGeom = new THREE.BoxGeometry(4, 3, 5);
    const houseMat = new THREE.MeshStandardMaterial({ color: colors.house });
    const house = new THREE.Mesh(houseGeom, houseMat);
    house.position.set(x, groundLevel + 1.5, z);
    components.push(house);

    // Roof
    const roofGeom = new THREE.ConeGeometry(3.5, 2, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(x, groundLevel + 4, z);
    roof.rotation.y = Math.PI / 4;
    components.push(roof);

    return components;
  };

  // Build the scene
  const sceneComponents = useMemo(() => {
    if (!projectData || !calculationResults) return [];

    const components = [];
    const manholes = projectData.manholes || [];
    const pipes = projectData.pipes || [];

    // Create ground plane
    const groundSize = 100;
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: colors.ground,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    components.push(ground);

    // Create grid
    const gridHelper = new THREE.GridHelper(groundSize, 20, 0x444444, 0x888888);
    gridHelper.position.y = 0.01;
    components.push(gridHelper);

    // Create manholes
    manholes.forEach((mh, idx) => {
      const mhResult = calculationResults.manholes?.[idx];
      const mhComponents = createManhole(mh, mhResult);
      components.push(...mhComponents);
    });

    // Create pipes
    pipes.forEach((pipe) => {
      const pipeComponents = createPipe(pipe, manholes);
      components.push(...pipeComponents);
    });

    // Create house placeholders for pipes starting from houses
    const housePipes = pipes.filter((p) =>
      p.from_point?.toLowerCase().includes("house")
    );
    housePipes.forEach((pipe, idx) => {
      const toMH = manholes.find((m) => m.id === pipe.to_point);
      if (toMH) {
        const houseX = toMH.position_x - pipe.length - 5;
        const houseZ = toMH.position_y + idx * 10;
        const houseComponents = createHouse(houseX, houseZ, toMH.ground_level);
        components.push(...houseComponents);
      }
    });

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    components.push(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    components.push(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, 15, -10);
    components.push(directionalLight2);

    return components;
  }, [projectData, calculationResults]);

  return (
    <group ref={groupRef}>
      {sceneComponents.map((component, idx) => {
        if (
          component instanceof THREE.Mesh ||
          component instanceof THREE.LineSegments ||
          component instanceof THREE.Sprite ||
          component instanceof THREE.Light ||
          component instanceof THREE.GridHelper
        ) {
          return <primitive key={idx} object={component} />;
        }
        return null;
      })}
    </group>
  );
};

export default DrainageScene3D;
