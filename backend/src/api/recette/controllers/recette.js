'use strict';

/**
 * recette controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Trouver ou créer un tag par nom et retourner son ID
 */
async function findOrCreateTag(strapi, tagName) {
  if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
    return null;
  }

  const trimmedName = tagName.trim();

  try {
    // Chercher un tag existant par nom
    const existingTags = await strapi.entityService.findMany('api::tag.tag', {
      filters: { nom: { $eq: trimmedName } },
      limit: 1,
    });

    if (existingTags && existingTags.length > 0) {
      // Si le tag existe mais n'est pas publié, le publier
      const existingTag = existingTags[0];
      if (!existingTag.publishedAt) {
        await strapi.entityService.update('api::tag.tag', existingTag.id, {
          data: { publishedAt: new Date().toISOString() },
        });
      }
      return existingTag.id;
    }

    // Créer un nouveau tag (sera automatiquement publié par le lifecycle)
    const newTag = await strapi.entityService.create('api::tag.tag', {
      data: {
        nom: trimmedName,
        publishedAt: new Date().toISOString(), // Sera géré par le lifecycle
      },
    });

    strapi.log.info(`Tag "${trimmedName}" créé automatiquement depuis une recette`);
    return newTag.id;
  } catch (error) {
    strapi.log.error(`Erreur lors de la recherche/création du tag "${trimmedName}":`, error);
    return null;
  }
}

/**
 * Traiter les tags pour convertir les noms en IDs et créer les tags manquants
 */
async function processTags(strapi, tags) {
  if (!tags || !Array.isArray(tags)) {
    return tags;
  }

  const processedTags = [];

  for (const tag of tags) {
    // Si c'est déjà un ID numérique
    if (typeof tag === 'number') {
      processedTags.push(tag);
    }
    // Si c'est un objet avec un ID
    else if (tag && typeof tag === 'object' && tag.id) {
      processedTags.push(tag.id);
    }
    // Si c'est un objet avec un nom (création automatique)
    else if (tag && typeof tag === 'object' && tag.nom) {
      const tagId = await findOrCreateTag(strapi, tag.nom);
      if (tagId) {
        processedTags.push(tagId);
      }
    }
    // Si c'est une chaîne de caractères (nom du tag)
    else if (typeof tag === 'string') {
      const tagId = await findOrCreateTag(strapi, tag);
      if (tagId) {
        processedTags.push(tagId);
      }
    }
  }

  return processedTags.length > 0 ? processedTags : undefined;
}

