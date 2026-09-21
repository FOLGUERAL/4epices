import { describe, expect, it } from 'vitest';
import { planRecipe } from '../planning';
import {
  NO_FILTERS,
  applyFilters,
  categoryLabel,
  getAvailableCategories,
  hasActiveFilters,
  suggestForSlot,
} from '../recipeSuggestions';
import { createInitialState, refuseRecipe, type SwipeRecipe, type SwipeState } from '../swipeEngine';

// « Aujourd’hui » : mercredi 16 septembre 2026 (samedi 19 et dimanche 20 = week-end)
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0);
const WEDNESDAY_DINNER = { date: '2026-09-16', meal: 'soir' as const };
const SATURDAY_DINNER = { date: '2026-09-19', meal: 'soir' as const };

function recipe(id: number, overrides: Partial<SwipeRecipe> = {}): SwipeRecipe {
  return {
    id,
    slug: `recette-${id}`,
    titre: `Recette ${id}`,
    description: '',
    imageUrl: null,
    imageAlt: '',
    totalMinutes: 40,
    difficulte: 'moyen',
    categorySlugs: [],
    ingredientSlugs: [],
    ...overrides,
  };
}

const empty = (): SwipeState => createInitialState(WEDNESDAY);
const ids = (list: SwipeRecipe[]) => list.map((item) => item.id);

describe('applyFilters', () => {
  const catalogue = [
    recipe(1, { totalMinutes: 20, difficulte: 'facile', categorySlugs: ['italien'] }),
    recipe(2, { totalMinutes: 60, difficulte: 'facile', categorySlugs: ['francais'] }),
    recipe(3, { totalMinutes: 25, difficulte: 'moyen', categorySlugs: ['italien'] }),
    recipe(4, { totalMinutes: 0, difficulte: 'facile' }),
  ];

  it('ne filtre rien sans filtre actif', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(applyFilters(catalogue, NO_FILTERS)).toBe(catalogue);
  });

  it('« rapide » garde 30 minutes ou moins et écarte les durées inconnues', () => {
    expect(ids(applyFilters(catalogue, { ...NO_FILTERS, quick: true }))).toEqual([1, 3]);
  });

  it('« facile » ne garde que la difficulté facile', () => {
    expect(ids(applyFilters(catalogue, { ...NO_FILTERS, easy: true }))).toEqual([1, 2, 4]);
  });

  it('filtre par catégorie et cumule les filtres', () => {
    expect(ids(applyFilters(catalogue, { ...NO_FILTERS, category: 'italien' }))).toEqual([1, 3]);
    expect(ids(applyFilters(catalogue, { quick: true, easy: true, category: 'italien' }))).toEqual([1]);
  });
});

describe('getAvailableCategories / categoryLabel', () => {
  it('liste les catégories présentes, les plus fournies d’abord', () => {
    const catalogue = [
      recipe(1, { categorySlugs: ['italien', 'healthy'] }),
      recipe(2, { categorySlugs: ['italien'] }),
      recipe(3, { categorySlugs: ['francais'] }),
    ];
    expect(getAvailableCategories(catalogue)).toEqual(['italien', 'francais', 'healthy']);
  });

  it('donne un libellé lisible, même pour une catégorie inconnue', () => {
    expect(categoryLabel('patisserie')).toBe('Pâtisserie');
    expect(categoryLabel('snacking')).toBe('Snacking');
    expect(categoryLabel('categorie')).toBe('Snacking');
    expect(categoryLabel('cuisine-vegetarienne')).toBe('Cuisine vegetarienne');
  });
});

