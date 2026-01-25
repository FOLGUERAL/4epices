'use client';

import { useMemo, useState } from 'react';
import type { Recette } from '@/lib/strapi';
import RecetteCard from './RecetteCard';

interface Props {
  recettes: Recette[];
}

export default function RecipesFiltersClient({ recettes }: Props) {
  const [timeFilter, setTimeFilter] = useState<string>('any');
  const [difficulty, setDifficulty] = useState<string>('any');
  const [diet, setDiet] = useState<string>('any');

  const filtered = useMemo(() => {
    return recettes.filter((r) => {
      const prep = r.attributes.tempsPreparation || 0;
      if (timeFilter === '<=15' && prep > 15) return false;
      if (timeFilter === '<=30' && prep > 30) return false;
      if (timeFilter === '<=60' && prep > 60) return false;

      if (difficulty !== 'any' && r.attributes.difficulte !== difficulty) return false;

      if (diet !== 'any') {
        const tags = r.attributes.tags?.data?.map(t => t.attributes.slug) || [];
        if (!tags.includes(diet)) return false;
      }

      return true;
    });
  }, [recettes, timeFilter, difficulty, diet]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 !text-black bg-white">
          <option value="any">Temps (tous)</option>
          <option value="<=15">≤ 15 min</option>
          <option value="<=30">≤ 30 min</option>
          <option value="<=60">≤ 60 min</option>
        </select>

        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 !text-black bg-white">
          <option value="any">Difficulté (tous)</option>
          <option value="facile">Facile</option>
          <option value="moyen">Moyen</option>
          <option value="difficile">Difficile</option>
        </select>

        <div className="flex items-center">
          <button onClick={() => { setTimeFilter('any'); setDifficulty('any'); setDiet('any'); }} className="ml-auto rounded-xl px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold transition-colors">Réinitialiser</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((r) => (
          <RecetteCard key={r.id} recette={r} />
        ))}
      </div>
    </div>
  );
}
