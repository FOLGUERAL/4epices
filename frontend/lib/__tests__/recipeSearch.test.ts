import { describe, expect, it } from 'vitest';
import { normalizeSearchText, searchRecipes } from '../recipeSearch';
import type { SwipeRecipe } from '../swipeEngine';

function recipe(id: number, titre: string, overrides: Partial<SwipeRecipe> = {}): SwipeRecipe {
  return {
    id,
    slug: `recette-${id}`,
    titre,
    description: '',
    imageUrl: null,
    imageAlt: titre,
    totalMinutes: 30,
    categorySlugs: [],
    ingredientSlugs: [],
    ...overrides,
  };
}

const catalogue = [
  recipe(1, 'Crème brûlée à la vanille', { categorySlugs: ['desserts'] }),
  recipe(2, 'Gratin de courgettes', { categorySlugs: ['plats'], ingredientSlugs: ['courgette', 'creme'] }),
  recipe(3, 'Tarte aux poireaux', { categorySlugs: ['plats'], ingredientSlugs: ['poireau', 'creme'] }),
  recipe(4, 'Salade de tomates', { categorySlugs: ['entrees'], ingredientSlugs: ['tomate'] }),
  recipe(5, 'Courgettes farcies', { categorySlugs: ['plats'], ingredientSlugs: ['courgette'] }),
];

describe('normalizeSearchText', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(normalizeSearchText('Crème  BRÛLÉE, à la vanille !')).toBe('creme brulee a la vanille');
  });

  it('remplace les ligatures : bœuf et œufs se tapent boeuf et oeufs', () => {
    expect(normalizeSearchText('Bœuf, ŒUFS et cæcum')).toBe('boeuf oeufs et caecum');
  });
});

describe('searchRecipes', () => {
  it('renvoie une liste vide pour une recherche vide ou faite d’espaces', () => {
    expect(searchRecipes(catalogue, '')).toEqual([]);
    expect(searchRecipes(catalogue, '   ')).toEqual([]);
  });

  it('ignore les accents et la casse', () => {
    expect(searchRecipes(catalogue, 'CREME BRULEE').map((r) => r.id)).toEqual([1]);
    expect(searchRecipes(catalogue, 'brûlée').map((r) => r.id)).toEqual([1]);
  });

  it('retrouve le singulier depuis un pluriel', () => {
    expect(searchRecipes(catalogue, 'courgette').map((r) => r.id).sort()).toEqual([2, 5]);
    expect(searchRecipes(catalogue, 'tomates').map((r) => r.id)).toEqual([4]);
  });

  it('exige tous les mots saisis', () => {
    expect(searchRecipes(catalogue, 'gratin courgette').map((r) => r.id)).toEqual([2]);
    expect(searchRecipes(catalogue, 'gratin poireau')).toEqual([]);
  });

  it('cherche aussi dans les catégories et les ingrédients', () => {
    expect(searchRecipes(catalogue, 'desserts').map((r) => r.id)).toEqual([1]);
    expect(searchRecipes(catalogue, 'poireau').map((r) => r.id)).toEqual([3]);
  });

  it('classe le titre avant les ingrédients', () => {
    // « creme » est dans le titre de la 1, mais seulement dans les ingrédients des 2 et 3
    expect(searchRecipes(catalogue, 'creme').map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('met devant les titres qui commencent par la recherche', () => {
    const results = searchRecipes(catalogue, 'courgette').map((r) => r.id);
    expect(results[0]).toBe(5); // « Courgettes farcies » commence par le mot
  });

  it('respecte la limite', () => {
    expect(searchRecipes(catalogue, 'e', 2)).toHaveLength(2);
  });

  it('ne renvoie rien quand aucune recette ne correspond', () => {
    expect(searchRecipes(catalogue, 'chocolat')).toEqual([]);
  });
});
