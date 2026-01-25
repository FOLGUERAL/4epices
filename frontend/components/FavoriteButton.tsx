'use client';

import { useState, useEffect } from 'react';
import { isFavorite, toggleFavorite as toggleFavoriteStorage } from '@/lib/favorites';
import { toast } from './Toast';

interface FavoriteButtonProps {
  recette: {
    id: number;
    slug: string;
    titre: string;
    imageUrl?: string;
  };
  className?: string;
}

export default function FavoriteButton({ recette, className = '' }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsFav(isFavorite(recette.id));
  }, [recette.id]);

  const handleToggle = () => {
    const newState = toggleFavoriteStorage(recette);
    setIsFav(newState);
    
    // Animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
    
    // Toast notification
    if (newState) {
      toast.success('Recette ajoutée aux favoris');
    } else {
      toast.success('Recette supprimée des favoris');
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all font-medium min-h-[42px] ${
        isFav
          ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } ${isAnimating ? 'scale-110' : ''} ${className}`}
      aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <svg
        className={`w-5 h-5 flex-shrink-0 transition-all ${isAnimating ? 'scale-125' : ''}`}
        fill={isFav ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span className="hidden sm:inline whitespace-nowrap">
        {isFav ? 'Favori' : 'Favoris'}
      </span>
    </button>
  );
}

