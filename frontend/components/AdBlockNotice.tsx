'use client';

import { useEffect, useMemo, useState } from 'react';

const DISMISS_STORAGE_KEY = 'adblock-notice-dismissed-at';
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export default function AdBlockNotice() {
  const [isAdBlockDetected, setIsAdBlockDetected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  const isLocalEnvironment = useMemo(() => {
    if (typeof window === 'undefined') {
      return process.env.NODE_ENV === 'development';
    }

    const hostname = window.location.hostname.toLowerCase();
    return (
      process.env.NODE_ENV === 'development' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local')
    );
  }, []);

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

  useEffect(() => {
    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY));
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) {
        setIsDismissed(true);
      }
    } catch {
      // localStorage indisponible (navigation privée, données bloquées) : le bandeau reste affichable
    }
  }, []);

  const dismiss = () => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Sans stockage, la fermeture ne vaut que pour cette page
    }
  };

  const shouldShowNotice = useMemo(
    () => !isLocalEnvironment && isAdBlockDetected && !isDismissed,
    [isAdBlockDetected, isDismissed, isLocalEnvironment]
  );

  if (isChecking || !shouldShowNotice) {
    return null;
  }

  // Bandeau discret en bas de page : ne bloque ni la lecture ni la navigation
  return (
    <div
      role="region"
      aria-label="Soutenir 4epices"
      className="fixed inset-x-0 bottom-0 z-[1000] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-lg">
        <p className="flex-1 text-sm leading-6 text-gray-700">
          <span className="font-semibold text-gray-900">4epices reste gratuit grâce à quelques publicités discrètes.</span>{' '}
          Si vous utilisez un bloqueur, pensez à l&apos;autoriser sur ce site pour nous soutenir. Merci !
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer ce message"
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
