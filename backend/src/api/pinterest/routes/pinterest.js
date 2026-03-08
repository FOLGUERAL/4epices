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
  ],
};

