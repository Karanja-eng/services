import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';

// ── Fence3D ───────────────────────────────────────────────────────────────

export function Fence3D({ element }) {
  const { path, properties = {} } = element;
  const { type = 'close_board', height = 1.8 } = properties;
  if (!path || path.length < 2) return null;

  return (
    <group>
      {/* Posts */}
      {path.map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} castShadow>
          <boxGeometry args={[0.1, height, 0.1]} />
          <meshStandardMaterial color="#6a4a2a" roughness={0.9} />
        </mesh>
      ))}

      {/* Rails */}
      {path.slice(0, -1).map(([x0, z0], i) => {
        const [x1, z1] = path[i + 1];
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const len = Math.hypot(x1 - x0, z1 - z0);
        const angle = Math.atan2(x1 - x0, z1 - z0);
        return (
          <group key={i}>
            {[height * 0.3, height * 0.7].map((ry, ri) => (
              <mesh key={ri} position={[cx, ry, cz]} rotation={[0, angle, 0]} castShadow>
                <boxGeometry args={[0.05, 0.05, len]} />
                <meshStandardMaterial color="#7a5a3a" roughness={0.9} />
              </mesh>
            ))}
            {/* Close-board planks */}
            {type === 'close_board' && renderPlanks(x0, z0, x1, z1, height)}
          </group>
        );
      })}
    </group>
  );
}

function renderPlanks(x0, z0, x1, z1, height) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const angle = Math.atan2(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const plankW = 0.1;
  const count = Math.max(1, Math.floor(len / plankW));
  const planks = [];

  for (let p = 0; p < count; p++) {
    const t = (p + 0.5) / count;
    const px = x0 + (x1 - x0) * t;
    const pz = z0 + (z1 - z0) * t;
    planks.push(
      <mesh key={p} position={[px, height / 2, pz]} rotation={[0, angle, 0]} castShadow>
        <boxGeometry args={[plankW * 0.9, height, 0.02]} />
        <meshStandardMaterial color="#8a6a3a" roughness={0.95} />
      </mesh>
    );
  }
  return planks;
}

// ── Light3D ───────────────────────────────────────────────────────────────

export function Light3D({ element }) {
  const { origin, properties = {} } = element;
  const { type = 'bollard' } = properties;
  if (!origin) return null;

  const [x, z] = origin;

  if (type === 'bollard') {
    return (
      <group position={[x, 0, z]}>
        {/* Post */}
        <mesh castShadow>
          <cylinderGeometry args={[0.06, 0.08, 0.9, 8]} />
          <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Luminaire sphere */}
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.15, 10, 8]} />
          <meshStandardMaterial
            color="#ffffee"
            emissive="#ffeeaa"
            emissiveIntensity={1.5}
            roughness={0.2}
          />
        </mesh>
        <pointLight position={[0, 1.0, 0]} intensity={2} distance={8} color="#ffeecc" castShadow />
      </group>
    );
  }

  // Street lamp
  return (
    <group position={[x, 0, z]}>
      {/* Pole */}
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.08, 6, 8]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.5, 6, 0]} rotation={[0, 0, Math.PI / 8]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
        <meshStandardMaterial color="#555" metalness={0.5} />
      </mesh>
      {/* Luminaire */}
      <mesh position={[1, 5.8, 0]}>
        <boxGeometry args={[0.5, 0.15, 0.25]} />
        <meshStandardMaterial color="#ffffee" emissive="#ffeeaa" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[1, 5.5, 0]} intensity={8} distance={20} color="#fff5dd" castShadow />
    </group>
  );
}

// ── WaterFeature3D ────────────────────────────────────────────────────────

export function WaterFeature3D({ element }) {
  const { origin, properties = {} } = element;
  const { type = 'pool', width = 6, depth = 4, radius = 3 } = properties;
  if (!origin) return null;

  const [x, z] = origin;

  if (type === 'fountain') {
    return <Fountain position={[x, 0, z]} radius={radius} />;
  }

  // Pool
  return (
    <group position={[x, 0, z]}>
      {/* Pool basin */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[width, 0.4, depth]} />
        <meshStandardMaterial color="#2a5a70" roughness={0.5} />
      </mesh>
      {/* Water surface */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[width * 0.95, 0.02, depth * 0.95]} />
        <meshPhysicalMaterial
          color="#3a9abf"
          transmission={0.8}
          roughness={0.05}
          metalness={0}
          ior={1.33}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

function Fountain({ position, radius }) {
  const particlesRef = useRef();
  const count = 80;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.3;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 2;
      positions[i * 3 + 2] = Math.sin(a) * r;
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = 0.03 + Math.random() * 0.03;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    return { positions, velocities };
  }, []);

  useFrame(() => {
    if (!particlesRef.current) return;
    const pos = particlesRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += velocities[i * 3];
      pos[i * 3 + 1] += velocities[i * 3 + 1];
      pos[i * 3 + 2] += velocities[i * 3 + 2];
      velocities[i * 3 + 1] -= 0.001; // gravity
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
        const a = Math.random() * Math.PI * 2;
        velocities[i * 3] = Math.cos(a) * 0.02;
        velocities[i * 3 + 1] = 0.05 + Math.random() * 0.03;
        velocities[i * 3 + 2] = Math.sin(a) * 0.02;
      }
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    return g;
  }, []);

  return (
    <group position={position}>
      {/* Basin */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius + 0.3, 0.3, 32]} />
        <meshStandardMaterial color="#708090" roughness={0.6} />
      </mesh>
      {/* Water */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[radius * 0.95, radius * 0.95, 0.05, 32]} />
        <meshPhysicalMaterial color="#3a9abf" transmission={0.7} roughness={0.1} transparent opacity={0.6} />
      </mesh>
      {/* Particles */}
      <points ref={particlesRef} geometry={geom}>
        <pointsMaterial color="#aaddff" size={0.08} transparent opacity={0.8} sizeAttenuation />
      </points>
    </group>
  );
}