'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cookie } from 'lucide-react';

const CONSENT_KEY = 'roovert_analytics_consent';
const CONSENT_EXPIRY_DAYS = 365; // Remember consent for 1 year

export function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check if consent has been given/denied
    const consent = localStorage.getItem(CONSENT_KEY);
    
    if (!consent) {
      // Small delay to avoid flash of banner
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setIsAnimating(true);
    localStorage.setItem(CONSENT_KEY, 'accepted');
    localStorage.setItem(`${CONSENT_KEY}_date`, new Date().toISOString());
    
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
    
    // Animate out
    setTimeout(() => {
      setShowBanner(false);
    }, 300);
  };

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
  
  // Check if Segment is already loaded
  if ((window as any).analytics && (window as any).analytics.load) {
    return;
  }

  const writeKey = process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY;
  
  if (!writeKey) {
    console.warn('Segment write key not configured. Set NEXT_PUBLIC_SEGMENT_WRITE_KEY in your environment variables.');
    return;
  }

  // Create analytics queue if it doesn't exist
  (window as any).analytics = (window as any).analytics || [];
  
  // Create and inject Segment script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://cdn.segment.com/analytics.js/v1/${writeKey}/analytics.min.js`;
  
  script.onload = () => {
    // Initialize Segment with privacy-focused settings
    (window as any).analytics.load(writeKey);
    
    // Configure to anonymize IP addresses for all future events
    (window as any).analytics.on('track', function(event: any) {
      if (event.context) {
        event.context.ip = '0.0.0.0'; // Anonymize IP
      }
    });
    
    (window as any).analytics.on('page', function(event: any) {
      if (event.context) {
        event.context.ip = '0.0.0.0'; // Anonymize IP
      }
    });
    
    // Track initial page view with anonymized IP
    (window as any).analytics.page({
      context: {
        ip: '0.0.0.0', // Anonymize IP
      },
    });
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

