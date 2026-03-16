'use client';

import { useEffect, useState } from 'react';
import { getAvis, Avis } from '@/lib/strapi';

interface RatingListProps {
  recetteId: number;
}

export default function RatingList({ recetteId }: RatingListProps) {
  const [ratings, setRatings] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const response = await getAvis({
        recetteId,
        approuve: true, // Afficher uniquement les avis approuvés
      });
      setRatings(response.data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des avis:', error);
      setRatings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatings();
  }, [recetteId]);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (ratings.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Avis ({ratings.length})
      </h3>
      <div className="space-y-4">
        {ratings.map((avis) => (
          <div key={avis.id} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-4 h-4 ${
                        star <= avis.attributes.rating
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
                {avis.attributes.author && (
                  <span className="font-medium text-gray-900">{avis.attributes.author}</span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {new Date(avis.attributes.createdAt).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            {avis.attributes.comment && (
              <p className="text-gray-700 mt-2">{avis.attributes.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

