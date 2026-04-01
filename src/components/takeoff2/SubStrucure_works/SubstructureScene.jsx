import React, { Suspense } from "react";
import { useGLTF, Environment, SoftShadows, PerspectiveCamera, OrbitControls } from "@react-three/drei";

const API_BASE = `http://${window.location.hostname}:8001`;

const Model = ({ url }) => {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
};

export const SubstructureSceneImpl = ({ buildingData, settings }) => {
    if (!buildingData || !buildingData.glb_url) return null;

    const fullUrl = buildingData.glb_url.startsWith('http') 
        ? buildingData.glb_url 
        : `${API_BASE}${buildingData.glb_url}`;

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            
            <Suspense fallback={null}>
                <Model url={fullUrl} />
            </Suspense>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color={settings?.groundColor || "#f8fafc"} transparent opacity={settings?.groundOpacity || 1} />
            </mesh>
            <gridHelper args={[100, 100]} position={[0, -0.001, 0]} />
        </>
    );
};

export default SubstructureSceneImpl;
