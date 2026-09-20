import { describe, expect, it } from 'vitest';
import {
  MIN_ELIGIBLE,
  REFUSAL_COOLDOWN_DAYS,
  clearPassesForTonight,
  clearRefusals,
  createBaseScores,
  createInitialState,
  getEligibleRecipes,
  getWindowStart,
  normalizeState,
  passForTonight,
  pickNext,
  refuseRecipe,
  setPrefs,
  undoPassForTonight,
  undoRefusal,
  type PickContext,
  type PlanEntry,
  type SwipeRecipe,
  type SwipeState,
} from '../swipeEngine';

// Mercredi 16 septembre 2026
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function recipe(id: number, overrides: Partial<SwipeRecipe> = {}): SwipeRecipe {
  return {
    id,
    slug: `recette-${id}`,
    titre: `Recette ${id}`,
    description: '',
    imageUrl: null,
    imageAlt: `Recette ${id}`,
    totalMinutes: 30,
    categorySlugs: [`cat-${id}`],
    ingredientSlugs: [`ing-${id}`],
    ...overrides,
  };
}

function entry(recipeId: number, date: string, meal: 'midi' | 'soir' = 'soir', cooked = false): PlanEntry {
  return { recipeId, slug: `recette-${recipeId}`, titre: `Recette ${recipeId}`, imageUrl: null, date, meal, cooked };
}

function context(recipes: SwipeRecipe[], overrides: Partial<PickContext> = {}): PickContext {
  return {
    recipes,
    state: createInitialState(WEDNESDAY),
    favoriteIds: new Set<number>(),
    shownIds: [],
    baseScores: new Map(recipes.map((r) => [r.id, 0.5])),
    mode: 'week',
    ...overrides,
  };
}

describe('getWindowStart', () => {
  it('renvoie le jour courant, quel que soit le jour de la semaine', () => {
    expect(getWindowStart(WEDNESDAY)).toBe('2026-09-16');
    expect(getWindowStart(new Date(2026, 8, 20, 23, 30))).toBe('2026-09-20'); // dimanche soir
    expect(getWindowStart(new Date(2026, 8, 21, 0, 5))).toBe('2026-09-21');
  });
});

