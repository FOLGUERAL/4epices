import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  getRecetteBySlug,
  getStrapiMediaUrl,
  getRecettesSimilairesWithFallback,
  getRecetteAggregateRating,
  extractRelationIds,
  Recette,
} from '@/lib/strapi';
import { resolveIngredientSlugAndNom } from '@/lib/ingredientDictionary';
import { buildRecipeJsonLd, buildFaqJsonLd, getSiteUrl, parseSeoEnrichi, SITE_NAME } from '@/lib/seo';
import RecipeEnrichedSections from '@/components/RecipeEnrichedSections';
import OptimizedImage from '@/components/OptimizedImage';
import IngredientsAdjuster from '@/components/IngredientsAdjuster';
import ShareRecipe from '@/components/ShareRecipe';
import FavoriteButton from '@/components/FavoriteButton';
import AddToShoppingListButton from '@/components/AddToShoppingListButton';
import RatingForm from '@/components/RatingForm';
import RatingList from '@/components/RatingList';
import Breadcrumbs from '@/components/Breadcrumbs';
import ShareToPinterestButton from '@/components/ShareToPinterestButton';
import GoogleAdSense from '@/components/GoogleAdSense';
import RecipeKitchenModeActions from '@/components/RecipeKitchenModeActions';

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

const RatingDisplay = dynamic(() => import('@/components/RatingDisplay'), {
  ssr: false,
});

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
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
      robots: { index: false, follow: false },
    };
  }

  const attrs = recette.attributes;
  const title = attrs.metaTitle || attrs.titre;
  const description =
    attrs.metaDescription ||
    attrs.description?.slice(0, 160) ||
    `Recette : ${attrs.titre}`;
  const canonicalPath = `/recettes/${attrs.slug}`;
  const imageUrl = attrs.imagePrincipale?.data?.attributes?.url
    ? getStrapiMediaUrl(attrs.imagePrincipale.data.attributes.url)
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: attrs.titre,
      description: attrs.metaDescription || attrs.description,
      url: canonicalPath,
      type: 'article',
      locale: 'fr_FR',
      siteName: SITE_NAME,
      ...(attrs.publishedAt ? { publishedTime: attrs.publishedAt } : {}),
      ...(attrs.updatedAt ? { modifiedTime: attrs.updatedAt } : {}),
      authors: [SITE_NAME],
      ...(imageUrl ? { images: [{ url: imageUrl, alt: attrs.titre }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: attrs.titre,
      description: attrs.metaDescription || attrs.description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function RecettePage({ params }: { params: { slug: string } }) {
  let recette = null;
  let recettesSimilaires: Recette[] = [];
  let aggregateRating: { ratingValue: number; reviewCount: number } | null = null;

  try {
    const response = await getRecetteBySlug(params.slug);
    recette = response.data;

    if (recette) {
      const [similaires, rating] = await Promise.all([
        getRecettesSimilairesWithFallback(
          recette.id,
          {
            categoryIds: extractRelationIds(recette.attributes.categories),
            tagIds: extractRelationIds(recette.attributes.tags),
          },
          4
        ),
        getRecetteAggregateRating(recette.id),
      ]);
      recettesSimilaires = similaires;
      aggregateRating = rating;
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
  const imageUrlForShare = imageUrl ? getStrapiMediaUrl(imageUrl) : undefined;

  // Gérer les deux formats d'ingrédients : tableau de strings ou tableau d'objets
  const rawIngredients = Array.isArray(recette.attributes.ingredients)
    ? recette.attributes.ingredients
    : [];
  
  // Normaliser les ingrédients pour l'affichage (version simplifiée)
  const normalizeIngredient = (ing: any): string => {
    if (typeof ing === 'string') {
      return ing.trim();
    }
    if (typeof ing === 'object' && ing !== null) {
      // Format structuré : {quantite, ingredient}
      const quantite = (ing.quantite || '').trim();
      const ingredient = (ing.ingredient || '').trim();
      return quantite ? `${quantite} ${ingredient}`.trim() : ingredient;
    }
    return String(ing).trim();
  };

  // Pour le structured data, convertir en tableau de strings
  const ingredientsForStructuredData = rawIngredients.map(normalizeIngredient);

  const tempsPrep = recette.attributes.tempsPreparation || 0;
  const tempsCuisson = recette.attributes.tempsCuisson || 0;
  const tempsTotal = tempsPrep + tempsCuisson;
  
  const siteUrl = getSiteUrl();
  const recetteUrl = `${siteUrl}/recettes/${recette.attributes.slug}`;

  const seoEnrichi = parseSeoEnrichi(recette.attributes.seoEnrichi);
  const rawIngredientPrincipal = recette.attributes.seoEnrichi?.ingredientPrincipal;
  const ingredientPrincipal =
    typeof rawIngredientPrincipal === 'string' && rawIngredientPrincipal.trim()
      ? rawIngredientPrincipal.trim()
      : null;
  const ingredientLink = ingredientPrincipal
    ? resolveIngredientSlugAndNom(ingredientPrincipal)
    : null;
  const faqJsonLd =
    seoEnrichi?.faq && seoEnrichi.faq.length >= 2
      ? buildFaqJsonLd(seoEnrichi.faq, recetteUrl)
      : null;

  const structuredData = buildRecipeJsonLd({
    name: recette.attributes.titre,
    description: recette.attributes.description,
    image: imageUrlForStructuredData.startsWith('http')
      ? imageUrlForStructuredData
      : `${siteUrl}${imageUrlForStructuredData}`,
    url: recetteUrl,
    datePublished: recette.attributes.publishedAt,
    dateModified: recette.attributes.updatedAt,
    prepMinutes: recette.attributes.tempsPreparation,
    cookMinutes: recette.attributes.tempsCuisson,
    yield: recette.attributes.nombrePersonnes,
    ingredients: ingredientsForStructuredData,
    etapesHtml: recette.attributes.etapes,
    categories:
      recette.attributes.categories?.data?.map((cat) => cat.attributes.nom).join(', ') ||
      undefined,
    keywords:
      recette.attributes.tags?.data?.map((tag) => tag.attributes.nom).join(', ') ||
      undefined,
    aggregateRating: aggregateRating ?? undefined,
  });

  return (
    <article className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumbs */}
        {(() => {
          const crumbs: { label: string; href?: string }[] = [
            { label: 'Accueil', href: '/' },
            { label: 'Recettes', href: '/recettes' },
          ];
          if (recette.attributes.categories?.data && recette.attributes.categories.data.length > 0) {
            const cat = recette.attributes.categories.data[0].attributes;
            crumbs.push({ label: cat.nom, href: `/categories/${cat.slug}` });
          }
          crumbs.push({ label: recette.attributes.titre });
          return <Breadcrumbs crumbs={crumbs} />;
        })()}

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
              <div className="flex flex-wrap items-center gap-2">
                <FavoriteButton
                  recette={{
                    id: recette.id,
                    slug: recette.attributes.slug,
                    titre: recette.attributes.titre,
                    imageUrl: imageUrlForShare,
                  }}
                />
                <ShareRecipe
                  title={recette.attributes.titre}
                  url={recetteUrl}
                  description={recette.attributes.description}
                  imageUrl={imageUrlForShare}
                />
                <ShareToPinterestButton
                  recetteId={recette.id}
                  recetteSlug={recette.attributes.slug}
                  recetteTitle={recette.attributes.titre}
                  recetteDescription={recette.attributes.description}
                  recetteImageUrl={imageUrlForShare}
                />
              </div>
            </div>

            <p className="text-xl text-gray-600 mb-6">
              {recette.attributes.description}
            </p>

            <RecipeKitchenModeActions recette={recette} />

            <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b">
              {tempsPrep > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Préparation</div>
                    <div className="font-semibold text-gray-900">{formatTime(tempsPrep)}</div>
                  </div>
                </div>
              )}
              {tempsCuisson > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Cuisson</div>
                    <div className="font-semibold text-gray-900">{formatTime(tempsCuisson)}</div>
                  </div>
                </div>
              )}
              {tempsTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Total</div>
                    <div className="font-semibold text-gray-900">{formatTime(tempsTotal)}</div>
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

            {rawIngredients.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Ingrédients</h2>
                  <AddToShoppingListButton ingredients={rawIngredients} recipeId={recette.id} />
                </div>
                <IngredientsAdjuster
                  ingredients={rawIngredients}
                  basePortions={recette.attributes.nombrePersonnes || 4}
                  recipeSlug={recette.attributes.slug}
                />
              </div>
            )}

            {/* Annonce Google AdSense entre ingrédients et préparation */}
            <div className="mb-8 flex justify-center">
              <GoogleAdSense
                adFormat="auto"
                className="min-h-[250px] w-full max-w-[728px]"
              />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Préparation</h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: recette.attributes.etapes }}
              />
            </div>

            {seoEnrichi && <RecipeEnrichedSections seoEnrichi={seoEnrichi} />}

            {/* Annonce Google AdSense après la préparation */}
            <div className="mb-8 flex justify-center">
              <GoogleAdSense
                adFormat="auto"
                className="min-h-[250px] w-full max-w-[728px]"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              {ingredientLink && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-500 mr-2">Ingrédient :</span>
                  <Link
                    href={`/ingredients/${ingredientLink.slug}`}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200 transition-colors capitalize"
                  >
                    {ingredientLink.nom}
                  </Link>
                </div>
              )}

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

            {/* Notes et avis */}
            <div className="mt-8 pt-8 border-t">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Notes et avis</h2>
                <RatingDisplay recetteId={recette.id} size="lg" />
              </div>
              
              <RatingForm
                recetteId={recette.id}
                recetteTitle={recette.attributes.titre}
              />
              
              <RatingList recetteId={recette.id} />
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
