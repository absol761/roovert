'use client';

// A thin, literal "the mic is picking up sound" indicator that sits directly
// above the chat composer - distinct from the ambient 3D background
// visualizer, which is deliberately abstract and easy to miss at a glance.
// Plain 2D canvas (not R3F/three) is the right tool here: a few dozen bars
// redrawn every frame is cheap, and pulling in the whole three.js stack for
// a strip this small would be wasteful.

import { useEffect, useRef } from 'react';

interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
}

interface MicFrequencyBarsProps {
  bandsRef: React.RefObject<AudioBands>;
  levelRef: React.RefObject<number>;
}

const BAR_COUNT = 30;
const ACCENT_REFRESH_MS = 500;

export function MicFrequencyBars({ bandsRef, levelRef }: MicFrequencyBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The canvas is stretched to the composer's full width via CSS - without
    // matching the backing store to the rendered size (and device pixel
    // ratio) it'd look blurry/pixelated on anything wider than the default
    // intrinsic canvas size.
    // CSS-pixel drawing dimensions - draw() below uses these, not
    // canvas.width/height, since the context transform already scales by
    // devicePixelRatio (drawing in device pixels would double-scale).
    const size = { width: 0, height: 0 };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.width = rect.width;
      size.height = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let rafId = 0;
    let accentColor = '#7b68ee';
    // Re-reading the CSS var directly in the draw loop would be wasteful -
    // themes don't change every frame, so a periodic re-read is plenty.
    const refreshAccent = () => {
      accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accentColor;
    };
    refreshAccent();
    const accentInterval = setInterval(refreshAccent, ACCENT_REFRESH_MS);

    // Per-bar phase offsets so idle motion (no/quiet mic) looks like a gentle
    // ambient ripple rather than a flat, frozen-looking line.
    const idlePhases = Array.from({ length: BAR_COUNT }, (_, i) => i * 0.4);

    const draw = () => {
      const { width, height } = size;
      ctx.clearRect(0, 0, width, height);

      const bands = bandsRef.current;
      const level = levelRef.current;
      const barWidth = width / BAR_COUNT;
      const gap = barWidth * 0.3;
      const t = performance.now() / 600;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Sweep bass -> mid -> treble across the strip left to right, same
        // spirit as a classic frequency-bar EQ display.
        const bandT = i / (BAR_COUNT - 1);
        const bandEnergy = bandT < 0.4
          ? bands.bass
          : bandT < 0.7
            ? bands.mid
            : bands.treble;

        const idleWobble = (Math.sin(t + idlePhases[i]) * 0.5 + 0.5) * 0.12;
        const energy = Math.max(idleWobble, level * 0.5 + bandEnergy * 0.8);
        const barHeight = Math.max(2, Math.min(1, energy) * height);

        const x = i * barWidth + gap / 2;
        const y = (height - barHeight) / 2;
        const w = barWidth - gap;

        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.5 + Math.min(1, energy) * 0.5;
        ctx.beginPath();
        // roundRect is broadly supported in evergreen browsers; falls back
        // to a plain rect if unavailable rather than crashing.
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, barHeight, w / 2);
        } else {
          ctx.rect(x, y, w, barHeight);
        }
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(accentInterval);
      resizeObserver.disconnect();
    };
  }, [bandsRef, levelRef]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={32}
      className="w-full h-8 rounded-[var(--radius-pill)]"
      aria-hidden="true"
    />
  );
}
