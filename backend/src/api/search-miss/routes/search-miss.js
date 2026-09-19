'use strict';

/**
 * search-miss router
 * Aucune permission publique : seul le token API du frontend (côté serveur) écrit et lit ces données.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::search-miss.search-miss');
