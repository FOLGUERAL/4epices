'use client';

import { useState } from 'react';
import { addIngredientsToShoppingList } from '@/lib/shoppingList';
import { toast } from './Toast';

interface AddToShoppingListButtonProps {
  ingredients: any[];
}

export default function AddToShoppingListButton({ ingredients }: AddToShoppingListButtonProps) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    const newItems = addIngredientsToShoppingList(ingredients);
    const addedCount = newItems.length;
    setAdded(true);
    toast.success(`${addedCount} ingrédient${addedCount > 1 ? 's' : ''} ajouté${addedCount > 1 ? 's' : ''} à la liste de courses`);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      onClick={handleAdd}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        added
          ? 'bg-green-100 text-green-700'
          : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
      }`}
      title="Ajouter à la liste de courses"
    >
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
        {added ? 'Ajouté !' : 'Liste de courses'}
      </span>
    </button>
  );
}

