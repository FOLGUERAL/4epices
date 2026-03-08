'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from './Toast';

interface ShareToPinterestButtonProps {
  recetteId: number;
  recetteSlug: string;
  recetteTitle: string;
  recetteDescription?: string;
  recetteImageUrl?: string;
}

/**
 * Bouton pour partager une recette sur Pinterest (pour tous les utilisateurs)
 * 
 * Flux:
 * 1. Vérifie si l'utilisateur est connecté à Pinterest
 * 2. Si non → redirige vers OAuth
 * 3. Si oui → affiche modal avec sélection de board
 * 4. Partage la recette sur le board choisi
 */
export default function ShareToPinterestButton({
  recetteId,
  recetteSlug,
  recetteTitle,
  recetteDescription,
  recetteImageUrl,
}: ShareToPinterestButtonProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [boards, setBoards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // Vérifier le statut de connexion Pinterest au chargement
  useEffect(() => {
    // Récupérer le sessionId depuis l'URL si présent (après redirection OAuth)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const pinterestSession = urlParams.get('pinterest_session');
      if (pinterestSession) {
        // Stocker le sessionId dans un cookie (valide 30 jours)
        const cookieValue = `pinterest_session_id=${pinterestSession}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Lax`;
        document.cookie = cookieValue;
        
        // Nettoyer l'URL
        urlParams.delete('pinterest_session');
        const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
        window.history.replaceState({}, '', newUrl);
        
        // Vérifier le statut immédiatement avec le sessionId de l'URL
        // (le cookie sera utilisé pour les prochains appels)
        checkStatus(pinterestSession);
        return;
      }
    }
    checkStatus();
  }, []);

  const checkStatus = async (sessionIdFromUrl?: string) => {
    try {
      // Si on a un sessionId depuis l'URL, le passer en paramètre pour le premier appel
      const url = sessionIdFromUrl 
        ? `/api/pinterest/status?sessionId=${encodeURIComponent(sessionIdFromUrl)}`
        : '/api/pinterest/status';
      
      const response = await axios.get(url, { 
        timeout: 10_000,
        withCredentials: true, // S'assurer que les cookies sont envoyés
      });
      setIsConnected(response.data.connected || false);
      setUsername(response.data.username || null);
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_PINTEREST_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_PINTEREST_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      toast.error('Configuration Pinterest manquante');
      return;
    }

    // Générer un state avec l'URL de retour (pour revenir à la recette après OAuth)
    const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
    const state = `return:${encodeURIComponent(returnUrl)}`;

    const oauthUrl = new URL('https://www.pinterest.com/oauth/');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', 'pins:read,pins:write,boards:read,boards:write,user_accounts:read');
    oauthUrl.searchParams.set('state', state);

    window.location.href = oauthUrl.toString();
  };

  const handleShareClick = async () => {
    if (!isConnected) {
      handleConnect();
      return;
    }

    setIsLoading(true);
    try {
      // Charger les boards
      const boardsResponse = await axios.get('/api/pinterest/boards', { timeout: 15_000 });
      setBoards(boardsResponse.data.boards || []);
      
      if (boardsResponse.data.boards && boardsResponse.data.boards.length > 0) {
        setSelectedBoardId(boardsResponse.data.boards[0].id);
        setShowModal(true);
      } else {
        toast.error('Aucun board Pinterest trouvé. Créez-en un sur Pinterest d\'abord.');
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        // Token expiré, reconnecter
        setIsConnected(false);
        handleConnect();
      } else {
        toast.error('Erreur lors du chargement des boards Pinterest');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedBoardId) {
      toast.error('Veuillez sélectionner un board');
      return;
    }

    setIsSharing(true);
    try {
      const response = await axios.post(
        '/api/pinterest/share',
        {
          recetteId,
          boardId: selectedBoardId,
          title: recetteTitle,
          description: recetteDescription,
        },
        { timeout: 30_000 }
      );

      if (response.data.success) {
        toast.success('Recette partagée sur Pinterest avec succès !');
        setShowModal(false);
        
        // Optionnel : ouvrir le pin dans un nouvel onglet
        if (response.data.pin?.id) {
          const pinUrl = `https://www.pinterest.fr/pin/${response.data.pin.id}/`;
          // window.open(pinUrl, '_blank'); // Décommenter si souhaité
        }
      } else {
        toast.error(response.data.message || 'Erreur lors du partage');
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Erreur lors du partage sur Pinterest';
      toast.error(message);
      
      if (error?.response?.status === 401) {
        // Token expiré, reconnecter
        setIsConnected(false);
        setShowModal(false);
        handleConnect();
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post('/api/pinterest/disconnect');
      setIsConnected(false);
      setUsername(null);
      toast.success('Compte Pinterest déconnecté');
    } catch (error) {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  return (
    <>
      <button
        onClick={handleShareClick}
        disabled={isLoading || isSharing}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isLoading || isSharing
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-red-600 text-white hover:bg-red-700'
        } shadow-sm`}
        title="Partager sur Pinterest"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Chargement...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.951-1.878l.434-1.647c.094-.357.567-.477.86-.207.044.033.086.07.123.111.06.067.131.14.21.211.05.046.1.09.15.132.418.35.942.531 1.487.528.545.003 1.069-.178 1.487-.528.05-.042.1-.086.15-.132.079-.071.15-.144.21-.211.037-.041.079-.078.123-.111.293-.27.766-.15.86.207l.434 1.647c.238.651.665 1.413.951 1.878-.655.203-1.352.312-2.073.312zm-3-6.5c-.828 0-1.5-.672-1.5-1.5S8.172 9.5 9 9.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm6 0c-.828 0-1.5-.672-1.5-1.5S14.172 9.5 15 9.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5z" />
            </svg>
            <span>{isConnected ? 'Partager sur Pinterest' : 'Connecter Pinterest pour partager'}</span>
          </>
        )}
      </button>

      {/* Modal de sélection de board */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Partager sur Pinterest</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isConnected && username && (
              <div className="mb-4 text-sm text-gray-600">
                Connecté en tant que : <span className="font-semibold">{username}</span>
                <button
                  onClick={handleDisconnect}
                  className="ml-2 text-red-600 hover:text-red-700 underline"
                >
                  Déconnecter
                </button>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="board-select" className="block text-sm font-medium text-gray-700 mb-2">
                Choisir un board
              </label>
              <select
                id="board-select"
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isSharing}
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isSharing}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing || !selectedBoardId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? 'Partage en cours...' : 'Partager'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
