#!/usr/bin/env node

/**
 * Script pour récupérer le board ID Pinterest depuis une URL
 * 
 * Usage:
 *   node scripts/get-pinterest-board-id.js "https://www.pinterest.fr/username/board-name/"
 *   node scripts/get-pinterest-board-id.js --list
 *   node scripts/get-pinterest-board-id.js --username username --board "board name"
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { 
  getBoardIdFromUrl, 
  listUserBoards,
  parsePinterestBoardUrl 
} = require('../src/utils/pinterestBoardHelper');

async function main() {
  const args = process.argv.slice(2);

  // Mode liste : afficher tous les boards
  if (args.includes('--list') || args.includes('-l')) {
    try {
      console.log('📋 Récupération de vos boards Pinterest...\n');
      const boards = await listUserBoards();
      
      if (boards.length === 0) {
        console.log('❌ Aucun board trouvé.');
        return;
      }

      console.log(`✅ ${boards.length} board(s) trouvé(s):\n`);
      boards.forEach((board, index) => {
        console.log(`${index + 1}. ${board.name}`);
        console.log(`   ID: ${board.id}`);
        console.log(`   URL: https://www.pinterest.fr/${board.owner?.username || 'username'}/${board.name.toLowerCase().replace(/\s+/g, '-')}/`);
        if (board.description) {
          console.log(`   Description: ${board.description.substring(0, 100)}`);
        }
        console.log(`   Pins: ${board.pin_count || 0}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
    return;
  }

  // Mode avec username et board name
  const usernameIndex = args.indexOf('--username') || args.indexOf('-u');
  const boardIndex = args.indexOf('--board') || args.indexOf('-b');
  
  if (usernameIndex !== -1 && boardIndex !== -1) {
    const username = args[usernameIndex + 1];
    const boardName = args[boardIndex + 1];
    
    if (!username || !boardName) {
      console.error('❌ Usage: --username <username> --board <board-name>');
      process.exit(1);
    }

    try {
      const { getBoardIdFromUsernameAndName } = require('../src/utils/pinterestBoardHelper');
      const result = await getBoardIdFromUsernameAndName(username, boardName);
      
      console.log('\n✅ Board trouvé!\n');
      console.log(`📌 Nom: ${result.boardName}`);
      console.log(`🆔 ID: ${result.boardId}`);
      console.log(`\n💡 Ajoutez ceci dans votre .env ou dans une catégorie:`);
      console.log(`PINTEREST_BOARD_ID=${result.boardId}`);
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
    return;
  }

  // Mode avec URL (par défaut)
  const url = args[0];
  
  if (!url) {
    console.log(`
📌 Récupération du Board ID Pinterest

Usage:
  node scripts/get-pinterest-board-id.js <url>
  node scripts/get-pinterest-board-id.js --list
  node scripts/get-pinterest-board-id.js --username <username> --board <board-name>

Exemples:
  node scripts/get-pinterest-board-id.js "https://www.pinterest.fr/username/board-name/"
  node scripts/get-pinterest-board-id.js --list
  node scripts/get-pinterest-board-id.js -u username -b "board name"

Variables d'environnement requises:
  PINTEREST_ACCESS_TOKEN (ou connexion OAuth)
    `);
    process.exit(1);
  }

  // Vérifier que l'URL est valide
  const parsed = parsePinterestBoardUrl(url);
  if (!parsed) {
    console.error(`❌ URL invalide: ${url}`);
    console.error('\nFormat attendu: https://www.pinterest.fr/username/board-name/');
    process.exit(1);
  }

  try {
    console.log(`🔍 Recherche du board ID pour: ${url}\n`);
    console.log(`   Username: ${parsed.username}`);
    console.log(`   Board: ${parsed.boardName}\n`);

    const result = await getBoardIdFromUrl(url);

    console.log('✅ Board trouvé!\n');
    console.log(`📌 Nom: ${result.boardName}`);
    console.log(`🆔 ID: ${result.boardId}`);
    if (result.description) {
      console.log(`📝 Description: ${result.description}`);
    }
    console.log(`📊 Pins: ${result.pinCount || 0}`);
    console.log(`\n💡 Ajoutez ceci dans votre .env ou dans une catégorie:`);
    console.log(`PINTEREST_BOARD_ID=${result.boardId}`);
    console.log(`\nOu dans le champ pinterestBoardId d'une catégorie:`);
    console.log(`${result.boardId}`);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n💡 Vérifiez que:');
    console.error('   - PINTEREST_ACCESS_TOKEN est configuré dans .env');
    console.error('   - Le token a les permissions nécessaires');
    console.error('   - L\'URL du board est correcte');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
