/**
 * Recherche et filtres de la page « Toutes les recettes ».
 *
 * Module pur, comme lib/recipeSearch.ts (dont il réutilise le moteur : accents, casse, pluriels).
 * La recherche porte sur le titre, puis sur les catégories, les tags et les ingrédients.
 */

import { searchRecipes } from '@/lib/recipeSearch';
import type { Recette } from '@/lib/strapi';
import { QUICK_MINUTES } from '@/lib/swipeEngine';

export interface ListFilters {
  query: string;
  /** 30 minutes ou moins (préparation + cuisson) */
  quick: boolean;
  /** Difficulté « facile » seulement */
  easy: boolean;
  /** Slug d'une catégorie, ou null */
  category: string | null;
}

export const NO_LIST_FILTERS: ListFilters = { query: '', quick: false, easy: false, category: null };

/** « Bases de cuisine » (sauces, fonds…) n'est pas une idée de repas : elle passe toujours en dernier. */
export const BASES_CATEGORY_SLUG = 'bases-de-cuisine';

export interface CategoryOption {
  slug: string;
  nom: string;
  count: number;
  /** Image de la première recette illustrée de la catégorie (la plus récente si les recettes sont triées ainsi) */
  imageUrl: string | null;
}

export function hasActiveListFilters(filters: ListFilters): boolean {
  return filters.query.trim() !== '' || filters.quick || filters.easy || filters.category !== null;
}

/** « 35 min », « 2h », « 1h 30min » ; texte vide pour une durée nulle. */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

export function getTotalMinutes(recette: Recette): number {
  return (recette.attributes.tempsPreparation || 0) + (recette.attributes.tempsCuisson || 0);
}

/** Ce qu'une carte de recette affiche : assez léger pour venir d'une recette complète comme d'un mélangeur. */
export interface CardRecipe {
  id: number;
  slug: string;
  titre: string;
  /** Adresse brute de l'image (Strapi), résolue à l'affichage */
  imageUrl: string | null;
  imageAlt: string;
  totalMinutes: number;
  difficulte?: string;
  /** Petite remarque sous la carte (« Il manque : tomates ») */
  note?: string;
}

export function toCardRecipe(recette: Recette): CardRecipe {
  const image = recette.attributes.imagePrincipale?.data?.attributes;
  return {
    id: recette.id,
    slug: recette.attributes.slug,
    titre: recette.attributes.titre,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alternativeText || recette.attributes.titre,
    totalMinutes: getTotalMinutes(recette),
    difficulte: recette.attributes.difficulte,
  };
}

function getCategorySlugs(recette: Recette): string[] {
  return (recette.attributes.categories?.data || []).map((category) => category.attributes.slug);
}

/** Les ingrédients, qu'ils soient des textes ou des objets { quantite, ingredient }. */
function getIngredientTexts(recette: Recette): string[] {
  const ingredients: unknown = recette.attributes.ingredients;
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return String((item as { ingredient?: unknown }).ingredient ?? '');
      return '';
    })
    .filter(Boolean);
}

/** Les catégories présentes dans les recettes, les plus fournies d'abord, « Bases de cuisine » en dernier. */
export function getCategoryOptions(recettes: Recette[]): CategoryOption[] {
  const options = new Map<string, CategoryOption>();
  for (const recette of recettes) {
    const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url ?? null;
    for (const category of recette.attributes.categories?.data || []) {
      const { slug, nom } = category.attributes;
      const current = options.get(slug);
      if (current) {
        current.count += 1;
        if (!current.imageUrl) current.imageUrl = imageUrl;
      } else {
        options.set(slug, { slug, nom, count: 1, imageUrl });
      }
    }
  }

  const isBases = (option: CategoryOption) => (option.slug === BASES_CATEGORY_SLUG ? 1 : 0);
  return [...options.values()].sort(
    (a, b) => isBases(a) - isBases(b) || b.count - a.count || a.nom.localeCompare(b.nom, 'fr')
  );
}

/** Applique les puces, puis la recherche (les résultats sont alors classés par pertinence). */
export function filterRecettes(recettes: Recette[], filters: ListFilters): Recette[] {
  const filtered = recettes.filter((recette) => {
    if (filters.quick) {
      const total = getTotalMinutes(recette);
      if (!(total > 0 && total <= QUICK_MINUTES)) return false;
    }
    if (filters.easy && recette.attributes.difficulte !== 'facile') return false;
    if (filters.category && !getCategorySlugs(recette).includes(filters.category)) return false;
    return true;
  });

  if (filters.query.trim() === '') return filtered;

  const searchable = filtered.map((recette) => ({
    recette,
    titre: recette.attributes.titre,
    categorySlugs: getCategorySlugs(recette),
    ingredientSlugs: [
      ...(recette.attributes.tags?.data || []).map((tag) => tag.attributes.nom),
      ...getIngredientTexts(recette),
    ],
  }));
  return searchRecipes(searchable, filters.query, Number.POSITIVE_INFINITY).map((item) => item.recette);
}
