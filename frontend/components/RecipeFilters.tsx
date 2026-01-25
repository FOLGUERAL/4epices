'use client';

import { useState } from 'react';
import { Categorie, Tag } from '@/lib/strapi';

interface RecipeFiltersProps {
  categories: Categorie[];
  tags: Tag[];
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  category: string | null;
  difficulty: string | null;
  maxTime: number | null;
  minTime: number | null;
  maxPersons: number | null;
  minPersons: number | null;
  tags: number[];
  searchIngredients: string;
}

export default function RecipeFilters({ categories, tags, onFilterChange }: RecipeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleTagToggle = (tagId: number) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(id => id !== tagId)
      : [...filters.tags, tagId];
    handleFilterChange('tags', newTags);
  };

  const resetFilters = () => {
    const emptyFilters: FilterState = {
      category: null,
      difficulty: null,
      maxTime: null,
      minTime: null,
      maxPersons: null,
      minPersons: null,
      tags: [],
      searchIngredients: '',
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const activeFiltersCount = [
    filters.category,
    filters.difficulty,
    filters.maxTime,
    filters.minTime,
    filters.maxPersons,
    filters.minPersons,
    filters.tags.length > 0,
    filters.searchIngredients,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filtres avancés
          {activeFiltersCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-sm text-white bg-orange-600 hover:bg-orange-700 font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-6 pt-4 border-t">
          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie
            </label>
            <select
              value={filters.category || ''}
              onChange={(e) => handleFilterChange('category', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id.toString()}>
                  {cat.attributes.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulté */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulté
            </label>
            <select
              value={filters.difficulty || ''}
              onChange={(e) => handleFilterChange('difficulty', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
            >
              <option value="">Toutes les difficultés</option>
              <option value="facile">Facile</option>
              <option value="moyen">Moyen</option>
              <option value="difficile">Difficile</option>
            </select>
          </div>

          {/* Temps de préparation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temps de préparation (minutes)
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minTime || ''}
                  onChange={(e) => handleFilterChange('minTime', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
                  min="0"
                />
              </div>
              <span className="text-gray-500">-</span>
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxTime || ''}
                  onChange={(e) => handleFilterChange('maxTime', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Nombre de personnes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de personnes
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minPersons || ''}
                  onChange={(e) => handleFilterChange('minPersons', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
                  min="1"
                />
              </div>
              <span className="text-gray-500">-</span>
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPersons || ''}
                  onChange={(e) => handleFilterChange('maxPersons', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filters.tags.includes(tag.id)
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    #{tag.attributes.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recherche par ingrédients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un ingrédient
            </label>
            <input
              type="text"
              placeholder="Ex: tomate, farine, beurre..."
              value={filters.searchIngredients}
              onChange={(e) => handleFilterChange('searchIngredients', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent !text-black bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

