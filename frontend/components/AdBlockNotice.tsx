'use client';

import { useEffect, useState } from 'react';

export default function AdBlockNotice() {
  const [isAdBlockDetected, setIsAdBlockDetected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const detectAdBlock = () => {
      const win = window as Window & {
        canRunAds?: boolean;
        adsbygoogle?: unknown[];
      };

      if (win.canRunAds === false) {
        setIsAdBlockDetected(true);
        return;
      }

      const container = document.body || document.documentElement;
      const bait = document.createElement('div');
      bait.className = 'pub_300x250 pub_300x250m adsbygoogle adsbox';
      bait.id = 'adblock-bait';
      bait.setAttribute('aria-hidden', 'true');
      bait.style.position = 'absolute';
      bait.style.left = '-9999px';
      bait.style.top = '-9999px';
      bait.style.width = '1px';
      bait.style.height = '1px';
      bait.style.opacity = '0';
      bait.style.pointerEvents = 'none';
      container.appendChild(bait);

      const style = window.getComputedStyle(bait);
      const isHidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0 ||
        bait.getClientRects().length === 0;

      bait.remove();

      setIsAdBlockDetected(isHidden);
    };

    const runDetection = () => {
      window.setTimeout(() => {
        requestAnimationFrame(() => detectAdBlock());
      }, 1200);
    };

    runDetection();
    window.addEventListener('load', runDetection);

    return () => {
      window.removeEventListener('load', runDetection);
    };
  }, []);

  if (!isAdBlockDetected) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50/90">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-1 px-4 py-3 text-center text-sm text-amber-900 sm:flex-row sm:text-left">
        <span className="font-semibold">Un bloqueur de publicités semble être actif.</span>
        <span>
          Les publicités permettent à 4epices de continuer à exister. Merci de nous soutenir en
          autorisant les annonces sur ce site.
        </span>
      </div>
    </div>
  );
}
