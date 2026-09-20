'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Zap } from 'lucide-react';
import DayMealPicker from '@/components/DayMealPicker';
import FilterChip from '@/components/FilterChip';
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
import {
  NO_LIST_FILTERS,
  filterRecettes,
  getCategoryOptions,
  hasActiveListFilters,
  type ListFilters,
} from '@/lib/recipeList';
import { getStrapiMediaUrl, type Recette } from '@/lib/strapi';
import type { SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, saveSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

interface Props {
  recettes: Recette[];
}

function toPlannable(recette: Recette): PlannableRecipe {
  const url = recette.attributes.imagePrincipale?.data?.attributes?.url;
  return {
    id: recette.id,
    slug: recette.attributes.slug,
    titre: recette.attributes.titre,
    imageUrl: url ? getStrapiMediaUrl(url) : null,
  };
}

export default function RecipesFiltersClient({ recettes }: Props) {
  const [filters, setFilters] = useState<ListFilters>(NO_LIST_FILTERS);
  const [favoriteIds, setFavoriteIds] = useState<Set<number> | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState | null>(null);
  /** Recette pour laquelle la fenêtre de planification est ouverte (une seule fenêtre pour toute la page) */
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

  const categories = useMemo(() => getCategoryOptions(recettes), [recettes]);
  const filtered = useMemo(() => filterRecettes(recettes, filters), [recettes, filters]);

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

  const active = hasActiveListFilters(filters);
  const reset = () => setFilters(NO_LIST_FILTERS);

  const handleToggleFavorite = (recette: Recette) => {
    const { id, slug, titre, imageUrl } = toPlannable(recette);
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
    <div>
      <div className="mb-5 space-y-3">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
          <label htmlFor="recettes-search" className="sr-only">
            Rechercher une recette ou un ingrédient
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="recettes-search"
            type="search"
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Rechercher une recette ou un ingrédient…"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-base !text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </form>

        <ul aria-label="Filtres" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <li className="flex-shrink-0">
            <FilterChip active={filters.quick} onClick={() => setFilters((current) => ({ ...current, quick: !current.quick }))}>
              <Zap className="h-4 w-4" aria-hidden="true" />
              30 min max
            </FilterChip>
          </li>
          <li className="flex-shrink-0">
            <FilterChip active={filters.easy} onClick={() => setFilters((current) => ({ ...current, easy: !current.easy }))}>
              Facile
            </FilterChip>
          </li>
          {categories.map((category) => (
            <li key={category.slug} className="flex-shrink-0">
              <FilterChip
                active={filters.category === category.slug}
                onClick={() =>
                  setFilters((current) => ({ ...current, category: current.category === category.slug ? null : category.slug }))
                }
              >
                {category.nom}
              </FilterChip>
            </li>
          ))}
        </ul>

        <div className="flex min-h-11 items-center justify-between gap-3">
          <p role="status" className="text-sm tabular-nums text-gray-600">
            {filtered.length} {filtered.length === 1 ? 'recette' : 'recettes'}
          </p>
          {active && (
            <button
              type="button"
              onClick={reset}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-700">Aucune recette ne correspond à votre recherche.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 min-h-11 rounded-xl bg-orange-600 px-5 font-bold text-white transition-colors hover:bg-orange-700"
          >
            Voir toutes les recettes
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((recette) => (
            <RecetteCardCompact
              key={recette.id}
              recette={recette}
              actions={
                favoriteIds && swipeState
                  ? {
                      isFavorite: favoriteIds.has(recette.id),
                      plannedLabel: plannedLabels.get(recette.id),
                      onToggleFavorite: () => handleToggleFavorite(recette),
                      onPlan: () => setPlanTarget(toPlannable(recette)),
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {swipeState && (
        <DayMealPicker recipe={planTarget} state={swipeState} onPick={handlePick} onClose={() => setPlanTarget(null)} />
      )}
    </div>
  );
}