describe('normalizeState', () => {
  it('retourne un état initial pour une donnée invalide', () => {
    expect(normalizeState(null, WEDNESDAY)).toEqual(createInitialState(WEDNESDAY));
    expect(normalizeState('n’importe quoi', WEDNESDAY)).toEqual(createInitialState(WEDNESDAY));
  });

  it('conserve le planning après un aller-retour de stockage', () => {
    const state: SwipeState = { ...createInitialState(WEDNESDAY), plan: [entry(1, '2026-09-18'), entry(2, '2026-09-15', 'midi', true)] };
    const restored = normalizeState(JSON.parse(JSON.stringify(state)), WEDNESDAY);
    expect(restored.plan).toEqual(state.plan);
  });

  it('ignore l’ancien format (champ « kept ») : la fonctionnalité n’était pas en production', () => {
    const legacy = { ...createInitialState(WEDNESDAY), kept: [{ id: 1, slug: 'a', titre: 'A' }], target: 4 };
    const restored = normalizeState(legacy, WEDNESDAY);
    expect(restored.plan).toEqual([]);
    expect(restored).not.toHaveProperty('kept');
  });

  it('écarte les entrées incomplètes, hors plage, au repas invalide ou en double sur un créneau', () => {
    const raw = {
      ...createInitialState(WEDNESDAY),
      plan: [
        entry(1, '2026-09-30'), // au-delà de la fenêtre
        entry(2, '2026-09-08'), // au-delà de l’historique
        { ...entry(3, '2026-09-17'), meal: 'nuit' }, // repas invalide
        { recipeId: 4, date: '2026-09-17', meal: 'soir' }, // titre et slug manquants
        null,
        entry(5, '2026-09-18'),
        entry(6, '2026-09-18'), // même créneau que la précédente : écartée
      ],
    };
    const restored = normalizeState(raw, WEDNESDAY);
    expect(restored.plan.map((item) => item.recipeId)).toEqual([5]);
  });

  it('fait glisser la fenêtre : les entrées à venir restent, les passées restent 7 jours puis disparaissent', () => {
    const state: SwipeState = { ...createInitialState(WEDNESDAY), plan: [entry(1, '2026-09-17'), entry(2, '2026-09-22')] };
    const roundTrip = (now: Date) => normalizeState(JSON.parse(JSON.stringify(state)), now).plan.map((item) => item.recipeId);

    expect(roundTrip(new Date(2026, 8, 18, 9, 0, 0))).toEqual([1, 2]); // le 17 est passé mais consultable
    expect(roundTrip(new Date(2026, 8, 24, 9, 0, 0))).toEqual([1, 2]); // le 17 = aujourd’hui − 7
    expect(roundTrip(new Date(2026, 8, 25, 9, 0, 0))).toEqual([2]); // le 17 est sorti de l’historique
    expect(roundTrip(new Date(2026, 9, 1, 9, 0, 0))).toEqual([]); // le 22 aussi
  });

  it('force « non cuisinée » sur un repas à venir, mais garde le cochage d’aujourd’hui et du passé', () => {
    const raw = {
      ...createInitialState(WEDNESDAY),
      plan: [entry(1, '2026-09-18', 'soir', true), entry(2, '2026-09-16', 'soir', true), entry(3, '2026-09-14', 'soir', true)],
    };
    const restored = normalizeState(raw, WEDNESDAY);
    expect(restored.plan.map((item) => [item.recipeId, item.cooked])).toEqual([
      [1, false],
      [2, true],
      [3, true],
    ]);
  });

  it('conserve les préférences et purge les refus expirés', () => {
    let state = createInitialState(WEDNESDAY);
    state = refuseRecipe(state, { id: 2 }, WEDNESDAY);
    state = setPrefs(state, { maxMinutes: 30, showLunch: true });

    const restored = normalizeState(JSON.parse(JSON.stringify(state)), new Date(2026, 8, 20, 21, 0, 0));
    expect(restored.windowStart).toBe('2026-09-20');
    expect(Object.keys(restored.refused)).toEqual(['2']);
    expect(restored.prefs).toEqual({ maxMinutes: 30, showLunch: true, planView: 'list' });
  });

  it(`purge les refus de plus de ${REFUSAL_COOLDOWN_DAYS} jours`, () => {
    const state: SwipeState = {
      ...createInitialState(WEDNESDAY),
      refused: {
        '1': new Date(WEDNESDAY.getTime() - (REFUSAL_COOLDOWN_DAYS + 1) * DAY_MS).toISOString(),
        '2': new Date(WEDNESDAY.getTime() - (REFUSAL_COOLDOWN_DAYS - 1) * DAY_MS).toISOString(),
        '3': 'pas une date',
      },
    };
    expect(Object.keys(normalizeState(state, WEDNESDAY).refused)).toEqual(['2']);
  });

  it('lit les préférences stockées avec des valeurs par défaut sûres', () => {
    const base = createInitialState(WEDNESDAY);
    expect(normalizeState({ ...base, prefs: { showLunch: true } }, WEDNESDAY).prefs.showLunch).toBe(true);
    expect(normalizeState({ ...base, prefs: { showLunch: 'oui' } }, WEDNESDAY).prefs.showLunch).toBe(false);
    expect(normalizeState({ ...base, prefs: { maxMinutes: -5 } }, WEDNESDAY).prefs.maxMinutes).toBeNull();
  });

  it('ignore l’ancienne préférence « menu économe » présente dans un stockage antérieur', () => {
    const restored = normalizeState({ ...createInitialState(WEDNESDAY), prefs: { maxMinutes: 30, economical: true, showLunch: false } }, WEDNESDAY);
    expect(restored.prefs).toEqual({ maxMinutes: 30, showLunch: false, planView: 'list' });
    expect(normalizeState({ ...createInitialState(WEDNESDAY), prefs: { planView: 'week' } }, WEDNESDAY).prefs.planView).toBe('week');
    expect(normalizeState({ ...createInitialState(WEDNESDAY), prefs: { planView: 'mois' } }, WEDNESDAY).prefs.planView).toBe('list');
  });
});

describe('refus', () => {
  it('enregistre, annule et efface les refus', () => {
    let state = createInitialState(WEDNESDAY);
    state = refuseRecipe(state, { id: 1 }, WEDNESDAY);
    state = refuseRecipe(state, { id: 2 }, WEDNESDAY);
    expect(Object.keys(state.refused)).toEqual(['1', '2']);

    state = undoRefusal(state, 1);
    expect(Object.keys(state.refused)).toEqual(['2']);
    expect(clearRefusals(state).refused).toEqual({});
  });
});

