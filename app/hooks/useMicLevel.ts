'use client';

import { useEffect, useRef, useState } from 'react';

export type MicStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported';

export interface MicBands {
  bass: number;
  mid: number;
  treble: number;
}

// Single shared mic-driven audio analysis for anything that wants to react to
// real sound (the nav's pulsing orb button + the R3F visualizer's particle
// motion). Previously each consumer opened its own getUserMedia stream -
// this samples once and hands out both React-state values (for UI that
// re-renders, throttled so it doesn't thrash) and refs (for rAF-driven
// canvas code that must not re-render on every frame).
export function useMicLevel(enabled: boolean) {
  const [level, setLevel] = useState(0);
  const [burst, setBurst] = useState(0);
  const [status, setStatus] = useState<MicStatus>('idle');
  const levelRef = useRef(0);
  const bandsRef = useRef<MicBands>({ bass: 0, mid: 0, treble: 0 });
  // Decaying "punch" that spikes on a sudden loud transient (a clap, a word
  // hitting hard) and eases back down - lets consumers trigger a one-shot
  // flourish instead of just tracking the continuous level.
  const burstRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      levelRef.current = 0;
      burstRef.current = 0;
      bandsRef.current = { bass: 0, mid: 0, treble: 0 };
      // Deferred (not a synchronous setState-in-effect) so React doesn't
      // cascade a render while this effect is still committing.
      queueMicrotask(() => {
        setLevel(0);
        setBurst(0);
        setStatus('idle');
      });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setStatus('unsupported'));
      return;
    }

    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let rafId = 0;
    let uiInterval: ReturnType<typeof setInterval> | undefined;

    queueMicrotask(() => setStatus('requesting'));

    navigator.mediaDevices.getUserMedia({ audio: true }).then((mediaStream) => {
      if (cancelled) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = mediaStream;
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const bandOf = (from: number, to: number) => {
        // frequencyBinCount bins span 0..sampleRate/2; a fixed fraction split
        // is good enough for "does it feel bassy/bright" reactivity without
        // needing precise Hz math.
        const start = Math.floor(data.length * from);
        const end = Math.floor(data.length * to);
        let sum = 0;
        for (let i = start; i < end; i++) sum += data[i];
        return sum / Math.max(1, end - start) / 255;
      };

      const sample = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length / 255;

        const prevLevel = levelRef.current;
        // Exponential smoothing so it reacts to speech/music without
        // jittering on every single frame.
        levelRef.current += (avg - prevLevel) * 0.25;

        bandsRef.current = {
          bass: bandsRef.current.bass + (bandOf(0, 0.15) - bandsRef.current.bass) * 0.3,
          mid: bandsRef.current.mid + (bandOf(0.15, 0.5) - bandsRef.current.mid) * 0.3,
          treble: bandsRef.current.treble + (bandOf(0.5, 1) - bandsRef.current.treble) * 0.3,
        };

        // A jump well above the smoothed baseline reads as a transient -
        // pop the burst up instantly, then let it decay each frame.
        const jump = avg - prevLevel;
        if (jump > 0.18) {
          burstRef.current = Math.min(1, burstRef.current + jump * 1.5);
        }
        burstRef.current *= 0.9;

        rafId = requestAnimationFrame(sample);
      };
      sample();

      setStatus('active');
      // The canvas reads levelRef/bandsRef directly every frame; React only
      // needs enough updates to look smooth for the small UI indicator (~15fps).
      uiInterval = setInterval(() => {
        setLevel(levelRef.current);
        setBurst(burstRef.current);
      }, 66);
    }).catch(() => {
      // Mic permission denied/unavailable - stay at idle level but surface
      // the denial so UI can explain what happened instead of looking broken.
      if (!cancelled) setStatus('denied');
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (uiInterval) clearInterval(uiInterval);
      stream?.getTracks().forEach((t) => t.stop());
      audioContext?.close().catch(() => {});
    };
  }, [enabled]);

  return { level, burst, levelRef, bandsRef, burstRef, status };
}
