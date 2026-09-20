import type { Metadata } from 'next';
import { getRecettes, Recette } from '@/lib/strapi';
import CategoryRail from '@/components/CategoryRail';
import RecipesFiltersClient from '@/components/RecipesFiltersClient';
import { getCategoryOptions } from '@/lib/recipeList';
import { SITE_NAME } from '@/lib/seo';

// Rendu à chaque requête, mais les appels Strapi sont mis en cache (revalidation 5 min dans fetchAPI)
// pour ne pas solliciter le backend à chaque visite.
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

export const metadata: Metadata = {
  title: 'Toutes les recettes',
  description:
    'Parcourez toutes nos recettes faciles et gourmandes : filtres par temps, difficulté et type de plat.',
  alternates: {
    canonical: '/recettes',
  },
  openGraph: {
    title: `Toutes les recettes | ${SITE_NAME}`,
    description:
      'Parcourez toutes nos recettes faciles et gourmandes.',
    url: '/recettes',
  },
};

export default async function RecipesPage() {
  let recettes: Recette[] = [];
  try {
    const res = await getRecettes({ pageSize: 1000 });
    recettes = res.data || [];
  } catch (error) {
    console.error('Erreur récupération recettes (liste) :', error);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Toutes les recettes</h1>
        <p className="text-gray-600 mt-2">Parcourez les catégories, cherchez par nom ou par ingrédient, ou filtrez par durée et difficulté.</p>
      </header>

      <CategoryRail title="Catégories" options={getCategoryOptions(recettes)} />

      <RecipesFiltersClient recettes={recettes} showCategoryChips={false} />
    </div>
  );
}
