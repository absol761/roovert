'use client';

// A single focal, organically-deforming glowing sphere - the "voice orb"
// look used by ChatGPT Advanced Voice Mode / Gemini Live / Siri. Deliberately
// a different visual language than ParticleField's diffuse point clouds: one
// shape, a fresnel rim glow, and non-rigid noise-driven displacement instead
// of a uniform scale-with-volume pulse.

import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
}

interface VoiceOrbProps {
  color1: string;
  color2: string;
  colorsFollowMusic: boolean;
  speed: number;
  timeRef: React.RefObject<number>;
  audioLevelRef: React.RefObject<number>;
  audioBandsRef: React.RefObject<AudioBands>;
  audioBurstRef: React.RefObject<number>;
}

function hexToRgbVec(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
    : [1, 1, 1];
}

// Classic Perlin-style simplex noise (Ashima Arts / Stefan Gustavson's
// well-known 3D `snoise` implementation, ubiquitous in three.js shader demos)
// inlined here so the orb's displacement doesn't need a shader-noise npm
// dependency - just GLSL string concatenation.
const NOISE_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const VERTEX_SHADER = `
${NOISE_GLSL}
uniform float uTime;
uniform float uBass;
uniform float uBurst;
uniform float uFrequency;
varying vec3 vNormal;
varying vec3 vViewPosition;

// 3-octave fractal Brownian motion - a single snoise() call reads as a
// smooth, faceted-looking blob; layering progressively finer/fainter octaves
// on top gives the surface genuine fine-grained turbulence (the "not low
// poly" surface detail) without raising the underlying icosahedron's
// triangle count at all.
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 3; i++) {
    value += amplitude * snoise(p * freq);
    freq *= 2.1;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vNormal = normalize(normalMatrix * normal);

  float noise = fbm(position * uFrequency + uTime);
  // Bass pushes the whole surface out and in with the beat; burst adds a
  // sharper, briefer spike on top for transients (claps, hard consonants).
  float displacement = noise * (0.22 + uBass * 0.55 + uBurst * 0.65);
  vec3 displaced = position + normal * displacement;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uMid;
uniform float uTreble;
uniform float uColorsFollowMusic;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.2);

  float musicMix = uColorsFollowMusic * clamp(uMid * 0.5 + uTreble * 0.7, 0.0, 1.0);
  // View-angle-driven color shift (a cheap stand-in for iridescence/thin-film
  // interference) on top of the existing fresnel mix, so the surface reads
  // as an animated energy field rather than a flat two-tone gradient.
  float iridescence = sin(fresnel * 6.28318 + vViewPosition.x * 0.4) * 0.15;
  float mixAmount = clamp(fresnel * 0.7 + musicMix * 0.3 + iridescence, 0.0, 1.0);
  vec3 color = mix(uColor1, uColor2, mixAmount);

  // Rim glow: brighten sharply toward the silhouette edge for the
  // "glowing orb" read; core stays a dim tint of color1 so bloom has
  // something bright to catch mainly at the edges.
  vec3 core = uColor1 * 0.25;
  vec3 finalColor = mix(core, color * 2.1, fresnel);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// Soft radial-gradient dot, generated once on the GPU-bound canvas rather
// than shipped as an image asset - used as the halo particles' sprite so
// they read as glowing points of light instead of flat hard-edged squares
// (the default look of an un-textured three.js PointsMaterial).
function useGlowSprite(): THREE.Texture {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

interface HaloParticle {
  theta: number;
  phi: number;
  radius: number;
  phase: number;
  speed: number;
}

// A swirling shell of light around the orb - the single biggest lever for
// "cooler, not flat," since it gives the scene depth and motion beyond one
// static mesh. Each particle orbits at its own radius/phase rather than
// rigidly rotating as a block, so the halo reads as organic energy rather
// than a spinning ring.
function OrbHalo({
  color1, color2, colorsFollowMusic, timeRef, audioBandsRef, audioBurstRef,
}: {
  color1: string;
  color2: string;
  colorsFollowMusic: boolean;
  timeRef: React.RefObject<number>;
  audioBandsRef: React.RefObject<AudioBands>;
  audioBurstRef: React.RefObject<number>;
}) {
  const count = 420;
  const pointsRef = useRef<THREE.Points>(null);
  const sprite = useGlowSprite();
  const [particles] = useState<HaloParticle[]>(() => {
    const result: HaloParticle[] = [];
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere distribution for even coverage, then a random
      // per-particle radius/phase/speed so the shell has real thickness and
      // desynchronized motion instead of every particle pulsing in lockstep.
      const theta = Math.acos(1 - 2 * (i + 0.5) / count);
      const phi = Math.PI * (1 + Math.sqrt(5)) * i;
      result.push({
        theta, phi,
        radius: 2.1 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
      });
    }
    return result;
  });

  const buffersRef = useRef<{ positions: Float32Array; colors: Float32Array; sizes: Float32Array } | null>(null);
  if (buffersRef.current == null) {
    buffersRef.current = {
      positions: new Float32Array(count * 3),
      colors: new Float32Array(count * 3),
      sizes: new Float32Array(count),
    };
  }

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;
    const geometry = points.geometry;
    const bands = audioBandsRef.current;
    const burst = audioBurstRef.current;
    const t = timeRef.current;
    const c1 = hexToRgbVec(color1);
    const c2 = hexToRgbVec(color2);
    const audioPulse = bands.bass * 0.5 + burst * 0.6;
    const { positions, colors, sizes } = buffersRef.current!;

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      // Slow independent orbit (drifting phi) plus a radial breathing
      // pulse tied to bass/burst, so the shell visibly reacts to sound
      // instead of just spinning at a constant rate.
      const orbitPhi = p.phi + t * 0.05 * p.speed;
      const pulse = Math.sin(t * p.speed + p.phase) * 0.15;
      const r = p.radius + pulse + audioPulse * 0.35;
      const x = r * Math.cos(orbitPhi) * Math.sin(p.theta);
      const y = r * Math.sin(orbitPhi) * Math.sin(p.theta);
      const z = r * Math.cos(p.theta);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const mix = colorsFollowMusic ? bands.treble : (Math.sin(p.phase + t * 0.3) * 0.5 + 0.5);
      colors[i * 3] = c1[0] + (c2[0] - c1[0]) * mix;
      colors[i * 3 + 1] = c1[1] + (c2[1] - c1[1]) * mix;
      colors[i * 3 + 2] = c1[2] + (c2[2] - c1[2]) * mix;

      sizes[i] = (0.06 + audioPulse * 0.05) * (0.6 + Math.sin(p.phase + t * p.speed) * 0.4);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry />
      <pointsMaterial
        vertexColors
        map={sprite}
        size={0.12}
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// A larger, backside-lit shell around the core orb - gives the glow a sense
// of volume (light escaping through a translucent skin) instead of the
// bloom post-effect alone, which just blurs the core's silhouette.
function GlowShell({ color, audioBurstRef }: { color: string; audioBurstRef: React.RefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.y -= delta * 0.08;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.12 + audioBurstRef.current * 0.18;
  });
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2.05, 3]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

export function VoiceOrb({
  color1, color2, colorsFollowMusic, speed, timeRef,
  audioLevelRef, audioBandsRef, audioBurstRef,
}: VoiceOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;
    const bands = audioBandsRef.current;
    const burst = audioBurstRef.current;
    const level = audioLevelRef.current;
    const uniforms = material.uniforms;

    // Idle baseline (no mic / quiet) still roils gently via the sine-driven
    // uTime term in the shader - only the *amplitude* here depends on audio,
    // mirroring ParticleField's "audioBoost" idea.
    uniforms.uTime.value = timeRef.current * speed * 0.6;
    uniforms.uBass.value = bands.bass * 0.8 + level * 0.3;
    uniforms.uBurst.value = burst;
    uniforms.uMid.value = bands.mid;
    uniforms.uTreble.value = bands.treble;

    // Gentle uniform breathing scale on top of the per-vertex noise
    // displacement, so the orb still visibly "inflates" with overall level.
    const scale = 1 + level * 0.15 + burst * 0.1;
    mesh.scale.setScalar(scale);

    // Colors/toggle kept in sync here too (cheap) rather than re-creating the
    // material whenever a palette swap or toggle happens.
    const c1 = hexToRgbVec(color1);
    const c2 = hexToRgbVec(color2);
    (uniforms.uColor1.value as THREE.Color).setRGB(c1[0], c1[1], c1[2]);
    (uniforms.uColor2.value as THREE.Color).setRGB(c2[0], c2[1], c2[2]);
    uniforms.uColorsFollowMusic.value = colorsFollowMusic ? 1 : 0;
  });

  return (
    <group>
      <mesh ref={meshRef}>
        {/* icosahedronGeometry's 2nd arg is a subdivision level, not a segment
            count - triangle count grows as 20*4^detail, so this must stay
            small (detail 6 is already ~80k triangles, plenty smooth for a
            fresnel-lit orb at this screen size). */}
        <icosahedronGeometry args={[1.6, 6]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={{
            uTime: { value: 0 },
            uBass: { value: 0 },
            uBurst: { value: 0 },
            uFrequency: { value: 1.4 },
            uColor1: { value: new THREE.Color(...hexToRgbVec(color1)) },
            uColor2: { value: new THREE.Color(...hexToRgbVec(color2)) },
            uMid: { value: 0 },
            uTreble: { value: 0 },
            uColorsFollowMusic: { value: colorsFollowMusic ? 1 : 0 },
          }}
        />
      </mesh>
      <GlowShell color={color1} audioBurstRef={audioBurstRef} />
      <OrbHalo
        color1={color1} color2={color2} colorsFollowMusic={colorsFollowMusic}
        timeRef={timeRef} audioBandsRef={audioBandsRef} audioBurstRef={audioBurstRef}
      />
    </group>
  );
}
