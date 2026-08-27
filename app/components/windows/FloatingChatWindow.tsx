'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, ChevronDown, Check } from 'lucide-react';
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

const MIN_WIDTH = 320;
const MIN_HEIGHT = 360;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 480;

// How close the pointer needs to be to a screen corner (in px, from both
// edges) for releasing a drag there to snap the window into that quadrant.
// Generous on purpose - the ask was "as unfinicky as possible", so this
// favors triggering the snap over requiring pixel-precision.
const CORNER_SNAP_ZONE = 140;
const SCREEN_MARGIN = 8;

type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function quadrantNearPointer(clientX: number, clientY: number): Quadrant | null {
  const nearLeft = clientX < CORNER_SNAP_ZONE;
  const nearRight = clientX > window.innerWidth - CORNER_SNAP_ZONE;
  const nearTop = clientY < CORNER_SNAP_ZONE;
  const nearBottom = clientY > window.innerHeight - CORNER_SNAP_ZONE;

  if (nearTop && nearLeft) return 'top-left';
  if (nearTop && nearRight) return 'top-right';
  if (nearBottom && nearLeft) return 'bottom-left';
  if (nearBottom && nearRight) return 'bottom-right';
  return null;
}

function quadrantRect(quadrant: Quadrant) {
  const halfW = window.innerWidth / 2 - SCREEN_MARGIN * 1.5;
  const halfH = window.innerHeight / 2 - SCREEN_MARGIN * 1.5;
  const rightX = window.innerWidth / 2 + SCREEN_MARGIN / 2;
  const bottomY = window.innerHeight / 2 + SCREEN_MARGIN / 2;

  switch (quadrant) {
    case 'top-left':
      return { x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: halfW, height: halfH };
    case 'top-right':
      return { x: rightX, y: SCREEN_MARGIN, width: halfW, height: halfH };
    case 'bottom-left':
      return { x: SCREEN_MARGIN, y: bottomY, width: halfW, height: halfH };
    case 'bottom-right':
      return { x: rightX, y: bottomY, width: halfW, height: halfH };
  }
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
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number; lastX: number; lastY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; originW: number; originH: number; originX: number; originY: number; direction: ResizeDirection } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snapPreview, setSnapPreview] = useState<Quadrant | null>(null);

  const [modelId, setModelId] = useState(MODELS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount gate for the portal target (document.body doesn't exist during SSR), the same case app/page.tsx's hydration effect is exempted for
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

  // Closes the model picker on any click outside it - the standard
  // dropdown-menu convention, since this replaces a native <select> (whose
  // own open/close handling we no longer get for free).
  useEffect(() => {
    if (!isModelMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen]);

  const handleDragStart = (e: React.PointerEvent) => {
    // Without this, a fast drag can start a native browser text-selection
    // drag underneath the pointer (shows up as a blue highlight sweeping
    // across the page) instead of just moving the window - pointer capture
    // redirects move/up events but doesn't suppress the browser's own
    // default text-selection gesture on its own.
    e.preventDefault();
    onFocus(id);
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y, lastX: e.clientX, lastY: e.clientY };
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
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const nextX = dragState.current.originX + dx;
    const nextY = dragState.current.originY + dy;
    // Fully clamped to the viewport - the window can never be dragged even
    // partially past an edge, unlike the earlier version which allowed it
    // to hang off-screen by up to 200px.
    const maxX = Math.max(window.innerWidth - size.width, 0);
    const maxY = Math.max(window.innerHeight - size.height, 0);
    setPosition({ x: Math.min(Math.max(nextX, 0), maxX), y: Math.min(Math.max(nextY, 0), maxY) });
    setSnapPreview(quadrantNearPointer(e.clientX, e.clientY));
  };

  const handleDragEnd = () => {
    const last = dragState.current;
    dragState.current = null;
    setIsDragging(false);
    setSnapPreview(null);
    if (!last) return;
    const quadrant = quadrantNearPointer(last.lastX, last.lastY);
    if (quadrant) {
      const rect = quadrantRect(quadrant);
      setPosition({ x: rect.x, y: rect.y });
      setSize({ width: rect.width, height: rect.height });
    }
  };

  const handleResizeStart = (e: React.PointerEvent, direction: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus(id);
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originW: size.width,
      originH: size.height,
      originX: position.x,
      originY: position.y,
      direction,
    };
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Same rationale as handleDragStart's catch - not fatal to resizing.
    }
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    const start = resizeState.current;
    if (!start) return;
    const dx = e.clientX - start.startX;
    const dy = e.clientY - start.startY;
    const { direction } = start;

    const next = { x: position.x, y: position.y, width: size.width, height: size.height };

    if (direction.includes('e')) {
      const maxWidth = Math.max(window.innerWidth - start.originX - SCREEN_MARGIN, MIN_WIDTH);
      next.width = Math.min(Math.max(start.originW + dx, MIN_WIDTH), maxWidth);
    } else if (direction.includes('w')) {
      // Growing/shrinking from the left edge moves x too - clamped so it
      // can never push past the right edge of the window (min width) or
      // past the left edge of the screen (x can't go negative).
      const maxWidth = start.originX + start.originW;
      next.width = Math.min(Math.max(start.originW - dx, MIN_WIDTH), maxWidth);
      next.x = start.originX + (start.originW - next.width);
    }

    if (direction.includes('s')) {
      const maxHeight = Math.max(window.innerHeight - start.originY - SCREEN_MARGIN, MIN_HEIGHT);
      next.height = Math.min(Math.max(start.originH + dy, MIN_HEIGHT), maxHeight);
    } else if (direction.includes('n')) {
      const maxHeight = start.originY + start.originH;
      next.height = Math.min(Math.max(start.originH - dy, MIN_HEIGHT), maxHeight);
      next.y = start.originY + (start.originH - next.height);
    }

    setPosition({ x: next.x, y: next.y });
    setSize({ width: next.width, height: next.height });
  };

  const handleResizeEnd = () => {
    resizeState.current = null;
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

  const selectedModel = MODELS.find(m => m.id === modelId) ?? MODELS[0];

  return createPortal(
    <>
      {snapPreview && (
        <div
          className="fixed rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent)]/10 pointer-events-none transition-all duration-100"
          style={{ ...quadrantRect(snapPreview), zIndex: zIndex - 1 }}
        />
      )}
      {/* Outer box is purely for positioning/hit-testing - it deliberately
          has NO rounding/overflow-hidden of its own, so the resize handles
          (siblings of the rounded panel below, not descendants of it) are
          never clipped by the panel's rounded-corner mask. Putting them
          inside the rounded+overflow-hidden panel instead silently ate
          pointer events right at the corners, where the rounding clips the
          literal (0,0) pixel away from hit-testing. */}
      <div
        ref={containerRef}
        className="fixed"
        style={{ left: position.x, top: position.y, width: size.width, height: size.height, maxWidth: '92vw', maxHeight: '90vh', zIndex, touchAction: 'none' }}
        onPointerDown={() => onFocus(id)}
      >
      <div className="w-full h-full rounded-2xl border border-[var(--border)] bg-[var(--hud-bg)] backdrop-blur-xl shadow-[var(--shadow-lg)] flex flex-col overflow-hidden">
        <div
          className={`select-none flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        >
          <div className="relative flex items-center gap-2 min-w-0" ref={modelMenuRef}>
            <RoovertMark className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <button
              onClick={() => setIsModelMenuOpen(v => !v)}
              onPointerDown={(e) => {
                // Stop the header's drag-start from firing (this is a click
                // target, not a drag handle), but still raise this window to
                // the front like any other pointerdown on it would.
                e.stopPropagation();
                onFocus(id);
              }}
              className="flex items-center gap-1 text-xs text-[var(--foreground)] truncate hover:text-[var(--accent)] transition-colors"
              aria-label="Choose model"
              aria-expanded={isModelMenuOpen}
            >
              <span className="truncate max-w-[140px]">{selectedModel.name}</span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>

            {isModelMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1 min-w-[180px] bg-[var(--hud-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] p-1 z-10"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModelId(m.id);
                      setIsModelMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-[var(--foreground)] hover:bg-[var(--surface-strong)] transition-colors"
                  >
                    <span className="truncate">{m.name}</span>
                    {m.id === modelId && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
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
      </div>

        {/* Resize handles on every edge and corner, like a native OS window
            (not just the bottom-right). Siblings of the rounded panel above
            (not descendants of it) so its overflow-hidden rounded-corner
            mask never clips their hit area - see the comment on the outer
            box above. Thin invisible strips along each edge (cursor-only
            affordance, the standard convention for resizable panels) plus a
            visible diagonal-lines glyph in the bottom-right corner so at
            least one resize handle is obvious at a glance instead of
            requiring the user to discover it by hovering. */}
        <div onPointerDown={(e) => handleResizeStart(e, 'n')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div onPointerDown={(e) => handleResizeStart(e, 's')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div onPointerDown={(e) => handleResizeStart(e, 'w')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -left-1 top-2 bottom-2 w-2 cursor-ew-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div onPointerDown={(e) => handleResizeStart(e, 'e')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -right-1 top-2 bottom-2 w-2 cursor-ew-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div onPointerDown={(e) => handleResizeStart(e, 'nw')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div onPointerDown={(e) => handleResizeStart(e, 'ne')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div onPointerDown={(e) => handleResizeStart(e, 'sw')} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize touch-none" style={{ touchAction: 'none' }} aria-hidden="true" />
        <div
          onPointerDown={(e) => handleResizeStart(e, 'se')}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          className="select-none absolute -bottom-1 -right-1 w-5 h-5 cursor-nwse-resize touch-none flex items-center justify-center group"
          style={{ touchAction: 'none' }}
          aria-hidden="true"
          title="Drag to resize"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
            <path d="M14 14L14 8M14 14L8 14M14 5L5 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>,
    document.body
  );
}
