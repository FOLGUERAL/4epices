'use strict';

function normalizeTagKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function generateSlug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function findMatchingTag(tagName, allTags) {
  const trimmed = String(tagName || '').trim();
  if (!trimmed) return null;

  const normalized = normalizeTagKey(trimmed);
  const slug = generateSlug(trimmed);

  for (const tag of allTags) {
    if (tag.nom === trimmed) return tag;
    if (normalizeTagKey(tag.nom) === normalized) return tag;
    if (tag.slug === slug) return tag;
  }

  return null;
}

async function loadAllTags(strapi) {
  return strapi.entityService.findMany('api::tag.tag', {
    fields: ['nom', 'slug', 'publishedAt'],
    limit: -1,
  });
}

module.exports = {
  normalizeTagKey,
  generateSlug,
  findMatchingTag,
  loadAllTags,
};