module.exports = createCoreController('api::recette.recette', ({ strapi }) => ({
  /**
   * Créer une recette et optionnellement publier sur Pinterest
   */
  async create(ctx) {
    const { data, meta } = ctx.request.body;
    
    // Traiter les tags pour créer automatiquement ceux qui n'existent pas
    // Gérer les différents formats : data.tags, meta.connect, meta.set
    if (data.tags) {
      data.tags = await processTags(strapi, data.tags);
    }
    
    // Gérer meta.connect pour les relations (format admin Strapi)
    if (meta && meta.connect && meta.connect.tags) {
      meta.connect.tags = await processTags(strapi, meta.connect.tags);
    }
    
    // Gérer meta.set pour remplacer toutes les relations (format admin Strapi)
    if (meta && meta.set && meta.set.tags) {
      meta.set.tags = await processTags(strapi, meta.set.tags);
    }
    
    // Vérifier si Pinterest auto-publish est activé
    const publishToPinterest = data.pinterestAutoPublish === true && data.publishedAt;

    const response = await super.create(ctx);

    // Publier sur Pinterest si demandé
    if (publishToPinterest && response.data) {
      try {
        const pinterestService = strapi.service('api::recette.pinterest');
        const pinData = await pinterestService.createPin(response.data);
        
        // Mettre à jour la recette avec le Pin ID
        await strapi.entityService.update('api::recette.recette', response.data.id, {
          data: {
            pinterestPinId: pinData.id,
          },
        });

        response.data.pinterestPinId = pinData.id;
      } catch (error) {
        strapi.log.error('Erreur lors de la publication Pinterest:', error);
        // Ne pas faire échouer la création de la recette si Pinterest échoue
      }
    }

    return response;
  },

  /**
   * Mettre à jour une recette
   */
  async update(ctx) {
    const { data, meta } = ctx.request.body;
    
    // Traiter les tags pour créer automatiquement ceux qui n'existent pas
    // Gérer les différents formats : data.tags, meta.connect, meta.set
    if (data.tags !== undefined) {
      data.tags = await processTags(strapi, data.tags);
    }
    
    // Gérer meta.connect pour les relations (format admin Strapi)
    if (meta && meta.connect && meta.connect.tags) {
      meta.connect.tags = await processTags(strapi, meta.connect.tags);
    }
    
    // Gérer meta.set pour remplacer toutes les relations (format admin Strapi)
    if (meta && meta.set && meta.set.tags) {
      meta.set.tags = await processTags(strapi, meta.set.tags);
    }

    const response = await super.update(ctx);
    return response;
  },

  /**
   * Publier manuellement une recette sur Pinterest
   */
  async publishToPinterest(ctx) {
    // Vérifier l'authentification via token API
    const authHeader = ctx.request.header.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Token d\'authentification requis');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return ctx.unauthorized('Token d\'authentification invalide');
    }

    // Valider le token API
    try {
      const crypto = require('crypto');
      const apiTokenSalt = process.env.API_TOKEN_SALT || strapi.config.get('admin.apiToken.salt');
      
      if (!apiTokenSalt) {
        strapi.log.error('API_TOKEN_SALT n\'est pas configuré dans les variables d\'environnement');
        return ctx.internalServerError('Configuration d\'authentification manquante');
      }

      strapi.log.info(`Validation du token API. Token fourni (premiers 20 caractères): ${token.substring(0, 20)}...`);

      // Récupérer tous les tokens API
      const allTokens = await strapi.db.query('admin::api-token').findMany();
      strapi.log.debug(`Nombre de tokens API trouvés dans la base: ${allTokens.length}`);
      
      // Dans Strapi 4, le token doit être hashé avec le salt
      // Le token fourni peut être soit le token complet (strapi_api_token_xxx) soit juste la partie après le préfixe
      // Essayons les deux méthodes : hash du token complet et hash de la partie après le préfixe
      
      let matchingToken = null;
      
      // Méthode 1 : Hasher le token tel quel (avec préfixe si présent)
      const tokenHash1 = crypto.createHmac('sha256', apiTokenSalt).update(token).digest('hex');
      
      // Méthode 2 : Si le token commence par "strapi_api_token_", essayer aussi sans le préfixe
      let tokenHash2 = null;
      if (token.startsWith('strapi_api_token_')) {
        const tokenWithoutPrefix = token.replace('strapi_api_token_', '');
        tokenHash2 = crypto.createHmac('sha256', apiTokenSalt).update(tokenWithoutPrefix).digest('hex');
      }
      
      // Chercher un token correspondant
      for (const storedToken of allTokens) {
        // Vérifier avec le hash complet du token
        if (storedToken.accessKey === tokenHash1) {
          matchingToken = storedToken;
          strapi.log.debug(`Token trouvé avec méthode 1 (hash complet). Token ID: ${storedToken.id}, Name: ${storedToken.name}`);
          break;
        }
        
        // Vérifier avec le hash sans préfixe si applicable
        if (tokenHash2 && storedToken.accessKey === tokenHash2) {
          matchingToken = storedToken;
          strapi.log.debug(`Token trouvé avec méthode 2 (hash sans préfixe). Token ID: ${storedToken.id}, Name: ${storedToken.name}`);
          break;
        }
      }
      
      // Si aucun token n'a été trouvé, essayer de comparer directement avec les accessKeys stockés
      // (au cas où Strapi stockerait le token de manière différente)
      if (!matchingToken && allTokens.length > 0) {
        strapi.log.debug('Aucun token trouvé avec les méthodes de hashage. Vérification des accessKeys stockés...');
        for (const storedToken of allTokens) {
          strapi.log.debug(`Token stocké - ID: ${storedToken.id}, Name: ${storedToken.name}, AccessKey (premiers 20): ${storedToken.accessKey?.substring(0, 20)}...`);
        }
      }

      if (!matchingToken) {
        strapi.log.warn(`Tentative d'accès avec un token API invalide. Token hash 1: ${tokenHash1.substring(0, 20)}..., Token hash 2: ${tokenHash2 ? tokenHash2.substring(0, 20) + '...' : 'N/A'}`);
        return ctx.unauthorized('Token d\'authentification invalide ou expiré. Veuillez créer un token API dans Strapi (Settings > API Tokens) et vérifier que STRAPI_API_TOKEN est configuré dans le frontend.');
      }
      
      // Vérifier l'expiration
      if (matchingToken.expiresAt && new Date(matchingToken.expiresAt) < new Date()) {
        strapi.log.warn(`Token API expiré: ${matchingToken.name} (ID: ${matchingToken.id})`);
        return ctx.unauthorized('Token d\'authentification expiré. Veuillez créer un nouveau token API.');
      }

      // Mettre à jour la date de dernière utilisation
      await strapi.db.query('admin::api-token').update({
        where: { id: matchingToken.id },
        data: { lastUsedAt: new Date() },
      });
      
      strapi.log.debug(`Token API valide utilisé: ${matchingToken.name || matchingToken.id}`);
    } catch (error) {
      strapi.log.error('Erreur lors de la vérification du token API:', error);
      return ctx.unauthorized('Erreur lors de la vérification de l\'authentification');
    }

    const { id } = ctx.params;

    const recette = await strapi.entityService.findOne('api::recette.recette', id, {
      populate: ['imagePrincipale'],
    });

    if (!recette) {
      return ctx.notFound('Recette non trouvée');
    }

    try {
      const pinterestService = strapi.service('api::recette.pinterest');
      const pinData = await pinterestService.createPin(recette);

      // Mettre à jour la recette avec le Pin ID
      const updatedRecette = await strapi.entityService.update('api::recette.recette', id, {
        data: {
          pinterestPinId: pinData.id,
        },
      });

      return ctx.send({
        data: updatedRecette,
        pin: pinData,
        message: 'Pin Pinterest créé avec succès',
      });
    } catch (error) {
      strapi.log.error('Erreur publication Pinterest:', error);
      return ctx.badRequest('Erreur lors de la publication Pinterest', { 
        error: error.message 
      });
    }
  },
}));
