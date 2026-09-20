'use client';

import { useMemo, useState } from 'react';
import { Search, Zap } from 'lucide-react';
import FilterChip from '@/components/FilterChip';
import RecipeCardGrid from '@/components/RecipeCardGrid';
import {
  NO_LIST_FILTERS,
  filterRecettes,
  getCategoryOptions,
  hasActiveListFilters,
  toCardRecipe,
  type ListFilters,
} from '@/lib/recipeList';
import type { Recette } from '@/lib/strapi';

/** Sous ce nombre de recettes, la recherche et les filtres n'apportent rien : on n'affiche que les cartes */
const MIN_RECIPES_FOR_CONTROLS = 6;

interface Props {
  recettes: Recette[];
  /** false : cartes sans bouton de planification (page des favoris, qui ne planifie pas) */
  withPlanning?: boolean;
  /** false : pas de puces de catégorie (la page les présente elle-même, en liens) */
  showCategoryChips?: boolean;
}

export default function RecipesFiltersClient({ recettes, withPlanning = true, showCategoryChips = true }: Props) {
  const [filters, setFilters] = useState<ListFilters>(NO_LIST_FILTERS);

  const categories = useMemo(() => getCategoryOptions(recettes), [recettes]);
  const filtered = useMemo(() => filterRecettes(recettes, filters), [recettes, filters]);
  const cards = useMemo(() => filtered.map(toCardRecipe), [filtered]);

  const active = hasActiveListFilters(filters);
  const reset = () => setFilters(NO_LIST_FILTERS);

  if (recettes.length <= MIN_RECIPES_FOR_CONTROLS) {
    return <RecipeCardGrid recipes={cards} withPlanning={withPlanning} />;
  }

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
          {showCategoryChips &&
            categories.map((category) => (
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
            {cards.length} {cards.length === 1 ? 'recette' : 'recettes'}
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

      {cards.length === 0 ? (
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
        <RecipeCardGrid recipes={cards} withPlanning={withPlanning} />
      )}
    </div>
  );
}
