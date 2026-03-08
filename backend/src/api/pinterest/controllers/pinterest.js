'use strict';

const axios = require('axios');
const {
  getPinterestAuth,
  setPinterestAuth,
  clearPinterestAuth,
} = require('../../../utils/pinterestAuthStore');

/**
 * Controller Pinterest OAuth (Strapi)
 *
 * Flux:
 * 1) Frontend redirige l'admin vers https://www.pinterest.com/oauth/?response_type=code&...
 * 2) Pinterest redirige vers /api/pinterest/callback?code=XXXX
 * 3) On échange le code contre un access_token
 * 4) On teste le token via /v5/user_account et on stocke username + token
 */
module.exports = {
  /**
   * GET /api/pinterest/callback?code=XXXX
   * Échange le code contre un access_token puis redirige vers l'admin.
   */
  async callback(ctx) {
    const { code, state, error, error_description } = ctx.query || {};

    if (error) {
      return ctx.badRequest('Erreur OAuth Pinterest', {
        error,
        error_description,
        state,
      });
    }

    if (!code) {
      return ctx.badRequest('Paramètre "code" manquant dans le callback Pinterest');
    }

    const clientId = process.env.PINTEREST_CLIENT_ID;
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
    const redirectUri = process.env.PINTEREST_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return ctx.internalServerError('Configuration Pinterest OAuth manquante', {
        missing: {
          PINTEREST_CLIENT_ID: !clientId,
          PINTEREST_CLIENT_SECRET: !clientSecret,
          PINTEREST_REDIRECT_URI: !redirectUri,
        },
      });
    }

    try {
      // IMPORTANT: Pinterest API v5 attend HTTP Basic Auth (client_id:client_secret en base64)
      // Le body ne doit contenir QUE grant_type, code, et redirect_uri (sans client_id/client_secret)
      const form = new URLSearchParams();
      form.set('grant_type', 'authorization_code');
      form.set('code', code);
      form.set('redirect_uri', redirectUri);

      // HTTP Basic Auth: encoder client_id:client_secret en base64
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const tokenResponse = await axios.post(
        'https://api-sandbox.pinterest.com/v5/oauth/token',
        form.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
          },
          timeout: 15_000,
        }
      );

      const tokenData = tokenResponse.data || {};
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return ctx.internalServerError('Réponse Pinterest invalide : access_token manquant', {
          tokenData,
        });
      }

      // Stocker le token (démo: mémoire)
      setPinterestAuth({
        accessToken,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
      });

      // Vérification immédiate: récupérer le compte Pinterest
      const meResponse = await axios.get('https://api-sandbox.pinterest.com/v5/user_account', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15_000,
      });

      setPinterestAuth({
        user: meResponse.data,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const postAuthRedirect =
        process.env.PINTEREST_POST_AUTH_REDIRECT ||
        `${frontendUrl}/creer-recette?pinterest=connected`;

      // Redirection vers l'interface admin (utile pour la démo vidéo)
      ctx.redirect(postAuthRedirect);
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const message = e?.message;

      // Log détaillé pour le debug
      strapi.log.error('❌ Erreur échange OAuth Pinterest:', {
        status,
        data,
        message,
        hasCode: !!code,
        redirectUri,
        clientIdLength: clientId?.length || 0,
      });

      // En cas d'échec, on nettoie pour éviter un état incohérent.
      clearPinterestAuth();

      return ctx.internalServerError("Erreur lors de l'échange OAuth Pinterest", {
        status,
        data,
        message,
      });
    }
  },

  /**
   * GET /api/pinterest/me
   * Utilise le token stocké pour appeler GET /v5/user_account
   * et confirmer que la connexion fonctionne.
   */
  async me(ctx) {
    const auth = getPinterestAuth();

    if (!auth?.accessToken) {
      return ctx.send({
        connected: false,
        username: null,
      });
    }

    try {
      const meResponse = await axios.get('https://api-sandbox.pinterest.com/v5/user_account', {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        timeout: 15_000,
      });

      const user = meResponse.data || null;
      const username = user?.username || user?.profile?.username || null;

      setPinterestAuth({ user });

      return ctx.send({
        connected: true,
        username,
        user,
      });
    } catch (e) {
      // Si le token est invalide/expiré, on efface.
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        clearPinterestAuth();
        return ctx.unauthorized('Token Pinterest invalide ou expiré');
      }

      return ctx.internalServerError('Erreur lors de la récupération du compte Pinterest', {
        status,
        data: e?.response?.data,
        message: e?.message,
      });
    }
  },
};

