'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Erreur lors de l enregistrement du service worker:', error);
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
