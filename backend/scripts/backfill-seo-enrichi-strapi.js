#!/usr/bin/env node
/**
 * Génère seoEnrichi (FAQ, conseils, variantes, conservation, métadonnées SEO) via Groq
 * pour les recettes qui n'en ont pas encore (ou toutes avec --force).
 *
 * Usage (depuis backend/, .env avec GROQ_API_KEY) :
 *
 * En production Docker, lancer DANS le conteneur backend (hostname "postgres"
 * n'existe pas sur l'hôte — erreur EAI_AGAIN sinon) :
 *   docker exec -it 4epices_backend sh -c "cd /opt/app && npm run backfill:seo-enrichi:dry-run"
 *   docker exec -it 4epices_backend sh -c "cd /opt/app && npm run backfill:seo-enrichi"
 *
 * En local / sur l'hôte si Postgres écoute sur 127.0.0.1:5432 :
 *   DATABASE_HOST=127.0.0.1 node scripts/backfill-seo-enrichi-strapi.js --dry-run
 *
 *   node scripts/backfill-seo-enrichi-strapi.js --dry-run
 *   node scripts/backfill-seo-enrichi-strapi.js
 *   node scripts/backfill-seo-enrichi-strapi.js --force
 *   node scripts/backfill-seo-enrichi-strapi.js --force-meta
 *   node scripts/backfill-seo-enrichi-strapi.js --only-id=42
 *   node scripts/backfill-seo-enrichi-strapi.js --delay-ms=3000
 *
 * --dry-run       : simulation, aucun appel Groq ni écriture
 * --force         : régénère seoEnrichi + meta même si déjà remplis
 * --force-meta    : régénère metaTitle/metaDescription (seoEnrichi inchangé si déjà rempli)
 * --only-id=N     : une seule recette
 * --delay-ms=N    : pause entre chaque appel Groq (défaut 2500)
 * --limit=N       : nombre max de recettes à traiter
 *
 * Par défaut : traite les recettes sans seoEnrichi OU avec meta faible (titre seul / description vide).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { shouldProcessBackfill } = require('../src/utils/recipeSeoEnrichi');

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
    forceMeta: false,
    onlyId: null,
    delayMs: 2500,
    limit: null,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force') out.force = true;
    else if (arg === '--force-meta') out.forceMeta = true;
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

  const { dryRun, force, forceMeta, onlyId, delayMs, limit } = parseArgs(process.argv.slice(2));

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
        'metaTitle',
        'metaDescription',
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

      const plan = shouldProcessBackfill(r, { force, forceMeta });
      if (!plan.any) {
        console.log(`${label} — skip (seoEnrichi + meta OK, utiliser --force ou --force-meta)`);
        skipped++;
        continue;
      }

      if (dryRun) {
        const parts = [];
        if (plan.seo) parts.push('seoEnrichi');
        if (plan.meta) parts.push('meta');
        console.log(`[dry-run] ${label} — Groq → ${parts.join(' + ')}`);
        generated++;
        continue;
      }

      try {
        const result = await enrichment.generate(r);
        const updateData = {};
        if (plan.seo) updateData.seoEnrichi = result.seoEnrichi;
        if (plan.meta) {
          updateData.metaTitle = result.metaTitle;
          updateData.metaDescription = result.metaDescription;
        }
        await app.entityService.update(UID, r.id, { data: updateData });
        const faqCount = Array.isArray(result.seoEnrichi.faq) ? result.seoEnrichi.faq.length : 0;
        const metaInfo = plan.meta ? `meta: "${result.metaTitle}"` : 'meta: inchangée';
        console.log(`✓ ${label} (${faqCount} FAQ, ${metaInfo})`);
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
  if (e?.code === 'EAI_AGAIN' && String(e?.hostname || '').includes('postgres')) {
    console.error(
      '\nImpossible de résoudre l\'hôte "postgres" depuis cette machine.\n' +
        'Lancez le script dans le conteneur backend :\n' +
        '  docker exec -it 4epices_backend sh -c "cd /opt/app && npm run backfill:seo-enrichi:dry-run"\n' +
        'Ou sur l\'hôte : DATABASE_HOST=127.0.0.1 npm run backfill:seo-enrichi:dry-run\n'
    );
  } else {
    console.error(e);
  }
  process.exit(1);
});
