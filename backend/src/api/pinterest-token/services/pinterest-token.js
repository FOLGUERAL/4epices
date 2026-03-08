'use strict';

/**
 * Service pour gérer les tokens Pinterest par utilisateur
 */
module.exports = ({ strapi }) => ({
  /**
   * Récupérer le token Pinterest d'un utilisateur
   * @param {number|string} userId - ID de l'utilisateur Strapi
   * @param {string} sessionId - ID de session pour utilisateurs anonymes
   * @returns {Promise<Object|null>}
   */
  async getUserToken(userId, sessionId = null) {
    try {
      if (userId) {
        // Utilisateur connecté : chercher par user_id
        const token = await strapi.entityService.findMany('api::pinterest-token.pinterest-token', {
          filters: { user: userId },
          limit: 1,
        });
        return token && token.length > 0 ? token[0] : null;
      } else if (sessionId) {
        // Utilisateur anonyme : chercher par sessionId
        const token = await strapi.entityService.findMany('api::pinterest-token.pinterest-token', {
          filters: { sessionId, user: { $null: true } },
          limit: 1,
        });
        return token && token.length > 0 ? token[0] : null;
      }
      return null;
    } catch (error) {
      strapi.log.error('Erreur lors de la récupération du token Pinterest:', error);
      return null;
    }
  },

  /**
   * Sauvegarder ou mettre à jour un token Pinterest
   * @param {Object} data - { userId?, sessionId?, accessToken, refreshToken?, expiresAt?, username? }
   * @returns {Promise<Object>}
   */
  async saveUserToken(data) {
    const { userId, sessionId, accessToken, refreshToken, expiresAt, username } = data;

    // Validation : il faut au moins un userId ou sessionId
    if (!userId && !sessionId) {
      throw new Error('userId ou sessionId requis pour sauvegarder un token Pinterest');
    }

    try {
      // Chercher un token existant
      let existingToken = null;
      if (userId) {
        const tokens = await strapi.entityService.findMany('api::pinterest-token.pinterest-token', {
          filters: { user: userId },
          limit: 1,
        });
        existingToken = tokens && tokens.length > 0 ? tokens[0] : null;
      } else if (sessionId) {
        const tokens = await strapi.entityService.findMany('api::pinterest-token.pinterest-token', {
          filters: { sessionId, user: { $null: true } },
          limit: 1,
        });
        existingToken = tokens && tokens.length > 0 ? tokens[0] : null;
      }

      const tokenData = {
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: expiresAt || null,
        username: username || null,
      };

      if (userId) {
        tokenData.user = userId;
      } else if (sessionId) {
        tokenData.sessionId = sessionId;
      }

      if (existingToken) {
        // Mettre à jour
        return await strapi.entityService.update(
          'api::pinterest-token.pinterest-token',
          existingToken.id,
          { data: tokenData }
        );
      } else {
        // Créer
        return await strapi.entityService.create('api::pinterest-token.pinterest-token', {
          data: tokenData,
        });
      }
    } catch (error) {
      strapi.log.error('Erreur lors de la sauvegarde du token Pinterest:', error);
      throw error;
    }
  },

  /**
   * Supprimer le token Pinterest d'un utilisateur
   * @param {number|string} userId - ID de l'utilisateur
   * @param {string} sessionId - ID de session pour anonymes
   * @returns {Promise<boolean>}
   */
  async deleteUserToken(userId, sessionId = null) {
    try {
      if (userId) {
        const tokens = await strapi.entityService.findMany('api::pinterest-token.pinterest-token', {
          filters: { user: userId },
          limit: 1,
        });
        if (tokens && tokens.length > 0) {
          await strapi.entityService.delete('api::pinterest-token.pinterest-token', tokens[0].id);
          return true;
        }
      } else if (sessionId) {
        const tokens = await strapi.entityService.findMany('api::pinterest-token.pinterest-token', {
          filters: { sessionId, user: { $null: true } },
          limit: 1,
        });
        if (tokens && tokens.length > 0) {
          await strapi.entityService.delete('api::pinterest-token.pinterest-token', tokens[0].id);
          return true;
        }
      }
      return false;
    } catch (error) {
      strapi.log.error('Erreur lors de la suppression du token Pinterest:', error);
      return false;
    }
  },
});
