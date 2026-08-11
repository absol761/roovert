'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';

// Lives inside the nav bar's right-hand group (not fixed-positioned on its
// own) so it reads as part of the nav instead of an orphaned floating
// widget in the corner. The count popover anchors as a normal dropdown.
export function LiveStats() {
  const [userCount, setUserCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats', {
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          console.warn('Stats API not available:', response.status);
          return;
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Stats API returned non-JSON response');
          return;
        }
        const data = await response.json();
        const count = data.users || data.totalUsers || 0;
        if (count > 0) {
          setUserCount(count);
        }
      } catch (error) {
        console.warn('Stats fetch error:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 z-50 bg-[var(--hud-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-lg)] min-w-[180px]"
          >
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">Chats Started</span>
              <span className="text-[var(--accent)] font-mono font-bold">
                {userCount.toLocaleString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] rounded-full px-3 py-1.5 transition-colors"
        title="Show chats started"
        aria-label="Show chats started"
      >
        <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
      </motion.button>
    </div>
  );
}
