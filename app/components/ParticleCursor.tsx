'use client';

import { useEffect, useRef } from 'react';

export function ParticleCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    glow: string;
  }>>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Color palette: blues, purples, pinks
    const colors = [
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#a855f7', // purple-500
      '#ec4899', // pink-500
      '#06b6d4', // cyan-500
      '#6366f1', // indigo-500
      '#f472b6', // pink-400
      '#818cf8', // indigo-400
    ];

    // Easing function for smooth fade-out
    const easeOutQuart = (t: number): number => {
      return 1 - Math.pow(1 - t, 4);
    };

    // Check if cursor is over chatbot area
    const isOverChatbot = (x: number, y: number): boolean => {
      // Check if we're over elements with chat-related classes
      const element = document.elementFromPoint(x, y);
      if (!element) return false;
      
      // Check if element or its parents have chat-related classes or IDs
      let current: HTMLElement | null = element as HTMLElement;
      while (current) {
        const classList = current.classList;
        const id = current.id;
        
        // Check for chat-related identifiers
        if (
          classList?.contains('chat-stack') ||
          classList?.contains('interface-grid') ||
          classList?.contains('intel-panel') ||
          id === 'chat-container' ||
          current.closest('.chat-stack') ||
          current.closest('.interface-grid') ||
          current.closest('[data-chat-area]')
        ) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    // Create a new particle
    const createParticle = (x: number, y: number) => {
      if (isOverChatbot(x, y)) return; // Don't create particles over chatbot

      const color = colors[Math.floor(Math.random() * colors.length)];
      const maxLife = 0.8 + Math.random() * 0.4; // 0.8-1.2 seconds
      const size = 3 + Math.random() * 2; // 3-5px
      
      // Random velocity with slight drift
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      // Add slight gravitational pull (downward)
      const gravity = 0.1;

      particlesRef.current.push({
        x,
        y,
        vx,
        vy: vy + gravity,
        life: maxLife,
        maxLife,
        size,
        color,
        glow: color,
      });

      // Limit particles to 50
      if (particlesRef.current.length > 50) {
        particlesRef.current.shift();
      }
    };

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      
      // Throttle particle creation (spawn every ~16ms for ~60fps)
      const now = performance.now();
      if (now - lastSpawnRef.current > 16) {
        createParticle(e.clientX, e.clientY);
        lastSpawnRef.current = now;
      }
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Apply slight gravitational pull
        particle.vy += 0.05;

        // Update life
        particle.life -= 0.016; // Assuming ~60fps

        if (particle.life <= 0) {
          return false; // Remove dead particles
        }

        // Calculate fade and scale
        const lifeRatio = particle.life / particle.maxLife;
        const fade = easeOutQuart(lifeRatio);
        const scale = lifeRatio;

        // Draw particle with glow
        ctx.save();
        ctx.globalAlpha = fade;
        
        // Glow effect
        ctx.shadowBlur = 8;
        ctx.shadowColor = particle.glow;
        
        // Draw circle
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(
          particle.x,
          particle.y,
          particle.size * scale,
          0,
          Math.PI * 2
        );
        ctx.fill();
        
        ctx.restore();

        return true;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resizeCanvas);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

