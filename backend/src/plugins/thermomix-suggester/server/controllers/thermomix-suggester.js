'use strict';

module.exports = {
  /**
   * GET /thermomix-suggester/suggest/:id
   * Suggère si la recette est adaptée au Thermomix et, si oui, un brouillon d'étapes.
   * Ne persiste rien : c'est à relire et recopier à la main dans les champs Strapi.
   */
  async suggest(ctx) {
    const { id } = ctx.params;

    const recette = await strapi.entityService.findOne('api::recette.recette', id, {
      fields: ['titre', 'description', 'ingredients', 'etapes'],
    });

    if (!recette) {
      return ctx.notFound('Recette non trouvée');
    }

    try {
      const contentGenerator = strapi.service('api::recette.thermomix-content-generator');
      const result = await contentGenerator.suggestThermomix(recette);
      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[Thermomix Suggester] Erreur génération:', error);
      const message = error.message === 'QUOTA_EXCEEDED'
        ? "Quota Groq atteint pour l'instant, réessaie dans quelques minutes."
        : 'Impossible de générer la suggestion Thermomix pour l\'instant.';
      return ctx.badRequest(message);
    }
  },
};
