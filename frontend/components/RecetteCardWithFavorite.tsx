'use client';

import Link from 'next/link';
import { Recette } from '@/lib/strapi';
import OptimizedImage from './OptimizedImage';
import FavoriteButton from './FavoriteButton';
import { getStrapiMediaUrl } from '@/lib/strapi';

interface RecetteCardWithFavoriteProps {
  recette: Recette;
}

function formatTime(minutes: number): string {
  if (minutes <= 0) {
    return '';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

export default function RecetteCardWithFavorite({ recette }: RecetteCardWithFavoriteProps) {
  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;
  const imageUrlForFavorite = imageUrl ? getStrapiMediaUrl(imageUrl) : undefined;
  const tempsPrep = recette.attributes.tempsPreparation || 0;
  const tempsCuisson = recette.attributes.tempsCuisson || 0;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl hover:bg-orange-50 transition-all group relative">
      <Link
        href={`/recettes/${recette.attributes.slug}`}
        className="block"
      >
        <div className="relative h-72">
          <OptimizedImage
            src={imageUrl}
            alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
            fill
            className="group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
            {recette.attributes.titre}
          </h3>
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">
            {recette.attributes.description}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-700 mb-3">
            {tempsPrep > 0 && (
              <span className="flex items-center gap-1 font-medium">
                <span>⏱️</span>
                <span>{formatTime(tempsPrep)}</span>
              </span>
            )}
            {tempsCuisson > 0 && (
              <span className="flex items-center gap-1 font-medium">
                <span>🔥</span>
                <span>{formatTime(tempsCuisson)}</span>
              </span>
            )}
            {recette.attributes.difficulte && (
              <span className="capitalize px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                {recette.attributes.difficulte}
              </span>
            )}
          </div>
          {recette.attributes.tags?.data && recette.attributes.tags.data.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recette.attributes.tags.data.slice(0, 3).map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.attributes.slug}`}
                  className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs hover:bg-orange-100 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  #{tag.attributes.nom}
                </Link>
              ))}
              {recette.attributes.tags.data.length > 3 && (
                <span className="px-2 py-0.5 text-gray-400 text-xs">
                  +{recette.attributes.tags.data.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
      <div className="absolute top-4 right-4 z-10">
        <FavoriteButton
          recette={{
            id: recette.id,
            slug: recette.attributes.slug,
            titre: recette.attributes.titre,
            imageUrl: imageUrlForFavorite,
          }}
        />
      </div>
    </div>
  );
}

