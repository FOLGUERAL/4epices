'use strict';

const axios = require('axios');

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return '';
  return ingredients
    .slice(0, 20)
    .map((ing) => {
      if (typeof ing === 'string') return ing.trim();
      if (ing && typeof ing === 'object') {
        const q = (ing.quantite || '').trim();
        const i = (ing.ingredient || '').trim();
        return q ? `${q} ${i}`.trim() : i;
      }
      return String(ing);
    })
    .filter(Boolean)
    .join(', ');
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY non configurée');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un expert SEO et rédacteur culinaire pour le blog français 4épices. Tu réponds UNIQUEMENT en JSON valide, sans texte autour. Ne invente pas de températures, durées ou techniques absentes des données fournies.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
      max_tokens: 2500,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 45_000,
    }
  );

  const content = response.data.choices[0]?.message?.content;
  if (!content) throw new Error('Aucune réponse Groq');
  return content;
}

function normalizeSeoEnrichi(raw) {
  const faq = Array.isArray(raw.faq)
    ? raw.faq
        .filter((item) => item && item.question && item.answer)
        .map((item) => ({
          question: String(item.question).trim().substring(0, 200),
          answer: String(item.answer).trim().substring(0, 600),
        }))
        .slice(0, 5)
    : [];

  const textField = (key, max = 1200) => {
    const v = raw[key];
    return typeof v === 'string' && v.trim() ? v.trim().substring(0, max) : '';
  };

  const motsClesSeo = Array.isArray(raw.motsClesSeo)
    ? raw.motsClesSeo.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
    : [];

  return {
    faq,
    conseils: textField('conseils'),
    variantes: textField('variantes'),
    conservation: textField('conservation'),
    ingredientPrincipal: textField('ingredientPrincipal', 80),
    typeCuisine: textField('typeCuisine', 80),
    niveau: textField('niveau', 40) || undefined,
    motsClesSeo,
  };
}

module.exports = ({ strapi }) => ({
  /**
   * Génère seoEnrichi (FAQ, conseils, variantes, conservation, métadonnées SEO).
   * @param {Object} recetteData - Champs recette (titre, description, ingredients, etapes, …)
   */
  async generate(recetteData) {
    const titre = recetteData.titre || 'Recette';
    const description = recetteData.description || '';
    const etapesText = stripHtml(
      typeof recetteData.etapes === 'string' ? recetteData.etapes : ''
    );
    const ingredientsText = formatIngredients(recetteData.ingredients);
    const tempsPrep = recetteData.tempsPreparation || 0;
    const tempsCuisson = recetteData.tempsCuisson || 0;
    const difficulte = recetteData.difficulte || 'facile';
    const personnes = recetteData.nombrePersonnes || 4;

    const prompt = `Génère du contenu SEO enrichi pour cette recette française.

TITRE : ${titre}
DESCRIPTION : ${description}
INGRÉDIENTS : ${ingredientsText || 'Non fournis'}
ÉTAPES (texte) : ${etapesText || 'Non fournies'}
TEMPS PRÉPARATION (min) : ${tempsPrep}
TEMPS CUISSON (min) : ${tempsCuisson}
DIFFICULTÉ : ${difficulte}
PORTIONS : ${personnes}

RÈGLES :
1. FAQ : 3 à 4 questions réalistes que les internautes posent (four, air fryer, avance, conservation, substitutions). Réponses courtes (2-4 phrases), basées UNIQUEMENT sur la recette ; si une info manque, dis-le honnêtement.
2. conseils, variantes, conservation : paragraphes en texte brut (pas de HTML), 2-4 phrases chacun si pertinent.
3. ingredientPrincipal : un ingrédient star (ex: "poulet")
4. typeCuisine : ex. "française", "italienne", "fusion"
5. niveau : reprendre la difficulté ("facile", "moyen", "difficile")
6. motsClesSeo : 5 à 8 mots-clés français pertinents (tableau de strings)

JSON attendu :
{
  "faq": [{"question": "...", "answer": "..."}],
  "conseils": "...",
  "variantes": "...",
  "conservation": "...",
  "ingredientPrincipal": "...",
  "typeCuisine": "...",
  "niveau": "...",
  "motsClesSeo": ["...", "..."]
}`;

    const content = await callGroq(prompt);
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      strapi.log.error('[SEO Enrichi] JSON invalide:', content?.slice(0, 500));
      throw new Error('Réponse Groq invalide (JSON)');
    }

    const result = normalizeSeoEnrichi(parsed);
    strapi.log.info(`[SEO Enrichi] Généré pour: ${titre} (${result.faq.length} FAQ)`);
    return result;
  },
});
