export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getRecettes, getCategories, getRecettesByCategory, Recette, Categorie } from '@/lib/strapi';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import InstallPWAButton from '@/components/InstallPWAButton';
import KitchenModeLink from '@/components/KitchenModeLink';
import OptimizedImage from '@/components/OptimizedImage';
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

  const heroImageUrl = recetteVedette?.attributes.imagePrincipale?.data?.attributes?.url || null;
  const heroPrep = recetteVedette?.attributes.tempsPreparation || 0;
  const heroCooking = recetteVedette?.attributes.tempsCuisson || 0;
  const heroTotal = heroPrep + heroCooking;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative mb-8 overflow-hidden bg-gray-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          {heroImageUrl ? (
            <OptimizedImage
              src={heroImageUrl}
              alt={recetteVedette?.attributes.titre || 'Recette 4epices'}
              fill
              disableAspectRatio
              priority
              sizes="100vw"
              className="object-cover opacity-55"
            />
          ) : (
            <img
              src="/images/chef-guide-intro.webp"
              alt=""
              className="h-full w-full object-cover opacity-45"
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-gray-950/30" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(25rem,0.8fr)] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-200">
              Votre assistant de cuisine intelligent
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Choisissez une recette, cuisinez accompagne.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-orange-50 sm:text-xl">
              Le Mode Cuisine transforme une recette classique en experience guidee :
              etapes lisibles, voix, commandes mains libres et portions ajustables.
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
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <InstallPWAButton className="min-h-11 rounded-lg bg-gray-950/85 px-4 py-2 text-sm hover:bg-gray-900" />
              <span className="text-sm font-medium text-orange-100">
                Installez 4epices pour cuisiner en plein ecran.
              </span>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Lisible', 'Des etapes concues pour etre vues de loin.'],
                ['Mains libres', 'Voix et commandes pendant la preparation.'],
                ['Ajustable', 'Portions et ingredients adaptes en cuisine.'],
              ].map(([title, text]) => (
                <div key={title} className="border-l border-orange-300/60 pl-3">
                  <p className="font-bold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-snug text-orange-100">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center lg:justify-end">
            <div className="w-full max-w-[29rem] overflow-hidden rounded-lg border border-white/15 bg-white text-gray-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                    Apercu Mode Cuisine
                  </p>
                  <p className="text-sm font-semibold text-gray-500">Etape 2 sur 6</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  Voix active
                </span>
              </div>

              <div className="grid gap-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <div className="bg-orange-50 p-3">
                  <img
                    src="/images/chef-guide-cut.webp"
                    alt="Chef en train de guider la decoupe"
                    className="h-full min-h-[13rem] w-full rounded-lg object-contain"
                  />
                </div>
                <div className="flex flex-col justify-between gap-4 p-4">
                  <div>
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full w-1/3 rounded-full bg-orange-600" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      En direct
                    </p>
                    <p className="mt-2 text-xl font-bold leading-snug text-gray-950">
                      Coupez les legumes en morceaux reguliers, puis gardez-les a portee de main.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                    <span className="rounded-lg bg-gray-100 px-2 py-2 text-gray-700">Precedent</span>
                    <span className="rounded-lg bg-orange-600 px-2 py-2 text-white">Lire</span>
                    <span className="rounded-lg bg-gray-100 px-2 py-2 text-gray-700">Suivant</span>
                  </div>
                </div>
              </div>

              {recetteVedette && (
                <div className="border-t border-gray-100 p-4">
                  <div className="flex gap-3">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <OptimizedImage
                        src={heroImageUrl}
                        alt={recetteVedette.attributes.titre}
                        fill
                        disableAspectRatio
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Pret maintenant
                      </p>
                      <h2 className="truncate text-base font-bold text-gray-950">
                        {recetteVedette.attributes.titre}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {heroTotal > 0 && (
                          <span className="text-xs font-semibold text-gray-600">
                            Total : {formatTime(heroTotal)}
                          </span>
                        )}
                        <Link
                          href={`/recettes/${recetteVedette.attributes.slug}`}
                          className="text-xs font-bold text-orange-700 hover:text-orange-800"
                        >
                          Voir la recette
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
