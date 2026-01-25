'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, FormEvent, useEffect, Suspense } from 'react';

function SearchBarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Éviter les problèmes d'hydratation en initialisant après le montage
  useEffect(() => {
    setMounted(true);
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-md w-full min-w-0">
      <div className="relative">
        <input
          type="text"
          value={mounted ? query : ''}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une recette..."
          className="w-full px-3 sm:px-4 py-2.5 sm:py-2.5 pl-10 sm:pl-11 pr-10 sm:pr-11 text-base sm:text-sm !text-black bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 font-medium placeholder-gray-500"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-3.5 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              router.push('/recherche');
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-3.5 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}

export default function SearchBar() {
  return (
    <Suspense fallback={
      <div className="flex-1 max-w-md w-full min-w-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher une recette..."
            disabled
            className="w-full px-3 sm:px-4 py-2.5 sm:py-2 pl-9 sm:pl-10 pr-9 sm:pr-10 text-base sm:text-sm text-gray-900 bg-white border border-gray-300 rounded-lg opacity-50"
          />
        </div>
      </div>
    }>
      <SearchBarContent />
    </Suspense>
  );
}

