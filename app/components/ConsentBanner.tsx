'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { X, Cookie } from 'lucide-react';

const CONSENT_KEY = 'roovert_analytics_consent';
const CONSENT_EXPIRY_DAYS = 365; // Remember consent for 1 year

export function ConsentBanner() {
  // Check consent immediately on mount to prevent flash
  const [showBanner, setShowBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    const consent = localStorage.getItem(CONSENT_KEY);
    return !consent; // Only show if no consent has been given
  });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Double-check on mount (in case localStorage wasn't available during initial render)
    if (typeof window !== 'undefined') {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (consent) {
        setShowBanner(false);
      } else if (!showBanner) {
        // Small delay to avoid flash of banner
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [showBanner]);

  const handleAccept = () => {
    setIsAnimating(true);
    localStorage.setItem(CONSENT_KEY, 'accepted');
    localStorage.setItem(`${CONSENT_KEY}_date`, new Date().toISOString());
    
    // Track consent click for visitor count
    trackConsentClick();
    
    // Initialize Segment after consent
    if (typeof window !== 'undefined') {
      initializeSegment();
    }
    
    // Animate out
    setTimeout(() => {
      setShowBanner(false);
    }, 300);
  };

  const handleDecline = () => {
    setIsAnimating(true);
    localStorage.setItem(CONSENT_KEY, 'declined');
    localStorage.setItem(`${CONSENT_KEY}_date`, new Date().toISOString());
    
    // Track consent click for visitor count (even if declined)
    trackConsentClick();
    
    // Animate out
    setTimeout(() => {
      setShowBanner(false);
    }, 300);
  };

  // Track consent click (counts as a visitor)
  function trackConsentClick() {
    if (typeof window === 'undefined') return;
    
    // Check if we've already counted this session
    const sessionKey = 'roovert_consent_counted_' + new Date().toDateString();
    const alreadyCounted = sessionStorage.getItem(sessionKey);
    
    if (alreadyCounted) {
      return; // Already counted today
    }
    
    // Mark as counted
    sessionStorage.setItem(sessionKey, 'true');
    
    // Increment count in localStorage
    const countKey = 'roovert_consent_clicks';
    const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10);
    localStorage.setItem(countKey, String(currentCount + 1));
    
    // Also sync to server (non-blocking)
    fetch('/api/consent-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'click' }),
      keepalive: true,
    }).catch(() => {
      // Silently fail - local storage is the source of truth
    });
  }

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="max-w-7xl mx-auto">
            <div className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 shadow-2xl">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                    <Cookie className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                      Cookie Consent
                    </h3>
                    <p className="text-sm text-[var(--muted)] leading-relaxed">
                      We use cookies to improve your experience. This helps us understand how people use Roovert without collecting any personal information.{' '}
                      <Link href="/privacy" className="text-[var(--accent)] hover:underline">
                        Learn more
                      </Link>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={handleDecline}
                    className="px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded-lg hover:bg-[var(--surface)]"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAccept}
                    className="px-6 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all shadow-[0_0_20px_var(--accent-glow)]"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Initialize Segment.io with privacy-focused configuration
function initializeSegment() {
  if (typeof window === 'undefined') return;
  
  // Check if Segment is already loaded and initialized
  if ((window as any).analytics && typeof (window as any).analytics.load === 'function') {
    return;
  }

  const writeKey = process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY;
  
  if (!writeKey) {
    // Silently return if Segment is not configured (it's optional)
    // Only log in development mode to help with setup
    if (process.env.NODE_ENV === 'development') {
      console.info('Segment analytics is not configured. To enable, set NEXT_PUBLIC_SEGMENT_WRITE_KEY in your environment variables.');
    }
    return;
  }

  // Initialize analytics queue before script loads (Segment pattern)
  (window as any).analytics = (window as any).analytics || [];
  
  // Define the load function that will be called by Segment
  (window as any).analytics.load = function(key: string) {
    (window as any).analytics._writeKey = key;
  };
  
  // Create and inject Segment script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://cdn.segment.com/analytics.js/v1/${writeKey}/analytics.min.js`;
  
  script.onload = () => {
    // Wait longer to ensure Segment is fully initialized
    setTimeout(() => {
      // Check if analytics.load exists now
      if (typeof (window as any).analytics.load === 'function') {
        // Initialize Segment with privacy-focused settings
        (window as any).analytics.load(writeKey);
        
        // Wait a bit more for Segment to fully initialize all methods
        setTimeout(() => {
          // Only use .on() if it exists (some Segment versions may not have it)
          if (typeof (window as any).analytics.on === 'function') {
            // Configure to anonymize IP addresses for all future events
            (window as any).analytics.on('track', function(event: any) {
              if (event && event.context) {
                event.context.ip = '0.0.0.0'; // Anonymize IP
              }
            });
            
            (window as any).analytics.on('page', function(event: any) {
              if (event && event.context) {
                event.context.ip = '0.0.0.0'; // Anonymize IP
              }
            });
          }
          
          // Track initial page view with anonymized IP (always include IP anonymization in context)
          if (typeof (window as any).analytics.page === 'function') {
            (window as any).analytics.page({
              context: {
                ip: '0.0.0.0', // Anonymize IP
              },
            });
          }
        }, 200); // Additional delay for .on() method
      }
    }, 100);
  };
  
  script.onerror = () => {
    console.error('Failed to load Segment analytics script');
  };
  
  document.head.appendChild(script);
}

// Export function to check consent and initialize if needed
export function checkConsentAndInitialize() {
  if (typeof window === 'undefined') return;
  
  const consent = localStorage.getItem(CONSENT_KEY);
  
  if (consent === 'accepted') {
    initializeSegment();
  }
}

