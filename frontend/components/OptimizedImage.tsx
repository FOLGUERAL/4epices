'use client';

import Image from 'next/image';
import { getStrapiMediaUrl } from '@/lib/strapi';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
  aspectRatio?: string; // Permet de personnaliser le ratio (ex: "4/3", "16/9", etc.)
  disableAspectRatio?: boolean; // Désactive le wrapper aspect-ratio pour utiliser fill dans un conteneur déjà dimensionné
}

// Génère un blur placeholder base64 simple (gris clair)
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f3f4f6" offset="20%" />
      <stop stop-color="#e5e7eb" offset="50%" />
      <stop stop-color="#f3f4f6" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f3f4f6" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

// Base64 encodé statiquement pour éviter les problèmes côté client
// SVG simplifié : rectangle gris clair 800x600
const blurDataURL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIHN0b3AtY29sb3I9IiNmM2Y0ZjYiIG9mZnNldD0iMjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iI2U1ZTdlYiIgb2Zmc2V0PSI1MCUiLz48c3RvcCBzdG9wLWNvbG9yPSIjZjNmNGY2IiBvZmZzZXQ9IjcwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZjNmNGY2Ii8+PC9zdmc+';

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = '',
  priority = false,
  sizes,
  aspectRatio = '4/3',
  disableAspectRatio = false,
}: OptimizedImageProps) {
  // Image de fallback
  const fallbackImage = '/placeholder-recipe.svg';
  
  // URL de l'image
  const imageUrl = src
    ? getStrapiMediaUrl(src)
    : fallbackImage;

  // Pour le ratio 4:3 par défaut, on calcule la hauteur si width est fourni
  const defaultAspectRatio = 4 / 3;
  const calculatedHeight = width ? Math.round(width / defaultAspectRatio) : height;

  // Si fill est utilisé, on utilise un conteneur avec aspect-ratio (sauf si désactivé)
  if (fill) {
    // Si disableAspectRatio est true, retourner directement l'Image sans wrapper
    if (disableAspectRatio) {
      return (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className={className}
          placeholder="blur"
          blurDataURL={blurDataURL}
          priority={priority}
          sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          onError={(e) => {
            // En cas d'erreur, utiliser le fallback
            const target = e.target as HTMLImageElement;
            if (target.src !== fallbackImage) {
              target.src = fallbackImage;
            }
          }}
        />
      );
    }
    
    // Sinon, utiliser le wrapper avec aspect-ratio
    return (
      <div className={`relative ${className}`} style={{ aspectRatio }}>
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          placeholder="blur"
          blurDataURL={blurDataURL}
          priority={priority}
          sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          onError={(e) => {
            // En cas d'erreur, utiliser le fallback
            const target = e.target as HTMLImageElement;
            if (target.src !== fallbackImage) {
              target.src = fallbackImage;
            }
          }}
        />
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={width || 800}
      height={calculatedHeight || 600}
      className={className}
      placeholder="blur"
      blurDataURL={blurDataURL}
      priority={priority}
      sizes={sizes}
      onError={(e) => {
        // En cas d'erreur, utiliser le fallback
        const target = e.target as HTMLImageElement;
        if (target.src !== fallbackImage) {
          target.src = fallbackImage;
        }
      }}
    />
  );
}

