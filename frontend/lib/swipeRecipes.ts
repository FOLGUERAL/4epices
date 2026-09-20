import { fetchAllPublishedRecettes, getRecipeHubSources } from '@/lib/ingredients';
import type { SwipeRecipe } from '@/lib/swipeEngine';

// Comme sur l'accueil, les recettes de base ne sont pas des idées de repas
const EXCLUDED_CATEGORY_SLUG = 'bases-de-cuisine';
const MAX_DESCRIPTION_LENGTH = 140;

function truncate(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Cartes légères de toutes les recettes publiées (serveur uniquement). */
export async function getSwipeRecipes(): Promise<SwipeRecipe[]> {
  const recettes = await fetchAllPublishedRecettes();

  return recettes
    .filter(
      (recette) =>
        !recette.attributes.categories?.data?.some((cat) => cat.attributes.slug === EXCLUDED_CATEGORY_SLUG)
    )
    .map((recette) => {
      const { titre, slug, description, tempsPreparation, tempsCuisson, difficulte, imagePrincipale, categories } =
        recette.attributes;
      const image = imagePrincipale?.data?.attributes;

      return {
        id: recette.id,
        slug,
        titre,
        description: truncate(description || '', MAX_DESCRIPTION_LENGTH),
        imageUrl: image?.url ?? null,
        imageAlt: image?.alternativeText || titre,
        totalMinutes: (tempsPreparation || 0) + (tempsCuisson || 0),
        difficulte,
        categorySlugs: (categories?.data || []).map((cat) => cat.attributes.slug),
        ingredientSlugs: getRecipeHubSources(recette).map((source) => source.slug),
      };
    });
}
