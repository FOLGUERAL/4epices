import RecetteCardCompact from '@/components/RecetteCardCompact';
import { toCardRecipe, type CardRecipeSource } from '@/lib/recipeList';

interface RelatedRecipesProps {
  /** Recettes choisies à la main dans l'admin (relation recettesLiees) : prioritaires si renseignées */
  manual: CardRecipeSource[];
  /** Repli automatique (catégorie → tag → récentes), utilisé seulement si `manual` est vide */
  fallback: CardRecipeSource[];
  title?: string;
}

/**
 * Bloc « recettes liées », juste après les étapes : c'est là que les visiteurs sont le plus susceptibles de
 * cliquer avant de repartir. Utilise la sélection manuelle si elle existe (plus pertinente pour les pages à
 * fort trafic), sinon la suggestion automatique par catégorie/tag.
 */
export default function RelatedRecipes({ manual, fallback, title = 'Vous pourriez aussi aimer' }: RelatedRecipesProps) {
  const recipes = manual.length > 0 ? manual : fallback;
  if (recipes.length === 0) return null;

  return (
    <section aria-labelledby="related-recipes-title" className="my-10">
      <h2 id="related-recipes-title" className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {recipes.map((recette) => (
          <RecetteCardCompact key={recette.id} recette={toCardRecipe(recette)} umamiEvent="reco-click" />
        ))}
      </div>
    </section>
  );
}
