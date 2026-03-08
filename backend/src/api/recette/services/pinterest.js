'use strict';

/**
 * Pinterest service
 */

const axios = require('axios');
const { getPinterestAuth } = require('../../../utils/pinterestAuthStore');

module.exports = ({ strapi }) => ({
  /**
   * Créer un pin Pinterest pour une recette
   */
  async createPin(recette) {
    // Priorité: token OAuth utilisateur (démo) > token statique (fallback)
    // Objectif demandé: utiliser le token OAuth issu du callback.
    const oauthAccessToken = getPinterestAuth()?.accessToken;
    const accessToken = oauthAccessToken || process.env.PINTEREST_ACCESS_TOKEN;
    const boardId = process.env.PINTEREST_BOARD_ID;

    if (!accessToken || !boardId) {
      throw new Error(
        oauthAccessToken
          ? 'Pinterest board ID manquant (PINTEREST_BOARD_ID)'
          : 'Token Pinterest manquant. Connectez d’abord Pinterest (OAuth) ou configurez PINTEREST_ACCESS_TOKEN + PINTEREST_BOARD_ID'
      );
    }

    // Normaliser les données (Strapi peut retourner avec ou sans attributes)
    const recetteData = recette.attributes || recette;
    const imagePrincipale = recetteData.imagePrincipale?.data || recetteData.imagePrincipale;

    // Récupérer l'image principale
    const imageUrl = await this.getImageUrl(imagePrincipale);

    if (!imageUrl) {
      throw new Error('Aucune image principale trouvée pour la recette');
    }

    // Créer le titre et la description pour Pinterest
    const pinTitle = recetteData.metaTitle || recetteData.titre;
    const pinDescription = recetteData.metaDescription || recetteData.description;

    // URL de la recette sur le frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const recipeUrl = `${frontendUrl}/recettes/${recetteData.slug}`;

    try {
      // Pinterest API v5 (prod): https://api.pinterest.com/v5/pins
      // Note: le champ demandé "media_source.image_url" correspond en pratique à:
      // media_source = { source_type: "image_url", url: "https://..." }
      const response = await axios.post(
        'https://api.pinterest.com/v5/pins',
        {
          board_id: boardId,
          title: pinTitle.substring(0, 100), // Pinterest limite à 100 caractères
          description: pinDescription.substring(0, 800), // Pinterest limite à 800 caractères
          link: recipeUrl,
          media_source: {
            source_type: 'image_url',
            url: imageUrl,
          },
          alt_text: pinTitle,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 20_000,
        }
      );

      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      strapi.log.error('Erreur lors de la création du pin Pinterest:', {
        message: error?.message,
        status,
        data,
      });
      throw new Error(
        `Erreur Pinterest API (${status || 'unknown'}): ${data ? JSON.stringify(data) : error?.message}`
      );
    }
  },

  /**
   * Récupérer l'URL de l'image depuis Strapi
   */
  async getImageUrl(imageData) {
    if (!imageData) {
      return null;
    }

    // Gérer différents formats de données Strapi
    const imageId = imageData.id || imageData;
    
    if (!imageId) {
      return null;
    }

    try {
      // Récupérer l'image depuis Strapi
      const image = await strapi.entityService.findOne('plugin::upload.file', imageId, {
        populate: '*',
      });

      if (!image) {
        return null;
      }

      // Construire l'URL complète
      // En production, utiliser l'URL publique de l'API Strapi (accessible depuis l'extérieur)
      // Priorité: PUBLIC_STRAPI_URL > PUBLIC_URL > STRAPI_PUBLIC_URL > fallback localhost
      const baseUrl = process.env.PUBLIC_STRAPI_URL || 
                      process.env.PUBLIC_URL || 
                      process.env.STRAPI_PUBLIC_URL ||
                      (process.env.NEXT_PUBLIC_STRAPI_URL && typeof process.env.NEXT_PUBLIC_STRAPI_URL !== 'undefined' ? process.env.NEXT_PUBLIC_STRAPI_URL : null) ||
                      `http://localhost:${process.env.PORT || 1337}`;
      
      const imageUrl = image.url || image.attributes?.url;
      
      if (!imageUrl) {
        return null;
      }

      // Si l'URL est déjà complète, la retourner telle quelle
      if (imageUrl.startsWith('http')) {
        return imageUrl;
      }

      // Construire l'URL complète avec le baseUrl
      const fullUrl = `${baseUrl}${imageUrl}`;
      strapi.log.info(`🔵 URL image construite pour Pinterest: ${fullUrl}`);
      
      return fullUrl;
    } catch (error) {
      strapi.log.error('Erreur lors de la récupération de l\'image:', error);
      return null;
    }
  },
});

