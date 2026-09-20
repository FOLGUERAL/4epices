'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import RecipesFiltersClient from '@/components/RecipesFiltersClient';
import { getFavorites } from '@/lib/favorites';
import { getRecettesBySlugs, type Recette } from '@/lib/strapi';

export default function FavorisPage() {
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const loadFavorites = async () => {
      const favorites = getFavorites();
      if (favorites.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Quelques requêtes groupées : la liste de favoris peut être longue
        const data = await getRecettesBySlugs(favorites.map((favorite) => favorite.slug));
        const addedAt = new Map(favorites.map((favorite) => [favorite.slug, favorite.addedAt ?? '']));
        // Les derniers ajoutés d'abord
        setRecettes(
          [...data].sort((a, b) =>
            (addedAt.get(b.attributes.slug) ?? '').localeCompare(addedAt.get(a.attributes.slug) ?? '')
          )
        );
      } catch (error) {
        console.error('Erreur lors du chargement des favoris:', error);
        setFailed(true);
      }
      setLoading(false);
    };

    loadFavorites();
  }, []);

  const breadcrumb = (
    <nav className="mb-6 text-sm text-gray-500">
      <Link href="/" className="hover:text-gray-700">
        Accueil
      </Link>
      <span className="mx-2">/</span>
      <span className="text-gray-900">Favoris</span>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600">Chargement de vos favoris…</p>
          </div>
        </div>
      </div>
    );
  }

  if (failed || recettes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          {breadcrumb}
          <div className="rounded-2xl bg-white p-8 text-center shadow-md sm:p-12">
            <Heart className="mx-auto mb-4 h-16 w-16 text-gray-300" aria-hidden="true" />
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              {failed ? 'Impossible de charger vos favoris' : 'Aucun favori'}
            </h1>
            <p className="mb-6 text-gray-600">
              {failed
                ? 'Vérifiez votre connexion puis rechargez la page.'
                : 'Gardez des recettes en swipant, ou touchez le cœur sur une recette : elles apparaîtront ici.'}
            </p>
            <Link
              href="/decouvrir"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-600 px-6 font-bold text-white transition-colors hover:bg-orange-700"
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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {breadcrumb}

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Mes favoris</h1>
          <p className="mt-1 text-gray-600">Les recettes que vous avez gardées, sur cet appareil.</p>
        </div>

        <RecipesFiltersClient recettes={recettes} withPlanning={false} />
      </div>
    </div>
  );
}
