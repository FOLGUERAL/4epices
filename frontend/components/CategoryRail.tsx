import Link from 'next/link';
import OptimizedImage from '@/components/OptimizedImage';
import type { CategoryOption } from '@/lib/recipeList';

interface CategoryRailProps {
  title: string;
  options: CategoryOption[];
}

/**
 * Les catégories en cartes cliquables (image de leur recette la plus récente, nombre de recettes).
 * Ce sont de vrais liens vers les pages catégorie : ils restent visibles pour les moteurs de recherche.
 * Défilement horizontal sur mobile, grille sur grand écran.
 */
export default function CategoryRail({ title, options }: CategoryRailProps) {
  if (options.length === 0) return null;

  return (
    <section aria-label={title} className="mb-8">
      <h2 className="mb-3 text-xl font-bold text-gray-900">{title}</h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {options.map(({ slug, nom, count, imageUrl }) => (
          <li key={slug} className="w-40 flex-shrink-0 sm:w-44 lg:w-auto">
            <Link
              href={`/categories/${slug}`}
              className="group focus-ring relative block aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-orange-100 to-amber-200 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              {imageUrl && (
                <>
                  <OptimizedImage
                    src={imageUrl}
                    alt=""
                    fill
                    disableAspectRatio
                    sizes="(max-width: 1024px) 176px, 20vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden="true" />
                </>
              )}
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className={`block text-base font-bold leading-tight ${imageUrl ? 'text-white' : 'text-gray-900'}`}>
                  {nom}
                </span>
                <span className={`block text-xs tabular-nums ${imageUrl ? 'text-white/85' : 'text-gray-700'}`}>
                  {count} {count === 1 ? 'recette' : 'recettes'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
