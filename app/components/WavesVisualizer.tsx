'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WavesVisualizerProps {
  audioData: Uint8Array | null;
  isActive: boolean;
  typingSpeed?: number;
}

function Waves({ audioData, typingSpeed = 0 }: { audioData: Uint8Array | null; typingSpeed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.PlaneGeometry>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !geometryRef.current) return;

    const t = clock.getElapsedTime();
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const segments = 50;

    // Store original positions if not already stored
    if (!(geometryRef.current.userData as any).originalPositions) {
      (geometryRef.current.userData as any).originalPositions = Array.from(positions);
    }

    // Create wave effect with continuous motion (like original repo)
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const index = (i * (segments + 1) + j) * 3;
        const x = (i / segments - 0.5) * 10;
        const z = (j / segments - 0.5) * 10;

        // Base waves using time-based calculations (always active)
        let y = 0;
        y += Math.sin(x * 0.4 + t * 0.8) * 0.6;
        y += Math.cos(z * 0.4 + t * 0.6) * 0.6;
        y += Math.sin((x + z) * 0.3 + t * 0.4) * 0.3;
        y += Math.cos((x - z) * 0.2 + t * 0.5) * 0.2;

        // Audio modulates the base wave
        if (audioData && audioData.length > 0) {
          const dataIndex = Math.floor((i / segments) * audioData.length);
          const value = audioData[dataIndex] / 255;
          y += value * 2.5; // Audio adds to base wave
        }
        
        // Typing speed reactivity (adds on top)
        y += typingSpeed * 1.0;

        positions[index + 1] = y;
      }
    }

    geometryRef.current.attributes.position.needsUpdate = true;
    geometryRef.current.computeVertexNormals();
    
    // Continuous rotation
    meshRef.current.rotation.z = t * 0.05 + Math.sin(t * 0.2) * 0.05;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry ref={geometryRef} args={[10, 10, 50, 50]} />
      <meshStandardMaterial
        color="white"
        wireframe={true}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function WavesVisualizer({ audioData, isActive, typingSpeed = 0 }: WavesVisualizerProps) {
  return <Waves audioData={audioData} typingSpeed={typingSpeed} />;
}
