'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChefHat, Download, History, Pencil, Plus, RotateCcw, ShoppingBasket, Sparkles } from 'lucide-react';
import DayMealPicker from '@/components/DayMealPicker';
import OptimizedImage from '@/components/OptimizedImage';
import PlanSlotPicker, { type PickerItem } from '@/components/PlanSlotPicker';
import { toast } from '@/components/Toast';
import { getFavorites, subscribeFavorites, type Favorite } from '@/lib/favorites';
import { buildIcs } from '@/lib/ics';
import {
  MEAL_LABELS,
  autoPlan,
  countFreeSlots,
  formatDayLabel,
  formatSlotLabel,
  getHistoryPlanDays,
  getPile,
  getPlanDays,
  getPlanEvents,
  getShoppingEntries,
  getSlotOccupant,
  getUpcomingEntries,
  planRecipe,
  toggleCookedAt,
  unplanSlot,
  type PileRecipe,
  type PlanDay,
  type PlanSlot,
} from '@/lib/planning';
import { addIngredientsToShoppingList, isRecipeInShoppingList } from '@/lib/shoppingList';
import { getRecettesBySlugs } from '@/lib/strapi';
import { formatLocalDate, setPrefs, type PlanMeal, type SwipeRecipe, type SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, saveSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

interface WeekCalendarProps {
  /** Recettes publiées : servent à connaître les durées (répartition automatique, durée des événements) */
  recipes: SwipeRecipe[];
}

const TRAY_LIMIT = 12;

const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 font-semibold text-orange-700 transition-colors hover:bg-orange-50';

export default function WeekCalendar({ recipes }: WeekCalendarProps) {
  const [state, setState] = useState<SwipeState | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [picker, setPicker] = useState<PlanSlot | null>(null);
  const [recipePicker, setRecipePicker] = useState<PileRecipe | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showWholePile, setShowWholePile] = useState(false);
  const [shopping, setShopping] = useState(false);
  const [todayKey, setTodayKey] = useState('');

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

  // Le planning vit dans le localStorage : rien à afficher avant le montage côté client
  if (!state) {
    return <div className="h-64 animate-pulse rounded-3xl bg-gray-200" aria-hidden="true" />;
  }

  const commit = (next: SwipeState) => {
    setState(next);
    saveSwipeState(next);
  };

  if (favorites.length === 0 && state.plan.length === 0) {
    return (
      <section aria-labelledby="planning-empty-title" className="rounded-3xl bg-white p-6 text-center shadow-lg sm:p-8">
        <h2 id="planning-empty-title" className="text-2xl font-bold text-gray-900">
          Commencez par choisir des recettes
        </h2>
        <p className="mx-auto mt-2 max-w-md text-gray-600">
          Le calendrier se remplit avec vos favoris. Gardez des recettes en swipant, ou ajoutez-en depuis la liste des
          recettes.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/menu-semaine"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition-colors hover:bg-orange-700"
          >
            Choisir mes recettes
          </Link>
          <Link href="/recettes" className={secondaryButton}>
            Parcourir les recettes
          </Link>
        </div>
      </section>
    );
  }

  const days = getPlanDays(state);
  const historyDays = getHistoryPlanDays(state);
  const historyRecipeCount = historyDays.reduce(
    (total, day) => total + (day.slots.midi ? 1 : 0) + (day.slots.soir ? 1 : 0),
    0
  );
  const pile = getPile(favorites, state);
  const shownPile = showWholePile ? pile : pile.slice(0, TRAY_LIMIT);
  const upcoming = getUpcomingEntries(state);
  const freeSlots = countFreeSlots(state);
  const meals: PlanMeal[] = state.prefs.showLunch ? ['midi', 'soir'] : ['soir'];
  const pickerOccupant = picker ? getSlotOccupant(state, picker) : undefined;

  const pickerPile: PickerItem[] = pile.map((item) => ({
    id: item.id,
    slug: item.slug,
    titre: item.titre,
    imageUrl: item.imageUrl,
    note: item.lastCookedDate ? `Cuisinée le ${formatDayLabel(item.lastCookedDate, 'short')}` : undefined,
  }));
  const pickerElsewhere: PickerItem[] = upcoming
    .filter((entry) => !(pickerOccupant && entry.date === pickerOccupant.date && entry.meal === pickerOccupant.meal))
    .map((entry) => ({
      id: entry.recipeId,
      slug: entry.slug,
      titre: entry.titre,
      imageUrl: entry.imageUrl,
      note: formatSlotLabel({ date: entry.date, meal: entry.meal }),
    }));

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
    if (upcoming.length === 0) {
      toast.info('Planifiez d’abord des repas');
      return;
    }
    const uniqueEntries = getShoppingEntries(state);
    if (uniqueEntries.length === 0) {
      toast.info('Tous vos repas à venir sont déjà cuisinés : rien à ajouter');
      return;
    }
    const toAdd = uniqueEntries.filter((entry) => !isRecipeInShoppingList(entry.recipeId));
    if (toAdd.length === 0) {
      toast.info('Toutes ces recettes sont déjà dans votre liste de courses');
      return;
    }

    setShopping(true);
    try {
      const recettes = await getRecettesBySlugs(toAdd.map((entry) => entry.slug));
      const bySlug = new Map(recettes.map((recette) => [recette.attributes.slug, recette]));

      let added = 0;
      for (const entry of toAdd) {
        const ingredients = bySlug.get(entry.slug)?.attributes.ingredients;
        if (Array.isArray(ingredients)) {
          addIngredientsToShoppingList(ingredients, entry.recipeId);
          added += 1;
        }
      }
      const failed = toAdd.length - added;
      trackEvent('plan-shopping', { recipes: added });

      if (added > 0) {
        const already = uniqueEntries.length - toAdd.length;
        toast.success(
          `${added} ${added === 1 ? 'recette ajoutée' : 'recettes ajoutées'} à la liste de courses` +
            (already > 0 ? ` (${already} déjà présente${already > 1 ? 's' : ''})` : '')
        );
      }
      if (failed > 0) {
        toast.error(`${failed} ${failed === 1 ? "recette n'a" : "recettes n'ont"} pas pu être ajoutée${failed > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout à la liste de courses:', error);
      toast.error('Impossible de récupérer les ingrédients pour le moment');
    } finally {
      setShopping(false);
    }
  };

  const handlePickFromSlot = (item: PickerItem) => {
    if (!picker) return;
    commit(planRecipe(state, item, picker));
    trackEvent('plan-assign', { meal: picker.meal, source: 'creneau' });
    setPicker(null);
  };

  const handlePickFromRecipe = (slot: PlanSlot) => {
    if (!recipePicker) return;
    commit(planRecipe(state, recipePicker, slot));
    trackEvent('plan-assign', { meal: slot.meal, source: 'pile' });
    setRecipePicker(null);
  };

  const handleClear = () => {
    if (picker) commit(unplanSlot(state, picker));
    setPicker(null);
  };

  // Un repas prévu un jour passé mais pas cuisiné retourne dans la pile
  const handleReplan = (slot: PlanSlot, titre: string) => {
    commit(unplanSlot(state, slot));
    trackEvent('plan-replan');
    toast.info(`${titre} est de retour dans « À planifier » : choisissez-lui un nouveau jour`);
  };

  const renderDay = (day: PlanDay) => {
    const isToday = day.date === todayKey;
    const isPast = todayKey !== '' && day.date < todayKey;
    const isFuture = todayKey !== '' && day.date > todayKey;

    return (
      <li
        key={day.date}
        aria-current={isToday ? 'date' : undefined}
        className={`rounded-2xl bg-white p-3 shadow-sm ${isToday ? 'ring-2 ring-orange-400' : ''} ${isPast ? 'opacity-80' : ''}`}
      >
        <h3 className="flex items-center justify-between gap-2 text-sm font-bold capitalize text-gray-900">
          <span>{formatDayLabel(day.date)}</span>
          {isToday && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold normal-case text-orange-700">
              Aujourd&apos;hui
            </span>
          )}
        </h3>

        <div className="mt-2 space-y-2">
          {meals.map((meal) => {
            const occupant = day.slots[meal];
            const slot: PlanSlot = { date: day.date, meal };
            return (
              <div key={meal}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">{MEAL_LABELS[meal]}</p>
                {occupant ? (
                  <div
                    className={`rounded-xl border p-2 ${
                      occupant.cooked ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <OptimizedImage
                          src={occupant.imageUrl}
                          alt=""
                          fill
                          disableAspectRatio
                          sizes="40px"
                          className="object-cover"
                        />
                      </span>
                      <Link
                        href={`/recettes/${occupant.slug}`}
                        className={`line-clamp-2 min-w-0 flex-1 text-sm font-semibold hover:text-orange-700 ${
                          occupant.cooked ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}
                      >
                        {occupant.titre}
                      </Link>
                    </div>
                    {isPast && !occupant.cooked && (
                      <p className="mt-1 text-xs font-medium text-amber-700">Pas encore cuisinée</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-1">
                      {isFuture ? (
                        // Un repas à venir ne peut pas encore avoir été cuisiné
                        <span aria-hidden="true" />
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={occupant.cooked}
                            onChange={() => commit(toggleCookedAt(state, slot))}
                            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          Cuisinée
                        </label>
                      )}
                      <span className="flex gap-1">
                        <Link
                          href={`/recettes/${occupant.slug}/cuisine`}
                          onClick={() => trackEvent('plan-cook', { recipe: occupant.slug })}
                          aria-label={`Cuisiner ${occupant.titre} avec la Nonna`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700 transition-colors hover:bg-orange-200"
                        >
                          <ChefHat className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {isPast ? (
                          !occupant.cooked && (
                            <button
                              type="button"
                              onClick={() => handleReplan(slot, occupant.titre)}
                              aria-label={`Replanifier ${occupant.titre}`}
                              className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Replanifier
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPicker(slot)}
                            aria-label={`Modifier ${MEAL_LABELS[meal].toLowerCase()} du ${formatDayLabel(day.date)}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                ) : isPast ? (
                  <p
                    className="flex min-h-[3.5rem] items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400"
                    aria-label={`${formatDayLabel(day.date)}, ${MEAL_LABELS[meal].toLowerCase()} : aucune recette`}
                  >
                    —
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPicker(slot)}
                    aria-label={`${formatDayLabel(day.date)}, ${MEAL_LABELS[meal].toLowerCase()} : libre, choisir une recette`}
                    className="flex min-h-[3.5rem] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 transition-colors hover:border-orange-300 hover:text-orange-700"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Choisir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </li>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {pile.length > 0 && freeSlots > 0 && (
          <button type="button" onClick={handleAutoPlan} className={secondaryButton}>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            Planifier pour moi
          </button>
        )}
        <button type="button" onClick={handleExport} disabled={upcoming.length === 0} className={`${secondaryButton} disabled:opacity-50`}>
          <Download className="h-5 w-5" aria-hidden="true" />
          Ajouter à mon agenda
        </button>
        <button
          type="button"
          onClick={handleShopping}
          disabled={upcoming.length === 0 || shopping}
          className={`${secondaryButton} disabled:opacity-50`}
        >
          <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
          {shopping ? 'Ajout en cours…' : 'Ajouter les courses'}
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={state.prefs.showLunch}
            onChange={(event) => commit(setPrefs(state, { showLunch: event.target.checked }))}
            className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          Afficher le midi
        </label>
        <Link href="/menu-semaine" className="ml-auto text-sm font-semibold text-orange-700 underline">
          Choisir de nouvelles recettes
        </Link>
      </div>

      <section aria-label="Favoris à planifier" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold text-amber-900">
          {pile.length === 0
            ? 'Tous vos favoris sont planifiés'
            : `${pile.length} ${pile.length === 1 ? 'favori à planifier' : 'favoris à planifier'}`}
        </h2>
        {pile.length > 0 && (
          <>
            <ul className="mt-2 flex flex-wrap gap-2">
              {shownPile.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setRecipePicker(item)}
                    aria-label={`Planifier ${item.titre}`}
                    className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-orange-50 hover:text-orange-700"
                  >
                    {item.titre}
                  </button>
                </li>
              ))}
            </ul>
            {pile.length > TRAY_LIMIT && (
              <button
                type="button"
                onClick={() => setShowWholePile((value) => !value)}
                className="mt-2 text-xs font-semibold text-amber-900 underline"
              >
                {showWholePile ? 'Réduire' : `Voir les ${pile.length - TRAY_LIMIT} autres`}
              </button>
            )}
            <p className="mt-2 text-xs text-amber-800">
              Touchez une recette pour choisir son jour, ou un créneau libre du calendrier pour la choisir.
            </p>
          </>
        )}
      </section>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowHistory((value) => !value)}
          aria-expanded={showHistory}
          className={secondaryButton}
        >
          <History className="h-5 w-5" aria-hidden="true" />
          {showHistory ? 'Masquer les 7 jours précédents' : 'Voir les 7 jours précédents'}
          {!showHistory && historyRecipeCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs">{historyRecipeCount}</span>
          )}
        </button>
      </div>

      {showHistory && (
        <section aria-label="Jours précédents" className="mb-6">
          <p className="mb-3 text-sm text-gray-600">
            Cochez « cuisinée » ou replanifiez les recettes que vous n&apos;avez pas encore faites. On ne planifie plus
            sur un jour passé, et après 7 jours un créneau passé disparaît (la recette reste dans vos favoris).
          </p>
          <ol className="grid grid-cols-1 gap-3 lg:grid-cols-4">{historyDays.map(renderDay)}</ol>
        </section>
      )}

      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-4">{days.map(renderDay)}</ol>

      <p className="mt-6 text-center text-sm text-gray-500">
        Votre planning et vos favoris sont enregistrés sur cet appareil. La fenêtre avance chaque jour.
      </p>

      <PlanSlotPicker
        slot={picker}
        occupant={pickerOccupant}
        pile={pickerPile}
        elsewhere={pickerElsewhere}
        onPick={handlePickFromSlot}
        onClear={handleClear}
        onClose={() => setPicker(null)}
      />
      <DayMealPicker recipe={recipePicker} state={state} onPick={handlePickFromRecipe} onClose={() => setRecipePicker(null)} />
    </div>
  );
}
