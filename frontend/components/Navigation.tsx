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

