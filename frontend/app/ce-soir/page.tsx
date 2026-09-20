import type { Metadata } from 'next';
import Link from 'next/link';
import SwipeDeck from '@/components/SwipeDeck';
import { getSwipeRecipes } from '@/lib/swipeRecipes';
import type { SwipeRecipe } from '@/lib/swipeEngine';
import { SITE_NAME } from '@/lib/seo';

// Rendu à chaque requête, mais les appels Strapi sont mis en cache (revalidation 5 min dans fetchAPI)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

const TITLE = 'Que manger ce soir ? Trouvez votre recette en quelques swipes';
const DESCRIPTION =
  'Pas d’idée pour le dîner ? Faites défiler nos recettes, gardez celle qui vous donne envie et lancez-vous avec le mode cuisine.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/ce-soir' },
  openGraph: {
    title: `${TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: '/ce-soir',
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
  },
};

export default async function CeSoirPage() {
  let recipes: SwipeRecipe[] = [];
  try {
    recipes = await getSwipeRecipes();
  } catch (error) {
    console.error('Erreur lors du chargement des recettes pour « Ce soir » :', error);
  }

  return (
    <main className="min-h-screen bg-orange-50/40">
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Que manger ce soir ?</h1>
          <p className="mt-3 text-gray-600">
            Faites défiler les idées et gardez celle qui vous donne envie. Le mode cuisine vous guide ensuite pas à
            pas.
          </p>
        </header>

        <SwipeDeck recipes={recipes} mode="tonight" />

        <noscript>
          <p className="mt-6 text-center text-gray-600">
            Cette page a besoin de JavaScript. Vous pouvez aussi{' '}
            <Link href="/recettes" className="text-orange-700 underline">
              parcourir toutes les recettes
            </Link>
            .
          </p>
        </noscript>

        <p className="mt-10 text-center text-sm text-gray-500">
          Envie de planifier plus large ?{' '}
          <Link href="/menu-semaine" className="font-semibold text-orange-700 underline">
            Choisissez vos recettes de la semaine
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
