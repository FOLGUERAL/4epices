export const ADSENSE_CLIENT = 'ca-pub-9219883229313117';

export type AdProvider = 'adsense' | 'ezoic' | 'none';

export type RecipeAdPlacement = 'recipe-after-ingredients' | 'recipe-after-preparation';

const EZOIC_PLACEHOLDER_ENV: Record<RecipeAdPlacement, string | undefined> = {
  'recipe-after-ingredients': process.env.NEXT_PUBLIC_EZOIC_PLACEHOLDER_RECIPE_AFTER_INGREDIENTS,
  'recipe-after-preparation': process.env.NEXT_PUBLIC_EZOIC_PLACEHOLDER_RECIPE_AFTER_PREPARATION,
};

export function isAdSenseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ADSENSE === 'true';
}

export function isEzoicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_EZOIC === 'true';
}

export function getAdProvider(): AdProvider {
  const configuredProvider = process.env.NEXT_PUBLIC_AD_PROVIDER;

  if (configuredProvider === 'none') {
    return 'none';
  }

  if (configuredProvider === 'ezoic') {
    return isEzoicEnabled() ? 'ezoic' : 'none';
  }

  if (configuredProvider === 'adsense') {
    return isAdSenseEnabled() ? 'adsense' : 'none';
  }

  if (isEzoicEnabled()) {
    return 'ezoic';
  }

  if (isAdSenseEnabled()) {
    return 'adsense';
  }

  return 'none';
}

export function getEzoicPlaceholderId(placement: RecipeAdPlacement): string {
  return EZOIC_PLACEHOLDER_ENV[placement]?.trim() || '';
}

export function getConfiguredEzoicPlaceholderIds(): string[] {
  return Object.values(EZOIC_PLACEHOLDER_ENV)
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));
}
