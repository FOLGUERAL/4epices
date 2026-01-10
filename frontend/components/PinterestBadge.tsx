'use client';

import Link from 'next/link';

interface PinterestBadgeProps {
  pinterestPinId?: string;
  recetteId: number;
}

/**
 * Composant pour afficher le statut Pinterest d'une recette
 * Affiche un badge si la recette est publiée sur Pinterest avec un lien vers le pin
 */
export default function PinterestBadge({ pinterestPinId, recetteId }: PinterestBadgeProps) {
  if (!pinterestPinId) {
    return null;
  }

  // L'URL du pin Pinterest est basée sur le pinId
  // Format: https://www.pinterest.fr/pin/{pinId}/
  const pinterestPinUrl = `https://www.pinterest.fr/pin/${pinterestPinId}/`;

  return (
    <Link
      href={pinterestPinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
      title="Voir sur Pinterest"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.951-1.878l.434-1.647c.094-.357.567-.477.86-.207.044.033.086.07.123.111.06.067.131.14.21.211.05.046.1.09.15.132.418.35.942.531 1.487.528.545.003 1.069-.178 1.487-.528.05-.042.1-.086.15-.132.079-.071.15-.144.21-.211.037-.041.079-.078.123-.111.293-.27.766-.15.86.207l.434 1.647c.238.651.665 1.413.951 1.878-.655.203-1.352.312-2.073.312zm-3-6.5c-.828 0-1.5-.672-1.5-1.5S8.172 9.5 9 9.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm6 0c-.828 0-1.5-.672-1.5-1.5S14.172 9.5 15 9.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5z" />
      </svg>
      <span>Publié sur Pinterest</span>
    </Link>
  );
}

