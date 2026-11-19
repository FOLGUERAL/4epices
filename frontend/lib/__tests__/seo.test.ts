import { describe, expect, it } from 'vitest';
import { buildRecipeJsonLd, deriveRecipeCuisine } from '../seo';

describe('deriveRecipeCuisine', () => {
  it('reconnaît une cuisine depuis la catégorie existante', () => {
    expect(deriveRecipeCuisine(['francais'])).toBe('Française');
    expect(deriveRecipeCuisine(['italien'])).toBe('Italienne');
    expect(deriveRecipeCuisine(['asiatique'])).toBe('Asiatique');
    expect(deriveRecipeCuisine(['oriental'])).toBe('Orientale');
  });

  it('prend la première catégorie reconnue quand il y en a plusieurs', () => {
    // Vraie combinaison de catégories existante : "Pizza aux anchois" (italien, snacking)
    expect(deriveRecipeCuisine(['italien', 'snacking'])).toBe('Italienne');
    expect(deriveRecipeCuisine(['snacking', 'italien'])).toBe('Italienne');
  });

  it("n'invente pas de cuisine pour des catégories qui n'en sont pas une", () => {
    // Vraies catégories du site sans origine culturelle précise
    expect(deriveRecipeCuisine(['healthy'])).toBeUndefined();
    expect(deriveRecipeCuisine(['bases-de-cuisine'])).toBeUndefined();
    expect(deriveRecipeCuisine(['cuisine-du-monde'])).toBeUndefined();
    expect(deriveRecipeCuisine(['patisserie', 'brunch-and-apero'])).toBeUndefined();
  });

  it('renvoie undefined sans catégories', () => {
    expect(deriveRecipeCuisine(undefined)).toBeUndefined();
    expect(deriveRecipeCuisine([])).toBeUndefined();
  });
});

describe('buildRecipeJsonLd — HowToStep et recipeCuisine', () => {
  const baseOptions = {
    name: 'Béchamel maison',
    description: 'Une sauce de base.',
    image: 'https://4epices.fr/image.jpg',
    url: 'https://4epices.fr/recettes/bechamel-maison',
    ingredients: ['20g de beurre', '20g de farine', '500ml de lait'],
  };

  it('ajoute name et url à chaque HowToStep, dérivés de la position existante', () => {
    const etapesHtml = '<p>Faire fondre le beurre</p><p>Ajouter la farine</p><p>Verser le lait</p>';
    const result = buildRecipeJsonLd({ ...baseOptions, etapesHtml });

    expect(result.recipeInstructions).toEqual([
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Étape 1',
        text: 'Faire fondre le beurre',
        url: 'https://4epices.fr/recettes/bechamel-maison#etape-1',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Étape 2',
        text: 'Ajouter la farine',
        url: 'https://4epices.fr/recettes/bechamel-maison#etape-2',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Étape 3',
        text: 'Verser le lait',
        url: 'https://4epices.fr/recettes/bechamel-maison#etape-3',
      },
    ]);
  });

  it('ajoute aussi name/url pour le repli à une seule étape (étapes sans balises <p>)', () => {
    const result = buildRecipeJsonLd({ ...baseOptions, etapesHtml: 'Tout en une seule phrase.' });
    expect(result.recipeInstructions).toEqual([
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Étape 1',
        text: 'Tout en une seule phrase.',
        url: 'https://4epices.fr/recettes/bechamel-maison#etape-1',
      },
    ]);
  });

  it('ajoute recipeCuisine quand une catégorie connue est fournie', () => {
    const result = buildRecipeJsonLd({
      ...baseOptions,
      etapesHtml: '<p>Une étape</p>',
      categorySlugs: ['bases-de-cuisine', 'francais'],
    });
    expect(result.recipeCuisine).toBe('Française');
  });

  it("n'ajoute pas recipeCuisine sans catégorie reconnue", () => {
    const result = buildRecipeJsonLd({
      ...baseOptions,
      etapesHtml: '<p>Une étape</p>',
      categorySlugs: ['bases-de-cuisine'],
    });
    expect(result.recipeCuisine).toBeUndefined();
  });

  it('aggregateRating : toujours absent sans note (comportement déjà en place, inchangé)', () => {
    const resultSansNote = buildRecipeJsonLd({ ...baseOptions, etapesHtml: '<p>Une étape</p>' });
    expect(resultSansNote.aggregateRating).toBeUndefined();

    const resultAvecZero = buildRecipeJsonLd({
      ...baseOptions,
      etapesHtml: '<p>Une étape</p>',
      aggregateRating: { ratingValue: 0, reviewCount: 0 },
    });
    expect(resultAvecZero.aggregateRating).toBeUndefined();

    const resultAvecNote = buildRecipeJsonLd({
      ...baseOptions,
      etapesHtml: '<p>Une étape</p>',
      aggregateRating: { ratingValue: 4.5, reviewCount: 12 },
    });
    expect(resultAvecNote.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      reviewCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
  });
});
