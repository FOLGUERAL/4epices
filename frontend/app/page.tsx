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
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-orange-300 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 text-white animate-slide-up">
              Des recettes simples, rapides et savoureuses
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl mb-8 text-orange-100 max-w-3xl mx-auto animate-slide-up">
              Découvrez une collection de recettes culinaires faciles à réaliser, 
              avec des ingrédients accessibles et des instructions claires.
            </p>
            <Link
              href="/#recettes"
              className="inline-block bg-white text-orange-600 font-bold px-8 sm:px-10 py-3 sm:py-4 rounded-full hover:bg-orange-50 transition-all shadow-2xl hover:shadow-3xl hover:-translate-y-1 duration-300 text-base sm:text-lg"
            >
              Voir les recettes
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* Section Recettes Populaires */}
        {recettesPopulaires.length > 0 && (
          <section className="mb-16 sm:mb-20 lg:mb-24 animate-fade-in" id="recettes">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Recettes populaires</h2>
                <p className="text-gray-600 font-medium">Les recettes les plus appréciées</p>
              </div>
              <Link
                href="/recettes"
                className="text-orange-600 hover:text-orange-700 font-semibold transition-colors duration-200 text-sm sm:text-base whitespace-nowrap flex items-center gap-2"
              >
                Voir tout <span className="text-lg">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
              {recettesPopulaires.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} />
              ))}
            </div>
          </section>
        )}

        {/* Section Recettes Récentes */}
        {recettesRecent.length > 0 && (
          <section className="mb-16 sm:mb-20 lg:mb-24 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Recettes récentes</h2>
                <p className="text-gray-600 font-medium">Les dernières recettes ajoutées</p>
              </div>
              <Link
                href="/recettes"
                className="text-orange-600 hover:text-orange-700 font-semibold transition-colors duration-200 text-sm sm:text-base whitespace-nowrap flex items-center gap-2"
              >
                Voir tout <span className="text-lg">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
              {recettesRecent.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} />
              ))}
            </div>
          </section>
        )}

        {/* Section Pourquoi 4épices ? */}
        <section className="bg-gradient-to-br from-gray-50 to-orange-50 rounded-3xl shadow-lg p-6 sm:p-8 md:p-12 lg:p-16 mb-16 sm:mb-20 lg:mb-24 border border-gray-100 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-10 sm:mb-12 text-center">
            Pourquoi 4épices ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            <div className="text-center group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <span className="text-4xl sm:text-5xl">⚡</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Rapide</h3>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                Des recettes conçues pour être réalisées rapidement, 
                sans compromettre le goût ni la qualité.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-accent-100 to-accent-200 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <span className="text-4xl sm:text-5xl">👨‍🍳</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Simple</h3>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                Des instructions claires et des ingrédients faciles à trouver, 
                pour tous les niveaux de cuisine.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-success-100 to-success-200 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <span className="text-4xl sm:text-5xl">😋</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Savoureux</h3>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                Des recettes testées et approuvées, garantissant des résultats 
                délicieux à chaque fois.
              </p>
            </div>
          </div>
        </section>

        {/* Section Toutes les recettes */}
        {toutesRecettes.length > 0 && (
          <section className="animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Toutes nos recettes</h2>
                <p className="text-gray-600 font-medium">Explorez notre collection complète</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
              {toutesRecettes.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} />
              ))}
            </div>
          </section>
        )}

        {toutesRecettes.length === 0 && (
          <div className="text-center py-16 sm:py-20">
            <p className="text-gray-500 text-lg sm:text-xl font-medium">Aucune recette disponible pour le moment.</p>
            <p className="text-gray-400 text-sm sm:text-base mt-2">Créez votre première recette dans Strapi !</p>
          </div>
        )}
      </main>
    </div>
  );
}

