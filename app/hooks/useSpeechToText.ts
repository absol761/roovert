'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// This is a separate concern from useMicLevel: that hook opens its own
// getUserMedia + Web Audio AnalyserNode stream purely to drive visual
// reactivity (the nav's pulsing indicator, the R3F visualizer). This hook
// uses the browser's built-in Web Speech API instead, which manages its own
// microphone access and permission prompt independently - deliberately not
// sharing a stream with useMicLevel, since the two have nothing in common
// beyond "uses the mic."

// lib.dom.d.ts in this repo declares some SpeechRecognition sub-interfaces
// but not the main constructor or the small subset of members actually used
// here, so we hand-write just those instead of pulling in a whole
// @types/dom-speech-recognition dependency for ~8 members.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

// Readable messages for the errors actually worth surfacing to the user;
// anything else falls back to a generic message rather than a raw error code.
function describeError(code: string): string {
  switch (code) {
    case 'no-speech':
      return 'No speech detected. Try again.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked for dictation.';
    case 'network':
      return 'Dictation needs a network connection.';
    default:
      return 'Dictation stopped unexpectedly.';
  }
}

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported = typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Stop cleanly on unmount so a lingering recognition session doesn't keep
  // the mic indicator lit after the component using it is gone. Handlers are
  // detached first - stop() doesn't fire its events synchronously, so
  // without this a late onresult/onend can still run after unmount and call
  // back into onInterim/onFinal/setIsListening for a component that's gone.
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback((onInterim: (text: string) => void, onFinal: (text: string) => void) => {
    if (!isSupported) {
      setError('Dictation isn’t supported in this browser.');
      return;
    }
    // Already listening - treat a second start() as a no-op rather than
    // opening a second overlapping recognition session.
    if (recognitionRef.current) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          onFinal(transcript);
        } else {
          interim += transcript;
        }
      }
      if (interim) onInterim(interim);
    };

    recognition.onerror = (event) => {
      // Ignore events from an instance that's already been superseded (see
      // onend below) - calling the shared stop() here would otherwise tear
      // down whatever newer session is currently in recognitionRef.
      if (recognitionRef.current !== recognition) return;
      // 'no-speech' fires constantly in normal pause-while-thinking use, so
      // it shouldn't stop the session or show as a scary error.
      if (event.error === 'no-speech') return;
      setError(describeError(event.error));
      stop();
    };

    recognition.onend = () => {
      // A stale session's 'end' event can arrive after a newer session has
      // already replaced it in the ref (e.g. stop() + start() while the old
      // instance is still asynchronously winding down) - only clear state if
      // this handler's own instance is still the current one, so it doesn't
      // clobber a session that's actually still listening.
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setIsListening(false);
    };

    setError(null);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [isSupported, stop]);

  return { isSupported, isListening, start, stop, error };
}
