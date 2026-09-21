'use client';

import { useEffect, useState } from 'react';
import { getShoppingCount, subscribeShoppingList } from '@/lib/shoppingList';

/** Le nombre d'articles restant à acheter, tenu à jour (pastille de l'onglet « Courses »). */
export function useShoppingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(getShoppingCount());
    update();
    return subscribeShoppingList(update);
  }, []);

  return count;
}
