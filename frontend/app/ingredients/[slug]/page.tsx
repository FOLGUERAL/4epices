import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getIngredientBySlug,
  getRecetteCountByIngredient,
  buildIngredientMetaTitle,
  buildIngredientMetaDescription,
  buildIngredientHeading,
  buildIngredientStats,
  buildIngredientSummary,
  getRelatedIngredients,
  MIN_RECIPES_FOR_INDEX,
} from '@/lib/ingredients';
import { buildBreadcrumbJsonLd, buildItemListJsonLd, getSiteUrl, SITE_NAME } from '@/lib/seo';
import RecipesFiltersClient from '@/components/RecipesFiltersClient';
import WhiskIcon from '@/components/WhiskIcon';

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
  const stats = buildIngredientStats(ingredient.recettes);
  const title = buildIngredientMetaTitle(nom, recetteCount);
  const description = buildIngredientMetaDescription(nom, recetteCount, stats.quickCount);
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
      siteName: SITE_NAME,
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
  const stats = buildIngredientStats(recettes);
  const summary = buildIngredientSummary(nom, stats);
  const relatedIngredients = await getRelatedIngredients(params.slug).catch(() => []);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Accueil', url: siteUrl },
    { name: 'Ingrédients', url: `${siteUrl}/ingredients` },
    { name: nom, url: pageUrl },
  ]);

  const itemListJsonLd = buildItemListJsonLd(
    recettes.map((r) => ({
      name: r.attributes.titre,
      url: `${siteUrl}/recettes/${r.attributes.slug}`,
    })),
    pageUrl
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8">
          <nav className="mb-4 text-sm text-gray-500" aria-label="Fil d'Ariane">
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
            <span className="capitalize text-gray-900">{nom}</span>
          </nav>

          <h1 className="mb-4 text-3xl font-bold capitalize text-gray-900 sm:text-4xl">
            {buildIngredientHeading(nom)}
          </h1>

          <p className="mb-3 text-lg text-gray-600 sm:text-xl">{summary}</p>

          {stats.categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">À retrouver en :</span>
              {stats.categories.slice(0, 5).map((categorie) => (
                <Link
                  key={categorie.slug}
                  href={`/categories/${categorie.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-4 text-gray-700 transition-colors hover:border-orange-200 hover:bg-orange-50"
                >
                  {categorie.nom}
                </Link>
              ))}
            </div>
          )}

          <Link
            href={`/ingredients?mix=${params.slug}`}
            data-umami-event="ingredient-hub-combine"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
          >
            <WhiskIcon className="h-5 w-5" strokeWidth={2} />
            Combiner avec un autre ingrédient
          </Link>
        </div>

        {recettes.length > 0 ? (
          <RecipesFiltersClient recettes={recettes} showCategoryChips={false} />
        ) : (
          <div className="py-12 text-center">
            <p className="text-lg text-gray-500">Aucune recette pour cet ingrédient pour le moment.</p>
            <Link
              href="/ingredients"
              className="mt-4 inline-block font-medium text-orange-600 transition-colors hover:text-orange-700"
            >
              ← Voir tous les ingrédients
            </Link>
          </div>
        )}

        {relatedIngredients.length > 0 && (
          <section className="mt-12" aria-labelledby="related-ingredients">
            <h2 id="related-ingredients" className="mb-4 text-2xl font-bold capitalize text-gray-900">
              Se cuisine aussi avec
            </h2>
            <div className="flex flex-wrap gap-3">
              {relatedIngredients.map((related) => (
                <Link
                  key={related.slug}
                  href={`/ingredients/${related.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-gray-100 bg-white px-4 capitalize text-gray-800 shadow-sm transition hover:text-orange-700 hover:shadow-md"
                >
                  {related.nom}
                  <span className="ml-2 text-xs tabular-nums text-gray-400">{related.recetteCount}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
