#!/usr/bin/env node
/**
 * Génère description + metaTitle + metaDescription pour les tags via Groq.
 *
 * En production Docker :
 *   docker exec -it 4epices_backend sh -c "cd /opt/app && npm run backfill:tags-seo:dry-run"
 *   docker exec -it 4epices_backend sh -c "cd /opt/app && npm run backfill:tags-seo"
 *
 *   node scripts/backfill-tags-seo-strapi.js --dry-run
 *   node scripts/backfill-tags-seo-strapi.js --force
 *   node scripts/backfill-tags-seo-strapi.js --min-recettes=3
 *   node scripts/backfill-tags-seo-strapi.js --only-id=5 --delay-ms=2000
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..');
const TAG_UID = 'api::tag.tag';
const RECETTE_UID = 'api::recette.recette';

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
    delayMs: 2000,
    minRecettes: 1,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force') out.force = true;
    else if (arg.startsWith('--only-id=')) out.onlyId = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--delay-ms=')) out.delayMs = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--min-recettes=')) out.minRecettes = parseInt(arg.split('=')[1], 10);
  }
  return out;
}

function isTagSeoEmpty(tag) {
  const desc = (tag.description || '').trim();
  const mt = (tag.metaTitle || '').trim();
  const md = (tag.metaDescription || '').trim();
  const nom = (tag.nom || '').trim();
  if (!desc) return true;
  if (!md) return true;
  if (!mt || mt === `${nom} - 4épices` || mt === `Recettes ${nom}`) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countRecettesForTag(app, tagId) {
  return app.db.query(RECETTE_UID).count({
    where: {
      publishedAt: { $notNull: true },
      tags: { id: tagId },
    },
  });
}

async function sampleRecetteTitres(app, tagId, limit = 8) {
  const rows = await app.entityService.findMany(RECETTE_UID, {
    filters: { tags: { id: tagId } },
    fields: ['titre'],
    publicationState: 'live',
    limit,
    sort: 'publishedAt:desc',
  });
  return rows.map((r) => r.titre).filter(Boolean);
}

async function main() {
  loadDotenv();
  process.chdir(BACKEND_ROOT);

  const { dryRun, force, onlyId, delayMs, minRecettes } = parseArgs(process.argv.slice(2));

  if (!dryRun && !process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY manquante dans .env');
    process.exit(1);
  }

  const Strapi = require('@strapi/strapi');
  const app = await Strapi().load();

  try {
    const attrs = app.contentTypes[TAG_UID]?.attributes;
    if (!attrs?.description) {
      console.error('Champ tag.description absent — déployez le schéma à jour.');
      process.exit(1);
    }

    const filters = onlyId != null ? { id: onlyId } : {};
    const tags = await app.entityService.findMany(TAG_UID, {
      filters,
      fields: ['id', 'nom', 'slug', 'description', 'metaTitle', 'metaDescription'],
      publicationState: 'preview',
      limit: -1,
    });

    console.log(`${tags.length} tag(s) à examiner (min recettes: ${minRecettes})\n`);

    const enrichment = app.service('api::tag.tag-seo-enrichment');
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const label = `#${tag.id} ${tag.nom}`;

      const count = await countRecettesForTag(app, tag.id);
      if (count < minRecettes) {
        console.log(`${label} — skip (${count} recette(s), min ${minRecettes})`);
        skipped++;
        continue;
      }

      if (!force && !isTagSeoEmpty(tag)) {
        console.log(`${label} — skip (SEO déjà rempli, --force pour écraser)`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] ${label} — ${count} recette(s) → Groq SEO`);
        generated++;
        continue;
      }

      try {
        const titres = await sampleRecetteTitres(app, tag.id);
        const result = await enrichment.generate(tag, { titres, count });
        await app.entityService.update(TAG_UID, tag.id, { data: result });
        console.log(`✓ ${label} (${count} recettes) — meta: "${result.metaTitle}"`);
        generated++;
      } catch (e) {
        console.error(`✗ ${label} — ${e.message}`);
        errors++;
      }

      if (i < tags.length - 1 && delayMs > 0) await sleep(delayMs);
    }

    console.log(
      `\nTerminé. ${dryRun ? 'Simulation' : 'Générés'} : ${generated}, ignorés : ${skipped}, erreurs : ${errors}.`
    );
  } finally {
    await app.destroy();
  }
}

main().catch((e) => {
  if (e?.code === 'EAI_AGAIN' && String(e?.hostname || '').includes('postgres')) {
    console.error(
      '\nLancez dans le conteneur backend :\n' +
        '  docker exec -it 4epices_backend sh -c "cd /opt/app && npm run backfill:tags-seo:dry-run"\n'
    );
  } else {
    console.error(e);
  }
  process.exit(1);
});
