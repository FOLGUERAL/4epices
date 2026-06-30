export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getRecettes, getCategories, getRecettesByCategory, Recette, Categorie } from '@/lib/strapi';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import KitchenModeHelp from '@/components/KitchenModeHelp';
import KitchenModeLink from '@/components/KitchenModeLink';
import { SITE_NAME } from '@/lib/seo';

function formatTime(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

export default async function Home() {
  let recetteVedette: Recette | null = null;
  let recettesRecent: Recette[] = [];
  let categories: Categorie[] = [];
  let recettesParCategorie: { [key: string]: Recette[] } = {};

  try {
    const vedetteResponse = await getRecettes({ pageSize: 1 });
    recetteVedette = vedetteResponse.data?.[0] || null;

    const recentResponse = await getRecettes({ pageSize: 10 });
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

  const heroPrep = recetteVedette?.attributes.tempsPreparation || 0;
  const heroCooking = recetteVedette?.attributes.tempsCuisson || 0;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative mb-8 overflow-hidden bg-gray-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/chef-guide-intro.webp"
            alt=""
            className="h-full w-full object-cover opacity-40"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-gray-950/30" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="flex max-w-3xl flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-200">
              Mode Cuisine
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Cuisinez pas a pas.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-orange-50 sm:text-xl">
              Choisissez une recette, 4epices vous guide avec les etapes et la voix.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/mode-cuisine"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-orange-600 px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
              >
                Choisir une recette a cuisiner
              </Link>
              {recetteVedette && (
                <KitchenModeLink
                  recette={recetteVedette}
                  label="Cuisiner la derniere recette"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-gray-950 shadow-sm transition-colors hover:bg-orange-50 focus-ring"
                />
              )}
              <KitchenModeHelp />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="recettes">
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

        <section className="mt-12 mb-16 rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-orange-50 p-6 shadow-lg sm:mb-20 sm:p-8 md:p-12 lg:mb-24 lg:p-16">
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900 sm:mb-12 sm:text-4xl">
            Pourquoi {SITE_NAME} ?
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3 lg:gap-10">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-orange-200 shadow-md sm:mb-6 sm:h-24 sm:w-24">
                <span className="text-4xl font-bold text-orange-700 sm:text-5xl">1</span>
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">Rapide</h3>
              <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                Des recettes concues pour etre realisees rapidement, sans compromettre le gout ni la qualite.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent-100 to-accent-200 shadow-md sm:mb-6 sm:h-24 sm:w-24">
                <span className="text-4xl font-bold text-accent-700 sm:text-5xl">2</span>
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">Guide</h3>
              <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                Un Mode Cuisine pense pour suivre chaque etape sans toucher l'ecran toutes les trente secondes.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success-100 to-success-200 shadow-md sm:mb-6 sm:h-24 sm:w-24">
                <span className="text-4xl font-bold text-success-700 sm:text-5xl">3</span>
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">Savoureux</h3>
              <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                Des recettes testees et approuvees, avec des instructions claires pour cuisiner plus sereinement.
              </p>
            </div>
          </div>
        </section>

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
