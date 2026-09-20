import { describe, expect, it } from 'vitest';
import { MAX_PARTIAL, mixerToCardRecipe, rankRecipesByIngredientSlugs } from '../ingredientMix';
import type { MixerRecipe } from '../ingredients';

function recipe(id: number, titre: string, ingredientSlugs: string[], overrides: Partial<MixerRecipe> = {}): MixerRecipe {
  return { id, slug: `recette-${id}`, titre, description: '', imageUrl: null, imageAlt: titre, ingredientSlugs, ...overrides };
}

const catalogue = [
  recipe(1, 'Gratin', ['courgette', 'creme', 'fromage']),
  recipe(2, 'Tarte', ['courgette', 'creme']),
  recipe(3, 'Salade', ['tomate', 'fromage']),
  recipe(4, 'Soupe', ['courgette']),
  recipe(5, 'Omelette', ['oeuf', 'fromage']),
];

const ids = (list: MixerRecipe[]) => list.map((item) => item.id);

describe('rankRecipesByIngredientSlugs', () => {
  it('ne renvoie rien sans ingrédient choisi', () => {
    expect(rankRecipesByIngredientSlugs(catalogue, [])).toEqual({ all: [], partial: [] });
  });

  it('un seul ingrédient : toutes les recettes qui le contiennent, sans « presque »', () => {
    const result = rankRecipesByIngredientSlugs(catalogue, ['courgette']);
    expect(ids(result.all)).toEqual([1, 2, 4]);
    expect(result.partial).toEqual([]);
  });

  it('plusieurs ingrédients : « all » exige tous les ingrédients', () => {
    expect(ids(rankRecipesByIngredientSlugs(catalogue, ['courgette', 'creme']).all)).toEqual([1, 2]);
  });

  it('avec des correspondances complètes et deux ingrédients, pas de « presque »', () => {
    expect(rankRecipesByIngredientSlugs(catalogue, ['courgette', 'creme']).partial).toEqual([]);
  });

  it('si rien ne combine tout, propose les recettes qui contiennent au moins un ingrédient, par ordre alphabétique à égalité', () => {
    const result = rankRecipesByIngredientSlugs(catalogue, ['courgette', 'tomate']);
    expect(result.all).toEqual([]);
    // Gratin, Salade, Soupe, Tarte : une correspondance chacune
    expect(result.partial.map((item) => item.recipe.id)).toEqual([1, 3, 4, 2]);
    expect(result.partial[0]).toMatchObject({ matched: 1, missing: ['tomate'] });
  });

  it('classe d’abord les recettes les plus complètes', () => {
    const list = [recipe(20, 'Zeste', ['a']), recipe(21, 'Abricot', ['a', 'b']), recipe(22, 'Bonbon', ['c'])];
    const result = rankRecipesByIngredientSlugs(list, ['a', 'b', 'x']);
    expect(result.all).toEqual([]);
    expect(result.partial.map((item) => item.recipe.id)).toEqual([21, 20]);
  });

  it('avec trois ingrédients, exige au moins deux correspondances quand certaines recettes les contiennent tous', () => {
    const list = [
      recipe(10, 'Complète', ['a', 'b', 'c']),
      recipe(11, 'Deux sur trois', ['a', 'b']),
      recipe(12, 'Un sur trois', ['a']),
    ];
    const result = rankRecipesByIngredientSlugs(list, ['a', 'b', 'c']);
    expect(ids(result.all)).toEqual([10]);
    expect(result.partial.map((item) => item.recipe.id)).toEqual([11]);
    expect(result.partial[0].missing).toEqual(['c']);
  });

  it('ignore les doublons dans la sélection et limite le nombre de « presque »', () => {
    const many = Array.from({ length: 30 }, (_, index) => recipe(100 + index, `Recette ${index}`, ['a']));
    const result = rankRecipesByIngredientSlugs(many, ['a', 'a', 'b']);
    expect(result.all).toEqual([]);
    expect(result.partial).toHaveLength(MAX_PARTIAL);
  });
});

describe('mixerToCardRecipe', () => {
  it('résume la recette pour une carte, avec durée totale et remarque', () => {
    const card = mixerToCardRecipe(recipe(1, 'Gratin', [], { tempsPreparation: 15, tempsCuisson: 30, difficulte: 'facile' }), 'Il manque : tomate');
    expect(card).toMatchObject({ id: 1, titre: 'Gratin', totalMinutes: 45, difficulte: 'facile', note: 'Il manque : tomate' });
  });
});
