'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Sparkles, Zap, Loader2, AlertCircle } from 'lucide-react';
import { MarkdownMessage } from '../../components/MarkdownMessage';

interface SharedMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; messages: SharedMessage[] };

// Flattens a validated message's content (string, or a multimodal array of
// text/image parts) down to plain text for rendering - shared links only
// ever carry text, never the raw base64 images themselves (see the
// conversationHistory shape POSTed by app/page.tsx's handleShare).
function messageText(content: SharedMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n');
}

export default function SharedConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/share/${id}`);
        if (!res.ok) {
          if (!cancelled) setState({ status: 'error' });
          return;
        }
        const data = await res.json();
        if (!data.success || !Array.isArray(data.messages)) {
          if (!cancelled) setState({ status: 'error' });
          return;
        }
        if (!cancelled) setState({ status: 'ready', messages: data.messages });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      <nav className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="serif-display text-xl text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
            Roovert
          </Link>
          <Link
            href="/"
            className="px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] transition-all text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Try Roovert
          </Link>
        </div>
      </nav>

      <main id="main-content" className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <div className="mb-8 flex items-center gap-2 text-xs text-[var(--muted)] px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] w-fit">
          <span aria-hidden="true">&#128274;</span>
          This is a shared, read-only conversation.
        </div>

        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 text-[var(--muted)] py-20">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading conversation…
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-20 text-[var(--muted)]">
            <AlertCircle className="w-8 h-8" />
            <p>This shared conversation doesn&apos;t exist or has expired.</p>
            <Link href="/" className="text-[var(--accent)] hover:underline text-sm">
              Start a new conversation on Roovert
            </Link>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="space-y-6">
            {state.messages.map((message, i) => {
              const text = messageText(message.content);
              const isUser = message.role === 'user';
              return (
                <div
                  key={i}
                  className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isUser ? 'bg-[var(--accent)]/20' : 'bg-[var(--accent)]/10'}`}>
                      {isUser ? (
                        <Zap className="w-5 h-5 text-[var(--accent)]" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="label text-[var(--accent)] mb-2">{isUser ? 'You' : 'Roovert'}</div>
                      {isUser ? (
                        <div className="text-[var(--foreground)] text-lg leading-relaxed font-light whitespace-pre-wrap">
                          {text}
                        </div>
                      ) : (
                        <div className="text-[var(--foreground)] text-lg leading-relaxed font-light markdown-content">
                          <MarkdownMessage content={text} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
