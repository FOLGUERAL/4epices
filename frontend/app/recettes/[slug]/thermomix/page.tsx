import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRecetteBySlug, getStrapiMediaUrl } from '@/lib/strapi';
import { buildRecipeJsonLd, getSiteUrl, SITE_NAME } from '@/lib/seo';
import OptimizedImage from '@/components/OptimizedImage';
import RecipeMeta from '@/components/RecipeMeta';
import Breadcrumbs from '@/components/Breadcrumbs';

/** Vraie page seulement si la recette a été validée + a de vraies étapes Thermomix (jamais de page vide indexée). */
async function getValidatedRecette(slug: string) {
  const response = await getRecetteBySlug(slug);
  const recette = response.data;
  if (!recette) return null;
  const etapes = recette.attributes.etapesThermomix ?? [];
  if (!recette.attributes.compatibleThermomix || etapes.length === 0) return null;
  return recette;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  let recette = null;
  try {
    recette = await getValidatedRecette(params.slug);
  } catch (error) {
    console.error('Erreur lors de la récupération de la recette Thermomix pour metadata:', error);
  }

  if (!recette) {
    return { title: 'Recette non trouvée', robots: { index: false, follow: false } };
  }

  const attrs = recette.attributes;
  const title = `${attrs.titre} au Thermomix`;
  const description =
    attrs.introThermomix?.slice(0, 160) || `Recette de ${attrs.titre} adaptée au Thermomix.`;
  const canonicalPath = `/recettes/${attrs.slug}/thermomix`;
  const imageUrl = attrs.imagePrincipale?.data?.attributes?.url
    ? getStrapiMediaUrl(attrs.imagePrincipale.data.attributes.url)
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: 'article',
      locale: 'fr_FR',
      siteName: SITE_NAME,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function RecetteThermomixPage({ params }: { params: { slug: string } }) {
  let recette = null;
  try {
    recette = await getValidatedRecette(params.slug);
  } catch (error) {
    console.error('Erreur lors de la récupération de la recette Thermomix:', error);
  }

  if (!recette) {
    notFound();
  }

  const attrs = recette.attributes;
  const etapes = attrs.etapesThermomix ?? [];
  const imageUrl = attrs.imagePrincipale?.data?.attributes?.url || null;
  const imageUrlForStructuredData = imageUrl ? getStrapiMediaUrl(imageUrl) : '/placeholder-recipe.svg';

  const siteUrl = getSiteUrl();
  const recetteUrl = `${siteUrl}/recettes/${attrs.slug}/thermomix`;

  const rawIngredients = Array.isArray(attrs.ingredients) ? attrs.ingredients : [];
  const ingredientsForStructuredData = rawIngredients.map((ing: any) =>
    typeof ing === 'string' ? ing.trim() : [ing?.quantite, ing?.ingredient].filter(Boolean).join(' ').trim()
  );

  // Pas de HTML réel pour les étapes Thermomix : on reconstruit un HTML minimal pour buildRecipeJsonLd,
  // qui sait déjà en extraire des HowToStep (même logique que la page classique).
  const etapesHtmlForJsonLd = etapes
    .map((e) => {
      const details = [e.vitesse && `Vitesse ${e.vitesse}`, e.duree, e.temperature]
        .filter(Boolean)
        .join(', ');
      return `<p>${e.description}${details ? ` (${details})` : ''}</p>`;
    })
    .join('');

  const structuredData = buildRecipeJsonLd({
    name: `${attrs.titre} au Thermomix`,
    description: attrs.introThermomix || attrs.description,
    image: imageUrlForStructuredData.startsWith('http')
      ? imageUrlForStructuredData
      : `${siteUrl}${imageUrlForStructuredData}`,
    url: recetteUrl,
    datePublished: attrs.publishedAt,
    dateModified: attrs.updatedAt,
    prepMinutes: attrs.tempsPreparation,
    cookMinutes: attrs.tempsCuisson,
    yield: attrs.nombrePersonnes,
    ingredients: ingredientsForStructuredData,
    etapesHtml: etapesHtmlForJsonLd,
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Breadcrumbs
        crumbs={[
          { label: 'Recettes', href: '/recettes' },
          { label: attrs.titre, href: `/recettes/${attrs.slug}` },
          { label: 'Thermomix' },
        ]}
      />

      <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">{attrs.titre} au Thermomix</h1>

      <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
        <OptimizedImage
          src={imageUrl}
          alt={attrs.titre}
          fill
          disableAspectRatio
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>

      <RecipeMeta
        prepMinutes={attrs.tempsPreparation || 0}
        cookMinutes={attrs.tempsCuisson || 0}
        portions={attrs.nombrePersonnes}
        difficulty={attrs.difficulte}
      />

      {attrs.introThermomix && (
        <p className="my-6 text-gray-700">{attrs.introThermomix}</p>
      )}

      {rawIngredients.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Ingrédients</h2>
          <ul className="list-inside list-disc space-y-1 text-gray-700">
            {rawIngredients.map((ing: any, i: number) => (
              <li key={i}>
                {typeof ing === 'string' ? ing : [ing?.quantite, ing?.ingredient].filter(Boolean).join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Préparation au Thermomix</h2>
        <ol className="space-y-4">
          {etapes.map((etape, i) => {
            const badges = [
              etape.vitesse && `Vitesse ${etape.vitesse}`,
              etape.duree,
              etape.temperature,
              etape.sens === 'inverse' && 'Sens inverse',
            ].filter(Boolean) as string[];

            return (
              <li key={etape.id} className="rounded-lg border border-gray-200 p-4">
                <p className="mb-2 font-medium text-gray-900">
                  {i + 1}. {etape.description}
                </p>
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <Link
        href={`/recettes/${attrs.slug}`}
        className="text-orange-700 underline hover:text-orange-800"
      >
        Voir la version classique de cette recette
      </Link>
    </div>
  );
}
