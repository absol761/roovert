'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { type Group } from 'three';
import { type GLTF } from 'three-stdlib';
import * as THREE from 'three';

interface HorseVisualizerProps {
  audioData: Uint8Array | null;
  isActive: boolean;
  typingSpeed?: number;
}

type GLTFResult = GLTF & {
  nodes: {
    mesh_0: THREE.Mesh;
  };
  materials: Record<string, never>;
  animations: GLTFAction[];
};

type ActionName = 'horse_A_';

interface GLTFAction extends THREE.AnimationClip {
  name: ActionName;
}

// Simple horse geometry as fallback if model not available
const createHorseGeometry = () => {
  const group = new THREE.Group();
  
  // Body (box)
  const bodyGeometry = new THREE.BoxGeometry(2, 1, 0.8);
  const body = new THREE.Mesh(bodyGeometry);
  body.position.y = 0.5;
  group.add(body);
  
  // Head (box)
  const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const head = new THREE.Mesh(headGeometry);
  head.position.set(1.2, 0.8, 0);
  group.add(head);
  
  // Legs
  const legGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
  const positions = [
    [-0.6, -0.5, 0.3],
    [0.6, -0.5, 0.3],
    [-0.6, -0.5, -0.3],
    [0.6, -0.5, -0.3],
  ];
  
  positions.forEach((pos) => {
    const leg = new THREE.Mesh(legGeometry);
    leg.position.set(pos[0], pos[1], pos[2]);
    group.add(leg);
  });
  
  return group;
};

function Horse({ audioData, typingSpeed = 0 }: { audioData: Uint8Array | null; typingSpeed?: number }) {
  const group = useRef<Group>(null);
  
  // Try to load GLTF model - matching original repo implementation
  let nodes: any = null;
  let animations: GLTFAction[] = [];
  let useModel = false;
  let actions: any = null;
  
  try {
    // Try to load the horse model - matching original repo pattern
    // const gltf = useGLTF('/models/horse.glb') as GLTFResult;
    // nodes = gltf.nodes;
    // animations = gltf.animations;
    // useModel = true;
    // const { actions: loadedActions } = useAnimations(animations, group);
    // actions = loadedActions;
  } catch (e) {
    console.log('Horse model not found, using fallback geometry');
  }

  // Material matching original repo - meshStandardMaterial with flatShading
  const material = useMemo(() => {
    return (
      <meshStandardMaterial
        color={0x00ffff}
        flatShading={true}
        wireframe={false}
      />
    );
  }, []);

  // Create simple horse geometry
  const horseGeometry = useMemo(() => createHorseGeometry(), []);

  // Animation matching original repo exactly
  // The original only modulates animation time scale, not rotation/scale
  useFrame(({ clock }) => {
    if (!group.current) return;
    
    const t = clock.getElapsedTime();
    
    // Match original repo: animation time scale modulation
    // This is the ONLY animation control in the original
    if (actions && actions.horse_A_) {
      const rateOfChange = 0.5;
      let tScale = (Math.sin(rateOfChange * t) + 1) / 2;
      
      // Add audio reactivity to time scale (if audio is available)
      if (audioData && audioData.length > 0) {
        let sum = 0;
        const bassRange = Math.min(20, audioData.length);
        for (let i = 0; i < bassRange; i++) {
          sum += audioData[i];
        }
        const average = sum / bassRange;
        const normalized = Math.min(average / 255, 1);
        // Audio modulates the time scale (makes animation faster/slower)
        tScale = tScale * (0.5 + normalized * 1.5); // Range: 0.5x to 2x speed
      }
      
      // Typing speed also modulates time scale
      if (typingSpeed > 0) {
        tScale = tScale * (1 + typingSpeed * 0.5); // Up to 1.5x speed
      }
      
      actions.horse_A_.setEffectiveTimeScale(tScale);
    } else {
      // Fallback: if no model/animation, add subtle rotation for visual interest
      // But keep it minimal to match original style
      group.current.rotation.y = t * 0.1;
    }
  });

  // Play animation on mount (matching original)
  useEffect(() => {
    if (actions?.horse_A_) {
      actions.horse_A_.play();
    }
  }, [actions]);

  return (
    <group
      ref={group}
      scale={[0.025, 0.025, 0.025]}
      rotation={[Math.PI / 2, Math.PI, 0]}
      dispose={null}
    >
      <group name="AuxScene">
        <pointLight position={[10, 100, 200]} intensity={100} />
        {useModel && nodes ? (
          <mesh
            name="mesh_0"
            castShadow
            receiveShadow
            geometry={nodes.mesh_0.geometry}
            morphTargetDictionary={nodes.mesh_0.morphTargetDictionary}
            morphTargetInfluences={nodes.mesh_0.morphTargetInfluences}
          >
            {material}
          </mesh>
        ) : (
          <primitive object={horseGeometry}>
            {material}
          </primitive>
        )}
      </group>
    </group>
  );
}

export function HorseVisualizer({ audioData, isActive, typingSpeed = 0 }: HorseVisualizerProps) {
  return <Horse audioData={audioData} typingSpeed={typingSpeed} />;
}
