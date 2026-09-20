'use client';

import { useEffect, useMemo, useState } from 'react';
import DayMealPicker from '@/components/DayMealPicker';
import RecetteCardCompact from '@/components/RecetteCardCompact';
import { toast } from '@/components/Toast';
import { getFavorites, subscribeFavorites, toggleFavorite } from '@/lib/favorites';
import {
  MEAL_LABELS,
  formatDayLabel,
  getUpcomingEntries,
  planRecipe,
  type PlannableRecipe,
  type PlanSlot,
} from '@/lib/planning';
import type { CardRecipe } from '@/lib/recipeList';
import { getStrapiMediaUrl } from '@/lib/strapi';
import type { SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, saveSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

interface RecipeCardGridProps {
  recipes: CardRecipe[];
  /** false : cartes sans bouton de planification (page des favoris, qui ne planifie pas) */
  withPlanning?: boolean;
  className?: string;
}

function toPlannable(recipe: CardRecipe): PlannableRecipe {
  return {
    id: recipe.id,
    slug: recipe.slug,
    titre: recipe.titre,
    imageUrl: recipe.imageUrl ? getStrapiMediaUrl(recipe.imageUrl) : null,
  };
}

/**
 * Une grille de cartes de recette avec leurs actions : cœur (favoris) et, en option, planification.
 * Une seule fenêtre de choix du jour pour toute la grille. Partagée par les listes, les catégories,
 * les fiches ingrédient et le mélangeur.
 */
export default function RecipeCardGrid({
  recipes,
  withPlanning = true,
  className = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4',
}: RecipeCardGridProps) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number> | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState | null>(null);
  const [planTarget, setPlanTarget] = useState<PlannableRecipe | null>(null);

  // Favoris et planning vivent dans le localStorage : les actions des cartes apparaissent après le montage
  useEffect(() => {
    const reload = () => {
      setFavoriteIds(new Set(getFavorites().map((favorite) => favorite.id)));
      setSwipeState(loadSwipeState());
    };
    reload();
    const unsubscribeFavorites = subscribeFavorites(reload);
    const unsubscribeState = subscribeSwipeState(reload);
    return () => {
      unsubscribeFavorites();
      unsubscribeState();
    };
  }, []);

  // Pour chaque recette déjà planifiée, son premier créneau à venir
  const plannedLabels = useMemo(() => {
    const labels = new Map<number, string>();
    if (!swipeState) return labels;
    for (const entry of getUpcomingEntries(swipeState)) {
      if (labels.has(entry.recipeId)) continue;
      labels.set(entry.recipeId, `${formatDayLabel(entry.date, 'short')} · ${MEAL_LABELS[entry.meal].toLowerCase()}`);
    }
    return labels;
  }, [swipeState]);

  const handleToggleFavorite = (recipe: CardRecipe) => {
    const { id, slug, titre, imageUrl } = toPlannable(recipe);
    const nowFavorite = toggleFavorite({ id, slug, titre, imageUrl: imageUrl ?? undefined });
    toast.success(nowFavorite ? 'Recette ajoutée aux favoris' : 'Recette supprimée des favoris');
  };

  const handlePick = (slot: PlanSlot) => {
    if (!planTarget || !swipeState) return;
    saveSwipeState(planRecipe(swipeState, planTarget, slot));
    trackEvent('plan-assign', { meal: slot.meal, source: 'liste' });
    toast.success(`${planTarget.titre} planifiée : ${formatDayLabel(slot.date)}, ${MEAL_LABELS[slot.meal].toLowerCase()}`);
    setPlanTarget(null);
  };

  return (
    <>
      <div className={className}>
        {recipes.map((recipe) => (
          <RecetteCardCompact
            key={recipe.id}
            recette={recipe}
            actions={
              favoriteIds && swipeState
                ? {
                    isFavorite: favoriteIds.has(recipe.id),
                    plannedLabel: plannedLabels.get(recipe.id),
                    onToggleFavorite: () => handleToggleFavorite(recipe),
                    onPlan: withPlanning ? () => setPlanTarget(toPlannable(recipe)) : undefined,
                  }
                : undefined
            }
          />
        ))}
      </div>

      {withPlanning && swipeState && (
        <DayMealPicker recipe={planTarget} state={swipeState} onPick={handlePick} onClose={() => setPlanTarget(null)} />
      )}
    </>
  );
}
