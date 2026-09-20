'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { PlanWeek } from '@/components/PlanViews';
import { getFavorites, subscribeFavorites, type Favorite } from '@/lib/favorites';
import { countFreeSlots, formatMealCount, getPile, getPlanDays, getUpcomingEntries } from '@/lib/planning';
import { formatLocalDate, type PlanMeal, type SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';

/** Vue semaine du planning en haut du carnet. Toucher un créneau ouvre le planning pour le modifier. */
export default function PlanSummary() {
  const router = useRouter();
  const [state, setState] = useState<SwipeState | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [todayKey, setTodayKey] = useState('');

  useEffect(() => {
    const reload = () => {
      setState(loadSwipeState());
      setFavorites(getFavorites());
      setTodayKey(formatLocalDate(new Date()));
    };
    reload();

    const unsubscribeState = subscribeSwipeState(reload);
    const unsubscribeFavorites = subscribeFavorites(reload);
    return () => {
      unsubscribeState();
      unsubscribeFavorites();
    };
  }, []);

  // Le planning vit dans le localStorage : rien à afficher avant le montage côté client
  if (!state) return null;

  const days = getPlanDays(state);
  const upcoming = getUpcomingEntries(state);
  const pileCount = getPile(favorites, state).length;
  const freeSlots = countFreeSlots(state);
  const toPlan = pileCount > 0 && freeSlots > 0;
  // Un repas du midi déjà planifié reste visible même si l'affichage du midi est désactivé
  const meals: PlanMeal[] =
    state.prefs.showLunch || days.some((day) => day.slots.midi) ? ['midi', 'soir'] : ['soir'];

  return (
    <section aria-labelledby="plan-summary-title" className="mb-10 rounded-3xl bg-white p-4 shadow-md sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="plan-summary-title" className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <CalendarDays className="h-5 w-5 text-orange-600" aria-hidden="true" />
          Mon planning
        </h2>
        <p className="text-xs tabular-nums text-gray-600">
          {upcoming.length} {upcoming.length === 1 ? 'repas prévu' : 'repas prévus'}
          {pileCount > 0 && (
            <>
              {' · '}
              {pileCount} {pileCount === 1 ? 'favori à planifier' : 'favoris à planifier'}
            </>
          )}
          {freeSlots > 0 && <> · {formatMealCount(freeSlots, state.prefs.showLunch)} à pourvoir</>}
        </p>
      </div>

      <div className="mt-3">
        <PlanWeek
          days={days}
          meals={meals}
          todayKey={todayKey}
          armed={false}
          onSlot={() => router.push('/planning')}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/planning"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition-colors hover:bg-orange-700"
        >
          {toPlan ? 'Planifier' : 'Ouvrir le planning'}
        </Link>
        <Link
          href="/decouvrir"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-orange-200 px-5 py-3 font-semibold text-orange-700 transition-colors hover:bg-orange-50"
        >
          Découvrir de nouvelles recettes
        </Link>
      </div>
    </section>
  );
}
