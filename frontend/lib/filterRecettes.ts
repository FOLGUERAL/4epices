import { Recette } from './strapi';
import { FilterState } from '@/components/RecipeFilters';

export function filterRecettes(recettes: Recette[], filters: FilterState): Recette[] {
  return recettes.filter((recette) => {
    // Filtre par catégorie
    if (filters.category) {
      const hasCategory = recette.attributes.categories?.data?.some(
        cat => cat.id.toString() === filters.category
      );
      if (!hasCategory) return false;
    }

    // Filtre par difficulté
    if (filters.difficulty) {
      if (recette.attributes.difficulte !== filters.difficulty) return false;
    }

    // Filtre par temps de préparation
    const tempsPrep = recette.attributes.tempsPreparation || 0;
    if (filters.minTime !== null && tempsPrep < filters.minTime) return false;
    if (filters.maxTime !== null && tempsPrep > filters.maxTime) return false;

    // Filtre par nombre de personnes
    const personnes = recette.attributes.nombrePersonnes || 0;
    if (filters.minPersons !== null && personnes < filters.minPersons) return false;
    if (filters.maxPersons !== null && personnes > filters.maxPersons) return false;

    // Filtre par tags
    if (filters.tags.length > 0) {
      const recetteTagIds = recette.attributes.tags?.data?.map(tag => tag.id) || [];
      const hasAllTags = filters.tags.every(tagId => recetteTagIds.includes(tagId));
      if (!hasAllTags) return false;
    }

    // Filtre par ingrédients (recherche dans le JSON des ingrédients)
    if (filters.searchIngredients.trim()) {
      const searchTerm = filters.searchIngredients.toLowerCase();
      const ingredients = recette.attributes.ingredients || [];
      
      // Convertir les ingrédients en string pour la recherche
      const ingredientsText = ingredients.map((ing: any) => {
        if (typeof ing === 'string') return ing.toLowerCase();
        if (typeof ing === 'object' && ing !== null) {
          return `${ing.quantite || ''} ${ing.ingredient || ''}`.toLowerCase();
        }
        return String(ing).toLowerCase();
      }).join(' ');
      
      if (!ingredientsText.includes(searchTerm)) return false;
    }

    return true;
  });
}

