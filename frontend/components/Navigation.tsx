import Link from 'next/link';
import Image from 'next/image';
import NavTabs from './NavTabs';
import SearchBar from './SearchBar';
import WhiskIcon from './WhiskIcon';
import { SITE_NAME } from '@/lib/seo';

// Les catégories ne sont plus dans cette barre : elles sont sur la page Recettes et en pied de page
export default function Navigation() {
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
            {/* Les mêmes onglets que la barre du bas : Recettes, Découvrir, Planning, Favoris */}
            <NavTabs />
            <Link
              href="/ingredients"
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1.5 duration-200"
            >
              <WhiskIcon />
              <span className="hidden sm:inline">Ingrédients</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
