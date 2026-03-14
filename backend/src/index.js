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
    // Vérifier que les cron jobs sont bien chargés par Strapi
    try {
      // Strapi charge automatiquement les cron jobs depuis config/cron-tasks.js
      // Vérifier directement le fichier cron-tasks.js
      const path = require('path');
      const fs = require('fs');
      const cronTasksPath = path.join(process.cwd(), 'config', 'cron-tasks.js');
      
      if (fs.existsSync(cronTasksPath)) {
        try {
          const cronTasks = require(cronTasksPath);
          const taskKeys = Object.keys(cronTasks);
          strapi.log.info(`✅ [BOOTSTRAP] ${taskKeys.length} cron job(s) défini(s) dans cron-tasks.js: ${taskKeys.join(', ')}`);
          
          // Vérifier si Strapi les a chargés
          const cronConfig = strapi.config.get('server.cron');
          if (cronConfig) {
            const cronKeys = Object.keys(cronConfig);
            strapi.log.info(`✅ [BOOTSTRAP] Strapi a chargé la configuration cron (${cronKeys.length} clé(s): ${cronKeys.join(', ')})`);
            
            // Les cron jobs Strapi devraient s'exécuter automatiquement
            // On attendra les logs [Pinterest Cron] pour confirmer
            strapi.log.info('✅ [BOOTSTRAP] Les cron jobs devraient s\'exécuter automatiquement');
          } else {
            strapi.log.warn('⚠️ [BOOTSTRAP] Strapi n\'a pas chargé la configuration cron');
          }
        } catch (error) {
          strapi.log.warn(`⚠️ [BOOTSTRAP] Erreur lors du chargement de cron-tasks.js: ${error.message}`);
        }
      } else {
        strapi.log.warn(`⚠️ [BOOTSTRAP] Fichier cron-tasks.js non trouvé: ${cronTasksPath}`);
      }
    } catch (error) {
      strapi.log.error('❌ [BOOTSTRAP] Erreur lors de la vérification des cron jobs:', error.message);
    }

    // Enregistrer la route personnalisée pour publier sur Pinterest
    // Utiliser bootstrap() car les controllers sont chargés à ce moment-là
    try {
      strapi.log.info('🔵 [BOOTSTRAP] Enregistrement de la route /api/recettes/:id/publish-pinterest');
      
      // Obtenir le controller directement
      const controller = strapi.controller('api::recette.recette');
      if (!controller) {
        strapi.log.error('❌ [BOOTSTRAP] Controller api::recette.recette non trouvé');
        return;
      }
      
      if (!controller.publishToPinterest) {
        strapi.log.error('❌ [BOOTSTRAP] Méthode publishToPinterest non trouvée dans le controller');
        return;
      }
      
      strapi.log.info('✅ [BOOTSTRAP] Controller et méthode trouvés');
      
      // La route est maintenant gérée par le middleware personnalisé
      // Pas besoin d'enregistrer la route ici, le middleware l'intercepte
      strapi.log.info('✅ [BOOTSTRAP] Route /publish-pinterest/:id sera gérée par le middleware personnalisé');
    } catch (error) {
      strapi.log.error('❌ [BOOTSTRAP] Erreur lors de l\'enregistrement de la route:', error);
      strapi.log.error(error.stack);
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
