import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getIngredientBySlug,
  getRecetteCountByIngredient,
  buildIngredientMetaTitle,
  buildIngredientMetaDescription,
  buildIngredientDescription,
  MIN_RECIPES_FOR_INDEX,
} from '@/lib/ingredients';
import { buildItemListJsonLd, getSiteUrl } from '@/lib/seo';
import OptimizedImage from '@/components/OptimizedImage';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  let ingredient = null;
  let recetteCount = 0;

  try {
    const [detail, count] = await Promise.all([
      getIngredientBySlug(params.slug),
      getRecetteCountByIngredient(params.slug),
    ]);
    ingredient = detail;
    recetteCount = count;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'ingrédient pour metadata:', error);
  }

  if (!ingredient) {
    return {
      title: 'Ingrédient non trouvé',
      robots: { index: false, follow: false },
    };
  }

  const nom = ingredient.nom;
  const title = buildIngredientMetaTitle(nom);
  const description = buildIngredientMetaDescription(nom, recetteCount);
  const canonicalPath = `/ingredients/${params.slug}`;
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

export default async function IngredientPage({ params }: { params: { slug: string } }) {
  let ingredient = null;

  try {
    ingredient = await getIngredientBySlug(params.slug);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'ingrédient:', error);
  }

  if (!ingredient) {
    notFound();
  }

  const { nom, recettes } = ingredient;
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/ingredients/${params.slug}`;
  const description = buildIngredientDescription(nom, recettes.length);

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
            <Link href="/ingredients" className="hover:text-gray-700">
              Ingrédients
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 capitalize">{nom}</span>
          </nav>

          <h1 className="text-4xl font-bold text-gray-900 mb-4 capitalize">
            Recettes à base de {nom}
          </h1>

          <p className="text-xl text-gray-600 mb-3">{description}</p>

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
                    {recette.attributes.tags?.data && recette.attributes.tags.data.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {recette.attributes.tags.data.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs"
                          >
                            #{tag.attributes.nom}
                          </span>
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
            <p className="text-gray-500 text-lg">Aucune recette pour cet ingrédient pour le moment.</p>
            <Link
              href="/ingredients"
              className="mt-4 inline-block text-orange-600 hover:text-orange-700 font-medium transition-colors"
            >
              ← Voir tous les ingrédients
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
