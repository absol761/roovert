'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Optional custom fallback. If omitted, a default panel consistent with
  // the app's design system (see SettingsModal for the same tokens) is used.
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Render-time error boundary. This only catches errors thrown while
// rendering (or in lifecycle methods / constructors) of its children -
// it cannot and does not attempt to catch errors from event handlers or
// async code (e.g. streaming fetch callbacks), which must handle their
// own errors. Class component because React has no hook equivalent for
// getDerivedStateFromError / componentDidCatch.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught render error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[var(--background)] text-[var(--foreground)]">
          <div className="w-full max-w-sm bg-[var(--hud-bg)] border border-[var(--border)] rounded-[var(--panel-radius)] shadow-[var(--shadow-lg)] p-8 text-center">
            <h2 className="serif-display text-xl mb-2 text-[var(--foreground)]">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--muted)] mb-6">
              Sorry about that - the app hit an unexpected error. Reloading the page should fix it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--background)] text-sm font-medium transition-opacity hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
