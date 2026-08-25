'use client';

import { useEffect, useRef, useState } from 'react';

// How much of the buffered-but-not-yet-shown text to reveal per animation
// frame, as a fraction (1/CATCH_UP_DIVISOR) of what's currently buffered.
// Small enough to look like a steady, human-paced type-on at typical chunk
// sizes; large enough that a big buffer (e.g. the model finishing a long
// paragraph in one chunk while the user is still "reading" the start of it)
// catches up in well under a second instead of visibly lagging forever.
const CATCH_UP_DIVISOR = 12;

// Reveal at least this many characters per frame once there's anything
// buffered, so very small buffers (down to a single trailing character)
// don't stall out at a fractional, always-rounds-to-zero reveal rate.
const MIN_CHARS_PER_FRAME = 1;

// Only commit a React state update every Nth animation frame - the reveal
// itself still advances every frame (smooth to the eye), but re-rendering
// (and, for markdown content, re-parsing) 60 times/sec is unnecessary cost
// for something the user perceives as continuous at half that rate.
const RENDER_EVERY_N_FRAMES = 2;

/**
 * Decouples the visible reveal rate of streamed text from the raw arrival
 * rate of the underlying network chunks, so the UI types out at a smooth,
 * consistent pace instead of jumping in bursts whenever a chunk lands (some
 * providers send single tokens, others send several sentences at once).
 *
 * `target` is the full accumulated text so far (grows as chunks arrive).
 * `isStreaming` should be true for the duration of an in-flight response and
 * false once it's complete (or for already-complete text, e.g. history) -
 * flipping it false immediately snaps the display to the full `target`
 * rather than continuing to drip-feed a response that's already finished.
 */
export function useSmoothedText(target: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState(target);
  const targetRef = useRef(target);
  const displayedLenRef = useRef(target.length);
  const rafIdRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  // Read via a ref inside the rAF loop rather than as an effect dependency,
  // so a new chunk arriving mid-stream doesn't cancel and restart the loop
  // (which would happen on every single chunk if `target` were a dep).
  targetRef.current = target;

  useEffect(() => {
    if (!isStreaming) {
      displayedLenRef.current = target.length;
      setDisplayed(target);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // A new streaming turn is starting - reset the reveal position rather
    // than carrying over whatever was displayed for a previous message.
    displayedLenRef.current = 0;
    frameCountRef.current = 0;
    setDisplayed('');

    const tick = () => {
      const full = targetRef.current;
      const remaining = full.length - displayedLenRef.current;
      if (remaining > 0) {
        const charsThisFrame = Math.max(MIN_CHARS_PER_FRAME, Math.ceil(remaining / CATCH_UP_DIVISOR));
        displayedLenRef.current = Math.min(full.length, displayedLenRef.current + charsThisFrame);
        frameCountRef.current += 1;
        if (frameCountRef.current % RENDER_EVERY_N_FRAMES === 0 || displayedLenRef.current === full.length) {
          setDisplayed(full.slice(0, displayedLenRef.current));
        }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omits `target`; see the ref comment above.
  }, [isStreaming]);

  return displayed;
}
