'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  MEAL_LABELS,
  PLAN_MEALS,
  formatDayLabel,
  formatSlotLabel,
  getPlanDays,
  getQuickSlots,
  getUpcomingEntry,
  type PlannableRecipe,
  type PlanSlot,
} from '@/lib/planning';
import type { SwipeState } from '@/lib/swipeEngine';

interface DayMealPickerProps {
  /** Recette à placer ; null = fenêtre fermée */
  recipe: PlannableRecipe | null;
  state: SwipeState;
  onPick: (slot: PlanSlot) => void;
  onClose: () => void;
}

/** Choix d'un jour et d'un repas pour une recette (Échap ou clic à côté pour fermer). */
export default function DayMealPicker({ recipe, state, onPick, onClose }: DayMealPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = recipe !== null;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!recipe) return null;

  const days = getPlanDays(state);
  const current = getUpcomingEntry(state, recipe.id);
  const quickSlots = getQuickSlots(state, new Date());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-picker-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-gray-50 p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="day-picker-title" className="text-xl font-bold text-gray-900">
              Choisir un jour
            </h2>
            <p className="mt-1 truncate text-sm text-gray-600">{recipe.titre}</p>
            {current && (
              <p className="mt-1 text-xs capitalize text-emerald-700">
                Actuellement : {formatSlotLabel({ date: current.date, meal: current.meal })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {quickSlots.length > 0 && (
          <ul aria-label="Raccourcis" className="mt-4 flex flex-wrap gap-2">
            {quickSlots.map(({ label, slot }) => (
              <li key={`${slot.date}|${slot.meal}`}>
                <button
                  type="button"
                  onClick={() => onPick(slot)}
                  className="min-h-11 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
                >
                  {label}
                  {label === 'Prochain libre' && (
                    <span className="font-normal capitalize">
                      {' '}
                      : {formatDayLabel(slot.date, 'short')} · {MEAL_LABELS[slot.meal].toLowerCase()}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-4 space-y-2">
          {days.map((day) => {
            const isToday = day.date === state.windowStart;
            return (
              <li key={day.date} className="rounded-xl bg-white p-3">
                <p className="text-sm font-bold capitalize text-gray-900">
                  {formatDayLabel(day.date)}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] normal-case text-orange-700">
                      Aujourd&apos;hui
                    </span>
                  )}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {PLAN_MEALS.map((meal) => {
                    const occupant = day.slots[meal];
                    const isCurrent = current?.date === day.date && current.meal === meal;
                    return (
                      <button
                        key={meal}
                        type="button"
                        onClick={() => onPick({ date: day.date, meal })}
                        disabled={isCurrent}
                        aria-label={`${formatDayLabel(day.date)}, ${MEAL_LABELS[meal].toLowerCase()}${
                          occupant ? ` (remplace ${occupant.titre})` : ''
                        }`}
                        className={`min-h-11 rounded-lg border px-2 py-1 text-left text-sm transition-colors ${
                          isCurrent
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : occupant
                              ? 'border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-300'
                              : 'border-dashed border-gray-300 text-gray-700 hover:border-orange-400 hover:bg-orange-50'
                        }`}
                      >
                        <span className="block font-semibold">{MEAL_LABELS[meal]}</span>
                        <span className="block truncate text-xs">
                          {isCurrent ? 'Actuel' : occupant ? `Remplace : ${occupant.titre}` : 'Libre'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
