'use strict';

// Toutes les routes Instagram sont réservées à l'admin : appelées uniquement par les routes proxy
// Next (/api/instagram/...), qui vérifient la session admin puis envoient INTERNAL_API_SECRET.
const ADMIN_ONLY = ['global::require-internal-secret'];

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/instagram/status',
      handler: 'instagram.status',
      config: { auth: false, policies: ADMIN_ONLY },
    },
    {
      method: 'GET',
      path: '/instagram/stats',
      handler: 'instagram.stats',
      config: { auth: false, policies: ADMIN_ONLY },
    },
    {
      method: 'GET',
      path: '/instagram/queue-status',
      handler: 'instagram.queueStatus',
      config: { auth: false, policies: ADMIN_ONLY },
    },
    {
      method: 'POST',
      path: '/instagram/process-queue',
      handler: 'instagram.processQueue',
      config: { auth: false, policies: ADMIN_ONLY },
    },
    {
      method: 'POST',
      path: '/instagram/queue/:taskId/publish',
      handler: 'instagram.publishTask',
      config: { auth: false, policies: ADMIN_ONLY },
    },
    {
      method: 'DELETE',
      path: '/instagram/queue/:taskId',
      handler: 'instagram.cancelTask',
      config: { auth: false, policies: ADMIN_ONLY },
    },
    {
      method: 'POST',
      path: '/instagram/strategy/stock',
      handler: 'instagram.planStockStrategy',
      config: { auth: false, policies: ADMIN_ONLY },
    },
  ],
};
