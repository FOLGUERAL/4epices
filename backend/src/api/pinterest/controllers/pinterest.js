'use strict';

const axios = require('axios');
const {
  getPinterestAuth,
  setPinterestAuth,
  clearPinterestAuth,
} = require('../../../utils/pinterestAuthStore');

/**
 * Récupère l'URL de base de l'API Pinterest (sandbox ou production)
 */
function getPinterestApiUrl() {
  const useSandbox = process.env.PINTEREST_USE_SANDBOX !== 'false'; // Par défaut: true (sandbox)
  return useSandbox 
    ? 'https://api-sandbox.pinterest.com'
    : 'https://api.pinterest.com';
}

/**
 * Génère un ID de session unique pour les utilisateurs anonymes
 */
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Récupère l'ID utilisateur ou sessionId depuis le contexte
 */
function getUserIdOrSession(ctx) {
  // Utilisateur connecté (Strapi Users & Permissions)
  const userId = ctx.state?.user?.id || null;
  
  // Session ID pour utilisateurs anonymes (depuis cookie ou query param)
  let sessionId = ctx.cookies?.get('pinterest_session_id') || ctx.query?.sessionId || null;
  
  // Si pas de sessionId et utilisateur anonyme, en créer un
  if (!userId && !sessionId) {
    sessionId = generateSessionId();
    // Stocker dans un cookie (valide 30 jours)
    ctx.cookies?.set('pinterest_session_id', sessionId, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: false, // Accessible depuis JS côté client
      sameSite: 'lax',
    });
  }
  
  return { userId, sessionId };
}

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
        `${getPinterestApiUrl()}/v5/oauth/token`,
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

      // Vérification immédiate: récupérer le compte Pinterest
      const meResponse = await axios.get(`${getPinterestApiUrl()}/v5/user_account`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15_000,
      });

      const pinterestUser = meResponse.data || {};
      const username = pinterestUser.username || pinterestUser.profile?.username || null;

      // Détecter si c'est un admin (via state dans l'URL) ou un utilisateur normal
      // Le frontend admin envoie state avec le préfixe "admin_"
      const stateParam = ctx.query?.state || '';
      const isAdmin = ctx.query?.admin === 'true' || 
                     (typeof stateParam === 'string' && stateParam.includes('admin'));
      const { userId, sessionId } = getUserIdOrSession(ctx);
      
      strapi.log.info(`[Pinterest OAuth] Détection admin: state="${stateParam}", isAdmin=${isAdmin}`);

      if (isAdmin) {
        // Mode admin : garder le système actuel (token global en mémoire pour le bot)
        // Log du token pour pouvoir le copier dans .env si nécessaire
        const expiresInSeconds = tokenData.expires_in || null;
        const expiresInDays = expiresInSeconds ? Math.round(expiresInSeconds / (24 * 60 * 60)) : 'indéfinie';
        const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : null;
        
        // Logs détaillés pour faciliter la copie du token
        strapi.log.info('');
        strapi.log.info('═══════════════════════════════════════════════════════════');
        strapi.log.info('🎯 PINTEREST OAUTH - TOKEN ADMIN OBTENU');
        strapi.log.info('═══════════════════════════════════════════════════════════');
        strapi.log.info(`📋 Scopes: ${tokenData.scope || 'Non spécifié'}`);
        strapi.log.info(`⏰ Durée de validité: ${expiresInDays} jour(s)${expiresAt ? ` (expire le ${new Date(expiresAt).toLocaleDateString('fr-FR')})` : ' (pas d\'expiration connue)'}`);
        strapi.log.info('');
        strapi.log.info('📝 TOKEN À COPIER DANS backend/.env :');
        strapi.log.info('───────────────────────────────────────────────────────────');
        strapi.log.info(`PINTEREST_ACCESS_TOKEN=${accessToken}`);
        strapi.log.info('───────────────────────────────────────────────────────────');
        strapi.log.info('');
        strapi.log.info('💡 Alternative: Récupérez aussi ce token via GET /api/pinterest/me');
        strapi.log.info('═══════════════════════════════════════════════════════════');
        strapi.log.info('');
        
        setPinterestAuth({
          accessToken,
          refreshToken: tokenData.refresh_token,
          expiresIn: expiresInSeconds,
          expiresAt: expiresAt,
          tokenType: tokenData.token_type,
          scope: tokenData.scope,
          user: pinterestUser,
        });

        // Rediriger vers l'admin Strapi si c'est une connexion admin
        // IMPORTANT: Pour les connexions admin, on redirige toujours vers l'admin Strapi,
        // pas vers le frontend, même si PINTEREST_POST_AUTH_REDIRECT est configuré
        const strapiAdminUrl = process.env.STRAPI_ADMIN_URL || 
                               process.env.ADMIN_URL || 
                               (process.env.PUBLIC_STRAPI_URL || process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 1337}`) + '/admin';
        
        // Pour les connexions admin, on ignore PINTEREST_POST_AUTH_REDIRECT et on redirige toujours vers l'admin
        // PINTEREST_POST_AUTH_REDIRECT est utilisé uniquement pour les connexions utilisateurs normaux
        const postAuthRedirect = `${strapiAdminUrl}?pinterest=connected`;
        strapi.log.info(`[Pinterest OAuth] Redirection admin vers: ${postAuthRedirect}`);
        ctx.redirect(postAuthRedirect);
      } else {
        // Mode utilisateur : stocker dans la base de données
        const tokenService = strapi.service('api::pinterest-token.pinterest-token');
        
        // Vérifier qu'on a au moins un userId ou sessionId
        if (!userId && !sessionId) {
          strapi.log.error('❌ Erreur OAuth: ni userId ni sessionId disponible');
          return ctx.internalServerError('Erreur lors de la sauvegarde du token: identifiant utilisateur manquant');
        }
        
        // Calculer expiresAt si expires_in est fourni
        const expiresAt = tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null;

        await tokenService.saveUserToken({
          userId,
          sessionId,
          accessToken,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          username,
        });

        // Rediriger vers la page d'origine ou la recette si spécifiée
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        let returnUrl = ctx.query?.returnUrl || ctx.query?.state?.replace('return:', '') || `${frontendUrl}?pinterest=connected`;
        
        // Décoder l'URL si elle est encodée
        try {
          returnUrl = decodeURIComponent(returnUrl);
        } catch (e) {
          // Si le décodage échoue, garder l'URL telle quelle
        }
        
        // Ajouter le sessionId à l'URL si présent (pour les utilisateurs anonymes)
        if (sessionId && !userId) {
          // Vérifier si returnUrl est déjà une URL absolue
          let url;
          if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
            url = new URL(returnUrl);
          } else {
            // URL relative, utiliser frontendUrl comme base
            url = new URL(returnUrl, frontendUrl);
          }
          url.searchParams.set('pinterest_session', sessionId);
          returnUrl = url.toString();
        }
        
        ctx.redirect(returnUrl);
      }
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
      const meResponse = await axios.get(`${getPinterestApiUrl()}/v5/user_account`, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        timeout: 15_000,
      });

      const user = meResponse.data || null;
      const username = user?.username || user?.profile?.username || null;

      setPinterestAuth({ user });

      // Calculer la date d'expiration si disponible
      let expiresAt = null;
      let expiresInDays = null;
      if (auth.expiresIn) {
        expiresAt = new Date(Date.now() + auth.expiresIn * 1000).toISOString();
        expiresInDays = Math.round(auth.expiresIn / (24 * 60 * 60));
      } else if (auth.expiresAt) {
        expiresAt = auth.expiresAt;
        const expiresDate = new Date(expiresAt);
        const now = new Date();
        expiresInDays = Math.round((expiresDate - now) / (24 * 60 * 60 * 1000));
      }

      return ctx.send({
        connected: true,
        username,
        user,
        // Inclure le token et les scopes pour pouvoir les copier dans .env
        token: auth.accessToken,
        scopes: auth.scope,
        expiresIn: auth.expiresIn ? `${auth.expiresIn} secondes (${expiresInDays} jour(s))` : 'Non spécifié',
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleString('fr-FR') : 'Non spécifié',
        hasRefreshToken: !!auth.refreshToken,
        note: 'Copiez ce token dans PINTEREST_ACCESS_TOKEN de votre .env pour utiliser les permissions d\'écriture',
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

  /**
   * GET /api/pinterest/status
   * Vérifie si l'utilisateur a un token Pinterest valide
   */
  async status(ctx) {
    const { userId, sessionId } = getUserIdOrSession(ctx);
    const tokenService = strapi.service('api::pinterest-token.pinterest-token');
    
    const token = await tokenService.getUserToken(userId, sessionId);
    
    if (!token || !token.accessToken) {
      return ctx.send({
        connected: false,
        username: null,
      });
    }

    // Vérifier si le token est encore valide
    try {
      const meResponse = await axios.get(`${getPinterestApiUrl()}/v5/user_account`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        timeout: 15_000,
      });

      const username = meResponse.data?.username || token.username || null;
      
      // Mettre à jour le username si nécessaire
      if (username && username !== token.username) {
        await tokenService.saveUserToken({
          userId,
          sessionId,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          username,
        });
      }

      return ctx.send({
        connected: true,
        username,
      });
    } catch (e) {
      // Token invalide ou expiré
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        await tokenService.deleteUserToken(userId, sessionId);
        return ctx.send({
          connected: false,
          username: null,
        });
      }
      throw e;
    }
  },

  /**
   * POST /api/pinterest/disconnect
   * Supprime le token Pinterest de l'utilisateur
   */
  async disconnect(ctx) {
    const { userId, sessionId } = getUserIdOrSession(ctx);
    const tokenService = strapi.service('api::pinterest-token.pinterest-token');
    
    await tokenService.deleteUserToken(userId, sessionId);
    
    // Supprimer le cookie de session si présent
    if (sessionId) {
      ctx.cookies?.set('pinterest_session_id', null, { maxAge: 0 });
    }

    return ctx.send({
      success: true,
      message: 'Compte Pinterest déconnecté',
    });
  },

  /**
   * GET /api/pinterest/boards
   * Liste les boards Pinterest de l'utilisateur
   */
  async boards(ctx) {
    const { userId, sessionId } = getUserIdOrSession(ctx);
    const tokenService = strapi.service('api::pinterest-token.pinterest-token');
    
    const token = await tokenService.getUserToken(userId, sessionId);
    
    if (!token || !token.accessToken) {
      return ctx.unauthorized('Pinterest non connecté. Connectez-vous d\'abord.');
    }

    try {
      const boardsResponse = await axios.get(`${getPinterestApiUrl()}/v5/boards`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        params: {
          page_size: 250, // Maximum
        },
        timeout: 15_000,
      });

      const boards = boardsResponse.data?.items || [];
      
      return ctx.send({
        boards: boards.map(board => ({
          id: board.id,
          name: board.name,
          description: board.description || '',
        })),
      });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        await tokenService.deleteUserToken(userId, sessionId);
        return ctx.unauthorized('Token Pinterest invalide ou expiré');
      }

      return ctx.internalServerError('Erreur lors de la récupération des boards', {
        status,
        data: e?.response?.data,
        message: e?.message,
      });
    }
  },

  /**
   * POST /api/pinterest/share
   * Partage une recette sur Pinterest (crée un pin)
   * Body: { recetteId, boardId, title?, description? }
   */
  async share(ctx) {
    const { userId, sessionId } = getUserIdOrSession(ctx);
    const { recetteId, boardId, title, description } = ctx.request.body || {};

    if (!recetteId || !boardId) {
      return ctx.badRequest('recetteId et boardId sont requis');
    }

    const tokenService = strapi.service('api::pinterest-token.pinterest-token');
    const token = await tokenService.getUserToken(userId, sessionId);
    
    if (!token || !token.accessToken) {
      return ctx.unauthorized('Pinterest non connecté. Connectez-vous d\'abord.');
    }

    try {
      // Récupérer la recette
      const recette = await strapi.entityService.findOne('api::recette.recette', recetteId, {
        populate: ['imagePrincipale'],
      });

      if (!recette) {
        return ctx.notFound('Recette non trouvée');
      }

      // Utiliser le service Pinterest existant pour créer le pin
      const pinterestService = strapi.service('api::recette.pinterest');
      
      // Temporairement remplacer le token global par celui de l'utilisateur
      const originalToken = getPinterestAuth()?.accessToken;
      setPinterestAuth({ accessToken: token.accessToken });

      try {
        // Récupérer l'URL de l'image
        const imageUrl = await pinterestService.getImageUrl(
          recette.imagePrincipale?.data || recette.imagePrincipale
        );

        if (!imageUrl) {
          return ctx.badRequest('Aucune image principale trouvée pour la recette');
        }

        const pinTitle = title || recette.metaTitle || recette.titre;
        const pinDescription = description || recette.metaDescription || recette.description;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const recipeUrl = `${frontendUrl}/recettes/${recette.slug}`;

        // Créer le pin avec le token de l'utilisateur
        const response = await axios.post(
          `${getPinterestApiUrl()}/v5/pins`,
          {
            board_id: boardId,
            title: pinTitle.substring(0, 100),
            description: pinDescription.substring(0, 800),
            link: recipeUrl,
            media_source: {
              source_type: 'image_url',
              url: imageUrl,
            },
            alt_text: pinTitle,
          },
          {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 20_000,
          }
        );

        // Restaurer le token original (admin)
        if (originalToken) {
          setPinterestAuth({ accessToken: originalToken });
        } else {
          clearPinterestAuth();
        }

        return ctx.send({
          success: true,
          pin: response.data,
          message: 'Recette partagée sur Pinterest avec succès',
        });
      } catch (error) {
        // Restaurer le token original en cas d'erreur
        if (originalToken) {
          setPinterestAuth({ accessToken: originalToken });
        } else {
          clearPinterestAuth();
        }
        throw error;
      }
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;

      if (status === 401 || status === 403) {
        await tokenService.deleteUserToken(userId, sessionId);
        return ctx.unauthorized('Token Pinterest invalide ou expiré');
      }

      return ctx.internalServerError('Erreur lors du partage sur Pinterest', {
        status,
        data,
        message: e?.message,
      });
    }
  },

  /**
   * POST /api/pinterest/boards
   * Crée un nouveau board Pinterest
   * Body: { name, description? }
   */
  async createBoard(ctx) {
    const { userId, sessionId } = getUserIdOrSession(ctx);
    const { name, description } = ctx.request.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return ctx.badRequest('Le nom du board est requis');
    }

    const tokenService = strapi.service('api::pinterest-token.pinterest-token');
    const token = await tokenService.getUserToken(userId, sessionId);
    
    if (!token || !token.accessToken) {
      return ctx.unauthorized('Pinterest non connecté. Connectez-vous d\'abord.');
    }

    try {
      // Créer le board via l'API Pinterest
      const boardData = {
        name: name.trim(),
      };

      // Description optionnelle (max 500 caractères selon Pinterest)
      if (description && typeof description === 'string' && description.trim().length > 0) {
        boardData.description = description.trim().substring(0, 500);
      }

      const response = await axios.post(
        `${getPinterestApiUrl()}/v5/boards`,
        boardData,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        }
      );

      const newBoard = response.data || {};

      return ctx.send({
        success: true,
        board: {
          id: newBoard.id,
          name: newBoard.name,
          description: newBoard.description || '',
        },
        message: 'Board créé avec succès',
      });
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;

      if (status === 401 || status === 403) {
        await tokenService.deleteUserToken(userId, sessionId);
        return ctx.unauthorized('Token Pinterest invalide ou expiré');
      }

      return ctx.internalServerError('Erreur lors de la création du board', {
        status,
        data,
        message: e?.message,
      });
    }
  },

  /**
   * GET /api/pinterest/queue-status
   * Affiche l'état de la queue de pins planifiés (pour debug)
   */
  async queueStatus(ctx) {
    try {
      const queueService = strapi.service('api::recette.pinterest-queue');
      const allTasks = await queueService.getAllTasks();
      const readyTasks = await queueService.getReadyTasks();
      
      const now = new Date();
      const tasksWithStatus = allTasks.map(task => {
        const scheduledTime = new Date(task.scheduledTime);
        return {
          id: task.id,
          recetteId: task.recetteId,
          pinIndex: task.pinIndex,
          scheduledTime: task.scheduledTime,
          isReady: scheduledTime <= now,
          minutesUntilReady: Math.round((scheduledTime - now) / 1000 / 60),
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          boardId: task.boardId || null, // Inclure le boardId
        };
      });
      
      return ctx.send({
        total: allTasks.length,
        ready: readyTasks.length,
        tasks: tasksWithStatus,
      });
    } catch (error) {
      return ctx.internalServerError('Erreur lors de la récupération de l\'état de la queue', {
        error: error.message,
      });
    }
  },

  /**
   * GET /api/pinterest/admin/boards
   * Liste les boards Pinterest avec le token admin (pour le dashboard)
   * Priorité: token du .env > token OAuth (pour simplifier l'utilisation en admin)
   */
  async adminBoards(ctx) {
    const auth = getPinterestAuth();
    // Priorité inversée pour l'admin : token .env d'abord, puis OAuth en fallback
    const accessToken = process.env.PINTEREST_ACCESS_TOKEN || auth?.accessToken;

    if (!accessToken) {
      return ctx.unauthorized('Token Pinterest manquant. Configurez PINTEREST_ACCESS_TOKEN dans .env ou connectez-vous via OAuth');
    }

    try {
      const boardsResponse = await axios.get(`${getPinterestApiUrl()}/v5/boards`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          page_size: 250, // Maximum
        },
        timeout: 15_000,
      });

      const boards = boardsResponse.data?.items || [];
      
      return ctx.send({
        boards: boards.map(board => ({
          id: board.id,
          name: board.name,
          description: board.description || '',
        })),
      });
    } catch (e) {
      const status = e?.response?.status;
      strapi.log.error('[Pinterest Admin Boards] Erreur:', e.message);
      
      return ctx.internalServerError('Erreur lors de la récupération des boards', {
        status,
        data: e?.response?.data,
        message: e?.message,
      });
    }
  },

  /**
   * DELETE /api/pinterest/queue/:taskId
   * Annule une tâche spécifique dans la queue
   */
  async cancelTask(ctx) {
    const { taskId } = ctx.params;

    strapi.log.info(`[Pinterest Cancel Task] Tentative d'annulation de la tâche: ${taskId}`);
    strapi.log.info(`[Pinterest Cancel Task] ctx.params:`, ctx.params);

    if (!taskId) {
      strapi.log.warn('[Pinterest Cancel Task] taskId manquant dans les paramètres');
      return ctx.badRequest('taskId est requis');
    }

    try {
      const queueService = strapi.service('api::recette.pinterest-queue');
      const result = await queueService.cancelTask(taskId);
      
      strapi.log.info(`[Pinterest Cancel Task] Tâche ${taskId} annulée avec succès`);
      return ctx.send(result);
    } catch (error) {
      if (error.message.includes('non trouvée')) {
        strapi.log.warn(`[Pinterest Cancel Task] Tâche ${taskId} non trouvée dans la queue`);
        return ctx.notFound(error.message);
      }
      
      strapi.log.error('[Pinterest Cancel Task] Erreur:', error);
      return ctx.internalServerError('Erreur lors de l\'annulation de la tâche', {
        error: error.message,
      });
    }
  },

  /**
   * POST /api/pinterest/process-queue
   * Force le traitement immédiat de toutes les tâches prêtes (pour debug/manuel ou cron Docker)
   */
  async processQueue(ctx) {
    try {
      const queueService = strapi.service('api::recette.pinterest-queue');
      const readyTasks = await queueService.getReadyTasks();
      
      // Détecter si l'appel vient du cron Docker ou d'un appel manuel
      const isCronDocker = ctx.request.headers['x-cron-source'] === 'docker';
      const logPrefix = isCronDocker ? '[Pinterest Cron Docker]' : '[Pinterest Manual]';
      
      if (readyTasks.length === 0) {
        if (isCronDocker) {
          // Ne pas logger si c'est le cron Docker et qu'il n'y a rien à traiter (pour éviter le spam)
          strapi.log.debug(`${logPrefix} Aucune tâche prête à être traitée`);
        }
        return ctx.send({
          success: true,
          message: 'Aucune tâche prête à être traitée',
          processed: 0,
        });
      }
      
      strapi.log.info(`${logPrefix} Traitement de ${readyTasks.length} tâche(s) prête(s)`);
      
      // Traiter une seule tâche à la fois pour respecter le rate limiting Pinterest
      // (même si plusieurs sont prêtes, on en traite qu'une par appel)
      let processed = 0;
      for (const task of readyTasks) {
        try {
          strapi.log.info(`${logPrefix} Traitement de la tâche ${task.id} (pin #${task.pinIndex} pour recette ${task.recetteId})`);
          const result = await queueService.processTask(task);
          
          if (result.success) {
            processed++;
            strapi.log.info(`${logPrefix} Tâche ${task.id} traitée avec succès`);
            // Traiter une seule tâche par appel pour respecter le rate limiting
            // Les autres seront traitées lors des prochaines exécutions (toutes les 5 min)
            break;
          } else {
            strapi.log.warn(`${logPrefix} Tâche ${task.id} échouée: ${result.error}`);
            // Continuer avec la tâche suivante si celle-ci a échoué
          }
        } catch (error) {
          strapi.log.error(`${logPrefix} Erreur lors du traitement de la tâche ${task.id}:`, error);
          // Continuer avec la tâche suivante en cas d'erreur
        }
      }
      
      // Nettoyer les tâches expirées
      await queueService.cleanup();
      
      return ctx.send({
        success: true,
        message: `${processed} tâche(s) traitée(s) avec succès`,
        processed,
        remaining: readyTasks.length - processed,
      });
    } catch (error) {
      const logPrefix = ctx.request.headers['x-cron-source'] === 'docker' ? '[Pinterest Cron Docker]' : '[Pinterest Manual]';
      strapi.log.error(`${logPrefix} Erreur lors du traitement de la queue:`, error);
      return ctx.internalServerError('Erreur lors du traitement de la queue', {
        error: error.message,
      });
    }
  },
};

