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

    // Valider le token API en utilisant le système intégré de Strapi
    try {
      const crypto = require('crypto');
      const apiTokenSalt = process.env.API_TOKEN_SALT || strapi.config.get('admin.apiToken.salt');
      
      if (!apiTokenSalt) {
        strapi.log.error('API_TOKEN_SALT n\'est pas configuré dans les variables d\'environnement');
        return ctx.internalServerError('Configuration d\'authentification manquante');
      }

      strapi.log.info(`Validation du token API. Token fourni (premiers 30 caractères): ${token.substring(0, 30)}...`);

      // Récupérer tous les tokens API actifs
      const allTokens = await strapi.db.query('admin::api-token').findMany();
      strapi.log.info(`Nombre de tokens API trouvés dans la base: ${allTokens.length}`);
      
      let matchingToken = null;
      
      // Dans Strapi 4, le token est stocké avec un hash SHA256 HMAC
      // Le token complet (incluant le préfixe "strapi_api_token_") est hashé
      // Essayons plusieurs variantes pour être sûr
      
      const hashVariants = [];
      
      // Variante 1 : Hash du token complet tel quel
      hashVariants.push({
        name: 'token complet',
        hash: crypto.createHmac('sha256', apiTokenSalt).update(token).digest('hex')
      });
      
      // Variante 2 : Si le token a le préfixe, essayer sans le préfixe
      if (token.startsWith('strapi_api_token_')) {
        const tokenWithoutPrefix = token.replace('strapi_api_token_', '');
        hashVariants.push({
          name: 'token sans préfixe',
          hash: crypto.createHmac('sha256', apiTokenSalt).update(tokenWithoutPrefix).digest('hex')
        });
      }
      
      // Variante 3 : Essayer avec seulement la partie après le dernier underscore
      if (token.includes('_')) {
        const parts = token.split('_');
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1];
          hashVariants.push({
            name: 'dernière partie du token',
            hash: crypto.createHmac('sha256', apiTokenSalt).update(lastPart).digest('hex')
          });
        }
      }
      
      // Chercher un token correspondant avec toutes les variantes
      for (const storedToken of allTokens) {
        // Vérifier l'expiration d'abord
        if (storedToken.expiresAt && new Date(storedToken.expiresAt) < new Date()) {
          continue; // Token expiré, passer au suivant
        }
        
        // Comparer avec toutes les variantes de hash
        for (const variant of hashVariants) {
          if (storedToken.accessKey === variant.hash) {
            matchingToken = storedToken;
            strapi.log.info(`✅ Token trouvé avec la méthode "${variant.name}". Token ID: ${storedToken.id}, Name: ${storedToken.name}`);
            break;
          }
        }
        
        if (matchingToken) break;
      }
      
      // Logs de diagnostic si aucun token trouvé
      if (!matchingToken) {
        strapi.log.warn(`❌ Aucun token API valide trouvé.`);
        strapi.log.warn(`Token fourni (premiers 30): ${token.substring(0, 30)}...`);
        strapi.log.warn(`Nombre de tokens dans la base: ${allTokens.length}`);
        
        if (allTokens.length > 0) {
          strapi.log.warn('Tokens disponibles dans la base:');
          for (const storedToken of allTokens) {
            const isExpired = storedToken.expiresAt && new Date(storedToken.expiresAt) < new Date();
            strapi.log.warn(`  - ID: ${storedToken.id}, Name: "${storedToken.name}", Expired: ${isExpired}, AccessKey (premiers 20): ${storedToken.accessKey?.substring(0, 20)}...`);
          }
        }
        
        strapi.log.warn(`Hash généré (token complet, premiers 20): ${hashVariants[0].hash.substring(0, 20)}...`);
        
        return ctx.unauthorized('Token d\'authentification invalide ou expiré. Vérifiez les logs backend pour plus de détails.');
      }
      
      strapi.log.info(`✅ Token API valide: ${matchingToken.name} (ID: ${matchingToken.id})`);

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
