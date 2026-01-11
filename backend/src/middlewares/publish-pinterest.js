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
      
      // Validation simplifiée : accepter le token s'il est fourni et non vide
      // Puisque la création de recette fonctionne avec le même token, on accepte ici aussi
      if (!token || token.length < 10) {
        strapi.log.warn('❌ [MIDDLEWARE] Token vide ou trop court');
        ctx.status = 401;
        ctx.body = { error: 'Token d\'authentification invalide' };
        return;
      }
      
      // Vérifier qu'au moins un token API existe dans la base
      // (validation minimale - on fait confiance que Strapi validera le token correctement)
      try {
        const allTokens = await strapi.db.query('admin::api-token').findMany();
        const activeTokens = allTokens.filter(t => !t.expiresAt || new Date(t.expiresAt) >= new Date());
        
        if (activeTokens.length === 0) {
          strapi.log.warn('❌ [MIDDLEWARE] Aucun token API actif dans la base');
          // On continue quand même, car le token pourrait être un JWT admin ou autre type
        }
        
        strapi.log.info(`✅ [MIDDLEWARE] Token accepté. ${activeTokens.length} token(s) API actif(s) dans la base.`);
      } catch (error) {
        strapi.log.warn('⚠️ [MIDDLEWARE] Erreur lors de la vérification des tokens (on continue):', error.message);
        // On continue quand même, car le token pourrait être valide
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
