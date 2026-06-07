import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllIngredients, MIN_RECIPES_FOR_INDEX } from '@/lib/ingredients';

export const metadata: Metadata = {
  title: 'Recettes par ingrédient',
  description:
    'Parcourez nos recettes par ingrédient principal : poulet, saumon, courgettes et bien plus sur 4épices.',
  alternates: {
    canonical: '/ingredients',
  },
  openGraph: {
    title: 'Recettes par ingrédient | 4épices',
    description:
      'Parcourez nos recettes par ingrédient principal : idées faciles et gourmandes.',
    url: '/ingredients',
    type: 'website',
    locale: 'fr_FR',
    siteName: '4épices',
  },
};

export default async function IngredientsHubPage() {
  const ingredients = await getAllIngredients();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-4" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-gray-700">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <Link href="/recettes" className="hover:text-gray-700">
              Recettes
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Ingrédients</span>
          </nav>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">Recettes par ingrédient</h1>
          <p className="text-xl text-gray-600">
            Trouvez des idées de recettes autour d&apos;un ingrédient principal.
          </p>
        </div>

        {ingredients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ingredients.map((ingredient) => (
              <Link
                key={ingredient.slug}
                href={`/ingredients/${ingredient.slug}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-2 capitalize">
                  {ingredient.nom}
                </h2>
                <p className="text-gray-600 text-sm">
                  {ingredient.recetteCount}{' '}
                  {ingredient.recetteCount === 1 ? 'recette' : 'recettes'}
                  {ingredient.recetteCount < MIN_RECIPES_FOR_INDEX && (
                    <span className="text-gray-400"> · catalogue en cours</span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Aucun ingrédient principal renseigné pour le moment.
            </p>
            <Link
              href="/recettes"
              className="mt-4 inline-block text-orange-600 hover:text-orange-700 font-medium transition-colors"
            >
              ← Voir toutes les recettes
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
