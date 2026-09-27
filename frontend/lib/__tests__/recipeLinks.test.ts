import { describe, expect, it } from 'vitest';
import { deriveBaseKeyword, linkifyBaseRecipes, splitStepsHtml, type BaseRecipeLink } from '../recipeLinks';

// Les 42 recettes « bases-de-cuisine » publiées, telles que renvoyées par l'API
const BASES: BaseRecipeLink[] = [
  { slug: 'ail-confit', titre: 'Ail confit' },
  { slug: 'bechamel-maison', titre: 'Bechamel maison' },
  { slug: 'oignons-caramelises', titre: 'Oignons caramelises' },
  { slug: 'pain-burger-maison', titre: 'Pain burger maison' },
  { slug: 'pate-a-pizza-maison', titre: 'Pate a pizza maison' },
  { slug: 'pate-brisee-maison', titre: 'Pate brisee maison' },
  { slug: 'riz-pilaf', titre: 'Riz pilaf' },
  { slug: 'sauce-curry-rapide', titre: 'Sauce curry rapide' },
  { slug: 'sauce-tomate-maison', titre: 'Sauce tomate maison' },
  { slug: 'tahini-maison-creme-de-sesame', titre: 'Tahini maison – Crème de sésame' },
  { slug: 'coquillettes-au-jambon', titre: 'Coquillettes au jambon' },
];

// Vraies étapes de la recette « Croque-monsieur » (id 2), telles qu'enregistrées dans Strapi
const CROQUE_MONSIEUR_ETAPES =
  '<p><strong>Étape 1 :</strong> Sur une plaque allant au four, disposer et beurrer 6 tranches de pain de mie</p>\n' +
  '<p><strong>Étape 2 :</strong> Placer une tranche de jambon sur chaque tranche de pain de mie</p>\n' +
  '<p><strong>Étape 3 :</strong> Préchauffer le four à 180°</p>\n' +
  '<p><strong>Étape 4 :</strong> Dans une casserole, préparer la béchamel : Commencer par faire fondre 20g de beurre à feu doux puis ajouter la farine progressivement tout en mélangeant afin de former un roux. Continuer à mélanger et ajouter le lait petit à petit pour éviter la formation de grumeaux</p>\n' +
  '<p><strong>Étape 5 :</strong> Ajouter une couche de béchamel sur chaque tranche de jambon, puis une couche de fromage râpé</p>\n' +
  '<p><strong>Étape 6 :</strong> Refermer les croques avec une tranche de pain de mie puis étaler à nouveau une couche de béchamel suivie d’une couche de fromage râpé</p>\n' +
  '<p><strong>Étape 7 :</strong> Enfourner pendant environ 12 minutes, jusqu’à que le fromage soit doré</p>';

describe('deriveBaseKeyword', () => {
  it('retire les qualificatifs courants en fin de titre', () => {
    expect(deriveBaseKeyword('Bechamel maison')).toBe('bechamel');
    expect(deriveBaseKeyword('Pate a pizza maison')).toBe('pate a pizza');
    expect(deriveBaseKeyword('Sauce curry rapide')).toBe('sauce curry');
    expect(deriveBaseKeyword('Pommes de terre roties croustillantes')).toBe('pommes de terre roties');
  });

  it('ne garde que ce qui précède un tiret', () => {
    expect(deriveBaseKeyword('Tahini maison – Crème de sésame')).toBe('tahini');
  });

  it('laisse un titre sans qualificatif tel quel, normalisé', () => {
    expect(deriveBaseKeyword('Riz pilaf')).toBe('riz pilaf');
    expect(deriveBaseKeyword('Ail confit')).toBe('ail confit');
  });
});

