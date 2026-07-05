'use client';

import Link from 'next/link';
import type { Recette } from '@/lib/strapi';

type KitchenModeLinkProps = {
  recette: Recette;
  label?: string;
  className?: string;
};

export const getKitchenRecipeStorageKey = (slug: string) => `recipe_cuisine_${slug}`;

export default function KitchenModeLink({
  recette,
  label = 'Mode cuisine',
  className,
}: KitchenModeLinkProps) {
  const slug = recette.attributes.slug;

  const handleClick = () => {
    try {
      window.sessionStorage.setItem(getKitchenRecipeStorageKey(slug), JSON.stringify(recette));
    } catch {
      // Fallback API dans la page cuisine.
    }
  };

  return (
    <Link
      href={`/recettes/${slug}`}
      onClick={handleClick}
      className={
        className ||
        'flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium'
      }
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
