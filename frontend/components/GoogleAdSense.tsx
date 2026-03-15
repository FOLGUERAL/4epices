'use client';

import { useEffect } from 'react';

interface GoogleAdSenseProps {
  adSlot?: string;
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Composant pour afficher des annonces Google AdSense
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
  // Utiliser le slot fourni ou celui de l'environnement
  const finalAdSlot = adSlot || process.env.NEXT_PUBLIC_GOOGLE_ADS_SLOT || '';

  useEffect(() => {
    try {
      // Initialiser les annonces AdSense après le chargement du script
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de Google AdSense:', error);
    }
  }, []);

  // Ne pas afficher si aucun slot n'est configuré
  if (!finalAdSlot) {
    return null;
  }

  return (
    <div className={`google-adsense-container ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-9219883229313117"
        data-ad-slot={finalAdSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
}
