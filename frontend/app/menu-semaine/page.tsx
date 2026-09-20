import type { Metadata } from 'next';
import Link from 'next/link';
import SwipeDeck from '@/components/SwipeDeck';
import { getSwipeRecipes } from '@/lib/swipeRecipes';
import type { SwipeRecipe } from '@/lib/swipeEngine';
import { SITE_NAME } from '@/lib/seo';

// Rendu à chaque requête, mais les appels Strapi sont mis en cache (revalidation 5 min dans fetchAPI)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

const TITLE = 'Choisissez vos recettes en un swipe';
const DESCRIPTION =
  'Faites défiler les recettes et gardez celles qui vous plaisent : elles rejoignent vos favoris, prêtes à être placées dans votre calendrier.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/menu-semaine' },
  openGraph: {
    title: `${TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: '/menu-semaine',
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
  },
};

export default async function MenuSemainePage() {
  let recipes: SwipeRecipe[] = [];
  try {
    recipes = await getSwipeRecipes();
  } catch (error) {
    console.error('Erreur lors du chargement des recettes pour le menu de la semaine :', error);
  }

  return (
    <main className="min-h-screen bg-orange-50/40">
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Choisissez vos recettes</h1>
          <p className="mt-3 text-gray-600">
            Gardez les recettes qui vous tentent, passez les autres. Celles que vous gardez rejoignent vos favoris,
            prêtes à être placées dans votre calendrier.
          </p>
        </header>

        <SwipeDeck recipes={recipes} mode="week" />

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
          Vos recettes gardées sont enregistrées sur cet appareil, dans{' '}
          <Link href="/favoris" className="font-semibold text-orange-700 underline">
            votre carnet
          </Link>
          . Pas envie de planifier ?{' '}
          <Link href="/ce-soir" className="font-semibold text-orange-700 underline">
            Trouvez juste un dîner pour ce soir
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
