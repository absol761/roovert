'use client';

import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';

/**
 * Shared markdown renderer for chat message content - used for both the
 * live chat (app/page.tsx) and the read-only shared-conversation view
 * (app/share/[id]/page.tsx) so the two don't drift out of sync on
 * formatting, syntax highlighting, or the copy-to-clipboard code block
 * behavior.
 *
 * Wrapped in memo() - a streaming response calls setResponse() on every
 * SSE chunk (app/page.tsx's read loop), and without memoization every
 * parent re-render this triggers re-runs the full ReactMarkdown parse +
 * remark-gfm + rehype-highlight tokenization from scratch even though only
 * the still-growing `content` string actually changed meaningfully once
 * per chunk - memo's shallow prop compare skips that work whenever a
 * parent re-render happens for an unrelated reason (e.g. sibling state).
 */
export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);

  const copyCodeBlock = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeBlock(code);
      setTimeout(() => setCopiedCodeBlock(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const markdownComponents = {
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      const isCopied = copiedCodeBlock === code;
      // react-markdown v9+ no longer passes an `inline` prop - block code is
      // the only kind that gets a `language-x` className from
      // rehype-highlight, so its presence is the reliable signal.
      const isInline = !className;

      return !isInline ? (
        <div className="relative my-4">
          <div className="flex items-center justify-between p-2 bg-[var(--surface-strong)] border-b border-[var(--border)] rounded-t-lg">
            <span className="text-xs text-[var(--muted)] font-mono">
              {match ? match[1] : 'code'}
            </span>
            <button
              onClick={() => copyCodeBlock(code)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs border border-[var(--border)] rounded hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className={`${className} m-0 rounded-b-lg rounded-t-none overflow-x-auto`} {...props}>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      ) : (
        <code className={`${className} bg-[var(--surface-strong)] px-1.5 py-0.5 rounded text-sm`} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      // Security: Disable HTML rendering to prevent XSS
      disallowedElements={['script', 'iframe', 'object', 'embed']}
      unwrapDisallowed={true}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
});
