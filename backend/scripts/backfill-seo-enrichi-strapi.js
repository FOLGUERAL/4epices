#!/usr/bin/env node
/**
 * Génère seoEnrichi (FAQ, conseils, variantes, conservation, métadonnées SEO) via Groq
 * pour les recettes qui n'en ont pas encore (ou toutes avec --force).
 *
 * Usage (depuis backend/, .env avec GROQ_API_KEY) :
 *   node scripts/backfill-seo-enrichi-strapi.js --dry-run
 *   node scripts/backfill-seo-enrichi-strapi.js
 *   node scripts/backfill-seo-enrichi-strapi.js --force
 *   node scripts/backfill-seo-enrichi-strapi.js --only-id=42
 *   node scripts/backfill-seo-enrichi-strapi.js --delay-ms=3000
 *
 * --dry-run       : simulation, aucun appel Groq ni écriture
 * --force         : régénère même si seoEnrichi est déjà rempli
 * --only-id=N     : une seule recette
 * --delay-ms=N    : pause entre chaque appel Groq (défaut 2500)
 * --limit=N       : nombre max de recettes à traiter
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { isSeoEnrichiEmpty } = require('../src/utils/recipeSeoEnrichi');

const BACKEND_ROOT = path.join(__dirname, '..');
const UID = 'api::recette.recette';

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

function parseArgs(argv) {
  const out = {
    dryRun: false,
    force: false,
    onlyId: null,
    delayMs: 2500,
    limit: null,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force') out.force = true;
    else if (arg.startsWith('--only-id=')) out.onlyId = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--delay-ms=')) out.delayMs = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--limit=')) out.limit = parseInt(arg.split('=')[1], 10);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canGenerate(recette) {
  return Boolean(recette.titre && recette.ingredients && recette.etapes);
}

async function main() {
  loadDotenv();
  process.chdir(BACKEND_ROOT);

  const { dryRun, force, onlyId, delayMs, limit } = parseArgs(process.argv.slice(2));

  if (!dryRun && !process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY manquante dans .env');
    process.exit(1);
  }

  const Strapi = require('@strapi/strapi');
  const app = await Strapi().load();

  try {
    const attrs = app.contentTypes[UID]?.attributes;
    if (!attrs?.seoEnrichi) {
      console.error(
        'Le champ seoEnrichi est absent du schéma recette. Déployez le schéma à jour puis relancez.'
      );
      process.exit(1);
    }

    if (dryRun) console.log('Mode --dry-run\n');

    const filters = onlyId != null ? { id: onlyId } : {};
    let recettes = await app.entityService.findMany(UID, {
      filters,
      publicationState: 'preview',
      fields: [
        'id',
        'titre',
        'slug',
        'description',
        'ingredients',
        'etapes',
        'tempsPreparation',
        'tempsCuisson',
        'nombrePersonnes',
        'difficulte',
        'seoEnrichi',
      ],
      limit: limit ?? -1,
    });

    if (limit != null && recettes.length > limit) {
      recettes = recettes.slice(0, limit);
    }

    console.log(`${recettes.length} recette(s) à examiner.\n`);

    const enrichment = app.service('api::recette.recipe-seo-enrichment');
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < recettes.length; i++) {
      const r = recettes[i];
      const label = `#${r.id} ${r.titre || r.slug || ''}`;

      if (!canGenerate(r)) {
        console.log(`${label} — skip (titre, ingrédients ou étapes manquants)`);
        skipped++;
        continue;
      }

      if (!force && !isSeoEnrichiEmpty(r.seoEnrichi)) {
        console.log(`${label} — skip (seoEnrichi déjà présent, utiliser --force)`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] ${label} — serait généré via Groq`);
        generated++;
        continue;
      }

      try {
        const seoEnrichi = await enrichment.generate(r);
        await app.entityService.update(UID, r.id, {
          data: { seoEnrichi },
        });
        const faqCount = Array.isArray(seoEnrichi.faq) ? seoEnrichi.faq.length : 0;
        console.log(`✓ ${label} (${faqCount} FAQ)`);
        generated++;
      } catch (e) {
        console.error(`✗ ${label} — ${e.message}`);
        errors++;
      }

      if (i < recettes.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    console.log(
      `\nTerminé. ${dryRun ? 'Simulation' : 'Générées'} : ${generated}, ignorées : ${skipped}, erreurs : ${errors}.`
    );
  } finally {
    await app.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
