'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Lut } from 'three/examples/jsm/math/Lut.js';

interface GridVisualizerProps {
  audioData: Uint8Array | null;
  isActive: boolean;
  typingSpeed?: number;
}

// Default palette matching original repo (cooltowarm)
const DEFAULT_PALETTE_COLORS = [
  0x3c4ec2, // blue
  0x9bbcff, // light blue
  0xdcdcdc, // gray
  0xf6a385, // light orange
  0xb40426, // red
];

function Grid({ audioData, typingSpeed = 0 }: { audioData: Uint8Array | null; typingSpeed?: number }) {
  // Use InstancedMesh for better performance (matching original repo pattern)
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  
  // Grid parameters (matching original repo style)
  const nGridRows = 50;
  const nGridCols = 50;
  const cubeSideLength = 0.05;
  const cubeSpacingScalar = 2;
  const nInstances = nGridRows * nGridCols;
  
  // Create LUT for colors (matching original repo)
  const lut = useMemo(() => {
    const lut = new Lut();
    lut.addColorMap(
      'default',
      DEFAULT_PALETTE_COLORS.map((hex, i) => [i / (DEFAULT_PALETTE_COLORS.length - 1), hex])
    );
    lut.setColorMap('default');
    return lut;
  }, []);
  
  // Set instance colors based on radial offset (matching original repo pattern)
  useEffect(() => {
    if (!meshRef.current) return;
    const normQuadrantHypotenuse = Math.hypot(0.5, 0.5);
    for (let row = 0; row < nGridRows; row++) {
      for (let col = 0; col < nGridCols; col++) {
        const instanceIdx = row * nGridCols + col;
        const normGridX = row / (nGridRows - 1);
        const normGridY = col / (nGridCols - 1);
        const normRadialOffset = Math.hypot(normGridX - 0.5, normGridY - 0.5) / normQuadrantHypotenuse;
        meshRef.current.setColorAt(instanceIdx, lut.getColor(normRadialOffset));
      }
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [lut, nGridRows, nGridCols]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const elapsedTimeSec = clock.getElapsedTime();
    const gridSizeX = nGridRows * cubeSpacingScalar * cubeSideLength;
    const gridSizeY = nGridCols * cubeSpacingScalar * cubeSideLength;

    for (let row = 0; row < nGridRows; row++) {
      for (let col = 0; col < nGridCols; col++) {
        const instanceIdx = row * nGridCols + col;
        const normGridX = row / (nGridRows - 1);
        const normGridY = col / (nGridCols - 1);
        
        // Base wave pattern (always active - matching original repo)
        let z = Math.sin((normGridX + normGridY + elapsedTimeSec * 0.5) * Math.PI * 2) * 0.3;
        z += Math.cos((normGridX - normGridY + elapsedTimeSec * 0.3) * Math.PI * 2) * 0.2;
        
        // Audio reactivity (modulates the wave - matching original repo pattern)
        if (audioData && audioData.length > 0) {
          const dataIndex = Math.floor(normGridX * audioData.length);
          const value = audioData[dataIndex] / 255;
          z += value * 1.5; // Audio adds to base wave
        }
        
        // Typing speed reactivity
        z += typingSpeed * 1.0;
        
        const x = gridSizeX * (normGridX - 0.5);
        const y = gridSizeY * (normGridY - 0.5);
        
        // Set position using matrix (matching original repo)
        tmpMatrix.setPosition(x, y, z);
        meshRef.current.setMatrixAt(instanceIdx, tmpMatrix);
      }
    }

    // Update the instance (matching original repo)
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      castShadow={true}
      receiveShadow={true}
      args={[new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), nInstances]}
    >
      <boxGeometry
        attach="geometry"
        args={[cubeSideLength, cubeSideLength, cubeSideLength, 1]}
      />
      <meshPhongMaterial
        attach="material"
        color="white"
        toneMapped={false}
        vertexColors={true}
      />
    </instancedMesh>
  );
}

export function GridVisualizer({ audioData, isActive, typingSpeed = 0 }: GridVisualizerProps) {
  return <Grid audioData={audioData} typingSpeed={typingSpeed} />;
}
