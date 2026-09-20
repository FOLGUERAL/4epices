/**
 * Planification des repas dans un calendrier glissant.
 *
 * Module pur, comme lib/swipeEngine.ts. Un créneau est un couple (jour, repas) qui contient au plus une entrée
 * du planning. La « pile » à planifier est dérivée : ce sont les favoris qui n'ont pas de repas à venir.
 * Une recette peut avoir plusieurs occurrences dans le temps (l'historique est conservé), mais une seule à venir.
 */

import type { IcsEvent } from '@/lib/ics';
import {
  formatLocalDate,
  getDayRange,
  getHistoryDays,
  getWindowDays,
  parseLocalDate,
  type PlanEntry,
  type PlanMeal,
  type SwipeState,
} from '@/lib/swipeEngine';

export const PLAN_MEALS: readonly PlanMeal[] = ['midi', 'soir'];
export const MEAL_LABELS: Record<PlanMeal, string> = { midi: 'Midi', soir: 'Soir' };

const MEAL_EVENT_LABELS: Record<PlanMeal, string> = { midi: 'Déjeuner', soir: 'Dîner' };
const MEAL_START_TIMES: Record<PlanMeal, string> = { midi: '12:30', soir: '19:30' };
const DEFAULT_EVENT_MINUTES = 60;
const MIN_EVENT_MINUTES = 45;
/** À partir de cette durée, une recette est plutôt réservée au week-end par la répartition automatique */
export const LONG_RECIPE_MINUTES = 45;
/** Passée cette heure, le déjeuner d'aujourd'hui n'est plus proposé par la répartition automatique */
const LUNCH_CUTOFF_HOUR = 14;

export interface PlanSlot {
  date: string;
  meal: PlanMeal;
}

export interface PlanDay {
  date: string;
  slots: Record<PlanMeal, PlanEntry | undefined>;
}

/** Ce qu'il faut savoir d'une recette pour la placer dans le planning. */
export interface PlannableRecipe {
  id: number;
  slug: string;
  titre: string;
  imageUrl?: string | null;
}

/** Une recette de la pile « à planifier » (un favori sans repas à venir). */
export interface PileRecipe extends PlannableRecipe {
  /** Date de la dernière fois où elle a été cuisinée (AAAA-MM-JJ), si l'historique la connaît */
  lastCookedDate?: string;
  addedAt?: string;
}

export function getSlotOccupant(state: SwipeState, slot: PlanSlot): PlanEntry | undefined {
  return state.plan.find((entry) => entry.date === slot.date && entry.meal === slot.meal);
}

function isUpcoming(state: SwipeState, entry: PlanEntry): boolean {
  return entry.date >= state.windowStart;
}

/** Les repas à venir (aujourd'hui compris), triés par date puis par repas. */
export function getUpcomingEntries(state: SwipeState): PlanEntry[] {
  return state.plan
    .filter((entry) => isUpcoming(state, entry))
    .sort(
      (a, b) => a.date.localeCompare(b.date) || PLAN_MEALS.indexOf(a.meal) - PLAN_MEALS.indexOf(b.meal)
    );
}

/** Le repas à venir d'une recette, s'il y en a un. */
export function getUpcomingEntry(state: SwipeState, recipeId: number): PlanEntry | undefined {
  return getUpcomingEntries(state).find((entry) => entry.recipeId === recipeId);
}

/**
 * Les repas dont il faut acheter les ingrédients : à venir (aujourd'hui compris) et pas encore cuisinés.
 * Une recette déjà cuisinée a eu ses ingrédients achetés et utilisés : on ne les remet pas dans la liste.
 */
export function getShoppingEntries(state: SwipeState): PlanEntry[] {
  const seen = new Set<number>();
  return getUpcomingEntries(state).filter((entry) => {
    if (entry.cooked || seen.has(entry.recipeId)) return false;
    seen.add(entry.recipeId);
    return true;
  });
}

function buildPlanDay(state: SwipeState, date: string): PlanDay {
  return {
    date,
    slots: {
      midi: getSlotOccupant(state, { date, meal: 'midi' }),
      soir: getSlotOccupant(state, { date, meal: 'soir' }),
    },
  };
}

/** Les jours à venir (aujourd'hui et les 7 suivants) avec l'occupant de chaque créneau. */
export function getPlanDays(state: SwipeState): PlanDay[] {
  return getWindowDays(state.windowStart).map((date) => buildPlanDay(state, date));
}

