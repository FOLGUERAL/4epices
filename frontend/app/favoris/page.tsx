'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFavorites, Favorite } from '@/lib/favorites';
import { getRecetteBySlug, Recette, getStrapiMediaUrl } from '@/lib/strapi';
import OptimizedImage from '@/components/OptimizedImage';
import FavoriteButton from '@/components/FavoriteButton';

export default function FavorisPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      const favs = getFavorites();
      setFavorites(favs);

      // Charger les recettes complètes
      const recettesData: Recette[] = [];
      for (const fav of favs) {
        try {
          const response = await getRecetteBySlug(fav.slug);
          if (response.data) {
            recettesData.push(response.data);
          }
        } catch (error) {
          console.error(`Erreur lors du chargement de ${fav.slug}:`, error);
        }
      }
      setRecettes(recettesData);
      setLoading(false);
    };

    loadFavorites();

    // Écouter les changements de localStorage
    const handleStorageChange = () => {
      loadFavorites();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Écouter les changements dans le même onglet
    const interval = setInterval(() => {
      const currentFavs = getFavorites();
      if (currentFavs.length !== favorites.length) {
        loadFavorites();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [favorites.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement de vos favoris...</p>
          </div>
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <nav className="text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-gray-700">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Mes favoris</span>
          </nav>

          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun favori</h2>
            <p className="text-gray-600 mb-6">
              Vous n'avez pas encore ajouté de recettes à vos favoris.
            </p>
            <Link
              href="/"
              className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Découvrir des recettes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">Accueil</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Mes favoris</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Mes favoris</h1>
          <p className="text-gray-600">
            {favorites.length} {favorites.length === 1 ? 'recette sauvegardée' : 'recettes sauvegardées'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recettes.map((recette) => {
            const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;
            const imageUrlForFavorite = imageUrl ? getStrapiMediaUrl(imageUrl) : undefined;

            return (
              <div
                key={recette.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group relative"
              >
                <Link
                  href={`/recettes/${recette.attributes.slug}`}
                  className="block"
                >
                  <div className="relative h-64">
                    <OptimizedImage
                      src={imageUrl}
                      alt={recette.attributes.imagePrincipale?.data?.attributes?.alternativeText || recette.attributes.titre}
                      fill
                      className="group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                      {recette.attributes.titre}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                      {recette.attributes.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      {recette.attributes.tempsPreparation && (
                        <span className="flex items-center gap-1 font-medium">
                          <span>⏱️</span>
                          <span>{recette.attributes.tempsPreparation} min</span>
                        </span>
                      )}
                      {recette.attributes.nombrePersonnes && (
                        <span className="flex items-center gap-1 font-medium">
                          <span>👥</span>
                          <span>{recette.attributes.nombrePersonnes} pers.</span>
                        </span>
                      )}
                      {recette.attributes.difficulte && (
                        <span className="capitalize px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          {recette.attributes.difficulte}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="absolute top-4 right-4 z-10">
                  <FavoriteButton
                    recette={{
                      id: recette.id,
                      slug: recette.attributes.slug,
                      titre: recette.attributes.titre,
                      imageUrl: imageUrlForFavorite,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

