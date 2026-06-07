import { cache } from 'react';
import { generateTagSlug } from '@/lib/tagMatching';
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
};

function pickCanonicalName(nameCounts: Map<string, number>): string {
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
    const principal = getIngredientPrincipal(recette);
    if (!principal) continue;

    const slug = ingredientSlugFromName(principal);
    if (!slug) continue;

    let entry = bySlug.get(slug);
    if (!entry) {
      entry = { nameCounts: new Map(), recettes: [] };
      bySlug.set(slug, entry);
    }

    entry.nameCounts.set(principal, (entry.nameCounts.get(principal) || 0) + 1);
    entry.recettes.push(recette);
  }

  const result = new Map<string, { nom: string; recettes: Recette[] }>();

  for (const [slug, entry] of bySlug) {
    result.set(slug, {
      nom: pickCanonicalName(entry.nameCounts),
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
