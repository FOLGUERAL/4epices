// Rendu à chaque requête, mais les appels Strapi sont mis en cache (revalidation 5 min dans fetchAPI)
// pour ne pas solliciter le backend à chaque visite.
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

import Link from 'next/link';
import { getRecettes, getCategories, getRecettesByCategory, Recette, Categorie } from '@/lib/strapi';
import HomeHub from '@/components/HomeHub';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import HowItWorks from '@/components/HowItWorks';

export default async function Home() {
  let recettesRecent: Recette[] = [];
  let categories: Categorie[] = [];
  let recettesParCategorie: { [key: string]: Recette[] } = {};

  try {
    const recentResponse = await getRecettes({
      pageSize: 10,
      excludeCategorySlug: 'bases-de-cuisine',
    });
    recettesRecent = recentResponse.data || [];

    const categoriesResponse = await getCategories();
    categories = categoriesResponse.data || [];

    for (const categorie of categories) {
      try {
        const recettesResponse = await getRecettesByCategory(categorie.attributes.slug, { pageSize: 10 });
        if (recettesResponse.data && recettesResponse.data.length > 0) {
          recettesParCategorie[categorie.attributes.slug] = recettesResponse.data;
        }
      } catch (error) {
        console.error(`Erreur lors de la recuperation des recettes pour ${categorie.attributes.nom}:`, error);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la recuperation des donnees:', error);
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-700 sm:text-sm">
              L&apos;app de cuisine
            </p>
            <h1 className="text-3xl font-bold leading-tight text-gray-900 [text-wrap:balance] sm:text-4xl lg:text-5xl">
              Swipez, planifiez, cuisinez : l&apos;app qui s&apos;occupe du dîner.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">
              Des recettes faciles à choisir, à planifier et à cuisiner pas à pas.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                href="/decouvrir"
                data-umami-event="hero-start-cta"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-600 px-6 font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
              >
                Commencer
              </Link>
              <Link
                href="/recettes"
                data-umami-event="hero-browse-cta"
                className="focus-ring inline-flex min-h-11 items-center rounded-lg font-semibold text-orange-700 underline-offset-4 transition-colors hover:underline"
              >
                Parcourir les recettes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8" id="recettes">
        <HomeHub />

        {recettesRecent.length > 0 && (
          <HorizontalCarousel
            title="Recettes recentes"
            subtitle="Les dernieres recettes ajoutees"
            recettes={recettesRecent}
            seeAllLink="/recettes"
          />
        )}

        {categories.map((categorie) => {
          const recettesCategorie = recettesParCategorie[categorie.attributes.slug] || [];
          if (recettesCategorie.length === 0) return null;

          return (
            <HorizontalCarousel
              key={categorie.id}
              title={categorie.attributes.nom}
              subtitle={categorie.attributes.description}
              recettes={recettesCategorie}
              seeAllLink={`/categories/${categorie.attributes.slug}`}
            />
          );
        })}

        <HowItWorks />

        {recettesRecent.length === 0 && categories.length === 0 && (
          <div className="py-16 text-center sm:py-20">
            <p className="text-lg font-medium text-gray-500 sm:text-xl">Aucune recette disponible pour le moment.</p>
            <p className="mt-2 text-sm text-gray-400 sm:text-base">Creez votre premiere recette dans Strapi.</p>
          </div>
        )}
      </main>
    </div>
  );
}
