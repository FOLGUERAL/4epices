'use client';

import { useEffect } from 'react';

const ADS_CLIENT = 'ca-pub-9219883229313117';

/**
 * Charge le script AdSense uniquement côté client après le montage.
 * Évite le <link rel="preload"> de next/script (credentials / crossorigin) et les avertissements associés.
 */
export default function AdSenseScript() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.querySelector('script[src*="pagead/js/adsbygoogle.js"]')) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, []);

  return null;
}
