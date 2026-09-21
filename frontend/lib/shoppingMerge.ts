/**
 * Fusion des lignes d'une liste de courses.
 *
 * La liste enregistre les lignes telles qu'écrites dans les recettes (« 2 gousses d'ail émincées ») avec leur
 * recette d'origine. Ce module en calcule la liste fusionnée à l'affichage : « 1 oignon », « 1 oignon moyen » et
 * « 1 gros oignon, émincé » deviennent « oignon : 3 ». Module pur, sans stockage : testable, et toute amélioration
 * des règles s'applique aussi à ce qui est déjà enregistré.
 *
 * Règles de fusion, volontairement prudentes :
 * - fusionnés : pluriels, accents, tailles et état (gros, moyen, frais…), préparation (émincé, fondu…) ;
 * - gardés distincts : couleur, type et transformation (oignon rouge, tomates pelées, beurre de cacahuète).
 */

export type AisleKey =
  | 'fruits-legumes'
  | 'viandes-poissons'
  | 'cremerie'
  | 'boulangerie'
  | 'epicerie'
  | 'surgeles'
  | 'boissons'
  | 'autres';

/** Les rayons, dans l'ordre d'un parcours de magasin */
export const AISLES: ReadonlyArray<{ key: AisleKey; label: string }> = [
  { key: 'fruits-legumes', label: 'Fruits et légumes' },
  { key: 'boulangerie', label: 'Boulangerie' },
  { key: 'viandes-poissons', label: 'Viandes et poissons' },
  { key: 'cremerie', label: 'Crèmerie et œufs' },
  { key: 'epicerie', label: 'Épicerie' },
  { key: 'surgeles', label: 'Surgelés' },
  { key: 'boissons', label: 'Boissons' },
  { key: 'autres', label: 'Autres' },
];

export interface ShoppingLine {
  id: string;
  /** La ligne telle qu'écrite dans la recette, ou saisie à la main */
  text: string;
  recipeId?: number;
  recipeTitle?: string;
  /** Multiplicateur de portions (2 = recette pour deux fois plus de personnes) */
  scale?: number;
}

export interface Quantity {
  value: number;
  /** '' = un nombre d'éléments ; sinon g, ml, « c. à soupe », gousse… */
  unit: string;
}

export interface ShoppingItem {
  /** Clé de fusion (stable) : sert aussi à cocher un article */
  key: string;
  /** Nom affiché (la forme la plus fréquente dans les recettes) */
  name: string;
  aisle: AisleKey;
  /** Sel, poivre, eau… : à vérifier chez soi plutôt qu'à acheter */
  pantry: boolean;
  quantities: Quantity[];
  lines: ShoppingLine[];
}

export interface StoredShopping {
  lines: ShoppingLine[];
  /** Clés d'articles cochés */
  checked: string[];
  /** Recettes ajoutées avant la refonte de la liste : leurs lignes n'ont plus d'origine connue */
  legacyRecipeIds: number[];
}

interface ParsedLine {
  key: string;
  name: string;
  quantity: Quantity | null;
  pantry: boolean;
}

/* ---------- Lecture d'une ligne ---------- */

