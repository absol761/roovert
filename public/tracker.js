/**
 * Privacy-Focused Visitor Tracker
 * 
 * Lightweight, non-blocking script that tracks unique visitors
 * without storing any personally identifiable information.
 * 
 * Usage: Place this script in <head> or at the end of <body>
 * <script src="/tracker.js" defer></script>
 */

(function() {
  'use strict';
  
  // Only run once per page load
  if (window._roovertTrackerLoaded) return;
  window._roovertTrackerLoaded = true;
  
  // Non-blocking: Use requestIdleCallback if available, otherwise setTimeout
  const schedule = window.requestIdleCallback || function(cb) {
    setTimeout(cb, 1);
  };
  
  schedule(function() {
    try {
      // Send tracking request (non-blocking, fire-and-forget)
      fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Don't wait for response - fire and forget
        keepalive: true,
        // Low priority
        priority: 'low',
      }).catch(function() {
        // Silently fail - tracking should never break the page
      });
    } catch (e) {
      // Silently fail - tracking should never break the page
    }
  });
})();

