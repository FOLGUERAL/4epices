'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Erreur</h1>
        <p className="text-xl text-gray-600 mb-4">
          Une erreur s'est produite lors du chargement de la page.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left max-w-2xl">
            <p className="text-sm text-red-800 font-mono">{error.message}</p>
          </div>
        )}
        <button
          onClick={reset}
          className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}


