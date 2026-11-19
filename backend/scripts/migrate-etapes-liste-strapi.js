#!/usr/bin/env node
/**
 * Copie le repeatable component `etapesListe` vers le richtext `etapes` (HTML),
 * au format attendu par le frontend (cf. ingest/route.ts).
 *
 * Usage (racine backend, .env chargé, de préférence dans le conteneur Docker) :
 *   node scripts/migrate-etapes-liste-strapi.js --dry-run --verbose
 *   node scripts/migrate-etapes-liste-strapi.js
 *   node scripts/migrate-etapes-liste-strapi.js --force --only-id=19
 *
 * --dry-run              : aucune écriture
 * --force                : remplace `etapes` même s'il semble déjà rempli
 * --only-id=N            : une seule recette
 * --verbose              : extrait un exemple de composant + aperçu HTML
 * --use-entity-service   : mise à jour via entityService (lifecycles) ; défaut = Knex
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

function hasMeaningfulEtapes(etapes) {
  if (etapes == null) return false;
  const s = String(etapes)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 0;
}

/** Retire un HTML basique collé depuis un éditeur ; le script ré-encadre en <p>. */
function stripSimpleHtml(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Découpe un bloc où plusieurs « Étape N : » sont concaténés (cas fréquent : 1 ligne composant).
 */
function splitCombinedEtapesText(raw) {
  const text = raw.trim();
  if (!text) return [];

  const re = /étape\s*\d+\s*:\s*/giu;
  const idx = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    idx.push({ headStart: m.index, bodyStart: m.index + m[0].length });
  }
  if (idx.length === 0) {
    return [text];
  }

  const bodies = [];
  if (idx[0].headStart > 0) {
    const pre = text.slice(0, idx[0].headStart).trim();
    if (pre) bodies.push(pre);
  }
  for (let i = 0; i < idx.length; i++) {
    const start = idx[i].bodyStart;
    const end = i + 1 < idx.length ? idx[i + 1].headStart : text.length;
    const body = text.slice(start, end).trim();
    if (body) bodies.push(body);
  }
  return bodies.length ? bodies : [text];
}

function sortEtapeRows(rows) {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const fa = flattenComponentEntry(a.row);
      const fb = flattenComponentEntry(b.row);
      const oa = fa.ordre ?? fa.order ?? fa.numero ?? fa.position;
      const ob = fb.ordre ?? fb.order ?? fb.numero ?? fb.position;
      const na = oa != null && oa !== '' ? Number(oa) : NaN;
      const nb = ob != null && ob !== '' ? Number(ob) : NaN;
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      if (!Number.isNaN(na) && Number.isNaN(nb)) return -1;
      if (Number.isNaN(na) && !Number.isNaN(nb)) return 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}

function etapesListeRowsToStepStrings(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sorted = sortEtapeRows(rows);
  const allSteps = [];
  for (const row of sorted) {
    const flat = flattenComponentEntry(row);
    let raw =
      flat.texte ??
      flat.text ??
      flat.contenu ??
      flat.description ??
      flat.body ??
      flat.html ??
      '';
    raw = String(raw).trim();
    if (!raw) continue;
    raw = stripSimpleHtml(raw);
    const pieces = splitCombinedEtapesText(raw);
    for (const p of pieces) {
      const t = String(p).trim();
      if (t) allSteps.push(t);
    }
  }
  return allSteps.length ? allSteps : null;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stepsToEtapesHtml(steps) {
  return steps
    .map((body, index) => {
      const safe = escapeHtml(body);
      return `<p><strong>Étape ${index + 1} :</strong> ${safe}</p>`;
    })
    .join('\n');
}

async function writeEtapesColumn(strapi, uid, recetteId, html, { dryRun }) {
  if (dryRun) return;
  const model = strapi.getModel(uid);
  const table = model.collectionName;
  const knex = strapi.db.connection;
  const colInfo = await knex(table).columnInfo();
  if (!('etapes' in colInfo)) {
    throw new Error(
      `Pas de colonne SQL "etapes" sur "${table}". Vérifie le content-type recette.`
    );
  }
  await knex(table).where({ id: recetteId }).update({ etapes: html });
}

async function updateRecetteEtapes(strapi, uid, recetteId, html, { dryRun, useEntityService, etapesType }) {
  if (dryRun) return;

  if (useEntityService && etapesType === 'richtext') {
    await strapi.entityService.update(uid, recetteId, {
      data: { etapes: html },
    });
    return;
  }

  if (useEntityService && etapesType !== 'richtext') {
    console.warn(
      `--use-entity-service : type "etapes" = "${etapesType}", écriture Knex.`
    );
  }

  await writeEtapesColumn(strapi, uid, recetteId, html, { dryRun });
}

async function main() {
  loadDotenv();
  process.chdir(BACKEND_ROOT);

  const { dryRun, force, verbose, onlyId, useEntityService } = parseArgs(
    process.argv.slice(2)
  );
  const Strapi = require('@strapi/strapi');

  const uid = 'api::recette.recette';
  const app = await Strapi().load();

  try {
    const attrs = app.contentTypes[uid]?.attributes;
    if (!attrs?.etapesListe) {
      console.error(
        'Le content-type recette n\'a pas d\'attribut etapesListe. Lance ce script sur la prod / même schéma que l\'admin.'
      );
      await app.destroy();
      process.exit(1);
    }

    const etapesType = attrs?.etapes?.type || '(absent)';
    console.log(`Champ recette.etapes (schéma Strapi) : type = ${etapesType}`);
    if (useEntityService) {
      console.log('Mode --use-entity-service : entityService (lifecycles actifs).');
    } else {
      console.log('Écriture via Knex sur la colonne etapes — défaut, sans lifecycles.');
    }

    if (dryRun) console.log('Mode --dry-run (aucune écriture)\n');

    const filters = onlyId != null ? { id: onlyId } : {};

    const recettes = await app.entityService.findMany(uid, {
      filters,
      publicationState: 'preview',
      populate: { etapesListe: true },
      limit: -1,
    });

    let updated = 0;
    let skipped = 0;
    let verboseShown = false;

    for (const r of recettes) {
      const liste = r.etapesListe;
      const steps = etapesListeRowsToStepStrings(liste);
      if (!steps) {
        skipped++;
        continue;
      }

      const html = stepsToEtapesHtml(steps);

      if (hasMeaningfulEtapes(r.etapes) && !force) {
        console.log(
          `#${r.id} ${r.titre || r.slug || ''} — skip (etapes déjà rempli, utiliser --force)`
        );
        skipped++;
        continue;
      }

      if (verbose && !verboseShown) {
        console.log(
          'Exemple etapesListe (1re recette traitée) :',
          JSON.stringify(liste?.slice?.(0, 2) ?? liste, null, 2)
        );
        console.log(
          'Aperçu HTML généré (300 premiers car.) :',
          html.slice(0, 300) + (html.length > 300 ? '…' : '')
        );
        verboseShown = true;
      }

      if (dryRun) {
        console.log(
          `[dry-run] #${r.id} ${r.titre || r.slug || ''} → ${steps.length} étape(s)`
        );
      } else {
        await updateRecetteEtapes(app, uid, r.id, html, {
          dryRun,
          useEntityService,
          etapesType,
        });
        console.log(`✓ #${r.id} ${r.titre || r.slug || ''} (${steps.length} étapes)`);
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
