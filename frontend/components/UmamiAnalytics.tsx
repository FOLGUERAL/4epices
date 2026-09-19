'use client';

import { useEffect } from 'react';

/**
 * Statistiques d'audience Umami (sans cookie, donc sans bandeau de consentement supplémentaire).
 * Inactif tant que NEXT_PUBLIC_UMAMI_WEBSITE_ID n'est pas défini au build.
 */
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const SCRIPT_URL = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js';

export default function UmamiAnalytics() {
  useEffect(() => {
    if (!WEBSITE_ID || typeof document === 'undefined') return;
    if (document.querySelector('script[data-website-id]')) return;

    const script = document.createElement('script');
    script.defer = true;
    script.src = SCRIPT_URL;
    script.setAttribute('data-website-id', WEBSITE_ID);
    // Respecte le réglage « Do Not Track » du navigateur
    script.setAttribute('data-do-not-track', 'true');
    document.head.appendChild(script);
  }, []);

  return null;
}
