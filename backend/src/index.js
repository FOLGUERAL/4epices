'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Ajouter la route personnalisée pour publier sur Pinterest
    try {
      strapi.log.info('🔵 Enregistrement de la route /api/recettes/:id/publish-pinterest');
      
      // Vérifier que le controller existe
      const controller = strapi.controller('api::recette.recette');
      if (controller && controller.publishToPinterest) {
        strapi.log.info('✅ Controller publishToPinterest trouvé');
      } else {
        strapi.log.error('❌ Controller publishToPinterest NON trouvé');
      }
      
      strapi.server.routes([
        {
          method: 'POST',
          path: '/api/recettes/:id/publish-pinterest',
          handler: 'api::recette.recette.publishToPinterest',
          config: {
            policies: [],
            middlewares: [],
          },
        },
      ]);
      
      strapi.log.info('✅ Route personnalisée enregistrée');
    } catch (error) {
      strapi.log.error('❌ Erreur lors de l\'enregistrement de la route:', error);
    }

    // Configurer automatiquement les permissions publiques au démarrage
    try {
      const publicRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'public' } });

      if (publicRole) {
        const actions = [
          'api::recette.recette.find',
          'api::recette.recette.findOne',
          'api::categorie.categorie.find',
          'api::categorie.categorie.findOne',
          'api::tag.tag.find',
          'api::tag.tag.findOne',
        ];

        for (const action of actions) {
          const [api, controller, actionName] = action.split('.');
          const actionId = `${api}::${controller}.${actionName}`;

          // Vérifier si la permission existe déjà
          const existingPermission = await strapi
            .query('plugin::users-permissions.permission')
            .findOne({
              where: {
                role: publicRole.id,
                action: actionId,
              },
            });

          if (existingPermission) {
            // Mettre à jour si elle existe mais est désactivée
            if (!existingPermission.enabled) {
              await strapi
                .query('plugin::users-permissions.permission')
                .update({
                  where: { id: existingPermission.id },
                  data: { enabled: true },
                });
            }
          } else {
            // Créer la permission si elle n'existe pas
            await strapi
              .query('plugin::users-permissions.permission')
              .create({
                data: {
                  role: publicRole.id,
                  action: actionId,
                  enabled: true,
                },
              });
          }
        }

        strapi.log.info('✅ Permissions publiques configurées automatiquement');
      }
    } catch (error) {
      strapi.log.warn('⚠️ Impossible de configurer automatiquement les permissions:', error.message);
      strapi.log.warn('Veuillez configurer les permissions manuellement dans Settings > Users & Permissions Plugin > Roles > Public');
    }
  },
};
