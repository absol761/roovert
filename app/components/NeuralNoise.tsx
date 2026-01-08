'use client';

import { useEffect, useRef, useState } from 'react';

interface NeuralNoiseProps {
  isChatMode?: boolean;
  currentLook?: string;
}

export function NeuralNoise({ isChatMode = false, currentLook = 'default' }: NeuralNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const uniformsRef = useRef<{ [key: string]: WebGLUniformLocation | null } | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, tX: 0, tY: 0 });
  const colorRef = useRef({ r: 0.1, g: 0.2, b: 0.8 });
  const [isMounted, setIsMounted] = useState(false);

  // Convert hex color to RGB (0-1 range)
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      };
    }
    return { r: 0.1, g: 0.2, b: 0.8 }; // Default teal
  };

  // Update color from CSS variable - adapts to current look with visibility optimization
  const updateColor = () => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const accentColor = getComputedStyle(root).getPropertyValue('--accent').trim();
    const backgroundColor = getComputedStyle(root).getPropertyValue('--background').trim();
    
    if (accentColor) {
      let rgb = hexToRgb(accentColor);
      
      // Detect if background is light or dark
      const bgRgb = hexToRgb(backgroundColor || '#050505');
      const bgLuminance = (bgRgb.r * 0.299 + bgRgb.g * 0.587 + bgRgb.b * 0.114);
      const isLightBackground = bgLuminance > 0.5;
      
      // Calculate accent luminance
      const accentLuminance = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
      
      // Boost brightness and saturation for visibility
      if (isLightBackground) {
        // On light backgrounds, darken and saturate the color for contrast
        const brightness = Math.max(rgb.r, rgb.g, rgb.b);
        if (brightness < 0.3) {
          // Color is too dark, brighten it significantly
          rgb.r = Math.min(1.0, rgb.r * 1.8);
          rgb.g = Math.min(1.0, rgb.g * 1.8);
          rgb.b = Math.min(1.0, rgb.b * 1.8);
        }
        // Ensure minimum brightness
        const minBrightness = 0.4;
        const currentBrightness = Math.max(rgb.r, rgb.g, rgb.b);
        if (currentBrightness < minBrightness) {
          const boost = minBrightness / currentBrightness;
          rgb.r = Math.min(1.0, rgb.r * boost);
          rgb.g = Math.min(1.0, rgb.g * boost);
          rgb.b = Math.min(1.0, rgb.b * boost);
        }
      } else {
        // On dark backgrounds, ensure color is bright enough
        const minBrightness = 0.5;
        const currentBrightness = Math.max(rgb.r, rgb.g, rgb.b);
        if (currentBrightness < minBrightness) {
          const boost = minBrightness / currentBrightness;
          rgb.r = Math.min(1.0, rgb.r * boost);
          rgb.g = Math.min(1.0, rgb.g * boost);
          rgb.b = Math.min(1.0, rgb.b * boost);
        }
      }
      
      colorRef.current = rgb;
    }
  };

  const vertexShaderSource = `
    precision mediump float;
    varying vec2 vUv;
    attribute vec2 a_position;

    void main() {
        vUv = 0.5 * (a_position + 1.0);
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec2 vUv;
    uniform float u_time;
    uniform float u_ratio;
    uniform vec2 u_pointer_position;
    uniform float u_scroll_progress;
    uniform vec3 u_accent_color;

    vec2 rotate(vec2 uv, float th) {
        return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
    }

    float neural_shape(vec2 uv, float t, float p) {
        vec2 sine_acc = vec2(0.0);
        vec2 res = vec2(0.0);
        float scale = 8.0;

        for (int j = 0; j < 15; j++) {
            uv = rotate(uv, 1.0);
            sine_acc = rotate(sine_acc, 1.0);
            vec2 layer = uv * scale + float(j) + sine_acc - t;
            sine_acc += sin(layer) + 2.4 * p;
            res += (0.5 + 0.5 * cos(layer)) / scale;
            scale *= 1.2;
        }
        return res.x + res.y;
    }

    void main() {
        vec2 uv = 0.5 * vUv;
        uv.x *= u_ratio;

        vec2 pointer = vUv - u_pointer_position;
        pointer.x *= u_ratio;
        float p = clamp(length(pointer), 0.0, 1.0);
        p = 0.5 * pow(1.0 - p, 2.0);

        float t = 0.001 * u_time;
        vec3 color = vec3(0.0);

        float noise = neural_shape(uv, t, p);

        noise = 1.2 * pow(noise, 3.0);
        noise += pow(noise, 10.0);
        noise = max(0.0, noise - 0.5);
        noise *= (1.0 - length(vUv - 0.5));

        // Use theme accent color with enhanced visibility
        // Base color is brighter for better visibility
        color = u_accent_color * 1.2; // Increased from 0.6 to 1.2 for visibility
        color += u_accent_color * 0.4 * sin(3.0 * u_scroll_progress + 1.5); // Variation
        
        // Ensure minimum brightness
        float minBrightness = 0.3;
        float currentBrightness = max(max(color.r, color.g), color.b);
        if (currentBrightness < minBrightness) {
            float boost = minBrightness / currentBrightness;
            color *= boost;
        }

        color = color * noise * 0.8; // Increased from 0.4 to 0.8 for better visibility

        gl_FragColor = vec4(color, noise * 0.6); // Increased opacity from 0.3 to 0.6
    }
  `;

  const createShader = (gl: WebGLRenderingContext, sourceCode: string, type: number): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createShaderProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  };

  const getUniforms = (gl: WebGLRenderingContext, program: WebGLProgram) => {
    const uniforms: { [key: string]: WebGLUniformLocation | null } = {};
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      if (uniformInfo) {
        uniforms[uniformInfo.name] = gl.getUniformLocation(program, uniformInfo.name);
      }
    }
    return uniforms;
  };

  const initShader = (): WebGLRenderingContext | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) {
      return null; // Silently fail if WebGL not supported
    }

    const vertexShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) return null;

    const shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader);
    if (!shaderProgram) return null;

    uniformsRef.current = getUniforms(gl, shaderProgram);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(shaderProgram);
    const positionLocation = gl.getAttribLocation(shaderProgram, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    return gl;
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl || !uniformsRef.current) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    
    if (uniformsRef.current.u_ratio) {
      gl.uniform1f(uniformsRef.current.u_ratio, canvas.width / canvas.height);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const render = () => {
    const gl = glRef.current;
    const uniforms = uniformsRef.current;
    const pointer = pointerRef.current;
    if (!gl || !uniforms) return;

    // Update color to match current look/theme
    updateColor();

    const currentTime = performance.now();
    pointer.x += (pointer.tX - pointer.x) * 0.2;
    pointer.y += (pointer.tY - pointer.y) * 0.2;

    if (uniforms.u_time) {
      gl.uniform1f(uniforms.u_time, currentTime);
    }
    if (uniforms.u_pointer_position) {
      gl.uniform2f(
        uniforms.u_pointer_position,
        pointer.x / window.innerWidth,
        1.0 - pointer.y / window.innerHeight
      );
    }
    if (uniforms.u_scroll_progress) {
      gl.uniform1f(
        uniforms.u_scroll_progress,
        Math.min(window.scrollY / (2 * window.innerHeight), 1.0)
      );
    }
    if (uniforms.u_accent_color) {
      gl.uniform3f(
        uniforms.u_accent_color,
        colorRef.current.r,
        colorRef.current.g,
        colorRef.current.b
      );
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    animationRef.current = requestAnimationFrame(render);
  };

  const updateMousePosition = (x: number, y: number) => {
    pointerRef.current.tX = x;
    pointerRef.current.tY = y;
  };

  const handlePointerMove = (e: PointerEvent) => {
    updateMousePosition(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches[0]) {
      updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleClick = (e: MouseEvent) => {
    updateMousePosition(e.clientX, e.clientY);
  };

  useEffect(() => {
    // Only run on client side to prevent hydration mismatch
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Don't render if in chat mode or not mounted
    if (isChatMode || !isMounted) return;

    glRef.current = initShader();
    if (!glRef.current) return; // WebGL not supported

    updateColor();
    resizeCanvas();
    render();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('click', handleClick);

    // Update color when look/theme changes
    const observer = new MutationObserver(() => {
      updateColor();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-look', 'data-theme'],
    });

    // Also update when currentLook prop changes
    updateColor();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('click', handleClick);
      observer.disconnect();
    };
  }, [isChatMode, isMounted, currentLook]);

  // Don't render if in chat mode or not mounted (prevents hydration mismatch)
  if (isChatMode || !isMounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
      style={{ 
        opacity: 0.7, // Increased from 0.4 for better visibility
        mixBlendMode: 'screen'
      }}
    />
  );
}

