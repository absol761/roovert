'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal, Send, Loader2 } from 'lucide-react';
import { RoovertMark } from '../RoovertMark';
import { MODELS } from '../../lib/models';

interface WindowMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FloatingChatWindowProps {
  id: string;
  initialX: number;
  initialY: number;
  zIndex: number;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
}

// A second, independent chat surface a user can drag around inside the SAME
// tab - the alternative to needing two literal Roovert browser tabs open
// side by side (e.g. one thread going while starting a second one). Talks
// to the same /api/query-gateway endpoint as the main chat but keeps its
// own model selection and message history entirely in local component
// state, so it never touches the main conversation's localStorage-persisted
// history and can't race with it.
export function FloatingChatWindow({ id, initialX, initialY, zIndex, onClose, onFocus }: FloatingChatWindowProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [modelId, setModelId] = useState(MODELS[0].id);
  const [messages, setMessages] = useState<WindowMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Tracks the in-flight stream request so it can be aborted if this window
  // is closed mid-stream - otherwise the fetch/reader loop keeps running
  // after unmount, wastefully consuming the response body and calling
  // setState on a component that's already gone.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Portal target only exists client-side post-mount - `document` is
  // undefined during SSR, and mounting straight to document.body without
  // this gate would also mismatch hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages]);

  // Escape closes this specific window, but only when keyboard focus is
  // actually inside it - with multiple windows open, a global "Escape
  // closes whichever one" listener would close the wrong one whenever more
  // than one is mounted.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (containerRef.current?.contains(document.activeElement)) {
        onClose(id);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [id, onClose]);

  const handleDragStart = (e: React.PointerEvent) => {
    onFocus(id);
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
    setIsDragging(true);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Some targets (e.g. mid text-selection) can reject pointer capture;
      // dragging still works via document-level move/up bubbling on the
      // header, so this is safe to swallow rather than let it abort drag-start.
    }
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const nextX = dragState.current.originX + dx;
    const nextY = dragState.current.originY + dy;
    // Clamp so the window's header (the only drag handle) can't be dragged
    // fully off-screen, which would strand it with no way to grab it again.
    const maxX = window.innerWidth - 120;
    const maxY = window.innerHeight - 60;
    setPosition({ x: Math.min(Math.max(nextX, -200), maxX), y: Math.min(Math.max(nextY, 0), maxY) });
  };

  const handleDragEnd = () => {
    dragState.current = null;
    setIsDragging(false);
  };

  const sendMessage = async () => {
    const trimmed = query.trim();
    if (!trimmed || isStreaming) return;

    const nextMessages: WindowMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setQuery('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullResponse = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/query-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          model: modelId,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error('Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            // Only ever render `content` - `reasoning` (chain-of-thought
            // for models like Ooverta) is intentionally never appended here,
            // this window has no separate reasoning disclosure UI.
            if (typeof data.content === 'string' && data.content) {
              fullResponse += data.content;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: fullResponse };
                return next;
              });
            }
            if (data.done) {
              streamDone = true;
              break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (err) {
      // Deliberate abort (window closed mid-stream) - the component is
      // unmounting/unmounted, so there's nothing to show the user.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: "I'm temporarily unable to process your request. Please try again." };
        return next;
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed w-[380px] max-w-[92vw] rounded-2xl border border-[var(--border)] bg-[var(--hud-bg)] backdrop-blur-xl shadow-[var(--shadow-lg)] flex flex-col overflow-hidden"
      style={{ left: position.x, top: position.y, height: 480, zIndex, touchAction: 'none' }}
      onPointerDown={() => onFocus(id)}
    >
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
          <RoovertMark className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            onPointerDown={(e) => {
              // Stop the header's drag-start from firing (native <select>
              // interaction takes priority here), but still raise this
              // window to the front like any other pointerdown on it would.
              e.stopPropagation();
              onFocus(id);
            }}
            className="bg-transparent text-xs text-[var(--foreground)] outline-none truncate"
            aria-label="Model"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => onClose(id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1 rounded-full hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Close window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-[var(--muted)]">A second, independent conversation - drag me anywhere.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]/85'}`}>
            <div className="label text-[var(--accent)] mb-1">{m.role === 'user' ? 'You' : 'Roovert'}</div>
            <div className="whitespace-pre-wrap">{m.content || (isStreaming && i === messages.length - 1 ? '…' : '')}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 p-2 border-t border-[var(--border)]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Message this window..."
          aria-label="Message this window"
          className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-1.5 text-sm outline-none text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !query.trim()}
          className="p-2 rounded-full bg-[var(--accent)] text-[var(--background)] disabled:opacity-40 transition-opacity"
          aria-label="Send"
        >
          {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>,
    document.body
  );
}
