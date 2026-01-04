'use strict';

/**
 * recette controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::recette.recette', ({ strapi }) => ({
  /**
   * Créer une recette et optionnellement publier sur Pinterest
   */
  async create(ctx) {
    const { data, meta } = ctx.request.body;
    
    // Vérifier si Pinterest auto-publish est activé
    const publishToPinterest = data.pinterestAutoPublish === true && data.publishedAt;

    const response = await super.create(ctx);

    // Publier sur Pinterest si demandé
    if (publishToPinterest && response.data) {
      try {
        const pinterestService = strapi.service('api::recette.pinterest');
        const pinData = await pinterestService.createPin(response.data);
        
        // Mettre à jour la recette avec le Pin ID
        await strapi.entityService.update('api::recette.recette', response.data.id, {
          data: {
            pinterestPinId: pinData.id,
          },
        });

        response.data.pinterestPinId = pinData.id;
      } catch (error) {
        strapi.log.error('Erreur lors de la publication Pinterest:', error);
        // Ne pas faire échouer la création de la recette si Pinterest échoue
      }
    }

    return response;
  },

  /**
   * Mettre à jour une recette
   */
  async update(ctx) {
    const response = await super.update(ctx);
    return response;
  },

  /**
   * Publier manuellement une recette sur Pinterest
   */
  async publishToPinterest(ctx) {
    const { id } = ctx.params;

    const recette = await strapi.entityService.findOne('api::recette.recette', id, {
      populate: ['imagePrincipale'],
    });

    if (!recette) {
      return ctx.notFound('Recette non trouvée');
    }

    try {
      const pinterestService = strapi.service('api::recette.pinterest');
      const pinData = await pinterestService.createPin(recette);

      // Mettre à jour la recette avec le Pin ID
      const updatedRecette = await strapi.entityService.update('api::recette.recette', id, {
        data: {
          pinterestPinId: pinData.id,
        },
      });

      return ctx.send({
        data: updatedRecette,
        pin: pinData,
        message: 'Pin Pinterest créé avec succès',
      });
    } catch (error) {
      strapi.log.error('Erreur publication Pinterest:', error);
      return ctx.badRequest('Erreur lors de la publication Pinterest', { 
        error: error.message 
      });
    }
  },
}));
