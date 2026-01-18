'use strict';

/**
 * Pinterest service
 */

module.exports = ({ strapi }) => ({
  /**
   * Créer un pin Pinterest pour une recette
   */
  async createPin(recette) {
    const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
    const boardId = process.env.PINTEREST_BOARD_ID;

    if (!accessToken || !boardId) {
      throw new Error('Pinterest access token et board ID doivent être configurés');
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
      const response = await fetch('https://api-sandbox.pinterest.com/v5/pins', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          board_id: boardId,
          media_source: {
            source_type: 'image_url',
            url: imageUrl,
          },
          title: pinTitle.substring(0, 100), // Pinterest limite à 100 caractères
          description: pinDescription.substring(0, 800), // Pinterest limite à 800 caractères
          link: recipeUrl,
          alt_text: pinTitle,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Erreur Pinterest API: ${JSON.stringify(error)}`);
      }

      const pinData = await response.json();
      return pinData;
    } catch (error) {
      strapi.log.error('Erreur lors de la création du pin Pinterest:', error);
      throw error;
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

