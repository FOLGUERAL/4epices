'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from './Toast';

interface Comment {
  id: number;
  attributes: {
    contenu: string;
    auteur?: string;
    email?: string;
    approuve: boolean;
    createdAt: string;
    recette?: {
      data: {
        id: number;
        attributes: {
          titre: string;
          slug: string;
        };
      };
    };
  };
}

interface CommentsViewerProps {
  recetteId?: number;
  recetteSlug?: string;
}

export default function CommentsViewer({ recetteId, recetteSlug }: CommentsViewerProps) {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const fetchComments = async () => {
    setLoading(true);
    try {
      let url = '/api/comments';
      const params: any = {};
      
      if (recetteId) {
        params['filters[recette][id][$eq]'] = recetteId;
      } else if (recetteSlug) {
        // Récupérer d'abord l'ID de la recette depuis le slug
        const recetteResponse = await axios.get(`/api/recettes?filters[slug][$eq]=${recetteSlug}`);
        if (recetteResponse.data.data && recetteResponse.data.data.length > 0) {
          params['filters[recette][id][$eq]'] = recetteResponse.data.data[0].id;
        }
      }

      if (filter === 'approved') {
        params['filters[approuve][$eq]'] = true;
      } else if (filter === 'pending') {
        params['filters[approuve][$eq]'] = false;
      }

      const response = await axios.get(url, { params });
      
      // Gérer les deux formats possibles (Strapi v4)
      const commentsData = response.data.data || response.data || [];
      setComments(Array.isArray(commentsData) ? commentsData : []);
    } catch (error: any) {
      // Si l'endpoint n'existe pas encore, afficher un message
      if (error.response?.status === 404) {
        setComments([]);
      } else {
        console.error('Erreur lors du chargement des commentaires:', error);
        toast.error('Erreur lors du chargement des commentaires');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (commentId: number) => {
    try {
      await axios.put(`/api/comments/${commentId}`, {
        data: { approuve: true },
      });
      toast.success('Commentaire approuvé');
      fetchComments();
    } catch (error) {
      toast.error('Erreur lors de l\'approbation');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
      return;
    }

    try {
      await axios.delete(`/api/comments/${commentId}`);
      toast.success('Commentaire supprimé');
      fetchComments();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    fetchComments();
  }, [recetteId, recetteSlug, filter]);

  const filteredComments = comments.filter((comment) => {
    if (filter === 'approved') return comment.attributes.approuve;
    if (filter === 'pending') return !comment.attributes.approuve;
    return true;
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
                      {comment.attributes.auteur || 'Anonyme'}
                    </span>
                    {comment.attributes.approuve ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                        Approuvé
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-orange-500 text-white rounded-full">
                        En attente
                      </span>
                    )}
                  </div>
                  {comment.attributes.recette?.data && (
                    <div className="text-xs text-gray-500 mb-1">
                      📝 {comment.attributes.recette.data.attributes.titre}
                    </div>
                  )}
                  <div className="text-sm text-gray-700 mb-2">
                    {comment.attributes.contenu}
                  </div>
                  <div className="text-xs text-gray-500">
                    📅 {new Date(comment.attributes.createdAt).toLocaleString('fr-FR')}
                    {comment.attributes.email && ` • ✉️ ${comment.attributes.email}`}
                  </div>
                </div>
              </div>
              {!comment.attributes.approuve && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(comment.id)}
                    className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✅ Approuver
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>📭 Aucun commentaire {filter !== 'all' && filter === 'approved' ? 'approuvé' : 'en attente'}</p>
          <p className="text-xs mt-2">
            {filter === 'all' && 'Les commentaires apparaîtront ici une fois le système configuré'}
          </p>
        </div>
      )}
    </div>
  );
}
