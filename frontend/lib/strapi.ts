// Fonction pour obtenir l'URL Strapi selon le contexte
function getStrapiUrl(): string {
  // Côté serveur (SSR), utiliser l'URL locale du backend
  if (typeof window === 'undefined') {
    return process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://127.0.0.1:1337';
  }

  // Côté client, passer par un proxy Next.js pour éviter les problèmes de reachability
  // et les soucis de CORS/localhost entre conteneur et navigateur.
  if (process.env.NEXT_PUBLIC_STRAPI_URL) {
    return process.env.NEXT_PUBLIC_STRAPI_URL;
  }

  return '/api/strapi';
}

export interface StrapiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface Recette {
  id: number;
  attributes: {
    titre: string;
    slug: string;
    description: string;
    imagePrincipale: {
      data: {
        id: number;
        attributes: {
          url: string;
          alternativeText?: string;
          width: number;
          height: number;
        };
      };
    };
    tempsPreparation?: number;
    tempsCuisson?: number;
    nombrePersonnes?: number;
    difficulte?: 'facile' | 'moyen' | 'difficile';
    ingredients: any;
    etapes: string;
    categories?: {
      data: Array<{
        id: number;
        attributes: {
          nom: string;
          slug: string;
        };
      }>;
    };
    tags?: {
      data: Array<{
        id: number;
        attributes: {
          nom: string;
          slug: string;
        };
      }>;
    };
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
    metaTitle?: string;
    metaDescription?: string;
    seoEnrichi?: {
      faq?: Array<{ question: string; answer: string }>;
      conseils?: string;
      variantes?: string;
      conservation?: string;
      ingredientPrincipal?: string;
      typeCuisine?: string;
      niveau?: string;
      motsClesSeo?: string[];
    };
    pinterestPinId?: string;
    pinterestAutoPublish?: boolean;
    instagramPostId?: string;
    instagramPosts?: Record<string, any>;
    instagramAutoPublish?: boolean;
  };
}

export interface Categorie {
  id: number;
  attributes: {
    nom: string;
    slug: string;
    description?: string;
  };
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<StrapiResponse<T>> {
  const strapiUrl = getStrapiUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = strapiUrl.startsWith('http')
    ? `${strapiUrl}/api${normalizedEndpoint}`
    : `${strapiUrl}${normalizedEndpoint}`;
  const isServer = typeof window === 'undefined';
  const isMutation = Boolean(options.method && options.method !== 'GET');

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      // Serveur : revalidation ISR (compatible build statique Next.js)
      // Client : pas de cache pour données fraîches (avis, favoris…)
      ...(isMutation
        ? { cache: 'no-store' as const }
        : isServer
          ? { next: { revalidate: 300 } }
          : { cache: 'no-store' as const }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Erreur fetchAPI:', error);
    console.error('URL tentée:', url);
    throw error;
  }
}

export async function getRecettes(params?: {
  page?: number;
  pageSize?: number;
  populate?: string;
  sort?: string;
  excludeCategorySlug?: string;
}): Promise<StrapiResponse<Recette[]>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('pagination[page]', params.page.toString());
  if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
  if (params?.excludeCategorySlug) {
    queryParams.append('filters[categories][slug][$ne]', params.excludeCategorySlug);
  }
  
  const populate = params?.populate || 'imagePrincipale,categories,tags';
  queryParams.append('populate', populate);
  queryParams.append('sort', params?.sort || 'publishedAt:desc');

  return fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
}

export async function getRecetteBySlug(slug: string): Promise<StrapiResponse<Recette | null>> {
  const queryParams = new URLSearchParams();
  queryParams.append('filters[slug][$eq]', slug);
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  
  const response = await fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
  
  return {
    data: response.data?.[0] || null,
    meta: response.meta,
  };
}

export async function getCategories(): Promise<StrapiResponse<Categorie[]>> {
  return fetchAPI<Categorie[]>('/categories?populate=*');
}

export async function getCategorieBySlug(slug: string): Promise<StrapiResponse<Categorie | null>> {
  const queryParams = new URLSearchParams();
  queryParams.append('filters[slug][$eq]', slug);
  queryParams.append('populate', '*');
  
  const response = await fetchAPI<Categorie[]>(`/categories?${queryParams.toString()}`);
  
  return {
    data: response.data?.[0] || null,
    meta: response.meta,
  };
}

export async function getRecettesByCategory(
  categorySlug: string,
  params?: {
    page?: number;
    pageSize?: number;
  }
): Promise<StrapiResponse<Recette[]>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('pagination[page]', params.page.toString());
  if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
  
  queryParams.append('filters[categories][slug][$eq]', categorySlug);
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  queryParams.append('sort', 'publishedAt:desc');

  return fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
}

export interface Tag {
  id: number;
  attributes: {
    nom: string;
    slug: string;
    description?: string;
    metaTitle?: string;
    metaDescription?: string;
  };
}

