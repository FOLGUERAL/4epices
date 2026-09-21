/**
 * Ajout à la liste de courses des repas prévus au planning.
 * Partagé par la page du planning (« Ajouter les courses ») et par la page Courses.
 */

import { getShoppingEntries, getUpcomingEntries } from '@/lib/planning';
import { addIngredientsToShoppingList, getPortionsScale, isRecipeInShoppingList } from '@/lib/shoppingList';
import { getRecettesBySlugs } from '@/lib/strapi';
import type { SwipeState } from '@/lib/swipeEngine';

export type PlanShoppingResult =
  | { status: 'no-meals' }
  | { status: 'all-cooked' }
  | { status: 'already' }
  | { status: 'done'; added: number; already: number; failed: number };

export interface PlanShoppingMessage {
  level: 'success' | 'info' | 'error';
  text: string;
}

/**
 * Ajoute les ingrédients des repas à venir non cuisinés, une seule fois par recette, avec les portions choisies
 * sur la page de la recette. Une recette déjà présente dans la liste n'est pas ré-ajoutée.
 * Lève une erreur si les recettes ne peuvent pas être récupérées.
 */
export async function addPlanToShoppingList(state: SwipeState): Promise<PlanShoppingResult> {
  if (getUpcomingEntries(state).length === 0) return { status: 'no-meals' };

  const uniqueEntries = getShoppingEntries(state);
  if (uniqueEntries.length === 0) return { status: 'all-cooked' };

  const toAdd = uniqueEntries.filter((entry) => !isRecipeInShoppingList(entry.recipeId));
  if (toAdd.length === 0) return { status: 'already' };

  const recettes = await getRecettesBySlugs(toAdd.map((entry) => entry.slug));
  const bySlug = new Map(recettes.map((recette) => [recette.attributes.slug, recette]));

  let added = 0;
  for (const entry of toAdd) {
    const recette = bySlug.get(entry.slug);
    const ingredients = recette?.attributes.ingredients;
    if (!recette || !Array.isArray(ingredients)) continue;
    const scale = getPortionsScale(entry.slug, recette.attributes.nombrePersonnes || 4);
    addIngredientsToShoppingList(ingredients, entry.recipeId, { recipeTitle: entry.titre, scale });
    added += 1;
  }

  return { status: 'done', added, already: uniqueEntries.length - toAdd.length, failed: toAdd.length - added };
}

/** Les messages à afficher après un ajout depuis le planning. */
export function describePlanShopping(result: PlanShoppingResult): PlanShoppingMessage[] {
  switch (result.status) {
    case 'no-meals':
      return [{ level: 'info', text: 'Planifiez d’abord des repas' }];
    case 'all-cooked':
      return [{ level: 'info', text: 'Tous vos repas à venir sont déjà cuisinés : rien à ajouter' }];
    case 'already':
      return [{ level: 'info', text: 'Toutes ces recettes sont déjà dans votre liste de courses' }];
    case 'done': {
      const messages: PlanShoppingMessage[] = [];
      if (result.added > 0) {
        messages.push({
          level: 'success',
          text:
            `${result.added} ${result.added === 1 ? 'recette ajoutée' : 'recettes ajoutées'} à la liste de courses` +
            (result.already > 0 ? ` (${result.already} déjà présente${result.already > 1 ? 's' : ''})` : ''),
        });
      }
      if (result.failed > 0) {
        messages.push({
          level: 'error',
          text: `${result.failed} ${result.failed === 1 ? 'recette n’a' : 'recettes n’ont'} pas pu être ajoutée${result.failed > 1 ? 's' : ''}`,
        });
      }
      return messages;
    }
  }
}
