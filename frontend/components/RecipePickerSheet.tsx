'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Shuffle, SkipForward, Zap } from 'lucide-react';
import FilterChip from '@/components/FilterChip';
import OptimizedImage from '@/components/OptimizedImage';
import PlanSheet from '@/components/PlanSheet';
import { formatSlotLabel, type PlanSlot } from '@/lib/planning';
import {
  NO_FILTERS,
  applyFilters,
  categoryLabel,
  getAvailableCategories,
  hasActiveFilters,
  suggestForSlot,
  type RecipeFilters,
} from '@/lib/recipeSuggestions';
import { searchRecipes } from '@/lib/recipeSearch';
import { getStrapiMediaUrl } from '@/lib/strapi';
import type { PlanEntry, SwipeRecipe, SwipeState } from '@/lib/swipeEngine';

/** Une recette proposée dans le planning, qu'elle vienne des favoris ou du catalogue. */
export interface PickerRecipe {
  id: number;
  slug: string;
  titre: string;
  /** Adresse déjà résolue (comme celle enregistrée dans les favoris) */
  imageUrl: string | null;
  totalMinutes?: number;
}

export function toPickerRecipe(recipe: SwipeRecipe): PickerRecipe {
  return {
    id: recipe.id,
    slug: recipe.slug,
    titre: recipe.titre,
    imageUrl: recipe.imageUrl ? getStrapiMediaUrl(recipe.imageUrl) : null,
    totalMinutes: recipe.totalMinutes > 0 ? recipe.totalMinutes : undefined,
  };
}

interface RecipePickerSheetProps {
  /** Créneau à remplir ; null = fenêtre fermée */
  slot: PlanSlot | null;
  occupant?: PlanEntry;
  /** Planning en cours : les suggestions tiennent compte de ce qui est prévu autour du créneau */
  state: SwipeState;
  /** Favoris sans repas à venir, proposés en premier */
  pile: PickerRecipe[];
  /** Tout le catalogue, pour la recherche et les suggestions */
  recipes: SwipeRecipe[];
  favoriteIds: Set<number>;
  /** id de recette → créneau où elle est déjà prévue */
  plannedLabels: Map<number, string>;
  chain: boolean;
  hasNextFree: boolean;
  onChainChange: (value: boolean) => void;
  onPick: (recipe: PickerRecipe) => void;
  onToggleFavorite: (recipe: PickerRecipe) => void;
  onClear: () => void;
  onSkip: () => void;
  onClose: () => void;
}

interface Section {
  key: string;
  label: string;
  items: PickerRecipe[];
}

const MAX_RESULTS = 30;
const IDEAS_COUNT = 8;
const IDEAS_COUNT_FILTERED = 20;
/** « Surprends-moi » tire au hasard parmi les meilleures suggestions */
const SURPRISE_POOL = 15;

/**
 * Choix d'une recette pour un créneau. Champ vide : les favoris à planifier, puis des idées adaptées au créneau.
 * Dès qu'on tape : tout le catalogue. Des filtres (rapide, facile, cuisine) s'appliquent aux deux.
 */