export async function getTags(): Promise<StrapiResponse<Tag[]>> {
  return fetchAPI<Tag[]>('/tags?populate=*');
}

export async function getTagBySlug(slug: string): Promise<StrapiResponse<Tag | null>> {
  const queryParams = new URLSearchParams();
  queryParams.append('filters[slug][$eq]', slug);
  queryParams.append('populate', '*');
  
  const response = await fetchAPI<Tag[]>(`/tags?${queryParams.toString()}`);
  
  return {
    data: response.data?.[0] || null,
    meta: response.meta,
  };
}

export async function getRecettesByTag(
  tagSlug: string,
  params?: {
    page?: number;
    pageSize?: number;
  }
): Promise<StrapiResponse<Recette[]>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('pagination[page]', params.page.toString());
  if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
  
  queryParams.append('filters[tags][slug][$eq]', tagSlug);
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  queryParams.append('sort', 'publishedAt:desc');

  return fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
}

/** Nombre de recettes publiées pour un tag (pagination Strapi). */
export async function getRecetteCountByTag(tagSlug: string): Promise<number> {
  const response = await getRecettesByTag(tagSlug, { pageSize: 1 });
  return response.meta?.pagination?.total ?? 0;
}

/** Extrait les IDs d'une relation Strapi (format { data: [...] } ou tableau direct). */
export function extractRelationIds(
  relation?: { data?: Array<{ id: number }> } | Array<{ id: number }> | null
): number[] {
  if (!relation) return [];
  const list = Array.isArray(relation) ? relation : relation.data;
  if (!Array.isArray(list)) return [];
  return list.map((item) => item.id).filter((id) => typeof id === 'number');
}

async function getRecettesSimilairesByCategory(
  recetteId: number,
  categoryId: number,
  limit: number
): Promise<Recette[]> {
  const queryParams = new URLSearchParams();
  queryParams.append('filters[id][$ne]', recetteId.toString());
  queryParams.append('filters[categories][id][$eq]', categoryId.toString());
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  queryParams.append('pagination[pageSize]', limit.toString());
  queryParams.append('sort', 'publishedAt:desc');

  const response = await fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
  return response.data ?? [];
}

async function getRecettesSimilairesByTag(
  recetteId: number,
  tagId: number,
  limit: number
): Promise<Recette[]> {
  const queryParams = new URLSearchParams();
  queryParams.append('filters[id][$ne]', recetteId.toString());
  queryParams.append('filters[tags][id][$eq]', tagId.toString());
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  queryParams.append('pagination[pageSize]', limit.toString());
  queryParams.append('sort', 'publishedAt:desc');

  const response = await fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
  return response.data ?? [];
}

async function getRecettesRecentesExcluding(recetteId: number, limit: number): Promise<Recette[]> {
  const queryParams = new URLSearchParams();
  queryParams.append('filters[id][$ne]', recetteId.toString());
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  queryParams.append('pagination[pageSize]', limit.toString());
  queryParams.append('sort', 'publishedAt:desc');

  const response = await fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
  return response.data ?? [];
}

/**
 * Recettes similaires avec fallbacks :
 * 1. même catégorie (toutes les catégories de la recette)
 * 2. mêmes tags
 * 3. dernières recettes publiées
 */
export async function getRecettesSimilairesWithFallback(
  recetteId: number,
  options: { categoryIds?: number[]; tagIds?: number[] },
  limit: number = 4
): Promise<Recette[]> {
  const categoryIds = options.categoryIds ?? [];
  const tagIds = options.tagIds ?? [];
  const seen = new Set<number>([recetteId]);
  const results: Recette[] = [];

  const appendUnique = (candidates: Recette[]) => {
    for (const r of candidates) {
      if (results.length >= limit) break;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      results.push(r);
    }
  };

  for (const categoryId of categoryIds) {
    if (results.length >= limit) break;
    const batch = await getRecettesSimilairesByCategory(
      recetteId,
      categoryId,
      limit - results.length
    );
    appendUnique(batch);
  }

  for (const tagId of tagIds) {
    if (results.length >= limit) break;
    const batch = await getRecettesSimilairesByTag(recetteId, tagId, limit - results.length);
    appendUnique(batch);
  }

  if (results.length < limit) {
    const batch = await getRecettesRecentesExcluding(recetteId, limit - results.length);
    appendUnique(batch);
  }

  return results;
}

/** @deprecated Préférer getRecettesSimilairesWithFallback */
export async function getRecettesSimilaires(
  recetteId: number,
  categoryIds: number[],
  limit: number = 4
): Promise<StrapiResponse<Recette[]>> {
  const data = await getRecettesSimilairesWithFallback(
    recetteId,
    { categoryIds },
    limit
  );
  return { data };
}

