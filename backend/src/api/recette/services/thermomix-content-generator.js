'use strict';

/**
 * Service de suggestion Thermomix avec Groq : pour une recette, propose si elle est adaptée
 * et, si oui, un brouillon d'étapes (vitesse/temps/température). Calqué sur
 * chef-simon-content-generator.js (même appel Groq, même structure JSON forcée). Ne persiste
 * rien : c'est une suggestion à relire et recopier à la main dans les champs Strapi, jamais
 * appliquée automatiquement (fiabilité culinaire pour un public Thermomix exigeant).
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
              'Tu es un expert culinaire Thermomix. Tu juges honnêtement si une recette se prête ' +
              "bien à une préparation au Thermomix (mixage, cuisson à température contrôlée en " +
              "remuant en continu, cuisson vapeur au Varoma) — PAS les cuissons au four, au grill, " +
              "en friture, ou qui nécessitent de saisir à feu vif. Tu retournes UNIQUEMENT du JSON " +
              "valide, sans aucun texte supplémentaire.",
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
        max_tokens: 1200,
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
   * @param {Object} recette - La recette Strapi (avec ou sans `attributes`)
   * @returns {Promise<{ compatible: boolean, raison: string, etapes: Array }>}
   */
  async suggestThermomix(recette) {
    const recetteData = recette.attributes || recette;

    const titre = recetteData.titre || 'Recette';
    const description = recetteData.description || '';
    const ingredientsPreview = Array.isArray(recetteData.ingredients)
      ? recetteData.ingredients
          .map((ing) => (typeof ing === 'string' ? ing : ing?.ingredient || ''))
          .filter(Boolean)
          .join(', ')
      : '';
    const etapesTexte = String(recetteData.etapes || '').replace(/<[^>]+>/g, ' ').trim();

    const prompt = `Analyse cette recette et juge si elle est adaptée au Thermomix.

TITRE : "${titre}"
DESCRIPTION : "${description}"
INGRÉDIENTS : ${ingredientsPreview || 'non précisé'}
ÉTAPES ACTUELLES : "${etapesTexte}"

RÈGLES IMPORTANTES :
1. Si la recette nécessite un four, un grill, une friture profonde, ou une cuisson à feu vif pour saisir/faire dorer (viande rôtie, pâtisserie cuite au four, pizza, gratin, friture) : "compatible": false.
2. Si c'est une sauce, un mijoté, une soupe/velouté, une préparation mixée, une cuisson vapeur, ou une cuisson longue à basse température en remuant : "compatible": true.
3. Si "compatible" est true, propose 3 à 8 étapes réalistes au Thermomix, avec des réglages plausibles (vitesse 0 à 10 ou "Turbo", durée, température si besoin, sens direct/inverse si pertinent). Reste prudent et réaliste : en cas de doute sur un réglage précis, propose une valeur raisonnable plutôt que d'inventer une précision fausse.
4. Donne toujours une "raison" courte (1-2 phrases) expliquant ton jugement.

Retourne UNIQUEMENT du JSON valide avec cette structure :
{
  "compatible": true ou false,
  "raison": "explication courte",
  "etapes": [
    { "description": "...", "vitesse": "ex: 4 ou Turbo", "duree": "ex: 30 sec", "temperature": "ex: 100°C (vide si pas de chauffe)", "sens": "direct ou inverse (vide si non pertinent)" }
  ]
}
Si "compatible" est false, "etapes" doit être un tableau vide.`;

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
        strapi.log.error('[Thermomix Content Generator] Erreur parsing JSON Groq:', parseError);
        strapi.log.error('Contenu reçu:', content);
        throw new Error('Réponse Groq invalide (JSON invalide)');
      }

      if (typeof parsedContent.compatible !== 'boolean') {
        throw new Error('Structure JSON incomplète (compatible manquant)');
      }

      const etapes = Array.isArray(parsedContent.etapes) ? parsedContent.etapes : [];

      strapi.log.info(`[Thermomix Content Generator] Suggestion générée pour: ${titre}`);

      return {
        compatible: parsedContent.compatible,
        raison: String(parsedContent.raison || '').trim(),
        etapes: etapes.map((e) => ({
          description: String(e.description || '').trim(),
          vitesse: String(e.vitesse || '').trim(),
          duree: String(e.duree || '').trim(),
          temperature: String(e.temperature || '').trim(),
          sens: e.sens === 'inverse' ? 'inverse' : e.sens === 'direct' ? 'direct' : '',
        })),
      };
    } catch (error) {
      strapi.log.error('[Thermomix Content Generator] Erreur:', error);
      throw error;
    }
  },
});
