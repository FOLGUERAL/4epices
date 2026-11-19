#!/usr/bin/env node
/**
 * Copie le repeatable component `ingredientsLignes` vers le champ JSON `ingredients`.
 * À exécuter là où le schéma Strapi **correspond à la base** (ex. conteneur prod avec
 * `schema.json` + définitions des composants présentes). Un décalage schéma ↔ DB peut
 * déclencher une sync destructive au bootstrap — ne pas pointer une prod depuis un
 * clone git sans les mêmes attributs `ingredientsLignes`.
 *
 * Usage (depuis la racine du backend, après `cd` + `.env` correct) :
 *   node scripts/migrate-ingredients-lignes-strapi.js --dry-run
 *   node scripts/migrate-ingredients-lignes-strapi.js
 *   node scripts/migrate-ingredients-lignes-strapi.js --force
 *   node scripts/migrate-ingredients-lignes-strapi.js --only-id=42 --dry-run
 *
 * --dry-run              : rien n'est écrit
 * --force                : remplace `ingredients` même s'il est déjà non vide
 * --only-id=N            : traiter une seule recette (id document Strapi)
 * --verbose              : affiche un exemple de lignes component pour la 1re recette migrée
 * --use-entity-service   : rare — utilise entityService.update (lifecycles Strapi).
 *   Sur certaines versions, un tableau JSON d'objets peut provoquer
 *   "Invalid id … got [object Object]" malgré type=json ; par défaut ce script
 *   écrit la colonne SQL `ingredients` via Knex (pas de lifecycles).
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

function parseQuantiteIngredient(line) {
  const m = line.match(
    /^([\d\s.,\/]+(?:g|kg|ml|cl|l|L|mg|c\.?à\s*s\.?|cuillères?|cs|c\.?à\s*c\.?|cc|tasse|tsp|tbsp)?)\s+(.+)$/i
  );
  if (m) {
    return { quantite: m[1].trim(), ingredient: m[2].trim() };
  }
  return null;
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
  if (typeof p === 'object' && !Array.isArray(p)) return Object.keys(p).length > 0;
  if (typeof p === 'string') return p.trim().length > 0;
  return false;
}

/**
 * Aplatit une entrée de composant Strapi (parfois { id, __component, ...attrs } ou { attributes }).
 */
function flattenComponentEntry(row) {
  if (!row || typeof row !== 'object') return {};
  if (row.attributes && typeof row.attributes === 'object') {
    return { ...row.attributes };
  }
  const copy = { ...row };
  delete copy.id;
  delete copy.documentId;
  delete copy.__component;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.createdBy;
  delete copy.updatedBy;
  return copy;
}

function componentRowsToIngredients(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const out = [];
  for (const row of rows) {
    const flat = flattenComponentEntry(row);
    const q =
      flat.quantite ??
      flat.quantity ??
      flat.qty ??
      flat.amount ??
      flat.q ??
      '';
    const ing =
      flat.ingredient ??
      flat.libelle ??
      flat.nom ??
      flat.name ??
      flat.label ??
      flat.texte ??
      flat.text ??
      flat.ligne ??
      flat.line ??
      flat.value ??
      '';
    const qs = String(q).trim();
    const is = String(ing).trim();
    if (!qs && !is) continue;
    if (qs && is) {
      out.push({ quantite: qs, ingredient: is });
    } else {
      const line = (qs || is).trim();
      const parsed = parseQuantiteIngredient(line);
      out.push(parsed || line);
    }
  }
  return out.length ? out : null;
}

function parseArgs(argv) {
  let onlyId = null;
  for (const a of argv) {
    const m = /^--only-id=(\d+)$/.exec(a);
    if (m) onlyId = Number(m[1], 10);
  }
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    verbose: argv.includes('--verbose'),
    useEntityService: argv.includes('--use-entity-service'),
    onlyId,
  };
}

/** Type Strapi du champ ingredients (souvent json ; si relation → entityService rejette un tableau d'objets). */
function ingredientsStrapiType(attrs) {
  return attrs?.ingredients?.type || '(absent)';
}

/**
 * Met à jour uniquement la colonne ingredients (JSON en base), sans passer par les relations Strapi.
 * Ne déclenche pas les lifecycles (beforeUpdate / afterUpdate).
 */
