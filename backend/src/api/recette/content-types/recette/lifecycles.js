'use strict';

/**
 * Lifecycle callbacks for the recette model.
 */

module.exports = {
  /**
   * After create.
   */
  async afterCreate(event) {
    const { result } = event;
    
    // Si auto-publish est activé et que la recette est publiée
    if (result.pinterestAutoPublish && result.publishedAt && !result.pinterestPinId) {
      const pinterestService = strapi.service('api::recette.pinterest');
      
      try {
        const pinData = await pinterestService.createPin(result);
        await strapi.entityService.update('api::recette.recette', result.id, {
          data: {
            pinterestPinId: pinData.id,
          },
        });
        strapi.log.info(`Pin Pinterest créé automatiquement pour: ${result.titre}`);
      } catch (error) {
        strapi.log.error('Erreur lors de la publication automatique Pinterest:', error);
      }
    }
  },

  /**
   * After update.
   */
  async afterUpdate(event) {
    const { result } = event;
    
    // Si auto-publish est activé et que la recette vient d'être publiée
    if (result.pinterestAutoPublish && result.publishedAt && !result.pinterestPinId) {
      const pinterestService = strapi.service('api::recette.pinterest');
      
      try {
        const pinData = await pinterestService.createPin(result);
        await strapi.entityService.update('api::recette.recette', result.id, {
          data: {
            pinterestPinId: pinData.id,
          },
        });
        strapi.log.info(`Pin Pinterest créé automatiquement pour: ${result.titre}`);
      } catch (error) {
        strapi.log.error('Erreur lors de la publication automatique Pinterest:', error);
      }
    }
  },
};

