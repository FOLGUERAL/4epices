import type { Metadata } from 'next';
import Link from 'next/link';
import WeekCalendar from '@/components/WeekCalendar';
import { getSwipeRecipes } from '@/lib/swipeRecipes';
import type { SwipeRecipe } from '@/lib/swipeEngine';
import { SITE_NAME } from '@/lib/seo';

// Rendu à chaque requête, mais les appels Strapi sont mis en cache (revalidation 5 min dans fetchAPI)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

export const metadata: Metadata = {
  title: 'Planning des repas de la semaine',
  description:
    'Placez vos recettes favorites dans un calendrier, puis ajoutez-les à votre agenda et à votre liste de courses.',
  alternates: { canonical: '/planning' },
  // Outil personnel : le contenu dépend du menu enregistré sur l'appareil, sans intérêt pour la recherche
  robots: { index: false, follow: true },
  openGraph: {
    title: `Planning des repas de la semaine | ${SITE_NAME}`,
    url: '/planning',
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
  },
};

export default async function PlanningPage() {
  // Sert seulement à connaître les durées des recettes : le calendrier fonctionne sans
  let recipes: SwipeRecipe[] = [];
  try {
    recipes = await getSwipeRecipes();
  } catch (error) {
    console.error('Erreur lors du chargement des recettes pour le planning :', error);
  }

  return (
    <main className="min-h-screen bg-rose-50/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Planning des prochains jours</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            Placez vos favoris sur aujourd&apos;hui et les 7 jours suivants, puis ajoutez-les à votre agenda et à votre liste de courses. Les 7 jours précédents restent consultables.
          </p>
        </header>

        <WeekCalendar recipes={recipes} />

        <noscript>
          <p className="mt-6 text-center text-gray-600">
            Cette page a besoin de JavaScript. Vous pouvez aussi{' '}
            <Link href="/recettes" className="text-orange-700 underline">
              parcourir toutes les recettes
            </Link>
            .
          </p>
        </noscript>
      </div>
    </main>
  );
}
