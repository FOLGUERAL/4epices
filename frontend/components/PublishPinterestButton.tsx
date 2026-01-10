'use client';

import { useState } from 'react';
import { toast } from './Toast';

interface PublishPinterestButtonProps {
  recetteId: number;
  pinterestPinId?: string;
  onSuccess?: (pinterestPinId: string) => void;
}

/**
 * Composant bouton pour publier une recette sur Pinterest
 */
export default function PublishPinterestButton({ 
  recetteId, 
  pinterestPinId,
  onSuccess 
}: PublishPinterestButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (pinterestPinId) {
      toast.info('Cette recette est déjà publiée sur Pinterest');
      return;
    }

    setIsPublishing(true);

    try {
      const response = await fetch('/api/publish-pinterest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recetteId }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Recette publiée sur Pinterest avec succès !');
        
        // Appeler le callback si fourni
        if (onSuccess && result.data?.data?.pinterestPinId) {
          onSuccess(result.data.data.pinterestPinId);
        }
        
        // Rafraîchir la page après un court délai pour afficher le badge
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(result.message || 'Erreur lors de la publication sur Pinterest');
      }
    } catch (error) {
      console.error('Erreur publication Pinterest:', error);
      toast.error('Erreur lors de la publication sur Pinterest');
    } finally {
      setIsPublishing(false);
    }
  };

  // Ne pas afficher le bouton si déjà publié
  if (pinterestPinId) {
    return null;
  }

  return (
    <button
      onClick={handlePublish}
      disabled={isPublishing}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isPublishing
          ? 'bg-gray-400 text-white cursor-not-allowed'
          : 'bg-red-600 text-white hover:bg-red-700'
      } shadow-sm`}
      title="Publier sur Pinterest"
    >
      {isPublishing ? (
        <>
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Publication...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.951-1.878l.434-1.647c.094-.357.567-.477.86-.207.044.033.086.07.123.111.06.067.131.14.21.211.05.046.1.09.15.132.418.35.942.531 1.487.528.545.003 1.069-.178 1.487-.528.05-.042.1-.086.15-.132.079-.071.15-.144.21-.211.037-.041.079-.078.123-.111.293-.27.766-.15.86.207l.434 1.647c.238.651.665 1.413.951 1.878-.655.203-1.352.312-2.073.312zm-3-6.5c-.828 0-1.5-.672-1.5-1.5S8.172 9.5 9 9.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm6 0c-.828 0-1.5-.672-1.5-1.5S14.172 9.5 15 9.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5z" />
          </svg>
          <span>Publier sur Pinterest</span>
        </>
      )}
    </button>
  );
}

