'use client';

import { useEffect, useState } from 'react';
import AddToShoppingListButton from '@/components/AddToShoppingListButton';
import FavoriteButton from '@/components/FavoriteButton';
import KitchenModeLink from '@/components/KitchenModeLink';
import PlanFavoriteButton from '@/components/PlanFavoriteButton';
import type { Recette } from '@/lib/strapi';

interface RecipeActionBarProps {
  recette: Recette;
  /** Adresse de l'image, déjà résolue, enregistrée avec le favori et le repas planifié */
  imageUrl?: string;
  ingredients: unknown[];
}

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Les actions de la recette au même endroit : cuisiner, planifier, favori, courses.
 * Sur mobile, la barre reste collée en bas de l'écran ; sur grand écran, elle se place sous la description.
 */
export default function RecipeActionBar({ recette, imageUrl, ingredients }: RecipeActionBarProps) {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const update = () => setIsStandalone(isStandaloneDisplay());

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const summary = { id: recette.id, slug: recette.attributes.slug, titre: recette.attributes.titre, imageUrl };

  return (
    <>
      <div
        role="group"
        aria-label="Actions de la recette"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-gray-200 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur print:hidden sm:static sm:z-auto sm:mb-8 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none"
      >
        <KitchenModeLink
          recette={recette}
          label="Cuisiner"
          className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700 sm:flex-none"
        />
        <PlanFavoriteButton recette={summary} className="flex-shrink-0" iconOnlyOnMobile />
        <FavoriteButton recette={summary} className="flex-shrink-0" />
        <AddToShoppingListButton ingredients={ingredients} recipeId={recette.id} />
      </div>

      {isStandalone && (
        <p className="mb-6 hidden text-sm font-semibold text-orange-800 sm:block">
          App installée : l&apos;interface est optimisée pour cuisiner en plein écran.
        </p>
      )}
    </>
  );
}
