import Link from 'next/link';
import WhiskIcon from '@/components/WhiskIcon';
import { getAllIngredients, MIN_RECIPES_FOR_INDEX } from '@/lib/ingredients';

const POPULAR_COUNT = 8;

/**
 * Entrée vers le mélangeur d'ingrédients, sur la page Recettes : « Cuisiner avec ce que j'ai ».
 * Les ingrédients les plus utilisés sont des liens vers leurs fiches (indexables).
 */
export default async function IngredientEntry() {
  let popular: Awaited<ReturnType<typeof getAllIngredients>> = [];
  try {
    const ingredients = await getAllIngredients();
    popular = ingredients.filter((ingredient) => ingredient.recetteCount >= MIN_RECIPES_FOR_INDEX).slice(0, POPULAR_COUNT);
  } catch (error) {
    console.error('Erreur lors de la récupération des ingrédients populaires:', error);
  }

  return (
    <section
      aria-label="Cuisiner avec ce que j'ai"
      className="mb-8 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <WhiskIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-orange-600" strokeWidth={1.75} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cuisiner avec ce que j&apos;ai</h2>
            <p className="text-sm text-gray-600">Choisissez vos ingrédients, on trouve les recettes.</p>
          </div>
        </div>
        <Link
          href="/ingredients"
          data-umami-event="ingredients-entry-recettes"
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
        >
          Essayer le fouet magique
        </Link>
      </div>

      {popular.length > 0 && (
        <ul aria-label="Ingrédients les plus utilisés" className="mt-3 flex flex-wrap gap-2">
          {popular.map((ingredient) => (
            <li key={ingredient.slug}>
              <Link
                href={`/ingredients/${ingredient.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-orange-200 bg-white px-4 text-sm font-medium capitalize text-gray-800 transition-colors hover:bg-orange-50 hover:text-orange-700"
              >
                {ingredient.nom}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
