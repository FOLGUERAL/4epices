'use client';

import { useEffect, useState } from 'react';

export default function AdBlockNotice() {
  const [isAdBlockDetected, setIsAdBlockDetected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const detectAdBlock = () => {
      const win = window as Window & { canRunAds?: boolean };

      if (win.canRunAds === false) {
        setIsAdBlockDetected(true);
        return;
      }

      const testElement = document.createElement('div');
      testElement.className = 'adsbox';
      testElement.innerHTML = '&nbsp;';
      document.body.appendChild(testElement);

      const isHidden = getComputedStyle(testElement).display === 'none' || testElement.offsetHeight === 0;
      testElement.remove();

      setIsAdBlockDetected(isHidden);
    };

    const timeoutId = window.setTimeout(detectAdBlock, 1500);
    window.addEventListener('load', detectAdBlock);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('load', detectAdBlock);
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