async function writeIngredientsColumn(strapi, uid, recetteId, next, { dryRun }) {
  if (dryRun) return;
  const model = strapi.getModel(uid);
  const table = model.collectionName;
  const knex = strapi.db.connection;
  const colInfo = await knex(table).columnInfo();
  if (!('ingredients' in colInfo)) {
    throw new Error(
      `Pas de colonne SQL "ingredients" sur la table "${table}". ` +
        `Le schéma Strapi ne peut pas stocker ce JSON via la base : corrige le content-type ` +
        `(champ ingredients de type JSON, comme sur le dépôt git) ou adapte le script.`
    );
  }
  const client = strapi.config.get('database.connection.client');
  /** Une seule sérialisation ; évite double encodage (erreur PG 22P02). */
  const payload = JSON.stringify(next);

  if (client === 'postgres' || client === 'postgresql') {
    await knex(table)
      .where({ id: recetteId })
      .update({ ingredients: knex.raw('?::jsonb', [payload]) });
  } else {
    await knex(table).where({ id: recetteId }).update({ ingredients: payload });
  }
}

async function updateRecetteIngredients(strapi, uid, recetteId, next, { dryRun, useEntityService, ingType }) {
  if (dryRun) return;

  if (useEntityService && ingType === 'json') {
    await strapi.entityService.update(uid, recetteId, {
      data: { ingredients: next },
    });
    return;
  }

  if (useEntityService && ingType !== 'json') {
    console.warn(
      `--use-entity-service ignoré : ingredients est de type "${ingType}" ; écriture Knex.`
    );
  }

  await writeIngredientsColumn(strapi, uid, recetteId, next, { dryRun });
}

async function main() {
  loadDotenv();
  process.chdir(BACKEND_ROOT);

  const { dryRun, force, verbose, onlyId, useEntityService } = parseArgs(process.argv.slice(2));
  const Strapi = require('@strapi/strapi');

  const uid = 'api::recette.recette';
  const app = await Strapi().load();

  try {
    const attrs = app.contentTypes[uid]?.attributes;
    if (!attrs?.ingredientsLignes) {
      console.error(
        'Le content-type recette n\'a pas d\'attribut ingredientsLignes. ' +
          'Déploie le même schéma que la prod (composant + champ) ou lance ce script dans le conteneur prod.'
      );
      await app.destroy();
      process.exit(1);
    }

    const ingType = ingredientsStrapiType(attrs);
    console.log(`Champ recette.ingredients (schéma Strapi) : type = ${ingType}`);
    if (useEntityService) {
      console.log(
        'Mode --use-entity-service : mise à jour via entityService (risque "Invalid id" avec JSON d\'objets ; lifecycles actifs).'
      );
    } else {
      console.log(
        'Écriture via SQL (Knex) sur la colonne ingredients — mode par défaut, sans lifecycles Strapi.'
      );
    }

    if (dryRun) console.log('Mode --dry-run (aucune écriture)\n');

    const filters = onlyId != null ? { id: onlyId } : {};

    const recettes = await app.entityService.findMany(uid, {
      filters,
      publicationState: 'preview',
      populate: { ingredientsLignes: true },
      limit: -1,
    });

    let updated = 0;
    let skipped = 0;
    let verboseShown = false;

    for (const r of recettes) {
      const lignes = r.ingredientsLignes;
      const next = componentRowsToIngredients(lignes);
      if (!next) {
        skipped++;
        continue;
      }

      if (hasMeaningfulIngredients(r.ingredients) && !force) {
        console.log(
          `#${r.id} ${r.titre || r.slug || ''} — skip (ingredients déjà rempli, utiliser --force)`
        );
        skipped++;
        continue;
      }

      if (verbose && !verboseShown) {
        console.log('Exemple ingredientsLignes (1re recette traitée) :', JSON.stringify(lignes?.slice?.(0, 3) ?? lignes, null, 2));
        verboseShown = true;
      }

      if (dryRun) {
        console.log(`[dry-run] #${r.id} ${r.titre || r.slug || ''} → ${next.length} ligne(s)`);
      } else {
        await updateRecetteIngredients(app, uid, r.id, next, {
          dryRun,
          useEntityService,
          ingType,
        });
        console.log(`✓ #${r.id} ${r.titre || r.slug || ''} (${next.length} ingrédients)`);
      }
      updated++;
    }

    console.log(
      `\nTerminé. ${dryRun ? 'Simulation' : 'Écrit'} : ${updated} recette(s), ignorées : ${skipped}.`
    );
  } finally {
    await app.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
