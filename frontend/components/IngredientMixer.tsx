'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  filterRecipesByIngredientSlugs,
  IngredientHub,
  MixerRecipe,
} from '@/lib/ingredients';
import OptimizedImage from '@/components/OptimizedImage';

const MAX_SELECTION = 6;
const MIX_DURATION_MS = 1400;

interface IngredientMixerProps {
  ingredients: IngredientHub[];
  recipes: MixerRecipe[];
}

function WhiskSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8 56c0-8 6-14 14-14h4c2 0 4-1 5-3l14-22a4 4 0 00-6-5L25 34h-3C12 34 4 42 4 52"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 8c0 4-2 7-5 9M38 6c2 3 2 7 0 10M46 8c-1 4-4 7-8 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function parseSlugsFromSearchParams(searchParams: URLSearchParams): string[] {
  const raw = searchParams.get('mix');
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function IngredientMixer({ ingredients, recipes }: IngredientMixerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlugs = useMemo(
    () => parseSlugsFromSearchParams(searchParams),
    [searchParams]
  );

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    initialSlugs.filter((slug) => ingredients.some((i) => i.slug === slug))
  );
  const [phase, setPhase] = useState<'idle' | 'mixing' | 'results'>(
    initialSlugs.length > 0 ? 'results' : 'idle'
  );
  const [displayedResults, setDisplayedResults] = useState<MixerRecipe[]>(() =>
    initialSlugs.length > 0
      ? filterRecipesByIngredientSlugs(recipes, initialSlugs)
      : []
  );

  const selectedIngredients = useMemo(
    () => ingredients.filter((i) => selectedSlugs.includes(i.slug)),
    [ingredients, selectedSlugs]
  );

  const previewCount = useMemo(
    () => filterRecipesByIngredientSlugs(recipes, selectedSlugs).length,
    [recipes, selectedSlugs]
  );

  const updateUrl = useCallback(
    (slugs: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slugs.length > 0) {
        params.set('mix', slugs.join(','));
      } else {
        params.delete('mix');
      }
      const query = params.toString();
      router.replace(query ? `/ingredients?${query}` : '/ingredients', { scroll: false });
    },
    [router, searchParams]
  );

  const toggleIngredient = (slug: string) => {
    setSelectedSlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((s) => s !== slug);
      }
      if (current.length >= MAX_SELECTION) return current;
      return [...current, slug];
    });
    setPhase('idle');
    setDisplayedResults([]);
  };

  const clearSelection = () => {
    setSelectedSlugs([]);
    setPhase('idle');
    setDisplayedResults([]);
    updateUrl([]);
  };

  const handleMix = () => {
    if (selectedSlugs.length === 0) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setPhase('mixing');

    const showResults = () => {
      const results = filterRecipesByIngredientSlugs(recipes, selectedSlugs);
      setDisplayedResults(results);
      setPhase('results');
      updateUrl(selectedSlugs);
    };

    if (reducedMotion) {
      showResults();
      return;
    }

    window.setTimeout(showResults, MIX_DURATION_MS);
  };

  const canMix = selectedSlugs.length > 0 && phase !== 'mixing';

  return (
    <section
      className="mb-12 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-md overflow-hidden"
      aria-labelledby="mixer-heading"
    >
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h2 id="mixer-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Le fouet magique
            </h2>
            <p className="text-gray-600 max-w-xl">
              Sélectionnez plusieurs ingrédients : plus vous en ajoutez, plus le mélange est
              sélectif. Le fouet vous sort les recettes qui contiennent{' '}
              <strong>tous</strong> vos choix.
            </p>
          </div>

          {selectedSlugs.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-sm text-gray-500 hover:text-orange-600 transition-colors shrink-0"
            >
              Tout effacer
            </button>
          )}
        </div>

        {selectedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {selectedIngredients.map((ing) => (
              <button
                key={ing.slug}
                type="button"
                onClick={() => toggleIngredient(ing.slug)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors capitalize"
              >
                {ing.nom}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6 max-h-48 overflow-y-auto pr-1">
          {ingredients.map((ing) => {
            const isSelected = selectedSlugs.includes(ing.slug);
            const disabled = !isSelected && selectedSlugs.length >= MAX_SELECTION;

            return (
              <button
                key={ing.slug}
                type="button"
                onClick={() => toggleIngredient(ing.slug)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all capitalize ${
                  isSelected
                    ? 'border-orange-500 bg-orange-100 text-orange-800'
                    : disabled
                      ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                }`}
              >
                {ing.nom}
                <span className="text-gray-400 ml-1 text-xs">({ing.recetteCount})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-2">
          <div
            className={`relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white border-2 border-orange-200 shadow-inner ${
              phase === 'mixing' ? 'ingredient-mixer-bowl' : ''
            }`}
            aria-hidden="true"
          >
            {selectedIngredients.slice(0, 4).map((ing, index) => (
              <span
                key={ing.slug}
                className={`absolute text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 capitalize ingredient-mixer-chip ingredient-mixer-chip-${index} ${
                  phase === 'mixing' ? 'ingredient-mixer-chip-active' : ''
                }`}
              >
                {ing.nom}
              </span>
            ))}
            <WhiskSvg
              className={`w-12 h-12 sm:w-14 sm:h-14 text-orange-600 ${
                phase === 'mixing' ? 'ingredient-mixer-whisk' : ''
              }`}
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            {selectedSlugs.length === 0 ? (
              <p className="text-gray-500">Choisissez au moins un ingrédient pour commencer.</p>
            ) : (
              <p className="text-gray-700 mb-3">
                {previewCount === 0 ? (
                  <span className="text-amber-700 font-medium">
                    Aucune recette ne combine ces {selectedSlugs.length} ingrédients — essayez
                    d&apos;en retirer un.
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-gray-900">{previewCount}</span>{' '}
                    {previewCount === 1 ? 'recette correspond' : 'recettes correspondent'} à votre
                    sélection.
                  </>
                )}
              </p>
            )}

            <button
              type="button"
              onClick={handleMix}
              disabled={!canMix}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <WhiskSvg className="w-5 h-5" />
              {phase === 'mixing' ? 'Mélange en cours…' : 'Mélanger !'}
            </button>

            {selectedSlugs.length >= MAX_SELECTION && (
              <p className="text-xs text-gray-400 mt-2">Maximum {MAX_SELECTION} ingrédients.</p>
            )}
          </div>
        </div>
      </div>

      {phase === 'results' && (
        <div className="border-t border-orange-100 bg-white/80 px-6 sm:px-8 py-8 ingredient-mixer-results">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            {displayedResults.length > 0 ? (
              <>
                {displayedResults.length}{' '}
                {displayedResults.length === 1 ? 'recette trouvée' : 'recettes trouvées'}
              </>
            ) : (
              'Aucun mélange possible'
            )}
          </h3>

          {displayedResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedResults.map((recette) => (
                <Link
                  key={recette.id}
                  href={`/recettes/${recette.slug}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <OptimizedImage
                    src={recette.imageUrl}
                    alt={recette.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="p-6">
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{recette.titre}</h4>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">{recette.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      {recette.tempsPreparation ? (
                        <span className="font-medium">⏱️ {recette.tempsPreparation} min</span>
                      ) : null}
                      {recette.nombrePersonnes ? (
                        <span className="font-medium">👥 {recette.nombrePersonnes} pers.</span>
                      ) : null}
                      {recette.difficulte ? (
                        <span className="capitalize px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          {recette.difficulte}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">
              Retirez un ingrédient ou changez votre combinaison, puis relancez le fouet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
