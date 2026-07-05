'use client';

import { useEffect } from 'react';
import { getConfiguredEzoicPlaceholderIds } from '@/lib/ads';

declare global {
  interface Window {
    ezstandalone?: {
      cmd?: Array<() => void>;
      showAds?: (...ids: string[]) => void;
    };
  }
}

export default function EzoicScript() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const placeholderIds = getConfiguredEzoicPlaceholderIds();
    if (placeholderIds.length === 0) return;

    window.ezstandalone = window.ezstandalone || {};
    window.ezstandalone.cmd = window.ezstandalone.cmd || [];

    if (!document.querySelector('script[src*="ezojs.com/ezoic/sa.min.js"]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.ezojs.com/ezoic/sa.min.js';
      document.head.appendChild(script);
    }
  }, []);

  return null;
}
