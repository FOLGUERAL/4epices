/**
 * Gestion de la liste de courses
 */

export interface ShoppingListItem {
  id: string;
  ingredient: string;
  checked: boolean;
  quantity?: string;
}

const SHOPPING_LIST_KEY = '4epices_shopping_list';

export function getShoppingList(): ShoppingListItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(SHOPPING_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste de courses:', error);
    return [];
  }
}

export function saveShoppingList(items: ShoppingListItem[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la liste de courses:', error);
  }
}

export function addIngredientsToShoppingList(ingredients: any[]): ShoppingListItem[] {
  const currentList = getShoppingList();
  const newItems: ShoppingListItem[] = [];

  ingredients.forEach((ing) => {
    let ingredientText = '';
    let quantity = '';

    if (typeof ing === 'string') {
      ingredientText = ing;
    } else if (typeof ing === 'object' && ing !== null) {
      quantity = ing.quantite || '';
      const ingredient = ing.ingredient || '';
      ingredientText = quantity ? `${quantity} ${ingredient}`.trim() : ingredient;
    } else {
      ingredientText = String(ing);
    }

    // Extraire la quantité et l'ingrédient
    const match = ingredientText.match(/^([\d\s\/\.]+[a-z]*)\s+(.+)$/i);
    if (match) {
      quantity = match[1].trim();
      ingredientText = match[2].trim();
    }

    // Vérifier si l'ingrédient existe déjà
    const existingItem = currentList.find(
      item => item.ingredient.toLowerCase() === ingredientText.toLowerCase()
    );

    if (!existingItem) {
      newItems.push({
        id: `${Date.now()}-${Math.random()}`,
        ingredient: ingredientText,
        quantity: quantity || undefined,
        checked: false,
      });
    }
  });

  const updatedList = [...currentList, ...newItems];
  saveShoppingList(updatedList);
  return updatedList;
}

export function toggleShoppingListItem(id: string): ShoppingListItem[] {
  const list = getShoppingList();
  const updated = list.map(item =>
    item.id === id ? { ...item, checked: !item.checked } : item
  );
  saveShoppingList(updated);
  return updated;
}

export function removeShoppingListItem(id: string): ShoppingListItem[] {
  const list = getShoppingList();
  const updated = list.filter(item => item.id !== id);
  saveShoppingList(updated);
  return updated;
}

export function clearShoppingList(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SHOPPING_LIST_KEY);
}

