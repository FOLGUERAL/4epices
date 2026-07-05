export { isAdSenseEnabled } from './ads';

/** Nom de marque affiché dans Google (site name, titles, JSON-LD). */
export const SITE_NAME = '4 épices';

/** URL canonique du site (sans slash final). */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'https://4epices.fr';
  return url.replace(/\/$/, '');
}

/** JSON-LD Organization — signal de marque pour Google. */
export function buildOrganizationJsonLd(): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: ['4épices', '4epices'],
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
  };
}

/** JSON-LD WebSite — nom de site dans les résultats Google. */
export function buildWebSiteJsonLd(): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: ['4épices', '4epices'],
    url: siteUrl,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
    },
  };
}

/** Extrait les étapes depuis le HTML richtext Strapi pour JSON-LD / SEO. */
export function extractStepsFromEtapesHtml(html: string): string[] {
  if (!html?.trim()) return [];

  const steps: string[] = [];
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;

  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) steps.push(text);
  }

  if (steps.length > 0) return steps;

  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return [];

  const splitByEtape = plain.split(/(?=étape\s*\d+\s*:\s*)/iu).map((s) => s.trim()).filter(Boolean);
  return splitByEtape.length > 1 ? splitByEtape : [plain];
}

export function buildRecipeJsonLd(options: {
  name: string;
  description: string;
  image: string;
  url: string;
  datePublished?: string | null;
  dateModified?: string | null;
  prepMinutes?: number;
  cookMinutes?: number;
  yield?: number;
  ingredients: string[];
  etapesHtml: string;
  categories?: string;
  keywords?: string;
  aggregateRating?: { ratingValue: number; reviewCount: number };
}) {
  const prep = options.prepMinutes || 0;
  const cook = options.cookMinutes || 0;
  const total = prep + cook;
  const steps = extractStepsFromEtapesHtml(options.etapesHtml);

  const recipeInstructions =
    steps.length > 0
      ? steps.map((text, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          text,
        }))
      : options.etapesHtml
        ? [{ '@type': 'HowToStep', position: 1, text: options.etapesHtml.replace(/<[^>]+>/g, ' ').trim() }]
        : undefined;

  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'Recipe',
    name: options.name,
    description: options.description,
    image: options.image,
    url: options.url,
    author: { '@type': 'Organization', name: SITE_NAME },
    recipeYield: String(options.yield ?? 4),
    recipeIngredient: options.ingredients,
  };

  if (options.datePublished) payload.datePublished = options.datePublished;
  if (options.dateModified) payload.dateModified = options.dateModified;
  if (prep > 0) payload.prepTime = `PT${prep}M`;
  if (cook > 0) payload.cookTime = `PT${cook}M`;
  if (total > 0) payload.totalTime = `PT${total}M`;
  if (recipeInstructions) payload.recipeInstructions = recipeInstructions;
  if (options.categories) payload.recipeCategory = options.categories;
  if (options.keywords) payload.keywords = options.keywords;

  const rating = options.aggregateRating;
  if (rating && rating.reviewCount > 0 && rating.ratingValue > 0) {
    payload.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.ratingValue,
      reviewCount: rating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return payload;
}

export interface SeoEnrichiFaqItem {
  question: string;
  answer: string;
}

export interface SeoEnrichi {
  faq?: SeoEnrichiFaqItem[];
  conseils?: string;
  variantes?: string;
  conservation?: string;
  ingredientPrincipal?: string;
  typeCuisine?: string;
  niveau?: string;
  motsClesSeo?: string[];
}

/** JSON-LD FAQPage — à n'injecter que si faq.length >= 2 */
/** JSON-LD ItemList pour pages hub (catégories, tags). */
export function buildItemListJsonLd(
  items: { name: string; url: string }[],
  pageUrl: string
): Record<string, unknown> | null {
  if (items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url: pageUrl,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function buildFaqJsonLd(
  faq: SeoEnrichiFaqItem[],
  pageUrl: string
): Record<string, unknown> | null {
  const items = faq.filter((item) => item.question?.trim() && item.answer?.trim());
  if (items.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question.trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.trim(),
      },
    })),
    url: pageUrl,
  };
}

export function parseSeoEnrichi(raw: unknown): SeoEnrichi | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const faq = Array.isArray(o.faq)
    ? o.faq
        .filter(
          (item): item is SeoEnrichiFaqItem =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as SeoEnrichiFaqItem).question === 'string' &&
            typeof (item as SeoEnrichiFaqItem).answer === 'string'
        )
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
    : undefined;

  const str = (key: string) => {
    const v = o[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };

  const motsClesSeo = Array.isArray(o.motsClesSeo)
    ? o.motsClesSeo.map((k) => String(k).trim()).filter(Boolean)
    : undefined;

  const result: SeoEnrichi = {
    faq,
    conseils: str('conseils'),
    variantes: str('variantes'),
    conservation: str('conservation'),
    ingredientPrincipal: str('ingredientPrincipal'),
    typeCuisine: str('typeCuisine'),
    niveau: str('niveau'),
    motsClesSeo,
  };

  const hasContent =
    (faq && faq.length > 0) ||
    result.conseils ||
    result.variantes ||
    result.conservation;

  return hasContent ? result : null;
}
