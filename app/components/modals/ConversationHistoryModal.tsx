'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { History, X, Pencil, Trash2, Check, MessageSquarePlus } from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// Structural subset of the full conversation record page.tsx keeps in
// memory - the modal only ever needs to list/rename/delete, never touch
// message content, so it doesn't need (and shouldn't import) the full type.
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

interface ConversationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

// Short, human relative timestamp ("just now", "5m ago", "3d ago") - avoids
// pulling in a date library for something this small.
function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ConversationHistoryModal({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelect,
  onRename,
  onDelete,
  onNewChat,
}: ConversationHistoryModalProps) {
  useModalDismiss(isOpen, onClose);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, containerRef);

  if (!isOpen) return null;

  const startEditing = (conversation: ConversationSummary) => {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  const commitEditing = () => {
    if (editingId) {
      onRename(editingId, draftTitle);
    }
    setEditingId(null);
    setDraftTitle('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  const handleDelete = (conversation: ConversationSummary) => {
    if (window.confirm(`Delete "${conversation.title}"? This can't be undone.`)) {
      onDelete(conversation.id);
    }
  };

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="fixed inset-0 z-[110] flex text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversation-history-title"
        tabIndex={-1}
        initial={{ x: '-100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-100%', opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-sm h-full bg-[var(--hud-bg)] border-r border-[var(--border)] shadow-[var(--shadow-lg)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 id="conversation-history-title" className="serif-display text-xl flex items-center gap-2.5">
            <History className="w-5 h-5 text-[var(--accent)]" />
            Chat History
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={() => { onNewChat(); onClose(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] text-sm font-medium transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-1">
          {sorted.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">No past conversations yet.</p>
          ) : (
            sorted.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isEditing = editingId === conversation.id;
              return (
                <div
                  key={conversation.id}
                  className={`group relative rounded-xl border transition-colors ${isActive
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10'
                    : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]'
                    }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 p-2.5">
                      <input
                        autoFocus
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditing();
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        onBlur={commitEditing}
                        className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={commitEditing}
                        aria-label="Save name"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] text-[var(--accent)]"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelect(conversation.id)}
                      className="w-full text-left px-3.5 py-3 pr-16"
                    >
                      <div className="text-sm font-medium truncate">{conversation.title}</div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">{formatRelativeTime(conversation.updatedAt)}</div>
                    </button>
                  )}

                  {!isEditing && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditing(conversation)}
                        aria-label="Rename conversation"
                        title="Rename"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(conversation)}
                        aria-label="Delete conversation"
                        title="Delete"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] text-[var(--muted)] hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
