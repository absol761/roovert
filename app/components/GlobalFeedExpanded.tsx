'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, X } from 'lucide-react';

interface NewsStory {
  id: string | number;
  title: string;
  url?: string;
  by?: string;
  score?: number;
}

export function GlobalFeedExpanded({ onClose }: { onClose: () => void }) {
  const [news, setNews] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then(res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Failed to fetch news');
        }
        return res.json();
      })
      .then(data => {
        setNews(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        console.warn('News fetch error (non-critical):', error);
        setNews([]);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="w-full mb-8 bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-light tracking-wide flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--accent)]" />
            Global Feed
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar max-h-[60vh]">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-full bg-[var(--surface-strong)] rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-[var(--surface-strong)] rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-[var(--surface-strong)] rounded animate-pulse" />
            </div>
          ) : news.length > 0 ? (
            <div className="space-y-4">
              {news.map((story) => (
                <a
                  key={story.id}
                  href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group"
                >
                  <h3 className="text-sm font-medium text-[var(--foreground)] mb-2 group-hover:text-[var(--accent)] transition-colors">
                    {story.title}
                  </h3>
                  {story.by && (
                    <p className="text-xs text-[var(--muted)]">
                      by {story.by} {story.score && `• ${story.score} points`}
                    </p>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[var(--muted)]">No news available at the moment.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
