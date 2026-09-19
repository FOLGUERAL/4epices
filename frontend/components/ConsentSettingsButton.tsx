'use client';

interface GoogleFc {
  callbackQueue?: Array<unknown>;
  showRevocationMessage?: () => void;
}

/** Rouvre le message de consentement Google pour modifier ses choix publicitaires. */
export default function ConsentSettingsButton({ className = '' }: { className?: string }) {
  const openConsentSettings = () => {
    const win = window as Window & { googlefc?: GoogleFc };
    win.googlefc = win.googlefc || {};
    win.googlefc.callbackQueue = win.googlefc.callbackQueue || [];
    win.googlefc.callbackQueue.push(() => win.googlefc?.showRevocationMessage?.());
  };

  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      Gérer mes choix publicitaires
    </button>
  );
}
