/**
 * Classement des recettes pour le mélangeur d'ingrédients.
 *
 * Module pur, sans dépendance d'exécution : il ne charge pas lib/ingredients.ts (types seulement),
 * ce qui le rend testable seul.
 */

import type { MixerRecipe } from '@/lib/ingredients';
import type { CardRecipe } from '@/lib/recipeList';

/** Nombre maximum de recettes « presque » proposées */
export const MAX_PARTIAL = 12;

export interface PartialMatch {
  recipe: MixerRecipe;
  /** Nombre d'ingrédients choisis que la recette contient */
  matched: number;
  /** Ingrédients choisis (slugs) que la recette ne contient pas */
  missing: string[];
}

export interface MixResult {
  /** Les recettes qui contiennent tous les ingrédients choisis */
  all: MixerRecipe[];
  /** Les recettes qui en contiennent une partie, les plus complètes d'abord */
  partial: PartialMatch[];
}

/**
 * - `all` : tous les ingrédients choisis.
 * - `partial` : une partie seulement. Si rien ne les combine tous, dès 1 ingrédient ; sinon au moins la moitié
 *   (et 2 au minimum), pour ne pas noyer les vraies correspondances.
 */
export function rankRecipesByIngredientSlugs(recipes: MixerRecipe[], selectedSlugs: string[]): MixResult {
  const selected = [...new Set(selectedSlugs)];
  if (selected.length === 0) return { all: [], partial: [] };

  const scored = recipes.map((recipe) => {
    const missing = selected.filter((slug) => !recipe.ingredientSlugs.includes(slug));
    return { recipe, missing, matched: selected.length - missing.length };
  });

  const all = scored.filter((item) => item.missing.length === 0).map((item) => item.recipe);
  const minMatched = all.length === 0 ? 1 : Math.max(2, Math.ceil(selected.length / 2));

  const partial = scored
    .filter((item) => item.missing.length > 0 && item.matched >= minMatched)
    .sort((a, b) => b.matched - a.matched || a.recipe.titre.localeCompare(b.recipe.titre, 'fr'))
    .slice(0, MAX_PARTIAL)
    .map(({ recipe, matched, missing }) => ({ recipe, matched, missing }));

  return { all, partial };
}

/** La carte d'une recette du mélangeur, avec une remarque éventuelle. */
export function mixerToCardRecipe(recipe: MixerRecipe, note?: string): CardRecipe {
  return {
    id: recipe.id,
    slug: recipe.slug,
    titre: recipe.titre,
    imageUrl: recipe.imageUrl,
    imageAlt: recipe.imageAlt,
    totalMinutes: (recipe.tempsPreparation || 0) + (recipe.tempsCuisson || 0),
    difficulte: recipe.difficulte,
    note,
  };
}
