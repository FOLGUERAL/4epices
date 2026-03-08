'use strict';

/**
 * Stockage OAuth Pinterest (DEMO)
 * --------------------------------
 * Pour une démo vidéo, on stocke le token en mémoire.
 * - Avantage : simple, rapide
 * - Limite : perdu au redémarrage du serveur Strapi
 *
 * Si vous voulez persister en base ensuite :
 * - utilisez `strapi.store(...)` (core store) ou
 * - créez un single-type "pinterest-settings" avec champs token/user.
 */

/** @type {{ accessToken?: string, refreshToken?: string, expiresIn?: number, tokenType?: string, scope?: string, updatedAt?: string, user?: any } | null} */
let current = null;

function setPinterestAuth(next) {
  current = {
    ...(current || {}),
    ...(next || {}),
    updatedAt: new Date().toISOString(),
  };
}

function getPinterestAuth() {
  return current;
}

function clearPinterestAuth() {
  current = null;
}

module.exports = {
  setPinterestAuth,
  getPinterestAuth,
  clearPinterestAuth,
};

