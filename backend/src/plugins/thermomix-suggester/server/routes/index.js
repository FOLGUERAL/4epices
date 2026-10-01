'use strict';

/** Route de type "admin" : authentification admin Strapi automatique, mirroir de chef-simon-kit. */
module.exports = {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/suggest/:id',
        handler: 'thermomix-suggester.suggest',
        config: {
          policies: [],
        },
      },
    ],
  },
};
