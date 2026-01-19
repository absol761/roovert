'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { type Group } from 'three';
import * as THREE from 'three';

interface TreadmillVisualizerProps {
  audioData: Uint8Array | null;
  isActive: boolean;
  typingSpeed?: number;
}

// Create treadmill belt geometry
const createTreadmillBelt = () => {
  const group = new THREE.Group();
  
  // Create a long belt with segments
  const segmentCount = 20;
  const segmentLength = 0.5;
  const beltWidth = 2;
  
  for (let i = 0; i < segmentCount; i++) {
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength, 0.1, beltWidth),
      new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true })
    );
    segment.position.x = (i - segmentCount / 2) * segmentLength;
    segment.position.y = 0;
    group.add(segment);
  }
  
  return group;
};

// Create treadmill base/platform
const createTreadmillBase = () => {
  const group = new THREE.Group();
  
  // Base platform
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x333333, wireframe: true })
  );
  base.position.y = -0.1;
  group.add(base);
  
  // Side rails
  const railGeometry = new THREE.BoxGeometry(0.1, 0.5, 3);
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true });
  
  const leftRail = new THREE.Mesh(railGeometry, railMaterial);
  leftRail.position.set(-5, 0.25, 0);
  group.add(leftRail);
  
  const rightRail = new THREE.Mesh(railGeometry, railMaterial);
  rightRail.position.set(5, 0.25, 0);
  group.add(rightRail);
  
  return group;
};

function Treadmill({ audioData, typingSpeed = 0 }: { audioData: Uint8Array | null; typingSpeed?: number }) {
  const beltRef = useRef<Group>(null);
  const baseRef = useRef<Group>(null);
  
  const beltGeometry = useMemo(() => createTreadmillBelt(), []);
  const baseGeometry = useMemo(() => createTreadmillBase(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Animate belt movement (always moving)
    if (beltRef.current) {
      // Base speed (always active)
      let speed = 0.3 + Math.sin(t * 0.2) * 0.1;
      
      // Audio modulates speed
      if (audioData && audioData.length > 0) {
        let sum = 0;
        const bassRange = Math.min(20, audioData.length);
        for (let i = 0; i < bassRange; i++) {
          sum += audioData[i];
        }
        const average = sum / bassRange;
        const normalized = Math.min(average / 255, 1);
        speed += normalized * 2.5; // Audio adds to base speed
      }
      
      // Typing speed reactivity (adds on top)
      speed += typingSpeed * 1.0;
      
      // Move belt segments continuously
      beltRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh) {
          child.position.x += speed * 0.02;
          // Loop segments
          if (child.position.x > 5) {
            child.position.x = -5;
          }
        }
      });
      
      // Continuous rotation
      beltRef.current.rotation.y = t * 0.1 + Math.sin(t * 0.3) * 0.05;
    }
    
    // Continuous base animation
    if (baseRef.current) {
      baseRef.current.rotation.y = t * 0.05 + Math.sin(t * 0.2) * 0.03;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Base */}
      <primitive ref={baseRef} object={baseGeometry} />
      
      {/* Moving Belt */}
      <group ref={beltRef}>
        <primitive object={beltGeometry} />
      </group>
    </group>
  );
}

export function TreadmillVisualizer({ audioData, isActive, typingSpeed = 0 }: TreadmillVisualizerProps) {
  return <Treadmill audioData={audioData} typingSpeed={typingSpeed} />;
}
