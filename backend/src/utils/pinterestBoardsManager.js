'use strict';

const { getBoardIdForRecette } = require('./pinterestBoardMapper');

/**
 * Service de gestion des boards Pinterest multiples
 * Gère la rotation entre 3 boards : principale, catégorie, autre
 */

/**
 * Détermine la saison actuelle
 * @returns {String} 'printemps', 'ete', 'automne', 'hiver'
 */
function getCurrentSeason() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12 (janvier = 1)
  const day = now.getDate(); // 1-31
  
  // Définition des saisons (hémisphère nord)
  // Printemps : 21 mars - 20 juin
  // Été : 21 juin - 22 septembre
  // Automne : 23 septembre - 20 décembre
  // Hiver : 21 décembre - 20 mars
  
  if ((month === 3 && day >= 21) || month === 4 || month === 5 || (month === 6 && day <= 20)) {
    return 'printemps';
  } else if ((month === 6 && day >= 21) || month === 7 || month === 8 || (month === 9 && day <= 22)) {
    return 'ete';
  } else if ((month === 9 && day >= 23) || month === 10 || month === 11 || (month === 12 && day <= 20)) {
    return 'automne';
  } else {
    return 'hiver';
  }
}

/**
 * Détermine quel board saisonnier utiliser selon la saison
 * @param {Object} strapi - Instance Strapi
 * @returns {String|null} Board ID saisonnier ou null
 */
function getSeasonalBoard(strapi) {
  const season = getCurrentSeason();
  
  // Board pour automne/hiver
  const boardAutomneHiver = process.env.PINTEREST_BOARD_SEASONAL_AUTOMNE_HIVER;
  // Board pour printemps/été
  const boardPrintempsEte = process.env.PINTEREST_BOARD_SEASONAL_PRINTEMPS_ETE;
  
  // Automne ou hiver → board automne/hiver
  if ((season === 'automne' || season === 'hiver') && boardAutomneHiver) {
    strapi.log.info(`[Pinterest Boards] Saison ${season} détectée, utilisation du board automne/hiver: ${boardAutomneHiver}`);
    return boardAutomneHiver;
  }
  
  // Printemps ou été → board printemps/été
  if ((season === 'printemps' || season === 'ete') && boardPrintempsEte) {
    strapi.log.info(`[Pinterest Boards] Saison ${season} détectée, utilisation du board printemps/été: ${boardPrintempsEte}`);
    return boardPrintempsEte;
  }
  
  return null;
}

/**
 * Récupère les 3 boards pour une recette
 * @param {Object} strapi - Instance Strapi
 * @param {Object} recette - La recette
 * @returns {Promise<Object>} { boardPrincipal, boardCategorie, boardAutre }
 */
async function getThreeBoardsForRecette(strapi, recette) {
  const recetteData = recette.attributes || recette;
  
  // Board principale : board par défaut (PINTEREST_BOARD_ID)
  const boardPrincipal = process.env.PINTEREST_BOARD_ID;
  
  // Board catégorie : board de la première catégorie (via pinterestBoardMapper)
  let boardCategorie = null;
  try {
    boardCategorie = await getBoardIdForRecette(strapi, recette);
    // Si c'est le même que le board principal, on cherche une alternative
    if (boardCategorie === boardPrincipal) {
      // Chercher une autre catégorie avec un board différent
      const categories = recetteData.categories?.data || recetteData.categories || [];
      for (const category of categories) {
        const categoryId = category.id || category;
        try {
          const cat = await strapi.entityService.findOne('api::categorie.categorie', categoryId, {
            fields: ['pinterestBoardId'],
          });
          if (cat?.pinterestBoardId && cat.pinterestBoardId !== boardPrincipal) {
            boardCategorie = cat.pinterestBoardId;
            break;
          }
        } catch (error) {
          // Continuer avec la catégorie suivante
        }
      }
    }
  } catch (error) {
    strapi.log.warn('[Pinterest Boards] Erreur lors de la récupération du board catégorie:', error.message);
  }
  
  // Board "autre" : board saisonnier ou secondaire
  // 1. Priorité : board saisonnier selon la saison (automne/hiver ou printemps/été)
  // 2. Fallback : board secondaire (PINTEREST_BOARD_SECONDARY)
  // 3. Dernier recours : board principal
  let boardAutre = boardPrincipal;
  
  // Essayer d'abord le board saisonnier
  const seasonalBoard = getSeasonalBoard(strapi);
  if (seasonalBoard) {
    boardAutre = seasonalBoard;
  } else if (process.env.PINTEREST_BOARD_SECONDARY) {
    // Fallback sur board secondaire si aucun board saisonnier configuré
    boardAutre = process.env.PINTEREST_BOARD_SECONDARY;
    strapi.log.info(`[Pinterest Boards] Aucun board saisonnier configuré pour la saison ${getCurrentSeason()}, utilisation du board secondaire: ${boardAutre}`);
  }
  
  // Si tous les boards sont identiques, utiliser le board principal pour tous
  if (boardCategorie === boardPrincipal && boardAutre === boardPrincipal) {
    strapi.log.info('[Pinterest Boards] Un seul board disponible, utilisation du board principal pour tous les pins');
    return {
      boardPrincipal,
      boardCategorie: boardPrincipal,
      boardAutre: boardPrincipal,
    };
  }
  
  return {
    boardPrincipal,
    boardCategorie: boardCategorie || boardPrincipal,
    boardAutre,
  };
}

/**
 * Détermine quel board utiliser pour un pin selon son index
 * Rotation : 0,2 → principal | 1,3,5 → catégorie | 4,6 → autre
 * @param {Object} boards - Les 3 boards disponibles
 * @param {Number} pinIndex - Index du pin (0-6)
 * @returns {String} Board ID à utiliser
 */
function getBoardForPinIndex(boards, pinIndex) {
  // Rotation selon le nouveau schéma :
  // Pin 0,2 → principal | Pin 1,3,5 → catégorie | Pin 4,6 → autre
  if (pinIndex === 0 || pinIndex === 2) {
    return boards.boardPrincipal;
  } else if (pinIndex === 1 || pinIndex === 3 || pinIndex === 5) {
    return boards.boardCategorie;
  } else {
    // pinIndex === 4 || pinIndex === 6
    return boards.boardAutre;
  }
}

module.exports = {
  getThreeBoardsForRecette,
  getBoardForPinIndex,
};
