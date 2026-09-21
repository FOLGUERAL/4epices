import { describe, expect, it } from 'vitest';
import {
  classifyAisle,
  formatItemQuantity,
  getRecipesInLines,
  groupItemsByAisle,
  mergeShoppingLines,
  migrateLegacyList,
  parseShoppingText,
  portionsScale,
  shoppingListToText,
  type ShoppingItem,
  type ShoppingLine,
} from '../shoppingMerge';

// Les lignes ci-dessous sont de vraies lignes d'ingrédients de recettes publiées
let counter = 0;
const lines = (...texts: string[]): ShoppingLine[] => texts.map((text) => ({ id: `l${(counter += 1)}`, text }));
const merge = (...texts: string[]) => mergeShoppingLines(lines(...texts));
const byKey = (items: ShoppingItem[], key: string) => items.find((item) => item.key === key);
const quantityOf = (items: ShoppingItem[], key: string) => {
  const item = byKey(items, key);
  return item ? formatItemQuantity(item) : undefined;
};

describe('fusion des variantes d’écriture', () => {
  it('« oignon », « oignon moyen », « gros oignon » et « oignon moyen, émincé » forment un seul article', () => {
    const items = merge('1 oignon', '1 oignon moyen', '1 gros oignon', '1 oignon moyen, émincé');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('oignon');
    expect(quantityOf(items, 'oignon')).toBe('4');
  });

  it('garde distincts la couleur et la transformation : oignon rouge, oignons frits', () => {
    const items = merge('1 oignon', '1 oignon rouge', '1/2 oignon rouge', '1 petit oignon rouge', 'oignons frits');
    expect(items.map((item) => item.key).sort()).toEqual(['oignon', 'oignon frit', 'oignon rouge']);
    expect(quantityOf(items, 'oignon rouge')).toBe('2 1/2');
  });

  it('fusionne l’ail écrit de quatre façons, unité comprise', () => {
    const items = merge("2 gousses d'ail", "2 gousses d'ail émincées", '1/2 Gousse d’ail', '1 Gousse ail');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('ail');
    expect(quantityOf(items, 'ail')).toBe('5 1/2 gousses');
  });

  it('fusionne les tomates fraîches mais pas les tomates pelées ni la sauce tomate', () => {
    const items = merge('2 tomates', '3 tomates', '4 grosses tomates mûres', '800g tomates pelées', '100ml de sauce tomate');
    expect(quantityOf(items, 'tomate')).toBe('9');
    expect(byKey(items, 'tomate pelee')).toBeDefined();
    expect(byKey(items, 'sauce tomate')).toBeDefined();
    expect(items).toHaveLength(3);
  });

  it('ne fusionne pas le beurre et le beurre de cacahuète', () => {
    const items = merge('30g de beurre', '20g de beurre', '25g de beurre fondu', '125 g beurre froid', '3 cuillère à soupe beurre de cacahuète');
    expect(quantityOf(items, 'beurre')).toBe('200 g');
    expect(quantityOf(items, 'beurre de cacahuete')).toBe('3 c. à soupe');
  });

  it('ignore les pluriels, les accents et la ligature œ', () => {
    const items = merge('3 œufs', '2 oeufs', '1 Oeuf');
    expect(items).toHaveLength(1);
    expect(quantityOf(items, 'oeuf')).toBe('6');
  });

  it('ne confond pas les pâtes et une pâte', () => {
    const items = merge('200 g de pâtes', '1 pâte brisée');
    expect(items.map((item) => item.key).sort()).toEqual(['pate brisee', 'pates']);
  });
});

describe('cas réels du catalogue', () => {
  it('fusionne « huile d’olive » et « huile d olive » (élision écrite avec une espace)', () => {
    const items = merge("2 cuillères à soupe d'huile d'olive", '1 c. a soupe huile d olive', '200ml d’huile d’olive');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('huile olive');
    expect(quantityOf(items, 'huile olive')).toBe('200 ml + 3 c. à soupe');
  });

  it('fusionne « gousse d ail » écrit avec une espace', () => {
    expect(merge("2 gousses d'ail", '1 gousse d ail')).toHaveLength(1);
  });

  it('ignore une parenthèse, même contenant une virgule ou jamais refermée', () => {
    expect(merge('Graines de sésame (optionnel)')[0].key).toBe('graine de sesame');
    expect(merge('1 cuillère à café de sriracha (optionnel, pour une sauce épicée)')[0].key).toBe('sriracha');
    expect(merge('sriracha (optionnel')[0].key).toBe('sriracha');
  });

  it('sépare « sel/poivre » en deux articles du placard', () => {
    const items = merge('Sel/poivre');
    expect(items.map((item) => item.key).sort()).toEqual(['poivre', 'sel']);
  });

  it('garde le « s » des mots qui le portent : panais, couscous, anchois, bois', () => {
    expect(merge('2 panais')[0].key).toBe('panais');
    expect(merge('200 g de couscous')[0].key).toBe('couscous');
    expect(merge('4 anchois')[0].key).toBe('anchois');
    expect(merge('pics en bois')[0].key).toBe('pic en bois');
  });

  it('range ce qui était resté sans rayon', () => {
    for (const text of ['200 g de coquillettes', '100 g de vermicelles', '2 c. à soupe de cassonade', '1 pâte feuilletée', '50 g de pecorino']) {
      expect(merge(text)[0].aisle).not.toBe('autres');
    }
  });
});

