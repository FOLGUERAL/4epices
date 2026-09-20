'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus, CalendarCheck } from 'lucide-react';
import DayMealPicker from '@/components/DayMealPicker';
import { toast } from '@/components/Toast';
import { formatDayLabel, getUpcomingEntry, MEAL_LABELS, planRecipe, type PlanSlot } from '@/lib/planning';
import type { SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, saveSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

interface PlanFavoriteButtonProps {
  recette: { id: number; slug: string; titre: string; imageUrl?: string };
}

/** Bouton « Planifier » d'une carte de favori : choisit le jour et le repas dans le calendrier. */
export default function PlanFavoriteButton({ recette }: PlanFavoriteButtonProps) {
  const [state, setState] = useState<SwipeState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reload = () => setState(loadSwipeState());
    reload();
    return subscribeSwipeState(reload);
  }, []);

  // Le planning vit dans le localStorage : rien à afficher avant le montage côté client
  if (!state) return null;

  const upcoming = getUpcomingEntry(state, recette.id);

  const handlePick = (slot: PlanSlot) => {
    saveSwipeState(planRecipe(state, recette, slot));
    trackEvent('plan-assign', { meal: slot.meal, source: 'favoris' });
    toast.success(`${recette.titre} planifiée : ${formatDayLabel(slot.date)}, ${MEAL_LABELS[slot.meal].toLowerCase()}`);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
          upcoming
            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            : 'border border-orange-200 text-orange-700 hover:bg-orange-50'
        }`}
      >
        {upcoming ? (
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="capitalize">
          {upcoming
            ? `${formatDayLabel(upcoming.date, 'short')} · ${MEAL_LABELS[upcoming.meal].toLowerCase()}`
            : 'Planifier'}
        </span>
      </button>

      <DayMealPicker recipe={open ? recette : null} state={state} onPick={handlePick} onClose={() => setOpen(false)} />
    </>
  );
}
