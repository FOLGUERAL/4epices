/**
 * Liens vers les recettes de base (« bases-de-cuisine ») dans le texte des étapes d'une autre recette.
 *
 * Le texte des étapes dit souvent « préparer la béchamel » ou « ajouter la pâte à pizza », jamais le titre
 * complet de la fiche (« Béchamel maison »). On dérive donc de chaque titre un mot-clé court à chercher
 * (on retire les qualificatifs comme « maison », « simple », « rapide »), et on relie seulement sa première
 * apparition dans le texte, pour ne pas truffer une étape de liens répétés.
 *
 * La recherche se fait mot par mot (jamais au milieu d'un mot, donc « riz » ne s'accroche pas dans « chorizo »),
 * et chaque mot garde sa position exacte dans le texte d'origine : le lien posé reprend l'orthographe, les
 * accents et la casse tels qu'écrits, sans jamais couper une balise HTML en deux.
 *
 * Module pur, comme lib/recipeSearch.ts : aucune dépendance à Strapi ni au DOM, testable avec de vraies données.
 */

import { normalizeSearchText } from '@/lib/recipeSearch';

export interface BaseRecipeLink {
  slug: string;
  titre: string;
}

/** Qualificatifs à retirer en fin de titre : ils ne font pas partie de ce qu'on tape en cuisinant. */
const TRAILING_QUALIFIERS =
  /\s+(?:maison|simples?|simplifi[ée]e?s?|rapides?|faciles?|classiques?|parf[ae]ites?|croustillantes?|express)$/iu;

/** « Bechamel maison » → « bechamel » ; « Tahini maison – Crème de sésame » → « tahini ». */
export function deriveBaseKeyword(titre: string): string {
  const beforeDash = titre.split(/[–—-]/)[0].trim();
  let cleaned = beforeDash;
  // Les qualificatifs peuvent s'enchaîner (rare, mais on reste robuste)
  let previous: string;
  do {
    previous = cleaned;
    cleaned = cleaned.replace(TRAILING_QUALIFIERS, '').trim();
  } while (cleaned !== previous);

  return normalizeSearchText(cleaned || beforeDash);
}

interface Word {
  /** Forme normalisée (minuscules, sans accents) : ce qu'on compare */
  normalized: string;
  start: number;
  end: number;
}

/** Découpe un texte en mots, avec leur position exacte (pour ne jamais recopier le mauvais fragment). */
function tokenize(text: string): Word[] {
  const words: Word[] = [];
  for (const match of text.matchAll(/\p{L}+/gu)) {
    words.push({ normalized: normalizeSearchText(match[0]), start: match.index, end: match.index + match[0].length });
  }
  return words;
}

/** Sépare le HTML en segments texte / balise, pour ne jamais chercher un mot-clé à l'intérieur d'une balise. */
function splitTextAndTags(html: string): Array<{ text: string; isTag: boolean }> {
  return html.split(/(<[^>]+>)/g).map((part) => ({ text: part, isTag: part.startsWith('<') }));
}

export interface LinkifyResult {
  html: string;
  /** Slugs effectivement reliés, dans l'ordre du texte : à passer en `alreadyLinked` d'un appel suivant sur la suite du texte */
  linked: string[];
}

/**
 * Ajoute un lien vers chaque recette de base mentionnée dans `html`, une seule fois par recette (sa première
 * apparition), en ignorant `currentSlug` (une recette ne se lie pas à elle-même) et les slugs déjà reliés
 * ailleurs (`alreadyLinked` : utile quand le texte est traité en plusieurs morceaux, par exemple de chaque
 * côté d'une publicité insérée au milieu des étapes).
 *
 * Au plus un lien est posé par paragraphe (balise entre deux autres balises) : après une insertion, le texte
 * modifié n'est jamais rescanné, pour ne jamais chercher un mot-clé à l'intérieur du lien qu'on vient de poser
 * ou de son adresse. En pratique, les étapes d'une recette sont réparties sur plusieurs paragraphes, donc
 * plusieurs bases différentes sont tout de même reliées si elles sont mentionnées dans des étapes distinctes.
 */
