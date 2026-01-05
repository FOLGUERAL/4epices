'use client';

import { useState, useEffect } from 'react';
import { getRecettes, getCategories, getTags, Recette, Categorie, Tag } from '@/lib/strapi';
import { filterRecettes } from '@/lib/filterRecettes';
import { FilterState, RecipeFilters } from '@/components/RecipeFilters';
import RecetteCard from '@/components/RecetteCard';
import RecettesGridSkeleton from '@/components/RecettesGridSkeleton';

export default function RecettesPage() {
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [filteredRecettes, setFilteredRecettes] = useState<Recette[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    category: null,
    difficulty: null,
    maxTime: null,
    minTime: null,
    maxPersons: null,
    minPersons: null,
    tags: [],
    searchIngredients: '',
  });
  const [sortBy, setSortBy] = useState<'date' | 'temps' | 'personnes' | 'difficulte'>('date');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recettesRes, categoriesRes, tagsRes] = await Promise.all([
          getRecettes({ pageSize: 1000 }),
          getCategories(),
          getTags(),
        ]);

        setRecettes(recettesRes.data || []);
        setCategories(categoriesRes.data || []);
        setTags(tagsRes.data || []);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    let filtered = filterRecettes(recettes, filters);

    // Tri
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'temps':
          return (a.attributes.tempsPreparation || 0) - (b.attributes.tempsPreparation || 0);
        case 'personnes':
          return (a.attributes.nombrePersonnes || 0) - (b.attributes.nombrePersonnes || 0);
        case 'difficulte':
          const diffOrder = { facile: 1, moyen: 2, difficile: 3 };
          return (diffOrder[a.attributes.difficulte as keyof typeof diffOrder] || 0) -
                 (diffOrder[b.attributes.difficulte as keyof typeof diffOrder] || 0);
        case 'date':
        default:
          return new Date(b.attributes.publishedAt || '').getTime() -
                 new Date(a.attributes.publishedAt || '').getTime();
      }
    });

    setFilteredRecettes(filtered);
  }, [recettes, filters, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <RecettesGridSkeleton count={9} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Toutes les recettes</h1>
          <p className="text-gray-600">
            {filteredRecettes.length} {filteredRecettes.length === 1 ? 'recette trouvée' : 'recettes trouvées'}
          </p>
        </div>

        <RecipeFilters
          categories={categories}
          tags={tags}
          onFilterChange={setFilters}
        />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Trier par :</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="date">Date de publication</option>
              <option value="temps">Temps de préparation</option>
              <option value="personnes">Nombre de personnes</option>
              <option value="difficulte">Difficulté</option>
            </select>
          </div>
        </div>

        {filteredRecettes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucune recette trouvée</h2>
            <p className="text-gray-600">
              Essayez de modifier vos critères de recherche ou vos filtres.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecettes.map((recette) => (
              <RecetteCard key={recette.id} recette={recette} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

