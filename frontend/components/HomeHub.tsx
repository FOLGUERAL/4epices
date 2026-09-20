'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookHeart, CalendarDays, ChefHat, ChevronRight, Compass, Moon } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import { getFavorites, subscribeFavorites } from '@/lib/favorites';
import { formatMealWhen, getNextMeal, getUpcomingEntries } from '@/lib/planning';
import type { SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';

const secondaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50';

/**
 * Le hub de l'accueil : le prochain repas prévu, les raccourcis vers les sous-applications et la Nonna.
 * Le planning et les favoris vivent dans le localStorage : la carte « Aujourd'hui » réserve sa place avant le montage.
 */
export default function HomeHub() {
  const [now, setNow] = useState<Date | null>(null);
  const [state, setState] = useState<SwipeState | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);

  useEffect(() => {
    const reload = () => {
      setNow(new Date());
      setState(loadSwipeState());
      setFavoritesCount(getFavorites().length);
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

  const ready = now !== null && state !== null;
  const next = ready ? getNextMeal(state, now) : undefined;
  const plannedCount = ready ? getUpcomingEntries(state).length : 0;

  const tiles = [
    {
      href: '/decouvrir',
      event: 'menu-home-cta',
      label: 'Découvrir',
      Icon: Compass,
      badge: 0,
      className: 'border-emerald-100 from-emerald-50 to-teal-100 text-emerald-700',
    },
    {
      href: '/ce-soir',
      event: 'tonight-home-cta',
      label: 'Ce soir',
      Icon: Moon,
      badge: 0,
      className: 'border-indigo-100 from-sky-50 to-indigo-100 text-indigo-700',
    },
    {
      href: '/planning',
      event: 'plan-home-cta',
      label: 'Planning',
      Icon: CalendarDays,
      badge: plannedCount,
      className: 'border-rose-100 from-rose-50 to-pink-100 text-rose-700',
    },
    {
      href: '/favoris',
      event: 'carnet-home-cta',
      label: 'Mon carnet',
      Icon: BookHeart,
      badge: favoritesCount,
      className: 'border-amber-100 from-amber-50 to-yellow-100 text-amber-700',
    },
  ];

  return (
    <section aria-label="Mon espace" className="mx-auto mb-10 max-w-3xl">
      <div className="mb-3 min-h-[6.5rem] rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow-sm sm:p-4">
        {!ready ? (
          <div className="h-20 animate-pulse rounded-xl bg-orange-100/60" aria-hidden="true" />
        ) : next ? (
          <div className="flex items-center gap-3">
            <span className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white">
              <OptimizedImage src={next.imageUrl} alt="" fill disableAspectRatio sizes="64px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">{formatMealWhen(next, now)}</p>
              <Link
                href={`/recettes/${next.slug}`}
                className="line-clamp-2 block text-base font-bold leading-snug text-gray-900 transition-colors hover:text-orange-700"
              >
                {next.titre}
              </Link>
            </div>
            <Link
              href={`/recettes/${next.slug}/cuisine`}
              data-umami-event="today-cook"
              className="focus-ring inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              <ChefHat className="h-5 w-5" aria-hidden="true" />
              Cuisiner
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Aujourd&apos;hui</p>
              <p className="text-base font-bold text-gray-900">Rien de prévu pour ce soir</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/ce-soir"
                data-umami-event="today-tonight"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-700"
              >
                Que manger ?
              </Link>
              <Link href="/planning" data-umami-event="today-plan" className={`focus-ring ${secondaryButton}`}>
                Planifier
              </Link>
            </div>
          </div>
        )}
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:gap-4">
        {tiles.map(({ href, event, label, Icon, badge, className }) => (
          <li key={href}>
            <Link
              href={href}
              data-umami-event={event}
              className={`focus-ring relative flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-gradient-to-br p-2 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${className}`}
            >
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              <span className="text-xs font-bold leading-tight text-gray-900 sm:text-sm">{label}</span>
              {badge > 0 && (
                <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-white px-1.5 text-center text-[10px] font-bold tabular-nums text-gray-800 shadow-sm">
                  <span className="sr-only">{`${badge} `}</span>
                  {badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href={next ? `/recettes/${next.slug}/cuisine` : '/mode-cuisine'}
        data-umami-event="nonna-home-cta"
        className="focus-ring mt-3 flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-100 p-3 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md sm:p-4"
      >
        <span className="relative h-14 w-14 flex-shrink-0 sm:h-16 sm:w-16">
          <Image src="/images/nonna-speaking.webp" alt="" fill sizes="64px" className="object-contain" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-orange-700">Mode Cuisine</span>
          <span className="block text-base font-bold text-gray-900">Cuisinez avec la Nonna</span>
          <span className="block text-sm text-gray-700">Étapes guidées, voix et minuteurs.</span>
        </span>
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-orange-700" aria-hidden="true" />
      </Link>
    </section>
  );
}
