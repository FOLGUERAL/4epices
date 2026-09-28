'use strict';

const { formatIngredientsList, buildChefSimonUtmUrl, pickDownloadImage } = require('../../../../utils/chefSimonFormat');

module.exports = {
  /**
   * GET /chef-simon-kit/generate/:id
   * Génère à la demande le Kit Chef Simon pour une recette : titre, intro (IA), ingrédients,
   * lien UTM, image redimensionnée. Ne persiste rien : c'est un aperçu à copier/coller.
   */
  async generate(ctx) {
    const { id } = ctx.params;

    const recette = await strapi.entityService.findOne('api::recette.recette', id, {
      populate: ['imagePrincipale'],
    });

    if (!recette) {
      return ctx.notFound('Recette non trouvée');
    }

    let intro = '';
    let introError = null;
    try {
      const contentGenerator = strapi.service('api::recette.chef-simon-content-generator');
      const result = await contentGenerator.generateIntro(recette);
      intro = result.intro;
    } catch (error) {
      strapi.log.error('[Chef Simon Kit] Erreur génération intro:', error);
      introError = error.message === 'QUOTA_EXCEEDED'
        ? "Quota Groq atteint pour l'instant, réessaie dans quelques minutes."
        : "Impossible de générer l'intro automatiquement, écris-la à la main ci-dessous.";
    }

    return ctx.send({
      titre: recette.titre,
      intro,
      introError,
      ingredients: formatIngredientsList(recette.ingredients),
      link: buildChefSimonUtmUrl(recette.slug),
      image: pickDownloadImage(recette.imagePrincipale),
    });
  },
};
