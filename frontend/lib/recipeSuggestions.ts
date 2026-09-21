/**
 * Filtres et suggestions de recettes pour un créneau du planning.
 *
 * Module pur, comme lib/recipeSearch.ts. Les suggestions se calculent sans que l'utilisateur ait à taper :
 * pas de dessert en plat du jour, pas la même cuisine ni le même ingrédient que la veille ou le lendemain,
 * pas de recette déjà prévue, refusée ou cuisinée récemment. La durée n'oriente jamais le classement :
 * c'est à l'utilisateur de la filtrer (« 30 min max »).
 */

import type { PlanSlot } from '@/lib/planning';
import { QUICK_MINUTES, getDayRange, type SwipeRecipe, type SwipeState } from '@/lib/swipeEngine';

export interface RecipeFilters {
  /** Recettes de 30 minutes ou moins */
  quick: boolean;
  /** Difficulté « facile » seulement */
  easy: boolean;
  /** Slug d'une catégorie, ou null */
  category: string | null;
}

export const NO_FILTERS: RecipeFilters = { quick: false, easy: false, category: null };

const SWEET_CATEGORIES = ['patisserie'];
// « categorie » est l'ancien slug de Snacking (valeur par défaut de Strapi) ; les deux sont reconnus le temps de la migration
const SNACK_CATEGORIES = ['snacking', 'categorie', 'brunch-and-apero'];

const CATEGORY_LABELS: Record<string, string> = {
  'brunch-and-apero': 'Brunch & apéro',
  italien: 'Italien',
  patisserie: 'Pâtisserie',
  snacking: 'Snacking',
  categorie: 'Snacking',
  healthy: 'Healthy',
  oriental: 'Oriental',
  'cuisine-du-monde': 'Cuisine du monde',
  asiatique: 'Asiatique',
  francais: 'Français',
};

export function categoryLabel(slug: string): string {
  if (CATEGORY_LABELS[slug]) return CATEGORY_LABELS[slug];
  const text = slug.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function hasActiveFilters(filters: RecipeFilters): boolean {
  return filters.quick || filters.easy || filters.category !== null;
}

export function applyFilters(recipes: SwipeRecipe[], filters: RecipeFilters): SwipeRecipe[] {
  if (!hasActiveFilters(filters)) return recipes;
  return recipes.filter((recipe) => {
    if (filters.quick && !(recipe.totalMinutes > 0 && recipe.totalMinutes <= QUICK_MINUTES)) return false;
    if (filters.easy && recipe.difficulte !== 'facile') return false;
    if (filters.category && !recipe.categorySlugs.includes(filters.category)) return false;
    return true;
  });
}

/** Les catégories présentes dans le catalogue, les plus fournies d'abord. */
export function getAvailableCategories(recipes: SwipeRecipe[]): string[] {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const slug of recipe.categorySlugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([slug]) => slug);
}

/** Nombre stable entre 0 et 1 pour un texte : varie d'un créneau à l'autre, jamais d'un affichage à l'autre. */
function jitter(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function cuisineSlugs(recipe: SwipeRecipe): string[] {
  return recipe.categorySlugs.filter((slug) => !SWEET_CATEGORIES.includes(slug) && !SNACK_CATEGORIES.includes(slug));
}

interface SuggestOptions {
  limit?: number;
  /** Recettes déjà affichées ailleurs (par exemple les favoris à planifier) */
  excludeIds?: Set<number>;
  /**
   * Garde les recettes déjà prévues ou refusées au swipe, en fin de liste au lieu de les écarter.
   * Pour un filtre choisi par l'utilisateur : il demande explicitement ces recettes.
   */
  keepExcluded?: boolean;
}

/** Pénalité qui place les recettes déjà prévues ou refusées après toutes les autres */
const EXCLUDED_PENALTY = 10;

/**
 * Les recettes les plus adaptées à un créneau, sans saisie. Écarte celles déjà prévues à venir ou refusées au swipe ;
 * classe les autres selon ce qui est prévu la veille, le jour même et le lendemain.
 */
export function suggestForSlot(
  recipes: SwipeRecipe[],
  slot: PlanSlot,
  state: SwipeState,
  options: SuggestOptions = {}
): SwipeRecipe[] {
  const { limit = 12, excludeIds, keepExcluded = false } = options;

  const plannedAhead = new Set(state.plan.filter((entry) => entry.date >= state.windowStart).map((entry) => entry.recipeId));
  const cookedRecently = new Set(state.plan.filter((entry) => entry.cooked).map((entry) => entry.recipeId));
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  // Ce qui est prévu autour du créneau : la veille, le jour même (l'autre repas) et le lendemain
  const nearbyDays = getDayRange(slot.date, -1, 3);
  const nearby = state.plan
    .filter((entry) => nearbyDays.includes(entry.date) && !(entry.date === slot.date && entry.meal === slot.meal))
    .map((entry) => byId.get(entry.recipeId))
    .filter((recipe): recipe is SwipeRecipe => recipe !== undefined);
  const nearbyCuisines = new Set(nearby.flatMap(cuisineSlugs));
  const nearbyIngredients = new Set(nearby.flatMap((recipe) => recipe.ingredientSlugs));

  return recipes
    .filter((recipe) => {
      if (excludeIds?.has(recipe.id)) return false;
      return keepExcluded || (!plannedAhead.has(recipe.id) && !(String(recipe.id) in state.refused));
    })
    .map((recipe) => {
      let score = jitter(`${slot.date}|${slot.meal}|${recipe.id}`) * 0.9;
      if (plannedAhead.has(recipe.id) || String(recipe.id) in state.refused) score -= EXCLUDED_PENALTY;

      if (recipe.categorySlugs.some((slug) => SWEET_CATEGORIES.includes(slug))) score -= 3;
      else if (recipe.categorySlugs.some((slug) => SNACK_CATEGORIES.includes(slug))) score -= 1;

      if (cookedRecently.has(recipe.id)) score -= 3;
      if (cuisineSlugs(recipe).some((slug) => nearbyCuisines.has(slug))) score -= 1.5;
      if (recipe.ingredientSlugs.some((slug) => nearbyIngredients.has(slug))) score -= 2;

      return { recipe, score };
    })
    .sort((a, b) => b.score - a.score || a.recipe.titre.localeCompare(b.recipe.titre, 'fr'))
    .slice(0, limit)
    .map((entry) => entry.recipe);
}