describe('quantités et unités', () => {
  it('additionne g et kg, ml, cl et l', () => {
    expect(quantityOf(merge('1 kg farine', '500 g de farine'), 'farine')).toBe('1,5 kg');
    expect(quantityOf(merge('1 l de lait', '250 ml de lait', '10 cl de lait'), 'lait')).toBe('1,35 l');
  });

  it('reconnaît les cuillères sous toutes leurs écritures', () => {
    const items = merge('2 c. à soupe huile', '1 cuillère à soupe huile', '1 c à s huile', '1 c. a cafe sel', '1/2 cuillères à café sel');
    expect(quantityOf(items, 'huile')).toBe('4 c. à soupe');
    expect(quantityOf(items, 'sel')).toBe('1 1/2 c. à café');
  });

  it('garde côte à côte un nombre d’éléments et un poids', () => {
    expect(quantityOf(merge('3 courgettes', '200 g de courgettes'), 'courgette')).toBe('3 + 200 g');
  });

  it('lit fractions, fractions mixtes, décimales, intervalles et « un / une »', () => {
    const q = (text: string) => parseShoppingText(text)[0].quantity;
    expect(q('1/2 citron')).toEqual({ value: 0.5, unit: '' });
    expect(q('1 1/2 c. à soupe miel')).toEqual({ value: 1.5, unit: 'c. à soupe' });
    expect(q('1,5 l lait')).toEqual({ value: 1500, unit: 'ml' });
    expect(q('2 à 3 gousses d’ail')).toEqual({ value: 3, unit: 'gousse' });
    expect(q('un oignon')).toEqual({ value: 1, unit: '' });
    expect(q('une pincée de sel')).toEqual({ value: 1, unit: 'pincée' });
  });

  it('accepte une ligne sans quantité', () => {
    const [parsed] = parseShoppingText('un peu de persil');
    expect(parsed.key).toBe('persil');
    expect(parsed.quantity).toBeNull();
  });

  it('applique le multiplicateur de portions', () => {
    const items = mergeShoppingLines([{ id: 'a', text: '2 oignons', scale: 1.5 }, { id: 'b', text: '200 g de farine', scale: 2 }]);
    expect(quantityOf(items, 'oignon')).toBe('3');
    expect(quantityOf(items, 'farine')).toBe('400 g');
  });
});

describe('placard : sel, poivre, eau', () => {
  it('range sel et poivre à part, quelle que soit l’écriture, en les séparant', () => {
    const items = merge('sel', 'poivre', 'sel, poivre', 'Sel et poivre du moulin', '1/4 cuillère à café de poivre noir', 'fleur de sel');
    expect(items.map((item) => item.key).sort()).toEqual(['poivre', 'sel']);
    expect(items.every((item) => item.pantry)).toBe(true);
  });

  it('marque huile, sucre, farine comme placard seulement quand rien n’est quantifié', () => {
    expect(byKey(merge('huile'), 'huile')?.pantry).toBe(true);
    expect(byKey(merge('2 c. à soupe d’huile'), 'huile')?.pantry).toBe(false);
  });

  it('ne prend pas l’eau de fleur d’oranger pour de l’eau', () => {
    expect(byKey(merge("1 c. à café d'eau de fleur d'oranger"), 'eau')).toBeUndefined();
  });

  it('exclut le placard des groupes de rayon', () => {
    const items = merge('sel', '3 oignons', '200 g de farine');
    const groups = groupItemsByAisle(items);
    expect(groups.map((group) => group.aisle)).toEqual(['fruits-legumes', 'epicerie']);
    expect(groups.flatMap((group) => group.items.map((item) => item.key))).not.toContain('sel');
  });
});