/** Les 7 jours passés encore consultables, du plus ancien au plus récent. */
export function getHistoryPlanDays(state: SwipeState): PlanDay[] {
  return getHistoryDays(state.windowStart).map((date) => buildPlanDay(state, date));
}

/** Nombre de dîners encore libres à partir d'aujourd'hui. */
export function countFreeDinners(state: SwipeState): number {
  return getWindowDays(state.windowStart).filter((date) => !getSlotOccupant(state, { date, meal: 'soir' })).length;
}

/** « 1 dîner », « 3 dîners » ou « 5 repas » (quand le midi est affiché, on compte des repas). */
export function formatMealCount(count: number, includeLunch: boolean): string {
  if (includeLunch) return `${count} repas`;
  return `${count} ${count === 1 ? 'dîner' : 'dîners'}`;
}

/** Nombre de repas à pourvoir : les dîners libres, plus les déjeuners libres quand le midi est affiché. */
export function countFreeSlots(state: SwipeState): number {
  const lunches = state.prefs.showLunch
    ? getWindowDays(state.windowStart).filter((date) => !getSlotOccupant(state, { date, meal: 'midi' })).length
    : 0;
  return countFreeDinners(state) + lunches;
}

/**
 * Place une recette sur un créneau d'aujourd'hui ou des 7 jours suivants (jamais sur un jour passé).
 * - l'occupant éventuel du créneau est retiré du planning (il retourne dans la pile) ;
 * - si la recette avait déjà un repas à venir, ou un repas passé non cuisiné, il est déplacé ;
 * - les repas passés cuisinés sont conservés (historique).
 */
export function planRecipe(state: SwipeState, recipe: PlannableRecipe, slot: PlanSlot): SwipeState {
  if (!PLAN_MEALS.includes(slot.meal) || !getWindowDays(state.windowStart).includes(slot.date)) return state;

  const remaining = state.plan.filter((entry) => {
    if (entry.date === slot.date && entry.meal === slot.meal) return false;
    if (entry.recipeId === recipe.id && (isUpcoming(state, entry) || !entry.cooked)) return false;
    return true;
  });

  const entry: PlanEntry = {
    recipeId: recipe.id,
    slug: recipe.slug,
    titre: recipe.titre,
    imageUrl: recipe.imageUrl ?? null,
    date: slot.date,
    meal: slot.meal,
    cooked: false,
  };
  return { ...state, plan: [...remaining, entry] };
}

/** Retire l'entrée d'un créneau : la recette retourne dans la pile (elle reste dans les favoris). */
export function unplanSlot(state: SwipeState, slot: PlanSlot): SwipeState {
  return {
    ...state,
    plan: state.plan.filter((entry) => !(entry.date === slot.date && entry.meal === slot.meal)),
  };
}

/** Coche ou décoche « cuisinée ». Refusé pour un jour à venir : un repas qui n'a pas eu lieu n'est pas cuisiné. */
export function toggleCookedAt(state: SwipeState, slot: PlanSlot): SwipeState {
  const entry = getSlotOccupant(state, slot);
  if (!entry || entry.date > state.windowStart) return state;

  return {
    ...state,
    plan: state.plan.map((item) =>
      item.date === slot.date && item.meal === slot.meal ? { ...item, cooked: !item.cooked } : item
    ),
  };
}

/**
 * La pile « à planifier » : les favoris sans repas à venir. Les recettes jamais cuisinées passent en premier,
 * puis celles cuisinées il y a le plus longtemps ; à égalité, les ajouts les plus récents d'abord.
 */
export function getPile(
  favorites: Array<PlannableRecipe & { addedAt?: string }>,
  state: SwipeState
): PileRecipe[] {
  const planned = new Set(getUpcomingEntries(state).map((entry) => entry.recipeId));

  const lastCooked = new Map<number, string>();
  for (const entry of state.plan) {
    if (!entry.cooked) continue;
    const previous = lastCooked.get(entry.recipeId);
    if (!previous || entry.date > previous) lastCooked.set(entry.recipeId, entry.date);
  }

  return favorites
    .filter((favorite) => !planned.has(favorite.id))
    .map((favorite) => ({ ...favorite, lastCookedDate: lastCooked.get(favorite.id) }))
    .sort((a, b) => {
      if (a.lastCookedDate && b.lastCookedDate) {
        if (a.lastCookedDate !== b.lastCookedDate) return a.lastCookedDate.localeCompare(b.lastCookedDate);
      } else if (a.lastCookedDate || b.lastCookedDate) {
        return a.lastCookedDate ? 1 : -1;
      }
      return (b.addedAt ?? '').localeCompare(a.addedAt ?? '');
    });
}

