/**
 * Secrets dev : remplacer en prod par des variables d'environnement fortes.
 * Générer des sels : node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
 */
module.exports = ({ env }) => {
  const adminJwtSecret =
    (env('ADMIN_JWT_SECRET') || '').trim() ||
    '4epices-dev-admin-jwt-secret-do-not-use-in-production-min-32-chars';
  const apiTokenSalt =
    (env('API_TOKEN_SALT') || '').trim() || 'K7mP9vR2xQ8nL4wY6zT1bH5jC3fN0sA=';
  const transferTokenSalt =
    (env('TRANSFER_TOKEN_SALT') || '').trim() ||
    'M8nQ2rX5yZ9pL3wB7cF1vH4jK6sD0tE=';

  return {
    auth: {
      secret: adminJwtSecret,
    },
    apiToken: {
      salt: apiTokenSalt,
    },
    transfer: {
      token: {
        salt: transferTokenSalt,
      },
    },
    flags: {
      nps: env.bool('FLAG_NPS', true),
      promoteEE: env.bool('FLAG_PROMOTE_EE', true),
    },
  };
};

