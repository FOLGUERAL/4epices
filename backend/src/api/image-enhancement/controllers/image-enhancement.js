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
    const { files } = ctx.request;
    
    if (!files || !files.file) {
      return ctx.badRequest('Aucun fichier image fourni');
    }

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    
    if (!file) {
      return ctx.badRequest('Fichier invalide');
    }

    // Vérifier que c'est une image
    if (!file.mime || !file.mime.startsWith('image/')) {
      return ctx.badRequest('Le fichier doit être une image');
    }

    const generateEnhanced = ctx.request.body?.generateEnhanced === 'true' || 
                            ctx.request.body?.generateEnhanced === true;

    try {
      const imageEnhancementService = strapi.service('api::image-enhancement.image-enhancement');
      
      // Lire le fichier
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(file.path);
      
      // Retoucher l'image
      const result = await imageEnhancementService.enhanceImage(
        imageBuffer,
        file.mime,
        generateEnhanced
      );

      // Nettoyer le fichier temporaire
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkError) {
        strapi.log.warn('Erreur lors de la suppression du fichier temporaire:', unlinkError);
      }

      return ctx.send({
        success: true,
        ...result,
      });
    } catch (error) {
      // Nettoyer le fichier temporaire en cas d'erreur
      try {
        const fs = require('fs');
        fs.unlinkSync(file.path);
      } catch (unlinkError) {
        // Ignorer l'erreur de nettoyage
      }

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
