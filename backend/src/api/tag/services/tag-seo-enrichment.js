'use strict';

const axios = require('axios');

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY non configurée');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un expert SEO pour le blog culinaire français 4épices. Réponds UNIQUEMENT en JSON valide.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
      max_tokens: 1200,
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

function normalizeMetaTitle(value, nom) {
  let s = String(value || '').trim();
  if (!s) s = `Recettes ${nom}`;
  if (s.length <= 60) return s;
  return `${s.substring(0, 57)}...`;
}

function normalizeMetaDescription(value, nom) {
  const fallback = `Découvrez nos recettes ${nom} : idées faciles, rapides et gourmandes sur 4épices.`;
  const s = String(value || '').trim() || fallback;
  if (s.length <= 160) return s;
  return `${s.substring(0, 157)}...`;
}

function normalizeDescription(value, nom) {
  const fallback = `Explorez nos recettes ${nom} sur 4épices : des idées faciles et gourmandes pour tous les jours.`;
  const s = String(value || '').trim() || fallback;
  if (s.length <= 500) return s;
  return `${s.substring(0, 497)}...`;
}

module.exports = ({ strapi }) => ({
  /**
   * @param {{ nom: string, slug?: string }} tag
   * @param {{ titres: string[], count: number }} recettes
   */
  async generate(tag, recettes = { titres: [], count: 0 }) {
    const nom = tag.nom || 'Tag';
    const count = recettes.count || 0;
    const exemples = (recettes.titres || []).slice(0, 8).join(', ') || 'Aucun exemple';

    const prompt = `Génère du contenu SEO pour une page hub de tag culinaire sur 4épices.

TAG : ${nom}
NOMBRE DE RECETTES : ${count}
EXEMPLES DE RECETTES : ${exemples}

RÈGLES :
1. description : 2-3 phrases (120-200 mots max), texte brut, présente le thème "${nom}" et invite à découvrir les recettes. Ton chaleureux, pas de listes à puces.
2. metaTitle : intention de recherche (recettes ${nom}, idées ${nom}…), MAX 60 caractères.
3. metaDescription : 145-160 caractères, incitative, mentionne le nombre de recettes si > 0.

JSON :
{
  "description": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;

    const content = await callGroq(prompt);
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      strapi.log.error('[Tag SEO] JSON invalide:', content?.slice(0, 300));
      throw new Error('Réponse Groq invalide (JSON)');
    }

    return {
      description: normalizeDescription(parsed.description, nom),
      metaTitle: normalizeMetaTitle(parsed.metaTitle, nom),
      metaDescription: normalizeMetaDescription(parsed.metaDescription, nom),
    };
  },
});
