const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

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
  const url = `${STRAPI_URL}/api${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function getRecettes(params?: {
  page?: number;
  pageSize?: number;
  populate?: string;
}): Promise<StrapiResponse<Recette[]>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('pagination[page]', params.page.toString());
  if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
  
  const populate = params?.populate || 'imagePrincipale,categories,tags';
  queryParams.append('populate', populate);
  queryParams.append('sort', 'publishedAt:desc');

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

export function getStrapiMediaUrl(url: string): string {
  if (url.startsWith('http')) {
    return url;
  }
  return `${STRAPI_URL}${url}`;
}

