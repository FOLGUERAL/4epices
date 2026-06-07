import Link from 'next/link';
import Image from 'next/image';
import { getCategories, Categorie } from '@/lib/strapi';
import SearchBar from './SearchBar';
import WhiskIcon from './WhiskIcon';
import CategoriesDropdown from './CategoriesDropdown';

export default async function Navigation() {
  let categories: Categorie[] = [];
  try {
    const response = await getCategories();
    categories = response.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2 sm:gap-4">
          <Link href="/" className="flex items-center h-16 hover:opacity-80 transition-opacity flex-shrink-0 group">
            <Image
              src="/logo.png"
              alt="4épices"
              width={120}
              height={40}
              className="h-8 sm:h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200"
              priority
            />
          </Link>
          
          <SearchBar />

          <div className="flex items-center gap-2 sm:gap-5 lg:gap-8 flex-shrink-0">
            <Link 
              href="/recettes" 
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <WhiskIcon />
              <span className="hidden sm:inline">Recettes</span>
            </Link>
            <Link
              href="/ingredients"
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <span className="hidden sm:inline">Ingrédients</span>
            </Link>
            <Link 
              href="/favoris" 
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="hidden sm:inline">Favoris</span>
            </Link>
            
            {categories.length > 0 && (
              <CategoriesDropdown categories={categories} />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

