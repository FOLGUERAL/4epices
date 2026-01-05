import { MetadataRoute } from 'next';
import { getRecettes, getCategories, getTags } from '@/lib/strapi';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  // URLs statiques
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/recherche`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Récupérer toutes les recettes
  let recettesRoutes: MetadataRoute.Sitemap = [];
  try {
    const recettesResponse = await getRecettes({ pageSize: 1000 });
    const recettes = recettesResponse.data || [];
    
    recettesRoutes = recettes.map((recette) => ({
      url: `${baseUrl}/recettes/${recette.attributes.slug}`,
      lastModified: new Date(recette.attributes.updatedAt || recette.attributes.publishedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des recettes pour le sitemap:', error);
  }

  // Récupérer toutes les catégories
  let categoriesRoutes: MetadataRoute.Sitemap = [];
  try {
    const categoriesResponse = await getCategories();
    const categories = categoriesResponse.data || [];
    
    categoriesRoutes = categories.map((categorie) => ({
      url: `${baseUrl}/categories/${categorie.attributes.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories pour le sitemap:', error);
  }

  // Récupérer tous les tags
  let tagsRoutes: MetadataRoute.Sitemap = [];
  try {
    const tagsResponse = await getTags();
    const tags = tagsResponse.data || [];
    
    tagsRoutes = tags.map((tag) => ({
      url: `${baseUrl}/tags/${tag.attributes.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des tags pour le sitemap:', error);
  }

  return [...staticRoutes, ...recettesRoutes, ...categoriesRoutes, ...tagsRoutes];
}

