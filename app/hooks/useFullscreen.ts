'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

// Fullscreen API support (see isFullscreenSupported below) never changes at
// runtime, so the store has nothing to notify subscribers about - the
// subscribe function is a permanent no-op.
function fullscreenSupportSubscribe() {
  return () => {};
}
function getFullscreenSupportSnapshot() {
  return typeof document !== 'undefined' && !!document.fullscreenEnabled;
}
function getFullscreenSupportServerSnapshot() {
  return false;
}

// Fullscreen state + toggle + support detection for the composer's
// Maximize/Minimize control.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // iOS Safari (the dominant mobile browser on the one platform where this
  // app has no alternative rendering engine) has no Fullscreen API support -
  // document.fullscreenEnabled is false there. Without this check the button
  // rendered unconditionally and just silently did nothing when tapped,
  // unlike every other unsupported-feature control in this file (dictation,
  // image-gen) which hide themselves instead of looking broken.
  // useSyncExternalStore reads this browser-only value without a
  // setState-in-effect: the server snapshot is always `false` (matching SSR,
  // where `document` doesn't exist), and the real value is read on the
  // client during render, avoiding a hydration mismatch and the extra
  // post-mount render a `useEffect` + `useState` pair would cause.
  const isFullscreenSupported = useSyncExternalStore(
    fullscreenSupportSubscribe,
    getFullscreenSupportSnapshot,
    getFullscreenSupportServerSnapshot
  );

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
    }
  };

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return { isFullscreen, isFullscreenSupported, toggleFullscreen };
}
