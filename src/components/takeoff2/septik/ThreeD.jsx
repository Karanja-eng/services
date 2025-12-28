import React, { useRef, useEffect, useState, Suspense } from 'react';
import * as THREE from 'three';

// 3D Visualization for Septic Tank, Manhole, and Soakpit System
export const SepticSystem3DView = ({ config, darkMode = false }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('full'); // 'full', 'section', 'exploded'

    // Default configuration
    const defaultConfig = {
        septicTank: {
            intL: 3.0,
            intW: 2.5,
            depth: 2.0,
            wallThick: 0.2,
            slabThick: 0.2,
            bedThick: 0.15,
            numBaffles: 2,
            baffleThick: 0.2,
            baffleHeights: [1.5, 1.3],
            floorSlope: 0 // 0 for flat, angle in degrees for sloped
        },
        manhole: {
            intL: 0.7,
            intW: 0.6,
            depth: 0.7,
            wallThick: 0.2,
            coverL: 0.6,
            coverW: 0.45,
            position: [4.5, 0, 0] // x, y, z position relative to septic tank
        },
        soakpit: {
            diameter: 2.0,
            depth: 3.0,
            wallThick: 0.23,
            shape: 'circular', // 'circular' or 'rectangular'
            position: [8, 0, 0] // position relative to septic tank
        },
        connections: {
            septicToManhole: true,
            manholeToSoakpit: true,
            pipeDiameter: 0.15
        }
    };

    const cfg = { ...defaultConfig, ...config };

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(darkMode ? 0x1e293b : 0xe2e8f0);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
            60,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(10, 8, 10);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, 10, -10);
        scene.add(fillLight);

        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: darkMode ? 0x374151 : 0xa8a29e,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        scene.add(ground);

        // Grid helper
        const gridHelper = new THREE.GridHelper(30, 30, 0x888888, 0x444444);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        // Materials
        const concreteMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b9098,
            roughness: 0.7,
            metalness: 0.1
        });

        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.5,
            roughness: 0.1,
            metalness: 0.1
        });

        const soilMaterial = new THREE.MeshStandardMaterial({
            color: 0x92400e,
            roughness: 0.9,
            metalness: 0
        });

        const pipeMaterial = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.5,
            metalness: 0.3
        });

        // Build Septic Tank
        const buildSepticTank = () => {
            const group = new THREE.Group();
            const st = cfg.septicTank;
            const extL = st.intL + 2 * st.wallThick;
            const extW = st.intW + 2 * st.wallThick;

            // Base/Bed
            const bedGeometry = new THREE.BoxGeometry(extL, st.bedThick, extW);
            const bed = new THREE.Mesh(bedGeometry, concreteMaterial);
            bed.position.y = st.bedThick / 2;
            bed.castShadow = true;
            bed.receiveShadow = true;
            group.add(bed);

            // Walls
            // Front wall
            const frontWall = new THREE.BoxGeometry(extL, st.depth, st.wallThick);
            const fWall = new THREE.Mesh(frontWall, concreteMaterial);
            fWall.position.set(0, st.bedThick + st.depth / 2, -extW / 2 + st.wallThick / 2);
            fWall.castShadow = true;
            group.add(fWall);

            // Back wall
            const bWall = new THREE.Mesh(frontWall, concreteMaterial);
            bWall.position.set(0, st.bedThick + st.depth / 2, extW / 2 - st.wallThick / 2);
            bWall.castShadow = true;
            group.add(bWall);

            // Left wall
            const sideWall = new THREE.BoxGeometry(st.wallThick, st.depth, extW);
            const lWall = new THREE.Mesh(sideWall, concreteMaterial);
            lWall.position.set(-extL / 2 + st.wallThick / 2, st.bedThick + st.depth / 2, 0);
            lWall.castShadow = true;
            group.add(lWall);

            // Right wall
            const rWall = new THREE.Mesh(sideWall, concreteMaterial);
            rWall.position.set(extL / 2 - st.wallThick / 2, st.bedThick + st.depth / 2, 0);
            rWall.castShadow = true;
            group.add(rWall);

            // Baffles
            for (let i = 0; i < st.numBaffles; i++) {
                const spacing = st.intL / (st.numBaffles + 1);
                const baffleX = -st.intL / 2 + spacing * (i + 1);
                const baffleH = st.baffleHeights[i] || 1.5;

                const baffleGeometry = new THREE.BoxGeometry(st.baffleThick, baffleH, st.intW);
                const baffle = new THREE.Mesh(baffleGeometry, concreteMaterial);
                baffle.position.set(baffleX, st.bedThick + baffleH / 2, 0);
                baffle.castShadow = true;
                group.add(baffle);
            }

            // Water
            const waterLevel = st.depth * 0.8; // 80% fill
            const waterGeometry = new THREE.BoxGeometry(st.intL, waterLevel, st.intW);
            const water = new THREE.Mesh(waterGeometry, waterMaterial);
            water.position.set(0, st.bedThick + waterLevel / 2, 0);
            group.add(water);

            // Top slab
            const slabGeometry = new THREE.BoxGeometry(extL, st.slabThick, extW);
            const slab = new THREE.Mesh(slabGeometry, concreteMaterial);
            slab.position.y = st.bedThick + st.depth + st.slabThick / 2;
            slab.castShadow = true;
            group.add(slab);

            // Manhole opening in slab
            const openingGeometry = new THREE.BoxGeometry(0.6, st.slabThick + 0.01, 0.45);
            const opening = new THREE.Mesh(openingGeometry, new THREE.MeshBasicMaterial({ color: 0x000000 }));
            opening.position.y = st.bedThick + st.depth + st.slabThick / 2;
            group.add(opening);

            // Inlet pipe
            const inletPipeGeometry = new THREE.CylinderGeometry(
                cfg.connections.pipeDiameter / 2,
                cfg.connections.pipeDiameter / 2,
                1.0,
                16
            );
            const inletPipe = new THREE.Mesh(inletPipeGeometry, pipeMaterial);
            inletPipe.rotation.z = Math.PI / 2;
            inletPipe.position.set(-extL / 2 - 0.5, st.bedThick + st.depth * 0.7, 0);
            group.add(inletPipe);

            // Outlet pipe
            const outletPipe = new THREE.Mesh(inletPipeGeometry, pipeMaterial);
            outletPipe.rotation.z = Math.PI / 2;
            outletPipe.position.set(extL / 2 + 0.5, st.bedThick + st.depth * 0.6, 0);
            group.add(outletPipe);

            return group;
        };

        // Build Manhole
        const buildManhole = () => {
            const group = new THREE.Group();
            const mh = cfg.manhole;
            const extL = mh.intL + 2 * mh.wallThick;
            const extW = mh.intW + 2 * mh.wallThick;

            // Base
            const baseGeometry = new THREE.BoxGeometry(extL, 0.15, extW);
            const base = new THREE.Mesh(baseGeometry, concreteMaterial);
            base.position.y = 0.075;
            base.castShadow = true;
            group.add(base);

            // Walls
            const frontWall = new THREE.BoxGeometry(extL, mh.depth, mh.wallThick);
            const fWall = new THREE.Mesh(frontWall, concreteMaterial);
            fWall.position.set(0, 0.15 + mh.depth / 2, -extW / 2 + mh.wallThick / 2);
            fWall.castShadow = true;
            group.add(fWall);

            const bWall = new THREE.Mesh(frontWall, concreteMaterial);
            bWall.position.set(0, 0.15 + mh.depth / 2, extW / 2 - mh.wallThick / 2);
            bWall.castShadow = true;
            group.add(bWall);

            const sideWall = new THREE.BoxGeometry(mh.wallThick, mh.depth, extW);
            const lWall = new THREE.Mesh(sideWall, concreteMaterial);
            lWall.position.set(-extL / 2 + mh.wallThick / 2, 0.15 + mh.depth / 2, 0);
            lWall.castShadow = true;
            group.add(lWall);

            const rWall = new THREE.Mesh(sideWall, concreteMaterial);
            rWall.position.set(extL / 2 - mh.wallThick / 2, 0.15 + mh.depth / 2, 0);
            rWall.castShadow = true;
            group.add(rWall);

            // Cover slab
            const coverGeometry = new THREE.BoxGeometry(extL, 0.15, extW);
            const cover = new THREE.Mesh(coverGeometry, concreteMaterial);
            cover.position.y = 0.15 + mh.depth + 0.075;
            cover.castShadow = true;
            group.add(cover);

            // Manhole cover
            const coverTopGeometry = new THREE.BoxGeometry(mh.coverL, 0.05, mh.coverW);
            const coverTop = new THREE.Mesh(coverTopGeometry, new THREE.MeshStandardMaterial({ color: 0x4a5568 }));
            coverTop.position.y = 0.15 + mh.depth + 0.15 + 0.025;
            coverTop.castShadow = true;
            group.add(coverTop);

            group.position.set(mh.position[0], mh.position[1], mh.position[2]);
            return group;
        };

        // Build Soakpit
        const buildSoakpit = () => {
            const group = new THREE.Group();
            const sp = cfg.soakpit;

            if (sp.shape === 'circular') {
                // Circular soakpit
                const radius = sp.diameter / 2;

                // Wall (perforated - shown with reduced opacity)
                const wallGeometry = new THREE.CylinderGeometry(
                    radius + sp.wallThick,
                    radius + sp.wallThick,
                    sp.depth,
                    32,
                    1,
                    false
                );
                const wallMaterial = concreteMaterial.clone();
                wallMaterial.transparent = true;
                wallMaterial.opacity = 0.7;
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.y = sp.depth / 2;
                wall.castShadow = true;
                group.add(wall);

                // Inner fill material
                const fillGeometry = new THREE.CylinderGeometry(radius, radius, sp.depth, 32);
                const fill = new THREE.Mesh(fillGeometry, soilMaterial);
                fill.position.y = sp.depth / 2;
                group.add(fill);

                // Perforation indicators
                for (let i = 0; i < 16; i++) {
                    const angle = (i * Math.PI * 2) / 16;
                    const holeGeometry = new THREE.CylinderGeometry(0.05, 0.05, sp.wallThick + 0.1, 8);
                    const hole = new THREE.Mesh(holeGeometry, new THREE.MeshBasicMaterial({ color: 0x000000 }));
                    hole.rotation.z = Math.PI / 2;
                    hole.position.set(
                        (radius + sp.wallThick / 2) * Math.cos(angle),
                        sp.depth / 2,
                        (radius + sp.wallThick / 2) * Math.sin(angle)
                    );
                    group.add(hole);
                }

                // Cover
                const coverGeometry = new THREE.CylinderGeometry(
                    radius + sp.wallThick,
                    radius + sp.wallThick,
                    0.2,
                    32
                );
                const cover = new THREE.Mesh(coverGeometry, concreteMaterial);
                cover.position.y = sp.depth + 0.1;
                cover.castShadow = true;
                group.add(cover);
            } else {
                // Rectangular soakpit
                const size = sp.diameter;

                // Walls
                const wallThick = sp.wallThick;
                const wallMaterial = concreteMaterial.clone();
                wallMaterial.transparent = true;
                wallMaterial.opacity = 0.7;

                // Front/back walls
                const frontWallGeometry = new THREE.BoxGeometry(size + 2 * wallThick, sp.depth, wallThick);
                const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
                frontWall.position.set(0, sp.depth / 2, -size / 2 - wallThick / 2);
                frontWall.castShadow = true;
                group.add(frontWall);

                const backWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
                backWall.position.set(0, sp.depth / 2, size / 2 + wallThick / 2);
                backWall.castShadow = true;
                group.add(backWall);

                // Side walls
                const sideWallGeometry = new THREE.BoxGeometry(wallThick, sp.depth, size);
                const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
                leftWall.position.set(-size / 2 - wallThick / 2, sp.depth / 2, 0);
                leftWall.castShadow = true;
                group.add(leftWall);

                const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
                rightWall.position.set(size / 2 + wallThick / 2, sp.depth / 2, 0);
                rightWall.castShadow = true;
                group.add(rightWall);

                // Fill
                const fillGeometry = new THREE.BoxGeometry(size, sp.depth, size);
                const fill = new THREE.Mesh(fillGeometry, soilMaterial);
                fill.position.y = sp.depth / 2;
                group.add(fill);

                // Cover
                const coverGeometry = new THREE.BoxGeometry(size + 2 * wallThick, 0.2, size + 2 * wallThick);
                const cover = new THREE.Mesh(coverGeometry, concreteMaterial);
                cover.position.y = sp.depth + 0.1;
                cover.castShadow = true;
                group.add(cover);
            }

            group.position.set(sp.position[0], sp.position[1], sp.position[2]);
            return group;
        };

        // Build connecting pipes
        const buildConnectingPipes = () => {
            const group = new THREE.Group();

            if (cfg.connections.septicToManhole) {
                const st = cfg.septicTank;
                const mh = cfg.manhole;
                const extL = st.intL + 2 * st.wallThick;
                const distance = mh.position[0] - extL / 2;

                const pipeGeometry = new THREE.CylinderGeometry(
                    cfg.connections.pipeDiameter / 2,
                    cfg.connections.pipeDiameter / 2,
                    distance,
                    16
                );
                const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
                pipe.rotation.z = Math.PI / 2;
                pipe.position.set(extL / 2 + distance / 2, st.bedThick + st.depth * 0.6, 0);
                pipe.castShadow = true;
                group.add(pipe);
            }

            if (cfg.connections.manholeToSoakpit) {
                const mh = cfg.manhole;
                const sp = cfg.soakpit;
                const mhExtL = mh.intL + 2 * mh.wallThick;
                const distance = sp.position[0] - mh.position[0] - mhExtL / 2;

                const pipeGeometry = new THREE.CylinderGeometry(
                    cfg.connections.pipeDiameter / 2,
                    cfg.connections.pipeDiameter / 2,
                    distance,
                    16
                );
                const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
                pipe.rotation.z = Math.PI / 2;
                pipe.position.set(
                    mh.position[0] + mhExtL / 2 + distance / 2,
                    mh.position[1] + 0.15 + mh.depth * 0.6,
                    0
                );
                pipe.castShadow = true;
                group.add(pipe);
            }

            return group;
        };

        // Add all components
        const septicTank = buildSepticTank();
        scene.add(septicTank);

        const manhole = buildManhole();
        scene.add(manhole);

        const soakpit = buildSoakpit();
        scene.add(soakpit);

        const pipes = buildConnectingPipes();
        scene.add(pipes);

        // Simple orbit controls (manual implementation)
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        const onMouseDown = (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            const radius = camera.position.length();
            const theta = Math.atan2(camera.position.z, camera.position.x);
            const phi = Math.acos(camera.position.y / radius);

            const newTheta = theta - deltaX * 0.01;
            const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - deltaY * 0.01));

            camera.position.x = radius * Math.sin(newPhi) * Math.cos(newTheta);
            camera.position.y = radius * Math.cos(newPhi);
            camera.position.z = radius * Math.sin(newPhi) * Math.sin(newTheta);
            camera.lookAt(5, 0, 0);

            previousMousePosition = { x: e.clientX, y: e.clientY };
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        const onWheel = (e) => {
            const delta = e.deltaY * 0.01;
            const distance = camera.position.length();
            const newDistance = Math.max(5, Math.min(30, distance + delta));

            camera.position.multiplyScalar(newDistance / distance);
        };

        renderer.domElement.addEventListener('mousedown', onMouseDown);
        renderer.domElement.addEventListener('mousemove', onMouseMove);
        renderer.domElement.addEventListener('mouseup', onMouseUp);
        renderer.domElement.addEventListener('wheel', onWheel);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

        // Cleanup
        return () => {
            renderer.domElement.removeEventListener('mousedown', onMouseDown);
            renderer.domElement.removeEventListener('mousemove', onMouseMove);
            renderer.domElement.removeEventListener('mouseup', onMouseUp);
            renderer.domElement.removeEventListener('wheel', onWheel);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, [cfg, darkMode]);

    return (
        <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" />
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div className="text-white text-xl">Loading 3D Model...</div>
                </div>
            )}
            <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-semibold">
                    Camera Controls
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    • Drag to rotate
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    • Scroll to zoom
                </p>
            </div>
        </div>
    );
};

export default SepticSystem3DView;