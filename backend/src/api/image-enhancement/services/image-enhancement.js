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
 * Génère une image améliorée en utilisant Hugging Face (gratuit) ou Replicate (payant)
 * Par défaut, utilise Hugging Face si disponible (gratuit)
 */
async function generateEnhancedImage(enhancementPrompt, originalImageBuffer, originalMimeType) {
  const huggingFaceToken = process.env.HUGGINGFACE_API_TOKEN;
  const replicateApiToken = process.env.REPLICATE_API_TOKEN;
  
  // Priorité: Hugging Face (gratuit) > Replicate (payant)
  // Mais si Hugging Face échoue, essayer Replicate en fallback
  if (huggingFaceToken) {
    try {
      return await generateEnhancedImageWithHuggingFace(enhancementPrompt, originalImageBuffer, originalMimeType, huggingFaceToken);
    } catch (hfError) {
      strapi.log.warn('[Image Enhancement] Hugging Face a échoué, tentative avec Replicate en fallback...');
      if (replicateApiToken) {
        try {
          return await generateEnhancedImageWithReplicate(enhancementPrompt, originalImageBuffer, originalMimeType, replicateApiToken);
        } catch (replicateError) {
          throw new Error(`Hugging Face: ${hfError.message}. Replicate: ${replicateError.message}`);
        }
      } else {
        throw hfError; // Relancer l'erreur Hugging Face si Replicate n'est pas disponible
      }
    }
  } else if (replicateApiToken) {
    return await generateEnhancedImageWithReplicate(enhancementPrompt, originalImageBuffer, originalMimeType, replicateApiToken);
  } else {
    strapi.log.warn('[Image Enhancement] Aucun service de génération configuré. HUGGINGFACE_API_TOKEN ou REPLICATE_API_TOKEN requis.');
    return {
      enhanced: false,
      message: 'Génération d\'image améliorée nécessite HUGGINGFACE_API_TOKEN (gratuit) ou REPLICATE_API_TOKEN (payant). Configurez-en un dans .env. En attendant, utilisez les suggestions pour retoucher manuellement.',
    };
  }
}

/**
 * Génère une image améliorée avec Hugging Face Inference API (GRATUIT)
 * Note: Hugging Face a des limitations et certains modèles peuvent ne pas être disponibles
 */
async function generateEnhancedImageWithHuggingFace(enhancementPrompt, originalImageBuffer, originalMimeType, apiToken) {
  try {
    const axios = require('axios');
    
    // Modèles disponibles sur Hugging Face qui fonctionnent avec l'API Inference
    // Essayer plusieurs modèles en cas d'échec
    const models = [
      process.env.HUGGINGFACE_IMAGE_MODEL, // Modèle personnalisé si configuré
      'runwayml/stable-diffusion-v1-5', // Modèle stable et populaire
      'CompVis/stable-diffusion-v1-4', // Alternative
    ].filter(Boolean);
    
    if (models.length === 0) {
      models.push('runwayml/stable-diffusion-v1-5'); // Par défaut
    }
    
    strapi.log.info('[Image Enhancement] Génération d\'image améliorée avec Hugging Face (gratuit)...');
    
    let lastError = null;
    
    // Essayer chaque modèle jusqu'à ce qu'un fonctionne
    for (const model of models) {
      try {
        strapi.log.info(`[Image Enhancement] Tentative avec le modèle: ${model}`);
        
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            inputs: enhancementPrompt,
            parameters: {
              num_inference_steps: 30,
              guidance_scale: 7.5,
            },
          },
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
            timeout: 120000, // 2 minutes
          }
        );

        // Vérifier si la réponse est une image (PNG/JPEG) ou une erreur JSON
        const contentType = response.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
          // C'est probablement une erreur JSON
          const errorText = Buffer.from(response.data).toString('utf-8');
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              lastError = new Error(`Modèle ${model}: ${errorJson.error}`);
              continue; // Essayer le modèle suivant
            }
          } catch {
            // Pas du JSON, continuer
          }
        }

        // Hugging Face retourne directement l'image en PNG
        const enhancedImageBuffer = Buffer.from(response.data);
        
        strapi.log.info(`[Image Enhancement] Image améliorée générée avec succès (Hugging Face - ${model})`);
        
        return {
          enhanced: true,
          imageBuffer: enhancedImageBuffer,
          imageUrl: null,
          mimeType: 'image/png',
          provider: 'huggingface',
        };
      } catch (modelError) {
        lastError = modelError;
        strapi.log.warn(`[Image Enhancement] Modèle ${model} a échoué, essai du suivant...`);
        continue;
      }
    }
    
    // Tous les modèles ont échoué
    throw lastError || new Error('Tous les modèles Hugging Face ont échoué');
    
  } catch (error) {
    strapi.log.error('[Image Enhancement] Erreur Hugging Face:', error);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401 || status === 403) {
        throw new Error('HUGGINGFACE_API_TOKEN invalide ou expirée');
      }
      
      if (status === 410) {
        throw new Error('Le modèle Hugging Face n\'est plus disponible (410). Essayez de configurer REPLICATE_API_TOKEN ou utilisez uniquement l\'analyse (gratuit).');
      }
      
      if (status === 503) {
        throw new Error('Le modèle Hugging Face est en cours de chargement. Réessayez dans quelques secondes.');
      }
      
      const errorMessage = typeof errorData === 'object' && errorData.error 
        ? errorData.error 
        : `Erreur Hugging Face API (${status})`;
      throw new Error(errorMessage);
    }
    
    throw new Error(error.message || 'Erreur lors de la génération d\'image avec Hugging Face');
  }
}

