'use client';

import { useEffect, useState } from 'react';

// Checks OpenRouter/Hugging Face rate limits on mount and periodically -
// same pattern for both: each provider's GET endpoint reports whether this
// client has exhausted that provider's quota, so exhausted-provider models
// hide from the picker instead of failing on click.
export function useProviderRateLimits() {
  const [hideOpenRouterModels, setHideOpenRouterModels] = useState(false);
  const [hideHuggingFaceModels, setHideHuggingFaceModels] = useState(false);
  const [hideImageGen, setHideImageGen] = useState(false);

  useEffect(() => {
    const checkRateLimit = async (endpoint: string, setHidden: (hidden: boolean) => void) => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          return; // Skip if not JSON response
        }
        const data = await res.json();
        setHidden(data.shouldHide || false);
      } catch {
        // Silently handle errors - non-critical
      }
    };

    const checkAll = () => {
      checkRateLimit('/api/openrouter', setHideOpenRouterModels);
      checkRateLimit('/api/huggingface', setHideHuggingFaceModels);
      checkRateLimit('/api/huggingface-image', setHideImageGen);
    };

    checkAll();
    const interval = setInterval(checkAll, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return { hideOpenRouterModels, hideHuggingFaceModels, hideImageGen };
}
