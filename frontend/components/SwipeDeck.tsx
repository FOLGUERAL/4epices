'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChefHat, Undo2, X } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import SwipeCard, { type SwipeCardHandle, type SwipeDirection } from '@/components/SwipeCard';
import { addFavorite, getFavorites, removeFavorite, subscribeFavorites, type Favorite } from '@/lib/favorites';
import { countFreeSlots, formatMealCount, getPile, getUpcomingEntries } from '@/lib/planning';
import { getStrapiMediaUrl } from '@/lib/strapi';
import {
  QUICK_MINUTES,
  clearRefusals,
  createBaseScores,
  createInitialState,
  getRoundSize,
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

type Phase = 'loading' | 'setup' | 'swiping' | 'round-end' | 'exhausted' | 'done';

interface SwipeDeckProps {
  recipes: SwipeRecipe[];
  mode: SwipeMode;
}

/** Décision du swipe, avec ce qu'il faut savoir pour l'annuler proprement */
type SessionDecision = Decision & { addedFavorite: boolean };

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition-colors hover:bg-orange-700';
const secondaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-orange-200 px-5 py-3 font-semibold text-orange-700 transition-colors hover:bg-orange-50';

export default function SwipeDeck({ recipes, mode }: SwipeDeckProps) {
  const isWeek = mode === 'week';
  const [phase, setPhase] = useState<Phase>('loading');
  const [state, setState] = useState<SwipeState>(() => createInitialState());
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [current, setCurrent] = useState<SwipeRecipe | null>(null);
  const [tonightPick, setTonightPick] = useState<SwipeRecipe | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [keptCount, setKeptCount] = useState(0);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Données de la partie en cours (ne nécessitent pas de nouveau rendu)
  const baseScores = useRef<Map<number, number>>(new Map());
  const shownIds = useRef<number[]>([]);
  const history = useRef<SessionDecision[]>([]);
  const sessionKept = useRef<number[]>([]);
  const roundCount = useRef(0);
  const cardRef = useRef<SwipeCardHandle>(null);

  useEffect(() => {
    const reload = () => {
      setState(loadSwipeState());
      setFavorites(getFavorites());
    };
    reload();
    setPhase((previous) => (previous === 'loading' ? 'setup' : previous));

    const unsubscribeState = subscribeSwipeState(reload);
    const unsubscribeFavorites = subscribeFavorites(reload);
    return () => {
      unsubscribeState();
      unsubscribeFavorites();
    };
  }, []);

  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.id)), [favorites]);
  const pile = useMemo(() => getPile(favorites, state), [favorites, state]);
  const freeSlots = countFreeSlots(state);
  const freeLabel = formatMealCount(freeSlots, state.prefs.showLunch);

  const commitState = (next: SwipeState) => {
    setState(next);
    saveSwipeState(next);
  };

  const pick = (fromState: SwipeState, shown: number[] = shownIds.current) =>
    pickNext({
      recipes,
      state: fromState,
      favoriteIds,
      // Référence du bonus « économe » : repas déjà prévus et recettes gardées pendant la partie
      anchorIds: [...getUpcomingEntries(fromState).map((entry) => entry.recipeId), ...sessionKept.current],
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
    roundCount.current = 0;
    setHistoryCount(0);
    setKeptCount(0);
    setNudgeDismissed(false);
    setTonightPick(null);
    trackEvent('swipe-start', { mode });
    showNext(fromState);
  };

  const decide = (direction: SwipeDirection) => {
    if (!current) return;

    let nextState = state;
    let addedFavorite = false;

    if (direction === 'pass') {
      nextState = refuseRecipe(state, current);
      commitState(nextState);
    } else if (isWeek) {
      // Garder = rejoindre les favoris, donc la pile « à planifier »
      addedFavorite = addFavorite({
        id: current.id,
        slug: current.slug,
        titre: current.titre,
        imageUrl: current.imageUrl ? getStrapiMediaUrl(current.imageUrl) : undefined,
      });
      sessionKept.current.push(current.id);
      setKeptCount(sessionKept.current.length);
    }

    history.current.push({ type: direction, recipeId: current.id, addedFavorite });
    roundCount.current += 1;
    setHistoryCount(history.current.length);
    trackEvent(direction === 'keep' ? 'swipe-keep' : 'swipe-pass', { mode, recipe: current.slug });

    if (direction === 'keep' && !isWeek) {
      setTonightPick(current);
      setCurrent(null);
      setPhase('done');
      trackEvent('tonight-pick', { recipe: current.slug });
      return;
    }

    if (roundCount.current >= getRoundSize(mode)) {
      setCurrent(null);
      setPhase('round-end');
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
      setKeptCount(sessionKept.current.length);
    }

    // La carte du dessus n'a pas été décidée : elle pourra être reproposée plus tard
    if (current) shownIds.current = shownIds.current.filter((id) => id !== current.id);
    roundCount.current = Math.max(0, roundCount.current - 1);
    setHistoryCount(history.current.length);
    setCurrent(recipe);
    setPhase('swiping');
  };

  // La carte lit toujours la dernière version du gestionnaire (l'état change entre deux rendus)
  const decideRef = useRef(decide);
  decideRef.current = decide;
  const undoRef = useRef(undo);
  undoRef.current = undo;

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
    return <div className="mx-auto aspect-[3/4] w-full max-w-sm animate-pulse rounded-3xl bg-gray-200" aria-hidden="true" />;
  }

  if (phase === 'setup') {
    return (
      <section aria-labelledby="swipe-setup-title" className="rounded-3xl bg-white p-6 shadow-lg sm:p-8">
        <h2 id="swipe-setup-title" className="text-2xl font-bold text-gray-900">
          {isWeek ? 'Choisissez vos recettes' : 'Trouvez votre dîner'}
        </h2>
        <p className="mt-2 text-gray-600">
          {isWeek
            ? 'Faites défiler les recettes : celles que vous gardez rejoignent vos favoris, prêtes à être placées dans votre calendrier.'
            : 'Faites défiler les idées et gardez celle qui vous donne envie.'}
        </p>

        {isWeek && (
          <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
            À planifier : <span className="font-bold">{pile.length}</span> · À pourvoir :{' '}
            <span className="font-bold">{freeLabel}</span>
          </p>
        )}

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-gray-800">Durée</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: 'Toutes les durées', value: null },
              { label: `Rapides (${QUICK_MINUTES} min max)`, value: QUICK_MINUTES },
            ].map((option) => {
              const selected = state.prefs.maxMinutes === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => commitState(setPrefs(state, { maxMinutes: option.value }))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-orange-600 bg-orange-600 text-white'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {isWeek && (
          <label className="mt-6 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={state.prefs.economical}
              onChange={(event) => commitState(setPrefs(state, { economical: event.target.checked }))}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span>
              <span className="block font-semibold text-gray-900">Menu économe</span>
              <span className="block text-sm text-gray-600">
                Proposer plus souvent des recettes qui partagent des ingrédients avec celles déjà prévues ou gardées :
                moins de courses à faire.
              </span>
            </span>
          </label>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => startSession(state)} className={primaryButton}>
            {isWeek ? 'Commencer' : 'Trouver mon dîner'}
          </button>
          {isWeek && (pile.length > 0 || getUpcomingEntries(state).length > 0) && (
            <Link href="/planning" className={secondaryButton}>
              Voir mon planning
            </Link>
          )}
        </div>
      </section>
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
          <h2 id="tonight-title" className="mt-1 text-2xl font-bold text-gray-900">
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
                roundCount.current = 0;
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

  if (phase === 'round-end') {
    const size = getRoundSize(mode);
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-lg sm:p-8" aria-live="polite">
        <h2 className="text-2xl font-bold text-gray-900">{isWeek ? `${size} recettes vues` : 'Pas encore trouvé ?'}</h2>
        <p className="mt-2 text-gray-600">
          {isWeek
            ? `Vous en avez gardé ${keptCount}. À planifier : ${pile.length}, à pourvoir : ${freeLabel}.`
            : `On vous en propose ${size} autres.`}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              roundCount.current = 0;
              showNext(state);
            }}
            className={primaryButton}
          >
            {isWeek ? `Encore ${size} recettes` : `${size} autres idées`}
          </button>
          {isWeek && (
            <Link href="/planning" onClick={() => trackEvent('swipe-finish', { kept: keptCount })} className={secondaryButton}>
              Terminer et planifier
            </Link>
          )}
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
          refusées{state.prefs.maxMinutes !== null ? ' ou élargir la durée' : ''}.
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
            <button
              type="button"
              onClick={() => {
                commitState(setPrefs(state, { maxMinutes: null }));
                setPhase('setup');
              }}
              className={secondaryButton}
            >
              Toutes les durées
            </button>
          )}
          {isWeek && (
            <Link href="/planning" className={secondaryButton}>
              Voir mon planning
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
  const pileIsEnough = isWeek && freeSlots > 0 && pile.length >= freeSlots;

  return (
    <section aria-label={isWeek ? 'Choix des recettes' : 'Choix du dîner'} className="mx-auto w-full max-w-sm">
      {isWeek && (
        <div className="mb-4 flex items-center justify-between text-sm font-semibold text-gray-700">
          <span>À planifier : {pile.length}</span>
          <span>
            {freeLabel} à pourvoir
          </span>
        </div>
      )}

      {pileIsEnough && !nudgeDismissed && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>Votre pile suffit pour remplir vos créneaux libres ({freeLabel}).</p>
          <span className="flex flex-shrink-0 items-center gap-2">
            <Link href="/planning" className="font-bold underline">
              Planifier
            </Link>
            <button
              type="button"
              onClick={() => setNudgeDismissed(true)}
              aria-label="Continuer à swiper"
              className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      <div className="relative aspect-[3/4] w-full" aria-live="polite">
        {stack.map(({ recipe, depth }) => (
          <SwipeCard
            key={recipe.id}
            ref={depth === 0 ? cardRef : undefined}
            recipe={recipe}
            depth={depth}
            onDecide={(direction) => decideRef.current(direction)}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => cardRef.current?.swipe('pass')}
          aria-label="Non merci"
          className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-rose-500 shadow-lg ring-1 ring-rose-100 transition-transform hover:scale-105 active:scale-95"
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
          aria-label={isWeek ? 'Garder dans mes favoris' : 'Je garde'}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-500 shadow-lg ring-1 ring-emerald-100 transition-transform hover:scale-105 active:scale-95"
        >
          <Check className="h-8 w-8" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-5 text-center text-sm text-gray-500">
        Glissez la carte, touchez les boutons ou utilisez les flèches du clavier.
      </p>

      {isWeek && (
        <div className="mt-4 text-center">
          <Link
            href="/planning"
            onClick={() => trackEvent('swipe-finish', { kept: keptCount })}
            className={`${secondaryButton} w-full`}
          >
            Terminer et planifier
          </Link>
        </div>
      )}
    </section>
  );
}