describe('linkifyBaseRecipes', () => {
  it('relie « béchamel » dans les vraies étapes du croque-monsieur, une seule fois', () => {
    const { html, linked } = linkifyBaseRecipes(CROQUE_MONSIEUR_ETAPES, BASES, 'croque-monsieur');

    expect(html).toContain('préparer la <a href="/recettes/bechamel-maison" class="text-orange-700 underline hover:text-orange-800">béchamel</a> :');
    // Les mentions suivantes (étapes 5 et 6) ne sont pas reliées une deuxième fois
    expect(html.match(/href="\/recettes\/bechamel-maison"/g)).toHaveLength(1);
    expect(html).toContain('une couche de béchamel sur chaque tranche');
    expect(linked).toEqual(['bechamel-maison']);
  });

  it('ne relie pas une recette à elle-même', () => {
    const { html } = linkifyBaseRecipes(CROQUE_MONSIEUR_ETAPES, BASES, 'bechamel-maison');
    expect(html).not.toContain('href="/recettes/bechamel-maison"');
  });

  it('ne coupe jamais un mot en deux : un mot-clé « riz » ne s’accroche pas dans « chorizo »', () => {
    const chorizo: BaseRecipeLink[] = [{ slug: 'riz-test', titre: 'Riz' }];
    const html = '<p>Faire revenir le chorizo</p>';
    expect(linkifyBaseRecipes(html, chorizo)).toEqual({ html, linked: [] });
  });

  it('relie « riz pilaf » (les deux mots), mais pas un simple « riz » isolé', () => {
    const html = '<p>Faire revenir le chorizo puis servir avec du riz pilaf</p>';
    const result = linkifyBaseRecipes(html, BASES);
    expect(result.html).toContain('<a href="/recettes/riz-pilaf" class="text-orange-700 underline hover:text-orange-800">riz pilaf</a>');

    const bareRiz = '<p>Servir avec du riz nature</p>';
    expect(linkifyBaseRecipes(bareRiz, BASES)).toEqual({ html: bareRiz, linked: [] });
  });

  it('relie un mot-clé de plusieurs mots, avec l’orthographe et les accents d’origine', () => {
    const html = '<p>Étaler la pâte à pizza puis garnir</p>';
    const { html: result } = linkifyBaseRecipes(html, BASES);
    expect(result).toContain('<a href="/recettes/pate-a-pizza-maison" class="text-orange-700 underline hover:text-orange-800">pâte à pizza</a>');
  });

  it('ne cherche jamais à l’intérieur d’une balise existante', () => {
    const html = '<p>Servir avec du <img alt="riz basmati" src="/riz.jpg"> bien chaud</p>';
    expect(linkifyBaseRecipes(html, BASES)).toEqual({ html, linked: [] });
  });

  it('ne pose qu’un seul lien par paragraphe, même si deux bases y sont mentionnées : la première l’emporte', () => {
    const html = '<p>Napper de béchamel puis ajouter de la sauce tomate maison</p>';
    const { html: result } = linkifyBaseRecipes(html, BASES);
    expect(result.match(/<a /g)).toHaveLength(1);
    expect(result).toContain('href="/recettes/bechamel-maison"');
    expect(result).not.toContain('href="/recettes/sauce-tomate-maison"');
    expect(result).toContain('ajouter de la sauce tomate maison');
  });

  it('relie plusieurs bases différentes quand elles sont dans des paragraphes distincts', () => {
    const html = '<p>Préparer le riz pilaf</p><p>Servir avec la sauce tomate maison</p>';
    const { html: result, linked } = linkifyBaseRecipes(html, BASES);
    expect(result).toContain('href="/recettes/riz-pilaf"');
    expect(result).toContain('href="/recettes/sauce-tomate-maison"');
    expect(linked).toEqual(['riz-pilaf', 'sauce-tomate-maison']);
  });

  it('ignore les mots-clés trop courts (« ail confit » reste, mais un mot isolé de 1-2 lettres ne matcherait rien)', () => {
    const html = '<p>Ajouter un peu d’ail confit</p>';
    const { html: result } = linkifyBaseRecipes(html, BASES);
    expect(result).toContain('href="/recettes/ail-confit"');
  });

  it('avec `alreadyLinked`, ne relie pas une deuxième fois une base déjà reliée dans un autre morceau de texte', () => {
    // Cas réel : les étapes coupées en deux pour la pub du milieu, béchamel mentionnée des deux côtés
    const half1 = '<p>Préparer la béchamel</p>';
    const half2 = '<p>Ajouter une couche de béchamel</p>';

    const first = linkifyBaseRecipes(half1, BASES);
    expect(first.linked).toEqual(['bechamel-maison']);

    const second = linkifyBaseRecipes(half2, BASES, undefined, first.linked);
    expect(second.html).toBe(half2); // pas de lien posé, la base est déjà reliée dans la première moitié
    expect(second.linked).toEqual([]);
  });

  it('renvoie le texte tel quel sans recette de base ou sans correspondance', () => {
    expect(linkifyBaseRecipes('<p>Rien à voir ici</p>', BASES)).toEqual({ html: '<p>Rien à voir ici</p>', linked: [] });
    expect(linkifyBaseRecipes('<p>Du texte</p>', [])).toEqual({ html: '<p>Du texte</p>', linked: [] });
    expect(linkifyBaseRecipes('', BASES)).toEqual({ html: '', linked: [] });
  });
});

describe('splitStepsHtml', () => {
  it('coupe les 7 étapes du croque-monsieur en deux moitiés de paragraphes entiers', () => {
    const { before, after, stepCount } = splitStepsHtml(CROQUE_MONSIEUR_ETAPES);
    expect(stepCount).toBe(7);
    // 7 étapes : 4 dans la première moitié (arrondi au-dessus), 3 dans la seconde
    expect(before.match(/<p/g)).toHaveLength(4);
    expect(after.match(/<p/g)).toHaveLength(3);
    expect(before + after).toBe(CROQUE_MONSIEUR_ETAPES.replace(/\n/g, ''));
    expect(before).toContain('Étape 4');
    expect(after).toContain('Étape 5');
  });

  it('ne découpe pas une recette de moins de deux étapes', () => {
    const html = '<p>Une seule étape, tout est dedans</p>';
    expect(splitStepsHtml(html)).toEqual({ before: html, after: '', stepCount: 1 });
  });

  it('ne découpe pas quand il y a du texte en dehors des paragraphes (mise en forme inattendue)', () => {
    const html = '<p>Étape 1</p><ul><li>Une liste</li></ul><p>Étape 2</p>';
    expect(splitStepsHtml(html)).toEqual({ before: html, after: '', stepCount: 2 });
  });

  it('ne découpe pas un texte vide', () => {
    expect(splitStepsHtml('')).toEqual({ before: '', after: '', stepCount: 1 });
  });
});
