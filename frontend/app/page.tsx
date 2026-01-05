export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getRecettes, getStrapiMediaUrl, Recette } from '@/lib/strapi';
import Image from 'next/image';

export default async function Home() {
  let recettes: Recette[] = [];
  try {
    const response = await getRecettes({ pageSize: 12 });
    recettes = response.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des recettes:', error);
    // En cas d'erreur, on continue avec un tableau vide
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">4épices</h1>
          <p className="text-gray-600 text-lg">Recettes culinaires délicieuses</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recettes?.map((recette) => {
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

        {!recettes || recettes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucune recette disponible pour le moment.</p>
            <p className="text-gray-400 text-sm mt-2">Créez votre première recette dans Strapi !</p>
          </div>
        )}
      </main>
    </div>
  );
}

