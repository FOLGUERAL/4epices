import Link from 'next/link';
import { searchRecettes, Recette } from '@/lib/strapi';
import OptimizedImage from '@/components/OptimizedImage';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: { q?: string };
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const query = searchParams.q || '';
  
  if (query) {
    return {
      title: `Recherche: ${query} - 4épices`,
      description: `Résultats de recherche pour "${query}"`,
    };
  }
  
  return {
    title: 'Recherche - 4épices',
    description: 'Recherchez une recette',
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || '';
  let recettes: Recette[] = [];
  let total = 0;

  if (query.trim()) {
    try {
      const response = await searchRecettes(query, { pageSize: 50 });
      recettes = response.data || [];
      total = response.meta?.pagination?.total || 0;
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {query ? `Résultats de recherche pour "${query}"` : 'Recherche'}
          </h1>
          
          {query && (
            <p className="text-gray-600">
              {total > 0 ? (
                <span>{total} {total === 1 ? 'recette trouvée' : 'recettes trouvées'}</span>
              ) : (
                <span>Aucune recette trouvée</span>
              )}
            </p>
          )}
          
          {!query && (
            <p className="text-gray-600">
              Utilisez la barre de recherche pour trouver une recette.
            </p>
          )}
        </div>

        {query && recettes.length > 0 ? (
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
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-700">
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recette.attributes.categories?.data && recette.attributes.categories.data.length > 0 && (
                        <>
                          {recette.attributes.categories.data.map((categorie) => (
                            <Link
                              key={categorie.id}
                              href={`/categories/${categorie.attributes.slug}`}
                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
                            >
                              {categorie.attributes.nom}
                            </Link>
                          ))}
                        </>
                      )}
                      {recette.attributes.tags?.data && recette.attributes.tags.data.length > 0 && (
                        <>
                          {recette.attributes.tags.data.map((tag) => (
                            <Link
                              key={tag.id}
                              href={`/tags/${tag.attributes.slug}`}
                              className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-xs hover:bg-orange-200 transition-colors"
                            >
                              #{tag.attributes.nom}
                            </Link>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : query && recettes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">
              Aucune recette ne correspond à votre recherche "{query}".
            </p>
            <p className="text-gray-400 text-sm">
              Essayez avec d'autres mots-clés ou consultez nos catégories.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