describe('suggestForSlot', () => {
  it('écarte les recettes déjà prévues à venir et celles refusées au swipe', () => {
    const catalogue = [recipe(1), recipe(2), recipe(3)];
    let state = planRecipe(empty(), catalogue[0], { date: '2026-09-18', meal: 'soir' });
    state = refuseRecipe(state, catalogue[1], WEDNESDAY);

    expect(ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, state))).toEqual([3]);
  });

  it('avec keepExcluded, garde les recettes prévues ou refusées, mais après les autres', () => {
    const catalogue = [recipe(1), recipe(2), recipe(3)];
    let state = planRecipe(empty(), catalogue[0], { date: '2026-09-18', meal: 'soir' });
    state = refuseRecipe(state, catalogue[1], WEDNESDAY);

    const result = ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, state, { keepExcluded: true }));
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(3);
  });

  it('écarte les recettes déjà proposées ailleurs', () => {
    const catalogue = [recipe(1), recipe(2)];
    expect(ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, empty(), { excludeIds: new Set([1]) }))).toEqual([2]);
  });

  it('n’oriente pas le classement selon la durée, en semaine comme le week-end', () => {
    const quick = Array.from({ length: 20 }, (_, index) => recipe(index + 1, { totalMinutes: 15 }));
    const long = Array.from({ length: 20 }, (_, index) => recipe(index + 101, { totalMinutes: 120 }));
    const catalogue = [...quick, ...long];

    for (const slot of [WEDNESDAY_DINNER, SATURDAY_DINNER]) {
      const top = suggestForSlot(catalogue, slot, empty(), { limit: 10 });
      expect(top.some((item) => item.totalMinutes === 15)).toBe(true);
      expect(top.some((item) => item.totalMinutes === 120)).toBe(true);
    }
  });

  it('ne met pas la pâtisserie en tête pour un repas', () => {
    const catalogue = [recipe(1, { totalMinutes: 20, categorySlugs: ['patisserie'] }), recipe(2, { totalMinutes: 20 })];
    expect(ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, empty()))[0]).toBe(2);
  });

  it('traite le snacking comme un en-cas, sous son ancien comme sous son nouveau slug', () => {
    for (const slug of ['snacking', 'categorie']) {
      const catalogue = [recipe(1, { totalMinutes: 20, categorySlugs: [slug] }), recipe(2, { totalMinutes: 20 })];
      expect(ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, empty()))[0]).toBe(2);
    }
  });

  it('évite le même ingrédient ou la même cuisine que la veille et le lendemain', () => {
    const planned = recipe(9, { categorySlugs: ['italien'], ingredientSlugs: ['courgette'] });
    const sameIngredient = recipe(1, { totalMinutes: 20, ingredientSlugs: ['courgette'] });
    const sameCuisine = recipe(2, { totalMinutes: 20, categorySlugs: ['italien'] });
    const different = recipe(3, { totalMinutes: 20, categorySlugs: ['francais'], ingredientSlugs: ['poireau'] });

    const state = planRecipe(empty(), planned, { date: '2026-09-17', meal: 'soir' });
    const result = ids(suggestForSlot([planned, sameIngredient, sameCuisine, different], WEDNESDAY_DINNER, state));

    expect(result[0]).toBe(3);
    expect(result.indexOf(2)).toBeLessThan(result.indexOf(1));
  });

  it('pénalise une recette déjà cuisinée récemment', () => {
    const catalogue = [recipe(1, { totalMinutes: 20 }), recipe(2, { totalMinutes: 20 })];
    const state: SwipeState = {
      ...empty(),
      plan: [{ recipeId: 1, slug: 'recette-1', titre: 'Recette 1', imageUrl: null, date: '2026-09-14', meal: 'soir', cooked: true }],
    };
    expect(ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, state))[0]).toBe(2);
  });

  it('est stable d’un appel à l’autre et respecte la limite', () => {
    const catalogue = Array.from({ length: 30 }, (_, index) => recipe(index + 1, { totalMinutes: 20 }));
    const first = suggestForSlot(catalogue, WEDNESDAY_DINNER, empty(), { limit: 5 });
    expect(first).toHaveLength(5);
    expect(ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, empty(), { limit: 5 }))).toEqual(ids(first));
  });

  it('varie d’un créneau à l’autre pour des recettes équivalentes', () => {
    const catalogue = Array.from({ length: 30 }, (_, index) => recipe(index + 1, { totalMinutes: 20 }));
    const tuesday = ids(suggestForSlot(catalogue, { date: '2026-09-17', meal: 'soir' }, empty(), { limit: 5 }));
    const wednesday = ids(suggestForSlot(catalogue, WEDNESDAY_DINNER, empty(), { limit: 5 }));
    expect(tuesday).not.toEqual(wednesday);
  });
});
