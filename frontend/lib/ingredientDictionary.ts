import { generateTagSlug, normalizeTagKey } from '@/lib/tagMatching';

export interface IngredientDictionaryEntry {
  nom: string;
  slug: string;
  keywords: string[];
}

/**
 * Ingrédients hub reconnus par analyse du titre + liste ingrédients.
 * Complète ingredientPrincipal (Groq ne retient qu'un seul ingrédient vedette).
 */
export const INGREDIENT_HUB_DICTIONARY: IngredientDictionaryEntry[] = [
  { nom: 'pâtes', slug: 'pates', keywords: ['pâte', 'pâtes', 'pasta', 'spaghetti', 'tagliatelle', 'tagliatelles', 'penne', 'fusilli', 'linguine', 'macaroni', 'lasagne', 'lasagnes', 'nouille', 'nouilles', 'ravioli', 'gnocchi', 'farfalle', 'rigatoni', 'tortellini', 'coquillette', 'coquillettes'] },
  { nom: 'riz', slug: 'riz', keywords: ['riz', 'risotto'] },
  { nom: 'pommes de terre', slug: 'pommes-de-terre', keywords: ['pomme de terre', 'pommes de terre', 'patate', 'patates'] },
  { nom: 'semoule', slug: 'semoule', keywords: ['semoule', 'couscous'] },
  { nom: 'lentilles', slug: 'lentilles', keywords: ['lentille', 'lentilles'] },
  { nom: 'haricots', slug: 'haricots', keywords: ['haricot', 'haricots', 'flageolet', 'flageolets'] },
  { nom: 'poulet', slug: 'poulet', keywords: ['poulet', 'poulets', 'blanc de poulet', 'cuisse de poulet'] },
  { nom: 'bœuf', slug: 'boeuf', keywords: ['bœuf', 'boeuf', 'boeuf haché', 'bœuf haché', 'entrecôte', 'bavette'] },
  { nom: 'porc', slug: 'porc', keywords: ['porc', 'côtelette', 'côtelettes', 'échine', 'echine'] },
  { nom: 'agneau', slug: 'agneau', keywords: ['agneau', 'gigot', 'épaule d\'agneau', 'epaule d\'agneau'] },
  { nom: 'saumon', slug: 'saumon', keywords: ['saumon'] },
  { nom: 'thon', slug: 'thon', keywords: ['thon'] },
  { nom: 'crevettes', slug: 'crevettes', keywords: ['crevette', 'crevettes'] },
  { nom: 'courgettes', slug: 'courgettes', keywords: ['courgette', 'courgettes'] },
  { nom: 'tomates', slug: 'tomates', keywords: ['tomate', 'tomates', 'cherry'] },
  { nom: 'aubergines', slug: 'aubergines', keywords: ['aubergine', 'aubergines'] },
  { nom: 'carottes', slug: 'carottes', keywords: ['carotte', 'carottes'] },
  { nom: 'champignons', slug: 'champignons', keywords: ['champignon', 'champignons', 'champi'] },
  { nom: 'épinards', slug: 'epinards', keywords: ['épinard', 'épinards', 'epinard', 'epinards'] },
  { nom: 'poivrons', slug: 'poivrons', keywords: ['poivron', 'poivrons'] },
  { nom: 'oignons', slug: 'oignons', keywords: ['oignon', 'oignons', 'échalote', 'échalotes', 'echalote', 'echalotes'] },
  { nom: 'fromage', slug: 'fromage', keywords: ['fromage', 'parmesan', 'mozzarella', 'gruyère', 'gruyere', 'comté', 'comte', 'feta', 'chèvre', 'chevre', 'emmental'] },
  { nom: 'œufs', slug: 'oeufs', keywords: ['œuf', 'œufs', 'oeuf', 'oeufs'] },
  { nom: 'crème', slug: 'creme', keywords: ['crème', 'creme', 'crème fraîche', 'creme fraiche'] },
  { nom: 'lardons', slug: 'lardons', keywords: ['lardon', 'lardons', 'bacon'] },
  { nom: 'chocolat', slug: 'chocolat', keywords: ['chocolat'] },
];

const dictionaryBySlug = new Map(
  INGREDIENT_HUB_DICTIONARY.map((entry) => [entry.slug, entry])
);

export function getDictionaryEntryBySlug(slug: string): IngredientDictionaryEntry | undefined {
  return dictionaryBySlug.get(slug);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mot-clé présent comme mot entier (évite les faux positifs courts). */
function matchesKeyword(text: string, keyword: string): boolean {
  const normalized = normalizeTagKey(text);
  const normalizedKeyword = normalizeTagKey(keyword);
  if (!normalized || !normalizedKeyword) return false;

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegex(normalizedKeyword)}s?(?=[^a-z0-9]|$)`,
    'i'
  );
  return pattern.test(normalized);
}

function extractIngredientLine(ing: unknown): string {
  if (typeof ing === 'string') return ing.trim();
  if (ing && typeof ing === 'object') {
    const obj = ing as { quantite?: string; ingredient?: string };
    const quantite = (obj.quantite || '').trim();
    const ingredient = (obj.ingredient || '').trim();
    return quantite ? `${quantite} ${ingredient}`.trim() : ingredient;
  }
  return String(ing || '').trim();
}

/** Textes d'une recette analysés pour le dictionnaire (titre + ingrédients). */
export function collectRecipeSearchTexts(recette: {
  attributes: {
    titre?: string;
    ingredients?: unknown;
  };
}): string[] {
  const texts: string[] = [];
  const titre = recette.attributes.titre?.trim();
  if (titre) texts.push(titre);

  const ingredients = recette.attributes.ingredients;
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      const line = extractIngredientLine(ing);
      if (line) texts.push(line);
    }
  }

  return texts;
}

/** Ingrédients hub détectés via dictionnaire pour une recette. */
export function matchDictionaryIngredients(recette: {
  attributes: {
    titre?: string;
    ingredients?: unknown;
  };
}): IngredientDictionaryEntry[] {
  const texts = collectRecipeSearchTexts(recette);
  if (texts.length === 0) return [];

  const matched: IngredientDictionaryEntry[] = [];

  for (const entry of INGREDIENT_HUB_DICTIONARY) {
    const found = texts.some((text) =>
      entry.keywords.some((keyword) => matchesKeyword(text, keyword))
    );
    if (found) matched.push(entry);
  }

  return matched;
}

/** Slug d'un ingredientPrincipal Groq, avec nom canonique dictionnaire si connu. */
export function resolveIngredientSlugAndNom(principal: string): { slug: string; nom: string } {
  const slug = generateTagSlug(principal);
  const dictEntry = dictionaryBySlug.get(slug);
  if (dictEntry) return { slug: dictEntry.slug, nom: dictEntry.nom };

  for (const entry of INGREDIENT_HUB_DICTIONARY) {
    if (entry.keywords.some((keyword) => matchesKeyword(principal, keyword))) {
      return { slug: entry.slug, nom: entry.nom };
    }
  }

  return { slug, nom: principal.trim() };
}
