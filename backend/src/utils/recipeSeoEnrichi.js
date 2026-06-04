'use strict';

function isSeoEnrichiEmpty(val) {
  if (!val || typeof val !== 'object') return true;
  const hasFaq = Array.isArray(val.faq) && val.faq.length > 0;
  const hasText = (key) => typeof val[key] === 'string' && val[key].trim().length > 0;
  const hasKeywords = Array.isArray(val.motsClesSeo) && val.motsClesSeo.length > 0;
  return !hasFaq && !hasText('conseils') && !hasText('variantes') && !hasText('conservation') && !hasKeywords;
}

function contentFieldsChanged(data, previous) {
  if (!previous) return true;
  if (data.titre !== undefined && data.titre !== previous.titre) return true;
  if (data.ingredients !== undefined) {
    if (JSON.stringify(data.ingredients) !== JSON.stringify(previous.ingredients)) return true;
  }
  if (data.etapes !== undefined && data.etapes !== previous.etapes) return true;
  return false;
}

function shouldGenerateSeoEnrichi({ data, previous, isCreate }) {
  if (isCreate) {
    return isSeoEnrichiEmpty(data.seoEnrichi);
  }

  if (!contentFieldsChanged(data, previous)) {
    return false;
  }

  if (data.seoEnrichi !== undefined && !isSeoEnrichiEmpty(data.seoEnrichi)) {
    return false;
  }

  return true;
}

module.exports = {
  isSeoEnrichiEmpty,
  contentFieldsChanged,
  shouldGenerateSeoEnrichi,
};
