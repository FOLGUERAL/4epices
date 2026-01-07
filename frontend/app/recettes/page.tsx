import { getRecettes, Recette } from '@/lib/strapi';
import RecipesFiltersClient from '@/components/RecipesFiltersClient';

export const dynamic = 'force-dynamic';

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
