#!/usr/bin/env node
/**
 * Recopie le champ legacy `ingredients_lignes` (ou `ingredientsLignes`) vers `ingredients` (JSON).
 * N'utilise pas Strapi.load() pour éviter qu'une sync de schéma supprime la colonne source
 * si elle n'est plus déclarée dans schema.json.
 *
 * Usage (depuis la racine du backend) :
 *   node scripts/migrate-ingredients-lignes.js --dry-run
 *   node scripts/migrate-ingredients-lignes.js
 *   node scripts/migrate-ingredients-lignes.js --force
 *
 * --dry-run : affiche les changements sans écrire
 * --force   : écrase `ingredients` même s'il est déjà rempli
 * Variable d'environnement optionnelle :
 *   MIGRATE_SOURCE_COLUMN=nom_exact_colonne
 *   (si Strapi utilisait un autre nom ; la colonne doit exister sur `recettes`)
 *
 * Récupérer une colonne supprimée du schéma actuel :
 *   Restaurer le dump dans une base **temporaire**, pointer DATABASE_* vers elle,
 *   lancer ce script, puis exporter/copier la colonne `ingredients` mise à jour
 *   vers la prod (ou réinjecter via SQL) — la prod sans la colonne source ne peut
 *   pas lire d'anciennes données absentes du disque.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..');

function loadDotenv() {
  const envPath = path.join(BACKEND_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseJsonMaybe(val) {
  if (val == null) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return val;
    }
  }
  return val;
}

function hasMeaningfulIngredients(ing) {
  const p = parseJsonMaybe(ing);
  if (p == null) return false;
  if (Array.isArray(p)) return p.length > 0;
  if (typeof p === 'object') return Object.keys(p).length > 0;
  if (typeof p === 'string') return p.trim().length > 0;
  return false;
}

function parseQuantiteIngredient(line) {
  const m = line.match(
    /^([\d\s.,\/]+(?:g|kg|ml|cl|l|L|mg|c\.?à\s*s\.?|cuillères?|cs|c\.?à\s*c\.?|cc|tasse|tsp|tbsp)?)\s+(.+)$/i
  );
  if (m) {
    return { quantite: m[1].trim(), ingredient: m[2].trim() };
  }
  return null;
}

function normalizeFromLignes(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw) && raw !== null) {
    raw = [raw];
  }
  let data = raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    if (
      (s.startsWith('[') && s.endsWith(']')) ||
      (s.startsWith('{') && s.endsWith('}'))
    ) {
      try {
        data = JSON.parse(s);
      } catch {
        data = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      }
    } else {
      data = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(data)) return null;
  const out = [];
  for (const item of data) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const parsed = parseQuantiteIngredient(trimmed);
      out.push(parsed || trimmed);
    } else if (item && typeof item === 'object') {
      const q =
        item.quantite ?? item.quantity ?? item.qty ?? item.q ?? '';
      const ing =
        item.ingredient ?? item.libelle ?? item.nom ?? item.name ?? item.label ?? item.line ?? '';
      const line = `${String(q).trim()} ${String(ing).trim()}`.trim();
      if (line) {
        const parsed = parseQuantiteIngredient(line);
        out.push(parsed || line);
      }
    }
  }
  return out.length ? out : null;
}

function pickLignesColumn(nameSet, allNamesSorted) {
  const explicit = (process.env.MIGRATE_SOURCE_COLUMN || '').trim();
  if (explicit) {
    if (nameSet.has(explicit)) return explicit;
    console.error(
      `MIGRATE_SOURCE_COLUMN="${explicit}" : colonne absente sur la table recettes.`
    );
    return null;
  }
  if (nameSet.has('ingredients_lignes')) return 'ingredients_lignes';
  if (nameSet.has('ingredientsLignes')) return 'ingredientsLignes';

  const fuzzy = allNamesSorted.filter(
    (n) => /ingredient/i.test(n) && /ligne/i.test(n)
  );
  if (fuzzy.length === 1) {
    console.log(
      'Colonne source déduite (nom contenant "ingredient" et "ligne") :',
      fuzzy[0]
    );
    return fuzzy[0];
  }
  return null;
}

/** Identifiant SQL Postgres / SQLite : quote si besoin (camelCase, etc.) */
function sqlQuotedIdent(col) {
  if (/^[a-z_][a-z0-9_]*$/.test(col)) return col;
  return '"' + String(col).replace(/"/g, '""') + '"';
}

function detectLignesColumnSqlite(db) {
  const cols = db.prepare('PRAGMA table_info(recettes)').all();
  const allNames = cols.map((c) => c.name);
  const nameSet = new Set(allNames);
  const col = pickLignesColumn(nameSet, [...allNames].sort());
  if (!col) {
    console.error(
      'Colonnes actuelles sur recettes :',
      allNames.sort().join(', ') || '(aucune / table absente)'
    );
  }
  return col;
}

function runSqlite({ dryRun, force }) {
  const Database = require('better-sqlite3');
  const filename = process.env.DATABASE_FILENAME || '.tmp/data.db';
  const dbPath = path.isAbsolute(filename)
    ? filename
    : path.join(BACKEND_ROOT, filename);
  if (!fs.existsSync(dbPath)) {
    console.error('Fichier SQLite introuvable :', dbPath);
    process.exit(1);
  }
  const db = new Database(dbPath);
  const col = detectLignesColumnSqlite(db);
  if (!col) {
    console.error(
      'Aucune colonne ingredients_lignes / ingredientsLignes sur la table recettes.'
    );
    process.exit(1);
  }
  console.log('Colonne source :', col);

  const sqlCol = sqlQuotedIdent(col);
  const rows = db
    .prepare(`SELECT id, titre, ingredients AS ing, ${sqlCol} AS lignes FROM recettes`)
    .all();

  const updateStmt = db.prepare(
    'UPDATE recettes SET ingredients = @ingredients WHERE id = @id'
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const lignesVal = row.lignes;
    if (lignesVal == null || lignesVal === '') {
      skipped++;
      continue;
    }
    const next = normalizeFromLignes(lignesVal);
    if (!next) {
      skipped++;
      continue;
    }
    const ingHas = hasMeaningfulIngredients(row.ing);
    if (ingHas && !force) {
      console.log(`#${row.id} ${row.titre || ''} — skip (ingredients déjà rempli, utiliser --force)`);
      skipped++;
      continue;
    }
    const jsonStr = JSON.stringify(next);
    if (dryRun) {
      console.log(
        `[dry-run] #${row.id} ${row.titre || ''} → ${next.length} ligne(s)`
      );
    } else {
      updateStmt.run({ id: row.id, ingredients: jsonStr });
      console.log(`✓ #${row.id} ${row.titre || ''} (${next.length} ingrédients)`);
    }
    updated++;
  }

  db.close();

  console.log(
    `\nTerminé. ${dryRun ? 'Simulation' : 'Écrit'} : ${updated} recette(s), ignorées : ${skipped}.`
  );
}

async function runPostgres({ dryRun, force }) {
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || '4epices',
    user: process.env.DATABASE_USERNAME || 'strapi',
    password: process.env.DATABASE_PASSWORD || 'strapi',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    const { rows: cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recettes'
    `);
    const sorted = cols.map((c) => c.column_name).sort();
    const nameSet = new Set(sorted);
    let col = pickLignesColumn(nameSet, sorted);
    if (!col) {
      console.error(
        'Aucune colonne ingredients_lignes / ingredientsLignes sur recettes.'
      );
      console.error('Colonnes disponibles :', sorted.join(', ') || '(aucune)');
      console.error(
        '\nSi la donnée est seulement dans un backup : restaure le dump dans une base temporaire, vérifie le nom exact avec \\d recettes ou information_schema, puis :\n' +
          '  MIGRATE_SOURCE_COLUMN=nom_exact docker exec ... node scripts/migrate-ingredients-lignes.js --dry-run'
      );
      process.exit(1);
    }
    console.log('Colonne source :', col);

    const sqlCol = sqlQuotedIdent(col);
    const { rows } = await client.query(
      `SELECT id, titre, ingredients AS ing, ${sqlCol} AS lignes FROM recettes`
    );

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (row.lignes == null || row.lignes === '') {
        skipped++;
        continue;
      }
      const next = normalizeFromLignes(row.lignes);
      if (!next) {
        skipped++;
        continue;
      }
      if (hasMeaningfulIngredients(row.ing) && !force) {
        console.log(
          `#${row.id} ${row.titre || ''} — skip (ingredients déjà rempli, utiliser --force)`
        );
        skipped++;
        continue;
      }
      const jsonStr = JSON.stringify(next);
      if (dryRun) {
        console.log(
          `[dry-run] #${row.id} ${row.titre || ''} → ${next.length} ligne(s)`
        );
      } else {
        await client.query(
          'UPDATE recettes SET ingredients = $1 WHERE id = $2',
          [jsonStr, row.id]
        );
        console.log(`✓ #${row.id} ${row.titre || ''} (${next.length} ingrédients)`);
      }
      updated++;
    }

    console.log(
      `\nTerminé. ${dryRun ? 'Simulation' : 'Écrit'} : ${updated} recette(s), ignorées : ${skipped}.`
    );
  } finally {
    await client.end();
  }
}

async function main() {
  loadDotenv();
  process.chdir(BACKEND_ROOT);

  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const client = process.env.DATABASE_CLIENT || 'sqlite';
  console.log('DATABASE_CLIENT =', client);
  if (dryRun) console.log('Mode --dry-run (aucune écriture)\n');

  if (client === 'postgres' || client === 'postgresql') {
    await runPostgres({ dryRun, force });
  } else {
    runSqlite({ dryRun, force });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
