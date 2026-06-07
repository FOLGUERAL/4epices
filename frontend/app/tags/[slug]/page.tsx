import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getTagBySlug,
  getRecettesByTag,
  getRecetteCountByTag,
  Recette,
} from '@/lib/strapi';
import { buildItemListJsonLd, getSiteUrl } from '@/lib/seo';
import OptimizedImage from '@/components/OptimizedImage';

const MIN_RECIPES_FOR_INDEX = 3;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  let tag = null;
  let recetteCount = 0;

  try {
    const [tagResponse, count] = await Promise.all([
      getTagBySlug(params.slug),
      getRecetteCountByTag(params.slug),
    ]);
    tag = tagResponse.data;
    recetteCount = count;
  } catch (error) {
    console.error('Erreur lors de la récupération du tag pour metadata:', error);
  }

  if (!tag) {
    return {
      title: 'Tag non trouvé',
      robots: { index: false, follow: false },
    };
  }

  const nom = tag.attributes.nom;
  const title = tag.attributes.metaTitle || `Recettes ${nom}`;
  const description =
    tag.attributes.metaDescription ||
    tag.attributes.description ||
    `Découvrez toutes nos recettes ${nom} : idées faciles et gourmandes sur 4épices.`;
  const canonicalPath = `/tags/${params.slug}`;
  const thin = recetteCount < MIN_RECIPES_FOR_INDEX;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    ...(thin ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: 'website',
      locale: 'fr_FR',
      siteName: '4épices',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function TagPage({ params }: { params: { slug: string } }) {
  let tag = null;
  let recettes: Recette[] = [];

  try {
    const [tagResponse, recettesResponse] = await Promise.all([
      getTagBySlug(params.slug),
      getRecettesByTag(params.slug, { pageSize: 50 }),
    ]);

    tag = tagResponse.data;
    recettes = recettesResponse.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération du tag:', error);
  }

  if (!tag) {
    notFound();
  }

  const nom = tag.attributes.nom;
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/tags/${params.slug}`;
  const itemListJsonLd = buildItemListJsonLd(
    recettes.map((r) => ({
      name: r.attributes.titre,
      url: `${siteUrl}/recettes/${r.attributes.slug}`,
    })),
    pageUrl
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}

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
            <span className="text-gray-900">{nom}</span>
          </nav>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">Recettes {nom}</h1>

          {tag.attributes.description && (
            <p className="text-xl text-gray-600 mb-3">{tag.attributes.description}</p>
          )}

          <p className="text-gray-500">
            {recettes.length > 0
              ? `${recettes.length} ${recettes.length === 1 ? 'recette' : 'recettes'}`
              : 'Aucune recette pour le moment'}
          </p>
        </div>

        {recettes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recettes.map((recette) => {
              const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;

              return (
                <Link
                  key={recette.id}
                  href={`/recettes/${recette.attributes.slug}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <OptimizedImage
                    src={imageUrl}
                    alt={
                      recette.attributes.imagePrincipale?.data?.attributes?.alternativeText ||
                      recette.attributes.titre
                    }
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {recette.attributes.titre}
                    </h2>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                      {recette.attributes.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      {recette.attributes.tempsPreparation && (
                        <span className="font-medium">
                          ⏱️ {recette.attributes.tempsPreparation} min
                        </span>
                      )}
                      {recette.attributes.nombrePersonnes && (
                        <span className="font-medium">
                          👥 {recette.attributes.nombrePersonnes} pers.
                        </span>
                      )}
                      {recette.attributes.difficulte && (
                        <span className="capitalize px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          {recette.attributes.difficulte}
                        </span>
                      )}
                    </div>
                    {recette.attributes.categories?.data &&
                      recette.attributes.categories.data.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {recette.attributes.categories.data.map((categorie) => (
                            <Link
                              key={categorie.id}
                              href={`/categories/${categorie.attributes.slug}`}
                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
                            >
                              {categorie.attributes.nom}
                            </Link>
                          ))}
                        </div>
                      )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucune recette avec ce tag pour le moment.</p>
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