/**
 * Génère une image améliorée avec Replicate API (PAYANT)
 */
async function generateEnhancedImageWithReplicate(enhancementPrompt, originalImageBuffer, originalMimeType, apiToken) {

  try {
    const axios = require('axios');
    const FormData = require('form-data');
    
    // Convertir l'image en base64 data URL pour Replicate
    const base64Image = originalImageBuffer.toString('base64');
    const dataUrl = `data:${originalMimeType};base64,${base64Image}`;
    
    // Utiliser Stable Diffusion XL pour l'image-to-image
    // Format: owner/model:version ou juste version
    const modelVersion = process.env.REPLICATE_IMAGE_MODEL || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
    
    // Extraire la version (dernière partie après :)
    let version = modelVersion;
    if (modelVersion.includes(':')) {
      version = modelVersion.split(':')[1];
    }
    
    strapi.log.info('[Image Enhancement] Génération d\'image améliorée avec Replicate...');
    
    // Créer une prédiction
    const response = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: version,
        input: {
          prompt: enhancementPrompt,
          image: dataUrl,
          strength: 0.7, // Force de transformation (0.0 = identique, 1.0 = complètement différent)
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 30,
        },
      },
      {
        headers: {
          'Authorization': `Token ${replicateApiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minutes pour la génération
      }
    );

    const predictionId = response.data.id;
    strapi.log.info(`[Image Enhancement] Prédiction créée: ${predictionId}`);
    
    // Polling pour attendre la génération
    let prediction = response.data;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (60 * 5 secondes)
    
    while (prediction.status === 'starting' || prediction.status === 'processing') {
      if (attempts >= maxAttempts) {
        throw new Error('Timeout: La génération d\'image a pris trop de temps');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes
      
      const statusResponse = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${replicateApiToken}`,
          },
        }
      );
      
      prediction = statusResponse.data;
      attempts++;
      
      if (prediction.status === 'succeeded') {
        const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        
        if (!imageUrl) {
          throw new Error('Aucune image générée par Replicate');
        }
        
        // Télécharger l'image générée
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        
        const enhancedImageBuffer = Buffer.from(imageResponse.data);
        
        strapi.log.info('[Image Enhancement] Image améliorée générée avec succès');
        
        return {
          enhanced: true,
          imageBuffer: enhancedImageBuffer,
          imageUrl: imageUrl,
          mimeType: 'image/png', // Replicate génère généralement en PNG
          provider: 'replicate',
        };
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(`Génération échouée: ${prediction.error || 'Raison inconnue'}`);
      }
    }
    
    throw new Error(`Statut inattendu: ${prediction.status}`);
  } catch (error) {
    strapi.log.error('[Image Enhancement] Erreur lors de la génération d\'image:', error);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401 || status === 403) {
        throw new Error('REPLICATE_API_TOKEN invalide ou expirée');
      }
      
      throw new Error(errorData?.detail || `Erreur Replicate API (${status})`);
    }
    
    throw new Error(error.message || 'Erreur lors de la génération d\'image améliorée');
  }
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
        // Générer une image améliorée avec Replicate
        enhancedImage = await generateEnhancedImage(groqResult.enhancement_prompt, imageBuffer, imageMimeType);
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
