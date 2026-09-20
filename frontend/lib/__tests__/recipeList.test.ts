import { describe, expect, it } from 'vitest';
import {
  NO_LIST_FILTERS,
  filterRecettes,
  formatMinutes,
  getCategoryOptions,
  getTotalMinutes,
  hasActiveListFilters,
} from '../recipeList';
import type { Recette } from '../strapi';

interface Sample {
  id: number;
  titre: string;
  prep?: number;
  cuisson?: number;
  difficulte?: string;
  categories?: Array<[string, string]>;
  tags?: string[];
  ingredients?: unknown[];
}

function recette(sample: Sample): Recette {
  return {
    id: sample.id,
    attributes: {
      titre: sample.titre,
      slug: `recette-${sample.id}`,
      tempsPreparation: sample.prep,
      tempsCuisson: sample.cuisson,
      difficulte: sample.difficulte,
      ingredients: sample.ingredients,
      categories: {
        data: (sample.categories || []).map(([slug, nom], index) => ({ id: index, attributes: { slug, nom } })),
      },
      tags: { data: (sample.tags || []).map((nom, index) => ({ id: index, attributes: { slug: nom, nom } })) },
    },
  } as unknown as Recette;
}

const ids = (list: Recette[]) => list.map((item) => item.id);

const catalogue = [
  recette({
    id: 1,
    titre: 'Gratin de courgettes',
    prep: 15,
    cuisson: 30,
    difficulte: 'facile',
    categories: [['francais', 'Français']],
    ingredients: [{ quantite: '3', ingredient: 'courgettes' }, '20 cl de crème'],
  }),
  recette({
    id: 2,
    titre: 'Houmous',
    prep: 10,
    difficulte: 'facile',
    categories: [['oriental', 'Oriental'], ['healthy', 'Healthy']],
    tags: ['végétarien'],
    ingredients: ['400 g de pois chiches'],
  }),
  recette({
    id: 3,
    titre: 'Bœuf bourguignon',
    prep: 30,
    cuisson: 180,
    difficulte: 'difficile',
    categories: [['francais', 'Français']],
    ingredients: ['1 kg de bœuf', 'vin rouge'],
  }),
];

describe('hasActiveListFilters / getTotalMinutes', () => {
  it('détecte un filtre actif, une recherche d’espaces ne compte pas', () => {
    expect(hasActiveListFilters(NO_LIST_FILTERS)).toBe(false);
    expect(hasActiveListFilters({ ...NO_LIST_FILTERS, query: '   ' })).toBe(false);
    expect(hasActiveListFilters({ ...NO_LIST_FILTERS, query: 'gratin' })).toBe(true);
    expect(hasActiveListFilters({ ...NO_LIST_FILTERS, quick: true })).toBe(true);
  });

  it('formate les durées', () => {
    expect(formatMinutes(0)).toBe('');
    expect(formatMinutes(35)).toBe('35 min');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(90)).toBe('1h 30min');
  });

  it('additionne préparation et cuisson', () => {
    expect(getTotalMinutes(catalogue[0])).toBe(45);
    expect(getTotalMinutes(catalogue[1])).toBe(10);
  });
});

describe('getCategoryOptions', () => {
  it('compte les recettes par catégorie, les plus fournies d’abord', () => {
    expect(getCategoryOptions(catalogue)).toEqual([
      { slug: 'francais', nom: 'Français', count: 2 },
      { slug: 'healthy', nom: 'Healthy', count: 1 },
      { slug: 'oriental', nom: 'Oriental', count: 1 },
    ]);
  });
});

describe('filterRecettes', () => {
  it('sans filtre, garde toutes les recettes dans l’ordre', () => {
    expect(ids(filterRecettes(catalogue, NO_LIST_FILTERS))).toEqual([1, 2, 3]);
  });

  it('« 30 min max » écarte les recettes longues', () => {
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, quick: true }))).toEqual([2]);
  });

  it('« facile » et catégorie se cumulent', () => {
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, easy: true }))).toEqual([1, 2]);
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, easy: true, category: 'francais' }))).toEqual([1]);
  });

  it('cherche dans le titre sans tenir compte des accents ni des pluriels', () => {
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'houmou' }))).toEqual([2]);
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'BOEUF' }))).toEqual([3]);
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'courgette' }))).toEqual([1]);
  });

  it('cherche aussi dans les ingrédients, sous forme de texte ou d’objet', () => {
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'pois chiche' }))).toEqual([2]);
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'creme' }))).toEqual([1]);
  });

  it('cherche dans les tags et applique les puces avant la recherche', () => {
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'vegetarien' }))).toEqual([2]);
    expect(ids(filterRecettes(catalogue, { ...NO_LIST_FILTERS, query: 'francais', quick: true }))).toEqual([]);
  });

  it('classe les résultats par pertinence : le titre avant les ingrédients', () => {
    const list = [
      recette({ id: 10, titre: 'Soupe', ingredients: ['courgette'] }),
      recette({ id: 11, titre: 'Courgettes farcies' }),
    ];
    expect(ids(filterRecettes(list, { ...NO_LIST_FILTERS, query: 'courgette' }))).toEqual([11, 10]);
  });
});
