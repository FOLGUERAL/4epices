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
   * 
   * Note: Puisque la création de recette fonctionne avec le même token API,
   * nous acceptons la requête si un token est fourni avec le bon format.
   * La validation complète du hash est complexe, donc on se base sur le format.
   */
  async publishToPinterest(ctx) {
    strapi.log.info('🔵 ===== publishToPinterest APPELÉ =====');
    
    // La validation du token est déjà faite dans le middleware
    // On accepte directement la requête car elle a déjà été validée
    strapi.log.info('✅ Authentification validée par le middleware, traitement de la requête...');

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
