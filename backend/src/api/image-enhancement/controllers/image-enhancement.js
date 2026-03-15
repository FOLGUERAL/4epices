'use strict';

/**
 * Controller pour la retouche d'images avec Groq
 */

module.exports = {
  /**
   * POST /api/image-enhancement/enhance
   * Reçoit une image et la retouche avec Groq Vision
   * 
   * Body (multipart/form-data):
   * - file: Le fichier image à retoucher
   * - generateEnhanced: (optionnel) Si true, génère aussi une image améliorée
   */
  async enhance(ctx) {
    // Log pour déboguer
    strapi.log.info('[Image Enhancement] Requête reçue:', {
      hasFiles: !!ctx.request.files,
      filesKeys: ctx.request.files ? Object.keys(ctx.request.files) : [],
      contentType: ctx.request.headers['content-type'],
      method: ctx.request.method,
      body: ctx.request.body ? Object.keys(ctx.request.body) : [],
    });

    // Strapi parse les fichiers multipart dans ctx.request.files
    const { files } = ctx.request;
    
    if (!files || Object.keys(files).length === 0) {
      strapi.log.warn('[Image Enhancement] Aucun fichier trouvé dans ctx.request.files');
      strapi.log.warn('[Image Enhancement] Headers:', ctx.request.headers);
      strapi.log.warn('[Image Enhancement] Body keys:', ctx.request.body ? Object.keys(ctx.request.body) : []);
      return ctx.badRequest('Aucun fichier image fourni. Assurez-vous d\'envoyer le fichier avec la clé "file" dans FormData avec Content-Type: multipart/form-data.');
    }

    // Chercher le fichier avec la clé "file"
    let file = null;
    if (files.file) {
      file = Array.isArray(files.file) ? files.file[0] : files.file;
    } else {
      // Si pas de clé "file", prendre le premier fichier disponible
      const fileKeys = Object.keys(files);
      if (fileKeys.length > 0) {
        file = Array.isArray(files[fileKeys[0]]) ? files[fileKeys[0]][0] : files[fileKeys[0]];
        strapi.log.info(`[Image Enhancement] Fichier trouvé avec la clé "${fileKeys[0]}" au lieu de "file"`);
      }
    }
    
    if (!file) {
      strapi.log.warn('[Image Enhancement] Fichier invalide après parsing');
      return ctx.badRequest('Fichier invalide. Format de fichier non reconnu.');
    }

    strapi.log.info('[Image Enhancement] Fichier reçu:', {
      name: file.name,
      size: file.size,
      mime: file.mime,
      type: file.type,
      path: file.path,
      buffer: file.buffer ? 'présent' : 'absent',
    });

    // Vérifier que c'est une image
    const mimeType = file.mime || file.type;
    if (!mimeType || !mimeType.startsWith('image/')) {
      strapi.log.warn('[Image Enhancement] Type de fichier invalide:', mimeType);
      return ctx.badRequest(`Le fichier doit être une image. Type reçu: ${mimeType || 'inconnu'}`);
    }

    const generateEnhanced = ctx.request.body?.generateEnhanced === 'true' || 
                            ctx.request.body?.generateEnhanced === true;

    try {
      const imageEnhancementService = strapi.service('api::image-enhancement.image-enhancement');
      
      // Lire le fichier - essayer buffer d'abord, puis path
      let imageBuffer;
      if (file.buffer) {
        imageBuffer = file.buffer;
      } else if (file.path) {
        const fs = require('fs');
        imageBuffer = fs.readFileSync(file.path);
      } else if (file.stream) {
        // Si c'est un stream, le convertir en buffer
        const chunks = [];
        for await (const chunk of file.stream) {
          chunks.push(chunk);
        }
        imageBuffer = Buffer.concat(chunks);
      } else {
        throw new Error('Impossible de lire le fichier. Format non supporté.');
      }
      
      // Retoucher l'image
      const result = await imageEnhancementService.enhanceImage(
        imageBuffer,
        mimeType,
        generateEnhanced
      );

      // Si une image améliorée a été générée, la sauvegarder dans Strapi
      let enhancedImageUrl = null;
      if (result.enhancedImage && result.enhancedImage.enhanced && result.enhancedImage.imageBuffer) {
        try {
          // Utiliser le plugin upload de Strapi pour sauvegarder l'image
          const uploadService = strapi.plugins.upload.services.upload;
          
          const enhancedFile = {
            name: `enhanced_${file.name || 'image.png'}`,
            type: result.enhancedImage.mimeType || 'image/png',
            size: result.enhancedImage.imageBuffer.length,
            buffer: result.enhancedImage.imageBuffer,
          };

          const uploadedFile = await uploadService.upload({
            data: {},
            files: [enhancedFile],
          });

          if (uploadedFile && uploadedFile.length > 0) {
            enhancedImageUrl = uploadedFile[0].url;
            strapi.log.info(`[Image Enhancement] Image améliorée sauvegardée: ${enhancedImageUrl}`);
          }
        } catch (uploadError) {
          strapi.log.error('[Image Enhancement] Erreur lors de la sauvegarde de l\'image améliorée:', uploadError);
          // Ne pas faire échouer la requête si l'upload échoue
        }
      }

      // Nettoyer le fichier temporaire si nécessaire
      if (file.path) {
        try {
          const fs = require('fs');
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          strapi.log.warn('Erreur lors de la suppression du fichier temporaire:', unlinkError);
        }
      }

      // Préparer la réponse
      const response = {
        success: true,
        analysis: result.analysis,
        enhancement_prompt: result.enhancement_prompt,
        suggestions: result.suggestions,
      };

      // Ajouter l'URL de l'image améliorée si disponible
      if (enhancedImageUrl) {
        response.enhanced_image_url = enhancedImageUrl;
        response.enhanced = true;
      } else if (result.enhancedImage) {
        // Si l'image n'a pas pu être sauvegardée mais qu'elle existe, retourner l'URL directe
        response.enhanced_image_url = result.enhancedImage.imageUrl;
        response.enhanced = result.enhancedImage.enhanced;
      }

      return ctx.send(response);
    } catch (error) {
      // Nettoyer le fichier temporaire en cas d'erreur
      if (file && file.path) {
        try {
          const fs = require('fs');
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          // Ignorer l'erreur de nettoyage
        }
      }

      const errorMessage = error.message || 'Erreur lors de la retouche de l\'image';
      
      if (errorMessage === 'QUOTA_EXCEEDED') {
        return ctx.tooManyRequests('Quota Groq dépassé. Veuillez réessayer plus tard.');
      }

      if (errorMessage.includes('GROQ_API_KEY')) {
        return ctx.internalServerError('Configuration Groq manquante. Configurez GROQ_API_KEY dans les variables d\'environnement.');
      }

      // Si c'est une erreur de génération d'image (pas l'analyse), on peut quand même retourner les suggestions
      if (errorMessage.includes('Hugging Face') || errorMessage.includes('Replicate') || errorMessage.includes('génération d\'image')) {
        strapi.log.warn('[Image Enhancement Controller] Erreur génération d\'image, mais l\'analyse a réussi');
        // L'erreur vient probablement de generateEnhancedImage, mais enhanceImageWithGroq a réussi
        // On devrait avoir les suggestions dans le résultat, mais si on arrive ici c'est que tout a échoué
        return ctx.internalServerError('L\'analyse a réussi mais la génération d\'image a échoué. Utilisez le bouton "Analyser seulement" pour obtenir les suggestions.', {
          error: error.message,
        });
      }

      strapi.log.error('[Image Enhancement Controller] Erreur:', error);
      strapi.log.error('[Image Enhancement Controller] Stack:', error.stack);
      
      return ctx.internalServerError(errorMessage, {
        error: error.message,
      });
    }
  },

  /**
   * POST /api/image-enhancement/enhance-from-url
   * Retouche une image depuis une URL
   * 
   * Body (JSON):
   * - imageUrl: L'URL de l'image à retoucher
   * - generateEnhanced: (optionnel) Si true, génère aussi une image améliorée
   */
  async enhanceFromUrl(ctx) {
    const { imageUrl, generateEnhanced } = ctx.request.body || {};

    if (!imageUrl || typeof imageUrl !== 'string') {
      return ctx.badRequest('imageUrl est requis');
    }

    try {
      const axios = require('axios');
      
      // Télécharger l'image depuis l'URL
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const imageBuffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';

      if (!contentType.startsWith('image/')) {
        return ctx.badRequest('L\'URL ne pointe pas vers une image valide');
      }

      const imageEnhancementService = strapi.service('api::image-enhancement.image-enhancement');
      
      // Retoucher l'image
      const result = await imageEnhancementService.enhanceImage(
        imageBuffer,
        contentType,
        generateEnhanced || false
      );

      return ctx.send({
        success: true,
        ...result,
      });
    } catch (error) {
      const errorMessage = error.message || 'Erreur lors de la retouche de l\'image';
      
      if (errorMessage === 'QUOTA_EXCEEDED') {
        return ctx.tooManyRequests('Quota Groq dépassé. Veuillez réessayer plus tard.');
      }

      if (errorMessage.includes('GROQ_API_KEY')) {
        return ctx.internalServerError('Configuration Groq manquante. Configurez GROQ_API_KEY dans les variables d\'environnement.');
      }

      strapi.log.error('[Image Enhancement Controller] Erreur:', error);
      
      return ctx.internalServerError(errorMessage, {
        error: error.message,
      });
    }
  },
};
