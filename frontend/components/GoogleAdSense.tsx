'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT, isAdSenseEnabled } from '@/lib/ads';

interface GoogleAdSenseProps {
  adSlot?: string;
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Composant pour afficher des annonces Google AdSense
 *
 * L'annonce n'est demandée que lorsqu'elle approche de l'écran (meilleure visibilité, page plus légère).
 *
 * @param adSlot - L'ID de l'unité d'annonce (ex: "1234567890"). Si non fourni, utilise NEXT_PUBLIC_GOOGLE_ADS_SLOT
 * @param adFormat - Format de l'annonce (auto, rectangle, vertical, horizontal)
 * @param style - Styles CSS personnalisés
 * @param className - Classes CSS personnalisées
 */
export default function GoogleAdSense({
  adSlot,
  adFormat = 'auto',
  style,
  className = '',
}: GoogleAdSenseProps) {
  const enabled = isAdSenseEnabled();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);

  // Utiliser le slot fourni ou celui de l'environnement
  const finalAdSlot = adSlot || process.env.NEXT_PUBLIC_GOOGLE_ADS_SLOT || '';
  const shouldRender = enabled && Boolean(finalAdSlot);

  useEffect(() => {
    if (!shouldRender) return;
    const container = containerRef.current;
    if (!container) return;

    const requestAd = () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      try {
        // La file adsbygoogle accepte les demandes avant la fin du chargement du script
        const win = window as Window & { adsbygoogle?: unknown[] };
        (win.adsbygoogle = win.adsbygoogle || []).push({});
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de Google AdSense:', error);
      }
    };

    if (!('IntersectionObserver' in window)) {
      requestAd();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestAd();
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, [shouldRender]);

  // Ne pas afficher si AdSense est désactivé ou si aucun slot n'est configuré
  if (!shouldRender) {
    return null;
  }

  return (
    <div ref={containerRef} className={`google-adsense-container ${className}`} style={style}>
      <span className="block text-center text-[10px] uppercase tracking-wide text-gray-400">
        Publicité
      </span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={finalAdSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
}
