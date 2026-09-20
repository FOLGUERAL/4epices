/**
 * Envoie un événement d'audience anonyme à Umami, s'il est chargé (voir UmamiAnalytics).
 * Sans effet si Umami est absent, bloqué ou non configuré : ne lève jamais d'erreur.
 */

interface UmamiWindow extends Window {
  umami?: { track: (name: string, data?: Record<string, string | number>) => void };
}

export function trackEvent(name: string, data?: Record<string, string | number>): void {
  if (typeof window === 'undefined') return;

  try {
    (window as UmamiWindow).umami?.track(name, data);
  } catch {
    // Les statistiques ne doivent jamais gêner l'utilisateur
  }
}
