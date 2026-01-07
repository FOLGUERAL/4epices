'use client';

import Link from 'next/link';
import { Recette } from '@/lib/strapi';
import OptimizedImage from './OptimizedImage';

interface HeroRecipeProps {
  recette: Recette;
}

export default function HeroRecipe({ recette }: HeroRecipeProps) {
  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;
  const tempsTotal = (recette.attributes.tempsPreparation || 0) + (recette.attributes.tempsCuisson || 0);

  return (
    <Link
      href={`/recettes/${recette.attributes.slug}`}
      className="block group"
    >
      <div className="relative h-[500px] sm:h-[600px] lg:h-[700px] rounded-2xl overflow-hidden shadow-2xl">
        {/* Image de fond */}
        {imageUrl && (
          <div className="absolute inset-0">
            <OptimizedImage
              src={imageUrl}
              alt={recette.attributes.titre}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              priority
              sizes="100vw"
            />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Contenu */}
        <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 lg:p-16 text-white">
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
              {recette.attributes.tempsPreparation && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏱️</span>
                  <span className="font-medium">{recette.attributes.tempsPreparation} min</span>
                </div>
              )}
              {tempsTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏰</span>
                  <span className="font-medium">Total: {tempsTotal} min</span>
                </div>
              )}
              {recette.attributes.nombrePersonnes && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👥</span>
                  <span className="font-medium">{recette.attributes.nombrePersonnes} personnes</span>
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

