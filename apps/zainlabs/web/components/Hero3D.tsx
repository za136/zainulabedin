"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Glossy black spheres and a cube on off-white: the 3D motif of the Canva template, rendered live.
const SPHERES: [number, number, number, number][] = [
  // x, y, z, radius
  [-1.6, 0.9, 0, 1.15],
  [0.9, 1.7, -1.2, 0.45],
  [1.9, -0.2, 0.4, 0.7],
  [-0.2, -1.5, 0.8, 0.38],
  [2.6, 1.6, -2.2, 0.22],
  [-2.9, -1.2, -1.5, 0.3],
];

/** Studio reflections generated locally (no HDR download): gives the black objects their glossy look. */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Rig() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cube = useRef<THREE.Mesh>(null);
  const black = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({ color: "#0b0b0c", roughness: 0.12, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 }),
    [],
  );
  const red = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#b8140d", roughness: 0.2, metalness: 0.1, clearcoat: 1, envMapIntensity: 0.5 }), []);
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.getElapsedTime();
    if (group.current) group.current.rotation.y = Math.sin(t * 0.15) * 0.25;
    if (cube.current) {
      cube.current.rotation.x = t * 0.18;
      cube.current.rotation.y = t * 0.24;
    }
    group.current?.children.forEach((c, i) => {
      if (c.userData.float) c.position.y = c.userData.y + Math.sin(t * 0.6 + i) * 0.08;
    });
  });
  return (
    <group ref={group}>
      {SPHERES.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} material={i === 3 ? red : black} userData={{ float: true, y }} castShadow>
          <sphereGeometry args={[r, 64, 64]} />
        </mesh>
      ))}
      <mesh ref={cube} position={[0.4, -0.2, -0.6]} material={black} rotation={[0.5, 0.7, 0]} castShadow>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
      </mesh>
    </group>
  );
}

export default function Hero3D({ still = false }: { still?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 9.5], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      aria-label="Glossy black spheres and a cube rotating slowly"
    >
      <StudioEnvironment />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <directionalLight position={[-6, -2, 3]} intensity={0.5} color="#f3e9dc" />
      <Scene still={still} />
      {!still && <Rig />}
    </Canvas>
  );
}
