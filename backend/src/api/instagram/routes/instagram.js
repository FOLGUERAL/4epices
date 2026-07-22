'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/instagram/status',
      handler: 'instagram.status',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/instagram/stats',
      handler: 'instagram.stats',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/instagram/queue-status',
      handler: 'instagram.queueStatus',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/instagram/process-queue',
      handler: 'instagram.processQueue',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/instagram/queue/:taskId',
      handler: 'instagram.cancelTask',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/instagram/strategy/stock',
      handler: 'instagram.planStockStrategy',
      config: { auth: false },
    },
  ],
};
