'use strict';

/**
 * Service de retouche d'images avec Groq Vision
 */

const axios = require('axios');

/**
 * Appeler Groq API avec vision pour analyser et améliorer une image
 */
async function enhanceImageWithGroq(imageBuffer, imageMimeType) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY non configurée');
  }

  // Convertir l'image en base64
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${imageMimeType};base64,${base64Image}`;

  // Utiliser un modèle avec vision
  // Modèles disponibles avec vision: llama-3.2-90b-vision-preview, llama-4-scout-17b-16e-instruct
  // Si le modèle vision n'est pas configuré, essayer d'utiliser le modèle Groq standard avec une approche différente
  const model = process.env.GROQ_VISION_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  
  // Vérifier si le modèle supporte la vision
  const supportsVision = model.includes('vision') || model.includes('scout');

  try {
    const prompt = `Analyse cette image culinaire et génère un prompt détaillé pour créer une version améliorée et plus attrayante. 

L'image améliorée doit :
- Avoir un meilleur éclairage et des couleurs plus vives
- Être plus appétissante et professionnelle
- Avoir une composition optimale pour les réseaux sociaux
- Mettre en valeur les aliments de manière attractive

Retourne UNIQUEMENT un JSON avec cette structure :
{
  "analysis": "Description détaillée de l'image actuelle et de ce qui peut être amélioré",
  "enhancement_prompt": "Prompt détaillé pour générer une version améliorée",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;

    // Construire les messages selon le support de la vision
    let messages;
    
    if (supportsVision) {
      // Modèle avec vision : envoyer l'image directement
      messages = [
        {
          role: 'system',
          content: 'Tu es un expert en photographie culinaire et en retouche d\'images. Tu analyses les images et génères des prompts pour créer des versions améliorées.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ];
    } else {
      // Modèle sans vision : utiliser une description textuelle
      // Note: Cette approche est moins précise mais fonctionne avec tous les modèles
      strapi.log.warn('[Image Enhancement] Le modèle configuré ne supporte pas la vision. Utilisation d\'une approche alternative.');
      
      messages = [
        {
          role: 'system',
          content: 'Tu es un expert en photographie culinaire et en retouche d\'images. Tu génères des prompts pour créer des versions améliorées d\'images culinaires.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nNote: L'image n'a pas pu être analysée directement. Génère des suggestions générales pour améliorer une image culinaire.`,
        },
      ];
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: model,
        messages: messages,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 60000, // 60 secondes pour les images
      }
    );

    const content = response.data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Aucune réponse de Groq');
    }

    // Parser le JSON
    let parsedContent;
    try {
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      parsedContent = JSON.parse(cleanedContent);
    } catch (parseError) {
      strapi.log.error('Erreur parsing JSON Groq pour retouche image:', parseError);
      strapi.log.error('Contenu reçu:', content);
      throw new Error('Réponse Groq invalide (JSON invalide)');
    }

    return parsedContent;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      const errorMessage = errorData?.error?.message || '';
      
      if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      
      strapi.log.error('Erreur Groq API pour retouche image:', {
        status,
        error: errorMessage,
        data: errorData,
      });
      
      throw new Error(errorMessage || `Erreur Groq API (${status})`);
    }
    
    throw new Error(error.message || 'Erreur lors de l\'appel à Groq');
  }
}

/**
 * Génère une image améliorée en utilisant les suggestions de Groq
 * Pour l'instant, on retourne les suggestions. 
 * Plus tard, on pourra intégrer un service de génération d'images (Replicate, Stability AI, etc.)
 */
async function generateEnhancedImage(enhancementPrompt, originalImageBuffer) {
  // TODO: Intégrer un service de génération d'images ici
  // Pour l'instant, on retourne juste les suggestions
  // Options possibles :
  // - Replicate API (Stable Diffusion)
  // - Stability AI
  // - OpenAI DALL-E (si disponible)
  
  return {
    enhanced: false,
    message: 'Génération d\'image améliorée à implémenter. Utilisez les suggestions pour retoucher manuellement.',
  };
}

module.exports = ({ strapi }) => ({
  /**
   * Retouche une image en utilisant Groq Vision
   * 
   * @param {Buffer} imageBuffer - Le buffer de l'image
   * @param {String} imageMimeType - Le type MIME de l'image (ex: image/jpeg)
   * @param {Boolean} generateEnhanced - Si true, génère aussi une image améliorée
   * @returns {Promise<Object>} { analysis, enhancement_prompt, suggestions, enhancedImage? }
   */
  async enhanceImage(imageBuffer, imageMimeType, generateEnhanced = false) {
    try {
      // Analyser l'image avec Groq Vision
      const groqResult = await enhanceImageWithGroq(imageBuffer, imageMimeType);

      let enhancedImage = null;
      if (generateEnhanced) {
        // Générer une image améliorée (à implémenter)
        enhancedImage = await generateEnhancedImage(groqResult.enhancement_prompt, imageBuffer);
      }

      return {
        ...groqResult,
        enhancedImage,
      };
    } catch (error) {
      strapi.log.error('[Image Enhancement] Erreur:', error);
      throw error;
    }
  },
});
