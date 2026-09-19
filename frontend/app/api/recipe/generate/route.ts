import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { POST as parseRecipeWithAI } from '@/app/api/recipe/parse-ai/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_INGREDIENTS = 20;
const MAX_INGREDIENT_LENGTH = 100;
const CUISINES = new Set([
  'italienne',
  'méditerranéenne',
  'asiatique',
  'française',
  'mexicaine',
  'végétarienne',
]);

/**
 * Génère un aperçu de recette à partir d'un formulaire admin.
 * La route ne contacte jamais Strapi pour créer ou publier une recette.
 */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const ingredients = Array.isArray(body.ingredients)
      ? body.ingredients
          .filter((value: unknown): value is string => typeof value === 'string')
          .map((value: string) => value.trim().slice(0, MAX_INGREDIENT_LENGTH))
          .filter(Boolean)
          .slice(0, MAX_INGREDIENTS)
      : [];

    if (ingredients.length === 0) {
      return NextResponse.json({ success: false, message: 'Au moins un ingrédient est requis.' }, { status: 400 });
    }

    const cuisine = typeof body.cuisine === 'string' && CUISINES.has(body.cuisine)
      ? body.cuisine
      : 'italienne';
    const nombrePersonnes = Math.min(20, Math.max(1, Number(body.nombrePersonnes) || 4));
    const difficulte = ['facile', 'moyen', 'difficile'].includes(body.difficulte)
      ? body.difficulte
      : 'facile';
    const maxTime = Number(body.maxTime);
    const timeConstraint = Number.isFinite(maxTime) && maxTime >= 5 && maxTime <= 480
      ? ` Le temps total (préparation et cuisson) doit être au maximum de ${maxTime} minutes.`
      : '';

    const text = [
      `Crée une recette de cuisine ${cuisine} pour ${nombrePersonnes} personnes.`,
      `Utilise prioritairement ces ingrédients : ${ingredients.join(', ')}.`,
      `La difficulté doit être « ${difficulte} ».${timeConstraint}`,
      'Propose une recette réaliste, cohérente avec ce style culinaire et exploitable sans modification.',
    ].join(' ');

    // Réutilise le flux IA existant : providers, JSON strict, catégories et tags normalisés.
    const parseRequest = new NextRequest(new URL('/api/recipe/parse-ai', request.url), {
      method: 'POST',
      // Transmet la session admin : parse-ai vérifie lui aussi l'accès
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        text,
        provider: body.provider,
        groqAccount: body.groqAccount,
      }),
    });
    const response = await parseRecipeWithAI(parseRequest);
    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('[API /recipe/generate] Erreur:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
