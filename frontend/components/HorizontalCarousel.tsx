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

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    setShowLeftButton(scrollLeft > 0);
    setShowRightButton(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, [recettes]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">{title}</h2>
          {subtitle && (
            <p className="text-gray-600">{subtitle}</p>
          )}
        </div>
        {seeAllLink && (
          <Link
            href={seeAllLink}
            className="text-orange-600 hover:text-orange-700 font-semibold transition-colors whitespace-nowrap flex items-center gap-2"
          >
            Voir tout <span className="text-lg">→</span>
          </Link>
        )}
      </div>

      <div className="relative group">
        {/* Bouton gauche */}
        {showLeftButton && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-r from-white to-transparent flex items-center justify-start pl-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Défiler vers la gauche"
          >
            <div className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors">
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

        {/* Bouton droit */}
        {showRightButton && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-l from-white to-transparent flex items-center justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Défiler vers la droite"
          >
            <div className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors">
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

        {/* Container scrollable */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto scroll-smooth pb-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {recettes.map((recette) => (
            <div
              key={recette.id}
              className="flex-shrink-0 w-80 sm:w-96"
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
      `}</style>
    </section>
  );
}

