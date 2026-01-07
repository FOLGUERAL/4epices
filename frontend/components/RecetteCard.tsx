'use client';

import Link from 'next/link';
import { Recette } from '@/lib/strapi';
import OptimizedImage from './OptimizedImage';
import dynamic from 'next/dynamic';

const RatingDisplay = dynamic(() => import('./RatingDisplay'), {
  ssr: false,
});

interface RecetteCardProps {
  recette: Recette;
}

export default function RecetteCard({ recette }: RecetteCardProps) {
  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;

  return (
    <Link
      href={`/recettes/${recette.attributes.slug}`}
      className="card-base card-hover group flex flex-col h-full"
    >
      <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-gray-100">
        <OptimizedImage
          src={imageUrl}
          alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-5 sm:p-6 flex flex-col flex-grow">
        <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
          {recette.attributes.titre}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-2 mb-4 flex-grow">
          {recette.attributes.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 mb-4 gap-y-2">
          {recette.attributes.tempsPreparation && (
            <span className="flex items-center gap-1.5 font-medium bg-orange-50 px-3 py-1.5 rounded-full">
              <span>⏱️</span>
              <span>{recette.attributes.tempsPreparation} min</span>
            </span>
          )}
          {recette.attributes.nombrePersonnes && (
            <span className="flex items-center gap-1.5 font-medium bg-accent-50 px-3 py-1.5 rounded-full">
              <span>👥</span>
              <span>{recette.attributes.nombrePersonnes} pers.</span>
            </span>
          )}
          {recette.attributes.difficulte && (
            <span className={`capitalize px-3 py-1.5 rounded-full text-xs font-semibold ${
              recette.attributes.difficulte === 'facile' ? 'bg-success-100 text-success-700' :
              recette.attributes.difficulte === 'moyen' ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {recette.attributes.difficulte}
            </span>
          )}
        </div>
        <div className="mb-3">
          <RatingDisplay recetteId={recette.id} size="sm" />
        </div>
        {recette.attributes.tags?.data && recette.attributes.tags.data.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recette.attributes.tags.data.slice(0, 3).map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.attributes.slug}`}
                className="px-2.5 py-1 bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:from-orange-100 hover:to-orange-200 transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                #{tag.attributes.nom}
              </Link>
            ))}
            {recette.attributes.tags.data.length > 3 && (
              <span className="px-2.5 py-1 text-gray-400 text-xs font-medium">
                +{recette.attributes.tags.data.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

