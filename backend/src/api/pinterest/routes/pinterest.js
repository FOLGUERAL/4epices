'use strict';

/**
 * Routes Pinterest, exposées sous /api grâce au préfixe Strapi.
 *
 * - Publiques : callback OAuth (Pinterest redirige ici), et status/boards/share/disconnect
 *   utilisés par le bouton de partage via des proxies Next publics.
 * - Réservées à l'admin (ADMIN_ONLY) : appelées uniquement par les routes proxy Next qui vérifient
 *   la session admin puis envoient INTERNAL_API_SECRET (voir src/policies/require-internal-secret.js).
 */

const ADMIN_ONLY = ['global::require-internal-secret'];

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/pinterest/callback',
      handler: 'pinterest.callback',
      config: {
        auth: false, // Pinterest doit pouvoir appeler ce endpoint sans auth
      },
    },
    {
      method: 'GET',
      path: '/pinterest/me',
      handler: 'pinterest.me',
      config: {
        auth: false,
        policies: ADMIN_ONLY,
      },
    },
    {
      method: 'GET',
      path: '/pinterest/status',
      handler: 'pinterest.status',
      config: {
        auth: false, // Accessible à tous (utilisateurs connectés et anonymes)
      },
    },
    {
      method: 'POST',
      path: '/pinterest/disconnect',
      handler: 'pinterest.disconnect',
      config: {
        auth: false, // Accessible à tous
      },
    },
    {
      method: 'GET',
      path: '/pinterest/boards',
      handler: 'pinterest.boards',
      config: {
        auth: false, // Accessible à tous
      },
    },
    {
      method: 'GET',
      path: '/pinterest/admin/boards',
      handler: 'pinterest.adminBoards',
      config: {
        auth: false, // Utilise le token admin
        policies: ADMIN_ONLY,
      },
    },
    {
      method: 'POST',
      path: '/pinterest/share',
      handler: 'pinterest.share',
      config: {
        auth: false, // Accessible à tous
      },
    },
    {
      method: 'POST',
      path: '/pinterest/boards',
      handler: 'pinterest.createBoard',
      config: {
        auth: false, // Accessible à tous
      },
    },
    {
      method: 'GET',
      path: '/pinterest/queue-status',
      handler: 'pinterest.queueStatus',
      config: {
        auth: false,
        policies: ADMIN_ONLY,
      },
    },
    {
      method: 'GET',
      path: '/pinterest/stats',
      handler: 'pinterest.stats',
      config: {
        auth: false,
        policies: ADMIN_ONLY,
      },
    },
    {
      method: 'POST',
      path: '/pinterest/process-queue',
      handler: 'pinterest.processQueue',
      config: {
        auth: false,
        policies: ADMIN_ONLY,
      },
    },
    {
      method: 'DELETE',
      path: '/pinterest/queue/:taskId',
      handler: 'pinterest.cancelTask',
      config: {
        auth: false,
        policies: ADMIN_ONLY,
      },
    },
    {
      method: 'POST',
      path: '/pinterest/strategy/stock',
      handler: 'pinterest.planStockStrategy',
      config: {
        auth: false,
        policies: ADMIN_ONLY,
      },
    },
  ],
};
