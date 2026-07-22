'use strict';

function parseInstagramPosts(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getPostEntries(recette) {
  const posts = parseInstagramPosts(recette.instagramPosts);
  const entries = Object.entries(posts).filter(([postId]) => Boolean(postId));

  if (entries.length === 0 && recette.instagramPostId) {
    return [[recette.instagramPostId, { createdAt: null, legacy: true }]];
  }

  return entries;
}

module.exports = {
  async status(ctx) {
    const instagramService = strapi.service('api::recette.instagram');
    const configured = instagramService.isConfigured();

    return ctx.send({
      connected: configured,
      configured,
      accountId: process.env.INSTAGRAM_USER_ID || null,
      apiVersion: process.env.INSTAGRAM_API_VERSION || 'v23.0',
      mode: 'env-token',
      message: configured
        ? 'Configuration Instagram active'
        : 'Configurez INSTAGRAM_ACCESS_TOKEN et INSTAGRAM_USER_ID',
    });
  },

  async stats(ctx) {
    try {
      const recettes = await strapi.entityService.findMany('api::recette.recette', {
        fields: ['instagramPostId', 'instagramPosts'],
        limit: 1000,
      });

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7;
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      let totalPosts = 0;
      let postsToday = 0;
      let postsThisWeek = 0;
      let recipesWithPosts = 0;

      for (const recette of recettes) {
        const entries = getPostEntries(recette);
        if (entries.length > 0) recipesWithPosts += 1;
        totalPosts += entries.length;

        for (const [, post] of entries) {
          const createdAt = post?.createdAt ? new Date(post.createdAt) : null;
          if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
          if (createdAt >= startOfToday) postsToday += 1;
          if (createdAt >= startOfWeek) postsThisWeek += 1;
        }
      }

      return ctx.send({
        totalPosts,
        postsToday,
        postsThisWeek,
        recipesWithPosts,
      });
    } catch (error) {
      strapi.log.error('[Instagram Stats] Erreur:', error);
      return ctx.internalServerError('Erreur lors de la recuperation des statistiques Instagram', {
        error: error.message,
      });
    }
  },

  async queueStatus(ctx) {
    try {
      const queueService = strapi.service('api::instagram-queue.instagram-queue');
      const allTasks = await queueService.getAllTasks();
      const readyTasks = await queueService.getReadyTasks();
      const now = new Date();

      return ctx.send({
        total: allTasks.length,
        ready: readyTasks.length,
        tasks: allTasks.map((task) => {
          const scheduledTime = new Date(task.scheduledTime);
          return {
            ...task,
            isReady: scheduledTime <= now,
            minutesUntilReady: Math.round((scheduledTime - now) / 1000 / 60),
          };
        }),
      });
    } catch (error) {
      return ctx.internalServerError('Erreur lors de la recuperation de la queue Instagram', {
        error: error.message,
      });
    }
  },

  async processQueue(ctx) {
    try {
      const queueService = strapi.service('api::instagram-queue.instagram-queue');
      const readyTasks = await queueService.getReadyTasks();
      const isCronDocker = ctx.request.headers['x-cron-source'] === 'docker';
      const logPrefix = isCronDocker ? '[Instagram Cron Docker]' : '[Instagram Manual]';

      if (readyTasks.length === 0) {
        return ctx.send({
          success: true,
          message: 'Aucune publication Instagram prete a traiter',
          processed: 0,
        });
      }

      let processed = 0;
      for (const task of readyTasks) {
        const result = await queueService.processTask(task);
        if (result.success) {
          processed += 1;
          strapi.log.info(`${logPrefix} Tache ${task.id} traitee avec succes`);
          break;
        }
        strapi.log.warn(`${logPrefix} Tache ${task.id} echouee: ${result.error}`);
      }

      await queueService.cleanup();

      return ctx.send({
        success: true,
        message: `${processed} publication(s) Instagram traitee(s)`,
        processed,
        remaining: readyTasks.length - processed,
      });
    } catch (error) {
      strapi.log.error('[Instagram Process Queue] Erreur:', error);
      return ctx.internalServerError('Erreur lors du traitement de la queue Instagram', {
        error: error.message,
      });
    }
  },

  async cancelTask(ctx) {
    const { taskId } = ctx.params;
    if (!taskId) return ctx.badRequest('taskId est requis');

    try {
      const result = await strapi.service('api::instagram-queue.instagram-queue').cancelTask(taskId);
      return ctx.send(result);
    } catch (error) {
      if (error.message.includes('non trouvee')) return ctx.notFound(error.message);
      return ctx.internalServerError('Erreur lors de l annulation de la tache Instagram', {
        error: error.message,
      });
    }
  },

  async planStockStrategy(ctx) {
    try {
      const result = await strapi
        .service('api::recette.instagram-strategy')
        .planStockCampaign(ctx.request.body || {});

      return ctx.send({
        ...result,
        message: result.dryRun
          ? `${result.plannedCount} publication(s) Instagram proposee(s)`
          : `${result.plannedCount} publication(s) ajoutee(s) a la queue Instagram`,
      });
    } catch (error) {
      strapi.log.error('[Instagram Strategy] Erreur:', error);
      return ctx.internalServerError('Erreur lors de la planification Instagram', {
        error: error.message,
      });
    }
  },
};
