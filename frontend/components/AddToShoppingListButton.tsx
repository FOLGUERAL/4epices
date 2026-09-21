'use client';

import { useEffect, useState } from 'react';
import { Check, ShoppingBasket } from 'lucide-react';
import {
  addIngredientsToShoppingList,
  getPortionsScale,
  isRecipeInShoppingList,
  removeRecipeFromShoppingList,
  subscribeShoppingList,
} from '@/lib/shoppingList';
import { toast } from './Toast';

interface AddToShoppingListButtonProps {
  ingredients: unknown[];
  recipeId?: number;
  recipeTitle?: string;
  /** Sert à retrouver le nombre de personnes choisi sur la page (« pour 6 personnes ») */
  slug?: string;
  basePortions?: number;
}

/** Bouton de la barre d'actions de la recette : icône seule sur mobile, avec texte à partir de sm. */
export default function AddToShoppingListButton({
  ingredients,
  recipeId,
  recipeTitle,
  slug,
  basePortions = 4,
}: AddToShoppingListButtonProps) {
  const [isInList, setIsInList] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // La liste peut changer depuis un autre bouton de la page, ou un autre onglet
  useEffect(() => {
    if (!recipeId) {
      setIsInList(false);
      return;
    }

    const checkStatus = () => setIsInList(isRecipeInShoppingList(recipeId));
    checkStatus();
    return subscribeShoppingList(checkStatus);
  }, [recipeId]);

  const handleToggle = () => {
    setIsProcessing(true);

    if (isInList && recipeId) {
      removeRecipeFromShoppingList(recipeId);
      setIsInList(false);
      toast.success('Ingrédients retirés de la liste de courses');
    } else {
      // Les quantités suivent le nombre de personnes choisi sur la page de la recette
      const scale = slug ? getPortionsScale(slug, basePortions) : 1;
      addIngredientsToShoppingList(ingredients, recipeId, { recipeTitle, scale });
      setIsInList(true);
      toast.success(
        scale !== 1
          ? `Ingrédients ajoutés à la liste de courses, pour ${Math.round(basePortions * scale)} personnes`
          : 'Ingrédients ajoutés à la liste de courses'
      );
    }

    setTimeout(() => setIsProcessing(false), 500);
  };

  const Icon = isInList ? Check : ShoppingBasket;
  const label = isInList ? 'Dans la liste' : 'Courses';

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isProcessing}
      aria-label={isInList ? 'Retirer les ingrédients de la liste de courses' : 'Ajouter les ingrédients à la liste de courses'}
      title={isInList ? 'Retirer de la liste de courses' : 'Ajouter les ingrédients à la liste de courses'}
      className={`inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        isInList
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
