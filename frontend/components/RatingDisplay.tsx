'use client';

import { useEffect, useState } from 'react';
import { getAverageRating, getRatingCount } from '@/lib/ratings';

interface RatingDisplayProps {
  recetteId: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export default function RatingDisplay({ recetteId, size = 'md', showCount = true }: RatingDisplayProps) {
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setAverage(getAverageRating(recetteId));
    setCount(getRatingCount(recetteId));
  }, [recetteId]);

  const starSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${starSize} ${
              star <= Math.round(average)
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
      {average > 0 && (
        <span className={`text-gray-700 font-medium ${
          size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
        }`}>
          {average.toFixed(1)}
        </span>
      )}
      {showCount && count > 0 && (
        <span className={`text-gray-500 ${
          size === 'sm' ? 'text-xs' : 'text-sm'
        }`}>
          ({count})
        </span>
      )}
    </div>
  );
}

