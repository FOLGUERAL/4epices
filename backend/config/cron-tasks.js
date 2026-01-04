module.exports = {
  /**
   * Vérifier les recettes à publier et créer les pins Pinterest
   * Exécuté toutes les heures
   */
  '0 * * * *': async ({ strapi }) => {
    try {
      const now = new Date();
      
      // Récupérer les recettes publiées qui doivent être postées sur Pinterest
      // mais qui n'ont pas encore de pin Pinterest
      const recettes = await strapi.entityService.findMany('api::recette.recette', {
        filters: {
          publishedAt: {
            $lte: now,
          },
          pinterestAutoPublish: true,
          pinterestPinId: {
            $null: true,
          },
        },
        populate: ['imagePrincipale'],
      });

      const pinterestService = strapi.service('api::recette.pinterest');

      for (const recette of recettes) {
        try {
          const pinData = await pinterestService.createPin(recette);
          
          await strapi.entityService.update('api::recette.recette', recette.id, {
            data: {
              pinterestPinId: pinData.id,
            },
          });

          const titre = recette.attributes?.titre || recette.titre || 'Recette sans titre';
          strapi.log.info(`Pin Pinterest créé pour la recette: ${titre}`);
        } catch (error) {
          const titre = recette.attributes?.titre || recette.titre || 'Recette sans titre';
          strapi.log.error(`Erreur lors de la création du pin pour ${titre}:`, error);
        }
      }
    } catch (error) {
      strapi.log.error('Erreur dans le cron job Pinterest:', error);
    }
  },
};

