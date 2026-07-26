'use client';

import { motion } from 'framer-motion';
import { Palette, X } from 'lucide-react';
import { LOOKS, LOOK_CATEGORIES } from '../../lib/looks';

export function LooksModal({ isOpen, onClose, currentLook, setLook }: any) {
  if (!isOpen) return null;

  const looksByCategory = LOOK_CATEGORIES.map(cat => ({
    category: cat,
    looks: LOOKS.filter(l => l.category === cat)
  }));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-5xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-light tracking-wide flex items-center gap-2">
            <Palette className="w-6 h-6 text-[var(--accent)]" />
            Browse Looks
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
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
              <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">
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
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`look-preview-button p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden ${currentLook === look.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface)]'
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
