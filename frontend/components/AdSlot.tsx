'use client';

import { useEffect } from 'react';
import {
  getAdProvider,
  getEzoicPlaceholderId,
  isAdSenseEnabled,
  RecipeAdPlacement,
} from '@/lib/ads';
import GoogleAdSense from './GoogleAdSense';

interface AdSlotProps {
  placement: RecipeAdPlacement;
  adSlot?: string;
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  ezoicPlaceholderId?: string;
  style?: React.CSSProperties;
  className?: string;
}

declare global {
  interface Window {
    ezstandalone?: {
      cmd?: Array<() => void>;
      showAds?: (...ids: string[]) => void;
    };
  }
}

export default function AdSlot({
  placement,
  adSlot,
  adFormat = 'auto',
  ezoicPlaceholderId,
  style,
  className = '',
}: AdSlotProps) {
  const provider = getAdProvider();
  const placeholderId = ezoicPlaceholderId || getEzoicPlaceholderId(placement);
  const shouldUseEzoic = provider === 'ezoic' && placeholderId;

  useEffect(() => {
    if (!shouldUseEzoic || typeof window === 'undefined') return;

    window.ezstandalone = window.ezstandalone || {};
    window.ezstandalone.cmd = window.ezstandalone.cmd || [];
    window.ezstandalone.cmd.push(() => {
      window.ezstandalone?.showAds?.(placeholderId);
    });
  }, [placeholderId, shouldUseEzoic]);

  if (shouldUseEzoic) {
    return (
      <div className={`ezoic-ad-container ${className}`} style={style}>
        <div id={`ezoic-pub-ad-placeholder-${placeholderId}`} />
      </div>
    );
  }

  if (provider === 'adsense' || (provider === 'ezoic' && isAdSenseEnabled())) {
    return (
      <GoogleAdSense
        adSlot={adSlot}
        adFormat={adFormat}
        className={className}
        style={style}
      />
    );
  }

  return null;
}
