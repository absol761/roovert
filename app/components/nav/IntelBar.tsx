'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, X } from 'lucide-react';

export interface IntelBarSignal {
  title: string;
  detail: string;
}

export interface IntelBarProps {
  modelName: string;
  modelDescription: string;
  signals: IntelBarSignal[];
  onEndSession: () => void;
}

// Consolidates the old "Active Intelligence" + "Ops Snapshot" sidebar cards
// into a single thin pill living in the nav bar next to NavClock, so the
// chat column no longer has to share the grid with a dedicated sidebar -
// same pill/popover pattern as LiveStats, just with two stacked sections
// in the popover instead of one stat.
export function IntelBar({ modelName, modelDescription, signals, onEndSession }: IntelBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 z-50 bg-[var(--hud-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-lg)] min-w-[240px]"
          >
            <span className="label">Active Intelligence</span>
            <h3 className="font-light mt-1">{modelName}</h3>
            <p className="text-sm text-[var(--foreground)]/80 mt-1">{modelDescription}</p>
            <button
              onClick={() => {
                setIsExpanded(false);
                onEndSession();
              }}
              className="mt-3 text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> End Session
            </button>

            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <span className="label">Ops Snapshot</span>
              <div className="mt-2 space-y-2">
                {signals.map(signal => (
                  <div key={signal.title}>
                    <p className="label">{signal.title}</p>
                    <p className="text-sm mt-0.5 text-[var(--foreground)]/80">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="hidden md:flex items-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] rounded-full px-3 py-1 transition-colors text-xs text-[var(--muted)] font-mono"
        title="Active intelligence & ops snapshot"
        aria-label="Active intelligence & ops snapshot"
      >
        <Activity className="w-3 h-3 text-[var(--accent)]" />
        <span className="truncate max-w-[10ch]">{modelName}</span>
      </motion.button>
    </div>
  );
}
