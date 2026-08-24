'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  query: string;
  isProcessing: boolean;
  onSubmit: (e: { preventDefault: () => void }) => void;
  onStop: () => void;
  onNewChat: () => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenShortcutsHelp: () => void;
}

// Global keyboard shortcuts: Cmd/Ctrl+Enter to submit, Escape to stop,
// Cmd/Ctrl+K for the command palette, Cmd/Ctrl+Shift+O for a new chat,
// Cmd/Ctrl+, for settings, and "?" for the shortcuts help overlay.
export function useKeyboardShortcuts({
  query,
  isProcessing,
  onSubmit,
  onStop,
  onNewChat,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenShortcutsHelp,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    // Whether the key event originated in a text input/textarea/contentEditable
    // element - guards single-character shortcuts (like "?") so they don't
    // hijack normal typing. Modifier-combo shortcuts (Cmd+K etc.) don't need
    // this: holding Cmd/Ctrl means no character is actually being typed.
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isProcessing && query.trim()) {
          onSubmit(e);
        }
        return;
      }
      // Escape to stop
      if (e.key === 'Escape' && isProcessing) {
        onStop();
        return;
      }
      // Cmd/Ctrl + K - open the quick-actions command palette
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }
      // Cmd/Ctrl + Shift + O - start a new chat (matches Claude.ai; avoids
      // Cmd+N, which browsers/OSes reserve for "new window")
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        onNewChat();
        return;
      }
      // Cmd/Ctrl + , - open settings (standard app-preferences convention)
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        onOpenSettings();
        return;
      }
      // ? - open the shortcuts help overlay, but only outside of text input
      // (so typing a literal "?" in the composer or a search box works normally)
      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault();
        onOpenShortcutsHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // onSubmit/onStop/onNewChat/onOpen* intentionally omitted: they're
    // recreated every render (not memoized) and this effect already
    // re-subscribes on every query/isProcessing change, so including them
    // would add churn with no behavioral difference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isProcessing]);
}
