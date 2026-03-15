'use strict';

/**
 * Routes pour la retouche d'images avec Groq
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/image-enhancement/enhance',
      handler: 'image-enhancement.enhance',
      config: {
        auth: false, // Accessible à tous (peut être restreint plus tard)
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/image-enhancement/enhance-from-url',
      handler: 'image-enhancement.enhanceFromUrl',
      config: {
        auth: false, // Accessible à tous (peut être restreint plus tard)
        policies: [],
        middlewares: [],
      },
    },
  ],
};
