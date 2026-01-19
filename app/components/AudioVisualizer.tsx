'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Lut } from 'three/examples/jsm/math/Lut.js';
import { HorseVisualizer } from './HorseVisualizer';
import { TreadmillVisualizer } from './TreadmillVisualizer';
import { GridVisualizer } from './GridVisualizer';
import { ParticlesVisualizer } from './ParticlesVisualizer';
import { WavesVisualizer } from './WavesVisualizer';
import { VisualizerSelector } from './VisualizerSelector';

interface AudioVisualizerProps {
  isActive: boolean;
  mode?: 'sphere' | 'horse' | 'treadmill' | 'grid' | 'particles' | 'waves' | 'audio' | 'interaction';
  showSelector?: boolean;
}

export function AudioVisualizer({ isActive, mode: initialMode = 'sphere', showSelector = true }: AudioVisualizerProps) {
  // Handle 'audio' and 'interaction' modes - map to sphere for now
  const resolvedMode = initialMode === 'audio' || initialMode === 'interaction' ? 'sphere' : initialMode;
  const [currentMode, setCurrentMode] = useState(resolvedMode);
  const isInteractionMode = initialMode === 'interaction';
  
  // Allow free mode switching - users can change modes at any time
  // Only initialize to sphere when first mounting with audio/interaction mode
  useEffect(() => {
    // Only set initial mode once on mount
    if (initialMode === 'audio' || initialMode === 'interaction') {
      // Don't override if user has already selected a mode
      const validModes = ['sphere', 'horse', 'treadmill', 'grid', 'particles', 'waves'];
      if (!validModes.includes(currentMode)) {
        setCurrentMode('sphere');
      }
    }
  }, []); // Only run once on mount
  const [typingSpeed, setTypingSpeed] = useState(0);
  
  // Track typing speed for all modes
  useEffect(() => {
    if (!isActive) {
      setTypingSpeed(0);
      return;
    }

    let lastTypingTime = Date.now();
    let typingCount = 0;
    let speedInterval: NodeJS.Timeout;

    const handleTyping = () => {
      const now = Date.now();
      const timeDiff = now - lastTypingTime;
      
      // Reset count if too much time has passed (more than 1 second)
      if (timeDiff > 1000) {
        typingCount = 1;
        lastTypingTime = now;
      } else {
        typingCount++;
      }
      
      if (timeDiff > 0 && timeDiff < 1000) {
        const speed = typingCount / (timeDiff / 1000); // characters per second
        setTypingSpeed(Math.min(1, speed / 10)); // Normalize to 0-1 (max 10 chars/sec)
      }
      
      lastTypingTime = now;
    };

    // Update typing speed decay
    speedInterval = setInterval(() => {
      setTypingSpeed(prev => Math.max(0, prev * 0.9)); // Decay over time
    }, 100);

    const inputElements = document.querySelectorAll('input, textarea');
    inputElements.forEach(el => {
      el.addEventListener('input', handleTyping);
      el.addEventListener('keydown', handleTyping);
    });

    return () => {
      inputElements.forEach(el => {
        el.removeEventListener('input', handleTyping);
        el.removeEventListener('keydown', handleTyping);
      });
      clearInterval(speedInterval);
      setTypingSpeed(0);
    };
  }, [isActive]);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const audioStartedRef = useRef(false);
  const isAnimatingRef = useRef(false);

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      streamRef.current = stream;
      setIsListening(true);
      audioStartedRef.current = true;
      setAudioStarted(true);
      setError(null);

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if suspended (required for some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 512; // Higher for better frequency resolution
      analyser.smoothingTimeConstant = 0.3; // Lower for more reactive
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);
      // Don't connect to destination to avoid feedback

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      let errorMessage = 'Failed to access microphone';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please enable microphone permissions in your browser settings and try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application. Please close other apps using the microphone.';
      } else {
        errorMessage = err.message || 'Failed to access microphone. Please check your browser settings.';
      }
      setError(errorMessage);
      setIsListening(false);
      audioStartedRef.current = false;
      setAudioStarted(false);
    }
  };

  useEffect(() => {
    // Only initialize sphere mode if it's the current mode
    if (!isActive || !containerRef.current || currentMode !== 'sphere') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (e) {
          // Element might already be removed
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      // Don't clean up audio when switching modes - keep it running
      // Only clean up renderer/scene for mode switching
      if (!isActive) {
        // Only clean up audio if completely deactivating
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        setIsListening(false);
        audioStartedRef.current = false;
        setAudioStarted(false);
      }
      return;
    }

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Get container dimensions
    const updateSize = () => {
      if (!containerRef.current) return { width: window.innerWidth, height: window.innerHeight };
      return {
        width: containerRef.current.clientWidth || window.innerWidth,
        height: containerRef.current.clientHeight || window.innerHeight
      };
    };

    const { width, height } = updateSize();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 3;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

           // Create InstancedMesh with spherical distribution (matching original repo pattern)
           const TWO_PI = 2 * Math.PI;
           const nPoints = 800;
           const radius = 2;
           const cubeSideLength = 0.05;
           
           // Default palette matching original repo (cooltowarm)
           const DEFAULT_PALETTE_COLORS = [
             0x3c4ec2, // blue
             0x9bbcff, // light blue
             0xdcdcdc, // gray
             0xf6a385, // light orange
             0xb40426, // red
           ];
           
           // Create LUT for colors (matching original repo)
           const lut = new Lut();
           lut.addColorMap(
             'default',
             DEFAULT_PALETTE_COLORS.map((hex, i) => [i / (DEFAULT_PALETTE_COLORS.length - 1), hex])
           );
           lut.setColorMap('default');
           
           const instancedMesh = new THREE.InstancedMesh(
             new THREE.BoxGeometry(cubeSideLength, cubeSideLength, cubeSideLength, 1),
             new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, vertexColors: true }),
             nPoints
           );
           
           // Initialize positions and colors using golden angle spiral (Fibonacci sphere distribution)
           const tmpMatrix = new THREE.Matrix4();
           for (let i = 0; i < nPoints; i++) {
             const k = i + 0.5;
             // range 0:PI
             const phi = Math.acos(1 - (2 * k) / nPoints) % Math.PI;
             // range 0:2PI - using golden angle (1 + sqrt(5)) for even distribution
             const theta = (Math.PI * (1 + Math.sqrt(5)) * k) % TWO_PI;
             const x = Math.cos(theta) * Math.sin(phi);
             const y = Math.sin(theta) * Math.sin(phi);
             const z = Math.cos(phi);
             
             tmpMatrix.setPosition(x * radius, y * radius, z * radius);
             instancedMesh.setMatrixAt(i, tmpMatrix);
             
             // Set color based on index (matching original repo)
             instancedMesh.setColorAt(i, lut.getColor(i / nPoints));
           }
           instancedMesh.instanceColor!.needsUpdate = true;
           
           scene.add(instancedMesh);
           meshRef.current = instancedMesh as any; // Store as mesh ref for compatibility
           scene.userData.instancedMesh = instancedMesh;
           scene.userData.tmpMatrix = tmpMatrix;
           scene.userData.nPoints = nPoints;
           scene.userData.radius = radius;
           scene.userData.TWO_PI = TWO_PI;
           scene.userData.lut = lut;
           
           // Initialize start time for animation
           scene.userData.startTime = Date.now();

    // Window resize handler
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
      
      const { width: newWidth, height: newHeight } = updateSize();
      
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Initialize start time
    scene.userData.startTime = Date.now();

    // Animation loop - ALWAYS runs when active
    isAnimatingRef.current = true;
    let animationId: number;
    
    const animate = () => {
      // Check if we should continue animating
      if (!isActive || currentMode !== 'sphere' || !isAnimatingRef.current || !containerRef.current) {
        isAnimatingRef.current = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        window.removeEventListener('resize', handleResize);
        return;
      }
      
      // Always schedule next frame first
      animationId = requestAnimationFrame(animate);
      animationFrameRef.current = animationId;
      
      // Verify all refs are still valid
      if (!meshRef.current || !cameraRef.current || !rendererRef.current || !sceneRef.current || !containerRef.current) {
        return;
      }
      
      // Verify renderer DOM element is still in the container
      if (!containerRef.current.contains(rendererRef.current.domElement)) {
        return;
      }

      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const instancedMesh = scene.userData.instancedMesh as THREE.InstancedMesh;
      const tmpMatrix = scene.userData.tmpMatrix as THREE.Matrix4;
      const nPoints = scene.userData.nPoints as number;
      const radius = scene.userData.radius as number;
      const TWO_PI = scene.userData.TWO_PI as number;

      if (!instancedMesh) return;

      // Continuous rotation (always active) - using elapsed time
      const startTime = scene.userData.startTime || Date.now();
      if (!scene.userData.startTime) scene.userData.startTime = startTime;
      const elapsed = (Date.now() - startTime) * 0.001;
      const elapsedTimeSec = elapsed;

      // Update instanced mesh positions using golden angle spiral (matching original repo)
      let k, phi, theta, x, y, z, effectiveRadius;
      
      // Get audio data for reactivity
      let audioValues: number[] = [];
      if (audioStartedRef.current && analyserRef.current) {
        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        audioValues = Array.from(freqData).map(v => v / 255);
      }
      
      // Get interaction intensity
      const interactionIntensity = isInteractionMode ? ((window as any).__vibeInteractionIntensity || 0) : 0;
      const typingModifier = typingSpeed * 0.5;

      for (let i = 0; i < nPoints; i++) {
        k = i + 0.5;
        // range 0:PI
        phi = Math.acos(1 - (2 * k) / nPoints) % Math.PI;
        // range 0:2PI - using golden angle for even distribution
        theta = (Math.PI * (1 + Math.sqrt(5)) * k) % TWO_PI;
        x = Math.cos(theta) * Math.sin(phi);
        y = Math.sin(theta) * Math.sin(phi);
        z = Math.cos(phi);

        // Base radius with audio reactivity (matching original repo pattern)
        effectiveRadius = radius;
        
        // Add audio reactivity based on polar coordinates
        if (audioValues.length > 0) {
          const normalizedTheta = theta / TWO_PI;
          const normalizedPhi = phi / Math.PI;
          const audioIndex = Math.floor(normalizedTheta * audioValues.length);
          const audioValue = audioValues[audioIndex] || 0;
          effectiveRadius += 0.25 * radius * audioValue;
        }
        
        // Add interaction/typing reactivity
        effectiveRadius += (interactionIntensity + typingModifier) * radius * 0.3;

        instancedMesh.setMatrixAt(
          i,
          tmpMatrix.setPosition(
            x * effectiveRadius,
            y * effectiveRadius,
            z * effectiveRadius,
          ),
        );
      }

      // Update the instance matrix (matching original repo)
      instancedMesh.instanceMatrix.needsUpdate = true;
      
      // Rotate entire sphere group
      instancedMesh.rotation.y = elapsed * 0.3;
      instancedMesh.rotation.x = Math.sin(elapsed * 0.2) * 0.2;

      renderer.render(scene, camera);
    };

    // Start animation immediately
    animate();

    // Cleanup function
    return () => {
      isAnimatingRef.current = false;
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      
      if (rendererRef.current && containerRef.current) {
        try {
          if (containerRef.current.contains(rendererRef.current.domElement)) {
            containerRef.current.removeChild(rendererRef.current.domElement);
          }
        } catch (e) {
          // Element might already be removed
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      if (sceneRef.current) {
        // Clean up InstancedMesh if it exists
        const instancedMesh = sceneRef.current.userData.instancedMesh;
        if (instancedMesh) {
          instancedMesh.dispose();
          sceneRef.current.remove(instancedMesh);
        }
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      
      meshRef.current = null;
      
      // Only clean up audio if completely deactivating, not when switching modes
      if (!isActive) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        setIsListening(false);
        audioStartedRef.current = false;
        setAudioStarted(false);
      }
    };
         }, [isActive, currentMode]);

  if (!isActive) {
    return null;
  }

  // State to pass audio data to React Three Fiber modes
  const [currentAudioData, setCurrentAudioData] = useState<Uint8Array | null>(null);

  // Update audio data continuously for all React Three Fiber modes
  useEffect(() => {
    if (!audioStarted || !analyserRef.current) {
      setCurrentAudioData(null);
      return;
    }

    let animationFrameId: number;
    let isRunning = true;
    
    const updateAudioData = () => {
      if (!isRunning || !analyserRef.current || !audioStartedRef.current) {
        return;
      }
      
      try {
        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        setCurrentAudioData(freqData);
        animationFrameId = requestAnimationFrame(updateAudioData);
      } catch (error) {
        console.error('Error updating audio data:', error);
      }
    };
    
    updateAudioData();

    return () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [audioStarted]);

  // Shared UI components for all React Three Fiber modes
  const R3FModeUI = () => (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Visualizer Selector - On the right side */}
      {showSelector && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-auto">
          <VisualizerSelector currentMode={currentMode} onModeChange={setCurrentMode} />
        </div>
      )}
      {!audioStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              startAudio();
            }}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Start Audio
          </button>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-xs text-red-400 bg-black/80 px-2 py-1 rounded pointer-events-auto">
          {error}
        </div>
      )}
    </div>
  );

  // Render React Three Fiber modes with shared Canvas (matching original repo)
  if (currentMode !== 'sphere') {
    return (
      <>
        <R3FModeUI />
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Canvas
            camera={{
              fov: 45,
              near: 1,
              far: 1000,
              position: [-17, -6, 6.5],
              up: [0, 0, 1],
            }}
            linear={true}
            gl={{ antialias: true }}
            frameloop="always"
          >
            <color attach="background" args={['#010204']} />
            <fog attach="fog" args={['#010204', 0, 100]} />
            <ambientLight intensity={Math.PI} />
            
            {currentMode === 'horse' && (
              <HorseVisualizer audioData={currentAudioData} typingSpeed={typingSpeed} isActive={true} />
            )}
            {currentMode === 'treadmill' && (
              <TreadmillVisualizer audioData={currentAudioData} typingSpeed={typingSpeed} isActive={true} />
            )}
            {currentMode === 'grid' && (
              <GridVisualizer audioData={currentAudioData} typingSpeed={typingSpeed} isActive={true} />
            )}
            {currentMode === 'particles' && (
              <ParticlesVisualizer audioData={currentAudioData} typingSpeed={typingSpeed} isActive={true} />
            )}
            {currentMode === 'waves' && (
              <WavesVisualizer audioData={currentAudioData} typingSpeed={typingSpeed} isActive={true} />
            )}
          </Canvas>
        </div>
      </>
    );
  }

  // Render sphere mode using vanilla Three.js
  return (
    <>
      {/* Background canvas - no pointer events */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      
      {/* UI Overlay - separate layer with pointer events */}
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Visualizer Selector - On the right side of the visualizer */}
        {showSelector && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-auto">
            <VisualizerSelector currentMode={currentMode} onModeChange={setCurrentMode} />
          </div>
        )}
        
        {!isInteractionMode && !audioStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                startAudio();
              }}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium shadow-lg shadow-cyan-500/50"
            >
              Start Audio
            </button>
          </div>
        )}
        {error && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 text-xs text-red-400 bg-black/80 px-2 py-1 rounded pointer-events-auto">
            {error}
          </div>
        )}
      </div>
    </>
  );
}
