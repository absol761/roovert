'use client';

import { useState, useEffect } from 'react';

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const isMobileDevice = width < 768;
      const isTabletDevice = width >= 768 && width < 1024;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setIsMobile(isMobileDevice);
      setIsTablet(isTabletDevice);
      setIsTouch(isTouchDevice);

      // Set data attributes on body for CSS targeting
      document.body.setAttribute('data-mobile', String(isMobileDevice));
      document.body.setAttribute('data-tablet', String(isTabletDevice));
      document.body.setAttribute('data-touch', String(isTouchDevice));
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return {
    isMobile,
    isTablet,
    isTouch,
    isMobileOrTablet: isMobile || isTablet,
  };
}
