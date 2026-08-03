'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, X, Sparkles } from 'lucide-react';

interface NewsStory {
  id: string | number;
  title: string;
  url?: string;
  by?: string;
  score?: number;
}

export function GlobalFeedExpanded({
  onClose,
  onAskAbout,
}: {
  onClose: () => void;
  // Hands the story off to the chat composer (enters chat mode, prefills a
  // prompt about it) instead of this component reaching into chat state
  // itself - keeps GlobalFeedExpanded's only responsibility "render the
  // feed," same separation page.tsx already uses for QUICK_PROMPTS.
  onAskAbout: (story: { title: string; url?: string }) => void;
}) {
  const [news, setNews] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    fetch('/api/news')
      .then(res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Failed to fetch news');
        }
        return res.json();
      })
      .then(data => {
        if (isCancelled) return;
        setNews(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        if (isCancelled) return;
        console.warn('News fetch error (non-critical):', error);
        setNews([]);
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
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
            aria-label="Close"
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
                <div
                  key={story.id}
                  className="relative p-4 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group"
                >
                  {/* Stretched-link pattern: this anchor covers the whole
                      card for a click-to-open target, while the "Ask about
                      this" button below - a normal-flow sibling painted on
                      top of it - stays independently clickable without
                      nesting a <button> inside an <a> (invalid HTML/a11y). */}
                  <a
                    href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 rounded-lg"
                    aria-label={story.title}
                  />
                  <h3 className="relative text-sm font-medium text-[var(--foreground)] mb-2 group-hover:text-[var(--accent)] transition-colors">
                    {story.title}
                  </h3>
                  {story.by && (
                    <p className="relative text-xs text-[var(--muted)] mb-3">
                      by {story.by} {typeof story.score === 'number' && story.score > 0 && `• ${story.score} points`}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onAskAbout({ title: story.title, url: story.url })}
                    className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-strong)] transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Ask about this
                  </button>
                </div>
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
