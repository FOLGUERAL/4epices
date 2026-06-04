import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCategorieBySlug, getRecettesByCategory, Recette } from '@/lib/strapi';
import OptimizedImage from '@/components/OptimizedImage';

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
  
  try {
    const [categorieResponse, recettesResponse] = await Promise.all([
      getCategorieBySlug(params.slug),
      getRecettesByCategory(params.slug, { pageSize: 50 })
    ]);
    
    categorie = categorieResponse.data;
    recettes = recettesResponse.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
  }

  if (!categorie) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/categories" className="hover:text-gray-700">Catégories</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{categorie.attributes.nom}</span>
          </nav>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {categorie.attributes.nom}
          </h1>
          
          {categorie.attributes.description && (
            <p className="text-xl text-gray-600">
              {categorie.attributes.description}
            </p>
          )}
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
                    alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {recette.attributes.titre}
                    </h2>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {recette.attributes.description}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-700 mb-3">
                      {recette.attributes.tempsPreparation && (
                        <span className="font-medium">⏱️ {recette.attributes.tempsPreparation} min</span>
                      )}
                      {recette.attributes.nombrePersonnes && (
                        <span className="font-medium">👥 {recette.attributes.nombrePersonnes} pers.</span>
                      )}
                      {recette.attributes.difficulte && (
                        <span className="capitalize px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          {recette.attributes.difficulte}
                        </span>
                      )}
                    </div>
                    {recette.attributes.tags?.data && recette.attributes.tags.data.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {recette.attributes.tags.data.slice(0, 3).map((tag) => (
                          <Link
                            key={tag.id}
                            href={`/tags/${tag.attributes.slug}`}
                            className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs hover:bg-orange-100 transition-colors"
                          >
                            #{tag.attributes.nom}
                          </Link>
                        ))}
                        {recette.attributes.tags.data.length > 3 && (
                          <span className="px-2 py-0.5 text-gray-400 text-xs">
                            +{recette.attributes.tags.data.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucune recette dans cette catégorie pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

