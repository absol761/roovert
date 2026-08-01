'use client';

import { motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Kept in sync by hand with the shortcuts actually wired up in app/page.tsx's
// global keydown handler - there's no single source of truth to generate
// this list from, so any new shortcut added there should be added here too.
const SHORTCUTS: Array<{ keys: string[]; description: string }> = [
  { keys: ['⌘/Ctrl', 'K'], description: 'Open quick actions (command palette)' },
  { keys: ['⌘/Ctrl', 'Enter'], description: 'Send message' },
  { keys: ['⌘/Ctrl', 'Shift', 'O'], description: 'Start a new chat' },
  { keys: ['⌘/Ctrl', ','], description: 'Open settings' },
  { keys: ['Esc'], description: 'Close the open dialog / stop generating' },
  { keys: ['?'], description: 'Show this shortcuts guide' },
];

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  useModalDismiss(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 id="shortcuts-modal-title" className="serif-display text-xl flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-[var(--accent)]" />
            Keyboard Shortcuts
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {SHORTCUTS.map(({ keys, description }) => (
            <div key={description} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--muted)]">{description}</span>
              <span className="flex items-center gap-1 shrink-0">
                {keys.map((key) => (
                  <kbd key={key} className="text-[11px] font-mono border border-[var(--border)] bg-[var(--surface)] rounded px-1.5 py-0.5 text-[var(--foreground)]">
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
