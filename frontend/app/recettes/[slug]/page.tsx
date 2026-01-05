import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRecetteBySlug, getStrapiMediaUrl, getRecettesSimilaires, Recette } from '@/lib/strapi';
import Image from 'next/image';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  let recette = null;
  try {
    const response = await getRecetteBySlug(params.slug);
    recette = response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération de la recette pour metadata:', error);
  }

  if (!recette) {
    return {
      title: 'Recette non trouvée',
    };
  }

  return {
    title: recette.attributes.metaTitle || recette.attributes.titre,
    description: recette.attributes.metaDescription || recette.attributes.description,
    openGraph: {
      title: recette.attributes.titre,
      description: recette.attributes.description,
      images: recette.attributes.imagePrincipale?.data?.attributes?.url
        ? [getStrapiMediaUrl(recette.attributes.imagePrincipale.data.attributes.url)]
        : [],
    },
  };
}

export default async function RecettePage({ params }: { params: { slug: string } }) {
  let recette = null;
  let recettesSimilaires: Recette[] = [];
  
  try {
    const response = await getRecetteBySlug(params.slug);
    recette = response.data;
    
    // Récupérer les recettes similaires si la recette existe
    if (recette && recette.attributes.categories?.data && recette.attributes.categories.data.length > 0) {
      const categoryIds = recette.attributes.categories.data.map(cat => cat.id);
      const similairesResponse = await getRecettesSimilaires(recette.id, categoryIds, 4);
      recettesSimilaires = similairesResponse.data || [];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de la recette:', error);
  }

  if (!recette) {
    notFound();
  }

  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url
    ? getStrapiMediaUrl(recette.attributes.imagePrincipale.data.attributes.url)
    : '/placeholder.jpg';

  const ingredients = Array.isArray(recette.attributes.ingredients)
    ? recette.attributes.ingredients
    : [];

  const tempsTotal = (recette.attributes.tempsPreparation || 0) + (recette.attributes.tempsCuisson || 0);
  
  // Structured data pour le SEO (JSON-LD)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const recetteUrl = `${siteUrl}/recettes/${recette.attributes.slug}`;
  
  // Fonction pour nettoyer les valeurs undefined
  const cleanObject = (obj: any): any => {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    }
    return cleaned;
  };
  
  const structuredData = cleanObject({
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": recette.attributes.titre,
    "description": recette.attributes.description,
    "image": imageUrl,
    "url": recetteUrl,
    "author": {
      "@type": "Organization",
      "name": "4épices"
    },
    "datePublished": recette.attributes.publishedAt,
    "prepTime": recette.attributes.tempsPreparation ? `PT${recette.attributes.tempsPreparation}M` : undefined,
    "cookTime": recette.attributes.tempsCuisson ? `PT${recette.attributes.tempsCuisson}M` : undefined,
    "totalTime": tempsTotal > 0 ? `PT${tempsTotal}M` : undefined,
    "recipeYield": recette.attributes.nombrePersonnes?.toString() || "4",
    "recipeIngredient": ingredients,
    "recipeInstructions": recette.attributes.etapes,
    "recipeCategory": recette.attributes.categories?.data?.map(cat => cat.attributes.nom).join(", ") || undefined,
    "keywords": recette.attributes.tags?.data?.map(tag => tag.attributes.nom).join(", ") || undefined
  });

  return (
    <article className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">Accueil</Link>
          <span className="mx-2">/</span>
          <Link href="/" className="hover:text-gray-700">Recettes</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{recette.attributes.titre}</span>
        </nav>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-12">
          <div className="relative h-96 w-full">
            <Image
              src={imageUrl}
              alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
              fill
              className="object-cover"
            />
          </div>

          <div className="p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {recette.attributes.titre}
            </h1>

            <p className="text-xl text-gray-600 mb-6">
              {recette.attributes.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b">
              {recette.attributes.tempsPreparation && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <div className="text-sm text-gray-500">Préparation</div>
                    <div className="font-semibold">{recette.attributes.tempsPreparation} min</div>
                  </div>
                </div>
              )}
              {recette.attributes.tempsCuisson && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <div className="text-sm text-gray-500">Cuisson</div>
                    <div className="font-semibold">{recette.attributes.tempsCuisson} min</div>
                  </div>
                </div>
              )}
              {tempsTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="font-semibold">{tempsTotal} min</div>
                  </div>
                </div>
              )}
              {recette.attributes.nombrePersonnes && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👥</span>
                  <div>
                    <div className="text-sm text-gray-500">Portions</div>
                    <div className="font-semibold">{recette.attributes.nombrePersonnes}</div>
                  </div>
                </div>
              )}
              {recette.attributes.difficulte && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <div>
                    <div className="text-sm text-gray-500">Difficulté</div>
                    <div className="font-semibold capitalize">{recette.attributes.difficulte}</div>
                  </div>
                </div>
              )}
            </div>

            {ingredients.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingrédients</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {ingredients.map((ingredient: string, index: number) => (
                    <li key={index}>{ingredient}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Préparation</h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: recette.attributes.etapes }}
              />
            </div>

            {recette.attributes.categories?.data && recette.attributes.categories.data.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recette.attributes.categories.data.map((categorie) => (
                  <Link
                    key={categorie.id}
                    href={`/categories/${categorie.attributes.slug}`}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 transition-colors"
                  >
                    {categorie.attributes.nom}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {recettesSimilaires.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Recettes similaires</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recettesSimilaires.map((recetteSimilaire) => {
                const imageUrlSimilaire = recetteSimilaire.attributes.imagePrincipale?.data?.attributes?.url
                  ? getStrapiMediaUrl(recetteSimilaire.attributes.imagePrincipale.data.attributes.url)
                  : '/placeholder.jpg';

                return (
                  <Link
                    key={recetteSimilaire.id}
                    href={`/recettes/${recetteSimilaire.attributes.slug}`}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    <div className="relative h-48 w-full">
                      <Image
                        src={imageUrlSimilaire}
                        alt={recetteSimilaire.attributes.imagePrincipale?.data?.attributes?.alternativeText || recetteSimilaire.attributes.titre}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {recetteSimilaire.attributes.titre}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {recetteSimilaire.attributes.tempsPreparation && (
                          <span>⏱️ {recetteSimilaire.attributes.tempsPreparation} min</span>
                        )}
                        {recetteSimilaire.attributes.nombrePersonnes && (
                          <span>👥 {recetteSimilaire.attributes.nombrePersonnes}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

