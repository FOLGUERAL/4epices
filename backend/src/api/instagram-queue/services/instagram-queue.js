'use strict';

const QUEUE_UID = 'api::instagram-queue.instagram-queue';

function toPublicTask(task) {
  if (!task) return null;
  return {
    id: task.taskUid,
    dbId: task.id,
    recetteId: task.recetteId,
    recetteTitle: task.recetteTitle || null,
    recetteSlug: task.recetteSlug || null,
    imageUrl: task.imageUrl,
    scheduledTime: task.scheduledTime,
    attempts: task.attempts || 0,
    maxAttempts: task.maxAttempts || 3,
    source: task.source || 'instagram-stock',
    strategyScore: task.strategyScore || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastError: task.lastError || null,
  };
}

module.exports = ({ strapi }) => ({
  async addPostTask(task) {
    const taskId = `instagram_${task.recetteId}_${Date.now()}`;
    const createdTask = await strapi.entityService.create(QUEUE_UID, {
      data: {
        taskUid: taskId,
        recetteId: task.recetteId,
        recetteTitle: task.recetteTitle || null,
        recetteSlug: task.recetteSlug || null,
        imageUrl: task.imageUrl,
        scheduledTime: task.scheduledTime,
        attempts: 0,
        maxAttempts: task.maxAttempts || 3,
        source: task.source || 'instagram-stock',
        strategyScore: task.strategyScore || null,
        lastError: null,
      },
    });

    strapi.log.info(`[Instagram Queue] Tache ajoutee: ${taskId} (${task.scheduledTime})`);
    return toPublicTask(createdTask);
  },

  async getReadyTasks() {
    const now = new Date().toISOString();
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      filters: {
        scheduledTime: { $lte: now },
        $or: [{ attempts: { $null: true } }, { attempts: { $lt: 3 } }],
      },
      sort: { scheduledTime: 'asc' },
      limit: 100,
    });

    return tasks
      .filter((task) => (task.attempts || 0) < (task.maxAttempts || 3))
      .map(toPublicTask);
  },

  async processTask(task) {
    const dbTask = await this.findTaskByUid(task.id);
    if (!dbTask) {
      return { success: false, error: `Tache ${task.id} non trouvee`, attempts: task.attempts || 0 };
    }

    const publicTask = toPublicTask(dbTask);

    try {
      const recette = await strapi.entityService.findOne('api::recette.recette', publicTask.recetteId, {
        populate: ['imagePrincipale', 'imagesInstagram', 'imagesPinterest', 'categories'],
      });

      if (!recette) throw new Error(`Recette ${publicTask.recetteId} non trouvee`);

      const instagramService = strapi.service('api::recette.instagram');
      const postData = await instagramService.publishFeedImage(recette, {
        imageUrl: publicTask.imageUrl,
        source: publicTask.source,
        strategyScore: publicTask.strategyScore,
      });

      await this.removeTask(publicTask.id);
      return { success: true, postData };
    } catch (error) {
      const nextAttempts = (publicTask.attempts || 0) + 1;

      if (nextAttempts >= publicTask.maxAttempts) {
        await this.removeTask(publicTask.id);
        strapi.log.error(`[Instagram Queue] Tache ${publicTask.id} echouee definitivement:`, error.message);
      } else {
        await strapi.entityService.update(QUEUE_UID, dbTask.id, {
          data: {
            attempts: nextAttempts,
            lastError: error.message,
          },
        });
      }

      return { success: false, error: error.message, attempts: nextAttempts };
    }
  },

  async findTaskByUid(taskId) {
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      filters: { taskUid: taskId },
      limit: 1,
    });
    return tasks && tasks.length > 0 ? tasks[0] : null;
  },

  async removeTask(taskId) {
    const task = await this.findTaskByUid(taskId);
    if (!task) return false;
    await strapi.entityService.delete(QUEUE_UID, task.id);
    return true;
  },

  async cancelTask(taskId) {
    const task = await this.findTaskByUid(taskId);
    if (!task) throw new Error(`Tache ${taskId} non trouvee`);
    await strapi.entityService.delete(QUEUE_UID, task.id);
    return { success: true, message: 'Publication Instagram annulee' };
  },

  async getAllTasks() {
    const tasks = await strapi.entityService.findMany(QUEUE_UID, {
      sort: { scheduledTime: 'asc' },
      limit: 500,
    });
    return tasks.map(toPublicTask);
  },

  async cleanup() {
    return { removed: 0 };
  },
});
