'use client';

import { useState, useEffect } from 'react';
import { 
  addIngredientsToShoppingList, 
  removeIngredientsFromShoppingList,
  isRecipeInShoppingList 
} from '@/lib/shoppingList';
import { toast } from './Toast';

interface AddToShoppingListButtonProps {
  ingredients: any[];
  recipeId?: number;
}

export default function AddToShoppingListButton({ ingredients, recipeId }: AddToShoppingListButtonProps) {
  const [isInList, setIsInList] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Vérifier si la recette est déjà dans la liste
  useEffect(() => {
    if (!recipeId) {
      setIsInList(false);
      return;
    }
    
    const checkStatus = () => {
      setIsInList(isRecipeInShoppingList(recipeId));
    };
    
    checkStatus();
    
    // Écouter les changements de localStorage
    const handleStorageChange = () => {
      checkStatus();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Vérifier périodiquement (au cas où la liste change dans un autre onglet)
    const interval = setInterval(checkStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [recipeId]);

  const handleToggle = () => {
    setIsProcessing(true);
    
    if (isInList) {
      // Retirer les ingrédients
      removeIngredientsFromShoppingList(ingredients, recipeId);
      setIsInList(false);
      toast.success('Ingrédients retirés de la liste de courses');
    } else {
      // Ajouter les ingrédients
      addIngredientsToShoppingList(ingredients, recipeId);
      setIsInList(true);
      toast.success('Ingrédients ajoutés à la liste de courses');
    }
    
    setTimeout(() => setIsProcessing(false), 500);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        isInList
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isInList ? 'Retirer de la liste de courses' : 'Ajouter à la liste de courses'}
    >
      {isInList ? (
        <>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="text-sm font-medium">
            Retirer de la liste
          </span>
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <span className="text-sm font-medium">
            Liste de courses
          </span>
        </>
      )}
    </button>
  );
}

