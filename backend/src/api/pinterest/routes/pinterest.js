'use strict';

/**
 * Routes publiques Pinterest OAuth
 * Exposées sous /api grâce au préfixe Strapi.
 *
 * - GET /api/pinterest/callback : callback OAuth (Pinterest redirige ici avec ?code=...)
 * - GET /api/pinterest/me       : vérifie le token (GET /v5/user_account) et renvoie le username
 */

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
        auth: false, // pour la démo (UI admin déjà protégée côté frontend)
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
        auth: false, // Pour debug
      },
    },
  ],
};

