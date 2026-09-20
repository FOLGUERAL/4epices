'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CalendarCheck, CalendarPlus, Heart } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import { formatMinutes, getTotalMinutes } from '@/lib/recipeList';
import type { Recette } from '@/lib/strapi';

const RatingDisplay = dynamic(() => import('./RatingDisplay'), {
  ssr: false,
});

/** Les actions rapides d'une carte : sans elles, la carte n'affiche que le lien vers la recette. */
export interface RecetteCardActions {
  isFavorite: boolean;
  /** Créneau où la recette est déjà planifiée (« jeu. 18 · soir »), s'il y en a un */
  plannedLabel?: string;
  onToggleFavorite: () => void;
  /** Sans cette action, la carte n'affiche pas le bouton de planification (page des favoris) */
  onPlan?: () => void;
}

interface RecetteCardCompactProps {
  recette: Recette;
  actions?: RecetteCardActions;
}

const actionButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition-colors';

/** Carte de recette compacte : image, titre, durée et difficulté, note. Le titre couvre toute la carte. */
export default function RecetteCardCompact({ recette, actions }: RecetteCardCompactProps) {
  const { titre, slug, difficulte } = recette.attributes;
  const image = recette.attributes.imagePrincipale?.data?.attributes;
  const total = formatMinutes(getTotalMinutes(recette));
  const details = [total, difficulte ? difficulte.charAt(0).toUpperCase() + difficulte.slice(1) : ''].filter(Boolean);

  return (
    <article className="card-base card-hover group/card relative flex h-full flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <OptimizedImage
          src={image?.url || null}
          alt={image?.alternativeText || titre}
          fill
          disableAspectRatio
          className="object-cover transition-transform duration-500 group-hover/card:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>

      {actions && (
        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
          {actions.onPlan && (
            <button
              type="button"
              onClick={actions.onPlan}
              aria-label={
                actions.plannedLabel ? `${titre} : planifiée ${actions.plannedLabel}, modifier` : `Planifier ${titre}`
              }
              className={`${actionButton} ${
                actions.plannedLabel ? 'text-emerald-700 hover:bg-emerald-50' : 'text-gray-700 hover:bg-white'
              }`}
            >
              {actions.plannedLabel ? (
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <CalendarPlus className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={actions.onToggleFavorite}
            aria-pressed={actions.isFavorite}
            aria-label={actions.isFavorite ? `Retirer ${titre} des favoris` : `Ajouter ${titre} aux favoris`}
            className={`${actionButton} hover:bg-white`}
          >
            <Heart
              className={`h-5 w-5 ${actions.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-gray-700'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 [text-wrap:balance] sm:text-lg">
          <Link
            href={`/recettes/${slug}`}
            className="transition-colors after:absolute after:inset-0 hover:text-orange-600 focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-orange-500"
          >
            {titre}
          </Link>
        </h3>
        {details.length > 0 && <p className="text-sm tabular-nums text-gray-600">{details.join(' · ')}</p>}
        <div className="mt-auto pt-1">
          <RatingDisplay recetteId={recette.id} size="sm" />
        </div>
      </div>
    </article>
  );
}
