import { notFound } from 'next/navigation';
import { getRecetteBySlug, getStrapiMediaUrl } from '@/lib/strapi';
import Image from 'next/image';

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
  try {
    const response = await getRecetteBySlug(params.slug);
    recette = response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération de la recette:', error);
  }

  if (!recette) {
    notFound();
  }

  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url
    ? getStrapiMediaUrl(recette.attributes.imagePrincipale.data.attributes.url)
    : '/placeholder.jpg';

  const ingredients = Array.isArray(recette.attributes.ingredients)
    ? recette.attributes.ingredients
    : [];

  return (
    <article className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="relative h-96 w-full">
            <Image
              src={imageUrl}
              alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
              fill
              className="object-cover"
            />
          </div>

          <div className="p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {recette.attributes.titre}
            </h1>

            <p className="text-xl text-gray-600 mb-6">
              {recette.attributes.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b">
              {recette.attributes.tempsPreparation && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <div className="text-sm text-gray-500">Préparation</div>
                    <div className="font-semibold">{recette.attributes.tempsPreparation} min</div>
                  </div>
                </div>
              )}
              {recette.attributes.tempsCuisson && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <div className="text-sm text-gray-500">Cuisson</div>
                    <div className="font-semibold">{recette.attributes.tempsCuisson} min</div>
                  </div>
                </div>
              )}
              {recette.attributes.nombrePersonnes && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👥</span>
                  <div>
                    <div className="text-sm text-gray-500">Portions</div>
                    <div className="font-semibold">{recette.attributes.nombrePersonnes}</div>
                  </div>
                </div>
              )}
              {recette.attributes.difficulte && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <div>
                    <div className="text-sm text-gray-500">Difficulté</div>
                    <div className="font-semibold capitalize">{recette.attributes.difficulte}</div>
                  </div>
                </div>
              )}
            </div>

            {ingredients.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingrédients</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {ingredients.map((ingredient: string, index: number) => (
                    <li key={index}>{ingredient}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Préparation</h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: recette.attributes.etapes }}
              />
            </div>

            {recette.attributes.categories?.data && recette.attributes.categories.data.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recette.attributes.categories.data.map((categorie) => (
                  <span
                    key={categorie.id}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm"
                  >
                    {categorie.attributes.nom}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

