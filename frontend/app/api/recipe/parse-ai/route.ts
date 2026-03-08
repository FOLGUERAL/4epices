import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fonction pour obtenir la clé API OpenAI
function getOpenAIApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

// Fonction pour obtenir l'URL Ollama
function getOllamaUrl(): string {
  return process.env.OLLAMA_URL || 'http://localhost:11434';
}

// Fonction pour obtenir le modèle Ollama
function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'llama3.2:3b';
}

// Fonction pour obtenir la clé API Groq
function getGroqApiKey(): string | null {
  return process.env.GROQ_API_KEY || null;
}

// Fonction pour déterminer quel provider utiliser
function getProvider(): 'groq' | 'ollama' | 'openai' | null {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'groq';
  
  if (provider === 'groq' && getGroqApiKey()) {
    return 'groq';
  } else if (provider === 'ollama') {
    return 'ollama';
  } else if (provider === 'openai' && getOpenAIApiKey()) {
    return 'openai';
  }
  
  // Fallback : essayer Groq, puis Ollama, puis OpenAI
  if (getGroqApiKey()) return 'groq';
  if (getOllamaUrl()) return 'ollama';
  if (getOpenAIApiKey()) return 'openai';
  
  return null;
}

/**
 * Route API pour parser une recette dictée avec l'IA
 * 
 * Reçoit :
 * - text: Le texte dicté de la recette
 * 
 * Retourne :
 * - success: boolean
 * - data?: ParsedRecipe (si succès)
 * - message?: string (si erreur)
 */
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, message: 'Texte requis' },
        { status: 400 }
      );
    }

    // Déterminer le provider à utiliser
    const provider = getProvider();
    
    // Si aucun provider disponible, retourner une erreur
    if (!provider && !getOpenAIApiKey()) {
      return NextResponse.json(
        { success: false, message: 'Aucun provider IA configuré (Ollama ou OpenAI requis)' },
        { status: 500 }
      );
    }

    const prompt = `Tu es un chef cuisinier professionnel. Génère une recette COMPLÈTE au format JSON.

RÈGLES CRITIQUES :
1. Retourne UNIQUEMENT du JSON valide, rien d'autre
2. Le champ "ingredients" DOIT être un array avec MINIMUM 5 éléments
3. Le champ "etapes" DOIT être un array de strings avec MINIMUM 4 éléments
4. Si la dictée est courte, COMPLÈTE avec tes connaissances culinaires
5. Les étapes sont des strings simples, PAS de HTML

Structure JSON OBLIGATOIRE :

{
  "titre": "Nom du plat",
  "description": "Description de 2-3 phrases du plat, son origine, ses caractéristiques",
  "ingredients": [
    "500g de semoule de blé",
    "2 carottes",
    "2 courgettes",
    "1 oignon",
    "200g de viande d'agneau",
    "1 cuillère à café de curcuma",
    "1 cuillère à café de cumin",
    "sel, poivre"
  ],
  "etapes": [
    "Préparer la semoule en la mouillant légèrement et en la travaillant à la main",
    "Cuire la semoule à la vapeur dans un couscoussier pendant 20 minutes",
    "Pendant ce temps, faire revenir la viande et les légumes dans une grande casserole",
    "Ajouter les épices, le sel et le poivre, puis couvrir d'eau et laisser mijoter 30 minutes",
    "Servir la semoule avec le bouillon et les légumes"
  ],
  "tempsPreparation": 30,
  "tempsCuisson": 50,
  "nombrePersonnes": 4,
  "difficulte": "moyen",
  "categories": ["Plat principal"],
  "tags": ["traditionnel", "maghrébin"]
}

IMPORTANT : 
- "ingredients" : array avec MINIMUM 5 ingrédients, même si non mentionnés
- "etapes" : array avec MINIMUM 4 étapes détaillées, même si non mentionnées
- Utilise tes connaissances pour compléter : si on dit "couscous", génère une vraie recette de couscous avec semoule, légumes, épices, etc.

Dictée :

"""
${text.trim()}
"""`;

    // Appeler le provider approprié (Groq, Ollama ou OpenAI)
    let content: string;
    let usedProvider: 'groq' | 'ollama' | 'openai' = 'groq'; // Initialiser avec Groq par défaut

    try {
      if (provider === 'groq' || (!provider && getGroqApiKey())) {
        // Essayer Groq d'abord (gratuit et rapide)
        usedProvider = 'groq';
        content = await callGroq(prompt);
      } else if (provider === 'ollama' || (!provider && getOllamaUrl())) {
        // Essayer Ollama
        usedProvider = 'ollama';
        content = await callOllama(prompt);
      } else {
        // Utiliser OpenAI
        usedProvider = 'openai';
        content = await callOpenAI(prompt);
      }
    } catch (error: any) {
      // Fallback en cascade : Groq → Ollama → OpenAI
      console.warn(`[API /recipe/parse-ai] ${usedProvider} a échoué, tentative de fallback:`, error.message);
      
      if (usedProvider === 'groq') {
        // Essayer Ollama puis OpenAI
        if (getOllamaUrl()) {
          try {
            usedProvider = 'ollama';
            content = await callOllama(prompt);
          } catch (ollamaError: any) {
            if (getOpenAIApiKey()) {
              try {
                usedProvider = 'openai';
                content = await callOpenAI(prompt);
              } catch (openaiError: any) {
                return NextResponse.json(
                  { 
                    success: false, 
                    message: `Erreur avec tous les providers: ${openaiError.message || 'Erreur inconnue'}`,
                    errorType: 'provider_error'
                  },
                  { status: 500 }
                );
              }
            } else {
              throw ollamaError;
            }
          }
        } else if (getOpenAIApiKey()) {
          try {
            usedProvider = 'openai';
            content = await callOpenAI(prompt);
          } catch (openaiError: any) {
            throw openaiError;
          }
        } else {
          throw error;
        }
      } else if (usedProvider === 'ollama' && getOpenAIApiKey()) {
        // Ollama a échoué, essayer OpenAI
        try {
          usedProvider = 'openai';
          content = await callOpenAI(prompt);
        } catch (openaiError: any) {
          return NextResponse.json(
            { 
              success: false, 
              message: `Erreur avec Ollama et OpenAI: ${openaiError.message || 'Erreur inconnue'}`,
              errorType: 'provider_error'
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { 
            success: false, 
            message: error.message || 'Erreur lors de l\'appel à l\'IA',
            errorType: 'provider_error'
          },
          { status: 500 }
        );
      }
    }

    console.log(`[API /recipe/parse-ai] Réponse reçue de ${usedProvider}`);

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, message: 'Aucune réponse de l\'IA' },
        { status: 500 }
      );
    }

    // Parser le JSON retourné
    let parsedRecipe;
    try {
      // Nettoyer le contenu (enlever les markdown code blocks si présents)
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      parsedRecipe = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError);
      console.error('Contenu reçu:', content);
      return NextResponse.json(
        { success: false, message: 'Réponse de l\'IA invalide (JSON invalide)' },
        { status: 500 }
      );
    }

    // Valider la structure
    if (!parsedRecipe.titre || !parsedRecipe.ingredients || !parsedRecipe.etapes) {
      return NextResponse.json(
        { success: false, message: 'Structure JSON incomplète' },
        { status: 500 }
      );
    }

    // Valider et forcer un minimum d'ingrédients et d'étapes
    if (!Array.isArray(parsedRecipe.ingredients) || parsedRecipe.ingredients.length === 0) {
      console.warn('[API /recipe/parse-ai] Aucun ingrédient trouvé, génération de base...');
      // Générer des ingrédients de base selon le titre
      const titreLower = String(parsedRecipe.titre || '').toLowerCase();
      if (titreLower.includes('couscous')) {
        parsedRecipe.ingredients = [
          '500g de semoule de blé fine',
          '2 carottes',
          '2 courgettes',
          '1 oignon',
          '200g de viande d\'agneau',
          '1 cuillère à café de curcuma',
          '1 cuillère à café de cumin',
          'sel, poivre'
        ];
      } else {
        parsedRecipe.ingredients = ['Ingrédients à compléter'];
      }
    }

    if (!Array.isArray(parsedRecipe.etapes) || parsedRecipe.etapes.length === 0) {
      console.warn('[API /recipe/parse-ai] Aucune étape trouvée, génération de base...');
      const titreLower = String(parsedRecipe.titre || '').toLowerCase();
      if (titreLower.includes('couscous')) {
        parsedRecipe.etapes = [
          'Préparer la semoule en la mouillant légèrement avec de l\'eau salée',
          'Travailler la semoule à la main pour obtenir des grains séparés',
          'Cuire la semoule à la vapeur dans un couscoussier pendant 20 minutes',
          'Pendant ce temps, faire revenir la viande et les légumes dans une grande casserole',
          'Ajouter les épices, le sel et le poivre, puis couvrir d\'eau et laisser mijoter 30 minutes',
          'Servir la semoule avec le bouillon et les légumes'
        ];
      } else {
        parsedRecipe.etapes = ['Préparation de la recette à compléter'];
      }
    }

    // Normaliser les ingrédients (peuvent être strings ou objets {quantite, ingredient})
    const normalizedIngredients = parsedRecipe.ingredients.map((ing: any) => {
      if (typeof ing === 'string') {
        // Si c'est une string, la garder telle quelle (format accepté par Strapi)
        return ing;
      }
      // Si c'est un objet, le garder au format {quantite, ingredient}
      return {
        quantite: ing.quantite || ing.quantity || '',
        ingredient: ing.ingredient || ing.nom || String(ing),
      };
    });

    // Normaliser les étapes
    let normalizedEtapes: string[] = [];
    if (Array.isArray(parsedRecipe.etapes)) {
      normalizedEtapes = parsedRecipe.etapes.map((e: any) => String(e));
    } else if (typeof parsedRecipe.etapes === 'string') {
      // Si c'est une string HTML, extraire le texte ou utiliser tel quel
      // On va le traiter comme du texte brut qui sera converti en HTML plus tard
      const etapesStr = parsedRecipe.etapes.trim();
      if (etapesStr.includes('<p>') || etapesStr.includes('<strong>')) {
        // C'est du HTML, extraire le texte ou diviser par les balises
        const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
        if (tempDiv) {
          tempDiv.innerHTML = etapesStr;
          const paragraphs = tempDiv.querySelectorAll('p');
          normalizedEtapes = Array.from(paragraphs).map(p => p.textContent || '').filter(t => t.trim());
        } else {
          // Côté serveur, utiliser une regex simple pour extraire le texte
          const stepMatches = etapesStr.match(/<p><strong>Étape \d+ :<\/strong> (.+?)<\/p>/g);
          if (stepMatches) {
            normalizedEtapes = stepMatches.map(match => {
              const text = match.replace(/<[^>]+>/g, '').replace(/Étape \d+ :\s*/, '').trim();
              return text;
            });
          } else {
            // Fallback : diviser par les balises <p>
            normalizedEtapes = etapesStr.split(/<p>/).filter(s => s.trim()).map(s => {
              return s.replace(/<\/p>.*$/, '').replace(/<[^>]+>/g, '').replace(/Étape \d+ :\s*/, '').trim();
            }).filter(s => s);
          }
        }
      } else {
        // C'est du texte simple, diviser par lignes ou points
        normalizedEtapes = etapesStr.split(/\n+|\.\s+/).filter(s => s.trim()).slice(0, 10);
      }
    }
    
    // S'assurer qu'on a au moins une étape
    if (normalizedEtapes.length === 0) {
      normalizedEtapes = [String(parsedRecipe.etapes || 'Préparation de la recette')];
    }

    // Normaliser la difficulté
    const difficulte = ['facile', 'moyen', 'difficile'].includes(parsedRecipe.difficulte)
      ? parsedRecipe.difficulte
      : 'facile';

    // Normaliser les catégories (array de noms)
    const categories = Array.isArray(parsedRecipe.categories) 
      ? parsedRecipe.categories 
      : (parsedRecipe.categorie ? [parsedRecipe.categorie] : []);

    // Normaliser les tags (array de noms)
    const tags = Array.isArray(parsedRecipe.tags) ? parsedRecipe.tags : [];

    const normalizedRecipe = {
      titre: String(parsedRecipe.titre),
      description: String(parsedRecipe.description || parsedRecipe.titre),
      ingredients: normalizedIngredients,
      etapes: normalizedEtapes,
      tempsPreparation: parsedRecipe.tempsPreparation ? Number(parsedRecipe.tempsPreparation) : null,
      tempsCuisson: parsedRecipe.tempsCuisson ? Number(parsedRecipe.tempsCuisson) : null,
      nombrePersonnes: Number(parsedRecipe.nombrePersonnes) || 4,
      difficulte: difficulte as 'facile' | 'moyen' | 'difficile',
      categories: categories.map((c: any) => String(c)), // Noms de catégories
      tags: tags.map((t: any) => String(t)), // Noms de tags
    };

    return NextResponse.json({
      success: true,
      data: normalizedRecipe,
    });
  } catch (error) {
    console.error('[API /recipe/parse-ai] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * Appeler Ollama API
 */
async function callOllama(prompt: string): Promise<string> {
  const ollamaUrl = getOllamaUrl();
  const model = getOllamaModel();
  
  console.log(`[Ollama] Tentative de connexion à ${ollamaUrl} avec le modèle ${model}`);
  
  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant qui retourne uniquement du JSON valide, sans aucun texte supplémentaire. Réponds UNIQUEMENT avec du JSON, rien d\'autre.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        options: {
          temperature: 0.3, // Plus bas pour plus de cohérence
          num_predict: 2000, // Limiter la longueur de la réponse
        },
      }),
      // Timeout de 120 secondes pour Ollama (le premier appel peut être lent si le modèle doit être chargé)
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur inconnue');
      const errorMessage = `Ollama API error (${response.status}): ${errorText}`;
      console.error(`[Ollama] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      throw new Error('Aucune réponse de Ollama (contenu vide)');
    }

    console.log(`[Ollama] Réponse reçue avec succès (${content.length} caractères)`);
    return content;
  } catch (error: any) {
    // Améliorer les messages d'erreur pour le diagnostic
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      throw new Error(`Ollama timeout: Le serveur n'a pas répondu dans les 120 secondes. Le modèle est peut-être en train de charger (premier appel). Vérifiez les logs Ollama: docker logs 4epices_ollama`);
    }
    
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      throw new Error(`Impossible de se connecter à Ollama à ${ollamaUrl}. Vérifiez que: 1) Ollama est démarré, 2) L'URL est correcte, 3) Le port 11434 est accessible`);
    }
    
    // Propager l'erreur telle quelle si elle contient déjà un message utile
    throw error;
  }
}

