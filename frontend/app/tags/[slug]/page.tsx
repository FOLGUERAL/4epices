import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTagBySlug, getRecettesByTag, Recette } from '@/lib/strapi';
import OptimizedImage from '@/components/OptimizedImage';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  let tag = null;
  try {
    const response = await getTagBySlug(params.slug);
    tag = response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération du tag pour metadata:', error);
  }

  if (!tag) {
    return {
      title: 'Tag non trouvé',
    };
  }

  return {
    title: `${tag.attributes.nom} - 4épices`,
    description: `Découvrez toutes nos recettes avec le tag ${tag.attributes.nom}`,
  };
}

export default async function TagPage({ params }: { params: { slug: string } }) {
  let tag = null;
  let recettes: Recette[] = [];
  
  try {
    const [tagResponse, recettesResponse] = await Promise.all([
      getTagBySlug(params.slug),
      getRecettesByTag(params.slug, { pageSize: 50 })
    ]);
    
    tag = tagResponse.data;
    recettes = recettesResponse.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération du tag:', error);
  }

  if (!tag) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/" className="hover:text-gray-700">Tags</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{tag.attributes.nom}</span>
          </nav>
          
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🏷️</span>
            <h1 className="text-4xl font-bold text-gray-900">
              {tag.attributes.nom}
            </h1>
          </div>
          
          <p className="text-gray-600 text-lg">
            {recettes.length > 0 
              ? `${recettes.length} ${recettes.length === 1 ? 'recette trouvée' : 'recettes trouvées'} avec ce tag`
              : 'Aucune recette avec ce tag pour le moment'}
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
                    alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
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
                    {recette.attributes.categories?.data && recette.attributes.categories.data.length > 0 && (
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
              href="/"
              className="mt-4 inline-block text-orange-600 hover:text-orange-700 font-medium transition-colors"
            >
              ← Retour aux recettes
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

