'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import type { SwipeRecipe } from '@/lib/swipeEngine';

const SWIPE_THRESHOLD_PX = 100;
const DRAG_START_PX = 6;
const EXIT_DURATION_MS = 220;

export type SwipeDirection = 'keep' | 'pass';

export interface SwipeCardHandle {
  swipe: (direction: SwipeDirection) => void;
}

interface SwipeCardProps {
  recipe: SwipeRecipe;
  /** 0 = carte du dessus (interactive) ; 1 et 2 = cartes visibles en dessous */
  depth: number;
  onDecide: (direction: SwipeDirection) => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Carte de recette glissable. Le geste ne démarre qu'après quelques pixels de déplacement, pour que
 * le lien « Voir la recette » reste cliquable et que le défilement vertical de la page ne soit pas bloqué.
 */
const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { recipe, depth, onDecide },
  ref
) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<SwipeDirection | null>(null);
  const startX = useRef<number | null>(null);
  const captured = useRef(false);
  const exitTimer = useRef<number | null>(null);
  const isTop = depth === 0;

  useEffect(() => {
    return () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    };
  }, []);

  const commit = (direction: SwipeDirection) => {
    if (exiting) return;
    if (prefersReducedMotion()) {
      onDecide(direction);
      return;
    }
    setExiting(direction);
    setOffset((direction === 'keep' ? 1 : -1) * window.innerWidth);
    exitTimer.current = window.setTimeout(() => onDecide(direction), EXIT_DURATION_MS);
  };

  useImperativeHandle(ref, () => ({ swipe: commit }));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isTop || exiting) return;
    startX.current = event.clientX;
    captured.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const dx = event.clientX - startX.current;

    if (!captured.current && Math.abs(dx) > DRAG_START_PX) {
      captured.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (captured.current) setOffset(dx);
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (startX.current === null) return;
    const dx = event.clientX - startX.current;
    const wasDragging = captured.current;
    startX.current = null;
    captured.current = false;

    if (wasDragging && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);

    if (wasDragging && !cancelled && Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
      commit(dx > 0 ? 'keep' : 'pass');
    } else {
      setOffset(0);
    }
  };

  const strength = Math.min(1, Math.abs(offset) / SWIPE_THRESHOLD_PX);
  const style: React.CSSProperties = isTop
    ? {
        transform: `translateX(${offset}px) rotate(${offset / 20}deg)`,
        transition: dragging ? 'none' : `transform ${EXIT_DURATION_MS}ms ease-out`,
        touchAction: 'pan-y',
      }
    : {
        transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.045})`,
      };

  return (
    <div
      role={isTop ? 'group' : undefined}
      aria-roledescription={isTop ? 'carte de recette' : undefined}
      aria-label={isTop ? recipe.titre : undefined}
      aria-hidden={isTop ? undefined : true}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event, false)}
      onPointerCancel={(event) => finishGesture(event, true)}
      style={{ ...style, zIndex: 10 - depth }}
      className={`absolute inset-0 select-none overflow-hidden rounded-3xl bg-gray-200 shadow-xl ${
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
      }`}
    >
      <OptimizedImage
        src={recipe.imageUrl}
        alt={isTop ? recipe.imageAlt : ''}
        fill
        disableAspectRatio
        priority={isTop}
        sizes="(max-width: 640px) 92vw, 440px"
        className="pointer-events-none object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {isTop && (
        <>
          <span
            aria-hidden="true"
            style={{ opacity: offset > 0 ? strength : 0 }}
            className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-extrabold uppercase tracking-wide text-emerald-400"
          >
            Je garde
          </span>
          <span
            aria-hidden="true"
            style={{ opacity: offset < 0 ? strength : 0 }}
            className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-extrabold uppercase tracking-wide text-rose-400"
          >
            Non merci
          </span>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h2 className="text-2xl font-bold leading-tight [text-wrap:balance] sm:text-3xl">{recipe.titre}</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
          {recipe.totalMinutes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {recipe.totalMinutes} min
            </span>
          )}
          {recipe.difficulte && (
            <span className="rounded-full bg-white/20 px-3 py-1 capitalize backdrop-blur">{recipe.difficulte}</span>
          )}
        </div>
        {recipe.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-orange-50">{recipe.description}</p>
        )}
        {isTop && (
          <a
            href={`/recettes/${recipe.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white underline underline-offset-2 hover:text-orange-200"
          >
            Voir la recette
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
});

export default SwipeCard;
