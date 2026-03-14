module.exports = {
  /**
   * Traiter la queue de pins Pinterest planifiés
   * Exécuté toutes les 5 minutes pour respecter le rate limiting
   */
  '*/5 * * * *': async ({ strapi }) => {
    try {
      const queueService = strapi.service('api::recette.pinterest-queue');
      
      // Récupérer toutes les tâches pour debug
      const allTasks = await queueService.getAllTasks();
      strapi.log.info(`[Pinterest Cron] Vérification de la queue: ${allTasks.length} tâche(s) en attente`);
      
      // Afficher les détails des tâches en attente
      if (allTasks.length > 0) {
        allTasks.forEach(task => {
          const scheduledTime = new Date(task.scheduledTime);
          const now = new Date();
          const isReady = scheduledTime <= now;
          strapi.log.info(`[Pinterest Cron] Tâche ${task.id}: pin #${task.pinIndex} pour recette ${task.recetteId}, planifiée pour ${task.scheduledTime}, ${isReady ? 'PRÊTE' : 'en attente'} (${Math.round((scheduledTime - now) / 1000 / 60)} min)`);
        });
      }
      
      // Récupérer les tâches prêtes à être exécutées
      const readyTasks = await queueService.getReadyTasks();
      
      if (readyTasks.length === 0) {
        strapi.log.info('[Pinterest Cron] Aucune tâche prête à être exécutée');
        return;
      }
      
      strapi.log.info(`[Pinterest Cron] ${readyTasks.length} tâche(s) prête(s) à traiter`);
      
      // Traiter toutes les tâches prêtes, mais une seule à la fois pour respecter le rate limiting
      // (Pinterest recommande 1 pin toutes les 5 minutes)
      // Comme le cron s'exécute toutes les 5 minutes, on peut traiter une tâche par exécution
      let processed = 0;
      for (const task of readyTasks) {
        try {
          strapi.log.info(`[Pinterest Cron] Traitement de la tâche ${task.id} (pin #${task.pinIndex} pour recette ${task.recetteId})`);
          const result = await queueService.processTask(task);
          
          if (result.success) {
            processed++;
            strapi.log.info(`[Pinterest Cron] Tâche ${task.id} traitée avec succès`);
            // Traiter une seule tâche par exécution du cron pour respecter le rate limiting
            // Les autres seront traitées lors des prochaines exécutions (toutes les 5 min)
            break;
          } else {
            strapi.log.warn(`[Pinterest Cron] Tâche ${task.id} échouée: ${result.error}`);
            // Continuer avec la tâche suivante si celle-ci a échoué
          }
        } catch (error) {
          strapi.log.error(`[Pinterest Cron] Erreur lors du traitement de la tâche ${task.id}:`, error);
          // Continuer avec la tâche suivante en cas d'erreur
        }
      }
      
      if (processed > 0) {
        strapi.log.info(`[Pinterest Cron] ${processed} tâche(s) traitée(s) avec succès`);
      }
      
      // Nettoyer les tâches expirées
      await queueService.cleanup();
    } catch (error) {
      strapi.log.error('[Pinterest Cron] Erreur lors du traitement de la queue:', error);
    }
  },

  /**
   * Vérifier les recettes à publier et créer les pins Pinterest
   * Exécuté toutes les heures pour les recettes qui n'ont pas encore de pins
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
        populate: ['imagePrincipale', 'imagesPinterest', 'categories'],
      });

      const pinterestService = strapi.service('api::recette.pinterest');

      for (const recette of recettes) {
        try {
          // Vérifier si des pins existent déjà dans le nouveau format
          const recetteData = recette.attributes || recette;
          const existingPins = recetteData.pinterestPins || {};
          let hasPins = false;
          
          // Vérifier si pinterestPins contient des données
          if (typeof existingPins === 'object' && Object.keys(existingPins).length > 0) {
            hasPins = true;
          } else if (recetteData.pinterestPinId) {
            hasPins = true;
          }
          
          if (hasPins) {
            continue; // Cette recette a déjà des pins
          }
          
          // Créer 3 pins (premier immédiatement, les autres planifiés)
          const resultPins = await pinterestService.createMultiplePins(recette, {
            pinsCount: 3,
            delayBetweenPins: 5 * 60 * 1000, // 5 minutes
          });
          
          // Mettre à jour avec le premier pin créé
          if (resultPins.createdPins.length > 0) {
            const firstPin = resultPins.createdPins[0];
            await strapi.entityService.update('api::recette.recette', recette.id, {
              data: {
                pinterestPinId: firstPin.pinId, // Compatibilité legacy
                pinterestPins: {
                  [firstPin.pinId]: {
                    imageUrl: firstPin.imageUrl,
                    pinIndex: firstPin.pinIndex,
                    boardId: firstPin.boardId,
                    createdAt: firstPin.createdAt,
                  },
                },
              },
            });
          }

          const titre = recette.attributes?.titre || recette.titre || 'Recette sans titre';
          strapi.log.info(`[Pinterest Cron] Pins créés pour la recette: ${titre} (1 immédiat, ${resultPins.scheduledPins} planifiés)`);
        } catch (error) {
          const titre = recette.attributes?.titre || recette.titre || 'Recette sans titre';
          strapi.log.error(`[Pinterest Cron] Erreur lors de la création des pins pour ${titre}:`, error);
        }
      }
    } catch (error) {
      strapi.log.error('[Pinterest Cron] Erreur dans le cron job Pinterest:', error);
    }
  },
};

