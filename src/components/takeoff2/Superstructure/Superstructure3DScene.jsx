import React, { Suspense } from "react";
import { useGLTF, Environment, SoftShadows, PerspectiveCamera, OrbitControls } from "@react-three/drei";

const API_BASE = `http://${window.location.hostname}:8001`;

const Model = ({ url }) => {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
};

export const Superstructure3DScene = ({ buildingData }) => {
    if (!buildingData || !buildingData.glb_url) return null;

    const fullUrl = buildingData.glb_url.startsWith('http') 
        ? buildingData.glb_url 
        : `${API_BASE}${buildingData.glb_url}`;

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            
            <Suspense fallback={null}>
                <Model url={fullUrl} />
            </Suspense>

            <gridHelper args={[100, 100, "#cbd5e1", "#f1f5f9"]} position={[0, -0.01, 0]} />
        </>
    );
};

export default Superstructure3DScene;
