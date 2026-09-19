/**
 * Enregistre les recherches qui ne donnent aucune recette, pour savoir quoi écrire ensuite.
 * Serveur uniquement (utilise STRAPI_API_TOKEN). Toutes les erreurs sont silencieuses : la recherche
 * ne doit jamais échouer à cause de cette collecte.
 */

const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 60;
const SAME_TERM_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_NEW_TERMS_PER_HOUR = 30;

const recentlyRecorded = new Map<string, number>();
let newTermsWindow = { startedAt: Date.now(), count: 0 };

function resolveStrapiUrl(): string {
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://127.0.0.1:1337').replace(/\/$/, '');
}

function normalizeTerm(query: string): string {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isRecordable(term: string): boolean {
  if (term.length < MIN_TERM_LENGTH || term.length > MAX_TERM_LENGTH) return false;
  // Ignore les saisies qui ressemblent à du bruit ou à une tentative d'injection
  if (/https?:|www\.|[<>{}\\]/.test(term)) return false;
  return true;
}

function allowNewTerm(): boolean {
  const now = Date.now();
  if (now - newTermsWindow.startedAt > 60 * 60 * 1000) {
    newTermsWindow = { startedAt: now, count: 0 };
  }
  return newTermsWindow.count < MAX_NEW_TERMS_PER_HOUR;
}

export async function recordSearchMiss(query: string): Promise<void> {
  try {
    const token = process.env.STRAPI_API_TOKEN;
    if (!token) return;

    const term = normalizeTerm(query);
    if (!isRecordable(term)) return;

    const now = Date.now();
    const last = recentlyRecorded.get(term);
    if (last && now - last < SAME_TERM_COOLDOWN_MS) return;
    if (recentlyRecorded.size > 500) recentlyRecorded.clear();
    recentlyRecorded.set(term, now);

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const baseUrl = `${resolveStrapiUrl()}/api/search-misses`;
    const lookup = await fetch(
      `${baseUrl}?filters[terme][$eq]=${encodeURIComponent(term)}&pagination[pageSize]=1`,
      { headers, cache: 'no-store' }
    );
    if (!lookup.ok) return;

    const existing = (await lookup.json())?.data?.[0];
    const derniereRecherche = new Date(now).toISOString();

    if (existing) {
      const compteur = Number(existing.attributes?.compteur ?? 1) + 1;
      await fetch(`${baseUrl}/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: { compteur, derniereRecherche } }),
        cache: 'no-store',
      });
      return;
    }

    if (!allowNewTerm()) return;
    newTermsWindow.count += 1;
    await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: { terme: term, compteur: 1, derniereRecherche } }),
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('[searchMisses] Enregistrement impossible:', error instanceof Error ? error.message : error);
  }
}
