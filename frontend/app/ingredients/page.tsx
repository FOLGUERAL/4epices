import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getIngredientMixerData, MIN_RECIPES_FOR_INDEX } from '@/lib/ingredients';
import { SITE_NAME } from '@/lib/seo';
import IngredientMixer from '@/components/IngredientMixer';

export const metadata: Metadata = {
  title: 'Recettes par ingrédient',
  description:
    `Parcourez nos recettes par ingrédient ou combinez plusieurs ingrédients avec le fouet magique sur ${SITE_NAME}.`,
  alternates: {
    canonical: '/ingredients',
  },
  openGraph: {
    title: `Recettes par ingrédient | ${SITE_NAME}`,
    description:
      'Parcourez nos recettes par ingrédient ou combinez plusieurs ingrédients avec le fouet magique.',
    url: '/ingredients',
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
  },
};

function MixerSkeleton() {
  return <div className="mb-10 h-64 animate-pulse rounded-2xl border border-orange-100 bg-orange-50/50" />;
}

export default async function IngredientsHubPage() {
  const mixerData = await getIngredientMixerData();
  const { ingredients } = mixerData;
  // Les fiches trop maigres (noindex) restent accessibles, mais repliées : elles n'ont pas de quoi être mises en avant
  const mainIngredients = ingredients.filter((i) => i.recetteCount >= MIN_RECIPES_FOR_INDEX);
  const otherIngredients = ingredients.filter((i) => i.recetteCount < MIN_RECIPES_FOR_INDEX);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6">
          <nav className="mb-4 text-sm text-gray-500" aria-label="Fil d'Ariane">
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

          <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">Recettes par ingrédient</h1>
          <p className="text-lg text-gray-600 sm:text-xl">
            Combinez vos ingrédients ou explorez le catalogue un par un.
          </p>
        </div>

        <Suspense fallback={<MixerSkeleton />}>
          <IngredientMixer ingredients={mixerData.ingredients} recipes={mixerData.recipes} />
        </Suspense>

        <section aria-labelledby="explore-heading">
          <div className="mb-4">
            <h2 id="explore-heading" className="text-2xl font-bold text-gray-900">
              Explorer par ingrédient
            </h2>
            <p className="mt-1 text-gray-500">Toutes les fiches ingrédients du site.</p>
          </div>

          {ingredients.length > 0 ? (
            <>
              {mainIngredients.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {mainIngredients.map((ingredient) => (
                    <li key={ingredient.slug}>
                      <Link
                        href={`/ingredients/${ingredient.slug}`}
                        className="flex min-h-16 flex-col justify-center rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <span className="text-base font-bold capitalize text-gray-900">{ingredient.nom}</span>
                        <span className="text-sm tabular-nums text-gray-600">
                          {ingredient.recetteCount} {ingredient.recetteCount === 1 ? 'recette' : 'recettes'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {otherIngredients.length > 0 && (
                <details className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold text-gray-700">
                    Autres ingrédients ({otherIngredients.length})
                  </summary>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {otherIngredients.map((ingredient) => (
                      <li key={ingredient.slug}>
                        <Link
                          href={`/ingredients/${ingredient.slug}`}
                          className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-4 text-sm capitalize text-gray-700 transition-colors hover:border-orange-200 hover:bg-orange-50"
                        >
                          {ingredient.nom}
                          <span className="ml-2 text-xs tabular-nums text-gray-400">{ingredient.recetteCount}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-lg text-gray-500">Aucun ingrédient principal renseigné pour le moment.</p>
              <Link
                href="/recettes"
                className="mt-4 inline-block font-medium text-orange-600 transition-colors hover:text-orange-700"
              >
                ← Voir toutes les recettes
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
