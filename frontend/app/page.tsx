export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getRecettes, getCategories, getRecettesByCategory, Recette, Categorie } from '@/lib/strapi';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import KitchenModeHelp from '@/components/KitchenModeHelp';
import OptimizedImage from '@/components/OptimizedImage';
import { SITE_NAME } from '@/lib/seo';

function formatTime(minutes: number): string {
  if (minutes <= 0) {
    return '';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

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

  const derniereRecette = recettesRecent[0] || null;
  const derniereRecetteImage =
    derniereRecette?.attributes.imagePrincipale?.data?.attributes?.url || null;
  const derniereRecetteTempsPreparation = derniereRecette?.attributes.tempsPreparation || 0;
  const derniereRecetteTempsCuisson = derniereRecette?.attributes.tempsCuisson || 0;
  const derniereRecetteTempsTotal =
    derniereRecetteTempsPreparation + derniereRecetteTempsCuisson;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative mb-8 overflow-hidden bg-[#111827] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827_0%,#18181b_58%,#292524_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-orange-500/45" />
          <div className="absolute bottom-0 left-0 h-24 w-full bg-[linear-gradient(0deg,rgba(234,88,12,0.12),transparent)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-16">
          <div className="flex max-w-3xl flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-200">
              MODE CUISINE
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Ne lisez plus vos recettes. Vivez-les.
            </h1>
            <div className="mt-5 max-w-3xl space-y-3 text-lg leading-relaxed text-orange-50 sm:text-xl">
              <p>
                4epices transforme chaque recette en un véritable assistant de cuisine :
                étapes guidées, commandes vocales et minuteurs intégrés.
              </p>
              <p>Vous cuisinez, 4epices s'occupe du reste.</p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/recettes"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-orange-600 px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
              >
                Trouver une recette
              </Link>
              <KitchenModeHelp triggerLabel="Découvrir le Mode Cuisine" />
            </div>
          </div>

          {derniereRecette && (
            <Link
              href={`/recettes/${derniereRecette.attributes.slug}`}
              className="group relative min-h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl outline-none transition-transform hover:-translate-y-1 focus-ring sm:min-h-[420px] lg:min-h-[500px]"
            >
              <OptimizedImage
                src={derniereRecetteImage}
                alt={
                  derniereRecette.attributes.imagePrincipale?.data?.attributes?.alternativeText ||
                  derniereRecette.attributes.titre
                }
                fill
                disableAspectRatio
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <p className="mb-3 inline-flex rounded-full bg-orange-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Dernière recette
                </p>
                <h2 className="text-2xl font-bold leading-tight text-white transition-colors group-hover:text-orange-200 sm:text-3xl">
                  {derniereRecette.attributes.titre}
                </h2>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-orange-50 sm:text-base">
                  {derniereRecette.attributes.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-white">
                  {derniereRecetteTempsPreparation > 0 && (
                    <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                      Prép. {formatTime(derniereRecetteTempsPreparation)}
                    </span>
                  )}
                  {derniereRecetteTempsTotal > 0 && (
                    <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                      Total {formatTime(derniereRecetteTempsTotal)}
                    </span>
                  )}
                  {derniereRecette.attributes.difficulte && (
                    <span className="rounded-full bg-white/15 px-3 py-1.5 capitalize backdrop-blur">
                      {derniereRecette.attributes.difficulte}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )}
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
