/**
 * Liste de courses, enregistrée dans le navigateur (localStorage).
 *
 * On enregistre les lignes brutes des recettes avec leur origine ; la liste fusionnée (oignon : 3, ail : 2 gousses…)
 * est calculée à l'affichage par lib/shoppingMerge.ts. Retirer une recette retire donc ses lignes, et toute
 * amélioration de la fusion s'applique aussi à ce qui est déjà enregistré.
 */

import {
  getRecipesInLines,
  mergeShoppingLines,
  migrateLegacyList,
  parseShoppingText,
  portionsScale,
  type ShoppingItem,
  type ShoppingLine,
  type StoredShopping,
} from '@/lib/shoppingMerge';

const STORAGE_KEY = '4epices_shopping_v2';
// Anciennes clés : liste déjà fusionnée, et identifiants de recettes
const LEGACY_LIST_KEY = '4epices_shopping_list';
const LEGACY_RECIPES_KEY = '4epices_shopping_list_recipes';

export const SHOPPING_LIST_EVENT = '4epices:shopping-list-changed';

function notifyShoppingListChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOPPING_LIST_EVENT));
}

/** Notifie quand la liste de courses change : dans cette page (événement interne) ou dans un autre onglet. */
export function subscribeShoppingList(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(SHOPPING_LIST_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(SHOPPING_LIST_EVENT, callback);
  };
}

export type ShoppingItemView = ShoppingItem & { checked: boolean };

const emptyState = (): StoredShopping => ({ lines: [], checked: [], legacyRecipeIds: [] });

function sanitize(raw: unknown): StoredShopping {
  if (!raw || typeof raw !== 'object') return emptyState();
  const data = raw as Partial<StoredShopping>;
  return {
    lines: Array.isArray(data.lines)
      ? data.lines.filter((line): line is ShoppingLine => Boolean(line) && typeof line.id === 'string' && typeof line.text === 'string')
      : [],
    checked: Array.isArray(data.checked) ? data.checked.filter((key): key is string => typeof key === 'string') : [],
    legacyRecipeIds: Array.isArray(data.legacyRecipeIds)
      ? data.legacyRecipeIds.filter((id): id is number => typeof id === 'number')
      : [],
  };
}

function readJson(key: string): unknown {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

function persist(state: StoredShopping, notify = true): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (notify) notifyShoppingListChanged();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la liste de courses:', error);
  }
}

function load(): StoredShopping {
  if (typeof window === 'undefined') return emptyState();

  try {
    const stored = readJson(STORAGE_KEY);
    if (stored) return sanitize(stored);

    // Première lecture après la refonte : on reprend l'ancienne liste, puis on la supprime
    const legacyItems = readJson(LEGACY_LIST_KEY);
    const legacyRecipes = readJson(LEGACY_RECIPES_KEY);
    if (legacyItems || legacyRecipes) {
      const migrated = migrateLegacyList(
        Array.isArray(legacyItems) ? legacyItems : [],
        Array.isArray(legacyRecipes) ? legacyRecipes.filter((id): id is number => typeof id === 'number') : []
      );
      persist(migrated, false);
      localStorage.removeItem(LEGACY_LIST_KEY);
      localStorage.removeItem(LEGACY_RECIPES_KEY);
      return migrated;
    }
  } catch (error) {
    console.error('Erreur lors de la lecture de la liste de courses:', error);
  }
  return emptyState();
}

let lineCounter = 0;
const newLineId = () => `${Date.now().toString(36)}-${(lineCounter += 1)}-${Math.random().toString(36).slice(2, 6)}`;

/** Une ligne d'ingrédient de recette : un texte, ou un objet { quantite, ingredient }. */
export function ingredientToText(ingredient: unknown): string {
  if (typeof ingredient === 'string') return ingredient.trim();
  if (ingredient && typeof ingredient === 'object') {
    const { quantite, ingredient: name } = ingredient as { quantite?: unknown; ingredient?: unknown };
    return `${typeof quantite === 'string' ? quantite : ''} ${typeof name === 'string' ? name : ''}`.trim();
  }
  return String(ingredient ?? '').trim();
}