/**
 * Appeler OpenAI API
 */
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurée');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant qui retourne uniquement du JSON valide, sans aucun texte supplémentaire.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }));
    console.error('Erreur OpenAI API:', error);
    
    const errorMessage = error.error?.message || '';
    if (errorMessage.includes('quota') || errorMessage.includes('billing') || response.status === 429) {
      throw new Error('QUOTA_EXCEEDED');
    }
    
    throw new Error(errorMessage || 'Erreur lors de l\'appel à OpenAI');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Aucune réponse de OpenAI');
  }

  return content;
}

/**
 * Appeler Groq API (gratuit, rapide, modèles performants)
 */
async function callGroq(prompt: string): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY non configurée');
  }

  // Modèle recommandé : llama-3.1-70b-versatile (gratuit, très performant)
  // Alternatives : mixtral-8x7b-32768, llama-3.1-8b-instant (plus rapide)
  const model = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';

  console.log(`[Groq] Utilisation du modèle ${model}`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant qui retourne uniquement du JSON valide, sans aucun texte supplémentaire.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }));
    console.error('Erreur Groq API:', error);
    
    const errorMessage = error.error?.message || '';
    if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || response.status === 429) {
      throw new Error('QUOTA_EXCEEDED');
    }
    
    throw new Error(errorMessage || 'Erreur lors de l\'appel à Groq');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Aucune réponse de Groq');
  }

  console.log(`[Groq] Réponse reçue avec succès (${content.length} caractères)`);
  return content;
}
