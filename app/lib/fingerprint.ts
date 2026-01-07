// Device fingerprinting utility for unique visitor tracking
// Combines multiple device characteristics to create a persistent identifier

export function generateFingerprint(): string {
  if (typeof window === 'undefined') return '';

  const components: string[] = [];

  // User Agent
  components.push(navigator.userAgent || '');

  // Screen dimensions
  components.push(`${screen.width}x${screen.height}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language || '');

  // Platform
  components.push(navigator.platform || '');

  // Hardware concurrency (CPU cores)
  components.push((navigator.hardwareConcurrency || 0).toString());

  // Color depth
  components.push((screen.colorDepth || 0).toString());

  // Available screen dimensions
  components.push(`${screen.availWidth}x${screen.availHeight}`);

  // Pixel ratio
  components.push((window.devicePixelRatio || 1).toString());

  // Canvas fingerprint (simple hash)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Fingerprint', 2, 2);
      const canvasData = canvas.toDataURL();
      components.push(canvasData.substring(0, 50)); // First 50 chars for hash
    }
  } catch (e) {
    // Canvas not available
  }

  // Combine and hash
  const combined = components.join('|');
  return simpleHash(combined);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';

  const STORAGE_KEY = 'roovert_visitor_id';
  const FINGERPRINT_KEY = 'roovert_fingerprint';

  // Check if we have a stored ID
  let visitorId = localStorage.getItem(STORAGE_KEY);
  const storedFingerprint = localStorage.getItem(FINGERPRINT_KEY);

  // Generate current fingerprint
  const currentFingerprint = generateFingerprint();

  // If no ID or fingerprint changed significantly, create new one
  if (!visitorId || (storedFingerprint && storedFingerprint !== currentFingerprint)) {
    // Create a new ID combining timestamp and fingerprint
    visitorId = `${Date.now()}-${currentFingerprint}`;
    localStorage.setItem(STORAGE_KEY, visitorId);
    localStorage.setItem(FINGERPRINT_KEY, currentFingerprint);
    return visitorId;
  }

  // Store fingerprint for future comparison
  if (!storedFingerprint) {
    localStorage.setItem(FINGERPRINT_KEY, currentFingerprint);
  }

  return visitorId;
}

