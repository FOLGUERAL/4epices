'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Compass, Download, MoreHorizontal, ShoppingBasket, Sun } from 'lucide-react';

interface PlanMenuProps {
  hasMeals: boolean;
  shopping: boolean;
  showLunch: boolean;
  onExport: () => void;
  onShopping: () => void;
  onShowLunchChange: (value: boolean) => void;
}

const itemClass =
  'flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-orange-50 disabled:opacity-50';

/** Menu « ⋯ » : les actions secondaires du planning, hors de la vue principale. */
export default function PlanMenu({ hasMeals, shopping, showLunch, onExport, onShopping, onShowLunchChange }: PlanMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Plus d’actions"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-orange-200 bg-white text-orange-700 transition-colors hover:bg-orange-50"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-xl"
        >
          <button type="button" role="menuitem" onClick={run(onExport)} disabled={!hasMeals} className={itemClass}>
            <Download className="h-5 w-5 text-gray-500" aria-hidden="true" />
            Ajouter à mon agenda
          </button>
          <button type="button" role="menuitem" onClick={run(onShopping)} disabled={!hasMeals || shopping} className={itemClass}>
            <ShoppingBasket className="h-5 w-5 text-gray-500" aria-hidden="true" />
            {shopping ? 'Ajout en cours…' : 'Ajouter les courses'}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showLunch}
            onClick={() => onShowLunchChange(!showLunch)}
            className={itemClass}
          >
            <Sun className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <span className="flex-1">Afficher le midi</span>
            {showLunch && <Check className="h-5 w-5 text-orange-600" aria-hidden="true" />}
          </button>
          <Link href="/decouvrir" role="menuitem" className={`${itemClass} border-t border-gray-100`}>
            <Compass className="h-5 w-5 text-gray-500" aria-hidden="true" />
            Découvrir des recettes
          </Link>
        </div>
      )}
    </div>
  );
}
