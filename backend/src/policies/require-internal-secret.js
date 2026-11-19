'use strict';

const crypto = require('crypto');

/**
 * Policy globale : réserve une route aux appels serveur -> serveur du frontend Next
 * (routes proxy /api/... déjà protégées par la session admin).
 *
 * Le frontend envoie l'en-tête `x-internal-secret` = INTERNAL_API_SECRET (voir frontend/lib/backend-auth.ts).
 * Fail-closed : sans INTERNAL_API_SECRET configuré dans backend/.env, la route est refusée.
 *
 * Usage dans un fichier de routes : config: { auth: false, policies: ['global::require-internal-secret'] }
 */
module.exports = (policyContext, config, { strapi }) => {
  const expected = (process.env.INTERNAL_API_SECRET || '').trim();
  if (!expected) {
    strapi.log.error('[Security] INTERNAL_API_SECRET non configure : route admin refusee');
    return false;
  }

  const provided = policyContext.request.headers['x-internal-secret'];
  if (typeof provided !== 'string' || provided === '') return false;

  // Comparaison à temps constant sur des empreintes de même longueur
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};
