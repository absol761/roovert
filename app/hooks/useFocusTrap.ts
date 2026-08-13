'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null // skip hidden/display:none elements
  );
}

// Focus management shared by every modal in the app: moves focus into the
// dialog when it opens, keeps Tab/Shift+Tab cycling within it while open
// (a "focus trap", since none of these modals sit on top of a Radix/other
// primitive that already provides one), and restores focus to whatever
// triggered the modal once it closes. Call unconditionally (before any
// early `if (!isOpen) return null`), same as useModalDismiss - it's a
// no-op while closed, and the effect's cleanup (which fires on unmount,
// since every modal here unmounts itself on close) is what returns focus.
export function useFocusTrap(isOpen: boolean, containerRef: RefObject<HTMLElement | null>) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Whatever had focus right before the modal opened is almost always
    // the element that triggered it (a button click leaves that button
    // focused), so this is what we return focus to on close.
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Deferred a frame so the dialog is actually laid out (framer-motion
    // mounts it fresh on open) before we try to focus into it.
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const [first] = getFocusable(container);
      (first ?? container).focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        // Nothing focusable inside - keep focus pinned to the container
        // itself instead of letting Tab escape to the page behind it.
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown);
      // Return focus to the trigger, but only if it's still around - it may
      // have been unmounted (e.g. a list item that no longer exists).
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [isOpen, containerRef]);
}