export default function RecipePickerSheet({
  slot,
  occupant,
  state,
  pile,
  recipes,
  favoriteIds,
  plannedLabels,
  chain,
  hasNextFree,
  onChainChange,
  onPick,
  onToggleFavorite,
  onClear,
  onSkip,
  onClose,
}: RecipePickerSheetProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<RecipeFilters>(NO_FILTERS);
  const [surprise, setSurprise] = useState<PickerRecipe | null>(null);
  /** Les surprises déjà proposées pour ce créneau : le re-tirage ne les repropose pas */
  const surpriseSeen = useRef(new Set<number>());
  const slotKey = slot ? `${slot.date}|${slot.meal}` : '';

  // Nouveau créneau (ouverture, ou passage au suivant) : on repart d'une recherche vide, les filtres restent
  useEffect(() => {
    setQuery('');
    setSurprise(null);
    surpriseSeen.current = new Set();
  }, [slotKey]);

  const searching = query.trim().length > 0;
  const filtersActive = hasActiveFilters(filters);
  const categories = useMemo(() => getAvailableCategories(recipes), [recipes]);
  const filteredRecipes = useMemo(() => applyFilters(recipes, filters), [recipes, filters]);
  const filteredIds = useMemo(() => new Set(filteredRecipes.map((recipe) => recipe.id)), [filteredRecipes]);

  const rollSurprise = () => {
    if (!slot) return;
    let pool = suggestForSlot(filteredRecipes, slot, state, { limit: SURPRISE_POOL, excludeIds: surpriseSeen.current });
    if (pool.length === 0) {
      // Tout a été proposé : on repart du début
      surpriseSeen.current = new Set();
      pool = suggestForSlot(filteredRecipes, slot, state, { limit: SURPRISE_POOL });
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    surpriseSeen.current.add(pick.id);
    setSurprise(toPickerRecipe(pick));
  };

  // Une surprise qui ne respecte plus les filtres, ou pendant une recherche, n'est pas affichée
  const shownSurprise = surprise && !searching && filteredIds.has(surprise.id) ? surprise : null;

  const sections = useMemo<Section[]>(() => {
    if (searching) {
      const items = searchRecipes(filteredRecipes, query, MAX_RESULTS).map(toPickerRecipe);
      return [{ key: 'results', label: `${items.length} ${items.length === 1 ? 'résultat' : 'résultats'}`, items }];
    }

    const favorites = (filtersActive ? pile.filter((item) => filteredIds.has(item.id)) : pile).slice(0, MAX_RESULTS);
    const ideas = slot
      ? suggestForSlot(filteredRecipes, slot, state, {
          limit: filtersActive ? IDEAS_COUNT_FILTERED : IDEAS_COUNT,
          excludeIds: new Set(pile.map((item) => item.id)),
          // Un filtre est une demande explicite : on montre aussi ce qui est déjà prévu ou refusé au swipe
          keepExcluded: filtersActive,
        }).map(toPickerRecipe)
      : [];

    const result: Section[] = [];
    if (favorites.length > 0) result.push({ key: 'favorites', label: 'Vos favoris à planifier', items: favorites });
    if (ideas.length > 0) {
      result.push({ key: 'ideas', label: `Idées pour le ${slot?.meal === 'midi' ? 'midi' : 'soir'}`, items: ideas });
    }
    return result;
  }, [searching, filteredRecipes, filteredIds, query, filtersActive, pile, slot, state]);

  const hasResults = sections.some((section) => section.items.length > 0);
  const firstResult = searching ? sections[0]?.items[0] : undefined;

  const toggleCategory = (slug: string) =>
    setFilters((current) => ({ ...current, category: current.category === slug ? null : slug }));

  const renderItem = (item: PickerRecipe) => {
    const isFavorite = favoriteIds.has(item.id);
    const plannedAt = plannedLabels.get(item.id);
    return (
      <li key={item.id} className="flex items-center gap-1 rounded-xl bg-white pr-1 shadow-sm">
        <button
          type="button"
          onClick={() => onPick(item)}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-orange-50"
        >
          <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
            <OptimizedImage src={item.imageUrl} alt="" fill disableAspectRatio sizes="40px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 block text-sm font-semibold text-gray-900">{item.titre}</span>
            {(item.totalMinutes || plannedAt) && (
              <span className="block truncate text-xs tabular-nums text-gray-500">
                {item.totalMinutes ? `${item.totalMinutes} min` : ''}
                {item.totalMinutes && plannedAt ? ' · ' : ''}
                {plannedAt ? `déjà prévue : ${plannedAt}` : ''}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onToggleFavorite(item)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Retirer ${item.titre} des favoris` : `Ajouter ${item.titre} aux favoris`}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-rose-50"
        >
          <Heart
            className={`h-5 w-5 transition-colors ${isFavorite ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`}
            aria-hidden="true"
          />
        </button>
      </li>
    );
  };

  return (
    <PlanSheet
      open={slot !== null}
      title={slot ? formatSlotLabel(slot) : ''}
      subtitle={occupant ? `Remplace : ${occupant.titre}` : undefined}
      onClose={onClose}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (firstResult) onPick(firstResult);
        }}
      >
        <label htmlFor="planning-picker-search" className="sr-only">
          Rechercher une recette
        </label>
        <input
          id="planning-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une recette…"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
      </form>

      <ul aria-label="Filtres" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        <li className="flex-shrink-0">
          <button
            type="button"
            onClick={rollSurprise}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-4 text-sm font-semibold text-orange-800 transition-colors hover:bg-orange-100"
          >
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            {shownSurprise ? 'Une autre ?' : 'Surprends-moi'}
          </button>
        </li>
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
        {categories.map((slug) => (
          <li key={slug} className="flex-shrink-0">
            <FilterChip active={filters.category === slug} onClick={() => toggleCategory(slug)}>
              {categoryLabel(slug)}
            </FilterChip>
          </li>
        ))}
      </ul>

      {shownSurprise && (
        <section aria-label="Surprise">
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-orange-700">Et si on cuisinait…</p>
          <ul className="space-y-1.5 rounded-xl ring-2 ring-orange-300">{renderItem(shownSurprise)}</ul>
        </section>
      )}

      {!hasResults && !shownSurprise && (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm text-gray-600">
          {searching
            ? <>Aucune recette ne correspond à &laquo;&nbsp;{query.trim()}&nbsp;&raquo;{filtersActive ? ' avec ces filtres' : ''}.</>
            : filtersActive
              ? 'Aucune recette ne correspond à ces filtres.'
              : 'Tapez pour chercher parmi toutes les recettes.'}
        </p>
      )}

      {sections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section key={section.key} aria-label={section.label}>
            <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">{section.label}</p>
            <ul className="space-y-1.5">{section.items.map(renderItem)}</ul>
          </section>
        ))}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={chain}
            onChange={(event) => onChainChange(event.target.checked)}
            className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          Enchaîner
        </label>
        <span className="flex items-center gap-1">
          {occupant && (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
            >
              Vider
            </button>
          )}
          {hasNextFree && (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
              Passer
            </button>
          )}
        </span>
      </div>
    </PlanSheet>
  );
}