/** Minuscules, sans accents, apostrophes droites. Garde la même longueur que le texte d'origine (NFC). */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`´]/g, "'");
}

const COUNT_UNITS: Record<string, { unit: string; plural: string }> = {
  gousse: { unit: 'gousse', plural: 'gousses' },
  pincee: { unit: 'pincée', plural: 'pincées' },
  botte: { unit: 'botte', plural: 'bottes' },
  boite: { unit: 'boîte', plural: 'boîtes' },
  sachet: { unit: 'sachet', plural: 'sachets' },
  tranche: { unit: 'tranche', plural: 'tranches' },
  verre: { unit: 'verre', plural: 'verres' },
  tasse: { unit: 'tasse', plural: 'tasses' },
  bouquet: { unit: 'bouquet', plural: 'bouquets' },
  brin: { unit: 'brin', plural: 'brins' },
  feuille: { unit: 'feuille', plural: 'feuilles' },
  tete: { unit: 'tête', plural: 'têtes' },
  pot: { unit: 'pot', plural: 'pots' },
  paquet: { unit: 'paquet', plural: 'paquets' },
  filet: { unit: 'filet', plural: 'filets' },
  branche: { unit: 'branche', plural: 'branches' },
  rondelle: { unit: 'rondelle', plural: 'rondelles' },
  cube: { unit: 'cube', plural: 'cubes' },
  barquette: { unit: 'barquette', plural: 'barquettes' },
  brique: { unit: 'brique', plural: 'briques' },
  morceau: { unit: 'morceau', plural: 'morceaux' },
  poignee: { unit: 'poignée', plural: 'poignées' },
  bocal: { unit: 'bocal', plural: 'bocaux' },
  tablette: { unit: 'tablette', plural: 'tablettes' },
};

/** « gousses » → gousse, « boîtes » → boîte : chaque forme écrite renvoie à son unité */
const COUNT_UNIT_WORDS = new Map<string, string>();
for (const [singularWord, { unit, plural }] of Object.entries(COUNT_UNITS)) {
  COUNT_UNIT_WORDS.set(singularWord, unit);
  COUNT_UNIT_WORDS.set(fold(plural), unit);
}

const MEASURE_UNITS: Array<{ re: RegExp; unit: string; factor: number }> = [
  { re: /^\s*(?:kg|kilos?|kilogrammes?)\b\.?/, unit: 'g', factor: 1000 },
  { re: /^\s*(?:g|gr|grammes?)\b\.?/, unit: 'g', factor: 1 },
  { re: /^\s*(?:ml|millilitres?)\b\.?/, unit: 'ml', factor: 1 },
  { re: /^\s*(?:cl|centilitres?)\b\.?/, unit: 'ml', factor: 10 },
  { re: /^\s*(?:dl|decilitres?)\b\.?/, unit: 'ml', factor: 100 },
  { re: /^\s*(?:l|litres?)\b\.?(?!')/, unit: 'ml', factor: 1000 },
  { re: /^\s*(?:c|cuil|cuill|cuillere|cuilleres)\.?\s*a\.?\s*(?:soupe|s)\b\.?/, unit: 'c. à soupe', factor: 1 },
  { re: /^\s*(?:c|cuil|cuill|cuillere|cuilleres)\.?\s*a\.?\s*(?:cafe|c)\b\.?/, unit: 'c. à café', factor: 1 },
  { re: /^\s*(?:cs|cas)\b\.?/, unit: 'c. à soupe', factor: 1 },
  { re: /^\s*(?:cc|cac)\b\.?/, unit: 'c. à café', factor: 1 },
];

/** Ce qui précède le nom de l'ingrédient : « de », « d' », « de la »… */
const PREPOSITION = /^\s*(?:de\s+la\s+|de\s+l'|de\s+|d'|du\s+|des\s+)/;

/** Mots sans effet sur ce qu'on achète : taille, état, préparation. La couleur et la transformation, elles, comptent. */
const IGNORED_WORDS = new Set([
  'gros', 'grosse', 'grosses', 'petit', 'petite', 'petits', 'petites', 'moyen', 'moyenne', 'moyens', 'moyennes',
  'grand', 'grande', 'grands', 'grandes', 'belle', 'belles', 'beau', 'beaux', 'bon', 'bonne',
  'frais', 'fraiche', 'fraiches', 'mur', 'mure', 'murs', 'mures', 'bien', 'juteux', 'juteuse', 'juteuses',
  'emince', 'eminces', 'emincee', 'emincees', 'cisele', 'ciseles', 'ciselee', 'ciselees',
  'fondu', 'fondus', 'fondue', 'fondues', 'ramolli', 'ramollie', 'ramollis', 'ramollies',
  'tiede', 'tiedes', 'froid', 'froide', 'froids', 'froides', 'chaud', 'chaude', 'chauds', 'chaudes',
  'environ', 'quelques', 'bio', 'un', 'une', 'et', 'ou',
]);

/** Ce qui suit ces mots n'est plus l'ingrédient (« pour la décoration », « selon le goût ») */
const CUT_WORDS = new Set(['pour', 'selon', 'facultatif', 'facultative']);

/** Mots où le « s » final fait partie du mot (pluriel = singulier) */
const KEEP_FINAL_S = new Set([
  'pois', 'mais', 'jus', 'anis', 'ananas', 'cassis', 'radis', 'noix', 'pates', 'bras', 'lys',
  'panais', 'anchois', 'bois', 'couscous', 'houmous', 'foie',
]);

function toSingular(token: string): string {
  if (KEEP_FINAL_S.has(token) || token.length <= 3) return token;
  if (token.endsWith('s') || token.endsWith('x')) return token.slice(0, -1);
  return token;
}

const ALWAYS_PANTRY = new Set(['sel', 'poivre', 'eau']);
const PANTRY_WITHOUT_QUANTITY = new Set(['huile', 'vinaigre', 'sucre', 'farine', 'epice', 'herbe', 'moutarde']);

interface QuantityRead {
  quantity: Quantity | null;
  consumed: number;
}

/** Lit la quantité au début d'une ligne (déjà « pliée ») : nombre, fraction, intervalle, unité. */
function readQuantity(folded: string, scale: number): QuantityRead {
  let value: number | null = null;
  let pos = 0;

  const mixed = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/.exec(folded);
  const plain = /^(\d+(?:[.,]\d+)?)(?:\s*(?:a|-)\s*(\d+(?:[.,]\d+)?))?/.exec(folded);
  const article = /^(?:un|une)\s+(?!peu\b)/.exec(folded);

  if (mixed && Number(mixed[3]) !== 0) {
    value = Number(mixed[1] ?? 0) + Number(mixed[2]) / Number(mixed[3]);
    pos = mixed[0].length;
  } else if (plain) {
    // Un intervalle (« 2 à 3 ») : on prend le plus grand, pour ne pas manquer
    value = Number((plain[2] ?? plain[1]).replace(',', '.'));
    pos = plain[0].length;
  } else if (article) {
    value = 1;
    pos = article[0].length;
  }

  if (value === null) return { quantity: null, consumed: 0 };

  let unit = '';
  let factor = 1;
  const rest = folded.slice(pos);

  const measure = MEASURE_UNITS.find(({ re }) => re.test(rest));
  if (measure) {
    unit = measure.unit;
    factor = measure.factor;
    pos += (measure.re.exec(rest) as RegExpExecArray)[0].length;
  } else {
    const word = /^\s*([a-z]+)\b/.exec(rest);
    const countUnit = word ? COUNT_UNIT_WORDS.get(word[1]) : undefined;
    if (word && countUnit) {
      unit = countUnit;
      pos += word[0].length;
    }
  }

  const preposition = PREPOSITION.exec(folded.slice(pos));
  if (preposition) pos += preposition[0].length;

  return { quantity: { value: value * factor * scale, unit }, consumed: pos };
}

interface NameRead {
  key: string;
  name: string;
  pantry: boolean;
}

/** Nettoie un nom d'ingrédient : retire tailles, préparations et articles, met au singulier. */
function readName(original: string, folded: string, hasQuantity: boolean): NameRead | null {
  // Les parenthèses (« (optionnel, pour une sauce épicée) »), fermées ou non, ne font pas partie du nom
  const withoutParentheses = (text: string) => text.replace(/\s*\([^)]*\)/g, '').replace(/\s*\(.*$/, '');
  const cleanOriginal = withoutParentheses(original);
  const cleanFolded = withoutParentheses(folded);

  const cut = cleanFolded.search(/[,;]/);
  const orig = cut >= 0 ? cleanOriginal.slice(0, cut) : cleanOriginal;
  const fold_ = cut >= 0 ? cleanFolded.slice(0, cut) : cleanFolded;

  const origTokens = orig.split(/\s+/).filter(Boolean);
  const foldTokens = fold_.split(/\s+/).filter(Boolean);

  const kept: Array<{ display: string; key: string }> = [];
  for (let i = 0; i < foldTokens.length; i += 1) {
    const f = foldTokens[i].replace(/^[.:!?]+|[.:!?]+$/g, '');
    if (!f) continue;
    if (CUT_WORDS.has(f)) break;
    if (IGNORED_WORDS.has(f)) continue;
    // « d olive », « d ail » : une élision écrite avec une espace
    if (f === 'd' || f === 'l') continue;
    // « coupé en dés », « coupées en rondelles » : préparation
    if (/^coupe(?:e|s|es)?$/.test(f)) {
      if (foldTokens[i + 1] === 'en' || foldTokens[i + 1] === 'a') i += 2;
      continue;
    }
    const display = (origTokens[i] ?? f).toLowerCase().replace(/^[.:!?]+|[.:!?]+$/g, '');
    const unelided = f.replace(/^(?:d|l)'/, '');
    if (!unelided) continue;
    kept.push({ display, key: toSingular(unelided) });
  }

  // Un article isolé en tête (« la crème ») n'est pas l'ingrédient
  while (kept.length > 1 && ['de', 'du', 'des', 'la', 'le', 'les'].includes(kept[0].key)) kept.shift();
  if (kept.length === 0) return null;

  let key = kept.map((token) => token.key).join(' ').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  const name = kept.map((token) => token.display).join(' ');

  // Sel, poivre, eau : une seule clé, quelle que soit la façon de l'écrire
  const head = key.split(' ')[0];
  let pantry = false;
  if (key === 'fleur de sel') {
    key = 'sel';
    pantry = true;
  } else if (ALWAYS_PANTRY.has(head) && !(head === 'eau' && /^eau (?:de|du|des|d)\b/.test(key))) {
    key = head;
    pantry = true;
  } else if (!hasQuantity && PANTRY_WITHOUT_QUANTITY.has(head)) {
    pantry = true;
  }

  return { key, name, pantry };
}

/** « sel, poivre » ou « sel et poivre du moulin » : plusieurs produits du placard sur une ligne */
function splitPantryList(original: string, folded: string): Array<[string, string]> | null {
  const splitter = /\s*(?:,|;|\/|\bet\b)\s*/;
  const foldedParts = folded.split(splitter).filter(Boolean);
  if (foldedParts.length < 2) return null;
  const originalParts = original.split(new RegExp(splitter.source, 'i')).filter(Boolean);
  if (originalParts.length !== foldedParts.length) return null;
  const allPantry = foldedParts.every((part) => ALWAYS_PANTRY.has(part.split(/\s+/)[0]));
  return allPantry ? foldedParts.map((part, index) => [originalParts[index], part] as [string, string]) : null;
}

/** Une ligne de recette (« 2 gousses d'ail émincées ») → un ou plusieurs articles (« ail : 2 gousses »). */
export function parseShoppingText(text: string, scale = 1): ParsedLine[] {
  const source = text
    .normalize('NFC')
    .replace(/½/g, ' 1/2')
    .replace(/¼/g, ' 1/4')
    .replace(/¾/g, ' 3/4')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return [];
  const folded = fold(source);

  const { quantity, consumed } = readQuantity(folded, scale);
  let restOriginal = source.slice(consumed);
  let restFolded = folded.slice(consumed);

  // « un peu de persil », « quelques feuilles de basilic »
  const vague = /^(?:un\s+peu\s+(?:de\s+la\s+|de\s+l'|de\s+|d')|quelques\s+)/.exec(restFolded);
  if (vague) {
    restOriginal = restOriginal.slice(vague[0].length);
    restFolded = restFolded.slice(vague[0].length);
  }

  if (!quantity) {
    const list = splitPantryList(restOriginal, restFolded);
    if (list) {
      return list.flatMap(([partOriginal, partFolded]) => {
        const read = readName(partOriginal, partFolded, false);
        return read ? [{ ...read, quantity: null }] : [];
      });
    }
  }

  const read = readName(restOriginal, restFolded, quantity !== null);
  return read ? [{ ...read, quantity }] : [];
}

/* ---------- Rayons ---------- */

const AISLE_KEYWORDS: Record<Exclude<AisleKey, 'autres'>, string[]> = {
  'fruits-legumes': [
    'oignon', 'echalote', 'ail', 'tomate', 'carotte', 'courgette', 'aubergine', 'poivron', 'pomme de terre', 'patate',
    'champignon', 'epinard', 'salade', 'laitue', 'roquette', 'mache', 'concombre', 'citron', 'citron vert', 'orange',
    'pomme', 'poire', 'banane', 'fraise', 'framboise', 'myrtille', 'cerise', 'peche', 'abricot', 'prune', 'raisin',
    'mangue', 'ananas', 'kiwi', 'avocat', 'persil', 'basilic', 'coriandre', 'menthe', 'ciboulette', 'aneth',
    'romarin', 'thym', 'sauge', 'estragon', 'gingembre', 'poireau', 'chou', 'chou-fleur', 'brocoli', 'haricot vert',
    'courge', 'potiron', 'butternut', 'celeri', 'radis', 'betterave', 'fenouil', 'pois', 'panais', 'navet',
    'artichaut', 'asperge', 'endive', 'blette', 'piment', 'pamplemousse', 'clementine', 'melon', 'pasteque', 'figue',
    'jus de citron', 'mais', 'patate douce', 'citronnelle', 'cresson', 'oseille', 'fruit', 'herbe',
  ],
  'viandes-poissons': [
    'poulet', 'dinde', 'boeuf', 'veau', 'porc', 'agneau', 'canard', 'lapin', 'jambon', 'lardon', 'bacon', 'saucisse',
    'chorizo', 'merguez', 'steak', 'escalope', 'viande', 'saumon', 'thon', 'cabillaud', 'poisson', 'crevette',
    'moule', 'colin', 'sardine', 'truite', 'gambas', 'calamar', 'lotte', 'dorade', 'foie gras', 'saucisson',
    'pancetta', 'magret', 'blanc de poulet', 'cuisse de poulet', 'filet mignon', 'cote de porc', 'cote de boeuf',
    'surimi', 'anchois',
  ],
  cremerie: [
    'lait', 'creme', 'creme fraiche', 'creme liquide', 'beurre', 'fromage', 'fromage blanc', 'fromage rape', 'parmesan',
    'mozzarella', 'gruyere', 'emmental', 'comte', 'feta', 'chevre', 'roquefort', 'camembert', 'brie', 'cheddar',
    'mascarpone', 'ricotta', 'boursin', 'yaourt', 'oeuf', 'petit suisse', 'faisselle', 'tofu', 'margarine',
    'raclette', 'reblochon', 'halloumi', 'burrata', 'skyr', 'pate brisee', 'pate feuilletee', 'pate sablee',
    'pate a tarte', 'pate a pizza', 'pate brise', 'pate feuillete', 'pate sable', 'pecorino', 'philadelphia',
  ],
  boulangerie: ['pain', 'baguette', 'brioche', 'tortilla', 'wrap', 'pain de mie', 'pita', 'naan', 'croissant'],
  epicerie: [
    'farine', 'sucre', 'sucre glace', 'sucre vanille', 'levure', 'bicarbonate', 'maizena', 'fecule', 'riz', 'pates',
    'spaghetti', 'tagliatelle', 'penne', 'macaroni', 'lasagne', 'semoule', 'couscous', 'boulgour', 'quinoa',
    'lentille', 'pois chiche', 'haricot rouge', 'haricot blanc', 'flageolet', 'huile', 'vinaigre', 'moutarde',
    'mayonnaise', 'ketchup', 'sauce', 'sauce soja', 'sauce tomate', 'coulis', 'concentre de tomate', 'passata',
    'tomate pelee', 'tomate concassee', 'tomate sechee', 'bouillon', 'fond', 'chocolat', 'cacao', 'miel', 'confiture',
    'sirop', 'epice', 'cumin', 'paprika', 'curcuma', 'cannelle', 'muscade', 'curry', 'origan', 'laurier', 'vanille',
    'safran', 'herbe de provence', 'noix', 'noix de coco', 'noix de cajou', 'amande', 'noisette', 'cacahuete',
    'beurre de cacahuete', 'pistache', 'pignon', 'raisin sec', 'olive', 'cornichon', 'caper', 'lait de coco',
    'conserve', 'biscuit', 'speculoos', 'gelatine', 'chapelure', 'flocon', 'muesli', 'tahini', "piment d'espelette",
    'poivre', 'sel', "eau de fleur d'oranger", 'coquillette', 'linguine', 'vermicelle', 'cassonade', 'corn flake',
    'sriracha', 'pimenton', 'graine', 'aioli', 'eau de rose', 'fleur oranger', 'crouton', 'tahin', 'tahini',
  ],
  surgeles: ['surgele', 'glace', 'sorbet'],
  boissons: ['vin', 'vin blanc', 'vin rouge', 'biere', 'cidre', 'rhum', 'whisky', 'cognac', 'champagne', 'jus', "jus d'orange", 'limonade', 'soda', 'cafe', 'the', 'eau gazeuse', 'eau petillante'],
};

const AISLE_MATCHERS: Array<{ aisle: AisleKey; keyword: string }> = (
  Object.entries(AISLE_KEYWORDS) as Array<[AisleKey, string[]]>
).flatMap(([aisle, keywords]) => keywords.map((keyword) => ({ aisle, keyword })));

/** Le rayon d'un article : le mot-clé le plus long trouvé dans son nom l'emporte (« lait de coco » avant « lait »). */
export function classifyAisle(key: string): AisleKey {
  const padded = ` ${key} `;
  let best: { aisle: AisleKey; length: number } | null = null;
  for (const { aisle, keyword } of AISLE_MATCHERS) {
    if (padded.includes(` ${keyword} `) && (!best || keyword.length > best.length)) {
      best = { aisle, length: keyword.length };
    }
  }
  return best?.aisle ?? 'autres';
}

/* ---------- Fusion ---------- */

function unitRank(unit: string): number {
  if (unit === '') return 0;
  if (unit === 'g' || unit === 'ml') return 1;
  return 2;
}

/** Les lignes fusionnées, dans l'ordre des rayons puis alphabétique. */
export function mergeShoppingLines(lines: ShoppingLine[]): ShoppingItem[] {
  interface Group {
    key: string;
    names: Map<string, number>;
    quantities: Map<string, number>;
    lines: ShoppingLine[];
    pantry: boolean;
  }
  const groups = new Map<string, Group>();

  for (const line of lines) {
    for (const parsed of parseShoppingText(line.text, line.scale ?? 1)) {
      let group = groups.get(parsed.key);
      if (!group) {
        group = { key: parsed.key, names: new Map(), quantities: new Map(), lines: [], pantry: true };
        groups.set(parsed.key, group);
      }
      group.names.set(parsed.name, (group.names.get(parsed.name) ?? 0) + 1);
      if (parsed.quantity) {
        group.quantities.set(parsed.quantity.unit, (group.quantities.get(parsed.quantity.unit) ?? 0) + parsed.quantity.value);
      }
      if (!group.lines.includes(line)) group.lines.push(line);
      group.pantry = group.pantry && parsed.pantry;
    }
  }

  const aisleOrder = new Map(AISLES.map((aisle, index) => [aisle.key, index]));
  return [...groups.values()]
    .map((group): ShoppingItem => {
      const name = [...group.names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
      const quantities = [...group.quantities.entries()]
        .map(([unit, value]) => ({ unit, value }))
        .sort((a, b) => unitRank(a.unit) - unitRank(b.unit) || a.unit.localeCompare(b.unit, 'fr'));
      return {
        key: group.key,
        name,
        aisle: classifyAisle(group.key),
        pantry: group.pantry,
        quantities,
        lines: group.lines,
      };
    })
    .sort(
      (a, b) =>
        (aisleOrder.get(a.aisle) ?? 99) - (aisleOrder.get(b.aisle) ?? 99) || a.name.localeCompare(b.name, 'fr')
    );
}

/* ---------- Affichage ---------- */

function formatNumber(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const fraction = value - whole;
  if (fraction < 0.02) return String(whole);
  const known: Array<[number, string]> = [[0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4']];
  const hit = known.find(([target]) => Math.abs(fraction - target) < 0.02);
  if (hit) return whole > 0 ? `${whole} ${hit[1]}` : hit[1];
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

function formatDecimal(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

export function formatQuantity({ value, unit }: Quantity): string {
  if (unit === 'g') return value >= 1000 ? `${formatDecimal(value / 1000)} kg` : `${formatNumber(value)} g`;
  if (unit === 'ml') return value >= 1000 ? `${formatDecimal(value / 1000)} l` : `${formatNumber(value)} ml`;
  if (unit === '') return formatNumber(value);
  if (unit === 'c. à soupe' || unit === 'c. à café') return `${formatNumber(value)} ${unit}`;
  const plural = Object.values(COUNT_UNITS).find((entry) => entry.unit === unit)?.plural ?? `${unit}s`;
  return `${formatNumber(value)} ${value > 1.02 ? plural : unit}`;
}

/** « 3 + 200 g » : les quantités d'un article, s'il y en a. */
export function formatItemQuantity(item: Pick<ShoppingItem, 'quantities'>): string {
  return item.quantities.map(formatQuantity).join(' + ');
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Les articles à acheter, groupés par rayon (le placard n'y figure pas). */
export function groupItemsByAisle<T extends ShoppingItem>(
  items: T[]
): Array<{ aisle: AisleKey; label: string; items: T[] }> {
  return AISLES.map(({ key, label }) => ({
    aisle: key,
    label,
    items: items.filter((item) => !item.pantry && item.aisle === key),
  })).filter((group) => group.items.length > 0);
}

/** La liste en texte simple, pour la copier ou la partager. */
export function shoppingListToText(items: ShoppingItem[], checkedKeys: ReadonlySet<string>, title: string): string {
  const toBuy = items.filter((item) => !item.pantry && !checkedKeys.has(item.key));
  const lines = [title];
  for (const group of groupItemsByAisle(toBuy)) {
    lines.push('', group.label);
    for (const item of group.items) {
      const quantity = formatItemQuantity(item);
      lines.push(`- ${capitalize(item.name)}${quantity ? ` : ${quantity}` : ''}`);
    }
  }
  const pantry = items.filter((item) => item.pantry && !checkedKeys.has(item.key));
  if (pantry.length > 0) {
    lines.push('', `À vérifier chez vous : ${pantry.map((item) => item.name).join(', ')}`);
  }
  return lines.join('\n');
}

/** Les recettes présentes dans les lignes, avec leur nom. */
export function getRecipesInLines(lines: ShoppingLine[]): Array<{ recipeId: number; title: string }> {
  const seen = new Map<number, string>();
  for (const line of lines) {
    if (line.recipeId !== undefined && !seen.has(line.recipeId)) seen.set(line.recipeId, line.recipeTitle ?? 'Recette');
  }
  return [...seen.entries()].map(([recipeId, title]) => ({ recipeId, title }));
}

/**
 * Le multiplicateur de portions quand on ajoute une recette : 6 personnes pour une recette écrite pour 4 → 1,5.
 * Sans choix enregistré (ou hors de 1 à 12 personnes), on garde les quantités de la recette.
 */
export function portionsScale(savedPortions: number | null, basePortions: number): number {
  if (savedPortions === null || !Number.isFinite(savedPortions)) return 1;
  if (savedPortions < 1 || savedPortions > 12 || !(basePortions > 0)) return 1;
  return savedPortions / basePortions;
}

/* ---------- Ancienne liste ---------- */

interface LegacyItem {
  id: string;
  ingredient: string;
  checked: boolean;
  quantity?: string;
}

/** Reprend l'ancienne liste (déjà fusionnée) : chaque article devient une ligne libre. */
export function migrateLegacyList(items: LegacyItem[], recipeIds: number[]): StoredShopping {
  const lines: ShoppingLine[] = [];
  const checked = new Set<string>();

  for (const item of items) {
    // Une ancienne quantité fusionnée pouvait s'écrire « 1 + 2 c. à soupe »
    const quantities = (item.quantity ?? '').split('+').map((part) => part.trim()).filter(Boolean);
    const texts = quantities.length > 0 ? quantities.map((quantity) => `${quantity} ${item.ingredient}`) : [item.ingredient];
    texts.forEach((text, index) => lines.push({ id: `${item.id}-${index}`, text }));
    if (item.checked) {
      for (const text of texts) for (const parsed of parseShoppingText(text)) checked.add(parsed.key);
    }
  }

  return { lines, checked: [...checked], legacyRecipeIds: recipeIds };
}
