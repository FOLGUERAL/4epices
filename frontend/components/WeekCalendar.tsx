'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History, Sparkles } from 'lucide-react';
import AddBar from '@/components/AddBar';
import EntryActionSheet from '@/components/EntryActionSheet';
import PlanMenu from '@/components/PlanMenu';
import { PlanList, PlanWeek } from '@/components/PlanViews';
import RecipePickerSheet, { type PickerRecipe } from '@/components/RecipePickerSheet';
import { toast } from '@/components/Toast';
import { addFavorite, getFavorites, removeFavorite, subscribeFavorites, type Favorite } from '@/lib/favorites';
import { buildIcs } from '@/lib/ics';
import {
  autoPlan,
  countFreeSlots,
  formatDayLabel,
  formatMealCount,
  formatSlotLabel,
  getHistoryPlanDays,
  getNextFreeSlot,
  getPile,
  getPlanDays,
  getPlanEvents,
  getSlotOccupant,
  getUpcomingEntries,
  MEAL_LABELS,
  planRecipe,
  toggleCookedAt,
  unplanSlot,
  type PlanDay,
  type PlanSlot,
} from '@/lib/planning';
import { addPlanToShoppingList, describePlanShopping } from '@/lib/shoppingFromPlan';
import { formatLocalDate, setPrefs, type PlanMeal, type SwipeRecipe, type SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, saveSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

interface WeekCalendarProps {
  /** Recettes publiées : catalogue de recherche, et durées (répartition automatique, durée des événements) */
  recipes: SwipeRecipe[];
}

const ALL_MEALS: PlanMeal[] = ['midi', 'soir'];

const viewButton = (active: boolean) =>
  `min-h-11 px-4 text-sm font-semibold transition-colors ${
    active ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 hover:bg-orange-50'
  }`;

export default function WeekCalendar({ recipes }: WeekCalendarProps) {
  const [state, setState] = useState<SwipeState | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [todayKey, setTodayKey] = useState('');
  /** Recette en attente : le prochain créneau touché la reçoit */
  const [armed, setArmed] = useState<PickerRecipe | null>(null);
  /** Créneau pour lequel la fenêtre de choix d'une recette est ouverte */
  const [sheetSlot, setSheetSlot] = useState<PlanSlot | null>(null);
  /** Créneau occupé dont la fenêtre d'actions est ouverte */
  const [entrySlot, setEntrySlot] = useState<PlanSlot | null>(null);
  const [chain, setChain] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [shopping, setShopping] = useState(false);

  const durations = useMemo(
    () => new Map(recipes.filter((item) => item.totalMinutes > 0).map((item) => [item.id, item.totalMinutes])),
    [recipes]
  );

  useEffect(() => {
    // Recharge aussi au retour sur la page : la fenêtre avance chaque jour
    const reload = () => {
      setState(loadSwipeState());
      setFavorites(getFavorites());
      setTodayKey(formatLocalDate(new Date()));
    };
    reload();
    const unsubscribeState = subscribeSwipeState(reload);
    const unsubscribeFavorites = subscribeFavorites(reload);
    window.addEventListener('focus', reload);
    return () => {
      unsubscribeState();
      unsubscribeFavorites();
      window.removeEventListener('focus', reload);
    };
  }, []);

  // Échap annule le placement en cours
  useEffect(() => {
    if (!armed) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setArmed(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [armed]);

  // Le planning vit dans le localStorage : rien à afficher avant le montage côté client
  if (!state) {
    return <div className="h-64 animate-pulse rounded-3xl bg-gray-200" aria-hidden="true" />;
  }

  const commit = (next: SwipeState) => {
    setState(next);
    saveSwipeState(next);
  };

  const days = getPlanDays(state);
  const historyDays = getHistoryPlanDays(state).filter((day) => day.slots.midi || day.slots.soir);
  const pile = getPile(favorites, state);
  const upcoming = getUpcomingEntries(state);
  const freeSlots = countFreeSlots(state);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.id));
  const sheetOccupant = sheetSlot ? getSlotOccupant(state, sheetSlot) : undefined;
  const entry = entrySlot ? getSlotOccupant(state, entrySlot) : undefined;

  // Un repas du midi déjà planifié reste visible même si l'affichage du midi est désactivé
  const hasLunchEntry = (list: PlanDay[]) => list.some((day) => day.slots.midi);
  const meals: PlanMeal[] = state.prefs.showLunch || hasLunchEntry(days) ? ALL_MEALS : ['soir'];
  const historyMeals: PlanMeal[] = state.prefs.showLunch || hasLunchEntry(historyDays) ? ALL_MEALS : ['soir'];

  const pileRecipes: PickerRecipe[] = pile.map((item) => ({
    id: item.id,
    slug: item.slug,
    titre: item.titre,
    imageUrl: item.imageUrl ?? null,
    totalMinutes: durations.get(item.id),
  }));

  const plannedLabels = new Map<number, string>();
  for (const planned of upcoming) {
    if (sheetOccupant && planned.date === sheetOccupant.date && planned.meal === sheetOccupant.meal) continue;
    plannedLabels.set(planned.recipeId, `${formatDayLabel(planned.date, 'short')} · ${MEAL_LABELS[planned.meal].toLowerCase()}`);
  }

  const View = state.prefs.planView === 'week' ? PlanWeek : PlanList;
  const firstDay = days[0]?.date;
  const lastDay = days[days.length - 1]?.date;

  const handleAutoPlan = () => {
    const next = autoPlan(state, pile, new Date(), durations);
    const placed = getUpcomingEntries(next).length - upcoming.length;
    commit(next);
    trackEvent('plan-auto', { placed });
    if (placed > 0) {
      toast.success(
        `${placed} ${placed === 1 ? 'recette placée' : 'recettes placées'} sur vos prochains ${
          state.prefs.showLunch ? 'repas' : 'dîners'
        }`
      );
    } else {
      toast.info('Aucun créneau libre à partir d’aujourd’hui');
    }
  };

  const handleExport = () => {
    const events = getPlanEvents(state, window.location.origin, durations);
    if (events.length === 0) {
      toast.info('Placez d’abord au moins une recette sur un jour à venir');
      return;
    }

    const content = buildIcs(events, { calendarName: 'Menu de la semaine 4épices' });
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `menu-${state.windowStart}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    trackEvent('plan-export', { events: events.length });
    toast.success('Fichier agenda téléchargé : ouvrez-le pour l’ajouter à votre calendrier');
  };

  // Ajoute à la liste de courses les ingrédients des repas à venir non cuisinés
  // (une recette déjà présente dans la liste n'est pas ré-ajoutée)
  const handleShopping = async () => {
    setShopping(true);
    try {
      const result = await addPlanToShoppingList(state);
      if (result.status === 'done') trackEvent('plan-shopping', { recipes: result.added });
      for (const message of describePlanShopping(result)) toast[message.level](message.text);
    } catch (error) {
      console.error('Erreur lors de l\'ajout à la liste de courses:', error);
      toast.error('Impossible de récupérer les ingrédients pour le moment');
    } finally {
      setShopping(false);
    }
  };

  // Un créneau est touché : il reçoit la recette en attente, ou ouvre le choix / les actions
  const handleSlot = (slot: PlanSlot) => {
    const occupant = getSlotOccupant(state, slot);
    const isPast = slot.date < todayKey;

    if (isPast) {
      if (occupant) setEntrySlot(slot);
      return;
    }
    if (armed) {
      commit(planRecipe(state, armed, slot));
      trackEvent('plan-assign', { meal: slot.meal, source: 'arme' });
      toast.success(`${armed.titre} : ${formatSlotLabel(slot)}`);
      setArmed(null);
      return;
    }
    if (occupant) setEntrySlot(slot);
    else setSheetSlot(slot);
  };

  const handlePick = (item: PickerRecipe) => {
    if (!sheetSlot) return;
    const next = planRecipe(state, item, sheetSlot);
    commit(next);
    trackEvent('plan-assign', { meal: sheetSlot.meal, source: 'creneau' });

    if (chain) {
      const following = getNextFreeSlot(next, sheetSlot, new Date());
      if (following) {
        setSheetSlot(following);
        return;
      }
      toast.info('Plus de créneau libre : le planning est complet');
    }
    setSheetSlot(null);
  };

  const handleSkip = () => {
    if (!sheetSlot) return;
    setSheetSlot(getNextFreeSlot(state, sheetSlot, new Date()));
  };

  const handleClear = () => {
    if (sheetSlot) commit(unplanSlot(state, sheetSlot));
    setSheetSlot(null);
  };

  // Ajout aux favoris uniquement sur demande : placer une recette dans le planning ne la met jamais en favoris
  const handleToggleFavorite = (recipe: PickerRecipe) => {
    if (favoriteIds.has(recipe.id)) {
      removeFavorite(recipe.id);
    } else {
      addFavorite({ id: recipe.id, slug: recipe.slug, titre: recipe.titre, imageUrl: recipe.imageUrl ?? undefined });
    }
  };

  const handleReplan = () => {
    if (!entry) return;
    // La recette est armée : à son placement, l'ancien repas non cuisiné est déplacé
    setArmed({ id: entry.recipeId, slug: entry.slug, titre: entry.titre, imageUrl: entry.imageUrl });
    trackEvent('plan-replan');
    setEntrySlot(null);
    toast.info('Touchez un créneau libre pour la replanifier');
  };

  const handleRemove = () => {
    if (!entrySlot || !entry) return;
    commit(unplanSlot(state, entrySlot));
    toast.info(`${entry.titre} retirée du planning`);
    setEntrySlot(null);
  };

  const handleReplace = () => {
    if (!entrySlot) return;
    setSheetSlot(entrySlot);
    setEntrySlot(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Planning</h2>
          <p className="text-xs tabular-nums text-gray-600">
            {firstDay && lastDay && `${formatDayLabel(firstDay, 'short')} – ${formatDayLabel(lastDay, 'short')}`}
            {upcoming.length > 0 && (
              <>
                {' · '}
                {upcoming.length} {upcoming.length === 1 ? 'repas prévu' : 'repas prévus'}
                {freeSlots > 0 && <> · {formatMealCount(freeSlots, state.prefs.showLunch)} à pourvoir</>}
              </>
            )}
          </p>
        </div>
        <PlanMenu
          hasMeals={upcoming.length > 0}
          shopping={shopping}
          showLunch={state.prefs.showLunch}
          onExport={handleExport}
          onShopping={handleShopping}
          onShowLunchChange={(value) => commit(setPrefs(state, { showLunch: value }))}
        />
      </div>

      <AddBar pile={pileRecipes} recipes={recipes} armed={armed} onArm={setArmed} onDisarm={() => setArmed(null)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Affichage" className="inline-flex overflow-hidden rounded-xl border border-orange-200">
          <button
            type="button"
            aria-pressed={state.prefs.planView === 'list'}
            onClick={() => commit(setPrefs(state, { planView: 'list' }))}
            className={viewButton(state.prefs.planView === 'list')}
          >
            Liste
          </button>
          <button
            type="button"
            aria-pressed={state.prefs.planView === 'week'}
            onClick={() => commit(setPrefs(state, { planView: 'week' }))}
            className={viewButton(state.prefs.planView === 'week')}
          >
            Semaine
          </button>
        </div>
        {pile.length > 0 && freeSlots > 0 && (
          <button
            type="button"
            onClick={handleAutoPlan}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-700"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Planifier pour moi
          </button>
        )}
      </div>

      {upcoming.length === 0 && (
        <p className="text-sm text-gray-600">
          Rien de prévu. Touchez un jour pour ajouter une recette, ou{' '}
          <Link href="/decouvrir" className="font-semibold text-orange-700 underline">
            découvrez-en de nouvelles
          </Link>
          .
        </p>
      )}

      {historyDays.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            aria-expanded={showHistory}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-orange-50"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            {showHistory ? 'Masquer les jours passés' : 'Jours passés'}
            {!showHistory && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs tabular-nums text-orange-700">
                {historyDays.length}
              </span>
            )}
          </button>
          {showHistory && (
            <View days={historyDays} meals={historyMeals} todayKey={todayKey} armed={armed !== null} onSlot={handleSlot} />
          )}
        </div>
      )}

      <View days={days} meals={meals} todayKey={todayKey} armed={armed !== null} onSlot={handleSlot} />

      <RecipePickerSheet
        slot={sheetSlot}
        occupant={sheetOccupant}
        state={state}
        pile={pileRecipes}
        recipes={recipes}
        favoriteIds={favoriteIds}
        plannedLabels={plannedLabels}
        chain={chain}
        hasNextFree={sheetSlot ? getNextFreeSlot(state, sheetSlot, new Date()) !== null : false}
        onChainChange={setChain}
        onPick={handlePick}
        onToggleFavorite={handleToggleFavorite}
        onClear={handleClear}
        onSkip={handleSkip}
        onClose={() => setSheetSlot(null)}
      />
      <EntryActionSheet
        entry={entry ?? null}
        isPast={entry ? entry.date < todayKey : false}
        canMarkCooked={entry ? entry.date <= todayKey : false}
        isFavorite={entry ? favoriteIds.has(entry.recipeId) : false}
        onToggleCooked={() => entrySlot && commit(toggleCookedAt(state, entrySlot))}
        onReplace={handleReplace}
        onRemove={handleRemove}
        onReplan={handleReplan}
        onToggleFavorite={() =>
          entry &&
          handleToggleFavorite({ id: entry.recipeId, slug: entry.slug, titre: entry.titre, imageUrl: entry.imageUrl })
        }
        onClose={() => setEntrySlot(null)}
      />
    </div>
  );
}
