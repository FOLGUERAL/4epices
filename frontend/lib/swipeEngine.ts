/**
 * Moteur du swipe de recettes et du planning.
 *
 * Modèle : les recettes gardées au swipe rejoignent les favoris (la « pile » à planifier, gérée par
 * lib/favorites.ts). Ce module ne conserve que le planning (des occurrences : une recette, un jour, un repas),
 * les recettes refusées et les préférences. Il est pur : aucun accès à React, au DOM ni au localStorage
 * (le stockage est dans lib/swipeStorage.ts), donc testable.
 */

export const REFUSAL_COOLDOWN_DAYS = 28;
export const QUICK_MINUTES = 30;
export const WEEK_ROUND_SIZE = 12;
export const TONIGHT_ROUND_SIZE = 8;
/** Jours affichés à partir d'aujourd'hui : aujourd'hui et les 7 suivants */
export const WINDOW_DAYS = 8;
/** Jours passés que l'on peut encore consulter et corriger */
export const HISTORY_DAYS = 7;

// Pondération de la pioche
const VARIETY_PENALTY = 0.5;
const ECONOMICAL_BONUS_PER_SHARED_INGREDIENT = 0.2;
const ECONOMICAL_MAX_SHARED_INGREDIENTS = 3;
const VARIETY_LOOKBACK = 2;

export type SwipeMode = 'week' | 'tonight';

/** Repas d'une journée sur lequel une recette peut être planifiée */
export type PlanMeal = 'midi' | 'soir';

/** Carte légère envoyée au client (une par recette publiée). */
export interface SwipeRecipe {
  id: number;
  slug: string;
  titre: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string;
  totalMinutes: number;
  difficulte?: string;
  categorySlugs: string[];
  ingredientSlugs: string[];
}

/**
 * Une recette placée sur un créneau (jour + repas). Le titre, le slug et l'image sont copiés : l'entrée reste
 * lisible même si la recette quitte les favoris. Un créneau contient au plus une entrée.
 */
export interface PlanEntry {
  recipeId: number;
  slug: string;
  titre: string;
  imageUrl: string | null;
  /** AAAA-MM-JJ, heure locale */
  date: string;
  meal: PlanMeal;
  cooked: boolean;
}

export interface SwipePrefs {
  /** null = aucune limite de durée */
  maxMinutes: number | null;
  /** Proposer plus souvent des recettes qui partagent des ingrédients avec celles déjà prévues ou gardées */
  economical: boolean;
  /** Affiche aussi le repas du midi dans le calendrier (le soir est toujours affiché) */
  showLunch: boolean;
}

export interface SwipeState {
  /** Premier jour de la fenêtre glissante : le jour courant (AAAA-MM-JJ, heure locale) */
  windowStart: string;
  plan: PlanEntry[];
  /** id de recette → date ISO du refus */
  refused: Record<string, string>;
  prefs: SwipePrefs;
}

export interface Decision {
  type: 'keep' | 'pass';
  recipeId: number;
}

export function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Premier jour de la fenêtre glissante : le jour de `date`, en heure locale. */
export function getWindowStart(date: Date = new Date()): string {
  return formatLocalDate(date);
}

/** Lit une date AAAA-MM-JJ stricte (jour et mois réels) en heure locale, ou null. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

/**
 * `count` jours (AAAA-MM-JJ) à partir de `windowStart` décalé de `offset` jours (négatif = passé).
 * Construits par jour du mois : sans dérive à l'heure d'été.
 */
export function getDayRange(windowStart: string, offset: number, count: number): string[] {
  const start = parseLocalDate(windowStart);
  if (!start) return [];
  return Array.from({ length: count }, (_, index) =>
    formatLocalDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + index))
  );
}

/** Les jours à venir : aujourd'hui et les 7 suivants. */
export function getWindowDays(windowStart: string): string[] {
  return getDayRange(windowStart, 0, WINDOW_DAYS);
}

/** Les 7 jours passés encore consultables, du plus ancien au plus récent. */
export function getHistoryDays(windowStart: string): string[] {
  return getDayRange(windowStart, -HISTORY_DAYS, HISTORY_DAYS);
}

/** Un jour peut porter un créneau s'il est dans les 7 jours passés ou dans la fenêtre à venir. */
export function isDateInPlanRange(date: string, windowStart: string): boolean {
  return getDayRange(windowStart, -HISTORY_DAYS, HISTORY_DAYS + WINDOW_DAYS).includes(date);
}

export function createInitialState(now: Date = new Date()): SwipeState {
  return {
    windowStart: getWindowStart(now),
    plan: [],
    refused: {},
    prefs: { maxMinutes: null, economical: true, showLunch: false },
  };
}

function pruneRefusals(refused: Record<string, string>, now: Date): Record<string, string> {
  const limit = REFUSAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const result: Record<string, string> = {};
  for (const [id, date] of Object.entries(refused)) {
    const time = Date.parse(date);
    if (Number.isFinite(time) && now.getTime() - time < limit) result[id] = date;
  }
  return result;
}

/**
 * Valide un état lu depuis le stockage (donnée non fiable) et le met à jour pour le jour courant :
 * - la fenêtre repart d'aujourd'hui (aujourd'hui + 7 jours) ; les 7 jours passés restent consultables ;
 * - une entrée hors de cette plage, incomplète ou en double sur un même créneau est écartée ;
 * - les refus expirés sont purgés.
 * Un ancien état (champ `kept`) est ignoré : la fonctionnalité n'était pas encore en production.
 */
