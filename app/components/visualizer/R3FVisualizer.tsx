'use client';

// Loaded exclusively via next/dynamic({ ssr: false }) from page.tsx so that
// three.js / @react-three/fiber / @react-three/drei never ship in the main
// bundle for users who never turn the visualizer on.

import { useRef, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export type VisualizerMode = 'grid' | 'plane' | 'wave_form' | 'manhattan';

interface VisualizerProps {
  mode?: VisualizerMode;
  speed?: number;
  color1?: string;
  color2?: string;
  density?: number;
  invertY?: boolean;
  scaleY?: boolean;
  maxAmplitude?: number;
  waveFreq?: number;
  waveFormDouble?: boolean;
  autoOrbit?: boolean;
  // Sourced from the shared useMicLevel() hook in page.tsx so the nav's mic
  // indicator and this visualizer react to the same mic stream instead of
  // each opening (and prompting for) their own.
  audioLevelRef?: React.RefObject<number>;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 255, g: 255, b: 255 };
}

interface ParticleFieldProps {
  mode: VisualizerMode;
  density: number;
  color1: string;
  color2: string;
  speed: number;
  waveFreq: number;
  waveFormDouble: boolean;
  maxAmplitude: number;
  scaleY: boolean;
  invertY: boolean;
  timeRef: React.RefObject<number>;
  audioLevelRef: React.RefObject<number>;
}

