import type { Metadata } from 'next';
import Link from 'next/link';
import InstallPWAButton from '@/components/InstallPWAButton';
import KitchenModeLink from '@/components/KitchenModeLink';
import OptimizedImage from '@/components/OptimizedImage';
import { getRecettes, Recette } from '@/lib/strapi';

export const metadata: Metadata = {
  title: 'Mode Cuisine',
  description:
    'Lancez le Mode Cuisine 4epices pour suivre vos recettes pas a pas avec guidage visuel et vocal.',
  alternates: {
    canonical: '/mode-cuisine',
  },
};

export default async function ModeCuisinePage() {
  let recettes: Recette[] = [];

  try {
    const response = await getRecettes({ pageSize: 9 });
    recettes = response.data || [];
  } catch (error) {
    console.error('Erreur lors du chargement des recettes pour le Mode Cuisine:', error);
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-orange-100 bg-orange-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8 lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-700">
              Experience principale
            </p>
            <h1 className="max-w-3xl text-4xl font-bold text-gray-950 sm:text-5xl">
              Mode Cuisine 4epices
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-700">
              Choisissez une recette et passez en guidage pas a pas avec vignettes du chef,
              lecture vocale, commandes vocales et portions ajustables.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/recettes"
                className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
              >
                Choisir une recette
              </Link>
              <InstallPWAButton />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="rounded-xl bg-gray-950 p-4 text-white">
              <p className="text-sm font-semibold text-orange-200">Pret a cuisiner</p>
              <div className="mt-4 space-y-3">
                {['Etapes synchronisees', 'Guidage vocal', 'Commandes mains libres'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400" aria-hidden="true" />
                    <span className="text-sm font-semibold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">Lancer une recette</h2>
            <p className="mt-1 text-gray-600">
              Les recettes restent chargees depuis Strapi pour eviter les contenus obsoletes.
            </p>
          </div>
          <Link href="/recettes" className="font-semibold text-orange-700 hover:text-orange-800">
            Voir toutes les recettes
          </Link>
        </div>

        {recettes.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {recettes.map((recette) => {
              const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;

              return (
                <article
                  key={recette.id}
                  className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm"
                >
                  <Link href={`/recettes/${recette.attributes.slug}`} className="block">
                    <OptimizedImage
                      src={imageUrl}
                      alt={recette.attributes.titre}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      aspectRatio="16/9"
                    />
                  </Link>
                  <div className="p-4">
                    <h3 className="line-clamp-2 text-lg font-bold text-gray-950">
                      {recette.attributes.titre}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {recette.attributes.description}
                    </p>
                    <div className="mt-4">
                      <KitchenModeLink recette={recette} label="Lancer" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
            <p className="font-semibold text-gray-800">Aucune recette disponible pour le moment.</p>
            <Link href="/recettes" className="mt-3 inline-flex font-bold text-orange-700">
              Retour aux recettes
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
