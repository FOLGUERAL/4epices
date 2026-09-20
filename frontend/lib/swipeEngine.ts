/**
 * Moteur du swipe de recettes et du planning.
 *
 * Modèle : les recettes gardées au swipe rejoignent les favoris (la « pile » à planifier, gérée par
 * lib/favorites.ts). Ce module ne conserve que le planning (des occurrences : une recette, un jour, un repas),
 * les recettes refusées et les préférences. Il est pur : aucun accès à React, au DOM ni au localStorage
 * (le stockage est dans lib/swipeStorage.ts), donc testable.
 */

/**
 * Durée pendant laquelle une recette refusée dans Découvrir n'est pas reproposée. Courte à dessein : le jeu de swipe
 * ne compte qu'environ 70 recettes (les « Bases de cuisine » en sont exclues), et 34 avec le filtre « rapides ».
 * Avec un délai plus long, quelqu'un qui swipe chaque semaine viderait le jeu en quelques semaines.
 */
export const REFUSAL_COOLDOWN_DAYS = 7;
export const QUICK_MINUTES = 30;
/** Jours affichés à partir d'aujourd'hui : aujourd'hui et les 7 suivants */
export const WINDOW_DAYS = 8;
/** Jours passés que l'on peut encore consulter et corriger */
export const HISTORY_DAYS = 7;

// Pondération de la pioche
const VARIETY_PENALTY = 0.5;
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
  /** Affiche aussi le repas du midi dans le calendrier (le soir est toujours affiché) */
  showLunch: boolean;
  /** Affichage du planning : une ligne par jour (liste) ou grille de la semaine */
  planView: 'list' | 'week';
}

export interface SwipeState {
  /** Premier jour de la fenêtre glissante : le jour courant (AAAA-MM-JJ, heure locale) */
  windowStart: string;
  plan: PlanEntry[];
  /** id de recette → date ISO du refus (mode Découvrir, et aussi respecté par « Ce soir ») */
  refused: Record<string, string>;
  /**
   * id de recette → jour (AAAA-MM-JJ) où elle a été passée dans « Ce soir ». Ne vaut que ce jour-là et que pour
   * « Ce soir » : « pas ce soir » ne veut pas dire « jamais ».
   */
  passedTonight: Record<string, string>;
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
    passedTonight: {},
    prefs: { maxMinutes: null, showLunch: false, planView: 'list' },
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

  // « Pas ce soir » ne vaut que pour la journée en cours
  const passedTonight: Record<string, string> = {};
  if (data.passedTonight && typeof data.passedTonight === 'object' && !Array.isArray(data.passedTonight)) {
    for (const [id, date] of Object.entries(data.passedTonight as Record<string, unknown>)) {
      if (date === today) passedTonight[id] = today;
    }
  }

  const prefs: SwipePrefs = {
    maxMinutes:
      typeof data.prefs?.maxMinutes === 'number' && data.prefs.maxMinutes > 0 ? data.prefs.maxMinutes : null,
    showLunch: data.prefs?.showLunch === true,
    planView: data.prefs?.planView === 'week' ? 'week' : 'list',
  };

  return { windowStart: today, plan, refused, passedTonight, prefs };
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

/**
 * « Pas ce soir » : la recette ne revient pas dans « Ce soir » jusqu'à demain. Elle reste proposable dans Découvrir,
 * dans les suggestions du planning et un autre jour : dans « Ce soir », on est plus exigeant, et ça ne dit rien du goût.
 */
export function passForTonight(state: SwipeState, recipe: { id: number }, now: Date = new Date()): SwipeState {
  return { ...state, passedTonight: { ...state.passedTonight, [String(recipe.id)]: formatLocalDate(now) } };
}

/** Annule un « pas ce soir » (bouton « annuler » du swipe). */
export function undoPassForTonight(state: SwipeState, recipeId: number): SwipeState {
  const passedTonight = { ...state.passedTonight };
  delete passedTonight[String(recipeId)];
  return { ...state, passedTonight };
}

export function clearPassesForTonight(state: SwipeState): SwipeState {
  return { ...state, passedTonight: {} };
}

export function setPrefs(state: SwipeState, prefs: Partial<SwipePrefs>): SwipeState {
  return { ...state, prefs: { ...state.prefs, ...prefs } };
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
  /** Recettes déjà montrées pendant cette partie, dans l'ordre */
  shownIds: number[];
  baseScores: Map<number, number>;
  mode: SwipeMode;
}

/** Sous ce nombre de recettes proposables, les refus les plus anciens sont libérés plutôt que d'épuiser le jeu */
export const MIN_ELIGIBLE = 12;

/**
 * Recettes encore proposables : ni refusées récemment, ni déjà vues, ni déjà en favoris (semaine), dans la durée voulue.
 * Un « pas ce soir » n'écarte la recette que de « Ce soir », et seulement le jour même.
 *
 * Garde-fou : quand il reste trop peu de recettes hors refus, on libère les refus les plus anciens (sans jamais
 * dépasser la moitié des recettes en jeu) au lieu de dire « tout vu » à cause de refus datant de quelques jours.
 */
export function getEligibleRecipes(context: PickContext): SwipeRecipe[] {
  const { recipes, state, favoriteIds, shownIds, mode } = context;
  const shown = new Set(shownIds);
  const { maxMinutes } = state.prefs;

  const inPlay = recipes.filter((recipe) => {
    if (shown.has(recipe.id)) return false;
    if (mode === 'tonight' && state.passedTonight[String(recipe.id)]) return false;
    if (mode === 'week' && favoriteIds.has(recipe.id)) return false;
    if (maxMinutes !== null && !(recipe.totalMinutes > 0 && recipe.totalMinutes <= maxMinutes)) return false;
    return true;
  });

  const notRefused = inPlay.filter((recipe) => !state.refused[String(recipe.id)]);
  const minimum = Math.min(MIN_ELIGIBLE, Math.floor(inPlay.length / 2));
  if (notRefused.length >= minimum) return notRefused;

  const oldestRefused = inPlay
    .filter((recipe) => state.refused[String(recipe.id)])
    .sort((a, b) => state.refused[String(a.id)].localeCompare(state.refused[String(b.id)]));
  return [...notRefused, ...oldestRefused.slice(0, minimum - notRefused.length)];
}

/** Choisit la prochaine carte : aléatoire, pondéré pour varier les catégories et les ingrédients proposés. */
export function pickNext(context: PickContext): SwipeRecipe | null {
  const candidates = getEligibleRecipes(context);
  if (candidates.length === 0) return null;

  const { recipes, shownIds, baseScores } = context;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  const recentRecipes = shownIds
    .slice(-VARIETY_LOOKBACK)
    .map((id) => byId.get(id))
    .filter((recipe): recipe is SwipeRecipe => Boolean(recipe));

  let best: SwipeRecipe | null = null;
  let bestScore = -Infinity;

  for (const recipe of candidates) {
    let score = baseScores.get(recipe.id) ?? 0;

    for (const recent of recentRecipes) {
      if (sharesCategoryOrIngredient(recipe, recent)) score -= VARIETY_PENALTY;
    }

    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
}
