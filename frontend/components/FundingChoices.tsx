'use client';

import { useEffect } from 'react';
import { ADSENSE_CLIENT } from '@/lib/ads';

/**
 * Charge le message de consentement Google (Funding Choices, certifié TCF).
 * Doit être monté avant AdSenseScript. Le message lui-même se configure dans
 * AdSense > Confidentialité et messagerie ; sans configuration côté Google, ce script est inerte.
 */
export default function FundingChoices() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const pubId = ADSENSE_CLIENT.replace('ca-', '');

    if (!document.querySelector('script[src*="fundingchoicesmessages.google.com"]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://fundingchoicesmessages.google.com/i/${pubId}?ers=1`;
      document.head.appendChild(script);
    }

    // Signale à Google que le CMP est présent (évite l'erreur « Google CMP not detected »)
    if (!(window.frames as unknown as Record<string, unknown>)['googlefcPresent']) {
      const iframe = document.createElement('iframe');
      iframe.name = 'googlefcPresent';
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
    }
  }, []);

  return null;
}
