import React, { Suspense } from "react";
import { useGLTF, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";

const API_BASE = `http://${window.location.hostname}:8001`;

const Model = ({ url }) => {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
};

export function RoofScene({ buildingData }) {
    if (!buildingData || !buildingData.glb_url) return null;

    const fullUrl = buildingData.glb_url.startsWith('http') 
        ? buildingData.glb_url 
        : `${API_BASE}${buildingData.glb_url}`;

    return (
        <group>
            <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            
            <Suspense fallback={null}>
                <Model url={fullUrl} />
            </Suspense>

            <gridHelper args={[20, 20, "#888", "#ddd"]} position={[0, -0.05, 0]} />
        </group>
    );
}

export default RoofScene;
