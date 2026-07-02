'use strict';

/**
 * Service de queue persistante pour gerer les pins Pinterest planifies.
 *
 * Les methodes exposent volontairement le meme contrat que l'ancienne queue
 * en memoire afin de ne pas changer le cron, le dashboard et les strategies.
 */

const QUEUE_UID = 'api::pinterest-queue.pinterest-queue';

function toPublicTask(task) {
  if (!task) return null;

  return {
    id: task.taskUid,
    dbId: task.id,
    recetteId: task.recetteId,
    recetteTitle: task.recetteTitle || null,
    recetteSlug: task.recetteSlug || null,
    imageUrl: task.imageUrl,
    pinIndex: task.pinIndex,
    boardId: task.boardId || null,
    scheduledTime: task.scheduledTime,
    attempts: task.attempts || 0,
    maxAttempts: task.maxAttempts || 3,
    source: task.source || 'multi-pins',
    strategyScore: task.strategyScore || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastError: task.lastError || null,
  };
}

module.exports = ({ strapi }) => ({
  /**
   * Ajouter une tache de pin a la queue.
   */
  async addPinTask(task) {
    const taskId = `pin_${task.recetteId}_${task.pinIndex}_${Date.now()}`;
    const createdTask = await strapi.entityService.create(QUEUE_UID, {
      data: {
        taskUid: taskId,
        recetteId: task.recetteId,
        recetteTitle: task.recetteTitle || null,
        recetteSlug: task.recetteSlug || null,
        imageUrl: task.imageUrl,
        pinIndex: task.pinIndex,
        boardId: task.boardId || null,
        scheduledTime: task.scheduledTime,
        attempts: 0,
        maxAttempts: task.maxAttempts || 3,
        source: task.source || 'multi-pins',
        strategyScore: task.strategyScore || null,
        lastError: null,
      },
    });

    strapi.log.info(`[Pinterest Queue] Tache ajoutee: ${taskId} (planifiee pour ${task.scheduledTime})`);

    return toPublicTask(createdTask);
  },

  /**
   * Recuperer les taches pretes a etre executees.
   */
  async getReadyTasks() {
    const now = new Date().toISOString();
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      filters: {
        scheduledTime: {
          $lte: now,
        },
        $or: [
          {
            attempts: {
              $null: true,
            },
          },
          {
            attempts: {
              $lt: 3,
            },
          },
        ],
      },
      sort: { scheduledTime: 'asc' },
      limit: 100,
    });

    return tasks
      .filter((task) => (task.attempts || 0) < (task.maxAttempts || 3))
      .map(toPublicTask);
  },

  /**
   * Traiter une tache de pin.
   */
  async processTask(task) {
    const dbTask = await this.findTaskByUid(task.id);

    if (!dbTask) {
      return { success: false, error: `Tache ${task.id} non trouvee`, attempts: task.attempts || 0 };
    }

    const publicTask = toPublicTask(dbTask);

    try {
      const recette = await strapi.entityService.findOne('api::recette.recette', publicTask.recetteId, {
        populate: ['imagePrincipale', 'imagesPinterest', 'categories'],
      });

      if (!recette) {
        throw new Error(`Recette ${publicTask.recetteId} non trouvee`);
      }

      const pinterestService = strapi.service('api::recette.pinterest');
      const pinData = await pinterestService.createPinFromImage(
        recette,
        publicTask.imageUrl,
        publicTask.pinIndex,
        publicTask.boardId
      );

      await this.updateRecettePins(publicTask.recetteId, pinData.id, publicTask);
      await this.removeTask(publicTask.id);

      strapi.log.info(
        `[Pinterest Queue] Pin #${publicTask.pinIndex} cree avec succes pour recette ${publicTask.recetteId} (ID: ${pinData.id})`
      );

      return { success: true, pinData };
    } catch (error) {
      const nextAttempts = (publicTask.attempts || 0) + 1;

      if (nextAttempts >= publicTask.maxAttempts) {
        await this.removeTask(publicTask.id);
        strapi.log.error(
          `[Pinterest Queue] Tache ${publicTask.id} echouee definitivement apres ${nextAttempts} tentatives:`,
          error.message
        );
      } else {
        await strapi.entityService.update(QUEUE_UID, dbTask.id, {
          data: {
            attempts: nextAttempts,
            lastError: error.message,
          },
        });
        strapi.log.warn(
          `[Pinterest Queue] Tentative ${nextAttempts}/${publicTask.maxAttempts} echouee pour ${publicTask.id}:`,
          error.message
        );
      }

      return { success: false, error: error.message, attempts: nextAttempts };
    }
  },

  /**
   * Mettre a jour les pins de la recette dans la base de donnees.
   */
  async updateRecettePins(recetteId, pinId, task) {
    try {
      const recette = await strapi.entityService.findOne('api::recette.recette', recetteId, {
        fields: ['pinterestPins', 'pinterestPinId'],
      });

      let pins = recette.pinterestPins || {};
      if (typeof pins === 'string') {
        try {
          pins = JSON.parse(pins);
        } catch {
          pins = {};
        }
      }

      pins[pinId] = {
        imageUrl: task.imageUrl,
        pinIndex: task.pinIndex,
        boardId: task.boardId,
        source: task.source || null,
        strategyScore: task.strategyScore || null,
        createdAt: new Date().toISOString(),
      };

      await strapi.entityService.update('api::recette.recette', recetteId, {
        data: {
          pinterestPins: pins,
          pinterestPinId: recette.pinterestPinId || pinId,
        },
      });
    } catch (error) {
      strapi.log.error(`[Pinterest Queue] Erreur lors de la mise a jour des pins pour recette ${recetteId}:`, error);
    }
  },

  async findTaskByUid(taskId) {
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      filters: { taskUid: taskId },
      limit: 1,
    });

    return tasks && tasks.length > 0 ? tasks[0] : null;
  },

  /**
   * Retirer une tache de la queue.
   */
  async removeTask(taskId) {
    const task = await this.findTaskByUid(taskId);
    if (!task) return false;

    await strapi.entityService.delete(QUEUE_UID, task.id);
    return true;
  },

  /**
   * Annuler une tache specifique.
   */
  async cancelTask(taskId) {
    const task = await this.findTaskByUid(taskId);
    if (!task) {
      throw new Error(`Tache ${taskId} non trouvee dans la queue`);
    }

    await strapi.entityService.delete(QUEUE_UID, task.id);
    strapi.log.info(`[Pinterest Queue] Tache ${taskId} annulee (recette ${task.recetteId}, pin #${task.pinIndex})`);

    return { success: true, taskId, message: 'Tache annulee avec succes' };
  },

  /**
   * Recuperer toutes les taches en attente.
   */
  async getAllTasks() {
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      sort: { scheduledTime: 'asc' },
      limit: 500,
    });

    return tasks.map(toPublicTask);
  },

  /**
   * Nettoyer les taches expirees ou echouees.
   */
  async cleanup() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      filters: {
        scheduledTime: {
          $lt: oneDayAgo,
        },
      },
      limit: 500,
    });

    let removed = 0;
    for (const task of tasks) {
      if ((task.attempts || 0) >= (task.maxAttempts || 3)) {
        await strapi.entityService.delete(QUEUE_UID, task.id);
        removed += 1;
      }
    }

    if (removed > 0) {
      strapi.log.info(`[Pinterest Queue] ${removed} tache(s) expiree(s) nettoyee(s)`);
    }
  },
});
