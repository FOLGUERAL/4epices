export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getRecettes, Recette } from '@/lib/strapi';
import RecetteCard from '@/components/RecetteCard';

export default async function Home() {
  let recettesPopulaires: Recette[] = [];
  let recettesRecent: Recette[] = [];
  let toutesRecettes: Recette[] = [];

  try {
    // Récupérer les recettes populaires et récentes
    // Pour l'instant, on utilise les plus récentes comme populaires
    // On pourrait améliorer avec un système de popularité basé sur les vues ou likes
    const toutesResponse = await getRecettes({ pageSize: 12 });
    const toutes = toutesResponse.data || [];
    
    // Les 3 premières sont les populaires
    recettesPopulaires = toutes.slice(0, 3);
    // Les 3 suivantes sont les récentes (ou on peut prendre les mêmes si moins de 6 recettes)
    recettesRecent = toutes.length > 3 ? toutes.slice(3, 6) : toutes.slice(0, 3);
    toutesRecettes = toutes;
  } catch (error) {
    console.error('Erreur lors de la récupération des recettes:', error);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Des recettes simples, rapides et savoureuses
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-orange-100 max-w-2xl mx-auto">
              Découvrez une collection de recettes culinaires faciles à réaliser, 
              avec des ingrédients accessibles et des instructions claires.
            </p>
            <Link
              href="/#recettes"
              className="inline-block bg-white text-orange-600 font-semibold px-8 py-4 rounded-lg hover:bg-orange-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Voir les recettes
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section Recettes Populaires */}
        {recettesPopulaires.length > 0 && (
          <section className="mb-16" id="recettes">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Recettes populaires</h2>
                <p className="text-gray-600">Les recettes les plus appréciées</p>
              </div>
              <Link
                href="/"
                className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recettesPopulaires.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} />
              ))}
            </div>
          </section>
        )}

        {/* Section Recettes Récentes */}
        {recettesRecent.length > 0 && (
          <section className="mb-16">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Recettes récentes</h2>
                <p className="text-gray-600">Les dernières recettes ajoutées</p>
              </div>
              <Link
                href="/"
                className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recettesRecent.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} />
              ))}
            </div>
          </section>
        )}

        {/* Section Pourquoi 4épices ? */}
        <section className="bg-white rounded-lg shadow-lg p-8 md:p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Pourquoi 4épices ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Rapide</h3>
              <p className="text-gray-600">
                Des recettes conçues pour être réalisées rapidement, 
                sans compromettre le goût ni la qualité.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👨‍🍳</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Simple</h3>
              <p className="text-gray-600">
                Des instructions claires et des ingrédients faciles à trouver, 
                pour tous les niveaux de cuisine.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">😋</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Savoureux</h3>
              <p className="text-gray-600">
                Des recettes testées et approuvées, garantissant des résultats 
                délicieux à chaque fois.
              </p>
            </div>
          </div>
        </section>

        {/* Section Toutes les recettes */}
        {toutesRecettes.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Toutes nos recettes</h2>
                <p className="text-gray-600">Explorez notre collection complète</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {toutesRecettes.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} />
              ))}
            </div>
          </section>
        )}

        {toutesRecettes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucune recette disponible pour le moment.</p>
            <p className="text-gray-400 text-sm mt-2">Créez votre première recette dans Strapi !</p>
          </div>
        )}
      </main>
    </div>
  );
}

