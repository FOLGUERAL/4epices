'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from './Toast';
import { isAdmin } from '@/lib/admin-auth';

type PinterestMeResponse =
  | { connected: false; username: null }
  | { connected: true; username: string | null; user?: any };

function randomState(): string {
  // crypto.randomUUID est dispo dans la plupart des navigateurs modernes
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Panneau admin : connexion OAuth Pinterest + affichage du username.
 *
 * Flux:
 * - Clic -> redirection vers https://www.pinterest.com/oauth/?response_type=code&...
 * - Pinterest -> redirect_uri (= Strapi /api/pinterest/callback)
 * - Strapi stocke le token (démo: mémoire) puis redirige vers l'admin
 * - Ici, on appelle /api/pinterest/me (proxy Next -> Strapi) pour afficher le compte connecté
 */
export default function PinterestConnectPanel() {
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<PinterestMeResponse | null>(null);

  useEffect(() => {
    setIsAdminUser(isAdmin());
  }, []);

  const fetchMe = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/pinterest/me', { timeout: 10_000 });
      setMe(response.data);
    } catch (e) {
      setMe({ connected: false, username: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminUser) return;
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser]);

  const connectedUsername = useMemo(() => {
    if (!me || me.connected !== true) return null;
    return me.username || null;
  }, [me]);

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_PINTEREST_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_PINTEREST_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      toast.error(
        'Configuration manquante: NEXT_PUBLIC_PINTEREST_CLIENT_ID / NEXT_PUBLIC_PINTEREST_REDIRECT_URI'
      );
      return;
    }

    const state = randomState();
    try {
      sessionStorage.setItem('pinterest_oauth_state', state);
    } catch {
      // Non bloquant (démo)
    }

    const oauthUrl = new URL('https://www.pinterest.com/oauth/');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', 'pins:read,pins:write,boards:read');
    oauthUrl.searchParams.set('state', state);

    window.location.href = oauthUrl.toString();
  };

  if (!isAdminUser) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Connexion Pinterest (OAuth)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Pour la démo, on connecte le compte via OAuth puis on vérifie via{' '}
            <code className="px-1 py-0.5 bg-gray-100 rounded">/api/pinterest/me</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMe}
            disabled={loading}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              loading
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title="Rafraîchir le statut"
          >
            Rafraîchir
          </button>

          <button
            onClick={handleConnect}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="Connecter mon compte Pinterest"
          >
            Connecter mon compte Pinterest
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-gray-500">Vérification en cours…</div>
        ) : connectedUsername ? (
          <div className="text-sm font-medium text-green-700">
            Compte Pinterest connecté : <span className="font-semibold">{connectedUsername}</span>
          </div>
        ) : (
          <div className="text-sm font-medium text-gray-700">
            Compte Pinterest connecté : <span className="text-gray-500">non</span>
          </div>
        )}
      </div>
    </div>
  );
}

