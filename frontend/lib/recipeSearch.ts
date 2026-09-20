/**
 * Recherche locale dans le catalogue de recettes (déjà chargé côté client pour le planning).
 * Insensible aux accents, à la casse et aux pluriels simples ; aucun appel réseau, donc instantanée.
 * Module pur, testable.
 */

/** Ce que la recherche lit d'une recette : le titre, puis les catégories et les ingrédients. */
export interface SearchableRecipe {
  titre: string;
  categorySlugs: string[];
  ingredientSlugs: string[];
}

/** Minuscules, sans accents, sans ponctuation : « Crème brûlée » → « creme brulee », « bœuf » → « boeuf ». */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// « courgettes » → « courgette » (assez pour retrouver le singulier du titre)
function toSingular(token: string): string {
  return token.length > 3 ? token.replace(/[sx]$/, '') : token;
}

function toTokens(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean).map(toSingular);
}

/**
 * Recherche dans le titre, puis dans les catégories et les ingrédients. Tous les mots saisis doivent être trouvés.
 * Classement : mot qui commence le titre, puis mot contenu dans le titre, puis catégorie ou ingrédient.
 */
export function searchRecipes<T extends SearchableRecipe>(recipes: T[], query: string, limit = 20): T[] {
  const tokens = toTokens(query);
  if (tokens.length === 0) return [];

  const scored: Array<{ recipe: T; score: number }> = [];

  for (const recipe of recipes) {
    const title = normalizeSearchText(recipe.titre);
    const titleWords = title.split(' ');
    const extra = normalizeSearchText([...recipe.categorySlugs, ...recipe.ingredientSlugs].join(' '));

    let score = 0;
    let matchesAll = true;
    for (const token of tokens) {
      if (titleWords.some((word) => word.startsWith(token))) score += 0;
      else if (title.includes(token)) score += 1;
      else if (extra.includes(token)) score += 3;
      else {
        matchesAll = false;
        break;
      }
    }
    if (!matchesAll) continue;

    // Un titre qui commence par la recherche passe devant
    if (title.startsWith(tokens[0])) score -= 0.5;
    scored.push({ recipe, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.recipe.titre.localeCompare(b.recipe.titre, 'fr'))
    .slice(0, limit)
    .map((entry) => entry.recipe);
}
