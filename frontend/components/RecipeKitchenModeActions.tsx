'use client';

import { ChefHat } from 'lucide-react';
import { useEffect, useState } from 'react';
import KitchenModeLink from '@/components/KitchenModeLink';
import type { Recette } from '@/lib/strapi';

type RecipeKitchenModeActionsProps = {
  recette: Recette;
};

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function RecipeKitchenModeActions({ recette }: RecipeKitchenModeActionsProps) {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandaloneState = () => setIsStandalone(isStandaloneDisplay());

    updateStandaloneState();
    mediaQuery.addEventListener('change', updateStandaloneState);

    return () => mediaQuery.removeEventListener('change', updateStandaloneState);
  }, []);

  return (
    <>
      <section className="mb-8 rounded-2xl border border-orange-100 bg-orange-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white">
              <ChefHat className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-gray-950">Cuisiner cette recette pas a pas</h2>
              <p className="mt-1 text-gray-700">
                Lancez le Mode Cuisine pour suivre les etapes avec guidage visuel, voix et commandes mains libres.
              </p>
              {isStandalone && (
                <p className="mt-2 text-sm font-semibold text-orange-800">
                  App installee : l'interface est optimisee pour cuisiner en plein ecran.
                </p>
              )}
            </div>
          </div>

          <KitchenModeLink
            recette={recette}
            label="Lancer le Mode Cuisine"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
          />
        </div>
      </section>

      <div className="fixed bottom-4 right-20 z-30 print:hidden sm:bottom-6 sm:right-24">
        <KitchenModeLink
          recette={recette}
          label="Mode Cuisine"
          className="inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-full bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/20 transition-colors hover:bg-orange-700 focus-ring"
        />
      </div>
    </>
  );
}
