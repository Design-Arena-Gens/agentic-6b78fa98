"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { AnimationSettings, PreparedImage } from "@/lib/types";

type ParallaxStudioProps = {
  image: PreparedImage;
  settings: AnimationSettings;
  registerCanvas: (canvas: HTMLCanvasElement) => void;
  playSignal: number;
};

const backgroundColor = new THREE.Color("#05010d");

export default function ParallaxStudio({
  image,
  settings,
  registerCanvas,
  playSignal
}: ParallaxStudioProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        frameloop="always"
        shadows={false}
        dpr={[1, 2]}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance"
        }}
        camera={{
          position: [0, 0, 3.5],
          fov: 32,
          near: 0.1,
          far: 100
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(backgroundColor);
          registerCanvas(gl.domElement);
        }}
      >
        <Suspense fallback={null}>
          <Scene image={image} settings={settings} playSignal={playSignal} />
        </Suspense>
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(224, 189, 255, 0.18), transparent 55%)"
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent ${(1 - settings.vignette) * 100}%, rgba(0,0,0,0.8))`,
          mixBlendMode: "multiply"
        }}
      />
    </div>
  );
}

type SceneProps = {
  image: PreparedImage;
  settings: AnimationSettings;
  playSignal: number;
};

function Scene({ image, settings, playSignal }: SceneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRig = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const { gl, camera } = useThree();

  const [colorTexture, displacementTexture] = useTexture(
    useMemo(() => [image.originalUrl, image.displacementUrl], [image.displacementUrl, image.originalUrl])
  );

  useEffect(() => {
    colorTexture.colorSpace = THREE.SRGBColorSpace;
    colorTexture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    colorTexture.needsUpdate = true;

    displacementTexture.generateMipmaps = false;
    displacementTexture.minFilter = THREE.LinearFilter;
    displacementTexture.wrapS = displacementTexture.wrapT = THREE.ClampToEdgeWrapping;
    displacementTexture.needsUpdate = true;
  }, [colorTexture, displacementTexture, gl.capabilities]);

  useEffect(() => {
    timeRef.current = 0;
  }, [playSignal]);

  useFrame((state, delta) => {
    timeRef.current += delta;
    const duration = Math.max(0.1, settings.duration);
    const normalized = (timeRef.current % duration) / duration;
    const cycle = normalized * Math.PI * 2;

    const sway = Math.sin(cycle) * settings.sway;
    const lift = Math.cos(cycle * 0.8) * settings.sway * 0.6;
    const zoom = Math.sin(cycle * 0.5) * settings.zoom;
    const roll = Math.sin(cycle * 0.5) * settings.roll;
    const wave = Math.sin(cycle * 1.4) * settings.wave;

    state.camera.position.x = sway * 0.8;
    state.camera.position.y = lift * 0.4;
    state.camera.position.z = 3.1 + zoom * 3.2;
    state.camera.lookAt(0, 0, 0);

    gl.toneMappingExposure = settings.exposure;

    if (meshRef.current) {
      meshRef.current.rotation.z = roll;
      meshRef.current.position.z = wave * 0.45;
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.displacementScale = settings.depth * 0.75;
    }

    if (lightRig.current) {
      lightRig.current.children.forEach((child, index) => {
        const t = cycle + index * 2;
        child.position.x = Math.sin(t * 0.35) * 4;
        child.position.y = Math.cos(t * 0.22) * 3 + 1.5;
        child.position.z = Math.sin(t * 0.18) * 5 + 4;
      });
    }
  });

  const planeDimensions = useMemo(() => {
    const height = 2.6;
    return {
      width: height * image.aspect,
      height
    };
  }, [image.aspect]);

  return (
    <>
      <ambientLight intensity={0.6} />

      <group ref={lightRig}>
        <pointLight color="#9478ff" intensity={2} distance={10} decay={2} />
        <pointLight color="#ff9bd5" intensity={1.6} distance={9} decay={2} />
        <pointLight color="#45e3ff" intensity={1.2} distance={9} decay={2} />
      </group>

      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[planeDimensions.width, planeDimensions.height, 256, 256]} />
        <meshStandardMaterial
          map={colorTexture}
          displacementMap={displacementTexture}
          displacementScale={settings.depth}
          roughness={0.4}
          metalness={0.1}
          envMapIntensity={0.35}
        />
      </mesh>

      <Backdrop />
      <FloatingDust />
    </>
  );
}

function Backdrop() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.z += 0.0004;
  });

  return (
    <mesh ref={ref} position={[0, 0, -6]} rotation={[0, 0, 0]}>
      <ringGeometry args={[6, 12, 64]} />
      <meshBasicMaterial color="#13092c" transparent opacity={0.5} />
    </mesh>
  );
}

function FloatingDust() {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rings = 2000;
    const array = new Float32Array(rings * 3);

    for (let i = 0; i < rings; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 6.5 + 0.5;
      const y = Math.random() * 3 - 1.5;
      array[i * 3] = Math.cos(angle) * radius;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = Math.sin(angle) * radius - 2;
    }
    return array;
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.05;
    pointsRef.current.rotation.z += delta * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#ffffff" opacity={0.25} transparent />
    </points>
  );
}
