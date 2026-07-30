'use client';

import { useEffect } from 'react';

// Module-level reference count, not a per-instance snapshot/restore: the
// visualizer config panel has no backdrop, so a user can have it open at
// the same time as a full modal (e.g. Settings). A snapshot/restore of
// `body.style.overflow` per hook instance would have the second modal
// closing first wrongly unlock scroll while the first one is still open.
let lockCount = 0;

// Escape-to-close + background scroll lock, shared by every modal/panel in
// the app. None of them had either: Escape did nothing, and the page
// underneath kept scrolling while a modal covered it. Call unconditionally
// (before any early `if (!isOpen) return null`) - it's a no-op while closed.
export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    lockCount += 1;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = '';
      }
    };
  }, [isOpen, onClose]);
}
