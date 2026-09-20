import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CategoryRail from '@/components/CategoryRail';
import RecipesFiltersClient from '@/components/RecipesFiltersClient';
import { getCategoryOptions, type CategoryOption } from '@/lib/recipeList';
import { getCategorieBySlug, getRecettes, Recette } from '@/lib/strapi';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  let categorie = null;
  try {
    const response = await getCategorieBySlug(params.slug);
    categorie = response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie pour metadata:', error);
  }

  if (!categorie) {
    return {
      title: 'Catégorie non trouvée',
    };
  }

  const nom = categorie.attributes.nom;
  const description =
    categorie.attributes.description ||
    `Découvrez toutes nos recettes de la catégorie ${nom} : idées faciles et gourmandes.`;

  return {
    title: `Recettes ${nom}`,
    description,
    alternates: {
      canonical: `/categories/${params.slug}`,
    },
    openGraph: {
      title: `Recettes ${nom}`,
      description,
      url: `/categories/${params.slug}`,
      type: 'website',
    },
  };
}

export default async function CategoriePage({ params }: { params: { slug: string } }) {
  let categorie = null;
  let recettes: Recette[] = [];
  let autresCategories: CategoryOption[] = [];

  try {
    // Le catalogue entier est mis en cache : toutes les pages catégorie partagent la même requête
    const [categorieResponse, toutesResponse] = await Promise.all([
      getCategorieBySlug(params.slug),
      getRecettes({ pageSize: 1000 }),
    ]);

    categorie = categorieResponse.data;
    const toutes = toutesResponse.data || [];
    recettes = toutes.filter((recette) =>
      recette.attributes.categories?.data?.some((category) => category.attributes.slug === params.slug)
    );
    autresCategories = getCategoryOptions(toutes).filter((option) => option.slug !== params.slug);
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
  }

  if (!categorie) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-6">
          <nav className="mb-4 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/recettes" className="hover:text-gray-700">Recettes</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{categorie.attributes.nom}</span>
          </nav>

          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{categorie.attributes.nom}</h1>

          {categorie.attributes.description && (
            <p className="mt-2 text-lg text-gray-600 sm:text-xl">{categorie.attributes.description}</p>
          )}
        </header>

        {recettes.length > 0 ? (
          <RecipesFiltersClient recettes={recettes} showCategoryChips={false} />
        ) : (
          <div className="py-12 text-center">
            <p className="text-lg text-gray-500">Aucune recette dans cette catégorie pour le moment.</p>
          </div>
        )}

        <div className="mt-10">
          <CategoryRail title="Autres catégories" options={autresCategories} />
        </div>
      </div>
    </div>
  );
}
