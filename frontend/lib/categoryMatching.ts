import { generateTagSlug, normalizeTagKey } from '@/lib/tagMatching';

export interface ExistingCategory {
  id: number;
  nom: string;
  slug: string;
}

function extractCategoryFields(item: Record<string, unknown>): ExistingCategory | null {
  const id = typeof item.id === 'number' ? item.id : null;
  const attrs = (item.attributes ?? item) as Record<string, unknown>;
  const nom = typeof attrs.nom === 'string' ? attrs.nom.trim() : '';
  const slug = typeof attrs.slug === 'string' ? attrs.slug.trim() : '';
  if (!id || !nom) return null;
  return { id, nom, slug: slug || generateTagSlug(nom) };
}

/** Charge toutes les catégories publiées depuis Strapi (pagination). */
export async function fetchExistingCategories(
  strapiUrl: string,
  apiToken: string | null
): Promise<ExistingCategory[]> {
  if (!apiToken) return [];

  const categories: ExistingCategory[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      'fields[0]': 'nom',
      'fields[1]': 'slug',
    });

    const response = await fetch(`${strapiUrl}/api/categories?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!response.ok) {
      console.warn(
        `[categoryMatching] Impossible de charger les catégories (page ${page}): ${response.status}`
      );
      break;
    }

    const data = await response.json();
    for (const item of data.data || []) {
      const category = extractCategoryFields(item);
      if (category) categories.push(category);
    }

    const pageCount = data.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }

  return categories;
}

/** Trouve une catégorie existante par nom exact, nom normalisé ou slug. */
export function findMatchingCategory(
  categoryName: string,
  existingCategories: ExistingCategory[]
): ExistingCategory | null {
  const trimmed = categoryName.trim();
  if (!trimmed) return null;

  const normalized = normalizeTagKey(trimmed);
  const slug = generateTagSlug(trimmed);

  for (const category of existingCategories) {
    if (category.nom === trimmed) return category;
    if (normalizeTagKey(category.nom) === normalized) return category;
    if (category.slug === slug) return category;
  }

  return null;
}

/**
 * Résout les catégories proposées par l'IA : uniquement les existantes sont conservées.
 * Les propositions sans correspondance sont ignorées.
 */
export function resolveCategoryNames(
  aiCategories: string[],
  existingCategories: ExistingCategory[]
): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const raw of aiCategories) {
    if (typeof raw !== 'string' || !raw.trim()) continue;

    const match = findMatchingCategory(raw, existingCategories);
    if (!match) continue;

    const key = normalizeTagKey(match.nom);
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(match.nom);
  }

  return resolved;
}

/** Bloc de prompt : catégories existantes uniquement, sinon array vide. */
export function buildExistingCategoriesPromptSection(
  existingCategories: ExistingCategory[]
): string {
  if (existingCategories.length === 0) {
    return `CATÉGORIES EXISTANTES : aucune.
- Le champ "categories" DOIT être un array VIDE : []`;
  }

  const names = existingCategories.map((c) => c.nom).sort((a, b) => a.localeCompare(b, 'fr'));
  const list = names.map((n) => `"${n}"`).join(', ');

  return `CATÉGORIES EXISTANTES (UNIQUEMENT celles-ci — orthographe EXACTE) :
[${list}]

Règles catégories :
- Choisis 0 à 2 catégories pertinentes UNIQUEMENT parmi la liste ci-dessus
- Copie le nom exactement s'il convient
- Si aucune catégorie existante ne convient vraiment, retourne un array vide : []
- N'invente JAMAIS de nouvelle catégorie`;
}
