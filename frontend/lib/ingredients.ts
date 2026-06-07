import { cache } from 'react';
import { generateTagSlug } from '@/lib/tagMatching';
import {
  getDictionaryEntryBySlug,
  matchDictionaryIngredients,
  resolveIngredientSlugAndNom,
} from '@/lib/ingredientDictionary';
import { getRecettes, Recette } from '@/lib/strapi';

export const MIN_RECIPES_FOR_INDEX = 3;

export interface IngredientHub {
  nom: string;
  slug: string;
  recetteCount: number;
}

export interface IngredientDetail extends IngredientHub {
  recettes: Recette[];
}

/** Recette allégée pour le mixeur d'ingrédients (client). */
export interface MixerRecipe {
  id: number;
  slug: string;
  titre: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string;
  tempsPreparation?: number;
  tempsCuisson?: number;
  nombrePersonnes?: number;
  difficulte?: string;
  ingredientSlugs: string[];
}

export interface IngredientMixerData {
  ingredients: IngredientHub[];
  recipes: MixerRecipe[];
}

function getIngredientPrincipal(recette: Recette): string | null {
  const raw = recette.attributes.seoEnrichi;
  if (!raw || typeof raw !== 'object') return null;
  const val = (raw as { ingredientPrincipal?: unknown }).ingredientPrincipal;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ingredientSlugFromName(name: string): string {
  return generateTagSlug(name);
}

type IndexEntry = {
  nameCounts: Map<string, number>;
  recettes: Recette[];
  recetteIds: Set<number>;
};

function pickCanonicalName(slug: string, nameCounts: Map<string, number>): string {
  const dictEntry = getDictionaryEntryBySlug(slug);
  if (dictEntry) return dictEntry.nom;

  let bestName = '';
  let bestCount = -1;

  for (const [name, count] of nameCounts) {
    if (
      count > bestCount ||
      (count === bestCount && name.localeCompare(bestName, 'fr') < 0)
    ) {
      bestCount = count;
      bestName = name;
    }
  }

  return bestName;
}

function addRecipeToHub(
  bySlug: Map<string, IndexEntry>,
  slug: string,
  displayName: string,
  recette: Recette
): void {
  if (!slug) return;

  let entry = bySlug.get(slug);
  if (!entry) {
    entry = { nameCounts: new Map(), recettes: [], recetteIds: new Set() };
    bySlug.set(slug, entry);
  }

  if (!entry.recetteIds.has(recette.id)) {
    entry.recetteIds.add(recette.id);
    entry.recettes.push(recette);
  }

  entry.nameCounts.set(displayName, (entry.nameCounts.get(displayName) || 0) + 1);
}

/** Sources hub pour une recette : dictionnaire (titre + ingrédients) + ingredientPrincipal Groq. */
function getRecipeHubSources(recette: Recette): Array<{ slug: string; nom: string }> {
  const sources = new Map<string, string>();

  for (const entry of matchDictionaryIngredients(recette)) {
    sources.set(entry.slug, entry.nom);
  }

  const principal = getIngredientPrincipal(recette);
  if (principal) {
    const resolved = resolveIngredientSlugAndNom(principal);
    if (!sources.has(resolved.slug)) {
      sources.set(resolved.slug, resolved.nom);
    }
  }

  return Array.from(sources.entries()).map(([slug, nom]) => ({ slug, nom }));
}

async function fetchAllPublishedRecettes(): Promise<Recette[]> {
  const all: Recette[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const response = await getRecettes({
      page,
      pageSize,
      populate: 'imagePrincipale,categories,tags',
      sort: 'publishedAt:desc',
    });

    all.push(...(response.data || []));

    const pageCount = response.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }

  return all;
}

function buildIngredientsIndex(
  recettes: Recette[]
): Map<string, { nom: string; recettes: Recette[] }> {
  const bySlug = new Map<string, IndexEntry>();

  for (const recette of recettes) {
    const sources = getRecipeHubSources(recette);
    for (const { slug, nom } of sources) {
      addRecipeToHub(bySlug, slug, nom, recette);
    }
  }

  const result = new Map<string, { nom: string; recettes: Recette[] }>();

  for (const [slug, entry] of bySlug) {
    result.set(slug, {
      nom: pickCanonicalName(slug, entry.nameCounts),
      recettes: entry.recettes,
    });
  }

  return result;
}

/** Index ingrédients (slug → détail), mis en cache par requête Next.js. */
export const getIngredientsIndex = cache(async () => {
  const recettes = await fetchAllPublishedRecettes();
  return buildIngredientsIndex(recettes);
});

export async function getAllIngredients(): Promise<IngredientHub[]> {
  const index = await getIngredientsIndex();

  return Array.from(index.entries())
    .map(([slug, { nom, recettes }]) => ({
      nom,
      slug,
      recetteCount: recettes.length,
    }))
    .sort((a, b) => b.recetteCount - a.recetteCount || a.nom.localeCompare(b.nom, 'fr'));
}

export async function getIngredientBySlug(slug: string): Promise<IngredientDetail | null> {
  const index = await getIngredientsIndex();
  const entry = index.get(slug);
  if (!entry) return null;

  return {
    nom: entry.nom,
    slug,
    recetteCount: entry.recettes.length,
    recettes: entry.recettes,
  };
}

export async function getRecetteCountByIngredient(slug: string): Promise<number> {
  const ingredient = await getIngredientBySlug(slug);
  return ingredient?.recetteCount ?? 0;
}

function recetteToMixerRecipe(recette: Recette): MixerRecipe {
  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url ?? null;
  return {
    id: recette.id,
    slug: recette.attributes.slug,
    titre: recette.attributes.titre,
    description: recette.attributes.description,
    imageUrl,
    imageAlt:
      recette.attributes.imagePrincipale?.data?.attributes?.alternativeText ||
      recette.attributes.titre,
    tempsPreparation: recette.attributes.tempsPreparation,
    tempsCuisson: recette.attributes.tempsCuisson,
    nombrePersonnes: recette.attributes.nombrePersonnes,
    difficulte: recette.attributes.difficulte,
    ingredientSlugs: getRecipeHubSources(recette).map((s) => s.slug),
  };
}

/** Données sérialisées pour le mixeur multi-ingrédients (hub /ingredients). */
export async function getIngredientMixerData(): Promise<IngredientMixerData> {
  const recettes = await fetchAllPublishedRecettes();
  const ingredients = await getAllIngredients();

  return {
    ingredients,
    recipes: recettes
      .map(recetteToMixerRecipe)
      .filter((r) => r.ingredientSlugs.length > 0),
  };
}

/** Filtre AND : la recette doit contenir tous les slugs sélectionnés. */
export function filterRecipesByIngredientSlugs(
  recipes: MixerRecipe[],
  selectedSlugs: string[]
): MixerRecipe[] {
  if (selectedSlugs.length === 0) return [];

  return recipes.filter((recipe) =>
    selectedSlugs.every((slug) => recipe.ingredientSlugs.includes(slug))
  );
}

export function buildIngredientMetaTitle(nom: string): string {
  const title = `Recettes à base de ${nom}`;
  return title.length <= 60 ? title : title.substring(0, 57) + '...';
}

export function buildIngredientMetaDescription(nom: string, count: number): string {
  const base = `Découvrez nos recettes à base de ${nom}`;
  const suffix =
    count > 0
      ? ` : ${count} ${count === 1 ? 'idée' : 'idées'} faciles et gourmandes sur 4épices.`
      : ' : idées faciles et gourmandes sur 4épices.';
  const desc = base + suffix;
  return desc.length <= 160 ? desc : desc.substring(0, 157) + '...';
}

export function buildIngredientDescription(nom: string, count: number): string {
  if (count === 0) {
    return `Recettes à base de ${nom} sur 4épices.`;
  }
  return `${count} ${count === 1 ? 'recette' : 'recettes'} à base de ${nom} : des idées simples et savoureuses pour cuisiner ce produit au quotidien.`;
}
