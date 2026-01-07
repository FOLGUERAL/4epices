'use client';

import { useState } from 'react';
import { addRating, getRatings } from '@/lib/ratings';
import { toast } from './Toast';

interface RatingFormProps {
  recetteId: number;
  recetteTitle: string;
  onRatingAdded?: () => void;
}

export default function RatingForm({ recetteId, recetteTitle, onRatingAdded }: RatingFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.warning('Veuillez sélectionner une note');
      return;
    }

    const success = addRating({
      recetteId,
      rating,
      comment: comment.trim() || undefined,
      author: author.trim() || undefined,
    });

    if (success) {
      setSubmitted(true);
      setRating(0);
      setComment('');
      setAuthor('');
      toast.success('Votre avis a été publié avec succès !');
      if (onRatingAdded) {
        onRatingAdded();
      }
      setTimeout(() => setSubmitted(false), 3000);
    } else {
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    }
  };

  return (
    <div className="card-base p-6 sm:p-8 bg-gradient-to-br from-gray-50 to-orange-50 border border-orange-100">
      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Donner votre avis</h3>
      
      {submitted && (
        <div className="mb-4 p-4 bg-success-100 text-success-700 rounded-lg text-sm font-medium animate-slide-up">
          ✨ Merci pour votre avis !
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Note *
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="focus:outline-none"
              >
                <svg
                  className={`w-8 h-8 ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  } transition-colors`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-gray-600">
                {rating === 1 && 'Très mauvais'}
                {rating === 2 && 'Mauvais'}
                {rating === 3 && 'Moyen'}
                {rating === 4 && 'Bon'}
                {rating === 5 && 'Excellent'}
              </span>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="author" className="block text-sm font-semibold text-gray-700 mb-2.5">
            Nom (optionnel)
          </label>
          <input
            type="text"
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black bg-white font-medium transition-all duration-200 placeholder:text-gray-500"
            placeholder="Votre nom"
          />
        </div>

        <div>
          <label htmlFor="comment" className="block text-sm font-semibold text-gray-700 mb-2.5">
            Commentaire (optionnel)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black bg-white font-medium transition-all duration-200 resize-none placeholder:text-gray-500"
            placeholder="Partagez votre expérience avec cette recette..."
          />
        </div>

        <button
          type="submit"
          disabled={rating === 0}
          className="w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-bold disabled:bg-gray-300 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          ✨ Publier mon avis
        </button>
      </form>
    </div>
  );
}

