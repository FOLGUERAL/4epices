'use client';

import { useEffect, useMemo, useState } from 'react';

export default function AdBlockNotice() {
  const [isAdBlockDetected, setIsAdBlockDetected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const win = window as Window & {
      canRunAds?: boolean;
      adsbygoogle?: unknown[];
      __adBlockDetected?: boolean;
    };

    const detectAdBlock = () => {
      const indicators = {
        canRunAdsFalse: win.canRunAds === false,
        globalFlag: win.__adBlockDetected === true,
        adsbygoogleMissing: !win.adsbygoogle,
        baitHidden: false,
      };

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
      indicators.baitHidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0 ||
        bait.getClientRects().length === 0;

      bait.remove();

      const blocked =
        indicators.canRunAdsFalse ||
        indicators.globalFlag ||
        (indicators.adsbygoogleMissing && indicators.baitHidden);

      setIsAdBlockDetected(blocked);
      setIsChecking(false);
    };

    const runDetection = () => {
      window.setTimeout(() => {
        requestAnimationFrame(() => detectAdBlock());
      }, 1500);
    };

    runDetection();
    window.addEventListener('load', runDetection);

    return () => {
      window.removeEventListener('load', runDetection);
    };
  }, []);

  const shouldShowNotice = useMemo(() => isAdBlockDetected, [isAdBlockDetected]);

  if (isChecking || !shouldShowNotice) {
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
