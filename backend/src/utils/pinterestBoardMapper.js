'use strict';

/**
 * Service de mapping catégories → boards Pinterest
 */

/**
 * Récupère le board ID Pinterest pour une recette
 * Priorité: board de la première catégorie > board par défaut (env)
 */
async function getBoardIdForRecette(strapi, recette) {
  const recetteData = recette.attributes || recette;
  const categories = recetteData.categories?.data || recetteData.categories || [];
  
  // Si la recette a des catégories, chercher le board de la première catégorie
  if (categories.length > 0) {
    const firstCategory = categories[0];
    const categoryId = firstCategory.id || firstCategory;
    
    try {
      const category = await strapi.entityService.findOne('api::categorie.categorie', categoryId, {
        fields: ['pinterestBoardId'],
      });
      
      if (category?.pinterestBoardId) {
        strapi.log.info(`[Pinterest] Board trouvé via catégorie: ${category.pinterestBoardId}`);
        return category.pinterestBoardId;
      }
    } catch (error) {
      strapi.log.warn(`[Pinterest] Erreur lors de la récupération de la catégorie:`, error.message);
    }
  }
  
  // Fallback: board par défaut depuis les variables d'environnement
  const defaultBoardId = process.env.PINTEREST_BOARD_ID;
  if (defaultBoardId) {
    strapi.log.info(`[Pinterest] Utilisation du board par défaut: ${defaultBoardId}`);
    return defaultBoardId;
  }
  
  throw new Error('Aucun board Pinterest configuré. Configurez PINTEREST_BOARD_ID ou ajoutez un pinterestBoardId à une catégorie.');
}

module.exports = {
  getBoardIdForRecette,
};
