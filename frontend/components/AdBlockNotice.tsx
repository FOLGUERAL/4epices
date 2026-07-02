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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.01M10.5 3.75 2.25 18a1.5 1.5 0 0 0 1.3 2.25h16.9a1.5 1.5 0 0 0 1.3-2.25L13.5 3.75a1.5 1.5 0 0 0-2.6 0Z" />
          </svg>
        </div>

        <h2 className="mt-5 text-center text-2xl font-bold text-gray-950">
          Les publicités sont nécessaires pour maintenir 4epices
        </h2>

        <p className="mt-3 text-center text-sm leading-6 text-gray-700">
          Un bloqueur de publicités semble être actif. Merci de l&apos;autoriser sur ce site pour
          nous aider à continuer à proposer du contenu gratuit. Nous évitons de diffuser des publicités
          de façon intrusive : contrairement à beaucoup de sites de cuisine,
          nous privilégions une expérience de lecture plus propre et plus sereine.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Que faire ?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Désactivez temporairement votre bloqueur pour ce site.</li>
            <li>Actualisez la page après modification.</li>
            <li>Si vous ne souhaitez pas autoriser les annonces, vous pouvez quitter cette page.</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
          >
            Recharger la page
          </button>
        </div>
      </div>
    </div>
  );
}
