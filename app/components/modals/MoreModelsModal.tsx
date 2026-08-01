'use client';

import { motion } from 'framer-motion';
import { Sparkles, X, Zap } from 'lucide-react';
import { type Model } from '../../lib/models';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { MODAL_TRANSITION, EASE_OUT } from '../../lib/motion';

const CATEGORIES = ['Standard', 'Advanced', 'Premium', 'OpenRouter', 'Hugging Face'];

export function MoreModelsModal({
  isOpen,
  onClose,
  models,
  selectedModelId,
  onSelectModel,
  onInitialize,
}: {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  onInitialize: () => void;
}) {
  useModalDismiss(isOpen, onClose);
  if (!isOpen) return null;

  const modelsByCategory = CATEGORIES.map(cat => ({
    category: cat,
    models: models.filter(m => m.category === cat),
  })).filter(cat => cat.models.length > 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-models-modal-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={MODAL_TRANSITION}
        className="relative w-full max-w-5xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 id="more-models-modal-title" className="serif-display text-2xl flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-[var(--accent)]" />
            All Models
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
          {modelsByCategory.map(({ category, models: catModels }) => (
            <motion.section
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <h3 className="label mb-4 pb-2 border-b border-[var(--border)]">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {catModels.map((model, idx) => (
                  <motion.button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id);
                      onInitialize();
                      onClose();
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03, ease: EASE_OUT }}
                    whileTap={{ scale: 0.98 }}
                    className={`card-hover p-4 rounded-xl border text-left relative overflow-hidden ${selectedModelId === model.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-[var(--accent)]" />
                      <span className="font-medium text-[var(--foreground)]">{model.name}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{model.description}</div>
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