export function normalizeState(raw: unknown, now: Date = new Date()): SwipeState {
  const initial = createInitialState(now);
  if (!raw || typeof raw !== 'object') return initial;
  const data = raw as Partial<SwipeState>;
  const today = initial.windowStart;

  const plan: PlanEntry[] = [];
  const takenSlots = new Set<string>();
  if (Array.isArray(data.plan)) {
    for (const item of data.plan) {
      if (!item || typeof item.recipeId !== 'number') continue;
      if (typeof item.slug !== 'string' || typeof item.titre !== 'string') continue;
      if (item.meal !== 'midi' && item.meal !== 'soir') continue;
      if (typeof item.date !== 'string' || !isDateInPlanRange(item.date, today)) continue;

      const slotKey = `${item.date}|${item.meal}`;
      if (takenSlots.has(slotKey)) continue;
      takenSlots.add(slotKey);

      plan.push({
        recipeId: item.recipeId,
        slug: item.slug,
        titre: item.titre,
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
        date: item.date,
        meal: item.meal,
        // Un repas à venir ne peut pas être « cuisiné »
        cooked: item.cooked === true && item.date <= today,
      });
    }
  }

  const refused =
    data.refused && typeof data.refused === 'object' && !Array.isArray(data.refused)
      ? pruneRefusals(data.refused as Record<string, string>, now)
      : {};

  const prefs: SwipePrefs = {
    maxMinutes:
      typeof data.prefs?.maxMinutes === 'number' && data.prefs.maxMinutes > 0 ? data.prefs.maxMinutes : null,
    economical: data.prefs?.economical !== false,
    showLunch: data.prefs?.showLunch === true,
  };

  return { windowStart: today, plan, refused, prefs };
}

export function refuseRecipe(state: SwipeState, recipe: { id: number }, now: Date = new Date()): SwipeState {
  return { ...state, refused: { ...state.refused, [String(recipe.id)]: now.toISOString() } };
}

/** Annule un refus (bouton « annuler » du swipe). */
export function undoRefusal(state: SwipeState, recipeId: number): SwipeState {
  const refused = { ...state.refused };
  delete refused[String(recipeId)];
  return { ...state, refused };
}

export function clearRefusals(state: SwipeState): SwipeState {
  return { ...state, refused: {} };
}

export function setPrefs(state: SwipeState, prefs: Partial<SwipePrefs>): SwipeState {
  return { ...state, prefs: { ...state.prefs, ...prefs } };
}

export function getRoundSize(mode: SwipeMode): number {
  return mode === 'tonight' ? TONIGHT_ROUND_SIZE : WEEK_ROUND_SIZE;
}

/** Score aléatoire de base par recette, tiré une fois par partie pour que l'ordre reste stable. */
export function createBaseScores(recipes: SwipeRecipe[], random: () => number = Math.random): Map<number, number> {
  return new Map(recipes.map((recipe) => [recipe.id, random()]));
}

function sharesCategoryOrIngredient(a: SwipeRecipe, b: SwipeRecipe): boolean {
  return (
    a.categorySlugs.some((slug) => b.categorySlugs.includes(slug)) ||
    a.ingredientSlugs.some((slug) => b.ingredientSlugs.includes(slug))
  );
}

export interface PickContext {
  recipes: SwipeRecipe[];
  state: SwipeState;
  /** Recettes déjà en favoris : le swipe « semaine » ne les repropose pas */
  favoriteIds: ReadonlySet<number>;
  /** Recettes servant de référence au bonus « économe » (repas déjà prévus, recettes gardées pendant la partie) */
  anchorIds: readonly number[];
  /** Recettes déjà montrées pendant cette partie, dans l'ordre */
  shownIds: number[];
  baseScores: Map<number, number>;
  mode: SwipeMode;
}

/** Recettes encore proposables : ni refusées récemment, ni déjà vues, ni déjà en favoris (semaine), dans la durée voulue. */
export function getEligibleRecipes(context: PickContext): SwipeRecipe[] {
  const { recipes, state, favoriteIds, shownIds, mode } = context;
  const shown = new Set(shownIds);
  const { maxMinutes } = state.prefs;

  return recipes.filter((recipe) => {
    if (shown.has(recipe.id)) return false;
    if (state.refused[String(recipe.id)]) return false;
    if (mode === 'week' && favoriteIds.has(recipe.id)) return false;
    if (maxMinutes !== null && !(recipe.totalMinutes > 0 && recipe.totalMinutes <= maxMinutes)) return false;
    return true;
  });
}

/** Choisit la prochaine carte : aléatoire pondéré par la variété et, en option, l'économie de courses. */
export function pickNext(context: PickContext): SwipeRecipe | null {
  const candidates = getEligibleRecipes(context);
  if (candidates.length === 0) return null;

  const { recipes, state, anchorIds, shownIds, baseScores, mode } = context;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  const recentRecipes = shownIds
    .slice(-VARIETY_LOOKBACK)
    .map((id) => byId.get(id))
    .filter((recipe): recipe is SwipeRecipe => Boolean(recipe));

  const anchorIngredients = new Set<string>();
  if (mode === 'week' && state.prefs.economical) {
    for (const id of anchorIds) {
      byId.get(id)?.ingredientSlugs.forEach((slug) => anchorIngredients.add(slug));
    }
  }

  let best: SwipeRecipe | null = null;
  let bestScore = -Infinity;

  for (const recipe of candidates) {
    let score = baseScores.get(recipe.id) ?? 0;

    for (const recent of recentRecipes) {
      if (sharesCategoryOrIngredient(recipe, recent)) score -= VARIETY_PENALTY;
    }

    if (anchorIngredients.size > 0) {
      const shared = recipe.ingredientSlugs.filter((slug) => anchorIngredients.has(slug)).length;
      score += Math.min(shared, ECONOMICAL_MAX_SHARED_INGREDIENTS) * ECONOMICAL_BONUS_PER_SHARED_INGREDIENT;
    }

    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
}
