'use client';

import Link from 'next/link';
import { Recette } from '@/lib/strapi';
import OptimizedImage from './OptimizedImage';

interface HeroRecipeProps {
  recette: Recette;
}

function formatTime(minutes: number): string {
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

export default function HeroRecipe({ recette }: HeroRecipeProps) {
  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;
  const tempsPrep = recette.attributes.tempsPreparation || 0;
  const tempsCuisson = recette.attributes.tempsCuisson || 0;
  const tempsTotal = tempsPrep + tempsCuisson;

  return (
    <Link
      href={`/recettes/${recette.attributes.slug}`}
      className="block group"
    >
      <div className="relative min-h-[500px] h-[500px] sm:min-h-[600px] sm:h-[600px] lg:min-h-[700px] lg:h-[700px] rounded-2xl overflow-hidden shadow-2xl">
        {/* Image de fond */}
        {imageUrl && (
          <OptimizedImage
            src={imageUrl}
            alt={recette.attributes.titre}
            fill
            disableAspectRatio
            className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
            priority
            sizes="100vw"
          />
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

        {/* Contenu */}
        <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 lg:p-16 text-white z-20">
          <div className="max-w-4xl">
            {/* Badge Catégorie */}
            {recette.attributes.categories?.data && recette.attributes.categories.data.length > 0 && (
              <div className="mb-4 inline-block">
                <span className="px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-semibold">
                  {recette.attributes.categories.data[0].attributes.nom}
                </span>
              </div>
            )}

            {/* Titre */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 group-hover:text-orange-400 transition-colors">
              {recette.attributes.titre}
            </h2>

            {/* Description */}
            <p className="text-lg sm:text-xl mb-6 text-gray-100 line-clamp-2">
              {recette.attributes.description}
            </p>

            {/* Infos */}
            <div className="flex flex-wrap gap-4 mb-6">
              {tempsPrep > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏱️</span>
                  <span className="font-medium">{formatTime(tempsPrep)}</span>
                </div>
              )}
              {tempsCuisson > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <span className="font-medium">{formatTime(tempsCuisson)}</span>
                </div>
              )}
              {tempsTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏰</span>
                  <span className="font-medium">Total: {formatTime(tempsTotal)}</span>
                </div>
              )}
              {recette.attributes.difficulte && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <span className="font-medium capitalize">{recette.attributes.difficulte}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <span className="px-6 py-3 bg-orange-600 rounded-lg font-semibold hover:bg-orange-700 transition-colors">
                Voir la recette
              </span>
              <span className="text-lg group-hover:translate-x-2 transition-transform inline-block">
                →
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

