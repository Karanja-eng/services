import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Camera, RotateCw, ZoomIn, ZoomOut, Home } from 'lucide-react';

const Staircase3DViewer = ({ staircaseData }) => {
    const mountRef = useRef(null);
    const [isRotating, setIsRotating] = useState(true);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef({ rotationSpeed: 0.005, zoom: 1 });

    useEffect(() => {
        if (!mountRef.current || !staircaseData) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            60,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(8, 6, 8);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, 10, -10);
        scene.add(fillLight);

        // Grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
        scene.add(gridHelper);

        // Axes helper
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);

        // Build staircase based on type
        buildStaircase(scene, staircaseData);

        // Animation loop
        let animationId;
        const animate = () => {
            animationId = requestAnimationFrame(animate);

            if (isRotating) {
                camera.position.x = Math.cos(Date.now() * controlsRef.current.rotationSpeed * 0.001) * 8;
                camera.position.z = Math.sin(Date.now() * controlsRef.current.rotationSpeed * 0.001) * 8;
                camera.lookAt(0, 2, 0);
            }

            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            if (!mountRef.current) return;
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationId);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, [staircaseData, isRotating]);

    const buildStaircase = (scene, data) => {
        const {
            staircase_type = 'straight',
            material_type = 'concrete',
            clear_width = 1.2,
            tread = 0.275,
            rise = 0.175,
            waist_thick = 0.15,
            risers_per_flight = [8, 8],
            num_flights = 2,
            landing_lengths = [1.5],
            landing_widths = [1.2]
        } = data;

        // Material definitions
        const materials = {
            concrete: new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.7,
                metalness: 0.1
            }),
            timber: new THREE.MeshStandardMaterial({
                color: 0x8b4513,
                roughness: 0.8,
                metalness: 0.0
            }),
            steel: new THREE.MeshStandardMaterial({
                color: 0x808080,
                roughness: 0.3,
                metalness: 0.9
            }),
            glass: new THREE.MeshStandardMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.3,
                roughness: 0.1,
                metalness: 0.1
            }),
            handrail: new THREE.MeshStandardMaterial({
                color: 0x444444,
                roughness: 0.4,
                metalness: 0.7
            })
        };

        const structureMaterial = materials[material_type] || materials.concrete;

        let currentY = 0;
        let currentZ = 0;

        // Build based on staircase type
        switch (staircase_type) {
            case 'straight':
                buildStraightStaircase(scene, structureMaterial, materials, {
                    clear_width, tread, rise, waist_thick, risers_per_flight, num_flights,
                    landing_lengths, landing_widths, currentY, currentZ
                });
                break;

            case 'l_shaped':
                buildLShapedStaircase(scene, structureMaterial, materials, {
                    clear_width, tread, rise, waist_thick, risers_per_flight, num_flights,
                    landing_lengths, landing_widths
                });
                break;

            case 'u_shaped':
                buildUShapedStaircase(scene, structureMaterial, materials, {
                    clear_width, tread, rise, waist_thick, risers_per_flight, num_flights,
                    landing_lengths, landing_widths
                });
                break;

            case 'spiral':
                buildSpiralStaircase(scene, structureMaterial, materials, {
                    clear_width, rise, risers_per_flight: risers_per_flight.reduce((a, b) => a + b, 0),
                    spiral_radius: data.spiral_radius || 1.0
                });
                break;

            case 'cantilever':
                buildCantileverStaircase(scene, structureMaterial, materials, {
                    clear_width, tread, rise, risers_per_flight: risers_per_flight.reduce((a, b) => a + b, 0)
                });
                break;

            default:
                buildStraightStaircase(scene, structureMaterial, materials, {
                    clear_width, tread, rise, waist_thick, risers_per_flight, num_flights,
                    landing_lengths, landing_widths, currentY, currentZ
                });
        }
    };

    const buildStraightStaircase = (scene, material, materials, params) => {
        const { clear_width, tread, rise, waist_thick, risers_per_flight, num_flights,
            landing_lengths, landing_widths } = params;

        let currentY = 0;
        let currentZ = 0;

        for (let flight = 0; flight < num_flights; flight++) {
            const numRisers = risers_per_flight[flight];

            // Build steps for this flight
            for (let i = 0; i < numRisers; i++) {
                // Waist slab
                const waistGeo = new THREE.BoxGeometry(clear_width, waist_thick, tread);
                const waist = new THREE.Mesh(waistGeo, material);
                waist.position.set(0, currentY + waist_thick / 2, currentZ + tread / 2);
                waist.castShadow = true;
                waist.receiveShadow = true;
                scene.add(waist);

                // Riser
                const riserGeo = new THREE.BoxGeometry(clear_width, rise, 0.02);
                const riser = new THREE.Mesh(riserGeo, material);
                riser.position.set(0, currentY + rise / 2, currentZ);
                riser.castShadow = true;
                scene.add(riser);

                // Tread top (step)
                const stepHeight = (rise * (i + 1)) / numRisers * (i + 1) / numRisers * rise;
                const stepGeo = new THREE.BoxGeometry(clear_width, rise, tread);
                const step = new THREE.Mesh(stepGeo, material);
                step.position.set(0, currentY + rise / 2, currentZ + tread / 2);
                step.castShadow = true;
                step.receiveShadow = true;
                scene.add(step);

                currentY += rise;
                currentZ += tread;
            }

            // Landing between flights
            if (flight < num_flights - 1 && landing_lengths[flight]) {
                const landingGeo = new THREE.BoxGeometry(
                    landing_widths[flight],
                    waist_thick,
                    landing_lengths[flight]
                );
                const landing = new THREE.Mesh(landingGeo, material);
                landing.position.set(0, currentY + waist_thick / 2, currentZ + landing_lengths[flight] / 2);
                landing.castShadow = true;
                landing.receiveShadow = true;
                scene.add(landing);

                currentZ += landing_lengths[flight];
            }

            // Add handrails for this flight
            addHandrails(scene, materials.handrail, {
                startY: currentY - risers_per_flight[flight] * rise,
                endY: currentY,
                startZ: currentZ - risers_per_flight[flight] * tread,
                endZ: currentZ,
                width: clear_width
            });
        }
    };

    const buildLShapedStaircase = (scene, material, materials, params) => {
        const { clear_width, tread, rise, waist_thick, risers_per_flight } = params;

        let currentY = 0;
        let currentZ = 0;
        let currentX = 0;

        // First flight (going forward)
        const flight1Risers = risers_per_flight[0];
        for (let i = 0; i < flight1Risers; i++) {
            buildStep(scene, material, { clear_width, tread, rise, waist_thick, currentY, currentZ, currentX });
            currentY += rise;
            currentZ += tread;
        }

        // Landing
        const landingGeo = new THREE.BoxGeometry(clear_width, waist_thick, clear_width);
        const landing = new THREE.Mesh(landingGeo, material);
        landing.position.set(clear_width / 2, currentY + waist_thick / 2, currentZ + clear_width / 2);
        landing.castShadow = true;
        landing.receiveShadow = true;
        scene.add(landing);

        currentZ += clear_width;
        currentX = clear_width;

        // Second flight (going right - 90 degree turn)
        const flight2Risers = risers_per_flight[1] || flight1Risers;
        for (let i = 0; i < flight2Risers; i++) {
            const stepGeo = new THREE.BoxGeometry(tread, rise, clear_width);
            const step = new THREE.Mesh(stepGeo, material);
            step.position.set(currentX + tread / 2, currentY + rise / 2, currentZ);
            step.castShadow = true;
            step.receiveShadow = true;
            scene.add(step);

            currentY += rise;
            currentX += tread;
        }
    };

    const buildUShapedStaircase = (scene, material, materials, params) => {
        const { clear_width, tread, rise, waist_thick, risers_per_flight } = params;

        let currentY = 0;
        let currentZ = 0;

        // First flight
        const flight1Risers = risers_per_flight[0];
        for (let i = 0; i < flight1Risers; i++) {
            buildStep(scene, material, { clear_width, tread, rise, waist_thick, currentY, currentZ, currentX: 0 });
            currentY += rise;
            currentZ += tread;
        }

        // Landing
        const landingGeo = new THREE.BoxGeometry(clear_width * 2, waist_thick, clear_width);
        const landing = new THREE.Mesh(landingGeo, material);
        landing.position.set(0, currentY + waist_thick / 2, currentZ + clear_width / 2);
        landing.castShadow = true;
        landing.receiveShadow = true;
        scene.add(landing);

        currentZ += clear_width;

        // Second flight (return direction)
        const flight2Risers = risers_per_flight[1] || flight1Risers;
        for (let i = 0; i < flight2Risers; i++) {
            buildStep(scene, material, {
                clear_width, tread, rise, waist_thick,
                currentY,
                currentZ: currentZ - tread * (i + 1),
                currentX: clear_width
            });
            currentY += rise;
        }
    };

    const buildSpiralStaircase = (scene, material, materials, params) => {
        const { clear_width, rise, risers_per_flight, spiral_radius } = params;
        const anglePerStep = (Math.PI * 2) / risers_per_flight;

        for (let i = 0; i < risers_per_flight; i++) {
            const angle = anglePerStep * i;
            const x = Math.cos(angle) * spiral_radius;
            const z = Math.sin(angle) * spiral_radius;
            const y = i * rise;

            // Wedge-shaped step
            const stepShape = new THREE.Shape();
            stepShape.moveTo(0, 0);
            stepShape.lineTo(clear_width * Math.cos(anglePerStep / 2), clear_width * Math.sin(anglePerStep / 2));
            stepShape.lineTo(clear_width * Math.cos(-anglePerStep / 2), clear_width * Math.sin(-anglePerStep / 2));
            stepShape.lineTo(0, 0);

            const extrudeSettings = { depth: rise, bevelEnabled: false };
            const stepGeo = new THREE.ExtrudeGeometry(stepShape, extrudeSettings);
            const step = new THREE.Mesh(stepGeo, material);

            step.position.set(x, y, z);
            step.rotation.y = angle;
            step.castShadow = true;
            step.receiveShadow = true;
            scene.add(step);

            // Central pole
            if (i === 0) {
                const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, risers_per_flight * rise, 16);
                const pole = new THREE.Mesh(poleGeo, materials.steel);
                pole.position.set(0, (risers_per_flight * rise) / 2, 0);
                pole.castShadow = true;
                scene.add(pole);
            }
        }
    };

    const buildCantileverStaircase = (scene, material, materials, params) => {
        const { clear_width, tread, rise, risers_per_flight } = params;

        for (let i = 0; i < risers_per_flight; i++) {
            const y = i * rise;

            // Tread (no riser for cantilever)
            const treadGeo = new THREE.BoxGeometry(clear_width, 0.04, tread);
            const treadMesh = new THREE.Mesh(treadGeo, material);
            treadMesh.position.set(0, y, i * tread + tread / 2);
            treadMesh.castShadow = true;
            treadMesh.receiveShadow = true;
            scene.add(treadMesh);

            // Support rod (from wall)
            const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, clear_width / 2, 8);
            const rod = new THREE.Mesh(rodGeo, materials.steel);
            rod.rotation.z = Math.PI / 2;
            rod.position.set(-clear_width / 4, y, i * tread + tread / 2);
            rod.castShadow = true;
            scene.add(rod);
        }

        // Wall
        const wallGeo = new THREE.BoxGeometry(0.2, risers_per_flight * rise, risers_per_flight * tread);
        const wall = new THREE.Mesh(wallGeo, materials.concrete);
        wall.position.set(-clear_width / 2 - 0.1, (risers_per_flight * rise) / 2, (risers_per_flight * tread) / 2);
        wall.receiveShadow = true;
        scene.add(wall);
    };

    const buildStep = (scene, material, params) => {
        const { clear_width, tread, rise, waist_thick, currentY, currentZ, currentX } = params;

        const stepGeo = new THREE.BoxGeometry(clear_width, rise, tread);
        const step = new THREE.Mesh(stepGeo, material);
        step.position.set(currentX, currentY + rise / 2, currentZ + tread / 2);
        step.castShadow = true;
        step.receiveShadow = true;
        scene.add(step);
    };

    const addHandrails = (scene, material, params) => {
        const { startY, endY, startZ, endZ, width } = params;
        const length = Math.sqrt((endY - startY) ** 2 + (endZ - startZ) ** 2);
        const angle = Math.atan2(endY - startY, endZ - startZ);

        // Left handrail
        const railGeoLeft = new THREE.CylinderGeometry(0.025, 0.025, length, 16);
        const railLeft = new THREE.Mesh(railGeoLeft, material);
        railLeft.position.set(-width / 2, (startY + endY) / 2 + 0.9, (startZ + endZ) / 2);
        railLeft.rotation.z = Math.PI / 2 - angle;
        railLeft.castShadow = true;
        scene.add(railLeft);

        // Right handrail
        const railRight = new THREE.Mesh(railGeoLeft, material);
        railRight.position.set(width / 2, (startY + endY) / 2 + 0.9, (startZ + endZ) / 2);
        railRight.rotation.z = Math.PI / 2 - angle;
        railRight.castShadow = true;
        scene.add(railRight);
    };

    const handleZoomIn = () => {
        if (cameraRef.current) {
            cameraRef.current.position.multiplyScalar(0.9);
        }
    };

    const handleZoomOut = () => {
        if (cameraRef.current) {
            cameraRef.current.position.multiplyScalar(1.1);
        }
    };

    const handleResetView = () => {
        if (cameraRef.current) {
            cameraRef.current.position.set(8, 6, 8);
            cameraRef.current.lookAt(0, 2, 0);
        }
    };

    return (
        <div className="relative w-full h-full min-h-[600px] bg-gray-100 rounded-lg overflow-hidden">
            <div ref={mountRef} className="w-full h-full" />

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                    onClick={() => setIsRotating(!isRotating)}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title={isRotating ? "Stop rotation" : "Start rotation"}
                >
                    <RotateCw className={`w-5 h-5 ${isRotating ? 'text-blue-600' : 'text-gray-600'}`} />
                </button>
                <button
                    onClick={handleZoomIn}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title="Zoom in"
                >
                    <ZoomIn className="w-5 h-5 text-gray-600" />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title="Zoom out"
                >
                    <ZoomOut className="w-5 h-5 text-gray-600" />
                </button>
                <button
                    onClick={handleResetView}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title="Reset view"
                >
                    <Home className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-sm">
                <div className="font-semibold mb-2">3D View Controls</div>
                <div className="text-gray-600 space-y-1">
                    <div>• Auto-rotation: Toggle with button</div>
                    <div>• Zoom: Use zoom buttons</div>
                    <div>• Reset: Return to default view</div>
                </div>
            </div>
        </div>
    );
};

export default Staircase3DViewer;