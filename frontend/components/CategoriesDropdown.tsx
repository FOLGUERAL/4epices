'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Categorie } from '@/lib/strapi';
import CategoriesIcon from './CategoriesIcon';

interface CategoriesDropdownProps {
  categories: Categorie[];
}

export default function CategoriesDropdown({ categories }: CategoriesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-700 hover:text-orange-600 font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap text-sm sm:text-base duration-200"
      >
        <CategoriesIcon />
        <span className="hidden sm:inline">Catégories</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl py-2 transition-all duration-300 z-50 border border-gray-100 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        {categories.map((categorie) => (
          <Link
            key={categorie.id}
            href={`/categories/${categorie.attributes.slug}`}
            onClick={handleLinkClick}
            className="block px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-200 font-medium"
          >
            {categorie.attributes.nom}
          </Link>
        ))}
      </div>
    </div>
  );
}
