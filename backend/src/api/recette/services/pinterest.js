'use strict';

/**
 * Pinterest service
 */

const axios = require('axios');
const { getPinterestAuth } = require('../../../utils/pinterestAuthStore');
const { getBoardIdForRecette } = require('../../../utils/pinterestBoardMapper');
const pinterestBoardHelper = require('../../../utils/pinterestBoardHelper');
const { getThreeBoardsForRecette, getBoardForPinIndex } = require('../../../utils/pinterestBoardsManager');

module.exports = ({ strapi }) => ({
  /**
   * Génère des variations de titre et description pour différents pins
   */
  generatePinContent(recetteData, pinIndex = 0) {
    const baseTitle = recetteData.metaTitle || recetteData.titre;
    const baseDescription = recetteData.metaDescription || recetteData.description;
    
    // Variations de titre selon l'index
    const titleVariations = [
      baseTitle,
      `Recette de ${baseTitle}`,
      `Comment faire ${baseTitle}`,
      `${baseTitle} facile`,
    ];
    
    const pinTitle = titleVariations[pinIndex % titleVariations.length];
    
    // Variations de description selon l'index
    const tempsPrep = recetteData.tempsPreparation || 0;
    const tempsCuisson = recetteData.tempsCuisson || 0;
    const tempsTotal = tempsPrep + tempsCuisson;
    const personnes = recetteData.nombrePersonnes || 4;
    const difficulte = recetteData.difficulte || 'facile';
    
    let pinDescription = baseDescription;
    
    // Personnaliser selon l'index
    if (pinIndex === 1 && tempsTotal > 0) {
      // Mettre l'accent sur le temps
      pinDescription = `${baseDescription} ⏱️ ${tempsTotal} min de préparation.`;
    } else if (pinIndex === 2 && personnes > 0) {
      // Mettre l'accent sur le nombre de personnes
      pinDescription = `${baseDescription} 👥 Pour ${personnes} ${personnes === 1 ? 'personne' : 'personnes'}.`;
    }
    
    // Limiter les longueurs
    return {
      title: pinTitle.substring(0, 100),
      description: pinDescription.substring(0, 800),
    };
  },

  /**
   * Récupère toutes les images disponibles pour créer des pins
   * Priorité: imagesPinterest > imagePrincipale (répétée si nécessaire)
   */
  async getImagesForPins(recetteData) {
    const images = [];
    
    // Récupérer les images Pinterest dédiées
    const imagesPinterest = recetteData.imagesPinterest?.data || recetteData.imagesPinterest || [];
    if (imagesPinterest.length > 0) {
      for (const imageData of imagesPinterest) {
        const imageUrl = await this.getImageUrl(imageData);
        if (imageUrl) {
          images.push(imageUrl);
        }
      }
    }
    
    // Si pas assez d'images, utiliser l'image principale
    const imagePrincipale = recetteData.imagePrincipale?.data || recetteData.imagePrincipale;
    if (imagePrincipale) {
      const imageUrl = await this.getImageUrl(imagePrincipale);
      if (imageUrl) {
        // Ajouter l'image principale si elle n'est pas déjà dans la liste
        if (!images.includes(imageUrl)) {
          images.push(imageUrl);
        }
        // Répéter l'image principale si nécessaire pour atteindre 3 images
        while (images.length < 3) {
          images.push(imageUrl);
        }
      }
    }
    
    return images;
  },

  /**
   * Créer un pin Pinterest à partir d'une image spécifique
   */
  async createPinFromImage(recette, imageUrl, pinIndex = 0, boardId = null) {
    // Priorité: token OAuth utilisateur (démo) > token statique (fallback)
    const oauthAccessToken = getPinterestAuth()?.accessToken;
    const accessToken = oauthAccessToken || process.env.PINTEREST_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('Token Pinterest manquant. Connectez d\'abord Pinterest (OAuth) ou configurez PINTEREST_ACCESS_TOKEN');
    }

    // Récupérer le board ID
    let finalBoardId = boardId;
    if (!finalBoardId) {
      finalBoardId = await getBoardIdForRecette(strapi, recette);
    }

    // Normaliser les données
    const recetteData = recette.attributes || recette;

    // Générer le contenu avec Groq pour tous les pins
    let pinTitle, pinDescription;
    try {
      // Utiliser Groq pour générer le contenu optimisé
      const contentGenerator = strapi.service('api::recette.pinterest-content-generator');
      const generatedContent = await contentGenerator.generateContent(recette, pinIndex);
      pinTitle = generatedContent.title;
      pinDescription = generatedContent.description;
      strapi.log.info(`[Pinterest] Contenu généré avec Groq pour pin #${pinIndex}: ${recetteData.titre}`);
    } catch (error) {
      // Fallback sur les variations manuelles en cas d'erreur (rate limit, quota, etc.)
      if (error.message === 'QUOTA_EXCEEDED' || error.message.includes('rate limit')) {
        strapi.log.warn(`[Pinterest] Rate limit/quota Groq atteint pour pin #${pinIndex}, utilisation des variations manuelles`);
      } else {
        strapi.log.warn(`[Pinterest] Erreur génération contenu Groq pour pin #${pinIndex}, utilisation des variations:`, error.message);
      }
      const content = this.generatePinContent(recetteData, pinIndex);
      pinTitle = content.title;
      pinDescription = content.description;
    }

    // URL de la recette sur le frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const recipeUrl = `${frontendUrl}/recettes/${recetteData.slug}`;

    try {
      // Récupérer l'URL de base de l'API Pinterest (sandbox ou production)
      const useSandbox = process.env.PINTEREST_USE_SANDBOX !== 'false';
      const apiBaseUrl = useSandbox 
        ? 'https://api-sandbox.pinterest.com'
        : 'https://api.pinterest.com';
      
      const response = await axios.post(
        `${apiBaseUrl}/v5/pins`,
        {
          board_id: finalBoardId,
          title: pinTitle.substring(0, 100),
          description: pinDescription.substring(0, 800),
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
      strapi.log.error(`[Pinterest] Erreur lors de la création du pin #${pinIndex}:`, {
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
   * Créer plusieurs pins Pinterest pour une recette
   * 6 pins sur 20 jours avec distribution personnalisée
   */
  async createMultiplePins(recette, options = {}) {
    const { 
      pinsCount = 6, // 6 pins par défaut
      boardId: providedBoardId = null 
    } = options;

    const recetteData = recette.attributes || recette;
    const recetteId = recette.id || recetteData.id;

    // Récupérer toutes les images disponibles
    const images = await this.getImagesForPins(recetteData);
    
    if (images.length === 0) {
      throw new Error('Aucune image disponible pour créer des pins Pinterest');
    }

    // Récupérer les 3 boards (principale, catégorie, autre/saisonnier)
    const boards = await getThreeBoardsForRecette(strapi, recette);
    strapi.log.info(`[Pinterest] Boards configurés - Principal: ${boards.boardPrincipal}, Catégorie: ${boards.boardCategorie}, Autre: ${boards.boardAutre}`);
    strapi.log.info(`[Pinterest] Distribution des pins - Pin #0,3: ${boards.boardPrincipal} | Pin #1,4: ${boards.boardCategorie} | Pin #2,5: ${boards.boardAutre}`);

    const createdPins = [];
    const errors = [];

    // Distribution en jours : 0, 1, 2, 5, 10, 20 jours
    const pinSchedule = [
      0,      // Pin #0 : Immédiat (board principal)
      1,      // Pin #1 : +1 jour (board catégorie)
      2,      // Pin #2 : +2 jours (board saisonnier)
      5,      // Pin #3 : +5 jours (board principal)
      10,     // Pin #4 : +10 jours (board catégorie)
      20,     // Pin #5 : +20 jours (board saisonnier)
    ];
    
    // Convertir les jours en millisecondes
    const scheduleMultiplier = 24 * 60 * 60 * 1000; // jours en millisecondes

    // Créer le premier pin immédiatement sur le board principal
    try {
      const imageUrl = images[0];
      const boardId = getBoardForPinIndex(boards, 0);
      const pinData = await this.createPinFromImage(recette, imageUrl, 0, boardId);
      createdPins.push({
        pinId: pinData.id,
        imageUrl,
        pinIndex: 0,
        createdAt: new Date().toISOString(),
        boardId,
      });
      strapi.log.info(`[Pinterest] Pin #0 créé pour: ${recetteData.titre} (ID: ${pinData.id}, Board: ${boardId})`);
    } catch (error) {
      errors.push({ pinIndex: 0, error: error.message });
      strapi.log.error(`[Pinterest] Erreur création pin #0:`, error);
    }

    // Planifier les autres pins dans la queue avec les dates personnalisées
    for (let i = 1; i < pinsCount; i++) {
      const imageUrl = images[i % images.length]; // Répéter les images si nécessaire
      // Calculer la date selon le planning personnalisé
      const scheduleValue = pinSchedule[i] || (i * 5); // Fallback si l'index dépasse le tableau
      const scheduledTime = new Date(Date.now() + (scheduleValue * scheduleMultiplier));
      
      // Déterminer le board selon l'index (rotation)
      const boardId = getBoardForPinIndex(boards, i);
      
      // Ajouter à la queue
      const queueService = strapi.service('api::recette.pinterest-queue');
      await queueService.addPinTask({
        recetteId,
        imageUrl,
        pinIndex: i,
        boardId,
        scheduledTime: scheduledTime.toISOString(),
      });
      
      const daysFromNow = Math.round((scheduledTime - new Date()) / (24 * 60 * 60 * 1000));
      strapi.log.info(`[Pinterest] Pin #${i} planifié pour: ${scheduledTime.toISOString()} (dans ${daysFromNow} jours, Board: ${boardId})`);
    }

    return {
      createdPins,
      scheduledPins: pinsCount - 1,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Créer un pin Pinterest pour une recette (méthode legacy - compatible)
   */
  async createPin(recette) {
    // Utiliser la nouvelle méthode avec un seul pin
    const result = await this.createMultiplePins(recette, { pinsCount: 1 });
    if (result.createdPins.length > 0) {
      return { id: result.createdPins[0].pinId };
    }
    throw new Error('Impossible de créer le pin');
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

  /**
   * Récupère le board ID depuis une URL Pinterest
   * Utile pour la configuration
   */
  async getBoardIdFromUrl(url) {
    return await pinterestBoardHelper.getBoardIdFromUrl(url);
  },

  /**
   * Liste tous les boards de l'utilisateur connecté
   * Utile pour la configuration
   */
  async listUserBoards() {
    return await pinterestBoardHelper.listUserBoards();
  },

  /**
   * Parse une URL Pinterest pour extraire username et board name
   */
  parsePinterestBoardUrl(url) {
    return pinterestBoardHelper.parsePinterestBoardUrl(url);
  },
});

