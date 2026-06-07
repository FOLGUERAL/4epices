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
      max_tokens: 2800,
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

function normalizeMetaTitle(value, fallbackTitre) {
  let s = String(value || '').trim();
  if (!s) s = String(fallbackTitre || '').trim();
  if (s.length <= 60) return s;
  return `${s.substring(0, 57)}...`;
}

function normalizeMetaDescription(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.length <= 160) return s;
  return `${s.substring(0, 157)}...`;
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
   * Génère seoEnrichi + metaTitle + metaDescription via un seul appel Groq.
   * @returns {{ seoEnrichi: object, metaTitle: string, metaDescription: string }}
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
    const tempsTotal = tempsPrep + tempsCuisson;
    const difficulte = recetteData.difficulte || 'facile';
    const personnes = recetteData.nombrePersonnes || 4;

    const prompt = `Génère du contenu SEO enrichi pour cette recette française (blog 4épices).

TITRE AFFICHÉ (H1) : ${titre}
DESCRIPTION : ${description}
INGRÉDIENTS : ${ingredientsText || 'Non fournis'}
ÉTAPES (texte) : ${etapesText || 'Non fournies'}
TEMPS PRÉPARATION (min) : ${tempsPrep}
TEMPS CUISSON (min) : ${tempsCuisson}
TEMPS TOTAL (min) : ${tempsTotal}
DIFFICULTÉ : ${difficulte}
PORTIONS : ${personnes}

RÈGLES SEO :
1. metaTitle : titre pour Google, intention de recherche (facile, rapide, maison, au four…), MAX 60 caractères. Peut reprendre le nom du plat + bénéfice ou temps si pertinent. Pas de guillemets.
2. metaDescription : 145-160 caractères, incitative, avec temps ou difficulté si connus. Pas de guillemets.
3. FAQ : 3 à 4 questions réalistes (four, air fryer, avance, conservation). Réponses courtes, basées sur la recette uniquement.
4. conseils, variantes, conservation : texte brut, 2-4 phrases chacun si pertinent.
5. ingredientPrincipal, typeCuisine, niveau (facile/moyen/difficile), motsClesSeo (5-8 mots-clés français).

JSON attendu :
{
  "metaTitle": "...",
  "metaDescription": "...",
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

    const seoEnrichi = normalizeSeoEnrichi(parsed);
    const metaTitle = normalizeMetaTitle(parsed.metaTitle, titre);
    const metaDescription = normalizeMetaDescription(parsed.metaDescription);

    strapi.log.info(
      `[SEO Enrichi] Généré pour: ${titre} (${seoEnrichi.faq.length} FAQ, meta: ${metaTitle.length}c)`
    );

    return { seoEnrichi, metaTitle, metaDescription };
  },
});
