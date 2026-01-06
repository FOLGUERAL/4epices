/**
 * Parse le texte dicté pour extraire les informations structurées d'une recette
 */

export interface ParsedRecipe {
  titre: string;
  description: string;
  ingredients: string[];
  etapes: string[];
  tempsPreparation?: number;
  tempsCuisson?: number;
  nombrePersonnes?: number;
  difficulte?: 'facile' | 'moyen' | 'difficile';
}

/**
 * Parse le texte brut d'une recette dictée
 */
export function parseRecipeText(text: string): ParsedRecipe {
  const normalized = text.trim();
  
  // Valeurs par défaut
  const result: ParsedRecipe = {
    titre: '',
    description: '',
    ingredients: [],
    etapes: [],
    nombrePersonnes: 4,
    difficulte: 'facile',
  };

  // Diviser le texte en lignes
  const lines = normalized.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) {
    return result;
  }

  // Le titre est généralement la première ligne
  result.titre = lines[0];

  // Chercher les sections clés
  let currentSection: 'description' | 'ingredients' | 'etapes' | 'info' | null = null;
  const sections: Record<string, string[]> = {
    description: [],
    ingredients: [],
    etapes: [],
    info: [],
  };

  // Mots-clés pour identifier les sections
  const ingredientKeywords = ['ingrédient', 'ingredient', 'pour', 'il faut', 'nécessaire'];
  const etapeKeywords = ['étape', 'etape', 'préparation', 'preparation', 'cuisson', 'faire', 'mettre', 'ajouter'];
  const infoKeywords = ['temps', 'minute', 'min', 'personne', 'difficulté', 'difficulte', 'facile', 'moyen', 'difficile'];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Détecter les sections
    if (ingredientKeywords.some(kw => line.includes(kw))) {
      currentSection = 'ingredients';
      continue;
    }
    if (etapeKeywords.some(kw => line.includes(kw))) {
      currentSection = 'etapes';
      continue;
    }
    if (infoKeywords.some(kw => line.includes(kw))) {
      currentSection = 'info';
      continue;
    }

    // Si pas de section détectée, essayer de deviner
    if (currentSection === null) {
      // Si la ligne commence par un nombre ou contient des unités, c'est probablement un ingrédient
      if (/^\d+/.test(lines[i]) || /(g|kg|ml|l|cl|cuillère|cuillere|tasse|verre)/i.test(lines[i])) {
        currentSection = 'ingredients';
      } else if (i < lines.length / 2) {
        // Les premières lignes sont souvent la description
        currentSection = 'description';
      } else {
        // Les dernières lignes sont souvent les étapes
        currentSection = 'etapes';
      }
    }

    // Ajouter la ligne à la section appropriée
    if (currentSection && sections[currentSection]) {
      sections[currentSection].push(lines[i]);
    }
  }

  // Traiter la description
  if (sections.description.length > 0) {
    result.description = sections.description.join(' ').substring(0, 500);
  } else if (lines.length > 1) {
    // Si pas de section description, prendre les premières lignes après le titre
    result.description = lines.slice(1, Math.min(4, lines.length)).join(' ').substring(0, 500);
  }

  // Traiter les ingrédients
  if (sections.ingredients.length > 0) {
    result.ingredients = sections.ingredients
      .map(ing => ing.trim())
      .filter(ing => ing.length > 0);
  } else {
    // Essayer de trouver les ingrédients dans tout le texte
    const allLines = lines.slice(1);
    result.ingredients = allLines
      .filter(line => {
        // Détecter les lignes qui ressemblent à des ingrédients
        return /^\d+/.test(line) || 
               /(g|kg|ml|l|cl|cuillère|cuillere|tasse|verre|pincée|pincee)/i.test(line) ||
               line.length < 100; // Lignes courtes sont souvent des ingrédients
      })
      .slice(0, 20) // Limiter à 20 ingrédients
      .map(ing => ing.trim());
  }

  // Traiter les étapes
  if (sections.etapes.length > 0) {
    result.etapes = sections.etapes
      .map(etape => etape.trim())
      .filter(etape => etape.length > 0);
  } else {
    // Essayer de trouver les étapes (lignes plus longues, souvent numérotées)
    const allLines = lines.slice(1);
    result.etapes = allLines
      .filter(line => {
        // Détecter les lignes qui ressemblent à des étapes
        return /^\d+[\.\)]/.test(line) || // Numérotées
               line.length > 50 || // Lignes longues
               /(faire|mettre|ajouter|mélanger|cuire|chauffer|servir)/i.test(line);
      })
      .slice(0, 20) // Limiter à 20 étapes
      .map(etape => etape.trim());
  }

  // Extraire les informations (temps, personnes, difficulté)
  const infoText = sections.info.join(' ').toLowerCase();
  const allText = normalized.toLowerCase();

  // Temps de préparation
  const prepMatch = /(?:préparation|preparation|prep).*?(\d+)\s*(?:min|minute)/i.exec(allText);
  if (prepMatch) {
    result.tempsPreparation = parseInt(prepMatch[1]);
  }

  // Temps de cuisson
  const cookMatch = /(?:cuisson|cuire).*?(\d+)\s*(?:min|minute)/i.exec(allText);
  if (cookMatch) {
    result.tempsCuisson = parseInt(cookMatch[1]);
  }

  // Nombre de personnes
  const personMatch = /(\d+)\s*(?:personne|pers|portion)/i.exec(allText);
  if (personMatch) {
    result.nombrePersonnes = parseInt(personMatch[1]);
  }

  // Difficulté
  if (/difficile/i.test(allText) && !/facile|moyen/i.test(allText)) {
    result.difficulte = 'difficile';
  } else if (/moyen/i.test(allText)) {
    result.difficulte = 'moyen';
  } else {
    result.difficulte = 'facile';
  }

  // Nettoyer et valider
  if (!result.titre || result.titre.length < 3) {
    result.titre = 'Recette sans titre';
  }

  if (result.ingredients.length === 0 && result.etapes.length === 0) {
    // Si on n'a rien trouvé, mettre tout dans les étapes
    result.etapes = lines.slice(1).map(l => l.trim()).filter(l => l.length > 0);
  }

  return result;
}

