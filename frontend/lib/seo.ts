/** URL canonique du site (sans slash final). */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'https://4epices.fr';
  return url.replace(/\/$/, '');
}

export function isAdSenseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ADSENSE === 'true';
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
  prepMinutes?: number;
  cookMinutes?: number;
  yield?: number;
  ingredients: string[];
  etapesHtml: string;
  categories?: string;
  keywords?: string;
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
    author: { '@type': 'Organization', name: '4épices' },
    recipeYield: String(options.yield ?? 4),
    recipeIngredient: options.ingredients,
  };

  if (options.datePublished) payload.datePublished = options.datePublished;
  if (prep > 0) payload.prepTime = `PT${prep}M`;
  if (cook > 0) payload.cookTime = `PT${cook}M`;
  if (total > 0) payload.totalTime = `PT${total}M`;
  if (recipeInstructions) payload.recipeInstructions = recipeInstructions;
  if (options.categories) payload.recipeCategory = options.categories;
  if (options.keywords) payload.keywords = options.keywords;

  return payload;
}
