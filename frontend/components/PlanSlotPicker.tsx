'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import { formatSlotLabel, type PlanSlot } from '@/lib/planning';
import type { PlanEntry } from '@/lib/swipeEngine';

/** Une recette proposée pour un créneau (un favori à planifier, ou un repas déjà prévu ailleurs). */
export interface PickerItem {
  id: number;
  slug: string;
  titre: string;
  imageUrl?: string | null;
  note?: string;
}

interface PlanSlotPickerProps {
  /** Créneau concerné ; null = fenêtre fermée */
  slot: PlanSlot | null;
  /** Repas déjà placé sur ce créneau, s'il y en a un */
  occupant?: PlanEntry;
  /** La pile : favoris qui n'ont pas encore de repas à venir */
  pile: PickerItem[];
  /** Repas déjà prévus ailleurs (on peut les déplacer ici) */
  elsewhere: PickerItem[];
  onPick: (item: PickerItem) => void;
  onClear: () => void;
  onClose: () => void;
}

const SEARCH_THRESHOLD = 8;

// Minuscules sans accents, pour une recherche tolérante
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function RecipeRow({ item, onPick }: { item: PickerItem; onPick: (item: PickerItem) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(item)}
        className="flex w-full items-center gap-3 rounded-xl bg-white p-2 text-left transition-colors hover:bg-orange-50"
      >
        <span className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <OptimizedImage src={item.imageUrl} alt="" fill disableAspectRatio sizes="48px" className="object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900">{item.titre}</span>
          {item.note && <span className="block truncate text-xs text-gray-500">{item.note}</span>}
        </span>
      </button>
    </li>
  );
}

/** Fenêtre de choix d'une recette pour un créneau du calendrier (Échap ou clic à côté pour fermer). */
export default function PlanSlotPicker({ slot, occupant, pile, elsewhere, onPick, onClear, onClose }: PlanSlotPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const isOpen = slot !== null;
  // Le gestionnaire change à chaque rendu du parent : on le lit via une référence pour ne pas relancer l'effet
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');

    // Rend le focus à l'élément qui a ouvert la fenêtre une fois fermée
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

  const needle = normalize(query.trim());
  const filteredPile = useMemo(
    () => (needle ? pile.filter((item) => normalize(item.titre).includes(needle)) : pile),
    [pile, needle]
  );
  const filteredElsewhere = useMemo(
    () => (needle ? elsewhere.filter((item) => normalize(item.titre).includes(needle)) : elsewhere),
    [elsewhere, needle]
  );

  if (!slot) return null;

  const total = pile.length + elsewhere.length;

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
        aria-labelledby="plan-picker-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-gray-50 p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="plan-picker-title" className="text-xl font-bold text-gray-900">
              Choisir une recette
            </h2>
            <p className="mt-1 text-sm capitalize text-gray-600">{formatSlotLabel(slot)}</p>
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

        {occupant && (
          <div className="mt-4 rounded-2xl bg-white p-3">
            <p className="text-sm text-gray-600">
              Actuellement : <span className="font-semibold text-gray-900">{occupant.titre}</span>
            </p>
            <button
              type="button"
              onClick={onClear}
              className="mt-2 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
            >
              Libérer ce créneau
            </button>
          </div>
        )}

        {total > SEARCH_THRESHOLD && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher dans mes favoris"
            aria-label="Rechercher une recette"
            className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        )}

        {total === 0 && (
          <p className="mt-4 text-sm text-gray-600">
            Aucune recette à placer. Ajoutez des favoris, ou gardez des recettes en swipant.
          </p>
        )}

        {total > 0 && filteredPile.length + filteredElsewhere.length === 0 && (
          <p className="mt-4 text-sm text-gray-600">Aucune recette ne correspond à votre recherche.</p>
        )}

        {filteredPile.length > 0 && (
          <section className="mt-4" aria-label="Favoris à planifier">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">À planifier</h3>
            <ul className="space-y-2">
              {filteredPile.map((item) => (
                <RecipeRow key={item.id} item={item} onPick={onPick} />
              ))}
            </ul>
          </section>
        )}

        {filteredElsewhere.length > 0 && (
          <section className="mt-4" aria-label="Repas déjà prévus ailleurs">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Déjà planifiées (les déplacer ici)</h3>
            <ul className="space-y-2">
              {filteredElsewhere.map((item) => (
                <RecipeRow key={item.id} item={item} onPick={onPick} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