function ParticleField({
  mode, density, color1, color2, speed, waveFreq, waveFormDouble,
  maxAmplitude, scaleY, invertY, timeRef, audioLevelRef,
}: ParticleFieldProps) {
  const particleCount = Math.floor(2000 * (0.5 + density));
  const pointsRef = useRef<THREE.Points>(null);
  const [initialized, setInitialized] = useState(false);
  const originalPositionsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!pointsRef.current) return;
    setInitialized(false);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      let x, y, z;
      if (mode === 'wave_form') {
        const theta = Math.acos(1 - 2 * i / particleCount);
        const phi = Math.PI * (1 + Math.sqrt(5)) * i;
        const radius = 5;
        x = radius * Math.cos(phi) * Math.sin(theta);
        y = radius * Math.sin(phi) * Math.sin(theta);
        z = radius * Math.cos(theta);
      } else if (mode === 'grid') {
        const gridSize = Math.ceil(Math.sqrt(particleCount));
        const gridX = i % gridSize;
        const gridZ = Math.floor(i / gridSize);
        const spacing = 0.3;
        x = (gridX - gridSize / 2) * spacing;
        y = 0;
        z = (gridZ - gridSize / 2) * spacing;
      } else {
        const gridSize = Math.ceil(Math.sqrt(particleCount));
        const gridX = i % gridSize;
        const gridZ = Math.floor(i / gridSize);
        const spacing = 0.2;
        x = (gridX - gridSize / 2) * spacing;
        y = 0;
        z = (gridZ - gridSize / 2) * spacing;
      }
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }

    // Store original positions for wave_form mode
    originalPositionsRef.current = mode === 'wave_form' ? new Float32Array(positions) : null;

    const geometry = pointsRef.current.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    setInitialized(true);
  }, [particleCount, mode]);

  useFrame(() => {
    if (!pointsRef.current || !initialized) return;
    const geometry = pointsRef.current.geometry;
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    // Idle baseline (quiet/no mic) is subtle; real audio energy scales the
    // motion up - this replaces the old constant-amplitude "breathing" that
    // ran regardless of any sound.
    const audioBoost = 0.2 + audioLevelRef.current * 2.2;

    for (let i = 0; i < particleCount; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      let newY = y;
      let distance = 0;

      if (mode === 'wave_form') {
        let baseX: number, baseY: number, baseZ: number;

        if (originalPositionsRef.current) {
          baseX = originalPositionsRef.current[i * 3];
          baseY = originalPositionsRef.current[i * 3 + 1];
          baseZ = originalPositionsRef.current[i * 3 + 2];
        } else {
          baseX = x;
          baseY = y;
          baseZ = z;
        }

        distance = Math.sqrt(baseX * baseX + baseY * baseY + baseZ * baseZ);
        const wave1 = Math.sin(timeRef.current * speed * waveFreq + distance * 0.5);
        const wave2 = waveFormDouble
          ? Math.cos(timeRef.current * speed * waveFreq * 1.5 + distance * 0.3)
          : Math.cos(timeRef.current * speed * 1.5 + distance * 0.3);
        const wave = waveFormDouble
          ? (wave1 * 0.5 + wave2 * 0.5) * 0.5 + 0.5
          : (wave1 * 0.6 + wave2 * 0.4) * 0.5 + 0.5;
        const amplitude = maxAmplitude * audioBoost;

        if (originalPositionsRef.current) {
          const baseRadius = distance;
          const radialOffset = (wave - 0.5) * amplitude * 0.5;
          const newRadius = baseRadius + radialOffset;
          if (baseRadius > 0) {
            const scale = newRadius / baseRadius;
            positions.setX(i, baseX * scale);
            positions.setY(i, baseY * scale);
            positions.setZ(i, baseZ * scale);
          }
          distance = newRadius;
        } else {
          newY = baseY + wave * amplitude * (scaleY ? 1 : 0) * (invertY ? -1 : 1);
        }
      } else if (mode === 'grid') {
        distance = Math.sqrt(x * x + z * z);
        const wave1 = Math.sin(timeRef.current * speed * 2 + distance * 0.5);
        const wave2 = Math.sin(timeRef.current * speed * 1.3 + distance * 0.8);
        const wave = (wave1 * 0.7 + wave2 * 0.3) * 0.5 + 0.5;
        newY = wave * 2.5 * audioBoost * (scaleY ? 1 : 0) * (invertY ? -1 : 1);
      } else if (mode === 'plane') {
        distance = Math.sqrt(x * x + z * z);
        const wave1 = Math.sin(timeRef.current * speed * 2 + distance * 0.5);
        const wave2 = Math.sin(timeRef.current * speed * 1.5 + x * 2);
        const wave3 = Math.sin(timeRef.current * speed * 1.8 + z * 2);
        const wave = (wave1 * 0.5 + wave2 * 0.25 + wave3 * 0.25) * 0.5 + 0.5;
        newY = wave * 2 * audioBoost * (scaleY ? 1 : 0) * (invertY ? -1 : 1);
      }

      if (mode !== 'wave_form') {
        positions.setY(i, newY);
      }

      const currentX = positions.getX(i);
      const currentZ = positions.getZ(i);

      const waveIntensity = Math.sin(timeRef.current * speed * 2 + distance * 0.5) * 0.5 + 0.5;
      const color1RGB = hexToRgb(color1);
      const color2RGB = hexToRgb(color2);
      const posVariation = (Math.sin(currentX * 0.5) + Math.cos(currentZ * 0.5)) * 0.1;
      const finalMix = Math.max(0, Math.min(1, waveIntensity + posVariation));
      colors.setX(i, (color1RGB.r + (color2RGB.r - color1RGB.r) * finalMix) / 255);
      colors.setY(i, (color1RGB.g + (color2RGB.g - color1RGB.g) * finalMix) / 255);
      colors.setZ(i, (color1RGB.b + (color2RGB.b - color1RGB.b) * finalMix) / 255);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  });

  if (mode === 'manhattan') return null;

  return (
    <points ref={pointsRef} rotation={mode === 'plane' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <bufferGeometry />
      <pointsMaterial
        size={mode === 'wave_form' ? 0.2 : 0.15}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface Building {
  key: string;
  position: [number, number, number];
  args: [number, number, number];
  color: string;
}

// Procedurally generated once per mount (memoized) - previously this
// regenerated random building heights/colors on every single render because
// the whole Canvas was torn down and rebuilt on every slider tweak.
function ManhattanCity() {
  // useState's lazy initializer (not useMemo) is the correct escape hatch
  // here: it's explicitly allowed to run impure code (Math.random) because
  // it only ever runs once, on mount.
  const [buildings] = useState<Building[]>(() => {
    const result: Building[] = [];
    const gridSize = 40;
    const spacing = 0.3;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const centerX = gridSize / 2;
        const centerZ = gridSize / 2;
        const distFromCenter = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        const maxDist = Math.sqrt(centerX ** 2 + centerZ ** 2);

        const heightVariation = 1 - (distFromCenter / maxDist) * 0.5;
        const randomFactor = 0.3 + Math.random() * 0.7;
        const height = 0.4 + heightVariation * randomFactor * 5;
        if (height < 0.6) continue;

        const posX = (x - gridSize / 2) * spacing;
        const posZ = (z - gridSize / 2) * spacing;

        const grayBase = 0.3 + Math.random() * 0.3;
        const color = `rgb(${Math.floor(grayBase * 255)}, ${Math.floor(grayBase * 255)}, ${Math.floor(grayBase * 255)})`;

        const width = spacing * (0.6 + Math.random() * 0.4);
        const depth = spacing * (0.6 + Math.random() * 0.4);

        result.push({ key: `building-${x}-${z}`, position: [posX, height / 2, posZ], args: [width, height, depth], color });
      }
    }
    return result;
  });

  return (
    <group>
      {buildings.map(b => (
        <mesh key={b.key} position={b.position}>
          <boxGeometry args={b.args} />
          <meshStandardMaterial color={b.color} metalness={0.1} roughness={0.8} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40 * 0.3 * 1.2, 40 * 0.3 * 1.2]} />
        <meshStandardMaterial color="#0f0f0f" />
      </mesh>
    </group>
  );
}

function Scene({
  mode, speed, color1, color2, density, maxAmplitude, waveFreq,
  waveFormDouble, scaleY, invertY, autoOrbit, audioLevelRef,
}: Required<Omit<VisualizerProps, 'audioLevelRef'>> & { audioLevelRef: React.RefObject<number> }) {
  const { camera } = useThree();
  const timeRef = useRef(0);

  useEffect(() => {
    if (!camera) return;
    if (mode === 'plane') {
      camera.position.set(0, 8, 8);
      camera.lookAt(0, 0, 0);
    } else if (mode === 'grid') {
      camera.position.set(0, 5, 8);
      camera.lookAt(0, 0, 0);
    } else if (mode === 'wave_form') {
      camera.position.set(0, 3, 10);
      camera.lookAt(0, 0, 0);
    } else if (mode === 'manhattan') {
      camera.position.set(0, 8, 12);
      camera.lookAt(0, 0, 0);
      camera.rotation.set(-Math.PI / 3, 0, 0);
    }
    // Only re-run when the mode actually changes - camera is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useFrame((_state, delta) => {
    timeRef.current += delta * speed * 2;
  });

  return (
    <>
      <color attach="background" args={mode === 'manhattan' ? ['#0a0a0a'] : ['#010204']} />
      {mode === 'manhattan' ? (
        <>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <directionalLight position={[-10, 5, -5]} intensity={0.3} />
          <OrbitControls
            enablePan enableZoom enableRotate
            minDistance={5} maxDistance={30}
            autoRotate={autoOrbit} rotateSpeed={0.5} zoomSpeed={0.8}
          />
          <ManhattanCity />
        </>
      ) : (
        <>
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={1} color={color1} />
          <pointLight position={[-10, -10, -10]} intensity={1} color={color2} />
          <pointLight position={[0, 10, 0]} intensity={0.5} />
          <OrbitControls
            enablePan={false} enableZoom enableRotate
            minDistance={5} maxDistance={20}
            autoRotate={autoOrbit} rotateSpeed={0.5} zoomSpeed={0.8}
          />
          <ParticleField
            mode={mode} density={density} color1={color1} color2={color2}
            speed={speed} waveFreq={waveFreq} waveFormDouble={waveFormDouble}
            maxAmplitude={maxAmplitude} scaleY={scaleY} invertY={invertY}
            timeRef={timeRef} audioLevelRef={audioLevelRef}
          />
        </>
      )}
    </>
  );
}

const CAMERA_POSITION: Record<VisualizerMode, [number, number, number]> = {
  plane: [0, 8, 8],
  grid: [0, 5, 8],
  wave_form: [0, 3, 10],
  manhattan: [0, 8, 12],
};

// This is an ambient background layer, not an interactive one - it must
// never intercept clicks meant for the nav/composer/buttons above it.
export default function R3FVisualizer({
  mode = 'wave_form',
  speed = 0.3,
  color1 = '#ff6b35',
  color2 = '#00d4ff',
  density = 0.5,
  invertY = false,
  scaleY = true,
  maxAmplitude = 1.36,
  waveFreq = 2.0,
  waveFormDouble = false,
  autoOrbit = false,
  audioLevelRef,
}: VisualizerProps) {
  // Falls back to a local zeroed ref if the caller doesn't pass one, so the
  // component still renders (with calm idle motion, no audio reactivity)
  // rather than crashing.
  const fallbackRef = useRef(0);
  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-60">
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 1000, position: CAMERA_POSITION[mode] }}
        gl={{ antialias: true, alpha: true }}
        className="w-full h-full"
      >
        <Scene
          mode={mode} speed={speed} color1={color1} color2={color2} density={density}
          invertY={invertY} scaleY={scaleY} maxAmplitude={maxAmplitude} waveFreq={waveFreq}
          waveFormDouble={waveFormDouble} autoOrbit={autoOrbit}
          audioLevelRef={audioLevelRef ?? fallbackRef}
        />
      </Canvas>
    </div>
  );
}
