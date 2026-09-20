'use client';

import Link from 'next/link';
import { ChefHat, Check, ExternalLink, Heart, Repeat, RotateCcw, Trash2 } from 'lucide-react';
import PlanSheet from '@/components/PlanSheet';
import { formatSlotLabel } from '@/lib/planning';
import type { PlanEntry } from '@/lib/swipeEngine';
import { trackEvent } from '@/lib/track';

interface EntryActionSheetProps {
  /** Repas ouvert ; null = fenêtre fermée */
  entry: PlanEntry | null;
  /** Le jour est passé : on ne remplace ni ne retire, on peut seulement cuisiner ou replanifier */
  isPast: boolean;
  /** Le repas a eu lieu ou a lieu aujourd'hui : on peut le marquer « cuisiné » */
  canMarkCooked: boolean;
  isFavorite: boolean;
  onToggleCooked: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onReplan: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}

const rowClass =
  'flex min-h-12 w-full items-center gap-3 rounded-xl bg-white px-4 text-left text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-orange-50';

/** Actions possibles sur un repas déjà planifié. */
export default function EntryActionSheet({
  entry,
  isPast,
  canMarkCooked,
  isFavorite,
  onToggleCooked,
  onReplace,
  onRemove,
  onReplan,
  onToggleFavorite,
  onClose,
}: EntryActionSheetProps) {
  return (
    <PlanSheet
      open={entry !== null}
      title={entry ? formatSlotLabel({ date: entry.date, meal: entry.meal }) : ''}
      subtitle={entry?.titre}
      onClose={onClose}
    >
      {entry && (
        <ul className="space-y-1.5">
          <li>
            <Link href={`/recettes/${entry.slug}`} className={rowClass}>
              <ExternalLink className="h-5 w-5 text-gray-500" aria-hidden="true" />
              Voir la recette
            </Link>
          </li>
          <li>
            <Link
              href={`/recettes/${entry.slug}/cuisine`}
              onClick={() => trackEvent('plan-cook', { recipe: entry.slug })}
              className={rowClass}
            >
              <ChefHat className="h-5 w-5 text-orange-600" aria-hidden="true" />
              Cuisiner avec la Nonna
            </Link>
          </li>
          {canMarkCooked && (
            <li>
              <button type="button" onClick={onToggleCooked} className={rowClass}>
                <Check className={`h-5 w-5 ${entry.cooked ? 'text-emerald-600' : 'text-gray-500'}`} aria-hidden="true" />
                {entry.cooked ? 'Cuisinée : annuler' : 'Marquer comme cuisinée'}
              </button>
            </li>
          )}
          {isPast && !entry.cooked && (
            <li>
              <button type="button" onClick={onReplan} className={rowClass}>
                <RotateCcw className="h-5 w-5 text-amber-700" aria-hidden="true" />
                Replanifier
              </button>
            </li>
          )}
          {!isPast && (
            <>
              <li>
                <button type="button" onClick={onReplace} className={rowClass}>
                  <Repeat className="h-5 w-5 text-gray-500" aria-hidden="true" />
                  Remplacer par une autre recette
                </button>
              </li>
              <li>
                <button type="button" onClick={onRemove} className={`${rowClass} text-red-700`}>
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                  Retirer du planning
                </button>
              </li>
            </>
          )}
          <li>
            <button type="button" onClick={onToggleFavorite} aria-pressed={isFavorite} className={rowClass}>
              <Heart
                className={`h-5 w-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : 'text-gray-500'}`}
                aria-hidden="true"
              />
              {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
          </li>
        </ul>
      )}
    </PlanSheet>
  );
}
