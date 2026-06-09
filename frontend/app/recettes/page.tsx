import type { Metadata } from 'next';
import { getRecettes, Recette } from '@/lib/strapi';
import RecipesFiltersClient from '@/components/RecipesFiltersClient';
import { SITE_NAME } from '@/lib/seo';

export const dynamic = 'force-dynamic';

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
        <p className="text-gray-600 mt-2">Filtrez par temps de préparation, difficulté ou régime.</p>
      </header>

      <RecipesFiltersClient recettes={recettes} />
    </div>
  );
}
