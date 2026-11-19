/**
 * Authentification serveur -> serveur entre les routes proxy Next (/api/...) et le backend Strapi.
 *
 * Les routes admin du backend (queues Instagram/Pinterest, stratégie, stats...) exigent l'en-tête
 * `x-internal-secret` (policy backend `global::require-internal-secret`). Le secret INTERNAL_API_SECRET
 * doit avoir la même valeur côté frontend et dans backend/.env. Ne jamais l'exposer au navigateur :
 * à n'utiliser que dans des routes serveur, après requireAdmin().
 */
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

export function backendAdminHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  return secret ? { [INTERNAL_SECRET_HEADER]: secret } : {};
}
