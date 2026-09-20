import { describe, expect, it } from 'vitest';
import {
  autoPlan,
  countFreeDinners,
  countFreeSlots,
  formatDayLabel,
  formatMealWhen,
  formatSlotLabel,
  getHistoryPlanDays,
  getNextMeal,
  getNextFreeSlot,
  getPile,
  getQuickSlots,
  getPlanDays,
  getPlanEvents,
  getShoppingEntries,
  getSlotOccupant,
  getUpcomingEntries,
  getUpcomingEntry,
  planRecipe,
  toggleCookedAt,
  unplanSlot,
  type PlannableRecipe,
} from '../planning';
import {
  createInitialState,
  getHistoryDays,
  getWindowDays,
  isDateInPlanRange,
  normalizeState,
  parseLocalDate,
  type PlanEntry,
  type SwipeState,
} from '../swipeEngine';

// « Aujourd’hui » : mercredi 16 septembre 2026.
// - jours à venir (8) : du mercredi 16 au mercredi 23 ; week-end : samedi 19 et dimanche 20
// - jours passés consultables (7) : du mercredi 9 au mardi 15
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0);
const TODAY_KEY = '2026-09-16';

function recipe(id: number): PlannableRecipe {
  return { id, slug: `recette-${id}`, titre: `Recette ${id}`, imageUrl: null };
}

function pastEntry(recipeId: number, date: string, cooked: boolean): PlanEntry {
  return { ...recipe(recipeId), recipeId, imageUrl: null, date, meal: 'soir', cooked } as unknown as PlanEntry;
}

/** État vide aux dates de « aujourd’hui », avec éventuellement des entrées déjà présentes (par exemple passées). */
function stateWith(...entries: PlanEntry[]): SwipeState {
  return { ...createInitialState(WEDNESDAY), plan: entries };
}

const roundTrip = (state: SwipeState, now: Date) => normalizeState(JSON.parse(JSON.stringify(state)), now);

