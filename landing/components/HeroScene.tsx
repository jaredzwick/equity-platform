"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Line } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// Visualizes "many tenants on shared infra": a bright central hub with a
// ring of glowing tenant nodes orbiting it. Lines pulse between hub and
// tenants to suggest reconciliation traffic.

const TENANT_COUNT = 7;
const ORBIT_RADIUS = 2.4;

function TenantRing() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.15;
    group.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.2) * 0.08;
  });

  const nodes = useMemo(() => {
    return new Array(TENANT_COUNT).fill(0).map((_, i) => {
      const angle = (i / TENANT_COUNT) * Math.PI * 2;
      return {
        pos: new THREE.Vector3(
          Math.cos(angle) * ORBIT_RADIUS,
          Math.sin(i * 1.7) * 0.35,
          Math.sin(angle) * ORBIT_RADIUS,
        ),
        hue: 220 + (i * 22) % 100,
        scale: 0.22 + (i % 3) * 0.05,
      };
    });
  }, []);

  return (
    <group ref={group}>
      {nodes.map((n, i) => (
        <Float
          key={i}
          speed={1.4}
          rotationIntensity={0.6}
          floatIntensity={0.5}
        >
          <mesh position={n.pos}>
            <icosahedronGeometry args={[n.scale, 1]} />
            <meshStandardMaterial
              color={new THREE.Color(`hsl(${n.hue}, 85%, 65%)`)}
              emissive={new THREE.Color(`hsl(${n.hue}, 85%, 55%)`)}
              emissiveIntensity={0.55}
              roughness={0.25}
              metalness={0.35}
            />
          </mesh>
        </Float>
      ))}

      {/* Reconciliation lines: hub → tenant, pulsing opacity */}
      {nodes.map((n, i) => (
        <PulseLine key={`l-${i}`} to={n.pos} phase={i * 0.6} />
      ))}
    </group>
  );
}

function PulseLine({ to, phase }: { to: THREE.Vector3; phase: number }) {
  const ref = useRef<THREE.Line>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.LineBasicMaterial;
    m.opacity =
      0.15 + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.2 + phase));
  });
  return (
    <Line
      // @ts-expect-error drei's Line ref typing is looser than three's
      ref={ref}
      points={[[0, 0, 0], [to.x, to.y, to.z]]}
      color={"#8b93ff"}
      lineWidth={1.2}
      transparent
      opacity={0.35}
    />
  );
}

function Hub() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.03;
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.8, 3]} />
      <meshStandardMaterial
        color={"#6366f1"}
        emissive={"#4338ca"}
        emissiveIntensity={0.9}
        roughness={0.15}
        metalness={0.6}
      />
    </mesh>
  );
}

function Backdrop() {
  const ref = useRef<THREE.Points>(null);
  const points = useMemo(() => {
    const arr = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 6 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.03;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color={"#a5b4fc"}
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </points>
  );
}

function Scene({ pointer }: { pointer: { x: number; y: number } }) {
  const camRig = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!camRig.current) return;
    // Parallax: soft camera easing based on mouse position
    camRig.current.rotation.y +=
      (pointer.x * 0.15 - camRig.current.rotation.y) * 0.05;
    camRig.current.rotation.x +=
      (-pointer.y * 0.1 - camRig.current.rotation.x) * 0.05;
  });
  return (
    <group ref={camRig}>
      <Backdrop />
      <Hub />
      <TenantRing />
    </group>
  );
}

// Probe WebGL availability without mounting a Canvas. Returns false in
// headless browsers where SwiftShader is sandboxed, on very old GPUs, and
// where users have explicitly disabled WebGL.
function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export default function HeroScene() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<"loading" | "canvas" | "fallback">("loading");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !hasWebGL()) {
      setMode("fallback");
      return;
    }
    setMode("canvas");
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setPointer({ x: x * 2, y: y * 2 });
  };

  if (mode !== "canvas") {
    return <StaticFallback />;
  }

  return (
    <div
      className="relative h-full w-full"
      onPointerMove={onPointerMove}
      onPointerLeave={() => setPointer({ x: 0, y: 0 })}
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0.7, 6.5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        onCreated={() => {
          // Successful mount; nothing to do.
        }}
        fallback={<StaticFallback />}
      >
        <color attach="background" args={["#05060f"]} />
        <fog attach="fog" args={["#05060f", 6, 14]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 4, 5]} intensity={0.9} color={"#a5b4fc"} />
        <pointLight position={[-4, -2, -3]} intensity={0.6} color={"#ec4899"} />
        <Environment preset="city" />
        <Scene pointer={pointer} />
      </Canvas>
      {/* Radial vignette so the scene fades into the page */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,var(--color-bg)_95%)]" />
    </div>
  );
}

// Rich CSS-only hero: aurora gradients + orbiting gradient orb + subtle
// grid. Used for reduced-motion, no-WebGL, and server-side render. Should
// never look like a "broken" state — it's a first-class visual.
function StaticFallback() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05060f]">
      {/* Faint grid backdrop */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      {/* Aurora blobs */}
      <div className="absolute -top-24 left-1/4 h-[45vh] w-[45vh] rounded-full bg-indigo-600/40 blur-[100px] motion-safe:animate-pulse" />
      <div
        className="absolute right-1/4 top-1/3 h-[40vh] w-[40vh] rounded-full bg-fuchsia-500/30 blur-[100px] motion-safe:animate-pulse"
        style={{ animationDelay: "1.5s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[50vh] w-[50vh] rounded-full bg-cyan-500/25 blur-[120px] motion-safe:animate-pulse"
        style={{ animationDelay: "3s" }}
      />
      {/* Central orb */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-56 w-56">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-cyan-300 opacity-90 blur-md" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 shadow-2xl shadow-indigo-500/50" />
          <div className="absolute inset-8 rounded-full bg-black/40 backdrop-blur" />
        </div>
      </div>
      {/* Vignette blending into page bg */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#05060f_92%)]" />
    </div>
  );
}
