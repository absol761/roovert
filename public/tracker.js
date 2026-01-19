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
      // Check if we've already tracked this session to avoid duplicate tracking
      const sessionKey = 'roovert_tracked_' + new Date().toDateString();
      const tracked = sessionStorage.getItem(sessionKey);
      
      if (tracked) {
        // Already tracked today, skip
        return;
      }
      
      // Send tracking request (non-blocking, fire-and-forget)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Don't wait for response - fire and forget
        keepalive: true,
        // Low priority
        priority: 'low',
        // Add signal timeout to prevent hanging
        signal: controller.signal,
      })
      .then(function(response) {
        clearTimeout(timeoutId);
        if (response && response.ok) {
          // Mark as tracked for this session
          sessionStorage.setItem(sessionKey, 'true');
          // Try to get the updated count
          return response.json();
        }
        return null;
      })
      .then(function(data) {
        // Silently handle response - don't break page if tracking fails
        if (data && data.totalUniqueVisitors) {
          // Could update a global counter here if needed
        }
      })
      .catch(function(error) {
        clearTimeout(timeoutId);
        // Silently fail - tracking should never break the page
        // Suppress all errors - tracking is non-critical
      });
    } catch (e) {
      // Silently fail - tracking should never break the page
    }
  });
})();

