'use strict';

const { getThreeBoardsForRecette, getBoardForPinIndex } = require('../../../utils/pinterestBoardsManager');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_POSTING_HOURS = [
  { hour: 7, minute: 45 },
  { hour: 9, minute: 30 },
  { hour: 11, minute: 15 },
  { hour: 12, minute: 45 },
  { hour: 14, minute: 30 },
  { hour: 16, minute: 15 },
  { hour: 18, minute: 0 },
  { hour: 19, minute: 45 },
  { hour: 21, minute: 0 },
  { hour: 22, minute: 15 },
];

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  return [];
}

function getRelationName(item) {
  const data = item?.attributes || item || {};
  return String(data.nom || data.name || data.titre || data.slug || '').toLowerCase();
}

function parsePins(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

function getLastPinDate(recette) {
  const pins = parsePins(recette.pinterestPins);
  const dates = Object.values(pins)
    .map((pin) => new Date(pin?.createdAt || pin?.scheduledTime || 0))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length === 0 && recette.pinterestPinId) {
    return new Date(0);
  }

  return dates.sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function getPinCount(recette) {
  const pins = parsePins(recette.pinterestPins);
  const count = Object.keys(pins).length;
  return count > 0 ? count : recette.pinterestPinId ? 1 : 0;
}

function includesAny(values, keywords) {
  return values.some((value) => keywords.some((keyword) => value.includes(keyword)));
}

function getSeasonKeywords(date = new Date()) {
  const month = date.getMonth() + 1;

  if ([12, 1, 2].includes(month)) {
    return ['hiver', 'soupe', 'veloute', 'gratinee', 'raclette', 'chocolat', 'fete', 'noel'];
  }

  if ([3, 4, 5].includes(month)) {
    return ['printemps', 'asperge', 'fraise', 'radis', 'salade', 'leger'];
  }

  if ([6, 7, 8].includes(month)) {
    return ['ete', 'barbecue', 'salade', 'tomate', 'courgette', 'froid', 'apero'];
  }

  return ['automne', 'potiron', 'courge', 'champignon', 'pomme', 'soupe', 'gratinee'];
}

function scoreRecette(recette, now = new Date()) {
  const categories = asArray(recette.categories).map(getRelationName);
  const tags = asArray(recette.tags).map(getRelationName);
  const searchableValues = [
    recette.titre,
    recette.description,
    recette.metaTitle,
    recette.metaDescription,
    ...categories,
    ...tags,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    );

  const totalTime = (recette.tempsPreparation || 0) + (recette.tempsCuisson || 0);
  const pinterestImagesCount = asArray(recette.imagesPinterest).length;
  const existingPinsCount = getPinCount(recette);
  const lastPinDate = getLastPinDate(recette);
  const daysSinceLastPin = lastPinDate
    ? Math.floor((now.getTime() - lastPinDate.getTime()) / DAY_MS)
    : 999;

  let score = 0;

  if (recette.imagePrincipale) score += 35;
  score += Math.min(pinterestImagesCount, 3) * 12;
  if (totalTime > 0 && totalTime <= 30) score += 16;
  if (totalTime > 30 && totalTime <= 45) score += 8;
  if (recette.difficulte === 'facile') score += 10;
  if (recette.metaTitle || recette.metaDescription) score += 6;
  if (includesAny(searchableValues, getSeasonKeywords(now))) score += 18;
  if (includesAny(searchableValues, ['rapide', 'facile', 'soir', 'famille', 'healthy', 'leger'])) score += 10;

  score += Math.min(daysSinceLastPin, 90) / 3;
  score -= existingPinsCount * 14;

  return Math.round(score);
}

function buildSlots({ startDate, days, pinsPerDay }) {
  const slots = [];
  const firstDay = new Date(startDate || Date.now());
  firstDay.setSeconds(0, 0);

  for (let day = 0; day < days; day += 1) {
    for (let index = 0; index < pinsPerDay; index += 1) {
      const hourConfig = DEFAULT_POSTING_HOURS[index % DEFAULT_POSTING_HOURS.length];
      const slot = new Date(firstDay.getTime() + day * DAY_MS);
      slot.setHours(hourConfig.hour, hourConfig.minute, 0, 0);

      if (slot.getTime() <= Date.now() + 10 * 60 * 1000) {
        slot.setTime(Date.now() + (slots.length + 1) * 30 * 60 * 1000);
      }

      slots.push(slot);
    }
  }

  return slots;
}

module.exports = ({ strapi }) => ({
  async planStockCampaign(options = {}) {
    const days = Math.min(Math.max(Number(options.days) || 30, 1), 90);
    const pinsPerDay = Math.min(Math.max(Number(options.pinsPerDay) || 6, 1), 10);
    const maxRecipes = Math.min(Math.max(Number(options.maxRecipes) || days * pinsPerDay, 1), 300);
    const minDaysBetweenPins = Math.min(Math.max(Number(options.minDaysBetweenPins) || 14, 1), 120);
    const includeAlreadyPinned = options.includeAlreadyPinned === true;
    const dryRun = options.dryRun === true;
    const now = new Date();

    const queueService = strapi.service('api::recette.pinterest-queue');
    const pinterestService = strapi.service('api::recette.pinterest');
    const queuedTasks = await queueService.getAllTasks();
    const queuedRecipeIds = new Set(queuedTasks.map((task) => Number(task.recetteId)));

    const recettes = await strapi.entityService.findMany('api::recette.recette', {
      filters: {
        publishedAt: {
          $notNull: true,
        },
      },
      populate: ['imagePrincipale', 'imagesPinterest', 'categories', 'tags'],
      sort: { publishedAt: 'desc' },
      limit: 500,
    });

    const candidates = [];
    const skipped = {
      noImage: 0,
      alreadyQueued: 0,
      recentlyPinned: 0,
      alreadyPinned: 0,
    };

    for (const recette of recettes) {
      if (!recette.imagePrincipale && asArray(recette.imagesPinterest).length === 0) {
        skipped.noImage += 1;
        continue;
      }

      if (queuedRecipeIds.has(Number(recette.id))) {
        skipped.alreadyQueued += 1;
        continue;
      }

      const existingPinsCount = getPinCount(recette);
      const lastPinDate = getLastPinDate(recette);
      const daysSinceLastPin = lastPinDate
        ? Math.floor((now.getTime() - lastPinDate.getTime()) / DAY_MS)
        : 999;

      if (!includeAlreadyPinned && existingPinsCount > 0) {
        skipped.alreadyPinned += 1;
        continue;
      }

      if (existingPinsCount > 0 && daysSinceLastPin < minDaysBetweenPins) {
        skipped.recentlyPinned += 1;
        continue;
      }

      candidates.push({
        recette,
        score: scoreRecette(recette, now),
        existingPinsCount,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    const slots = buildSlots({
      startDate: options.startDate,
      days,
      pinsPerDay,
    });
    const selected = candidates.slice(0, Math.min(maxRecipes, slots.length));
    const planned = [];
    const errors = [];

    for (let index = 0; index < selected.length; index += 1) {
      const { recette, score, existingPinsCount } = selected[index];
      const pinIndex = (existingPinsCount + index) % 6;

      try {
        const images = await pinterestService.getImagesForPins(recette);
        const imageUrl = images[pinIndex % images.length];

        if (!imageUrl) {
          errors.push({ recetteId: recette.id, title: recette.titre, error: 'Aucune image disponible' });
          continue;
        }

        const boards = await getThreeBoardsForRecette(strapi, recette);
        const boardId = getBoardForPinIndex(boards, pinIndex);
        const scheduledTime = slots[index].toISOString();
        const taskData = {
          recetteId: recette.id,
          recetteTitle: recette.titre,
          recetteSlug: recette.slug,
          imageUrl,
          pinIndex,
          boardId,
          scheduledTime,
          source: 'stock-strategy',
          strategyScore: score,
        };

        const task = dryRun ? { id: `preview_${recette.id}_${pinIndex}`, ...taskData } : await queueService.addPinTask(taskData);
        planned.push(task);
        strapi.log.info(
          `[Pinterest Strategy] ${dryRun ? 'Preview' : 'Planification'} pin #${pinIndex} pour "${recette.titre}" sur board ${boardId} (score ${score})`
        );
      } catch (error) {
        errors.push({ recetteId: recette.id, title: recette.titre, error: error.message });
      }
    }

    return {
      success: true,
      dryRun,
      plannedCount: planned.length,
      candidatesCount: candidates.length,
      skipped,
      options: {
        days,
        pinsPerDay,
        maxRecipes,
        minDaysBetweenPins,
        includeAlreadyPinned,
      },
      planned,
      errors,
    };
  },
});
