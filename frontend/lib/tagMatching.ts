export interface ExistingTag {
  id: number;
  nom: string;
  slug: string;
}

/** Normalise un nom de tag pour comparaison (casse, accents, espaces). */
export function normalizeTagKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Slug aligné sur la logique backend Strapi. */
export function generateTagSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractTagFields(item: Record<string, unknown>): ExistingTag | null {
  const id = typeof item.id === 'number' ? item.id : null;
  const attrs = (item.attributes ?? item) as Record<string, unknown>;
  const nom = typeof attrs.nom === 'string' ? attrs.nom.trim() : '';
  const slug = typeof attrs.slug === 'string' ? attrs.slug.trim() : '';
  if (!id || !nom) return null;
  return { id, nom, slug: slug || generateTagSlug(nom) };
}

/** Charge tous les tags publiés depuis Strapi (pagination). */
export async function fetchExistingTags(
  strapiUrl: string,
  apiToken: string | null
): Promise<ExistingTag[]> {
  if (!apiToken) return [];

  const tags: ExistingTag[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      'fields[0]': 'nom',
      'fields[1]': 'slug',
    });

    const response = await fetch(`${strapiUrl}/api/tags?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!response.ok) {
      console.warn(`[tagMatching] Impossible de charger les tags (page ${page}): ${response.status}`);
      break;
    }

    const data = await response.json();
    for (const item of data.data || []) {
      const tag = extractTagFields(item);
      if (tag) tags.push(tag);
    }

    const pageCount = data.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }

  return tags;
}

/** Trouve un tag existant par nom exact, nom normalisé ou slug. */
export function findMatchingTag(tagName: string, existingTags: ExistingTag[]): ExistingTag | null {
  const trimmed = tagName.trim();
  if (!trimmed) return null;

  const normalized = normalizeTagKey(trimmed);
  const slug = generateTagSlug(trimmed);

  for (const tag of existingTags) {
    if (tag.nom === trimmed) return tag;
    if (normalizeTagKey(tag.nom) === normalized) return tag;
    if (tag.slug === slug) return tag;
  }

  return null;
}

/**
 * Résout les tags proposés par l'IA vers les noms canoniques existants.
 * Les tags sans correspondance sont conservés pour création ultérieure.
 */
export function resolveTagNames(aiTags: string[], existingTags: ExistingTag[]): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const raw of aiTags) {
    if (typeof raw !== 'string' || !raw.trim()) continue;

    const match = findMatchingTag(raw, existingTags);
    const canonical = match ? match.nom : raw.trim();
    const key = normalizeTagKey(canonical);

    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(canonical);
  }

  return resolved;
}

/** Bloc de prompt pour guider Groq vers les tags existants. */
export function buildExistingTagsPromptSection(existingTags: ExistingTag[]): string {
  if (existingTags.length === 0) {
    return `TAGS EXISTANTS : aucun pour l'instant.
- Propose 2 à 5 tags courts et pertinents (ex: "rapide", "végétarien").`;
  }

  const names = existingTags.map((t) => t.nom).sort((a, b) => a.localeCompare(b, 'fr'));
  const list = names.map((n) => `"${n}"`).join(', ');

  return `TAGS EXISTANTS (réutiliser en PRIORITÉ — orthographe EXACTE de la liste) :
[${list}]

Règles tags :
- Choisis 2 à 5 tags pertinents
- Réutilise d'abord les tags existants ci-dessus si l'un d'eux convient (copie le nom exactement)
- Ne crée un nouveau tag que si aucun tag existant ne correspond vraiment
- Évite les doublons ou variantes (ex: ne pas créer "maghrebin" si "maghrébin" existe déjà)`;
}
