'use strict';

/**
 * Route de type "admin" : montée sans le préfixe /api, protégée automatiquement par
 * l'authentification admin Strapi (aucun utilisateur public ne peut l'appeler).
 * Contrairement à /api/recettes/:id/publish-pinterest (voir src/middlewares/publish-pinterest.js),
 * on n'a pas besoin ici de vérification de token maison : c'est le mécanisme standard Strapi.
 */
module.exports = {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/generate/:id',
        handler: 'chef-simon-kit.generate',
        config: {
          policies: [],
        },
      },
    ],
  },
};
