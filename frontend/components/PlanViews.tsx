'use client';

import { Check, Plus } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import { MEAL_LABELS, formatDayLabel, type PlanDay, type PlanSlot } from '@/lib/planning';
import type { PlanEntry, PlanMeal } from '@/lib/swipeEngine';

interface PlanViewProps {
  days: PlanDay[];
  meals: PlanMeal[];
  todayKey: string;
  /** Une recette est en attente de placement : les créneaux libres se mettent en évidence */
  armed: boolean;
  onSlot: (slot: PlanSlot) => void;
}

interface SlotCellProps {
  slot: PlanSlot;
  entry: PlanEntry | undefined;
  todayKey: string;
  armed: boolean;
  /** « tile » : cellule verticale de la vue semaine ; « row » : cellule d'une ligne de la liste */
  variant: 'row' | 'tile';
  showMealLabel: boolean;
  onSlot: (slot: PlanSlot) => void;
}

function SlotCell({ slot, entry, todayKey, armed, variant, showMealLabel, onSlot }: SlotCellProps) {
  const isPast = slot.date < todayKey;
  const tile = variant === 'tile';
  const size = tile ? 'h-24 flex-col items-start justify-start gap-1.5' : 'min-h-14 items-center gap-3';
  const where = `${formatDayLabel(slot.date)}, ${MEAL_LABELS[slot.meal].toLowerCase()}`;
  const mealLabel = showMealLabel ? (
    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">{MEAL_LABELS[slot.meal]}</span>
  ) : null;

  if (entry) {
    const pending = isPast && !entry.cooked;
    return (
      <button
        type="button"
        onClick={() => onSlot(slot)}
        aria-label={`${where} : ${entry.titre}${entry.cooked ? ', cuisinée' : ''}. ${
          armed && !isPast ? 'Remplacer' : 'Ouvrir les actions'
        }`}
        className={`flex w-full rounded-xl border p-2 text-left transition-colors ${size} ${
          entry.cooked
            ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
            : pending
              ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
              : 'border-gray-100 bg-gray-50 hover:border-orange-200 hover:bg-orange-50'
        } ${armed && !isPast ? 'ring-2 ring-orange-200' : ''}`}
      >
        <span className={`relative flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 ${tile ? 'h-8 w-8' : 'h-10 w-10'}`}>
          <OptimizedImage src={entry.imageUrl} alt="" fill disableAspectRatio sizes="40px" className="object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          {mealLabel}
          <span
            className={`block text-sm font-semibold ${tile ? 'line-clamp-2 text-xs' : 'line-clamp-2'} ${
              entry.cooked ? 'text-gray-500 line-through' : 'text-gray-900'
            }`}
          >
            {entry.titre}
          </span>
          {pending && <span className="block text-xs font-medium text-amber-700">Pas encore cuisinée</span>}
        </span>
        {entry.cooked && <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />}
      </button>
    );
  }

  if (isPast) {
    return (
      <span
        aria-label={`${where} : aucune recette`}
        className={`flex w-full justify-center rounded-xl bg-gray-50 text-sm text-gray-400 ${
          tile ? 'h-24 items-center' : 'min-h-14 items-center'
        }`}
      >
        —
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSlot(slot)}
      aria-label={`${where} : libre. ${armed ? 'Placer ici' : 'Choisir une recette'}`}
      className={`flex w-full justify-center rounded-xl border-2 border-dashed p-2 text-sm font-semibold transition-colors ${
        tile ? 'h-24 flex-col items-center gap-1' : 'min-h-14 items-center gap-1.5'
      } ${
        armed
          ? 'border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100'
          : 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-700'
      }`}
    >
      {mealLabel}
      <span className="inline-flex items-center gap-1">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {armed ? 'Placer ici' : 'Ajouter'}
      </span>
    </button>
  );
}

function TodayBadge() {
  return (
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Aujourd&apos;hui</span>
  );
}

/** Une ligne par jour : le format léger, lisible sur mobile. */
export function PlanList({ days, meals, todayKey, armed, onSlot }: PlanViewProps) {
  return (
    <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm">
      {days.map((day) => {
        const isToday = day.date === todayKey;
        return (
          <li
            key={day.date}
            aria-current={isToday ? 'date' : undefined}
            className={`grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 p-2.5 ${isToday ? 'bg-orange-50/60' : ''}`}
          >
            <p className="pt-2 text-sm font-bold capitalize leading-tight text-gray-900">
              {formatDayLabel(day.date, 'short')}
              {isToday && (
                <span className="mt-1 block">
                  <TodayBadge />
                </span>
              )}
            </p>
            <div className="flex flex-col gap-1.5 sm:flex-row">
              {meals.map((meal) => (
                <div key={meal} className="min-w-0 flex-1">
                  <SlotCell
                    slot={{ date: day.date, meal }}
                    entry={day.slots[meal]}
                    todayKey={todayKey}
                    armed={armed}
                    variant="row"
                    showMealLabel={meals.length > 1}
                    onSlot={onSlot}
                  />
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Vue semaine, à la demande : une colonne par jour, une case par repas. */
export function PlanWeek({ days, meals, todayKey, armed, onSlot }: PlanViewProps) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
      <ol className="grid min-w-max auto-cols-[minmax(7.5rem,1fr)] grid-flow-col gap-2">
        {days.map((day) => {
          const isToday = day.date === todayKey;
          return (
            <li
              key={day.date}
              aria-current={isToday ? 'date' : undefined}
              className={`space-y-1.5 rounded-xl p-1.5 ${isToday ? 'bg-orange-50/60' : ''}`}
            >
              <p className="flex items-center justify-between gap-1 px-1 text-sm font-bold capitalize text-gray-900">
                {formatDayLabel(day.date, 'short')}
                {isToday && <span className="h-2 w-2 rounded-full bg-orange-500" aria-label="Aujourd'hui" />}
              </p>
              {meals.map((meal) => (
                <SlotCell
                  key={meal}
                  slot={{ date: day.date, meal }}
                  entry={day.slots[meal]}
                  todayKey={todayKey}
                  armed={armed}
                  variant="tile"
                  showMealLabel={meals.length > 1}
                  onSlot={onSlot}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
