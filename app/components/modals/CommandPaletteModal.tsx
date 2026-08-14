'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface CommandAction {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  // Extra terms matched against the search query alongside the label/category
  // (e.g. a model's provider name) without cluttering what's actually shown.
  keywords?: string;
  onSelect: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

// Cmd/Ctrl+K quick-actions palette. Search is plain case-insensitive
// substring matching against label/category/keywords - no fuzzy-match
// library, per the "no new dependencies" constraint this shipped under.
export function CommandPaletteModal({ isOpen, onClose, actions }: CommandPaletteModalProps) {
  useModalDismiss(isOpen, onClose);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // The parent only mounts this component while isOpen is true (it's
  // conditionally rendered inside an AnimatePresence block), so every open
  // is a fresh mount - query/activeIndex already start at their initial
  // values above with no reset effect needed. useFocusTrap moves focus to
  // the first focusable element in the dialog on open (the search input,
  // since it's first in DOM order), traps Tab/Shift+Tab inside it, and
  // returns focus to the trigger on close.
  useFocusTrap(isOpen, containerRef);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.keywords ? a.keywords.toLowerCase().includes(q) : false)
    );
  }, [actions, query]);

  // Re-derived during render (React's documented pattern for "adjust state
  // when a prop/value changes") rather than in an effect, so the index reset
  // lands in the same commit as the query change instead of one tick later.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  if (!isOpen) return null;

  const runAction = (action: CommandAction) => {
    action.onSelect();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = filtered[activeIndex];
      if (action) runAction(action);
    }
  };

  // Group by category while preserving filtered order, so results stay
  // sorted by relevance within each group rather than alphabetically.
  const groups: Array<{ category: string; items: CommandAction[] }> = [];
  for (const action of filtered) {
    const group = groups.find(g => g.category === action.category);
    if (group) {
      group.items.push(action);
    } else {
      groups.push({ category: action.category, items: [action] });
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center p-4 pt-[12vh] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            aria-label="Search commands"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--muted)]"
          />
          <kbd className="hidden sm:inline text-[10px] text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="overflow-y-auto custom-scrollbar py-2">
          {groups.length === 0 && (
            <div className="px-4 py-6 text-sm text-[var(--muted)] text-center">No matching actions</div>
          )}
          {groups.map(group => (
            <div key={group.category} className="mb-1">
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">{group.category}</div>
              {group.items.map(action => {
                const index = filtered.indexOf(action);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => runAction(action)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${isActive
                      ? 'bg-[var(--accent)]/10 text-[var(--foreground)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]'
                      }`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center shrink-0 text-[var(--accent)]">{action.icon}</span>
                    <span className="flex-1 truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