export async function searchRecettes(
  query: string,
  params?: {
    page?: number;
    pageSize?: number;
  }
): Promise<StrapiResponse<Recette[]>> {
  if (!query || query.trim().length === 0) {
    return { data: [] };
  }

  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) {
    return { data: [] };
  }

  // Le filtrage Strapi ($containsi) est trop strict (pluriels, accents, fautes de frappe,
  // ingrédients non couverts) : on récupère les recettes publiées et on filtre côté serveur.
  const all: Recette[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 20; page++) {
    const queryParams = new URLSearchParams();
    queryParams.append('pagination[page]', page.toString());
    queryParams.append('pagination[pageSize]', pageSize.toString());
    queryParams.append('populate', 'imagePrincipale,categories,tags');
    queryParams.append('sort', 'publishedAt:desc');

    const response = await fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
    all.push(...(response.data || []));
    const pageCount = response.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
  }

  const scored = all
    .map((recette) => ({ recette, score: scoreRecetteForSearch(recette, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const total = scored.length;
  const pageSizeOut = params?.pageSize || total || 1;
  const pageOut = params?.page || 1;
  const start = (pageOut - 1) * pageSizeOut;

  return {
    data: scored.slice(start, start + pageSizeOut).map((entry) => entry.recette),
    meta: {
      pagination: {
        page: pageOut,
        pageSize: pageSizeOut,
        pageCount: Math.max(1, Math.ceil(total / pageSizeOut)),
        total,
      },
    },
  };
}

// Minuscules, sans accents, sans ponctuation, doubles lettres réduites (courgete = courgette)
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])\1+/g, '$1')
    .trim();
}

function tokenizeSearch(query: string): string[] {
  return normalizeForSearch(query)
    .split(' ')
    .filter(Boolean)
    // Singulier approximatif : « courgettes » → « courgette », « choux » → « chou »
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, '') : word));
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

// Tous les mots doivent être trouvés ; le titre pèse plus que les tags/ingrédients, puis la description.
function scoreRecetteForSearch(recette: Recette, tokens: string[]): number {
  const { titre, description, ingredients, categories, tags } = recette.attributes;
  const fields: Array<{ text: string; weight: number }> = [
    { text: normalizeForSearch(titre || ''), weight: 10 },
    {
      text: normalizeForSearch(
        [...(tags?.data || []), ...(categories?.data || [])].map((x) => x.attributes.nom).join(' ')
      ),
      weight: 5,
    },
    { text: normalizeForSearch(collectStrings(ingredients).join(' ')), weight: 4 },
    { text: normalizeForSearch(description || ''), weight: 2 },
  ];

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      if (field.text.includes(token)) best = Math.max(best, field.weight);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function getStrapiMediaUrl(url: string): string {
  if (url.startsWith('http')) {
    return url;
  }

  const publicUrl = process.env.NEXT_PUBLIC_STRAPI_URL || '/api/strapi';
  return `${publicUrl}${url}`;
}

export interface Avis {
  id: number;
  attributes: {
    rating: number;
    comment?: string;
    author?: string;
    approuve: boolean;
    recette?: {
      data: {
        id: number;
        attributes: {
          titre: string;
          slug: string;
        };
      };
    };
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
  };
}

export interface CreateAvisData {
  recette: number;
  rating: number;
  comment?: string;
  author?: string;
  approuve?: boolean;
}

export async function createAvis(data: CreateAvisData): Promise<StrapiResponse<Avis>> {
  return fetchAPI<Avis>('/avis-recettes', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        recette: data.recette,
        rating: data.rating,
        comment: data.comment || undefined,
        author: data.author || undefined,
        approuve: data.approuve ?? false,
      },
    }),
  });
}

export async function getAvis(params?: {
  recetteId?: number;
  approuve?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<StrapiResponse<Avis[]>> {
  const queryParams = new URLSearchParams();
  
  if (params?.recetteId) {
    queryParams.append('filters[recette][id][$eq]', params.recetteId.toString());
  }
  
  if (params?.approuve !== undefined) {
    queryParams.append('filters[approuve][$eq]', params.approuve.toString());
  }
  
  if (params?.page) {
    queryParams.append('pagination[page]', params.page.toString());
  }
  if (params?.pageSize) {
    queryParams.append('pagination[pageSize]', params.pageSize.toString());
  }
  
  queryParams.append('populate', 'recette');
  queryParams.append('sort', 'createdAt:desc');

  return fetchAPI<Avis[]>(`/avis-recettes?${queryParams.toString()}`);
}

/** Note moyenne des avis approuvés (pour JSON-LD aggregateRating). */
export async function getRecetteAggregateRating(
  recetteId: number
): Promise<{ ratingValue: number; reviewCount: number } | null> {
  try {
    const response = await getAvis({
      recetteId,
      approuve: true,
      pageSize: 100,
    });
    const avis = response.data ?? [];
    if (avis.length === 0) return null;

    const sum = avis.reduce((acc, item) => acc + (item.attributes.rating ?? 0), 0);
    const ratingValue = Math.round((sum / avis.length) * 10) / 10;

    return { ratingValue, reviewCount: avis.length };
  } catch (error) {
    console.error('Erreur agrégation notes pour JSON-LD:', error);
    return null;
  }
}
