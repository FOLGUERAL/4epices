'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallPWAButtonProps = {
  className?: string;
};

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function InstallPWAButton({ className = '' }: InstallPWAButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (!installPrompt) {
      setIsHelpOpen(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-gray-800 focus-ring ${className}`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Installer 4epices
      </button>

      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 text-gray-950 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Installer 4epices</h2>
                <p className="mt-1 text-sm text-gray-600">
                  L'installation native n'est pas proposee automatiquement par ce navigateur pour le moment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-ring"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <p>
                Sur Android Chrome : ouvrez le menu en haut a droite, puis choisissez
                "Installer l'application" ou "Ajouter a l'ecran d'accueil".
              </p>
              <p>
                Sur Windows Chrome ou Edge : utilisez l'icone d'installation dans la barre
                d'adresse, ou le menu du navigateur.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
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
