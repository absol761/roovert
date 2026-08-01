'use client';

import { motion } from 'framer-motion';
import { Palette, X } from 'lucide-react';
import { LOOKS, LOOK_CATEGORIES } from '../../lib/looks';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface LooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLook: string;
  setLook: (id: string) => void;
}

export function LooksModal({ isOpen, onClose, currentLook, setLook }: LooksModalProps) {
  useModalDismiss(isOpen, onClose);
  if (!isOpen) return null;

  const looksByCategory = LOOK_CATEGORIES.map(cat => ({
    category: cat,
    looks: LOOKS.filter(l => l.category === cat)
  })).filter(cat => cat.looks.length > 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="looks-modal-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-5xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 id="looks-modal-title" className="serif-display text-2xl flex items-center gap-2.5">
            <Palette className="w-6 h-6 text-[var(--accent)]" />
            Looks
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
          {looksByCategory.map(({ category, looks }) => (
            <motion.section
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <h3 className="label mb-4 pb-2 border-b border-[var(--border)]">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {looks.map((look, idx) => (
                  <motion.button
                    key={look.id}
                    onClick={() => { setLook(look.id); onClose(); }}
                    data-look-preview={look.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03, ease: 'easeOut' }}
                    whileTap={{ scale: 0.98 }}
                    className={`look-preview-button card-hover p-4 rounded-xl border text-left relative overflow-hidden ${currentLook === look.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}
                  >
                    <div className="font-medium text-[var(--foreground)] mb-1 relative z-10 transition-transform duration-300">{look.name}</div>
                    <div className="text-xs text-[var(--muted)] relative z-10">{look.description}</div>
                    <div className="look-preview-animation absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 ease-out pointer-events-none"></div>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
