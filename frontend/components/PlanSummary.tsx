'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { MEAL_LABELS, countFreeSlots, formatDayLabel, formatMealCount, getUpcomingEntries } from '@/lib/planning';
import type { SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';

const MAX_SHOWN = 4;

/** Aperçu des prochains repas planifiés, en haut de la page Favoris. */
export default function PlanSummary() {
  const [state, setState] = useState<SwipeState | null>(null);

  useEffect(() => {
    const reload = () => setState(loadSwipeState());
    reload();
    return subscribeSwipeState(reload);
  }, []);

  // Le planning vit dans le localStorage : rien à afficher avant le montage côté client
  if (!state) return null;

  const upcoming = getUpcomingEntries(state);
  const freeSlots = countFreeSlots(state);

  return (
    <section aria-labelledby="plan-summary-title" className="mb-10 rounded-3xl bg-white p-6 shadow-md sm:p-7">
      <h2 id="plan-summary-title" className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <CalendarDays className="h-6 w-6 text-orange-600" aria-hidden="true" />
        Mon planning
      </h2>

      {upcoming.length === 0 ? (
        <p className="mt-2 text-gray-600">
          Aucun repas planifié. Placez vos favoris dans le calendrier pour organiser vos prochains jours.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">
            {upcoming.length} {upcoming.length === 1 ? 'repas prévu' : 'repas prévus'} ·{' '}
            {formatMealCount(freeSlots, state.prefs.showLunch)} à pourvoir
          </p>
          <ul className="mt-4 space-y-2">
            {upcoming.slice(0, MAX_SHOWN).map((entry) => (
              <li key={`${entry.date}-${entry.meal}`} className="flex items-baseline gap-3 text-sm">
                <span className="w-40 flex-shrink-0 capitalize text-gray-500">
                  {formatDayLabel(entry.date, 'short')} · {MEAL_LABELS[entry.meal].toLowerCase()}
                </span>
                <Link href={`/recettes/${entry.slug}`} className="truncate font-semibold text-gray-900 hover:text-orange-700">
                  {entry.titre}
                </Link>
              </li>
            ))}
          </ul>
          {upcoming.length > MAX_SHOWN && (
            <p className="mt-2 text-xs text-gray-500">et {upcoming.length - MAX_SHOWN} autres…</p>
          )}
        </>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/planning"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition-colors hover:bg-orange-700"
        >
          Voir mon planning
        </Link>
        <Link
          href="/menu-semaine"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-orange-200 px-5 py-3 font-semibold text-orange-700 transition-colors hover:bg-orange-50"
        >
          Découvrir de nouvelles recettes
        </Link>
      </div>
    </section>
  );
}
