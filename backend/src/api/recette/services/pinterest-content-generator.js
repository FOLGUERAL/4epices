'use strict';

/**
 * Service de génération de contenu optimisé pour Pinterest avec Groq
 */

const axios = require('axios');

/**
 * Appeler Groq API pour générer le contenu
 */
async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY non configurée');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en marketing Pinterest pour recettes culinaires. Tu génères du contenu optimisé, engageant et accrocheur pour Pinterest. Tu retournes UNIQUEMENT du JSON valide, sans aucun texte supplémentaire.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7, // Un peu plus créatif que pour le parsing JSON
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000, // 30 secondes
      }
    );

    const content = response.data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Aucune réponse de Groq');
    }

    return content;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      const errorMessage = errorData?.error?.message || '';
      
      if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      
      throw new Error(errorMessage || `Erreur Groq API (${status})`);
    }
    
    throw new Error(error.message || 'Erreur lors de l\'appel à Groq');
  }
}

module.exports = ({ strapi }) => ({
  /**
   * Génère du contenu optimisé pour Pinterest à partir d'une recette
   * 
   * @param {Object} recette - La recette Strapi
   * @returns {Promise<Object>} { title, description, hashtags }
   */
  async generateContent(recette) {
    // Normaliser les données (Strapi peut retourner avec ou sans attributes)
    const recetteData = recette.attributes || recette;

    // Extraire les informations de la recette
    const titre = recetteData.titre || 'Recette';
    const description = recetteData.description || '';
    const tempsPrep = recetteData.tempsPreparation || 0;
    const tempsCuisson = recetteData.tempsCuisson || 0;
    const tempsTotal = tempsPrep + tempsCuisson;
    const difficulte = recetteData.difficulte || 'facile';
    const personnes = recetteData.nombrePersonnes || 4;

    // Extraire les catégories
    let categoriesList = [];
    if (recetteData.categories) {
      const categories = recetteData.categories.data || recetteData.categories;
      if (Array.isArray(categories)) {
        categoriesList = categories.map(c => {
          if (typeof c === 'object' && c.attributes) {
            return c.attributes.nom || c.attributes.slug;
          }
          if (typeof c === 'object' && c.nom) {
            return c.nom;
          }
          return String(c);
        });
      }
    }

    // Extraire les tags
    let tagsList = [];
    if (recetteData.tags) {
      const tags = recetteData.tags.data || recetteData.tags;
      if (Array.isArray(tags)) {
        tagsList = tags.map(t => {
          if (typeof t === 'object' && t.attributes) {
            return t.attributes.nom || t.attributes.slug;
          }
          if (typeof t === 'object' && t.nom) {
            return t.nom;
          }
          return String(t);
        });
      }
    }

    // Extraire quelques ingrédients principaux (pour le contexte)
    let ingredientsPreview = [];
    if (recetteData.ingredients && Array.isArray(recetteData.ingredients)) {
      ingredientsPreview = recetteData.ingredients.slice(0, 5).map(ing => {
        if (typeof ing === 'string') {
          return ing;
        }
        if (typeof ing === 'object' && ing.ingredient) {
          return ing.ingredient;
        }
        return String(ing);
      });
    }

    // Construire le prompt pour Groq
    const prompt = `Génère un contenu optimisé Pinterest pour cette recette :

TITRE : "${titre}"
DESCRIPTION : "${description}"
TEMPS PRÉPARATION : ${tempsPrep} minutes
TEMPS CUISSON : ${tempsCuisson} minutes
TEMPS TOTAL : ${tempsTotal} minutes
DIFFICULTÉ : ${difficulte}
NOMBRE DE PERSONNES : ${personnes}
CATÉGORIES : ${categoriesList.length > 0 ? categoriesList.join(', ') : 'Non spécifié'}
TAGS : ${tagsList.length > 0 ? tagsList.join(', ') : 'Non spécifié'}
INGRÉDIENTS PRINCIPAUX : ${ingredientsPreview.length > 0 ? ingredientsPreview.join(', ') : 'Non spécifié'}

RÈGLES IMPORTANTES :
1. Le titre doit être accrocheur, avec des emojis pertinents, MAX 100 caractères
2. La description doit être engageante, avec des emojis, MAX 800 caractères
3. Inclure 3-5 hashtags pertinents à la fin de la description (format #hashtag)
4. Utiliser un ton convivial et appétissant
5. Mettre en avant les points forts (rapide, facile, traditionnel, etc.)
6. Ajouter un call-to-action subtil (ex: "Cliquez pour découvrir la recette complète")

Retourne UNIQUEMENT du JSON valide avec cette structure :
{
  "title": "Titre accrocheur avec emojis, max 100 caractères",
  "description": "Description engageante avec emojis et hashtags, max 800 caractères",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;

    try {
      // Appeler Groq
      const content = await callGroq(prompt);

      // Parser le JSON
      let parsedContent;
      try {
        const cleanedContent = content
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        parsedContent = JSON.parse(cleanedContent);
      } catch (parseError) {
        strapi.log.error('Erreur parsing JSON Groq pour Pinterest:', parseError);
        strapi.log.error('Contenu reçu:', content);
        throw new Error('Réponse Groq invalide (JSON invalide)');
      }

      // Valider la structure
      if (!parsedContent.title || !parsedContent.description) {
        throw new Error('Structure JSON incomplète');
      }

      // S'assurer que les limites sont respectées
      const title = String(parsedContent.title).substring(0, 100);
      const description = String(parsedContent.description).substring(0, 800);
      const hashtags = Array.isArray(parsedContent.hashtags) 
        ? parsedContent.hashtags 
        : [];

      strapi.log.info(`[Pinterest Content Generator] Contenu généré pour: ${titre}`);

      return {
        title,
        description,
        hashtags,
      };
    } catch (error) {
      strapi.log.error('[Pinterest Content Generator] Erreur:', error);
      throw error;
    }
  },
});
