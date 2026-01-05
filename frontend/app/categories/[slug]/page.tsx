import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCategorieBySlug, getRecettesByCategory, getStrapiMediaUrl, Recette } from '@/lib/strapi';
import Image from 'next/image';

export async function generateMetadata({ params }: { params: { slug: string } }) {
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

  return {
    title: `${categorie.attributes.nom} - 4épices`,
    description: categorie.attributes.description || `Découvrez toutes nos recettes de la catégorie ${categorie.attributes.nom}`,
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recettes.map((recette) => {
              const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url
                ? getStrapiMediaUrl(recette.attributes.imagePrincipale.data.attributes.url)
                : '/placeholder.jpg';

              return (
                <Link
                  key={recette.id}
                  href={`/recettes/${recette.attributes.slug}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="relative h-64 w-full">
                    <Image
                      src={imageUrl}
                      alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {recette.attributes.titre}
                    </h2>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {recette.attributes.description}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                      {recette.attributes.tempsPreparation && (
                        <span>⏱️ {recette.attributes.tempsPreparation} min</span>
                      )}
                      {recette.attributes.nombrePersonnes && (
                        <span>👥 {recette.attributes.nombrePersonnes} pers.</span>
                      )}
                      {recette.attributes.difficulte && (
                        <span className="capitalize">{recette.attributes.difficulte}</span>
                      )}
                    </div>
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

