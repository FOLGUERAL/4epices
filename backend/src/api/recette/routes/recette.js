'use strict';

/**
 * recette router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::recette.recette', {
  config: {
    find: {
      middlewares: [],
    },
    findOne: {
      middlewares: [],
    },
    create: {
      middlewares: [],
    },
    update: {
      middlewares: [],
    },
    delete: {
      middlewares: [],
    },
  },
});

// Routes personnalisées
const customRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/recettes/:id/publish-pinterest',
      handler: 'recette.publishToPinterest',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

module.exports = {
  routes: [
    ...defaultRouter.routes,
    ...customRoutes.routes,
  ],
};

