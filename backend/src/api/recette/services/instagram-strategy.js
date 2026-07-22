'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_POSTING_HOURS = [
  { hour: 8, minute: 20 },
  { hour: 12, minute: 20 },
  { hour: 18, minute: 40 },
  { hour: 20, minute: 30 },
];

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  return [];
}

function getRelationData(item) {
  return item?.attributes || item || {};
}

function normalizeSearchValue(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isCookingBaseCategory(category) {
  const data = getRelationData(category);
  const slug = normalizeSearchValue(data.slug);
  const name = normalizeSearchValue(data.nom || data.name);
  return ['bases-de-cuisine', 'base-de-cuisine'].includes(slug) ||
    ['bases-de-cuisine', 'base-de-cuisine'].includes(name);
}

function isCookingBaseOnlyRecette(recette) {
  const categories = asArray(recette.categories);
  return categories.length > 0 && categories.every(isCookingBaseCategory);
}

function parsePosts(value) {
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

function getLastPostDate(recette) {
  const posts = parsePosts(recette.instagramPosts);
  const dates = Object.values(posts)
    .map((post) => new Date(post?.createdAt || 0))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length === 0 && recette.instagramPostId) return new Date(0);
  return dates.sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function getPostCount(recette) {
  const posts = parsePosts(recette.instagramPosts);
  const count = Object.keys(posts).length;
  return count > 0 ? count : recette.instagramPostId ? 1 : 0;
}

function scoreRecette(recette, now = new Date()) {
  const totalTime = (recette.tempsPreparation || 0) + (recette.tempsCuisson || 0);
  const instagramImagesCount = asArray(recette.imagesInstagram).length;
  const pinterestImagesCount = asArray(recette.imagesPinterest).length;
  const existingPostsCount = getPostCount(recette);
  const lastPostDate = getLastPostDate(recette);
  const daysSinceLastPost = lastPostDate
    ? Math.floor((now.getTime() - lastPostDate.getTime()) / DAY_MS)
    : 999;

  let score = 0;
  if (recette.imagePrincipale) score += 35;
  score += Math.min(instagramImagesCount, 3) * 18;
  score += Math.min(pinterestImagesCount, 3) * 8;
  if (totalTime > 0 && totalTime <= 30) score += 12;
  if (recette.difficulte === 'facile') score += 8;
  if (recette.metaTitle || recette.metaDescription) score += 8;
  score += Math.min(daysSinceLastPost, 90) / 3;
  score -= existingPostsCount * 20;

  return Math.round(score);
}

function buildSlots({ startDate, days, postsPerDay }) {
  const slots = [];
  const firstDay = new Date(startDate || Date.now());
  firstDay.setSeconds(0, 0);

  for (let day = 0; day < days; day += 1) {
    for (let index = 0; index < postsPerDay; index += 1) {
      const hourConfig = DEFAULT_POSTING_HOURS[index % DEFAULT_POSTING_HOURS.length];
      const slot = new Date(firstDay.getTime() + day * DAY_MS);
      slot.setHours(hourConfig.hour, hourConfig.minute, 0, 0);

      if (slot.getTime() <= Date.now() + 10 * 60 * 1000) {
        slot.setTime(Date.now() + (slots.length + 1) * 60 * 60 * 1000);
      }

      slots.push(slot);
    }
  }

  return slots;
}

module.exports = ({ strapi }) => ({
  async planStockCampaign(options = {}) {
    const days = Math.min(Math.max(Number(options.days) || 30, 1), 90);
    const postsPerDay = Math.min(Math.max(Number(options.postsPerDay) || 1, 1), 4);
    const maxRecipes = Math.min(Math.max(Number(options.maxRecipes) || days * postsPerDay, 1), 300);
    const minDaysBetweenPosts = Math.min(Math.max(Number(options.minDaysBetweenPosts) || 21, 1), 180);
    const includeAlreadyPosted = options.includeAlreadyPosted === true;
    const includeCookingBases = options.includeCookingBases === true;
    const dryRun = options.dryRun === true;
    const now = new Date();

    const queueService = strapi.service('api::instagram-queue.instagram-queue');
    const instagramService = strapi.service('api::recette.instagram');
    const queuedTasks = await queueService.getAllTasks();
    const queuedRecipeIds = new Set(queuedTasks.map((task) => Number(task.recetteId)));

    const recettes = await strapi.entityService.findMany('api::recette.recette', {
      filters: {
        publishedAt: { $notNull: true },
      },
      populate: ['imagePrincipale', 'imagesInstagram', 'imagesPinterest', 'categories', 'tags'],
      sort: { publishedAt: 'desc' },
      limit: 500,
    });

    const candidates = [];
    const skipped = {
      noImage: 0,
      alreadyQueued: 0,
      alreadyPosted: 0,
      recentlyPosted: 0,
      cookingBases: 0,
    };

    for (const recette of recettes) {
      if (!recette.imagePrincipale && asArray(recette.imagesInstagram).length === 0 && asArray(recette.imagesPinterest).length === 0) {
        skipped.noImage += 1;
        continue;
      }

      if (queuedRecipeIds.has(Number(recette.id))) {
        skipped.alreadyQueued += 1;
        continue;
      }

      if (!includeCookingBases && isCookingBaseOnlyRecette(recette)) {
        skipped.cookingBases += 1;
        continue;
      }

      const existingPostsCount = getPostCount(recette);
      const lastPostDate = getLastPostDate(recette);
      const daysSinceLastPost = lastPostDate
        ? Math.floor((now.getTime() - lastPostDate.getTime()) / DAY_MS)
        : 999;

      if (!includeAlreadyPosted && existingPostsCount > 0) {
        skipped.alreadyPosted += 1;
        continue;
      }

      if (existingPostsCount > 0 && daysSinceLastPost < minDaysBetweenPosts) {
        skipped.recentlyPosted += 1;
        continue;
      }

      candidates.push({
        recette,
        score: scoreRecette(recette, now),
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    const slots = buildSlots({ startDate: options.startDate, days, postsPerDay });
    const selected = candidates.slice(0, Math.min(maxRecipes, slots.length));
    const planned = [];
    const errors = [];

    for (let index = 0; index < selected.length; index += 1) {
      const { recette, score } = selected[index];

      try {
        const images = await instagramService.getImagesForInstagram(recette);
        const imageUrl = images[0];
        if (!imageUrl) {
          errors.push({ recetteId: recette.id, title: recette.titre, error: 'Aucune image disponible' });
          continue;
        }

        const taskData = {
          recetteId: recette.id,
          recetteTitle: recette.titre,
          recetteSlug: recette.slug,
          imageUrl,
          scheduledTime: slots[index].toISOString(),
          source: 'instagram-stock-strategy',
          strategyScore: score,
        };

        const task = dryRun ? { id: `preview_instagram_${recette.id}`, ...taskData } : await queueService.addPostTask(taskData);
        planned.push(task);
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
        postsPerDay,
        maxRecipes,
        minDaysBetweenPosts,
        includeAlreadyPosted,
        includeCookingBases,
      },
      planned,
      errors,
    };
  },
});
