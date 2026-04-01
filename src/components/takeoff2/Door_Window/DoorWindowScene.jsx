import React, { Suspense } from "react";
import { useGLTF, Environment, OrbitControls, PerspectiveCamera, ContactShadows } from "@react-three/drei";

const API_BASE = `http://${window.location.hostname}:8001`;

const Model = ({ url }) => {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
};

export const DoorWindowScene = ({ buildingData }) => {
    if (!buildingData || !buildingData.glb_url) return null;

    const fullUrl = buildingData.glb_url.startsWith('http') 
        ? buildingData.glb_url 
        : `${API_BASE}${buildingData.glb_url}`;

    return (
        <>
            <PerspectiveCamera makeDefault position={[10, 8, 10]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ContactShadows opacity={0.4} scale={20} blur={2.4} far={4.5} />
            
            <Suspense fallback={null}>
                <Model url={fullUrl} />
            </Suspense>

            <gridHelper args={[40, 40]} />
        </>
    );
};

export default DoorWindowScene;