function isWeekend(date: string): boolean {
  const parsed = parseLocalDate(date);
  return parsed !== null && (parsed.getDay() === 0 || parsed.getDay() === 6);
}

/**
 * Associe des recettes à des créneaux libres. Avec les durées connues, les recettes longues passent en priorité
 * sur les créneaux du week-end ; le reste suit l'ordre donné, dans l'ordre chronologique des créneaux.
 */
function assignToSlots(
  recipes: PlannableRecipe[],
  slots: PlanSlot[],
  durations?: Map<number, number>
): Map<number, PlanSlot> {
  const assignments = new Map<number, PlanSlot>();
  if (slots.length === 0 || recipes.length === 0) return assignments;

  const weekendSlots = slots.filter((slot) => isWeekend(slot.date));
  const longRecipes = recipes
    .filter((recipe) => (durations?.get(recipe.id) ?? 0) >= LONG_RECIPE_MINUTES)
    .sort((a, b) => (durations?.get(b.id) ?? 0) - (durations?.get(a.id) ?? 0))
    .slice(0, weekendSlots.length);
  longRecipes.forEach((recipe, index) => assignments.set(recipe.id, weekendSlots[index]));

  const usedSlots = new Set(longRecipes.map((_, index) => weekendSlots[index]));
  const otherSlots = slots.filter((slot) => !usedSlots.has(slot));
  recipes
    .filter((recipe) => !assignments.has(recipe.id))
    .slice(0, otherSlots.length)
    .forEach((recipe, index) => assignments.set(recipe.id, otherSlots[index]));

  return assignments;
}

/** Les créneaux libres à partir d'aujourd'hui : les dîners, puis (si le midi est affiché) les déjeuners. */
function getFreeSlots(state: SwipeState, today: Date): { dinners: PlanSlot[]; lunches: PlanSlot[] } {
  const todayKey = formatLocalDate(today);
  const days = getWindowDays(state.windowStart).filter((date) => date >= todayKey);

  const dinners = days
    .map((date) => ({ date, meal: 'soir' as const }))
    .filter((slot) => !getSlotOccupant(state, slot));

  // Le déjeuner d'aujourd'hui n'est plus planifiable une fois l'après-midi commencé
  const lunches = state.prefs.showLunch
    ? days
        .filter((date) => !(date === todayKey && today.getHours() >= LUNCH_CUTOFF_HOUR))
        .map((date) => ({ date, meal: 'midi' as const }))
        .filter((slot) => !getSlotOccupant(state, slot))
    : [];

  return { dinners, lunches };
}

/**
 * Le premier créneau libre strictement après `after` (ou le tout premier si `after` est null), dans l'ordre du
 * calendrier : par jour, le midi avant le soir. Sert à enchaîner les ajouts. null quand il n'y en a plus.
 */
export function getNextFreeSlot(state: SwipeState, after: PlanSlot | null, today: Date): PlanSlot | null {
  const { dinners, lunches } = getFreeSlots(state, today);
  const order = (slot: PlanSlot) => `${slot.date}|${PLAN_MEALS.indexOf(slot.meal)}`;
  const afterKey = after ? order(after) : null;

  return (
    [...dinners, ...lunches]
      .sort((a, b) => order(a).localeCompare(order(b)))
      .find((slot) => afterKey === null || order(slot) > afterKey) ?? null
  );
}

/**
 * Le prochain repas à cuisiner : à venir (aujourd'hui compris) et pas encore cuisiné.
 * Le déjeuner d'aujourd'hui compte jusqu'à 14 h, comme pour la répartition automatique.
 */
export function getNextMeal(state: SwipeState, now: Date): PlanEntry | undefined {
  const todayKey = formatLocalDate(now);
  return getUpcomingEntries(state).find((entry) => {
    if (entry.cooked || entry.date < todayKey) return false;
    return !(entry.date === todayKey && entry.meal === 'midi' && now.getHours() >= LUNCH_CUTOFF_HOUR);
  });
}