describe('fenêtre glissante : 8 jours à venir et 7 jours d’historique', () => {
  it('les jours à venir commencent aujourd’hui et couvrent 8 jours', () => {
    expect(getWindowDays(TODAY_KEY)).toEqual([
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
    ]);
  });

  it('l’historique couvre les 7 jours précédents, du plus ancien au plus récent', () => {
    expect(getHistoryDays(TODAY_KEY)).toEqual([
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
    ]);
  });

  it('un dimanche, la fenêtre couvre le dimanche puis toute la semaine suivante', () => {
    const sunday = new Date(2026, 8, 20, 21, 0, 0);
    const state = createInitialState(sunday);

    expect(state.windowStart).toBe('2026-09-20');
    expect(getPlanDays(state).map((day) => day.date)).toEqual([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('passe correctement d’un mois à l’autre et reste continu aux changements d’heure', () => {
    expect(getWindowDays('2026-09-28').slice(2, 5)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
    // Heure d’été 2026 : dimanche 29 mars ; heure d’hiver : dimanche 25 octobre
    expect(getWindowDays('2026-03-23')[6]).toBe('2026-03-29');
    expect(getWindowDays('2026-03-23')[7]).toBe('2026-03-30');
    expect(getWindowDays('2026-10-19')[7]).toBe('2026-10-26');
    expect(getHistoryDays('2026-03-30')[6]).toBe('2026-03-29');
  });

  it('accepte les jours de la plage (7 jours passés + 8 à venir) et refuse le reste', () => {
    expect(isDateInPlanRange('2026-09-23', TODAY_KEY)).toBe(true);
    expect(isDateInPlanRange('2026-09-24', TODAY_KEY)).toBe(false);
    expect(isDateInPlanRange('2026-09-09', TODAY_KEY)).toBe(true);
    expect(isDateInPlanRange('2026-09-08', TODAY_KEY)).toBe(false);
    expect(parseLocalDate('2026-02-31')).toBeNull();
    expect(getWindowDays('n’importe quoi')).toEqual([]);
  });
});

describe('planRecipe / unplanSlot / toggleCookedAt', () => {
  it('place une recette sur un créneau', () => {
    const state = planRecipe(stateWith(), recipe(1), { date: '2026-09-17', meal: 'soir' });
    expect(getSlotOccupant(state, { date: '2026-09-17', meal: 'soir' })).toMatchObject({ recipeId: 1, cooked: false });
  });

  it('déplace le repas à venir d’une recette et libère l’ancien créneau', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: '2026-09-17', meal: 'soir' });
    state = planRecipe(state, recipe(1), { date: '2026-09-19', meal: 'midi' });

    expect(getSlotOccupant(state, { date: '2026-09-17', meal: 'soir' })).toBeUndefined();
    expect(getSlotOccupant(state, { date: '2026-09-19', meal: 'midi' })?.recipeId).toBe(1);
    expect(state.plan).toHaveLength(1);
  });

  it('un créneau pris est remplacé : l’ancienne recette quitte le planning (elle retourne dans la pile)', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: '2026-09-17', meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-17', meal: 'soir' });

    expect(getSlotOccupant(state, { date: '2026-09-17', meal: 'soir' })?.recipeId).toBe(2);
    expect(getUpcomingEntry(state, 1)).toBeUndefined();
    expect(getPile([recipe(1), recipe(2)], state).map((item) => item.id)).toEqual([1]);
  });

  it('refuse un jour passé, un jour hors fenêtre et un repas inconnu', () => {
    const state = stateWith();
    expect(planRecipe(state, recipe(1), { date: '2026-09-15', meal: 'soir' })).toBe(state);
    expect(planRecipe(state, recipe(1), { date: '2026-09-24', meal: 'soir' })).toBe(state);
    expect(planRecipe(state, recipe(1), { date: '2026-09-17', meal: 'gouter' as never })).toBe(state);
    expect(getSlotOccupant(planRecipe(state, recipe(1), { date: TODAY_KEY, meal: 'soir' }), { date: TODAY_KEY, meal: 'soir' })?.recipeId).toBe(1);
  });

  it('conserve l’historique d’une recette cuisinée quand on la replanifie', () => {
    const cookedYesterday = pastEntry(1, '2026-09-15', true);
    const state = planRecipe(stateWith(cookedYesterday), recipe(1), { date: '2026-09-18', meal: 'soir' });

    expect(state.plan.map((item) => [item.date, item.cooked])).toEqual([
      ['2026-09-15', true],
      ['2026-09-18', false],
    ]);
  });

  it('remplace un repas passé non cuisiné quand on replanifie la recette', () => {
    const missed = pastEntry(1, '2026-09-15', false);
    const state = planRecipe(stateWith(missed), recipe(1), { date: '2026-09-18', meal: 'soir' });

    expect(state.plan.map((item) => item.date)).toEqual(['2026-09-18']);
  });

  it('retire une entrée sans toucher aux autres, et coche « cuisinée » par créneau', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: TODAY_KEY, meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: TODAY_KEY, meal: 'midi' });

    state = toggleCookedAt(state, { date: TODAY_KEY, meal: 'soir' });
    expect(getSlotOccupant(state, { date: TODAY_KEY, meal: 'soir' })?.cooked).toBe(true);
    expect(getSlotOccupant(state, { date: TODAY_KEY, meal: 'midi' })?.cooked).toBe(false);

    state = unplanSlot(state, { date: TODAY_KEY, meal: 'soir' });
    expect(state.plan.map((item) => item.recipeId)).toEqual([2]);
  });

  it('refuse de cocher « cuisinée » un repas à venir ou un créneau vide, mais l’accepte aujourd’hui et dans le passé', () => {
    let state = planRecipe(stateWith(pastEntry(9, '2026-09-15', false)), recipe(1), { date: TODAY_KEY, meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-17', meal: 'soir' });

    expect(toggleCookedAt(state, { date: '2026-09-17', meal: 'soir' })).toBe(state); // à venir
    expect(toggleCookedAt(state, { date: '2026-09-20', meal: 'soir' })).toBe(state); // créneau vide
    expect(getSlotOccupant(toggleCookedAt(state, { date: TODAY_KEY, meal: 'soir' }), { date: TODAY_KEY, meal: 'soir' })?.cooked).toBe(true);
    expect(getSlotOccupant(toggleCookedAt(state, { date: '2026-09-15', meal: 'soir' }), { date: '2026-09-15', meal: 'soir' })?.cooked).toBe(true);
  });

  it('expose les 8 jours à venir et les 7 jours passés avec leurs créneaux', () => {
    let state = planRecipe(stateWith(pastEntry(2, '2026-09-15', false)), recipe(1), { date: '2026-09-18', meal: 'midi' });

    const upcoming = getPlanDays(state);
    expect(upcoming).toHaveLength(8);
    expect(upcoming[0].date).toBe(TODAY_KEY);
    expect(upcoming[2].slots.midi?.recipeId).toBe(1);
    expect(upcoming[2].slots.soir).toBeUndefined();

    const history = getHistoryPlanDays(state);
    expect(history).toHaveLength(7);
    expect(history[6].date).toBe('2026-09-15');
    expect(history[6].slots.soir?.recipeId).toBe(2);
  });

  it('trie les repas à venir par date puis par repas et ignore les passés', () => {
    let state = stateWith(pastEntry(9, '2026-09-15', true));
    state = planRecipe(state, recipe(1), { date: '2026-09-18', meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-18', meal: 'midi' });
    state = planRecipe(state, recipe(3), { date: TODAY_KEY, meal: 'soir' });

    expect(getUpcomingEntries(state).map((item) => item.recipeId)).toEqual([3, 2, 1]);
  });

  it('compte les dîners libres', () => {
    let state = stateWith();
    expect(countFreeDinners(state)).toBe(8);
    state = planRecipe(state, recipe(1), { date: '2026-09-17', meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-18', meal: 'midi' }); // le midi ne compte pas
    expect(countFreeDinners(state)).toBe(7);
  });
});

describe('getPile (favoris à planifier)', () => {
  const favorites = [
    { ...recipe(1), addedAt: '2026-09-01T10:00:00.000Z' },
    { ...recipe(2), addedAt: '2026-09-10T10:00:00.000Z' },
    { ...recipe(3), addedAt: '2026-09-05T10:00:00.000Z' },
  ];

  it('exclut les favoris qui ont déjà un repas à venir', () => {
    const state = planRecipe(stateWith(), recipe(2), { date: '2026-09-17', meal: 'soir' });
    expect(getPile(favorites, state).map((item) => item.id)).toEqual([3, 1]);
  });

  it('remet un favori dans la pile quand son repas passé n’est plus à venir', () => {
    const state = stateWith(pastEntry(1, '2026-09-15', true));
    expect(getPile(favorites, state).map((item) => item.id)).toContain(1);
  });

  it('classe les jamais cuisinées d’abord (ajouts récents en tête), puis les cuisinées les plus anciennes', () => {
    const state = stateWith(pastEntry(1, '2026-09-14', true), pastEntry(3, '2026-09-10', true));
    const pile = getPile(favorites, state);

    expect(pile.map((item) => item.id)).toEqual([2, 3, 1]);
    expect(pile.find((item) => item.id === 3)?.lastCookedDate).toBe('2026-09-10');
    expect(pile.find((item) => item.id === 2)?.lastCookedDate).toBeUndefined();
  });

  it('une recette déjà cuisinée mais replanifiée n’est plus dans la pile', () => {
    let state = stateWith(pastEntry(1, '2026-09-14', true));
    state = planRecipe(state, recipe(1), { date: '2026-09-19', meal: 'soir' });
    expect(getPile(favorites, state).map((item) => item.id)).not.toContain(1);
  });
});

describe('le planning glisse avec le temps (normalizeState)', () => {
  it('un repas passé reste consultable 7 jours puis sort du planning, la recette retourne dans la pile', () => {
    const state = planRecipe(stateWith(), recipe(1), { date: '2026-09-17', meal: 'soir' });

    const later = roundTrip(state, new Date(2026, 8, 25, 9, 0, 0));
    expect(later.plan).toEqual([]);
    expect(getPile([recipe(1)], later).map((item) => item.id)).toEqual([1]);
  });

  it('un repas à venir reste en place quand la fenêtre avance, et de nouveaux jours deviennent planifiables', () => {
    const state = planRecipe(stateWith(), recipe(1), { date: '2026-09-19', meal: 'soir' });
    const restored = roundTrip(state, new Date(2026, 8, 17, 9, 0, 0));

    expect(restored.windowStart).toBe('2026-09-17');
    expect(getSlotOccupant(restored, { date: '2026-09-19', meal: 'soir' })?.recipeId).toBe(1);
    // Le jeudi 17, la fenêtre va jusqu’au jeudi 24 : ce jour n’était pas planifiable la veille
    const extended = planRecipe(restored, recipe(2), { date: '2026-09-24', meal: 'soir' });
    expect(getSlotOccupant(extended, { date: '2026-09-24', meal: 'soir' })?.recipeId).toBe(2);
  });
});

describe('autoPlan', () => {
  const pile = [recipe(1), recipe(2), recipe(3)];

  it('répartit la pile sur les prochains dîners à partir d’aujourd’hui', () => {
    const state = autoPlan(stateWith(), pile, WEDNESDAY);
    expect(getUpcomingEntries(state).map((item) => [item.recipeId, item.date, item.meal])).toEqual([
      [1, '2026-09-16', 'soir'],
      [2, '2026-09-17', 'soir'],
      [3, '2026-09-18', 'soir'],
    ]);
  });

  it('planifié un dimanche soir, il utilise les jours suivants (le problème du dimanche)', () => {
    const sunday = new Date(2026, 8, 20, 21, 0, 0);
    const state = autoPlan(createInitialState(sunday), [recipe(1), recipe(2), recipe(3), recipe(4)], sunday);

    expect(getUpcomingEntries(state).map((item) => item.date)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']);
  });

  it('n’utilise pas les créneaux déjà pris', () => {
    const taken = planRecipe(stateWith(), recipe(9), { date: '2026-09-16', meal: 'soir' });
    const state = autoPlan(taken, pile, WEDNESDAY);

    expect(getSlotOccupant(state, { date: '2026-09-16', meal: 'soir' })?.recipeId).toBe(9);
    expect(getUpcomingEntry(state, 1)?.date).toBe('2026-09-17');
  });

  it('laisse le reste de la pile quand il n’y a plus de dîner libre', () => {
    const bigPile = Array.from({ length: 12 }, (_, index) => recipe(index + 1));
    const state = autoPlan(stateWith(), bigPile, WEDNESDAY);

    expect(getUpcomingEntries(state)).toHaveLength(8);
    expect(countFreeDinners(state)).toBe(0);
    expect(getPile(bigPile, state).map((item) => item.id)).toEqual([9, 10, 11, 12]);
  });

  it('place les recettes longues le week-end quand les durées sont connues', () => {
    const durations = new Map([
      [1, 90],
      [2, 20],
      [3, 25],
    ]);
    const state = autoPlan(stateWith(), pile, WEDNESDAY, durations);

    expect(getUpcomingEntry(state, 1)?.date).toBe('2026-09-19'); // samedi
    expect(getUpcomingEntry(state, 2)?.date).toBe('2026-09-16');
    expect(getUpcomingEntry(state, 3)?.date).toBe('2026-09-17');
  });

  it('ne déplace pas les recettes courtes vers le week-end', () => {
    const state = autoPlan(stateWith(), [recipe(1)], WEDNESDAY, new Map([[1, 20]]));
    expect(getUpcomingEntry(state, 1)?.date).toBe('2026-09-16');
  });

  it('ne touche ni au midi ni à l’état quand la pile est vide', () => {
    const state = stateWith();
    expect(autoPlan(state, [], WEDNESDAY)).toBe(state);

    const planned = autoPlan(state, [recipe(1)], WEDNESDAY);
    expect(planned.plan.every((item) => item.meal === 'soir')).toBe(true);
  });
});

describe('autoPlan avec le midi', () => {
  const lunchState = (): SwipeState => {
    const base = createInitialState(WEDNESDAY);
    return { ...base, prefs: { ...base.prefs, showLunch: true } };
  };
  const bigPile = (count: number) => Array.from({ length: count }, (_, index) => recipe(index + 1));

  it('remplit les dîners d’abord, puis les déjeuners avec les recettes restantes', () => {
    const state = autoPlan(lunchState(), bigPile(10), WEDNESDAY);
    const entries = getUpcomingEntries(state);

    expect(entries.filter((entry) => entry.meal === 'soir').map((entry) => entry.recipeId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(entries.filter((entry) => entry.meal === 'midi').map((entry) => [entry.recipeId, entry.date])).toEqual([
      [9, '2026-09-16'],
      [10, '2026-09-17'],
    ]);
  });

  it('ne touche pas au midi quand la pile tient dans les dîners', () => {
    const state = autoPlan(lunchState(), bigPile(3), WEDNESDAY);
    expect(getUpcomingEntries(state).every((entry) => entry.meal === 'soir')).toBe(true);
  });

  it('sans l’interrupteur, le midi reste vide même avec une grosse pile', () => {
    const state = autoPlan(stateWith(), bigPile(12), WEDNESDAY);
    expect(getUpcomingEntries(state)).toHaveLength(8);
    expect(getUpcomingEntries(state).every((entry) => entry.meal === 'soir')).toBe(true);
  });

  it('saute le déjeuner d’aujourd’hui l’après-midi', () => {
    const evening = new Date(2026, 8, 16, 20, 0, 0);
    const state = autoPlan(lunchState(), bigPile(10), evening);
    const lunches = getUpcomingEntries(state).filter((entry) => entry.meal === 'midi');

    expect(lunches.map((entry) => entry.date)).toEqual(['2026-09-17', '2026-09-18']);
  });

  it('compte les repas à pourvoir selon l’interrupteur du midi', () => {
    expect(countFreeSlots(stateWith())).toBe(8);

    let state = lunchState();
    expect(countFreeSlots(state)).toBe(16);
    state = planRecipe(state, recipe(1), { date: '2026-09-17', meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-17', meal: 'midi' });
    expect(countFreeSlots(state)).toBe(14);
  });
});

describe('getNextFreeSlot (enchaîner les ajouts)', () => {
  const lunchState = (): SwipeState => {
    const base = createInitialState(WEDNESDAY);
    return { ...base, prefs: { ...base.prefs, showLunch: true } };
  };

  it('sans point de départ, renvoie le premier dîner libre', () => {
    expect(getNextFreeSlot(stateWith(), null, WEDNESDAY)).toEqual({ date: TODAY_KEY, meal: 'soir' });
  });

  it('saute les créneaux occupés', () => {
    const state = planRecipe(stateWith(), recipe(1), { date: TODAY_KEY, meal: 'soir' });
    expect(getNextFreeSlot(state, null, WEDNESDAY)).toEqual({ date: '2026-09-17', meal: 'soir' });
  });

  it('renvoie le créneau libre qui suit strictement celui donné', () => {
    expect(getNextFreeSlot(stateWith(), { date: TODAY_KEY, meal: 'soir' }, WEDNESDAY)).toEqual({
      date: '2026-09-17',
      meal: 'soir',
    });
  });

  it('avec le midi affiché, le midi passe avant le soir du même jour', () => {
    expect(getNextFreeSlot(lunchState(), null, WEDNESDAY)).toEqual({ date: TODAY_KEY, meal: 'midi' });
    expect(getNextFreeSlot(lunchState(), { date: TODAY_KEY, meal: 'midi' }, WEDNESDAY)).toEqual({
      date: TODAY_KEY,
      meal: 'soir',
    });
  });

  it('ignore le déjeuner d’aujourd’hui l’après-midi', () => {
    const evening = new Date(2026, 8, 16, 20, 0, 0);
    expect(getNextFreeSlot(lunchState(), null, evening)).toEqual({ date: TODAY_KEY, meal: 'soir' });
  });

  it('renvoie null quand il ne reste plus de créneau libre', () => {
    let state = stateWith();
    getWindowDays(state.windowStart).forEach((date, index) => {
      state = planRecipe(state, recipe(index + 1), { date, meal: 'soir' });
    });
    expect(getNextFreeSlot(state, null, WEDNESDAY)).toBeNull();
    expect(getNextFreeSlot(stateWith(), { date: '2026-09-23', meal: 'soir' }, WEDNESDAY)).toBeNull();
  });
});

describe('getNextMeal / formatMealWhen (accueil)', () => {
  const dinner = (date: string) => ({ date, meal: 'soir' as const });

  it('renvoie le prochain repas prévu, dans l’ordre du calendrier', () => {
    let state = planRecipe(stateWith(), recipe(2), dinner('2026-09-18'));
    state = planRecipe(state, recipe(1), dinner('2026-09-17'));
    expect(getNextMeal(state, WEDNESDAY)?.recipeId).toBe(1);
  });

  it('renvoie undefined quand rien n’est prévu', () => {
    expect(getNextMeal(stateWith(), WEDNESDAY)).toBeUndefined();
  });

  it('saute un repas déjà cuisiné', () => {
    let state = planRecipe(stateWith(), recipe(1), dinner(TODAY_KEY));
    state = planRecipe(state, recipe(2), dinner('2026-09-17'));
    state = toggleCookedAt(state, dinner(TODAY_KEY));
    expect(getNextMeal(state, WEDNESDAY)?.recipeId).toBe(2);
  });

  it('le déjeuner d’aujourd’hui ne compte plus l’après-midi', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: TODAY_KEY, meal: 'midi' });
    state = planRecipe(state, recipe(2), dinner(TODAY_KEY));
    expect(getNextMeal(state, WEDNESDAY)?.recipeId).toBe(1);
    expect(getNextMeal(state, new Date(2026, 8, 16, 15, 0, 0))?.recipeId).toBe(2);
  });

  it('formate le moment du repas', () => {
    expect(formatMealWhen(dinner(TODAY_KEY), WEDNESDAY)).toBe('Ce soir');
    expect(formatMealWhen({ date: TODAY_KEY, meal: 'midi' }, WEDNESDAY)).toBe('Ce midi');
    expect(formatMealWhen(dinner('2026-09-17'), WEDNESDAY)).toBe('Demain · soir');
    expect(formatMealWhen({ date: '2026-09-19', meal: 'midi' }, WEDNESDAY)).toBe(
      `${formatDayLabel('2026-09-19', 'short')} · midi`
    );
  });
});

describe('getQuickSlots (raccourcis de placement)', () => {
  const summary = (state: SwipeState) =>
    getQuickSlots(state, WEDNESDAY).map(({ label, slot }) => `${label} ${slot.date} ${slot.meal}`);

  it('propose ce soir et demain soir quand ils sont libres', () => {
    expect(summary(stateWith())).toEqual(['Ce soir 2026-09-16 soir', 'Demain soir 2026-09-17 soir']);
  });

  it('ne propose pas un soir déjà occupé', () => {
    const state = planRecipe(stateWith(), recipe(1), { date: TODAY_KEY, meal: 'soir' });
    expect(summary(state)).toEqual(['Demain soir 2026-09-17 soir']);
  });

  it('ajoute le prochain créneau libre quand ce soir et demain sont pris', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: TODAY_KEY, meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-17', meal: 'soir' });
    expect(summary(state)).toEqual(['Prochain libre 2026-09-18 soir']);
  });

  it('avec le midi affiché, le prochain libre peut être le déjeuner d’aujourd’hui', () => {
    const base = stateWith();
    const state: SwipeState = { ...base, prefs: { ...base.prefs, showLunch: true } };
    expect(summary(state)).toEqual([
      'Ce soir 2026-09-16 soir',
      'Demain soir 2026-09-17 soir',
      'Prochain libre 2026-09-16 midi',
    ]);
  });

  it('ne renvoie rien quand tout est occupé', () => {
    let state = stateWith();
    getWindowDays(state.windowStart).forEach((date, index) => {
      state = planRecipe(state, recipe(index + 1), { date, meal: 'soir' });
    });
    expect(summary(state)).toEqual([]);
  });
});

describe('getShoppingEntries (courses)', () => {
  it('exclut les repas déjà cuisinés (aujourd’hui compris) et les repas passés', () => {
    let state = stateWith(pastEntry(9, '2026-09-15', false)); // passé : jamais dans les courses
    state = planRecipe(state, recipe(1), { date: TODAY_KEY, meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: TODAY_KEY, meal: 'midi' });
    state = planRecipe(state, recipe(3), { date: '2026-09-18', meal: 'soir' });

    state = toggleCookedAt(state, { date: TODAY_KEY, meal: 'soir' }); // recette 1 cuisinée ce soir

    expect(getShoppingEntries(state).map((entry) => entry.recipeId)).toEqual([2, 3]);
  });

  it('une recette décochée redevient éligible aux courses', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: TODAY_KEY, meal: 'soir' });
    state = toggleCookedAt(state, { date: TODAY_KEY, meal: 'soir' });
    expect(getShoppingEntries(state)).toEqual([]);

    state = toggleCookedAt(state, { date: TODAY_KEY, meal: 'soir' });
    expect(getShoppingEntries(state).map((entry) => entry.recipeId)).toEqual([1]);
  });

  it('renvoie une liste vide quand rien n’est planifié', () => {
    expect(getShoppingEntries(stateWith())).toEqual([]);
  });
});

describe('getPlanEvents', () => {
  it('produit un événement par repas à venir, triés par date puis par repas', () => {
    let state = planRecipe(stateWith(), recipe(1), { date: '2026-09-17', meal: 'soir' });
    state = planRecipe(state, recipe(2), { date: '2026-09-17', meal: 'midi' });

    const events = getPlanEvents(state, 'https://4epices.fr', new Map([[1, 90]]));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ date: '2026-09-17', time: '12:30', summary: 'Déjeuner : Recette 2', durationMinutes: 60 });
    expect(events[1]).toMatchObject({ time: '19:30', summary: 'Dîner : Recette 1', durationMinutes: 90 });
    expect(events[1].url).toBe('https://4epices.fr/recettes/recette-1');
  });

  it('n’exporte pas les jours passés', () => {
    let state = stateWith(pastEntry(1, '2026-09-15', false));
    state = planRecipe(state, recipe(2), { date: '2026-09-16', meal: 'soir' });

    expect(getPlanEvents(state, 'https://4epices.fr').map((event) => event.date)).toEqual(['2026-09-16']);
  });
});

describe('libellés de date', () => {
  it('formate en français', () => {
    expect(formatDayLabel('2026-09-14')).toMatch(/lundi.*14.*septembre/);
    expect(formatDayLabel('2026-09-14', 'short')).toMatch(/lun.*14/);
    expect(formatSlotLabel({ date: '2026-09-14', meal: 'soir' })).toMatch(/lundi.*septembre · soir/);
    expect(formatDayLabel('pas une date')).toBe('pas une date');
  });
});
