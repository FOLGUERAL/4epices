import Link from 'next/link';
import Image from 'next/image';
import { BookHeart, ChefHat } from 'lucide-react';
import { getCategories, Categorie } from '@/lib/strapi';
import SearchBar from './SearchBar';
import WhiskIcon from './WhiskIcon';
import CategoriesDropdown from './CategoriesDropdown';
import { SITE_NAME } from '@/lib/seo';

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
              alt={SITE_NAME}
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
              className="hide-with-tabbar text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <ChefHat className="w-5 h-5" aria-hidden="true" />
              <span className="hidden sm:inline">Recettes</span>
            </Link>
            <Link
              href="/ingredients"
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <WhiskIcon />
              <span className="hidden sm:inline">Ingrédients</span>
            </Link>
            <Link
              href="/favoris"
              className="hide-with-tabbar text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <BookHeart className="w-5 h-5" aria-hidden="true" />
              <span className="hidden sm:inline">Mon carnet</span>
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
