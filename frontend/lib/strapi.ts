// Fonction pour obtenir l'URL Strapi selon le contexte
function getStrapiUrl(): string {
  // Côté serveur (SSR), utiliser le service Docker si disponible
  if (typeof window === 'undefined') {
    // On est côté serveur
    return process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
  }
  // Côté client, utiliser l'URL publique
  return process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
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
  // Récupérer l'URL dynamiquement à chaque appel
  const strapiUrl = getStrapiUrl();
  const url = `${strapiUrl}/api${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
      // Désactiver le cache pour le développement
      cache: 'no-store',
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
}): Promise<StrapiResponse<Recette[]>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('pagination[page]', params.page.toString());
  if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
  
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

export async function getRecettesSimilaires(
  recetteId: number,
  categoryIds: number[],
  limit: number = 4
): Promise<StrapiResponse<Recette[]>> {
  if (categoryIds.length === 0) {
    return { data: [] };
  }

  const queryParams = new URLSearchParams();
  queryParams.append('filters[id][$ne]', recetteId.toString());
  
  // Utiliser la première catégorie pour trouver des recettes similaires
  // On pourrait améliorer avec $or pour plusieurs catégories, mais cela fonctionne bien
  queryParams.append('filters[categories][id][$eq]', categoryIds[0].toString());
  
  queryParams.append('populate', 'imagePrincipale,categories');
  queryParams.append('pagination[pageSize]', limit.toString());
  queryParams.append('sort', 'publishedAt:desc');

  return fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
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

  const queryParams = new URLSearchParams();
  const searchTerm = query.trim();
  
  // Recherche dans le titre et la description avec $containsi (insensible à la casse)
  // Syntaxe Strapi v4 pour $or
  queryParams.append('filters[$or][0][titre][$containsi]', searchTerm);
  queryParams.append('filters[$or][1][description][$containsi]', searchTerm);
  
  if (params?.page) queryParams.append('pagination[page]', params.page.toString());
  if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
  
  queryParams.append('populate', 'imagePrincipale,categories,tags');
  queryParams.append('sort', 'publishedAt:desc');

  return fetchAPI<Recette[]>(`/recettes?${queryParams.toString()}`);
}

export function getStrapiMediaUrl(url: string): string {
  if (url.startsWith('http')) {
    return url;
  }
  // Pour les images, toujours utiliser l'URL publique (client-side)
  const publicUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
  return `${publicUrl}${url}`;
}

