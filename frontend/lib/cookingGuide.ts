export type CookingGuideKind =
  | 'prep'
  | 'cut'
  | 'ingredient'
  | 'whisk'
  | 'pan'
  | 'oven'
  | 'simmer'
  | 'seasoning'
  | 'taste'
  | 'rest'
  | 'serve';

export type CookingGuide = {
  kind: CookingGuideKind;
  name: string;
  title: string;
  line: string;
  action: string;
  imageSrc: string;
  fallbackImageSrc: string;
  imageAlt: string;
};

const fallbackChefImage = '/images/chef-guide-intro.webp';

const ingredientStopWords = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'un',
  'une',
  'd',
  'a',
  'au',
  'aux',
]);

const unitsPattern =
  /^(?:\d+(?:[.,]\d+)?|\d+\/\d+)?\s*(?:g|kg|ml|cl|l|c\.?\s*a\.?\s*s\.?|c\.?\s*a\.?\s*c\.?|cuillere?s?|pincee?s?|tranche?s?|boite?s?|sachet?s?|verre?s?)?\s*/i;

const cleanIngredientName = (ingredient: string): string => {
  const withoutAmount = ingredient
    .replace(unitsPattern, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[,.;:].*$/, '')
    .trim();

  const words = withoutAmount
    .split(/\s+/)
    .map((word) => word.replace(/^d['\u2019]/i, '').toLowerCase())
    .filter((word) => word.length > 2 && !ingredientStopWords.has(word));

  if (words.length === 0) return 'ingredient principal';

  return words.slice(0, 3).join(' ');
};

const buildGuide = (
  kind: CookingGuideKind,
  name: string,
  title: string,
  action: string,
  imageSrc: string,
  imageAlt: string
): CookingGuide => ({
  kind,
  name,
  title,
  action,
  line: action,
  imageSrc,
  fallbackImageSrc: fallbackChefImage,
  imageAlt,
});

export const getCookingGuide = (
  recipeTitle: string,
  ingredients: string[],
  stepText: string,
  stepIndex: number,
  totalSteps: number
): CookingGuide => {
  const normalizedStep = stepText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const mainIngredient = cleanIngredientName(ingredients[0] || recipeTitle);
  const position = `Etape ${stepIndex + 1} sur ${totalSteps}`;

  if (/coup|couper|taille|taillez|eminc|hacher|hach|tranch|ciseler|decoup|des\b|rondelle|lamelle/.test(normalizedStep)) {
    return buildGuide(
      'cut',
      'Decoupe',
      position,
      'Decouper',
      '/images/chef-guide-cut.webp',
      'Chef en train de couper des legumes'
    );
  }

  if (/gout|gouter|verifi|tester|rectifi/.test(normalizedStep)) {
    return buildGuide(
      'taste',
      'Gouter / verifier',
      position,
      'Verifier',
      '/images/chef-guide-taste.webp',
      'Chef qui goute et verifie la preparation'
    );
  }

  if (/sel|poivre|assaison|epice|herbe|parsem/.test(normalizedStep)) {
    return buildGuide(
      'seasoning',
      'Assaisonnement',
      position,
      'Assaisonner',
      '/images/chef-guide-seasoning.webp',
      'Chef qui assaisonne une preparation'
    );
  }

  if (/four|enfour|gratin|prechauff|thermostat|\d{2,3}\s*(?:deg|\u00b0|c)/i.test(normalizedStep)) {
    return buildGuide(
      'oven',
      'Cuisson au four',
      position,
      'Cuisson au four',
      '/images/chef-guide-oven.webp',
      'Chef avec un plat sorti du four'
    );
  }

  if (/mijot|reduction|reduire|fremir|sauce/.test(normalizedStep)) {
    return buildGuide(
      'simmer',
      'Mijotage',
      position,
      'Mijoter',
      '/images/chef-guide-simmer.webp',
      'Chef qui fait mijoter une preparation'
    );
  }

  if (/poele|casserole|cuire|saisir|revenir|fondre|dorer|frire|bouillir/.test(normalizedStep)) {
    return buildGuide(
      'pan',
      'Cuisson',
      position,
      'Cuire',
      '/images/chef-guide-cook.webp',
      'Chef en train de cuisiner dans une casserole'
    );
  }

  if (/melang|fouett|incorpor|battre|emulsion|petrir|verser|ajouter|prepar/.test(normalizedStep)) {
    return buildGuide(
      'whisk',
      'Preparation',
      position,
      'Melanger',
      '/images/chef-guide-preparation.webp',
      'Chef en train de melanger dans un saladier'
    );
  }

  if (/repos|laisser|attendre|reserve|refroid|marin|leve|gonfl|minute|heure/.test(normalizedStep)) {
    return buildGuide(
      'rest',
      'Pause',
      position,
      'Patienter',
      '/images/chef-guide-timer.webp',
      'Chef avec un minuteur'
    );
  }

  if (/serv|dress|assiette|decor|present/.test(normalizedStep)) {
    return buildGuide(
      'serve',
      'Dressage',
      position,
      'Dresser',
      '/images/chef-guide-plating.webp',
      'Chef en train de dresser une assiette'
    );
  }

  return buildGuide(
    'ingredient',
    mainIngredient,
    position,
    'Preparer',
    '/images/chef-guide-ingredients.webp',
    'Chef avec un sac de legumes'
  );
};
