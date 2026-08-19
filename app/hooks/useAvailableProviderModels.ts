'use client';

import { useEffect, useState } from 'react';
import type { Model } from '../lib/models';

// Fetches the currently-available generic-provider models (Cerebras/Gemini/
// Mistral/CUSTOM_PROVIDERS - see app/lib/providers.ts) on mount and
// periodically. This mirrors app/hooks/useProviderRateLimits.ts's
// poll-on-mount pattern deliberately, for consistency: that hook asks "is
// this static provider currently rate-limited?", this one asks "which
// dynamic providers are currently configured (API key present) at all?" -
// both are server-only facts a client component can't know on its own, so
// both are surfaced the same way.
//
// getAvailableProviderModels() (app/lib/providers.ts) depends on server-only
// env vars, so it must never be imported directly into a client component
// like app/page.tsx - this hook is the only sanctioned way page.tsx learns
// about provider-registry models, via GET /api/models's `providerModels`
// field (see app/api/models/route.ts).
//
// Fails soft by design: with no provider API keys configured (the default
// for a fresh deployment/template checkout), or if the fetch itself fails
// for any reason (network error, non-JSON response, etc.), this simply
// returns an empty array and the picker looks and behaves exactly as it did
// before this hook existed - callers should never need a loading/error
// state to handle this gracefully.
export function useAvailableProviderModels() {
  const [providerModels, setProviderModels] = useState<Model[]>([]);

  useEffect(() => {
    let cancelled = false;

    const checkProviderModels = async () => {
      try {
        const res = await fetch('/api/models');
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          return; // Skip if not JSON response
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data.providerModels)) {
          setProviderModels(data.providerModels);
        }
      } catch {
        // Silently handle errors - non-critical, matches
        // useProviderRateLimits' error handling.
      }
    };

    checkProviderModels();
    const interval = setInterval(checkProviderModels, 60000); // Check every minute
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return providerModels;
}
