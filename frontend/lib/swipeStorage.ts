/**
 * Stockage local de l'état du swipe (semaine en cours, refus récents, préférences).
 * Même approche que lib/favorites.ts : localStorage, jamais d'exception vers l'appelant.
 * Si le stockage est indisponible (navigation privée), l'état reste en mémoire pour la session.
 */

import { createInitialState, normalizeState, type SwipeState } from '@/lib/swipeEngine';

const SWIPE_STATE_KEY = '4epices_swipe_state';
/** Émis à chaque sauvegarde pour que les composants de la même page restent synchronisés */
export const SWIPE_STATE_EVENT = '4epices:swipe-state-changed';

let memoryState: SwipeState | null = null;

export function loadSwipeState(now: Date = new Date()): SwipeState {
  if (typeof window === 'undefined') return createInitialState(now);

  try {
    const stored = window.localStorage.getItem(SWIPE_STATE_KEY);
    if (stored) {
      const state = normalizeState(JSON.parse(stored), now);
      memoryState = state;
      return state;
    }
  } catch (error) {
    console.error('Erreur lors de la lecture du menu de la semaine:', error);
    if (memoryState) return normalizeState(memoryState, now);
  }

  memoryState = memoryState ? normalizeState(memoryState, now) : createInitialState(now);
  return memoryState;
}

export function saveSwipeState(state: SwipeState): void {
  memoryState = state;
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SWIPE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du menu de la semaine:', error);
  }
  window.dispatchEvent(new Event(SWIPE_STATE_EVENT));
}

/** Notifie quand le menu change : dans cette page (événement interne) ou dans un autre onglet. */
export function subscribeSwipeState(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(SWIPE_STATE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(SWIPE_STATE_EVENT, callback);
  };
}