export function linkifyBaseRecipes(
  html: string,
  baseRecipes: BaseRecipeLink[],
  currentSlug?: string,
  alreadyLinked: Iterable<string> = []
): LinkifyResult {
  const candidates = baseRecipes
    .filter((recipe) => recipe.slug !== currentSlug)
    .map((recipe) => ({ slug: recipe.slug, tokens: deriveBaseKeyword(recipe.titre).split(' ').filter(Boolean) }))
    .filter((recipe) => recipe.tokens.length > 0 && recipe.tokens.join('').length >= 3)
    // Les mots-clés les plus longs d'abord : « pâte à pizza » passe avant une autre recette dont le mot-clé serait « pâte »
    .sort((a, b) => b.tokens.length - a.tokens.length);

  const linked = new Set(alreadyLinked);
  const newlyLinked: string[] = [];
  if (candidates.length === 0 || !html) return { html, linked: newlyLinked };

  const segments = splitTextAndTags(html);

  for (const segment of segments) {
    if (segment.isTag || !segment.text || linked.size === candidates.length) continue;

    const words = tokenize(segment.text);
    let bestMatch: { recipe: (typeof candidates)[number]; start: number; end: number } | null = null;

    for (const recipe of candidates) {
      if (linked.has(recipe.slug)) continue;

      for (let i = 0; i <= words.length - recipe.tokens.length; i += 1) {
        const matches = recipe.tokens.every((token, offset) => words[i + offset].normalized === token);
        if (!matches) continue;
        const start = words[i].start;
        // La première correspondance du segment l'emporte, quelle que soit la recette
        if (!bestMatch || start < bestMatch.start) {
          bestMatch = { recipe, start, end: words[i + recipe.tokens.length - 1].end };
        }
        break;
      }
    }

    if (bestMatch) {
      const { recipe, start, end } = bestMatch;
      const before = segment.text.slice(0, start);
      const match = segment.text.slice(start, end);
      const after = segment.text.slice(end);
      segment.text = `${before}<a href="/recettes/${recipe.slug}" class="text-orange-700 underline hover:text-orange-800">${match}</a>${after}`;
      linked.add(recipe.slug);
      newlyLinked.push(recipe.slug);
    }
  }

  return { html: segments.map((segment) => segment.text).join(''), linked: newlyLinked };
}

export interface SplitSteps {
  /** Première moitié des étapes (arrondie au-dessus s'il y a un nombre impair) */
  before: string;
  /** Seconde moitié ; vide si les étapes n'ont pas pu être découpées en paragraphes distincts */
  after: string;
  stepCount: number;
}

/**
 * Coupe le HTML des étapes en deux, au milieu, pour poser une publicité entre les deux (recipe-mid-steps).
 * Ne coupe qu'entre deux paragraphes `<p>` entiers, jamais à l'intérieur d'une étape. Si les étapes ne sont pas
 * écrites comme des paragraphes `<p>` (mise en forme différente), on ne découpe pas : `after` reste vide et
 * l'appelant sait qu'il doit renoncer à l'annonce du milieu plutôt que de deviner où couper.
 */
export function splitStepsHtml(html: string): SplitSteps {
  const paragraphs = [...html.matchAll(/<p[^>]*>[\s\S]*?<\/p>/gi)].map((match) => match[0]);
  const stepCount = paragraphs.length;

  // Tout ce qui reste une fois les paragraphes retirés : s'il y a autre chose que des espaces, la mise en forme
  // n'est pas celle attendue (une liste, du texte libre…) et on ne devine pas où couper.
  const outsideParagraphs = html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, '').replace(/\s+/g, '');
  if (stepCount < 2 || outsideParagraphs !== '') {
    return { before: html, after: '', stepCount: Math.max(stepCount, 1) };
  }

  const midpoint = Math.ceil(stepCount / 2);
  return { before: paragraphs.slice(0, midpoint).join(''), after: paragraphs.slice(midpoint).join(''), stepCount };
}
