'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChefHat, Hand, Heart, Undo2, X, Zap } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import SwipeCard, { type SwipeCardHandle, type SwipeDirection } from '@/components/SwipeCard';
import { addFavorite, getFavorites, removeFavorite, subscribeFavorites, type Favorite } from '@/lib/favorites';
import { getStrapiMediaUrl } from '@/lib/strapi';
import {
  QUICK_MINUTES,
  clearRefusals,
  createBaseScores,
  createInitialState,
  pickNext,
  refuseRecipe,
  setPrefs,
  undoRefusal,
  type Decision,
  type SwipeMode,
  type SwipeRecipe,
  type SwipeState,
} from '@/lib/swipeEngine';
import { loadSwipeState, saveSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

type Phase = 'loading' | 'swiping' | 'exhausted' | 'done';

interface SwipeDeckProps {
  recipes: SwipeRecipe[];
  mode: SwipeMode;
}

/** Décision du swipe, avec ce qu'il faut savoir pour l'annuler proprement */
type SessionDecision = Decision & { addedFavorite: boolean };

const COACH_STORAGE_KEY = '4epices_swipe_coach_seen';
/** Un retour discret (non bloquant) tous les N favoris gardés */
const MILESTONE_EVERY = 10;
const COACH_AUTO_HIDE_MS = 9000;
const MILESTONE_HIDE_MS = 6000;
const PULSE_MS = 250;
// La carte s'adapte à la hauteur visible : les boutons restent accessibles sans défiler
const DECK_HEIGHT = 'clamp(18rem, calc(100dvh - 17rem), 34rem)';

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition-colors hover:bg-orange-700';
const secondaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-orange-200 px-5 py-3 font-semibold text-orange-700 transition-colors hover:bg-orange-50';
const roundButton =
  'inline-flex items-center justify-center rounded-full bg-white shadow-lg transition-transform duration-150 hover:scale-105 motion-safe:active:scale-[0.96] motion-reduce:transition-none';

export default function SwipeDeck({ recipes, mode }: SwipeDeckProps) {
  const isWeek = mode === 'week';
  const [phase, setPhase] = useState<Phase>('loading');
  const [state, setState] = useState<SwipeState>(() => createInitialState());
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [current, setCurrent] = useState<SwipeRecipe | null>(null);
  const [tonightPick, setTonightPick] = useState<SwipeRecipe | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

  // Données de la partie en cours (ne nécessitent pas de nouveau rendu)
  const baseScores = useRef<Map<number, number>>(new Map());
  const shownIds = useRef<number[]>([]);
  const history = useRef<SessionDecision[]>([]);
  const sessionKept = useRef<number[]>([]);
  const cardRef = useRef<SwipeCardHandle>(null);
  const favoriteIdsRef = useRef<ReadonlySet<number>>(new Set());
  const timers = useRef<number[]>([]);

  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.id)), [favorites]);
  favoriteIdsRef.current = favoriteIds;

  const later = (callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay));
  };

  const commitState = (next: SwipeState) => {
    setState(next);
    saveSwipeState(next);
  };

  const pick = (fromState: SwipeState, shown: number[] = shownIds.current) =>
    pickNext({
      recipes,
      state: fromState,
      favoriteIds: favoriteIdsRef.current,
      shownIds: shown,
      baseScores: baseScores.current,
      mode,
    });

  const showNext = (fromState: SwipeState) => {
    const next = pick(fromState);
    if (!next) {
      setCurrent(null);
      setPhase('exhausted');
      return;
    }
    shownIds.current = [...shownIds.current, next.id];
    setCurrent(next);
    setPhase('swiping');
  };

  const startSession = (fromState: SwipeState) => {
    baseScores.current = createBaseScores(recipes);
    shownIds.current = [];
    history.current = [];
    sessionKept.current = [];
    setHistoryCount(0);
    setMilestone(null);
    setTonightPick(null);
    trackEvent('swipe-start', { mode });
    showNext(fromState);
  };

  const dismissCoach = () => {
    if (!showCoach) return;
    setShowCoach(false);
    try {
      window.localStorage.setItem(COACH_STORAGE_KEY, 'true');
    } catch {
      // Sans stockage, l'aide réapparaîtra à la prochaine visite : sans gravité
    }
  };

  const decide = (direction: SwipeDirection) => {
    if (!current) return;
    dismissCoach();

    let nextState = state;
    let addedFavorite = false;

    if (direction === 'pass') {
      nextState = refuseRecipe(state, current);
      commitState(nextState);
    } else if (isWeek) {
      // Garder = rejoindre les favoris
      addedFavorite = addFavorite({
        id: current.id,
        slug: current.slug,
        titre: current.titre,
        imageUrl: current.imageUrl ? getStrapiMediaUrl(current.imageUrl) : undefined,
      });
      sessionKept.current.push(current.id);

      setPulse(true);
      later(() => setPulse(false), PULSE_MS);

      if (sessionKept.current.length % MILESTONE_EVERY === 0) {
        const kept = sessionKept.current.length;
        setMilestone(kept);
        later(() => setMilestone((value) => (value === kept ? null : value)), MILESTONE_HIDE_MS);
      }
    }

    history.current.push({ type: direction, recipeId: current.id, addedFavorite });
    setHistoryCount(history.current.length);
    trackEvent(direction === 'keep' ? 'swipe-keep' : 'swipe-pass', { mode, recipe: current.slug });

    if (direction === 'keep' && !isWeek) {
      setTonightPick(current);
      setCurrent(null);
      setPhase('done');
      trackEvent('tonight-pick', { recipe: current.slug });
      return;
    }
    showNext(nextState);
  };

  const undo = () => {
    const last = history.current.pop();
    if (!last) return;
    const recipe = recipes.find((item) => item.id === last.recipeId);
    if (!recipe) return;

    if (last.type === 'pass') {
      commitState(undoRefusal(state, last.recipeId));
    } else if (last.addedFavorite) {
      removeFavorite(last.recipeId);
      sessionKept.current = sessionKept.current.filter((id) => id !== last.recipeId);
    }

    // La carte du dessus n'a pas été décidée : elle pourra être reproposée plus tard
    if (current) shownIds.current = shownIds.current.filter((id) => id !== current.id);
    setHistoryCount(history.current.length);
    setCurrent(recipe);
    setPhase('swiping');
  };

  const toggleQuick = () => {
    const quickOn = state.prefs.maxMinutes === QUICK_MINUTES;
    const next = setPrefs(state, { maxMinutes: quickOn ? null : QUICK_MINUTES });
    commitState(next);
    trackEvent('swipe-filter', { quick: quickOn ? 0 : 1 });
    startSession(next);
  };

  // Les gestionnaires lus par la carte et le clavier restent à jour entre deux rendus
  const decideRef = useRef(decide);
  decideRef.current = decide;
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const startRef = useRef(startSession);
  startRef.current = startSession;

  // Chargement du stockage local puis démarrage immédiat : la première carte s'affiche sans écran intermédiaire
  useEffect(() => {
    const loadedState = loadSwipeState();
    const loadedFavorites = getFavorites();
    favoriteIdsRef.current = new Set(loadedFavorites.map((favorite) => favorite.id));
    setState(loadedState);
    setFavorites(loadedFavorites);

    try {
      setShowCoach(window.localStorage.getItem(COACH_STORAGE_KEY) === null);
    } catch {
      setShowCoach(false);
    }

    startRef.current(loadedState);

    const reloadFavorites = () => setFavorites(getFavorites());
    const unsubscribeState = subscribeSwipeState(() => setState(loadSwipeState()));
    const unsubscribeFavorites = subscribeFavorites(reloadFavorites);
    const activeTimers = timers.current;
    return () => {
      unsubscribeState();
      unsubscribeFavorites();
      activeTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!showCoach) return;
    const timer = window.setTimeout(() => setShowCoach(false), COACH_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [showCoach]);

  useEffect(() => {
    if (phase !== 'swiping') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') cardRef.current?.swipe('keep');
      else if (event.key === 'ArrowLeft') cardRef.current?.swipe('pass');
      else if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') undoRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  if (recipes.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-lg">
        <p className="text-gray-700">Les recettes sont momentanément indisponibles.</p>
        <Link href="/recettes" className={`${primaryButton} mt-4`}>
          Voir toutes les recettes
        </Link>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div
        className="mx-auto w-full max-w-sm animate-pulse rounded-3xl bg-gray-200"
        style={{ height: DECK_HEIGHT }}
        aria-hidden="true"
      />
    );
  }

  if (phase === 'done') {
    if (!tonightPick) return null;
    return (
      <section aria-labelledby="tonight-title" className="overflow-hidden rounded-3xl bg-white shadow-lg">
        <div className="relative aspect-[4/3] w-full">
          <OptimizedImage
            src={tonightPick.imageUrl}
            alt={tonightPick.imageAlt}
            fill
            disableAspectRatio
            priority
            sizes="(max-width: 640px) 100vw, 512px"
            className="object-cover"
          />
        </div>
        <div className="p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">C&apos;est décidé !</p>
          <h2 id="tonight-title" className="mt-1 text-2xl font-bold text-gray-900 [text-wrap:balance]">
            {tonightPick.titre}
          </h2>
          {tonightPick.totalMinutes > 0 && (
            <p className="mt-1 text-sm text-gray-600">{tonightPick.totalMinutes} minutes au total</p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/recettes/${tonightPick.slug}/cuisine`}
              onClick={() => trackEvent('tonight-cook', { recipe: tonightPick.slug })}
              className={primaryButton}
            >
              <ChefHat className="h-5 w-5" aria-hidden="true" />
              Cuisiner avec la Nonna
            </Link>
            <Link href={`/recettes/${tonightPick.slug}`} className={secondaryButton}>
              Voir la recette
            </Link>
            <button
              type="button"
              onClick={() => {
                setTonightPick(null);
                showNext(state);
              }}
              className="min-h-12 rounded-xl px-5 py-3 font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Autre idée
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'exhausted') {
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-lg sm:p-8" aria-live="polite">
        <h2 className="text-2xl font-bold text-gray-900">Vous avez tout vu !</h2>
        <p className="mt-2 text-gray-600">
          Il n&apos;y a plus de recette à vous proposer avec ces réglages. Vous pouvez remettre en jeu les recettes
          refusées{state.prefs.maxMinutes !== null ? ' ou retirer le filtre « rapides »' : ''}.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              const cleared = clearRefusals(state);
              commitState(cleared);
              startSession(cleared);
            }}
            className={primaryButton}
          >
            Remettre les recettes refusées
          </button>
          {state.prefs.maxMinutes !== null && (
            <button type="button" onClick={toggleQuick} className={secondaryButton}>
              Toutes les durées
            </button>
          )}
          {isWeek && (
            <Link href="/favoris" className={secondaryButton}>
              Mon carnet
            </Link>
          )}
          <Link href="/recettes" className={secondaryButton}>
            Toutes les recettes
          </Link>
        </div>
      </section>
    );
  }

  // phase === 'swiping'
  if (!current) return null;
  const peekOne = pick(state, shownIds.current);
  const peekTwo = peekOne ? pick(state, [...shownIds.current, peekOne.id]) : null;
  const stack: Array<{ recipe: SwipeRecipe; depth: number }> = [
    ...(peekTwo ? [{ recipe: peekTwo, depth: 2 }] : []),
    ...(peekOne ? [{ recipe: peekOne, depth: 1 }] : []),
    { recipe: current, depth: 0 },
  ];
  const quickOn = state.prefs.maxMinutes === QUICK_MINUTES;

  return (
    <section aria-label={isWeek ? 'Découvrir des recettes' : 'Choix du dîner'} className="mx-auto w-full max-w-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleQuick}
          aria-pressed={quickOn}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${
            quickOn
              ? 'border-orange-600 bg-orange-600 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          Rapides
        </button>

        {isWeek && (
          <Link
            href="/favoris"
            onClick={() => trackEvent('swipe-to-carnet', { favorites: favorites.length })}
            aria-label={`Mon carnet : ${favorites.length} ${favorites.length === 1 ? 'favori' : 'favoris'}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-gray-800 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
          >
            <Heart
              className={`h-5 w-5 fill-current text-rose-500 transition-transform duration-200 motion-reduce:transition-none ${
                pulse ? 'scale-125' : 'scale-100'
              }`}
              aria-hidden="true"
            />
            <span className="tabular-nums">{favorites.length}</span>
          </Link>
        )}
      </div>

      {isWeek && milestone !== null && (
        <div
          role="status"
          className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <p>
            <span className="font-bold tabular-nums">{milestone}</span> recettes gardées.
          </p>
          <span className="flex flex-shrink-0 items-center gap-1">
            <Link href="/favoris" className="font-bold underline">
              Voir mon carnet
            </Link>
            <button
              type="button"
              onClick={() => setMilestone(null)}
              aria-label="Fermer ce message"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      <div className="relative w-full" style={{ height: DECK_HEIGHT }} aria-live="polite">
        {stack.map(({ recipe, depth }) => (
          <SwipeCard
            key={recipe.id}
            ref={depth === 0 ? cardRef : undefined}
            recipe={recipe}
            depth={depth}
            onDecide={(direction) => decideRef.current(direction)}
          />
        ))}

        {showCoach && (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex flex-col items-center gap-3 text-white"
            aria-hidden="true"
          >
            <span className="swipe-hint rounded-full bg-black/60 p-4 backdrop-blur">
              <Hand className="h-8 w-8" />
            </span>
            <p className="rounded-full bg-black/60 px-4 py-2 text-center text-sm font-semibold backdrop-blur">
              {isWeek ? 'Glissez à droite pour garder, à gauche pour passer' : 'Glissez à droite pour choisir, à gauche pour passer'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => cardRef.current?.swipe('pass')}
          aria-label="Non merci"
          className={`${roundButton} h-16 w-16 text-rose-500 ring-1 ring-rose-100`}
        >
          <X className="h-8 w-8" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => undoRef.current()}
          disabled={historyCount === 0}
          aria-label="Annuler le dernier choix"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-500 shadow ring-1 ring-gray-200 transition-colors hover:text-gray-800 disabled:opacity-40"
        >
          <Undo2 className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => cardRef.current?.swipe('keep')}
          aria-label={isWeek ? 'Garder dans mes favoris' : 'Choisir ce dîner'}
          className={`${roundButton} h-16 w-16 ${isWeek ? 'text-rose-500 ring-1 ring-rose-100' : 'text-emerald-500 ring-1 ring-emerald-100'}`}
        >
          {isWeek ? <Heart className="h-8 w-8" aria-hidden="true" /> : <Check className="h-8 w-8" aria-hidden="true" />}
        </button>
      </div>

      <p className="mt-4 hidden text-center text-sm text-gray-500 sm:block">
        Glissez la carte ou utilisez les flèches ← → du clavier.
      </p>
    </section>
  );
}
