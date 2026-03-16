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
    // Priorité pour l'admin: token du .env d'abord, puis OAuth en fallback
    // Cela simplifie l'utilisation : il suffit de configurer PINTEREST_ACCESS_TOKEN dans .env
    const oauthAccessToken = getPinterestAuth()?.accessToken;
    const accessToken = process.env.PINTEREST_ACCESS_TOKEN || oauthAccessToken;

    if (!accessToken) {
      throw new Error('Token Pinterest manquant. Configurez PINTEREST_ACCESS_TOKEN dans .env ou connectez-vous via OAuth');
    }

    // Note: Les scopes requis sont : pins:read, pins:write, boards:read, boards:write, user_accounts:read
    // Si vous obtenez une erreur 401 avec "Missing: ['boards:write', 'pins:write']",
    // votre token n'a pas les bonnes permissions. Voir PINTEREST_TOKEN_SCOPES.md

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
      // Vérifier que l'URL de l'image est accessible publiquement
      if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
        throw new Error(
          `L'URL de l'image pointe vers localhost et n'est pas accessible depuis Pinterest.\n` +
          `URL: ${imageUrl}\n\n` +
          `Solution : Configurez PUBLIC_STRAPI_URL dans votre .env avec une URL publique (HTTPS).\n` +
          `Exemple : PUBLIC_STRAPI_URL=https://api.4epices.fr`
        );
      }

      // Récupérer l'URL de base de l'API Pinterest (sandbox ou production)
      const useSandbox = process.env.PINTEREST_USE_SANDBOX !== 'false';
      const apiBaseUrl = useSandbox 
        ? 'https://api-sandbox.pinterest.com'
        : 'https://api.pinterest.com';
      
      strapi.log.info(`[Pinterest] Création du pin #${pinIndex} avec l'image: ${imageUrl}`);
      
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

      strapi.log.info(`[Pinterest] Pin #${pinIndex} créé avec succès (ID: ${response.data?.id})`);
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      
      // Message d'erreur amélioré pour les problèmes de scopes
      let errorMessage = `Erreur Pinterest API (${status || 'unknown'}): ${data ? JSON.stringify(data) : error?.message}`;
      
      if (status === 401 && data?.message && data.message.includes('Missing:')) {
        errorMessage = `Token Pinterest sans permissions suffisantes. ${data.message}\n\n` +
          `Votre token PINTEREST_ACCESS_TOKEN n'a pas les scopes requis.\n` +
          `Scopes requis : pins:read, pins:write, boards:read, boards:write, user_accounts:read\n\n` +
          `Solution : Voir PINTEREST_TOKEN_SCOPES.md pour obtenir un token avec les bons scopes.\n` +
          `Ou utilisez OAuth qui demande automatiquement les bons scopes.`;
      } else if (status === 400 && data?.message && data.message.includes('could not fetch the image')) {
        errorMessage = `Pinterest ne peut pas récupérer l'image.\n\n` +
          `URL de l'image : ${imageUrl}\n\n` +
          `Causes possibles :\n` +
          `1. L'URL pointe vers localhost (non accessible depuis Pinterest)\n` +
          `2. L'URL n'est pas accessible publiquement\n` +
          `3. L'URL n'est pas en HTTPS (Pinterest exige HTTPS)\n` +
          `4. L'image n'existe pas à cette URL\n\n` +
          `Solution : Configurez PUBLIC_STRAPI_URL dans votre .env avec une URL publique en HTTPS.\n` +
          `Exemple : PUBLIC_STRAPI_URL=https://api.4epices.fr\n\n` +
          `Vérifiez que l'URL est accessible depuis un navigateur externe.`;
      }
      
      strapi.log.error(`[Pinterest] Erreur lors de la création du pin #${pinIndex}:`, {
        message: error?.message,
        status,
        data,
        errorMessage,
        imageUrl,
      });
      
      throw new Error(errorMessage);
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
   * Vérifier que l'image est accessible (HEAD request)
   */
  async validateImageUrl(imageUrl) {
    try {
      const response = await axios.head(imageUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500, // Accepter les codes 2xx, 3xx, 4xx mais pas 5xx
      });
      
      // Vérifier que c'est bien une image
      const contentType = response.headers['content-type'] || '';
      const isImage = contentType.startsWith('image/');
      
      if (response.status >= 200 && response.status < 300 && isImage) {
        return { valid: true, status: response.status };
      } else if (response.status === 404) {
        return { valid: false, error: 'Image introuvable (404)' };
      } else if (!isImage) {
        return { valid: false, error: `Type de contenu invalide: ${contentType}` };
      } else {
        return { valid: false, error: `Status HTTP: ${response.status}` };
      }
    } catch (error) {
      // Si c'est une erreur réseau (timeout, DNS, etc.), on considère que l'URL n'est pas accessible
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return { valid: false, error: `Image non accessible: ${error.message}` };
      }
      // Pour les autres erreurs, on log mais on continue quand même
      strapi.log.warn(`⚠️ Erreur lors de la validation de l'image ${imageUrl}:`, error.message);
      return { valid: true, warning: error.message }; // On continue quand même
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
        strapi.log.warn(`⚠️ Image introuvable dans Strapi (ID: ${imageId})`);
        return null;
      }

      // Vérifier que l'image a bien un nom et une URL
      const imageName = image.name || image.attributes?.name;
      const imageHash = image.hash || image.attributes?.hash;
      const imageExt = image.ext || image.attributes?.ext || '.png';
      let imageUrl = image.url || image.attributes?.url;
      
      // Log des informations de l'image pour debug
      strapi.log.info(`🔍 Image Strapi (ID: ${imageId}):`);
      strapi.log.info(`   - Nom: ${imageName || 'inconnu'}`);
      strapi.log.info(`   - Hash: ${imageHash || 'inconnu'}`);
      strapi.log.info(`   - Extension: ${imageExt}`);
      strapi.log.info(`   - URL brute: ${imageUrl || 'manquante'}`);
      
      if (!imageUrl) {
        strapi.log.warn(`⚠️ Image sans URL dans Strapi (ID: ${imageId}, Nom: ${imageName || 'inconnu'})`);
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
      
      let fullUrl;

      // Si l'URL est déjà complète, la nettoyer si nécessaire
      if (imageUrl.startsWith('http')) {
        // Vérifier que l'URL n'est pas localhost (non accessible depuis Pinterest)
        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
          strapi.log.warn(`⚠️ URL image pointe vers localhost (non accessible depuis Pinterest): ${imageUrl}`);
          // Essayer de construire une URL publique si disponible
          const publicBaseUrl = process.env.PUBLIC_STRAPI_URL || process.env.PUBLIC_URL || process.env.STRAPI_PUBLIC_URL;
          if (publicBaseUrl && !publicBaseUrl.includes('localhost') && !publicBaseUrl.includes('127.0.0.1')) {
            // Extraire le chemin de l'URL locale (enlever le domaine)
            const urlPath = imageUrl.replace(/^https?:\/\/[^\/]+/, '');
            fullUrl = `${publicBaseUrl}${urlPath}`;
            strapi.log.info(`🔵 URL image corrigée pour Pinterest: ${fullUrl}`);
          } else {
            fullUrl = imageUrl;
          }
        } else {
          // Nettoyer l'URL si elle contient des chemins incorrects (comme /api/pinterest/callback)
          // Cela peut arriver si l'URL a été mal construite précédemment
          if (imageUrl.includes('/api/pinterest/callback')) {
            strapi.log.warn(`⚠️ URL image contient un chemin incorrect (/api/pinterest/callback), nettoyage...`);
            // Extraire uniquement le chemin /uploads/...
            const uploadsMatch = imageUrl.match(/(\/uploads\/[^?#]+)/);
            if (uploadsMatch) {
              const cleanPath = uploadsMatch[1];
              // Construire l'URL correcte avec le baseUrl
              fullUrl = `${baseUrl}${cleanPath}`;
              strapi.log.info(`🔵 URL image nettoyée: ${fullUrl}`);
            } else {
              // Si on ne trouve pas /uploads/, essayer de construire l'URL avec le hash
              if (imageHash && imageName) {
                const cleanFileName = imageName.replace(/\.[^.]+$/, ''); // Enlever l'extension
                const fileName = `${cleanFileName}${imageExt}`;
                fullUrl = `${baseUrl}/uploads/${fileName}`;
                strapi.log.info(`🔵 URL image reconstruite avec le nom: ${fullUrl}`);
              } else {
                fullUrl = imageUrl;
              }
            }
          } else {
            fullUrl = imageUrl;
          }
        }
      } else {
        // URL relative - nettoyer si elle contient des chemins incorrects
        if (imageUrl.includes('/api/pinterest/callback')) {
          strapi.log.warn(`⚠️ URL relative contient un chemin incorrect (/api/pinterest/callback), nettoyage...`);
          // Extraire uniquement le chemin /uploads/...
          const uploadsMatch = imageUrl.match(/(\/uploads\/[^?#]+)/);
          if (uploadsMatch) {
            imageUrl = uploadsMatch[1];
          } else if (imageUrl.startsWith('/uploads/')) {
            // Déjà correct
          } else {
            // Construire le chemin avec le hash si disponible
            if (imageHash && imageName) {
              const cleanFileName = imageName.replace(/\.[^.]+$/, ''); // Enlever l'extension
              const fileName = `${cleanFileName}${imageExt}`;
              imageUrl = `/uploads/${fileName}`;
              strapi.log.info(`🔵 Chemin image reconstruit: ${imageUrl}`);
            }
          }
        }
        
        // S'assurer que l'URL commence par /uploads/
        if (!imageUrl.startsWith('/uploads/') && !imageUrl.startsWith('uploads/')) {
          // Construire le chemin correct avec le nom du fichier
          if (imageHash && imageName) {
            const cleanFileName = imageName.replace(/\.[^.]+$/, ''); // Enlever l'extension
            const fileName = `${cleanFileName}${imageExt}`;
            imageUrl = `/uploads/${fileName}`;
            strapi.log.info(`🔵 Chemin image corrigé: ${imageUrl}`);
          } else {
            strapi.log.warn(`⚠️ Impossible de construire le chemin de l'image (hash ou nom manquant)`);
          }
        }
        
        // Construire l'URL complète avec le baseUrl
        fullUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }
      
      // Vérifier que l'URL n'est pas localhost (non accessible depuis Pinterest)
      if (fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1')) {
        strapi.log.warn(`⚠️ URL image pointe vers localhost (non accessible depuis Pinterest): ${fullUrl}`);
        strapi.log.warn(`⚠️ Pinterest ne peut pas récupérer les images depuis localhost. Configurez PUBLIC_STRAPI_URL avec une URL publique (HTTPS) dans votre .env`);
      } else if (!fullUrl.startsWith('https://')) {
        strapi.log.warn(`⚠️ URL image n'est pas en HTTPS: ${fullUrl}`);
        strapi.log.warn(`⚠️ Pinterest recommande fortement HTTPS pour les images`);
      }
      
      strapi.log.info(`🔵 URL image construite pour Pinterest: ${fullUrl} (Image: ${imageName || 'sans nom'}, ID: ${imageId})`);
      
      // Valider que l'image est accessible (sauf si c'est localhost, car ça échouera de toute façon)
      if (!fullUrl.includes('localhost') && !fullUrl.includes('127.0.0.1')) {
        const validation = await this.validateImageUrl(fullUrl);
        if (!validation.valid) {
          strapi.log.error(`❌ Image non accessible: ${fullUrl} - ${validation.error}`);
          
          // Si l'image n'est pas accessible et qu'on a le hash actuel, essayer de reconstruire l'URL
          if (imageHash && imageName && validation.error?.includes('404')) {
            strapi.log.info(`🔄 Tentative de reconstruction de l'URL avec le hash actuel...`);
            // Construire le nom de fichier avec le hash actuel
            const cleanFileName = imageName.replace(/\.[^.]+$/, ''); // Enlever l'extension
            const fileName = `${cleanFileName}${imageExt}`;
            const reconstructedUrl = `${baseUrl}/uploads/${fileName}`;
            
            strapi.log.info(`🔵 URL reconstruite: ${reconstructedUrl}`);
            
            // Valider la nouvelle URL
            const newValidation = await this.validateImageUrl(reconstructedUrl);
            if (newValidation.valid) {
              strapi.log.info(`✅ Image accessible avec l'URL reconstruite: ${reconstructedUrl}`);
              return reconstructedUrl;
            } else {
              strapi.log.warn(`⚠️ URL reconstruite également inaccessible: ${reconstructedUrl} - ${newValidation.error}`);
            }
          }
          
          strapi.log.error(`❌ Cela peut arriver si l'image vient d'être modifiée dans Strapi. Vérifiez que l'image est bien sauvegardée et accessible.`);
          // On retourne quand même l'URL pour que l'erreur soit gérée par Pinterest
          // Mais on log l'avertissement
        } else {
          strapi.log.info(`✅ Image validée et accessible: ${fullUrl}`);
        }
      }
      
      return fullUrl;
    } catch (error) {
      strapi.log.error(`Erreur lors de la récupération de l'image (ID: ${imageId}):`, error);
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

