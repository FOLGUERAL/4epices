'use client';

import { useState, useMemo } from 'react';

interface Ingredient {
  quantite?: string;
  ingredient?: string;
}

interface IngredientsAdjusterProps {
  ingredients: any[]; // Peut être string[] ou Ingredient[]
  basePortions: number;
}

// Fonction pour parser une quantité (ex: "200g", "3", "1/2", "1.5")
function parseQuantity(quantite: string): number | null {
  if (!quantite || typeof quantite !== 'string') return null;
  
  const trimmed = quantite.trim();
  
  // Gérer les fractions (ex: "1/2", "3/4")
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    return den !== 0 ? num / den : null;
  }
  
  // Gérer les nombres décimaux avec unités (ex: "200g", "1.5 cuillère")
  const numberMatch = trimmed.match(/^(\d+\.?\d*)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }
  
  return null;
}

// Fonction pour formater une quantité
function formatQuantity(value: number, originalQuantite: string): string {
  // Si c'est un nombre entier, l'afficher sans décimales
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // Si c'est une fraction simple, l'afficher comme fraction
  const commonFractions: { [key: number]: string } = {
    0.25: '1/4',
    0.5: '1/2',
    0.75: '3/4',
    1.5: '1.5',
    2.5: '2.5',
  };
  
  if (commonFractions[value]) {
    return commonFractions[value];
  }
  
  // Sinon, arrondir à 1 décimale
  return value.toFixed(1).replace(/\.0$/, '');
}

// Fonction pour extraire l'unité de la quantité originale
function extractUnit(quantite: string): string {
  if (!quantite || typeof quantite !== 'string') return '';
  
  // Extraire tout ce qui n'est pas un nombre ou une fraction
  const unitMatch = quantite.match(/(?:^\d+\.?\d*\s*|\d+\/\d+\s*)(.+)$/);
  return unitMatch ? unitMatch[1].trim() : '';
}

export default function IngredientsAdjuster({ ingredients, basePortions }: IngredientsAdjusterProps) {
  const [selectedPortions, setSelectedPortions] = useState(basePortions);

  const adjustedIngredients = useMemo(() => {
    const ratio = selectedPortions / basePortions;
    
    return ingredients.map((ing: any) => {
      // Format simple (string)
      if (typeof ing === 'string') {
        // Pattern pour extraire: quantité (avec unité optionnelle) + reste
        // Ex: "500g de pâtes" -> quantité: "500g", reste: "de pâtes"
        const quantiteMatch = ing.match(/^([\d\.\/\s]+[a-z]*)\s*(.+)$/i);
        if (quantiteMatch) {
          const quantiteStr = quantiteMatch[1].trim();
          const reste = quantiteMatch[2].trim();
          const quantite = parseQuantity(quantiteStr);
          
          if (quantite !== null) {
            const newQuantite = quantite * ratio;
            const formattedQuantite = formatQuantity(newQuantite, quantiteStr);
            // Extraire l'unité uniquement de la partie quantité (ex: "500g" -> "g")
            const unitMatch = quantiteStr.match(/^\d+\.?\d*\s*([a-z]+)$/i);
            const unit = unitMatch ? unitMatch[1] : '';
            // Si on a une unité, l'ajouter après la quantité, sinon juste le reste
            return unit ? `${formattedQuantite} ${unit} ${reste}`.trim() : `${formattedQuantite} ${reste}`.trim();
          }
        }
        return ing;
      }
      
      // Format structuré (objet)
      if (typeof ing === 'object' && ing !== null) {
        const quantiteStr = ing.quantite || '';
        const ingredient = ing.ingredient || '';
        const quantite = parseQuantity(quantiteStr);
        
        if (quantite !== null) {
          const newQuantite = quantite * ratio;
          const formattedQuantite = formatQuantity(newQuantite, quantiteStr);
          const unit = extractUnit(quantiteStr);
          return {
            quantite: `${formattedQuantite}${unit ? ' ' + unit : ''}`.trim(),
            ingredient: ingredient
          };
        }
        
        return ing;
      }
      
      return ing;
    });
  }, [ingredients, basePortions, selectedPortions]);

  // Options pour le nombre de personnes (de 1 à 12)
  const portionOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-4 pb-4 border-b">
        <label htmlFor="portions" className="text-sm font-medium text-gray-700">
          Nombre de personnes :
        </label>
        <select
          id="portions"
          value={selectedPortions}
          onChange={(e) => setSelectedPortions(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
        >
          {portionOptions.map((num) => (
            <option key={num} value={num}>
              {num} {num === 1 ? 'personne' : 'personnes'}
            </option>
          ))}
        </select>
        {selectedPortions !== basePortions && (
          <button
            onClick={() => setSelectedPortions(basePortions)}
            className="text-sm text-orange-600 hover:text-orange-700 underline"
          >
            Réinitialiser ({basePortions} pers.)
          </button>
        )}
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingrédients</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          {adjustedIngredients.map((ingredient: any, index: number) => {
            // Format simple (string)
            if (typeof ingredient === 'string') {
              return (
                <li key={index} className="ml-4">
                  {ingredient}
                </li>
              );
            }
            
            // Format structuré (objet)
            if (typeof ingredient === 'object' && ingredient !== null) {
              const quantite = ingredient.quantite || '';
              const ing = ingredient.ingredient || '';
              return (
                <li key={index} className="ml-4">
                  <span className="font-medium">{quantite}</span> {ing}
                </li>
              );
            }
            
            return (
              <li key={index} className="ml-4">
                {String(ingredient)}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