describe('« pas ce soir »', () => {
  const recipes = [recipe(1), recipe(2), recipe(3)];
  const passed = () => passForTonight(createInitialState(WEDNESDAY), recipes[0], WEDNESDAY);

  it('enregistre, annule et efface les passes du soir', () => {
    let state = passForTonight(passed(), recipes[1], WEDNESDAY);
    expect(state.passedTonight).toEqual({ '1': '2026-09-16', '2': '2026-09-16' });
    state = undoPassForTonight(state, 1);
    expect(Object.keys(state.passedTonight)).toEqual(['2']);
    expect(clearPassesForTonight(state).passedTonight).toEqual({});
  });

  it('écarte la recette de « ce soir », mais pas de « découvrir »', () => {
    const state = passed();
    expect(getEligibleRecipes(context(recipes, { state, mode: 'tonight' })).map((r) => r.id)).toEqual([2, 3]);
    expect(getEligibleRecipes(context(recipes, { state, mode: 'week' })).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('n’ajoute rien aux refus : découvrir, favoris et suggestions du planning ne le voient pas', () => {
    expect(passed().refused).toEqual({});
  });

  it('un refus fait dans « découvrir » écarte toujours la recette de « ce soir »', () => {
    const state = refuseRecipe(createInitialState(WEDNESDAY), recipes[0], WEDNESDAY);
    expect(getEligibleRecipes(context(recipes, { state, mode: 'tonight' })).map((r) => r.id)).toEqual([2, 3]);
  });

  it('ne dure que la journée : le lendemain, la recette redevient proposable', () => {
    const stored = JSON.parse(JSON.stringify(passed()));
    const sameDay = normalizeState(stored, new Date(2026, 8, 16, 22, 0, 0));
    expect(sameDay.passedTonight).toEqual({ '1': '2026-09-16' });

    const nextDay = normalizeState(stored, new Date(2026, 8, 17, 9, 0, 0));
    expect(nextDay.passedTonight).toEqual({});
    expect(getEligibleRecipes(context(recipes, { state: nextDay, mode: 'tonight' })).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('accepte un ancien état enregistré sans ce champ', () => {
    const { passedTonight: _ignored, ...legacy } = createInitialState(WEDNESDAY);
    expect(normalizeState(legacy, WEDNESDAY).passedTonight).toEqual({});
  });
});

describe('getEligibleRecipes', () => {
  const recipes = [recipe(1), recipe(2), recipe(3), recipe(4, { totalMinutes: 90 }), recipe(5, { totalMinutes: 0 })];

  it('exclut les refusées, les déjà vues et les favoris (mode semaine)', () => {
    const state = refuseRecipe(createInitialState(WEDNESDAY), recipes[0], WEDNESDAY);
    const eligible = getEligibleRecipes(context(recipes, { state, shownIds: [3], favoriteIds: new Set([2]) }));
    expect(eligible.map((r) => r.id)).toEqual([4, 5]);
  });

  it('en mode « ce soir », un favori reste proposable', () => {
    const eligible = getEligibleRecipes(context(recipes, { mode: 'tonight', favoriteIds: new Set([1]) }));
    expect(eligible.map((r) => r.id)).toContain(1);
  });

  it('applique la durée maximale et écarte les recettes sans durée connue', () => {
    const state = setPrefs(createInitialState(WEDNESDAY), { maxMinutes: 30 });
    const eligible = getEligibleRecipes(context(recipes, { state }));
    expect(eligible.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe('garde-fou : refus libérés quand il reste peu de recettes', () => {
  const catalogue = Array.from({ length: 30 }, (_, index) => recipe(index + 1));
  const ids = (list: SwipeRecipe[]) => list.map((item) => item.id);

  /** Refuse les recettes données, la première en premier : la première est donc la plus ancienne. */
  const refusedInOrder = (list: SwipeRecipe[]) => {
    let state = createInitialState(WEDNESDAY);
    list.forEach((item, index) => {
      state = refuseRecipe(state, item, new Date(WEDNESDAY.getTime() - (list.length - index) * 60 * 1000));
    });
    return state;
  };

  it('ne libère rien tant qu’il reste assez de recettes hors refus', () => {
    const state = refusedInOrder(catalogue.slice(0, 10)); // 20 recettes restent
    const eligible = getEligibleRecipes(context(catalogue, { state }));
    expect(ids(eligible)).toEqual(ids(catalogue.slice(10)));
  });

  it(`en dessous de ${MIN_ELIGIBLE} recettes hors refus, libère les refus les plus anciens pour y revenir`, () => {
    const state = refusedInOrder(catalogue.slice(0, 25)); // 5 recettes restent
    const eligible = getEligibleRecipes(context(catalogue, { state }));
    expect(eligible).toHaveLength(MIN_ELIGIBLE);
    // Les 5 non refusées + les 7 refus les plus anciens (1 à 7)
    expect(ids(eligible).sort((a, b) => a - b)).toEqual([...[1, 2, 3, 4, 5, 6, 7], 26, 27, 28, 29, 30]);
  });

  it('s’applique aussi à « ce soir »', () => {
    const state = refusedInOrder(catalogue.slice(0, 25));
    expect(getEligibleRecipes(context(catalogue, { state, mode: 'tonight' }))).toHaveLength(MIN_ELIGIBLE);
  });

  it('ne libère pas une recette déjà vue pendant la partie', () => {
    const state = refusedInOrder(catalogue.slice(0, 25));
    const eligible = getEligibleRecipes(context(catalogue, { state, shownIds: [1, 2, 3] }));
    expect(ids(eligible)).not.toContain(1);
    expect(eligible).toHaveLength(MIN_ELIGIBLE);
  });

  it('ne libère jamais plus de la moitié des recettes en jeu (petit jeu : les refus restent efficaces)', () => {
    const small = catalogue.slice(0, 6);
    const state = refusedInOrder(small.slice(0, 5)); // 1 seule recette hors refus
    const eligible = getEligibleRecipes(context(small, { state }));
    expect(eligible).toHaveLength(3);
    expect(ids(eligible)).toContain(6);
  });

  it('ne fait pas revenir une recette exclue pour une autre raison (durée, favori)', () => {
    const list = [recipe(1, { totalMinutes: 90 }), ...catalogue.slice(1)];
    let state = refusedInOrder(catalogue.slice(1, 26));
    state = setPrefs(state, { maxMinutes: 30 });
    expect(ids(getEligibleRecipes(context(list, { state })))).not.toContain(1);
  });
});

describe('pickNext', () => {
  it('retourne null quand plus aucune recette n’est proposable', () => {
    expect(pickNext(context([recipe(1)], { shownIds: [1] }))).toBeNull();
    expect(pickNext(context([]))).toBeNull();
  });

  it('suit le score aléatoire de base quand rien d’autre ne joue', () => {
    const recipes = [recipe(1), recipe(2), recipe(3)];
    const baseScores = new Map([
      [1, 0.2],
      [2, 0.9],
      [3, 0.5],
    ]);
    expect(pickNext(context(recipes, { baseScores }))?.id).toBe(2);
  });

  it('évite une recette de la même catégorie que les dernières montrées', () => {
    const recipes = [
      recipe(1, { categorySlugs: ['plats'] }),
      recipe(2, { categorySlugs: ['plats'] }),
      recipe(3, { categorySlugs: ['desserts'] }),
    ];
    const baseScores = new Map([
      [1, 0.1],
      [2, 0.8],
      [3, 0.5],
    ]);
    expect(pickNext(context(recipes, { baseScores, shownIds: [1] }))?.id).toBe(3);
  });

  it('évite aussi une recette qui partage un ingrédient avec les dernières montrées', () => {
    const recipes = [
      recipe(1, { ingredientSlugs: ['courgette'] }),
      recipe(2, { ingredientSlugs: ['courgette'] }),
      recipe(3, { ingredientSlugs: ['chocolat'] }),
    ];
    const baseScores = new Map([
      [1, 0.1],
      [2, 0.8],
      [3, 0.5],
    ]);
    expect(pickNext(context(recipes, { baseScores, shownIds: [1] }))?.id).toBe(3);
  });

  it('createBaseScores donne un score entre 0 et 1 à chaque recette', () => {
    const scores = createBaseScores([recipe(1), recipe(2)]);
    expect([...scores.keys()]).toEqual([1, 2]);
    for (const score of scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(1);
    }
  });
});
