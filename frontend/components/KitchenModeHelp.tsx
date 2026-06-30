'use client';

import { HelpCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import KitchenModePreview from '@/components/KitchenModePreview';

type KitchenModeHelpProps = {
  autoOpen?: boolean;
  storageKey?: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

const defaultStorageKey = 'kitchen_mode_help_hidden';

const helpSteps = [
  ['1', 'Choisissez une recette', 'Parcourez les recettes ou reprenez la derniere en un clic.'],
  ['2', 'Lancez le Mode Cuisine', 'Les ingredients, portions et etapes sont prepares pour cuisiner.'],
  ['3', 'Suivez le chef', 'Lecture vocale, progression et commandes mains libres vous accompagnent.'],
];

export default function KitchenModeHelp({
  autoOpen = false,
  storageKey = defaultStorageKey,
  triggerLabel = 'Comment ca marche ?',
  triggerClassName = '',
}: KitchenModeHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;

    try {
      if (window.localStorage.getItem(storageKey) === 'true') return;
    } catch {
      return;
    }

    const timeoutId = window.setTimeout(() => setIsOpen(true), 500);
    return () => window.clearTimeout(timeoutId);
  }, [autoOpen, storageKey]);

  const close = () => {
    if (autoOpen && dontShowAgain) {
      try {
        window.localStorage.setItem(storageKey, 'true');
      } catch {
        // L'aide restera simplement disponible au prochain chargement.
      }
    }

    setIsOpen(false);
  };

  return (
    <>
      {!autoOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/30 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10 focus-ring ${triggerClassName}`}
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          {triggerLabel}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/65 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kitchen-help-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 text-gray-950 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-700">
                  Mode Cuisine
                </p>
                <h2 id="kitchen-help-title" className="text-xl font-bold">
                  Cuisiner avec 4epices
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  Une recette devient un guidage pas a pas, lisible et utilisable en cuisine.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-ring"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
              <div className="space-y-3">
                {helpSteps.map(([number, title, text]) => (
                  <div key={title} className="flex gap-3 rounded-lg border border-gray-100 p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                      {number}
                    </span>
                    <div>
                      <h3 className="font-bold text-gray-950">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <KitchenModePreview />
            </div>

            {autoOpen && (
              <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(event) => setDontShowAgain(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                Ne plus afficher cette aide
              </label>
            )}

            <button
              type="button"
              onClick={close}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-orange-600 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-700 focus-ring"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
