'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Recette } from '@/lib/strapi';
import RecetteCard from './RecetteCard';

interface HorizontalCarouselProps {
  title: string;
  subtitle?: string;
  recettes: Recette[];
  seeAllLink?: string;
  className?: string;
}

export default function HorizontalCarousel({
  title,
  subtitle,
  recettes,
  seeAllLink,
  className = '',
}: HorizontalCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftButton, setShowLeftButton] = useState(false);
  const [showRightButton, setShowRightButton] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const threshold = 5; // Tolérance pour éviter les problèmes de précision
    
    setShowLeftButton(scrollLeft > threshold);
    setShowRightButton(scrollLeft < scrollWidth - clientWidth - threshold);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      // Utiliser 'scrollend' si disponible, sinon 'scroll' avec debounce
      let scrollTimeout: NodeJS.Timeout;
      const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(checkScrollButtons, 50);
      };

      container.addEventListener('scroll', handleScroll, { passive: true });
      container.addEventListener('scrollend', checkScrollButtons, { passive: true });
      window.addEventListener('resize', checkScrollButtons);
      
      return () => {
        clearTimeout(scrollTimeout);
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('scrollend', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, [recettes]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    // Sur mobile, scroller d'une carte complète, sur desktop 80% de l'écran
    const scrollAmount = isMobile ? container.clientWidth * 0.9 : container.clientWidth * 0.8;
    const newScrollLeft = 
      direction === 'right' 
        ? container.scrollLeft + scrollAmount
        : container.scrollLeft - scrollAmount;
    
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });
  };

  if (recettes.length === 0) {
    return null;
  }

  return (
    <section className={`mb-12 ${className}`}>
      <div className="flex items-center justify-between mb-6 px-4 sm:px-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{title}</h2>
          {subtitle && (
            <p className="text-sm sm:text-base text-gray-600">{subtitle}</p>
          )}
        </div>
        {seeAllLink && (
          <Link
            href={seeAllLink}
            className="text-orange-600 hover:text-orange-700 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 text-sm sm:text-base"
          >
            <span className="hidden sm:inline">Voir tout</span>
            <span className="text-lg">→</span>
          </Link>
        )}
      </div>

      <div className="relative group">
        {/* Bouton gauche - visible sur desktop au hover, toujours visible sur mobile si nécessaire */}
        {showLeftButton && !isMobile && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-r from-white to-transparent flex items-center justify-start pl-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto"
            aria-label="Défiler vers la gauche"
          >
            <div className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors pointer-events-auto">
              <svg
                className="w-6 h-6 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </div>
          </button>
        )}

        {/* Bouton droit - visible sur desktop au hover, toujours visible sur mobile si nécessaire */}
        {showRightButton && !isMobile && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-l from-white to-transparent flex items-center justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto"
            aria-label="Défiler vers la droite"
          >
            <div className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors pointer-events-auto">
              <svg
                className="w-6 h-6 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        )}

        {/* Container scrollable - améliorations mobile */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto scroll-smooth pb-4 px-4 sm:px-0 -mx-4 sm:mx-0 snap-x snap-mandatory"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch', // Momentum scrolling sur iOS
          }}
        >
          {recettes.map((recette) => (
            <div
              key={recette.id}
              className="flex-shrink-0 snap-start snap-always w-[85vw] sm:w-80 md:w-96"
            >
              <RecetteCard recette={recette} />
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
          height: 0;
        }
        /* Améliorer le momentum scrolling sur iOS */
        .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </section>
  );
}