describe('rayons', () => {
  it('range les produits courants dans le bon rayon', () => {
    expect(classifyAisle('oignon')).toBe('fruits-legumes');
    expect(classifyAisle('tomate cerise')).toBe('fruits-legumes');
    expect(classifyAisle('poulet')).toBe('viandes-poissons');
    expect(classifyAisle('creme fraiche')).toBe('cremerie');
    expect(classifyAisle('oeuf')).toBe('cremerie');
    expect(classifyAisle('baguette')).toBe('boulangerie');
    expect(classifyAisle('farine')).toBe('epicerie');
    expect(classifyAisle('vin blanc')).toBe('boissons');
  });

  it('le mot-clé le plus long l’emporte', () => {
    expect(classifyAisle('lait de coco')).toBe('epicerie');
    expect(classifyAisle('lait')).toBe('cremerie');
    expect(classifyAisle('beurre de cacahuete')).toBe('epicerie');
    expect(classifyAisle('tomate pelee')).toBe('epicerie');
    expect(classifyAisle('sucre glace')).toBe('epicerie');
    expect(classifyAisle('pate brisee')).toBe('cremerie');
    expect(classifyAisle('pates')).toBe('epicerie');
  });

  it('range dans « Autres » ce qui n’est pas reconnu', () => {
    expect(classifyAisle('machin inconnu')).toBe('autres');
  });
});

describe('ordre, origine et texte', () => {
  it('trie par rayon puis par nom', () => {
    const items = merge('200 g de farine', '3 oignons', '1 poulet', '2 courgettes');
    expect(items.map((item) => item.key)).toEqual(['courgette', 'oignon', 'poulet', 'farine']);
  });

  it('garde les lignes d’origine de chaque article, avec la recette', () => {
    const items = mergeShoppingLines([
      { id: '1', text: '2 oignons', recipeId: 10, recipeTitle: 'Gratin' },
      { id: '2', text: '1 gros oignon', recipeId: 11, recipeTitle: 'Tarte' },
    ]);
    expect(items[0].lines.map((line) => line.recipeTitle)).toEqual(['Gratin', 'Tarte']);
  });

  it('liste les recettes présentes, une fois chacune', () => {
    const list: ShoppingLine[] = [
      { id: '1', text: '2 oignons', recipeId: 10, recipeTitle: 'Gratin' },
      { id: '2', text: '1 ail', recipeId: 10, recipeTitle: 'Gratin' },
      { id: '3', text: 'lait' },
    ];
    expect(getRecipesInLines(list)).toEqual([{ recipeId: 10, title: 'Gratin' }]);
  });

  it('écrit la liste en texte : à acheter par rayon, placard à part, cochés exclus', () => {
    const items = merge('3 oignons', '200 g de farine', 'sel', '1 l de lait');
    const text = shoppingListToText(items, new Set(['lait']), 'Liste de courses');
    // Le nom affiché est la forme écrite dans les recettes
    expect(text).toContain('Fruits et légumes\n- Oignons : 3');
    expect(text).toContain('Épicerie\n- Farine : 200 g');
    expect(text).not.toContain('Lait');
    expect(text).toContain('À vérifier chez vous : sel');
  });
});

describe('portionsScale', () => {
  it('donne le rapport entre les portions choisies et celles de la recette', () => {
    expect(portionsScale(6, 4)).toBe(1.5);
    expect(portionsScale(2, 4)).toBe(0.5);
    expect(portionsScale(4, 4)).toBe(1);
  });

  it('garde les quantités de la recette sans choix valable', () => {
    expect(portionsScale(null, 4)).toBe(1);
    expect(portionsScale(0, 4)).toBe(1);
    expect(portionsScale(20, 4)).toBe(1);
    expect(portionsScale(6, 0)).toBe(1);
    expect(portionsScale(Number.NaN, 4)).toBe(1);
  });
});

describe('reprise de l’ancienne liste', () => {
  it('convertit les articles fusionnés en lignes libres et garde les cochés', () => {
    const stored = migrateLegacyList(
      [
        { id: 'a', ingredient: 'oignon', quantity: '3', checked: true },
        { id: 'b', ingredient: 'farine', quantity: '200 g', checked: false },
        { id: 'c', ingredient: 'huile', quantity: '1 + 2 c. à soupe', checked: false },
      ],
      [7, 9]
    );
    expect(stored.lines.map((line) => line.text)).toEqual(['3 oignon', '200 g farine', '1 huile', '2 c. à soupe huile']);
    expect(stored.checked).toEqual(['oignon']);
    expect(stored.legacyRecipeIds).toEqual([7, 9]);
  });
});
