'use strict';

/**
 * Politique pour authentifier les requêtes via token API
 * Utilise le système d'authentification intégré de Strapi
 */
module.exports = async (policyContext, config, { strapi }) => {
  const { request } = policyContext;
  const authHeader = request.header.authorization;

  // Vérifier la présence du header Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return false;
  }

  try {
    // Utiliser le service d'authentification de Strapi pour valider le token
    // Dans Strapi 4+, on peut utiliser strapi.auth.strategies pour valider les tokens API
    const apiTokenService = strapi.service('admin::api-token');
    
    if (!apiTokenService) {
      strapi.log.warn('Service admin::api-token non disponible');
      return false;
    }

    // Récupérer tous les tokens API actifs
    const allTokens = await strapi.db.query('admin::api-token').findMany();
    
    // Vérifier si le token correspond à un token valide
    const crypto = require('crypto');
    const apiTokenSalt = process.env.API_TOKEN_SALT || strapi.config.get('admin.apiToken.salt');
    
    if (!apiTokenSalt) {
      strapi.log.error('API_TOKEN_SALT n\'est pas configuré');
      return false;
    }

    // Hasher le token fourni
    const tokenHash = crypto.createHmac('sha256', apiTokenSalt).update(token).digest('hex');
    
    // Chercher un token correspondant
    const matchingToken = allTokens.find(storedToken => {
      // Comparer le hash
      if (storedToken.accessKey !== tokenHash) {
        return false;
      }
      
      // Vérifier l'expiration
      if (storedToken.expiresAt && new Date(storedToken.expiresAt) < new Date()) {
        return false;
      }
      
      return true;
    });

    if (!matchingToken) {
      strapi.log.debug('Token API non trouvé ou invalide');
      return false;
    }

    // Mettre à jour la date de dernière utilisation
    await strapi.db.query('admin::api-token').update({
      where: { id: matchingToken.id },
      data: { lastUsedAt: new Date() },
    });

    // Ajouter les informations du token dans le contexte pour utilisation ultérieure
    policyContext.state.apiToken = matchingToken;

    return true;
  } catch (error) {
    strapi.log.error('Erreur lors de la vérification du token API:', error);
    return false;
  }
};
