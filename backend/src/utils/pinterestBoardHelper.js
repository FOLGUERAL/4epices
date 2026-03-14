'use strict';

/**
 * Utilitaires pour récupérer les informations de boards Pinterest
 */

const axios = require('axios');
const { getPinterestAuth } = require('./pinterestAuthStore');

/**
 * Parse une URL Pinterest pour extraire username et board name
 * 
 * Formats supportés:
 * - https://www.pinterest.fr/username/board-name/
 * - https://www.pinterest.com/username/board-name/
 * - https://pinterest.fr/username/board-name/
 * - pinterest.fr/username/board-name
 * 
 * @param {string} url - URL du board Pinterest
 * @returns {Object|null} - { username, boardName } ou null si invalide
 */
function parsePinterestBoardUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Nettoyer l'URL
  let cleanUrl = url.trim();
  
  // Ajouter https:// si manquant
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  // Pattern pour extraire username et board name
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|fr|co\.uk|de|es|it|nl|pl|pt|ru|se|tr|au|ca|jp|kr|in|br|mx)\/([^\/]+)\/([^\/\?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|fr)\/([^\/]+)\/([^\/\?]+)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match.length >= 3) {
      return {
        username: match[1],
        boardName: match[2].replace(/\/$/, ''), // Retirer le slash final
        fullUrl: cleanUrl,
      };
    }
  }

  return null;
}

/**
 * Récupère le board ID depuis l'API Pinterest en utilisant username et board name
 * 
 * @param {string} username - Nom d'utilisateur Pinterest
 * @param {string} boardName - Nom du board (slug)
 * @param {Object} options - Options (accessToken, useSandbox)
 * @returns {Promise<Object>} - { boardId, boardName, description, ... }
 */
async function getBoardIdFromUsernameAndName(username, boardName, options = {}) {
  const { 
    accessToken = null,
    useSandbox = process.env.PINTEREST_USE_SANDBOX !== 'false'
  } = options;

  // Récupérer le token
  const oauthAccessToken = getPinterestAuth()?.accessToken;
  const token = accessToken || oauthAccessToken || process.env.PINTEREST_ACCESS_TOKEN;

  if (!token) {
    throw new Error('Token Pinterest manquant. Configurez PINTEREST_ACCESS_TOKEN ou connectez-vous via OAuth.');
  }

  const apiBaseUrl = useSandbox 
    ? 'https://api-sandbox.pinterest.com'
    : 'https://api.pinterest.com';

  try {
    // Méthode 1: Lister tous les boards de l'utilisateur et trouver celui qui correspond
    // Note: L'API Pinterest v5 nécessite souvent le board_id directement
    // On va d'abord essayer de récupérer les boards de l'utilisateur
    
    // Récupérer les informations de l'utilisateur
    const userResponse = await axios.get(
      `${apiBaseUrl}/v5/user_account`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10_000,
      }
    );

    const usernameFromApi = userResponse.data?.username;
    
    // Si le username ne correspond pas, on ne peut pas continuer
    if (usernameFromApi && usernameFromApi.toLowerCase() !== username.toLowerCase()) {
      throw new Error(`Le username "${username}" ne correspond pas au compte associé au token (${usernameFromApi})`);
    }

    // Récupérer tous les boards de l'utilisateur
    const boardsResponse = await axios.get(
      `${apiBaseUrl}/v5/boards`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page_size: 250, // Maximum
        },
        timeout: 10_000,
      }
    );

    const boards = boardsResponse.data?.items || [];
    
    // Chercher le board qui correspond au nom
    const boardNameLower = boardName.toLowerCase().replace(/-/g, ' ');
    const matchingBoard = boards.find(board => {
      const boardNameFromApi = (board.name || '').toLowerCase().replace(/-/g, ' ');
      const boardIdFromApi = board.id || '';
      
      // Comparer le nom ou le slug
      return boardNameFromApi === boardNameLower || 
             boardIdFromApi.includes(boardName) ||
             board.name?.toLowerCase() === boardNameLower;
    });

    if (matchingBoard) {
      return {
        boardId: matchingBoard.id,
        boardName: matchingBoard.name,
        description: matchingBoard.description,
        privacy: matchingBoard.privacy,
        pinCount: matchingBoard.pin_count,
      };
    }

    // Si pas trouvé, essayer avec le board_id directement si le boardName ressemble à un ID
    if (boardName.match(/^\d+$/)) {
      try {
        const boardResponse = await axios.get(
          `${apiBaseUrl}/v5/boards/${boardName}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 10_000,
          }
        );

        return {
          boardId: boardResponse.data.id,
          boardName: boardResponse.data.name,
          description: boardResponse.data.description,
          privacy: boardResponse.data.privacy,
          pinCount: boardResponse.data.pin_count,
        };
      } catch (error) {
        // Ignorer si le board n'existe pas
      }
    }

    throw new Error(`Board "${boardName}" non trouvé pour l'utilisateur "${username}"`);
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(
        `Erreur API Pinterest (${status}): ${data?.message || JSON.stringify(data)}`
      );
    }
    throw error;
  }
}

/**
 * Récupère le board ID depuis une URL Pinterest
 * 
 * @param {string} url - URL du board Pinterest
 * @param {Object} options - Options (accessToken, useSandbox)
 * @returns {Promise<Object>} - { boardId, boardName, description, ... }
 */
async function getBoardIdFromUrl(url, options = {}) {
  const parsed = parsePinterestBoardUrl(url);
  
  if (!parsed) {
    throw new Error(`URL Pinterest invalide: ${url}`);
  }

  return await getBoardIdFromUsernameAndName(parsed.username, parsed.boardName, options);
}

/**
 * Liste tous les boards de l'utilisateur connecté
 * 
 * @param {Object} options - Options (accessToken, useSandbox)
 * @returns {Promise<Array>} - Liste des boards
 */
async function listUserBoards(options = {}) {
  const { 
    accessToken = null,
    useSandbox = process.env.PINTEREST_USE_SANDBOX !== 'false'
  } = options;

  const oauthAccessToken = getPinterestAuth()?.accessToken;
  const token = accessToken || oauthAccessToken || process.env.PINTEREST_ACCESS_TOKEN;

  if (!token) {
    throw new Error('Token Pinterest manquant.');
  }

  const apiBaseUrl = useSandbox 
    ? 'https://api-sandbox.pinterest.com'
    : 'https://api.pinterest.com';

  try {
    const response = await axios.get(
      `${apiBaseUrl}/v5/boards`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page_size: 250,
        },
        timeout: 10_000,
      }
    );

    return response.data?.items || [];
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(
        `Erreur API Pinterest (${status}): ${data?.message || JSON.stringify(data)}`
      );
    }
    throw error;
  }
}

module.exports = {
  parsePinterestBoardUrl,
  getBoardIdFromUsernameAndName,
  getBoardIdFromUrl,
  listUserBoards,
};
