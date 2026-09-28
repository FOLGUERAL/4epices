'use strict';

/**
 * Fonctions pures pour le Kit Chef Simon : mise en forme des ingrédients, lien UTM,
 * choix de l'image à proposer au téléchargement. Aucun appel réseau ici (voir
 * chef-simon-content-generator.js pour l'intro générée par IA).
 */

/** Le champ `ingredients` est un JSON libre : soit des chaînes, soit des objets { quantite, ingredient }. */
function ingredientToText(item) {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const quantite = String(item.quantite || '').trim();
    const ingredient = String(item.ingredient || '').trim();
    return [quantite, ingredient].filter(Boolean).join(' ').trim();
  }
  return '';
}

/** Liste d'ingrédients en texte brut, une ligne par ingrédient, prête à copier. */
function formatIngredientsList(ingredients) {
  if (!Array.isArray(ingredients)) return '';
  return ingredients
    .map(ingredientToText)
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');
}

/** Lien vers la recette avec le paramètre utm_source=chefsimon, pour mesurer le trafic renvoyé par Chef Simon. */
function buildChefSimonUtmUrl(slug) {
  const frontendUrl = (process.env.FRONTEND_URL || 'https://4epices.fr').replace(/\/$/, '');
  return `${frontendUrl}/recettes/${encodeURIComponent(String(slug || '').trim())}?utm_source=chefsimon`;
}

/**
 * Image à proposer au téléchargement : la version "medium" (ou "large" à défaut) générée
 * automatiquement par Strapi, plutôt que l'image d'origine en pleine résolution. Si l'image
 * source est trop petite pour avoir des formats générés, on retombe sur l'URL d'origine.
 */
function pickDownloadImage(imagePrincipale) {
  const media = imagePrincipale?.data?.attributes || imagePrincipale;
  if (!media) return null;

  const formats = media.formats || {};
  const chosen = formats.medium || formats.large || formats.small || null;

  return {
    url: chosen?.url || media.url || null,
    width: chosen?.width || media.width || null,
    height: chosen?.height || media.height || null,
  };
}

module.exports = {
  formatIngredientsList,
  buildChefSimonUtmUrl,
  pickDownloadImage,
};
