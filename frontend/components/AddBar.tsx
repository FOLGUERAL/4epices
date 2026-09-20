'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { toPickerRecipe, type PickerRecipe } from '@/components/RecipePickerSheet';
import { searchRecipes } from '@/lib/recipeSearch';
import type { SwipeRecipe } from '@/lib/swipeEngine';

interface AddBarProps {
  /** Favoris sans repas à venir, proposés en pastilles */
  pile: PickerRecipe[];
  recipes: SwipeRecipe[];
  /** Recette « armée » : le prochain créneau touché la reçoit */
  armed: PickerRecipe | null;
  onArm: (recipe: PickerRecipe) => void;
  onDisarm: () => void;
}

const MAX_SUGGESTIONS = 6;

/** Barre d'ajout : recherche dans tout le catalogue et pastilles des favoris à planifier. */
export default function AddBar({ pile, recipes, armed, onArm, onDisarm }: AddBarProps) {
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const suggestions = useMemo(
    () => (searching ? searchRecipes(recipes, query, MAX_SUGGESTIONS).map(toPickerRecipe) : []),
    [searching, recipes, query]
  );

  const arm = (recipe: PickerRecipe) => {
    setQuery('');
    onArm(recipe);
  };

  if (armed) {
    return (
      <div
        role="status"
        className="sticky top-16 z-30 flex items-center gap-2 rounded-2xl bg-orange-600 py-1.5 pl-4 pr-1.5 text-white shadow-lg"
      >
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-bold">Placer : </span>
          <span className="font-semibold">{armed.titre}</span>
          <span className="hidden text-orange-100 sm:inline"> · touchez un créneau</span>
        </p>
        <button
          type="button"
          onClick={onDisarm}
          aria-label="Annuler le placement"
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-orange-700"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (suggestions[0]) arm(suggestions[0]);
        }}
        className="relative"
      >
        <label htmlFor="planning-add-search" className="sr-only">
          Rechercher une recette à placer
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id="planning-add-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
          placeholder="Ajouter une recette…"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />

        {searching && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
            {suggestions.length === 0 ? (
              <p className="p-4 text-sm text-gray-600">Aucune recette ne correspond.</p>
            ) : (
              <ul>
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => arm(item)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm transition-colors hover:bg-orange-50"
                    >
                      <span className="line-clamp-1 font-semibold text-gray-900">{item.titre}</span>
                      {item.totalMinutes && (
                        <span className="flex-shrink-0 text-xs tabular-nums text-gray-500">{item.totalMinutes} min</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      {pile.length > 0 && (
        <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Favoris à planifier">
          {pile.map((item) => (
            <li key={item.id} className="flex-shrink-0">
              <button
                type="button"
                onClick={() => arm(item)}
                className="min-h-11 max-w-[14rem] truncate rounded-full border border-orange-200 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-orange-50 hover:text-orange-700"
              >
                {item.titre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
