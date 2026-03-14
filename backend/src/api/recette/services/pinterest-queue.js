'use strict';

/**
 * Service de queue simple en mémoire pour gérer les pins Pinterest planifiés
 * 
 * Structure d'une tâche:
 * {
 *   id: string (unique),
 *   recetteId: number,
 *   imageUrl: string,
 *   pinIndex: number,
 *   boardId: string,
 *   scheduledTime: string (ISO date),
 *   attempts: number,
 *   maxAttempts: number (default: 3)
 * }
 */

// Queue en mémoire (sera réinitialisée au redémarrage du serveur)
let pinQueue = [];

module.exports = ({ strapi }) => ({
  /**
   * Ajouter une tâche de pin à la queue
   */
  async addPinTask(task) {
    const taskId = `pin_${task.recetteId}_${task.pinIndex}_${Date.now()}`;
    const queueTask = {
      id: taskId,
      recetteId: task.recetteId,
      imageUrl: task.imageUrl,
      pinIndex: task.pinIndex,
      boardId: task.boardId,
      scheduledTime: task.scheduledTime,
      attempts: 0,
      maxAttempts: task.maxAttempts || 3,
      createdAt: new Date().toISOString(),
    };
    
    pinQueue.push(queueTask);
    strapi.log.info(`[Pinterest Queue] Tâche ajoutée: ${taskId} (planifiée pour ${task.scheduledTime})`);
    
    return queueTask;
  },

  /**
   * Récupérer les tâches prêtes à être exécutées
   */
  async getReadyTasks() {
    const now = new Date();
    return pinQueue.filter(task => {
      const scheduledTime = new Date(task.scheduledTime);
      return scheduledTime <= now && task.attempts < task.maxAttempts;
    });
  },

  /**
   * Traiter une tâche de pin
   */
  async processTask(task) {
    try {
      // Récupérer la recette complète
      const recette = await strapi.entityService.findOne('api::recette.recette', task.recetteId, {
        populate: ['imagePrincipale', 'imagesPinterest', 'categories'],
      });

      if (!recette) {
        throw new Error(`Recette ${task.recetteId} non trouvée`);
      }

      // Créer le pin
      const pinterestService = strapi.service('api::recette.pinterest');
      const pinData = await pinterestService.createPinFromImage(
        recette,
        task.imageUrl,
        task.pinIndex,
        task.boardId
      );

      // Mettre à jour les pins de la recette
      await this.updateRecettePins(task.recetteId, pinData.id, task);

      // Retirer la tâche de la queue
      this.removeTask(task.id);

      strapi.log.info(`[Pinterest Queue] Pin #${task.pinIndex} créé avec succès pour recette ${task.recetteId} (ID: ${pinData.id})`);
      
      return { success: true, pinData };
    } catch (error) {
      // Incrémenter le nombre de tentatives
      task.attempts++;
      
      if (task.attempts >= task.maxAttempts) {
        // Retirer de la queue après échec définitif
        this.removeTask(task.id);
        strapi.log.error(`[Pinterest Queue] Tâche ${task.id} échouée définitivement après ${task.attempts} tentatives:`, error.message);
      } else {
        strapi.log.warn(`[Pinterest Queue] Tentative ${task.attempts}/${task.maxAttempts} échouée pour ${task.id}:`, error.message);
      }
      
      return { success: false, error: error.message, attempts: task.attempts };
    }
  },

  /**
   * Mettre à jour les pins de la recette dans la base de données
   */
  async updateRecettePins(recetteId, pinId, task) {
    try {
      const recette = await strapi.entityService.findOne('api::recette.recette', recetteId, {
        fields: ['pinterestPins', 'pinterestPinId'],
      });

      // Récupérer les pins existants
      let pins = recette.pinterestPins || {};
      if (typeof pins === 'string') {
        try {
          pins = JSON.parse(pins);
        } catch {
          pins = {};
        }
      }

      // Ajouter le nouveau pin
      pins[pinId] = {
        imageUrl: task.imageUrl,
        pinIndex: task.pinIndex,
        boardId: task.boardId,
        createdAt: new Date().toISOString(),
      };

      // Mettre à jour la recette
      await strapi.entityService.update('api::recette.recette', recetteId, {
        data: {
          pinterestPins: pins,
          // Garder la compatibilité avec l'ancien champ pour le premier pin
          pinterestPinId: recette.pinterestPinId || pinId,
        },
      });
    } catch (error) {
      strapi.log.error(`[Pinterest Queue] Erreur lors de la mise à jour des pins pour recette ${recetteId}:`, error);
    }
  },

  /**
   * Retirer une tâche de la queue
   */
  removeTask(taskId) {
    pinQueue = pinQueue.filter(task => task.id !== taskId);
  },

  /**
   * Récupérer toutes les tâches en attente (pour debug)
   */
  async getAllTasks() {
    return pinQueue;
  },

  /**
   * Nettoyer les tâches expirées ou échouées
   */
  async cleanup() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const initialLength = pinQueue.length;
    pinQueue = pinQueue.filter(task => {
      const scheduledTime = new Date(task.scheduledTime);
      // Garder les tâches récentes ou non expirées
      return scheduledTime > oneDayAgo || task.attempts < task.maxAttempts;
    });
    
    const removed = initialLength - pinQueue.length;
    if (removed > 0) {
      strapi.log.info(`[Pinterest Queue] ${removed} tâches expirées nettoyées`);
    }
  },
});