/** « Ce soir », « Ce midi », « Demain · soir », « jeu. 18 · midi » */
export function formatMealWhen(slot: PlanSlot, now: Date): string {
  const todayKey = formatLocalDate(now);
  const meal = MEAL_LABELS[slot.meal].toLowerCase();
  if (slot.date === todayKey) return slot.meal === 'soir' ? 'Ce soir' : 'Ce midi';
  if (slot.date === getDayRange(todayKey, 1, 1)[0]) return `Demain · ${meal}`;
  return `${formatDayLabel(slot.date, 'short')} · ${meal}`;
}

export interface QuickSlot {
  label: string;
  slot: PlanSlot;
}

/**
 * Raccourcis pour placer une recette en un geste : ce soir, demain soir, puis le prochain créneau libre
 * s'il n'est pas déjà l'un des deux. Seuls les créneaux libres sont proposés.
 */
export function getQuickSlots(state: SwipeState, today: Date): QuickSlot[] {
  const windowDays = getWindowDays(state.windowStart);
  const todayKey = formatLocalDate(today);
  const tomorrowKey = getDayRange(todayKey, 1, 1)[0];

  const candidates: QuickSlot[] = [
    { label: 'Ce soir', slot: { date: todayKey, meal: 'soir' } },
    { label: 'Demain soir', slot: { date: tomorrowKey, meal: 'soir' } },
  ];
  const shortcuts = candidates.filter(
    ({ slot }) => windowDays.includes(slot.date) && !getSlotOccupant(state, slot)
  );

  const next = getNextFreeSlot(state, null, today);
  if (next && !shortcuts.some(({ slot }) => slot.date === next.date && slot.meal === next.meal)) {
    shortcuts.push({ label: 'Prochain libre', slot: next });
  }
  return shortcuts;
}

/**
 * Répartit des recettes de la pile sur les créneaux libres, à partir d'aujourd'hui : les dîners d'abord, puis, si le
 * midi est affiché, les déjeuners avec les recettes restantes. Ne touche pas aux repas déjà planifiés.
 */
export function autoPlan(
  state: SwipeState,
  pile: PlannableRecipe[],
  today: Date,
  durations?: Map<number, number>
): SwipeState {
  const { dinners, lunches } = getFreeSlots(state, today);
  if (dinners.length + lunches.length === 0 || pile.length === 0) return state;

  const dinnerAssignments = assignToSlots(pile, dinners, durations);
  const remaining = pile.filter((recipe) => !dinnerAssignments.has(recipe.id));
  const lunchAssignments = assignToSlots(remaining, lunches, durations);

  let next = state;
  for (const recipe of pile) {
    const slot = dinnerAssignments.get(recipe.id) ?? lunchAssignments.get(recipe.id);
    if (slot) next = planRecipe(next, recipe, slot);
  }
  return next;
}

/** Événements de calendrier des repas à venir, triés par date puis par repas. */
export function getPlanEvents(state: SwipeState, siteUrl: string, durations?: Map<number, number>): IcsEvent[] {
  return getUpcomingEntries(state).map((entry) => ({
    uid: `${entry.recipeId}-${entry.date}-${entry.meal}@4epices`,
    date: entry.date,
    time: MEAL_START_TIMES[entry.meal],
    durationMinutes: Math.max(MIN_EVENT_MINUTES, durations?.get(entry.recipeId) || DEFAULT_EVENT_MINUTES),
    summary: `${MEAL_EVENT_LABELS[entry.meal]} : ${entry.titre}`,
    description: `Recette ${entry.titre} sur 4épices`,
    url: `${siteUrl}/recettes/${entry.slug}`,
  }));
}

const LONG_DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const SHORT_DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });

/** « lundi 14 septembre » (ou « lun. 14 » en version courte) */
export function formatDayLabel(date: string, style: 'long' | 'short' = 'long'): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return date;
  return (style === 'long' ? LONG_DAY_FORMAT : SHORT_DAY_FORMAT).format(parsed);
}

/** « lundi 14 septembre · soir » */
export function formatSlotLabel(slot: PlanSlot): string {
  return `${formatDayLabel(slot.date)} · ${MEAL_LABELS[slot.meal].toLowerCase()}`;
}
