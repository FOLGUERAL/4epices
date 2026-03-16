'use client';

import { useState, useEffect } from 'react';
import { getAvis, Avis } from '@/lib/strapi';
import { toast } from './Toast';
import axios from 'axios';

interface CommentsViewerProps {
  recetteId?: number;
  recetteSlug?: string;
}

export default function CommentsViewer({ recetteId, recetteSlug }: CommentsViewerProps) {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Avis[]>([]);
  // Par défaut, afficher uniquement les avis publiés (approuvés)
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('approved');

  const fetchComments = async () => {
    setLoading(true);
    try {
      let params: {
        recetteId?: number;
        approuve?: boolean;
      } = {};

      if (recetteId) {
        params.recetteId = recetteId;
      } else if (recetteSlug) {
        // Récupérer d'abord l'ID de la recette depuis le slug
        try {
          const response = await fetch(`/api/recettes?filters[slug][$eq]=${recetteSlug}`);
          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              params.recetteId = data.data[0].id;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la recette:', error);
        }
      }

      // Appliquer le filtre
      if (filter === 'approved') {
        params.approuve = true;
      } else if (filter === 'pending') {
        params.approuve = false;
      }

      const response = await getAvis(params);
      setComments(response.data || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des avis:', error);
      toast.error('Erreur lors du chargement des avis');
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (commentId: number) => {
    try {
      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
      await axios.put(`${strapiUrl}/api/avis/${commentId}`, {
        data: { approuve: true },
      });
      toast.success('Avis approuvé');
      fetchComments();
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      toast.error('Erreur lors de l\'approbation');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet avis ?')) {
      return;
    }

    try {
      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
      await axios.delete(`${strapiUrl}/api/avis/${commentId}`);
      toast.success('Avis supprimé');
      fetchComments();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    fetchComments();
  }, [recetteId, recetteSlug, filter]);

  // Filtrer les commentaires selon le filtre sélectionné
  const filteredComments = comments.filter((comment) => {
    if (filter === 'approved') return comment.attributes.approuve;
    if (filter === 'pending') return !comment.attributes.approuve;
    return true; // 'all' : afficher tous les commentaires
  });

  const pendingCount = comments.filter((c) => !c.attributes.approuve).length;

  return (
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          💬 Commentaires
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-orange-500 text-white rounded-full">
              {pendingCount} en attente
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'approved' | 'pending')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Tous</option>
            <option value="approved">Approuvés</option>
            <option value="pending">En attente</option>
          </select>
          <button
            onClick={fetchComments}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            🔄
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : filteredComments.length > 0 ? (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredComments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg border ${
                comment.attributes.approuve
                  ? 'bg-green-50 border-green-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {comment.attributes.author || 'Anonyme'}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${
                            star <= comment.attributes.rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    {comment.attributes.approuve && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                        Publié
                      </span>
                    )}
                  </div>
                  {comment.attributes.recette?.data && (
                    <div className="text-xs text-gray-500 mb-1">
                      📝 {comment.attributes.recette.data.attributes.titre}
                    </div>
                  )}
                  {comment.attributes.comment && (
                    <div className="text-sm text-gray-700 mb-2 mt-2">
                      {comment.attributes.comment}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    📅 {new Date(comment.attributes.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {!comment.attributes.approuve && (
                  <button
                    onClick={() => handleApprove(comment.id)}
                    className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✅ Approuver
                  </button>
                )}
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>📭 Aucun avis {filter !== 'all' && filter === 'approved' ? 'publié' : filter === 'pending' ? 'en attente' : ''}</p>
          <p className="text-xs mt-2">
            {filter === 'pending' && 'Les avis en attente nécessitent une modération'}
            {filter === 'all' && comments.length === 0 && 'Les avis déposés sur les pages recettes apparaîtront ici'}
          </p>
        </div>
      )}
    </div>
  );
}