/** Le multiplicateur de portions choisi sur la page de la recette (« pour 6 personnes »), s'il y en a un. */
export function getPortionsScale(slug: string, basePortions: number): number {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = localStorage.getItem(`recipe_portions_${slug}`);
    return portionsScale(saved === null ? null : parseInt(saved, 10), basePortions);
  } catch {
    return 1;
  }
}

/** Les articles fusionnés, avec leur état coché. */
export function getShoppingItems(): ShoppingItemView[] {
  const state = load();
  const checked = new Set(state.checked);
  return mergeShoppingLines(state.lines).map((item) => ({ ...item, checked: checked.has(item.key) }));
}

/** Le nombre d'articles restant à acheter (le placard n'est pas compté). */
export function getShoppingCount(): number {
  return getShoppingItems().filter((item) => !item.pantry && !item.checked).length;
}

export function getShoppingRecipes(): Array<{ recipeId: number; title: string }> {
  return getRecipesInLines(load().lines);
}

/** Vérifie si une recette est déjà dans la liste de courses. */
export function isRecipeInShoppingList(recipeId: number): boolean {
  const state = load();
  return state.lines.some((line) => line.recipeId === recipeId) || state.legacyRecipeIds.includes(recipeId);
}

interface AddOptions {
  recipeTitle?: string;
  /** Multiplicateur de portions (6 personnes pour une recette de 4 : 1,5) */
  scale?: number;
}

/** Ajoute les ingrédients d'une recette. Une recette déjà présente est remplacée (nouvelles portions, par exemple). */
export function addIngredientsToShoppingList(ingredients: unknown[], recipeId?: number, options: AddOptions = {}): void {
  const state = load();
  const base = recipeId === undefined ? state.lines : state.lines.filter((line) => line.recipeId !== recipeId);

  const added: ShoppingLine[] = ingredients
    .map(ingredientToText)
    .filter(Boolean)
    .map((text) => ({
      id: newLineId(),
      text,
      recipeId,
      recipeTitle: options.recipeTitle,
      ...(options.scale && options.scale !== 1 ? { scale: options.scale } : {}),
    }));

  persist({
    ...state,
    lines: [...base, ...added],
    legacyRecipeIds: recipeId === undefined ? state.legacyRecipeIds : state.legacyRecipeIds.filter((id) => id !== recipeId),
  });
}

/** Ajoute un article saisi à la main (« lait », « 2 yaourts »). */
export function addCustomItem(text: string): boolean {
  const clean = text.trim();
  if (!clean || parseShoppingText(clean).length === 0) return false;
  const state = load();
  persist({ ...state, lines: [...state.lines, { id: newLineId(), text: clean }] });
  return true;
}

export function toggleItemChecked(key: string): void {
  const state = load();
  const checked = state.checked.includes(key) ? state.checked.filter((item) => item !== key) : [...state.checked, key];
  persist({ ...state, checked });
}

/** Retire un article : toutes les lignes qui le composent. */
export function removeItem(key: string): void {
  const state = load();
  persist({
    ...state,
    lines: state.lines.filter((line) => !parseShoppingText(line.text).some((parsed) => parsed.key === key)),
    checked: state.checked.filter((item) => item !== key),
  });
}

/** Retire une recette de la liste : ses lignes disparaissent, les autres restent. */
export function removeRecipeFromShoppingList(recipeId: number): void {
  const state = load();
  const lines = state.lines.filter((line) => line.recipeId !== recipeId);
  const remaining = new Set(mergeShoppingLines(lines).map((item) => item.key));
  persist({
    lines,
    checked: state.checked.filter((key) => remaining.has(key)),
    legacyRecipeIds: state.legacyRecipeIds.filter((id) => id !== recipeId),
  });
}

/** « Vider les cochés » : retire de la liste ce qui est dans le panier. */
export function clearCheckedItems(): void {
  const state = load();
  const checked = new Set(state.checked);
  persist({
    ...state,
    lines: state.lines.filter((line) => {
      const keys = parseShoppingText(line.text).map((parsed) => parsed.key);
      return keys.length === 0 || !keys.every((key) => checked.has(key));
    }),
    checked: [],
  });
}

export function clearShoppingList(): void {
  if (typeof window === 'undefined') return;
  persist(emptyState());
}
