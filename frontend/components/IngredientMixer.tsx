'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RecipeCardGrid from '@/components/RecipeCardGrid';
import WhiskIcon from '@/components/WhiskIcon';
import { mixerToCardRecipe, rankRecipesByIngredientSlugs } from '@/lib/ingredientMix';
import type { IngredientHub, MixerRecipe } from '@/lib/ingredients';
import { normalizeSearchText } from '@/lib/recipeSearch';

const MAX_SELECTION = 6;
/** Nombre d'ingrédients affichés avant « Voir les autres » (les plus utilisés d'abord) */
const INITIAL_SHOWN = 18;
const MAX_SEARCH_RESULTS = 30;

interface IngredientMixerProps {
  ingredients: IngredientHub[];
  recipes: MixerRecipe[];
}

function parseSlugs(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map((slug) => slug.trim()).filter(Boolean);
}

/**
 * Le « fouet magique » : on choisit ses ingrédients, les recettes apparaissent aussitôt.
 * D'abord celles qui les contiennent tous, puis celles qui en contiennent une partie (avec ce qu'il manque).
 * La sélection est dans l'adresse (?mix=…) : elle se partage.
 */
export default function IngredientMixer({ ingredients, recipes }: IngredientMixerProps) {
  const searchParams = useSearchParams();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    parseSlugs(searchParams.get('mix'))
      .filter((slug) => ingredients.some((ingredient) => ingredient.slug === slug))
      .slice(0, MAX_SELECTION)
  );
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // L'adresse suit la sélection, sans recharger la page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedSlugs.length > 0) params.set('mix', selectedSlugs.join(','));
    else params.delete('mix');
    const search = params.toString();
    window.history.replaceState(null, '', search ? `${window.location.pathname}?${search}` : window.location.pathname);
  }, [selectedSlugs]);

  const nameBySlug = useMemo(() => new Map(ingredients.map((ingredient) => [ingredient.slug, ingredient.nom])), [ingredients]);
  const selectedIngredients = useMemo(
    () => selectedSlugs.map((slug) => ingredients.find((ingredient) => ingredient.slug === slug)).filter((item): item is IngredientHub => Boolean(item)),
    [ingredients, selectedSlugs]
  );

  const ranked = useMemo(() => rankRecipesByIngredientSlugs(recipes, selectedSlugs), [recipes, selectedSlugs]);
  const allCards = useMemo(() => ranked.all.map((recipe) => mixerToCardRecipe(recipe)), [ranked]);
  const partialCards = useMemo(
    () =>
      ranked.partial.map(({ recipe, missing }) =>
        mixerToCardRecipe(recipe, `Il manque : ${missing.map((slug) => nameBySlug.get(slug) ?? slug).join(', ')}`)
      ),
    [ranked, nameBySlug]
  );

  const searching = query.trim().length > 0;
  const visibleIngredients = useMemo(() => {
    if (searching) {
      const needle = normalizeSearchText(query);
      return ingredients.filter((ingredient) => normalizeSearchText(ingredient.nom).includes(needle)).slice(0, MAX_SEARCH_RESULTS);
    }
    return showAll ? ingredients : ingredients.slice(0, INITIAL_SHOWN);
  }, [ingredients, query, searching, showAll]);

  const toggleIngredient = (slug: string) =>
    setSelectedSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      return current.length >= MAX_SELECTION ? current : [...current, slug];
    });

  const full = selectedSlugs.length >= MAX_SELECTION;
  const many = selectedSlugs.length > 1;

  return (
    <section aria-labelledby="mixer-heading" className="mb-10">
      <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <WhiskIcon className="mt-1 h-7 w-7 flex-shrink-0 text-orange-600" strokeWidth={1.75} />
            <div>
              <h2 id="mixer-heading" className="text-2xl font-bold text-gray-900">
                Le fouet magique
              </h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600 sm:text-base">
                Choisissez ce que vous avez, jusqu&apos;à {MAX_SELECTION} ingrédients : les recettes apparaissent aussitôt.
              </p>
            </div>
          </div>
          {selectedSlugs.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSlugs([])}
              className="min-h-11 flex-shrink-0 rounded-xl px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-orange-100 hover:text-orange-700"
            >
              Tout effacer
            </button>
          )}
        </div>

        {selectedIngredients.length > 0 && (
          <ul aria-label="Ingrédients choisis" className="mb-4 flex flex-wrap gap-2">
            {selectedIngredients.map((ingredient) => (
              <li key={ingredient.slug}>
                <button
                  type="button"
                  onClick={() => toggleIngredient(ingredient.slug)}
                  aria-label={`Retirer ${ingredient.nom}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-orange-600 px-4 text-sm font-semibold capitalize text-white transition-colors hover:bg-orange-700"
                >
                  {ingredient.nom}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor="mixer-search" className="sr-only">
          Chercher un ingrédient
        </label>
        <input
          id="mixer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher un ingrédient…"
          autoComplete="off"
          className="mb-3 min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base !text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />

        {visibleIngredients.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">Aucun ingrédient ne correspond à cette recherche.</p>
        ) : (
          <ul aria-label="Ingrédients" className="flex flex-wrap gap-2">
            {visibleIngredients.map((ingredient) => {
              const isSelected = selectedSlugs.includes(ingredient.slug);
              const disabled = !isSelected && full;
              return (
                <li key={ingredient.slug}>
                  <button
                    type="button"
                    onClick={() => toggleIngredient(ingredient.slug)}
                    disabled={disabled}
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium capitalize transition-colors ${
                      isSelected
                        ? 'border-orange-500 bg-orange-100 text-orange-800'
                        : disabled
                          ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {ingredient.nom}
                    <span className="text-xs tabular-nums text-gray-400">{ingredient.recetteCount}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!searching && ingredients.length > INITIAL_SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="mt-3 min-h-11 rounded-xl px-3 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
          >
            {showAll ? 'Voir moins' : `Voir les ${ingredients.length - INITIAL_SHOWN} autres ingrédients`}
          </button>
        )}

        {full && <p className="mt-2 text-xs text-gray-500">Maximum {MAX_SELECTION} ingrédients : retirez-en un pour en ajouter.</p>}
      </div>

      <div className="mt-6" aria-live="polite">
        {selectedSlugs.length === 0 ? (
          <p className="text-gray-600">Choisissez au moins un ingrédient pour voir les recettes.</p>
        ) : (
          <>
            {allCards.length > 0 ? (
              <>
                <h3 className="mb-4 text-xl font-bold text-gray-900">
                  {allCards.length} {allCards.length === 1 ? 'recette contient' : 'recettes contiennent'}{' '}
                  {many ? 'tous vos ingrédients' : 'cet ingrédient'}
                </h3>
                <RecipeCardGrid recipes={allCards} />
              </>
            ) : (
              <p className="rounded-2xl bg-white p-5 text-gray-700 shadow-sm">
                {partialCards.length > 0
                  ? 'Aucune recette ne les combine tous. Voici celles qui s’en approchent :'
                  : 'Aucune recette ne correspond. Essayez de retirer un ingrédient.'}
              </p>
            )}

            {partialCards.length > 0 && (
              <div className={allCards.length > 0 ? 'mt-10' : 'mt-6'}>
                {allCards.length > 0 && (
                  <h3 className="mb-4 text-xl font-bold text-gray-900">Avec une partie de vos ingrédients</h3>
                )}
                <RecipeCardGrid recipes={partialCards} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
