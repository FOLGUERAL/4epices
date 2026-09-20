import type { ReactNode } from 'react';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Puce de filtre à bascule, partagée par la feuille du planning et la liste des recettes. */
export default function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
        active
          ? 'border-orange-600 bg-orange-600 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
      }`}
    >
      {children}
    </button>
  );
}
