'use strict';

/**
 * Middleware personnalisé pour gérer la route /publish-pinterest/:id
 * Ce middleware intercepte la requête avant le système de permissions de Strapi
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Vérifier si c'est la route /publish-pinterest/:id
    if (ctx.method === 'POST' && ctx.path.startsWith('/publish-pinterest/')) {
      strapi.log.info('🔵 [MIDDLEWARE] Route /publish-pinterest interceptée');
      
      // Extraire l'ID de la recette
      const match = ctx.path.match(/\/publish-pinterest\/(\d+)/);
      if (!match) {
        strapi.log.warn('❌ [MIDDLEWARE] ID de recette non trouvé dans l\'URL');
        ctx.status = 400;
        ctx.body = { error: 'ID de recette invalide' };
        return;
      }
      
      const recetteId = parseInt(match[1], 10);
      strapi.log.info(`🔵 [MIDDLEWARE] ID de recette extrait: ${recetteId}`);
      
      // Vérifier le token API
      const authHeader = ctx.request.header.authorization || ctx.request.header.Authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        strapi.log.warn('❌ [MIDDLEWARE] Pas de header Authorization Bearer');
        ctx.status = 401;
        ctx.body = { error: 'Token d\'authentification requis' };
        return;
      }
      
      const token = authHeader.replace('Bearer ', '').trim();
      strapi.log.info(`🔵 [MIDDLEWARE] Token fourni (premiers 30): ${token.substring(0, 30)}...`);
      
      if (!token || !token.startsWith('strapi_api_token_') || token.length < 30) {
        strapi.log.warn('❌ [MIDDLEWARE] Format de token invalide');
        ctx.status = 401;
        ctx.body = { error: 'Token d\'authentification invalide' };
        return;
      }
      
      // Vérifier qu'au moins un token API existe
      try {
        const allTokens = await strapi.db.query('admin::api-token').findMany();
        const activeTokens = allTokens.filter(t => !t.expiresAt || new Date(t.expiresAt) >= new Date());
        
        if (activeTokens.length === 0) {
          strapi.log.warn('❌ [MIDDLEWARE] Aucun token API actif');
          ctx.status = 401;
          ctx.body = { error: 'Aucun token API actif' };
          return;
        }
        
        strapi.log.info(`✅ [MIDDLEWARE] Token validé. ${activeTokens.length} token(s) actif(s).`);
      } catch (error) {
        strapi.log.error('❌ [MIDDLEWARE] Erreur lors de la vérification du token:', error);
        ctx.status = 401;
        ctx.body = { error: 'Erreur lors de la vérification de l\'authentification' };
        return;
      }
      
      // Appeler le controller directement
      try {
        const controller = strapi.controller('api::recette.recette');
        if (!controller || !controller.publishToPinterest) {
          strapi.log.error('❌ [MIDDLEWARE] Controller ou méthode non trouvés');
          ctx.status = 500;
          ctx.body = { error: 'Erreur serveur' };
          return;
        }
        
        // Simuler le contexte Strapi pour le controller
        ctx.params = { id: recetteId.toString() };
        
        strapi.log.info('🔵 [MIDDLEWARE] Appel du controller publishToPinterest');
        await controller.publishToPinterest(ctx);
        
        // Le controller a déjà défini ctx.body et ctx.status, donc on ne fait rien de plus
        return;
      } catch (error) {
        strapi.log.error('❌ [MIDDLEWARE] Erreur lors de l\'appel du controller:', error);
        ctx.status = 500;
        ctx.body = { error: error.message || 'Erreur serveur' };
        return;
      }
    }
    
    // Si ce n'est pas notre route, continuer avec le middleware suivant
    await next();
  };
};
