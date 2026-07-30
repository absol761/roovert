'use client';

import { useEffect, useRef, useState } from 'react';

// Single shared mic-driven audio level for anything that wants to react to
// real sound (the nav's pulsing orb button + the R3F visualizer's particle
// motion). Previously each consumer opened its own getUserMedia stream -
// this samples once and hands out both a React-state value (for UI that
// re-renders, throttled so it doesn't thrash) and a ref (for rAF-driven
// canvas code that must not re-render on every frame).
export function useMicLevel(enabled: boolean) {
  const [level, setLevel] = useState(0);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      levelRef.current = 0;
      // Deferred (not a synchronous setState-in-effect) so React doesn't
      // cascade a render while this effect is still committing.
      queueMicrotask(() => setLevel(0));
      return;
    }

    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let rafId = 0;
    let uiInterval: ReturnType<typeof setInterval> | undefined;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = mediaStream;
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const sample = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((sum, v) => sum + v, 0) / data.length / 255;
          // Exponential smoothing so it reacts to speech/music without
          // jittering on every single frame.
          levelRef.current += (avg - levelRef.current) * 0.25;
          rafId = requestAnimationFrame(sample);
        };
        sample();

        // The canvas reads levelRef directly every frame; React only needs
        // enough updates to look smooth for the small UI indicator (~15fps).
        uiInterval = setInterval(() => setLevel(levelRef.current), 66);
      }).catch(() => {
        // Mic permission denied/unavailable - stay at idle 0, no crash.
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (uiInterval) clearInterval(uiInterval);
      stream?.getTracks().forEach((t) => t.stop());
      audioContext?.close().catch(() => {});
    };
  }, [enabled]);

  return { level, levelRef };
}
