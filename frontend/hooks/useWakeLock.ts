'use client';

import { useEffect, useRef } from 'react';

/**
 * Empêche l'écran de s'éteindre ou de se verrouiller tant que `enabled` est vrai (Mode Cuisine : les mains sont
 * occupées, pas question de devoir déverrouiller le téléphone entre deux étapes).
 *
 * Le navigateur relâche le verrou dès que l'onglet passe en arrière-plan (écran éteint par l'utilisateur, changement
 * d'appli) : on le redemande automatiquement au retour. Sans l'API Wake Lock (Safari avant iOS 16.4, par exemple),
 * l'écran suit son réglage habituel : aucune erreur, juste pas de maintien.
 */
export function useWakeLock(enabled: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          // enabled est redevenu faux (ou le composant s'est démonté) pendant la requête
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      } catch {
        // Refusé (onglet en arrière-plan, batterie faible…) : sans gravité, l'écran suit son réglage habituel
      }
    };

    acquire();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) acquire();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [enabled]);
}
