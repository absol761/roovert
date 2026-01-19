'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticlesVisualizerProps {
  audioData: Uint8Array | null;
  isActive: boolean;
  typingSpeed?: number;
}

function Particles({ audioData, typingSpeed = 0 }: { audioData: Uint8Array | null; typingSpeed?: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleSystemRef = useRef<THREE.BufferGeometry>(null);
  const tmpPosBefore = useMemo(() => new THREE.Vector3(), []);
  const tmpPosAfter = useMemo(() => new THREE.Vector3(), []);

  // Match original repo: use cubic distribution
  const maxPoints = 1000;
  const nPerSide = Math.max(1, Math.floor(Math.cbrt(maxPoints)));
  const particleCount = Math.pow(nPerSide, 3);
  const maxDim = 4;
  const pointSize = 0.2;
  const spacing = maxDim / nPerSide;

  // Initialize positions in a cubic grid (matching original repo pattern)
  useEffect(() => {
    if (!particlesRef.current) return;
    const positionsBuffer = particlesRef.current.geometry.attributes.position;
    let i = 0;
    for (let x = 0; x < nPerSide; x++) {
      for (let y = 0; y < nPerSide; y++) {
        for (let z = 0; z < nPerSide; z++) {
          i = x * (nPerSide * nPerSide) + y * nPerSide + z;
          positionsBuffer.setXYZ(
            i,
            -maxDim / 2 + x * spacing,
            -maxDim / 2 + y * spacing,
            -maxDim / 2 + z * spacing,
          );
        }
      }
    }
    positionsBuffer.needsUpdate = true;
  }, []);

  useFrame(({ clock }, delta) => {
    if (!particlesRef.current) return;

    const elapsedTimeSec = clock.getElapsedTime();
    const positionsBuffer = particlesRef.current.geometry.attributes.position;

    // Motion mapping pattern (matching original repo)
    for (let i = 0; i < particleCount; i++) {
      tmpPosBefore.x = positionsBuffer.getX(i);
      tmpPosBefore.y = positionsBuffer.getY(i);
      tmpPosBefore.z = positionsBuffer.getZ(i);
      
      // Base motion with continuous waves (always active)
      tmpPosAfter.x = tmpPosBefore.x + Math.sin(tmpPosBefore.x * 0.5 + elapsedTimeSec * 0.3) * 0.2;
      tmpPosAfter.y = tmpPosBefore.y + Math.sin(tmpPosBefore.y * 0.5 + elapsedTimeSec * 0.4) * 0.2;
      tmpPosAfter.z = tmpPosBefore.z + Math.cos(tmpPosBefore.z * 0.5 + elapsedTimeSec * 0.2) * 0.2;
      
      // Audio reactivity (modulates position)
      if (audioData && audioData.length > 0) {
        const dataIndex = Math.floor((i / particleCount) * audioData.length);
        const value = audioData[dataIndex] / 255;
        tmpPosAfter.x += (value - 0.5) * 1.5;
        tmpPosAfter.y += value * 2;
        tmpPosAfter.z += (value - 0.5) * 1.5;
      }
      
      // Typing speed reactivity
      tmpPosAfter.y += typingSpeed * 0.3;
      
      positionsBuffer.setXYZ(i, tmpPosAfter.x, tmpPosAfter.y, tmpPosAfter.z);
    }
    
    positionsBuffer.needsUpdate = true;
    
    // Subtle rotation (matching original repo style)
    particlesRef.current.rotation.y = elapsedTimeSec * 0.1;
    particlesRef.current.rotation.x = Math.sin(elapsedTimeSec * 0.15) * 0.1;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry ref={particleSystemRef}>
        <bufferAttribute
          attach="attributes-position"
          array={new Float32Array(particleCount * 3)}
          count={particleCount}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        attach="material"
        color="white"
        size={pointSize}
      />
    </points>
  );
}

export function ParticlesVisualizer({ audioData, isActive, typingSpeed = 0 }: ParticlesVisualizerProps) {
  return <Particles audioData={audioData} typingSpeed={typingSpeed} />;
}
