'use client';

import { Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { DiagramEdge, DiagramNode, DiagramScene } from '@factory/core';
import { lt } from '@/lib/format';

type Vec3 = [number, number, number];
interface ControlsLike {
  target: THREE.Vector3;
  update(): void;
}

function Geometry({ shape }: { shape: DiagramNode['shape'] }) {
  switch (shape) {
    case 'sphere':
      return <sphereGeometry args={[0.6, 48, 48]} />;
    case 'cylinder':
      return <cylinderGeometry args={[0.55, 0.55, 1, 48]} />;
    case 'cone':
      return <coneGeometry args={[0.65, 1.2, 48]} />;
    case 'torus':
      return <torusGeometry args={[1, 0.06, 24, 128]} />;
    case 'capsule':
      return <capsuleGeometry args={[0.4, 1, 12, 24]} />;
    case 'octahedron':
      return <octahedronGeometry args={[0.75, 0]} />;
    default:
      return <boxGeometry args={[1, 1, 1]} />;
  }
}

function NodeMesh({ node, dimmed, selected, onSelect }: { node: DiagramNode; dimmed: boolean; selected: boolean; onSelect: (id: string) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const scale: Vec3 = typeof node.scale === 'number' ? [node.scale, node.scale, node.scale] : node.scale;
  const isRing = node.shape === 'torus';
  useFrame((state, dt) => {
    if (!ref.current || !mat.current) return;
    const targetOpacity = dimmed ? 0.18 : 1;
    mat.current.opacity += (targetOpacity - mat.current.opacity) * Math.min(1, dt * 6);
    mat.current.emissiveIntensity = selected ? 0.55 + Math.sin(state.clock.elapsedTime * 4) * 0.2 : dimmed ? 0 : 0.18;
    if (node.shape === 'octahedron' || node.shape === 'torus') ref.current.rotation.y += dt * (isRing ? 0.05 : 0.35);
  });
  return (
    <group position={node.position}>
      <mesh
        ref={ref}
        scale={scale}
        rotation={isRing ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
        castShadow
      >
        <Geometry shape={node.shape} />
        <meshStandardMaterial ref={mat} color={node.color} emissive={node.color} emissiveIntensity={0.18} roughness={0.35} metalness={0.15} transparent opacity={1} />
      </mesh>
    </group>
  );
}

function EdgeLine({ edge, from, to, dimmed }: { edge: DiagramEdge; from: Vec3; to: Vec3; dimmed: boolean }) {
  const start = useMemo(() => new THREE.Vector3(...from), [from]);
  const end = useMemo(() => new THREE.Vector3(...to), [to]);
  const dir = useMemo(() => end.clone().sub(start), [start, end]);
  const len = dir.length();
  // shorten so arrows don't disappear inside node meshes
  const a = useMemo(() => start.clone().add(dir.clone().multiplyScalar(Math.min(0.45, 0.35 * len) / len)), [start, dir, len]);
  const b = useMemo(() => end.clone().sub(dir.clone().multiplyScalar(Math.min(0.6, 0.4 * len) / len)), [end, dir, len]);
  const particles = useRef<THREE.Group>(null);
  const arrowQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), [dir]);
  useFrame((state) => {
    if (!particles.current) return;
    particles.current.children.forEach((child, i) => {
      const t = (state.clock.elapsedTime * 0.35 + i / 3) % 1;
      child.position.lerpVectors(a, b, t);
    });
  });
  const opacity = dimmed ? 0.15 : 0.9;
  return (
    <group>
      <Line points={[a, b]} color={edge.color} lineWidth={2} dashed={edge.style === 'dashed'} dashSize={0.25} gapSize={0.15} transparent opacity={opacity} />
      {edge.directed && (
        <mesh position={b} quaternion={arrowQuat}>
          <coneGeometry args={[0.1, 0.3, 16]} />
          <meshBasicMaterial color={edge.color} transparent opacity={opacity} />
        </mesh>
      )}
      {edge.flow && !dimmed && (
        <group ref={particles}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color={edge.color} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}


interface LabelSpec {
  key: string;
  text: string;
  pos: THREE.Vector3;
  kind: 'node' | 'edge';
  dimmed: boolean;
  selected: boolean;
}

/** Projects 3D anchor points to screen space every frame and moves React-owned label elements. */
function LabelProjector({ labels, refs }: { labels: LabelSpec[]; refs: MutableRefObject<Map<string, HTMLDivElement>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const l of labels) {
      const el = refs.current.get(l.key);
      if (!el) continue;
      v.copy(l.pos).project(camera);
      const visible = v.z < 1 && v.z > -1;
      el.style.display = visible ? 'block' : 'none';
      if (visible) el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
}

/** Smoothly flies the camera to the active step's viewpoint. */
function CameraRig({ camera: target }: { camera?: { position: Vec3; target: Vec3 } }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: ControlsLike | null };
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  useEffect(() => {
    goal.current = target ? { pos: new THREE.Vector3(...target.position), look: new THREE.Vector3(...target.target) } : null;
  }, [target]);
  useFrame((_, dt) => {
    if (!goal.current || !controls) return;
    const k = Math.min(1, dt * 2.5);
    camera.position.lerp(goal.current.pos, k);
    controls.target.lerp(goal.current.look, k);
    controls.update();
    if (camera.position.distanceTo(goal.current.pos) < 0.02) goal.current = null;
  });
  return null;
}

export default function DiagramCanvas({ scene, locale, focus, selected, onSelect, stepCamera, autoRotate }: { scene: DiagramScene; locale: string; focus: string[]; selected: string | null; onSelect: (id: string | null) => void; stepCamera?: { position: Vec3; target: Vec3 }; autoRotate?: boolean }) {
  const pos = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n.position as Vec3])), [scene]);
  const focusSet = new Set(focus);
  const hasFocus = focusSet.size > 0;
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const labels: LabelSpec[] = [
    ...scene.nodes.map((n) => {
      const sc = typeof n.scale === 'number' ? [n.scale, n.scale, n.scale] : n.scale;
      const offset = n.shape === 'torus' ? new THREE.Vector3(sc[0], 0.25, 0) : new THREE.Vector3(0, sc[1] * 0.75 + 0.35, 0);
      return { key: `n:${n.id}`, text: lt(n.label, locale), pos: new THREE.Vector3(...(n.position as Vec3)).add(offset), kind: 'node' as const, dimmed: hasFocus && !focusSet.has(n.id) && selected !== n.id, selected: selected === n.id };
    }),
    ...scene.edges.flatMap((e, i) => {
      const from = pos.get(e.from);
      const to = pos.get(e.to);
      if (!e.label || !from || !to) return [];
      const dim = hasFocus && !(focusSet.has(e.from) || focusSet.has(e.to));
      return [{ key: `e:${e.id ?? i}`, text: lt(e.label, locale), pos: new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), 0.5), kind: 'edge' as const, dimmed: dim, selected: false }];
    }),
  ];
  return (
    <div className="relative h-full w-full">
      <Canvas shadows dpr={[1, 2]} camera={{ position: scene.camera.position, fov: 45 }} onPointerMissed={() => onSelect(null)} gl={{ antialias: true }}>
        <color attach="background" args={[scene.background]} />
        <fog attach="fog" args={[scene.background, 18, 40]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[8, 12, 6]} intensity={1.3} castShadow />
        <pointLight position={[-10, -4, -6]} intensity={40} color="#6366f1" />
        <gridHelper args={[40, 40, '#334155', '#1e293b']} position={[0, -3.2, 0]} />
        {scene.edges.map((e, i) => {
          const from = pos.get(e.from);
          const to = pos.get(e.to);
          if (!from || !to) return null;
          const dim = hasFocus && !(focusSet.has(e.from) || focusSet.has(e.to));
          return <EdgeLine key={e.id ?? i} edge={e} from={from} to={to} dimmed={dim} />;
        })}
        {scene.nodes.map((n) => (
          <NodeMesh key={n.id} node={n} dimmed={hasFocus && !focusSet.has(n.id) && selected !== n.id} selected={selected === n.id} onSelect={onSelect} />
        ))}
        <OrbitControls makeDefault target={scene.camera.target} enableDamping dampingFactor={0.08} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={2} maxDistance={30} />
        <CameraRig camera={stepCamera} />
        <LabelProjector labels={labels} refs={labelRefs} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {labels.map((l) => (
          <div
            key={l.key}
            ref={(el) => {
              if (el) labelRefs.current.set(l.key, el);
              else labelRefs.current.delete(l.key);
            }}
            className="absolute left-0 top-0 will-change-transform"
            style={{ display: 'none' }}
          >
            {l.kind === 'node' ? (
              <span style={{ opacity: l.dimmed ? 0.35 : 1, transition: 'opacity .4s' }} className={`block whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold shadow ${l.selected ? 'bg-white text-black' : 'bg-black/60 text-white'}`}>{l.text}</span>
            ) : (
              !l.dimmed && <span className="block whitespace-nowrap rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-800">{l.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
