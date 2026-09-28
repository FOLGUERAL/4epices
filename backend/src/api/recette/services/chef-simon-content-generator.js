'use strict';

/**
 * Service de génération de l'intro du Kit Chef Simon avec Groq.
 *
 * Calqué sur pinterest-content-generator.js (même appel Groq, même structure JSON forcée) :
 * seul le prompt change, puisque le besoin est différent (une intro courte pour une
 * communauté de cuisine exigeante, pas un texte marketing pour réseau social).
 */

const axios = require('axios');

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY non configurée');
  }

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'system',
            content:
              "Tu es un cuisinier qui présente ses recettes à la communauté du site Chef Simon. " +
              "Tu écris une intro courte, sobre et personnelle (pas de ton marketing, pas d'emoji, pas de superlatifs creux). " +
              'Tu retournes UNIQUEMENT du JSON valide, sans aucun texte supplémentaire.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 400,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
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
      const errorMessage = error.response.data?.error?.message || '';
      if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      throw new Error(errorMessage || `Erreur Groq API (${status})`);
    }
    throw new Error(error.message || "Erreur lors de l'appel à Groq");
  }
}

module.exports = ({ strapi }) => ({
  /**
   * Génère un brouillon d'intro pour le Kit Chef Simon : 3-4 phrases, volontairement
   * différentes de la meta-description du site (déjà utilisée pour Google). Le résultat
   * reste un brouillon : il est toujours affiché éditable avant d'être copié, jamais publié tel quel.
   *
   * @param {Object} recette - La recette Strapi (avec ou sans `attributes`)
   * @returns {Promise<{ intro: string }>}
   */
  async generateIntro(recette) {
    const recetteData = recette.attributes || recette;

    const titre = recetteData.titre || 'Recette';
    const description = recetteData.description || '';
    const metaDescription = recetteData.metaDescription || '';
    const tempsPrep = recetteData.tempsPreparation || 0;
    const tempsCuisson = recetteData.tempsCuisson || 0;
    const difficulte = recetteData.difficulte || 'facile';
    const personnes = recetteData.nombrePersonnes || 4;

    const prompt = `Écris une intro courte pour présenter cette recette sur le forum de cuisine Chef Simon.

TITRE : "${titre}"
DESCRIPTION DU SITE (à ne PAS reprendre ni paraphraser de près) : "${description}"
META-DESCRIPTION GOOGLE (à ne PAS reprendre non plus) : "${metaDescription}"
TEMPS DE PRÉPARATION : ${tempsPrep} min
TEMPS DE CUISSON : ${tempsCuisson} min
DIFFICULTÉ : ${difficulte}
NOMBRE DE PERSONNES : ${personnes}

RÈGLES IMPORTANTES :
1. 3 à 4 phrases, pas plus.
2. Le texte doit être clairement différent, dans le fond et la formulation, de la description du site et de la meta-description ci-dessus : ne reprends ni les mêmes phrases ni la même accroche.
3. Ton sobre et personnel, adapté à une communauté de passionnés de cuisine exigeants (pas de ton publicitaire, pas d'emoji, pas de superlatifs vagues comme "incroyable" ou "délicieux").
4. Tu peux mentionner un détail concret (origine du plat, occasion, astuce, contexte) plutôt qu'un adjectif creux.

Retourne UNIQUEMENT du JSON valide avec cette structure :
{
  "intro": "Les 3 à 4 phrases ici, en une seule chaîne de texte"
}`;

    try {
      const content = await callGroq(prompt);

      let parsedContent;
      try {
        const cleanedContent = content
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        parsedContent = JSON.parse(cleanedContent);
      } catch (parseError) {
        strapi.log.error('[Chef Simon Content Generator] Erreur parsing JSON Groq:', parseError);
        strapi.log.error('Contenu reçu:', content);
        throw new Error('Réponse Groq invalide (JSON invalide)');
      }

      if (!parsedContent.intro) {
        throw new Error('Structure JSON incomplète (intro manquante)');
      }

      const intro = String(parsedContent.intro).trim();

      strapi.log.info(`[Chef Simon Content Generator] Intro générée pour: ${titre}`);

      return { intro };
    } catch (error) {
      strapi.log.error('[Chef Simon Content Generator] Erreur:', error);
      throw error;
    }
  },
});
