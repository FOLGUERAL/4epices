'use strict';

/**
 * search-miss service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::search-miss.search-miss');
