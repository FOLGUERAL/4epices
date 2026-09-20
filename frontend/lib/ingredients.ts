import { cache } from 'react';
import { generateTagSlug } from '@/lib/tagMatching';
import {
  getDictionaryEntryBySlug,
  matchDictionaryIngredients,
  resolveIngredientSlugAndNom,
} from '@/lib/ingredientDictionary';
import { getRecettes, Recette } from '@/lib/strapi';
import { SITE_NAME } from '@/lib/seo';

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
export function getRecipeHubSources(recette: Recette): Array<{ slug: string; nom: string }> {
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

export async function fetchAllPublishedRecettes(): Promise<Recette[]> {
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

// Mots en « h » aspiré : pas d'élision (« de haricots », mais « d'huile »)
const ASPIRATED_H = ['haricot', 'homard', 'hareng', 'hachis', 'harissa', 'houmous'];

/** « de courgette », « d'ail », « d'œufs », « de haricots » : article partitif avec élision. */
export function deIngredient(nom: string): string {
  const lower = nom.trim().toLowerCase();
  const startsWithVowel = /^[aeiouyàâäéèêëîïôöùûüœ]/.test(lower);
  const startsWithMuteH = lower.startsWith('h') && !ASPIRATED_H.some((w) => lower.startsWith(w));
  return startsWithVowel || startsWithMuteH ? `d'${nom}` : `de ${nom}`;
}

export function buildIngredientHeading(nom: string): string {
  return `Recettes à base ${deIngredient(nom)}`;
}

export function buildIngredientMetaTitle(nom: string, count = 0): string {
  const short = buildIngredientHeading(nom);
  const withCount = count >= 2 ? `${short} : ${count} idées faciles` : short;
  const title = withCount.length <= 60 ? withCount : short;
  return title.length <= 60 ? title : title.substring(0, 57) + '...';
}

export function buildIngredientMetaDescription(
  nom: string,
  count: number,
  quickCount = 0
): string {
  const base = `Découvrez nos recettes à base ${deIngredient(nom)}`;
  let suffix: string;
  if (count > 0) {
    const quick =
      quickCount > 0
        ? `, dont ${quickCount} en moins de 30 minutes`
        : '';
    suffix = ` : ${count} ${count === 1 ? 'idée' : 'idées'} faciles et gourmandes${quick} sur ${SITE_NAME}.`;
  } else {
    suffix = ` : idées faciles et gourmandes sur ${SITE_NAME}.`;
  }
  const desc = base + suffix;
  return desc.length <= 160 ? desc : desc.substring(0, 157) + '...';
}

export function buildIngredientDescription(nom: string, count: number): string {
  if (count === 0) {
    return `Recettes à base ${deIngredient(nom)} sur ${SITE_NAME}.`;
  }
  return `${count} ${count === 1 ? 'recette' : 'recettes'} à base ${deIngredient(nom)} : des idées simples et savoureuses pour cuisiner ce produit au quotidien.`;
}

export const QUICK_RECIPE_MINUTES = 30;

export interface IngredientCategory {
  nom: string;
  slug: string;
  count: number;
}

export interface IngredientStats {
  total: number;
  quickCount: number;
  easyCount: number;
  categories: IngredientCategory[];
}

/** Chiffres du hub, calculés à partir des recettes réelles (rien de générique). */
export function buildIngredientStats(recettes: Recette[]): IngredientStats {
  let quickCount = 0;
  let easyCount = 0;
  const categories = new Map<string, IngredientCategory>();

  for (const recette of recettes) {
    const { tempsPreparation = 0, tempsCuisson = 0, difficulte } = recette.attributes;
    const total = (tempsPreparation || 0) + (tempsCuisson || 0);
    if (total > 0 && total <= QUICK_RECIPE_MINUTES) quickCount++;
    if (difficulte === 'facile') easyCount++;

    for (const cat of recette.attributes.categories?.data || []) {
      const existing = categories.get(cat.attributes.slug);
      if (existing) existing.count++;
      else categories.set(cat.attributes.slug, { nom: cat.attributes.nom, slug: cat.attributes.slug, count: 1 });
    }
  }

  return {
    total: recettes.length,
    quickCount,
    easyCount,
    categories: Array.from(categories.values()).sort(
      (a, b) => b.count - a.count || a.nom.localeCompare(b.nom, 'fr')
    ),
  };
}

/** Paragraphe d'introduction unique par hub, fondé sur les chiffres réels. */
export function buildIngredientSummary(nom: string, stats: IngredientStats): string {
  const { total, quickCount, easyCount } = stats;
  if (total === 0) return buildIngredientDescription(nom, 0);

  const parts: string[] = [
    `${total} ${total === 1 ? 'recette' : 'recettes'} à base ${deIngredient(nom)}`,
  ];
  const details: string[] = [];
  if (quickCount > 0) {
    details.push(`${quickCount} ${quickCount === 1 ? 'prête' : 'prêtes'} en ${QUICK_RECIPE_MINUTES} minutes ou moins`);
  }
  if (easyCount > 0) {
    details.push(`${easyCount} ${easyCount === 1 ? 'facile' : 'faciles'} à réaliser`);
  }
  if (details.length > 0) parts.push(`dont ${details.join(' et ')}`);

  return `${parts.join(', ')}.`;
}

/** Ingrédients qui reviennent dans les mêmes recettes, limités aux hubs assez fournis pour être indexés. */
export async function getRelatedIngredients(slug: string, limit = 6): Promise<IngredientHub[]> {
  const index = await getIngredientsIndex();
  const entry = index.get(slug);
  if (!entry) return [];

  const shared = new Map<string, number>();
  for (const recette of entry.recettes) {
    for (const source of getRecipeHubSources(recette)) {
      if (source.slug === slug) continue;
      shared.set(source.slug, (shared.get(source.slug) || 0) + 1);
    }
  }

  return Array.from(shared.entries())
    .flatMap(([otherSlug, sharedCount]) => {
      const other = index.get(otherSlug);
      if (!other || other.recettes.length < MIN_RECIPES_FOR_INDEX) return [];
      return [{ nom: other.nom, slug: otherSlug, recetteCount: other.recettes.length, sharedCount }];
    })
    .sort((a, b) => b.sharedCount - a.sharedCount || b.recetteCount - a.recetteCount)
    .slice(0, limit)
    .map(({ nom, slug: otherSlug, recetteCount }) => ({ nom, slug: otherSlug, recetteCount }));
}
