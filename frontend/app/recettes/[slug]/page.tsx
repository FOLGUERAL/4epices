import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRecetteBySlug, getStrapiMediaUrl, getRecettesSimilaires, Recette } from '@/lib/strapi';
import OptimizedImage from '@/components/OptimizedImage';
import IngredientsAdjuster from '@/components/IngredientsAdjuster';
import ShareRecipe from '@/components/ShareRecipe';

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

  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;
  const imageUrlForStructuredData = imageUrl
    ? getStrapiMediaUrl(imageUrl)
    : '/placeholder-recipe.svg';

  // Gérer les deux formats d'ingrédients : tableau de strings ou tableau d'objets
  const rawIngredients = Array.isArray(recette.attributes.ingredients)
    ? recette.attributes.ingredients
    : [];
  
  // Normaliser les ingrédients pour l'affichage
  const ingredients = rawIngredients.map((ing: any) => {
    if (typeof ing === 'string') {
      return ing;
    }
    if (typeof ing === 'object' && ing !== null) {
      // Format structuré : {quantite, ingredient}
      const quantite = ing.quantite || '';
      const ingredient = ing.ingredient || '';
      return quantite ? `${quantite} ${ingredient}`.trim() : ingredient;
    }
    return String(ing);
  });
  
  // Pour le structured data, convertir en tableau de strings
  const ingredientsForStructuredData = rawIngredients.map((ing: any) => {
    if (typeof ing === 'string') {
      return ing;
    }
    if (typeof ing === 'object' && ing !== null) {
      const quantite = ing.quantite || '';
      const ingredient = ing.ingredient || '';
      return quantite ? `${quantite} ${ingredient}`.trim() : ingredient;
    }
    return String(ing);
  });

  const tempsTotal = (recette.attributes.tempsPreparation || 0) + (recette.attributes.tempsCuisson || 0);
  
  // Structured data pour le SEO (JSON-LD)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const recetteUrl = `${siteUrl}/recettes/${recette.attributes.slug}`;
  const imageUrlForShare = imageUrl ? getStrapiMediaUrl(imageUrl) : undefined;
  
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
    "image": imageUrlForStructuredData,
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
    "recipeIngredient": ingredientsForStructuredData,
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
          <OptimizedImage
            src={imageUrl}
            alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
            fill
            className="w-full"
            priority
            sizes="100vw"
            aspectRatio="16/9"
          />

          <div className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <h1 className="text-4xl font-bold text-gray-900">
                {recette.attributes.titre}
              </h1>
              <ShareRecipe
                title={recette.attributes.titre}
                url={recetteUrl}
                description={recette.attributes.description}
                imageUrl={imageUrlForShare}
              />
            </div>

            <p className="text-xl text-gray-600 mb-6">
              {recette.attributes.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b">
              {recette.attributes.tempsPreparation && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Préparation</div>
                    <div className="font-semibold text-gray-900">{recette.attributes.tempsPreparation} min</div>
                  </div>
                </div>
              )}
              {recette.attributes.tempsCuisson && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Cuisson</div>
                    <div className="font-semibold text-gray-900">{recette.attributes.tempsCuisson} min</div>
                  </div>
                </div>
              )}
              {tempsTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Total</div>
                    <div className="font-semibold text-gray-900">{tempsTotal} min</div>
                  </div>
                </div>
              )}
              {recette.attributes.nombrePersonnes && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👥</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Portions</div>
                    <div className="font-semibold text-gray-900">{recette.attributes.nombrePersonnes}</div>
                  </div>
                </div>
              )}
              {recette.attributes.difficulte && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Difficulté</div>
                    <div className="font-semibold text-gray-900 capitalize">{recette.attributes.difficulte}</div>
                  </div>
                </div>
              )}
            </div>

            {ingredients.length > 0 && (
              <IngredientsAdjuster
                ingredients={rawIngredients}
                basePortions={recette.attributes.nombrePersonnes || 4}
              />
            )}

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Préparation</h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: recette.attributes.etapes }}
              />
            </div>

            <div className="flex flex-wrap gap-4">
              {recette.attributes.categories?.data && recette.attributes.categories.data.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-500 mr-2">Catégories :</span>
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
              
              {recette.attributes.tags?.data && recette.attributes.tags.data.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-500 mr-2">Tags :</span>
                  {recette.attributes.tags.data.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/tags/${tag.attributes.slug}`}
                      className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200 transition-colors"
                    >
                      #{tag.attributes.nom}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {recettesSimilaires.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Recettes similaires</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recettesSimilaires.map((recetteSimilaire) => {
                const imageUrlSimilaire = recetteSimilaire.attributes.imagePrincipale?.data?.attributes?.url || null;

                return (
                  <Link
                    key={recetteSimilaire.id}
                    href={`/recettes/${recetteSimilaire.attributes.slug}`}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    <OptimizedImage
                      src={imageUrlSimilaire}
                      alt={recetteSimilaire.attributes.imagePrincipale?.data?.attributes?.alternativeText || recetteSimilaire.attributes.titre}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {recetteSimilaire.attributes.titre}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-700">
                        {recetteSimilaire.attributes.tempsPreparation && (
                          <span className="font-medium">⏱️ {recetteSimilaire.attributes.tempsPreparation} min</span>
                        )}
                        {recetteSimilaire.attributes.nombrePersonnes && (
                          <span className="font-medium">👥 {recetteSimilaire.attributes.nombrePersonnes}</span>
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

