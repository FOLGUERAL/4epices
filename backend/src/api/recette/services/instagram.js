'use strict';

const axios = require('axios');

const buildRecipeUrl = (frontendUrl, slug) => {
  const normalizedFrontendUrl = String(frontendUrl || '').replace(/\/$/, '');
  return `${normalizedFrontendUrl}/recettes/${encodeURIComponent(String(slug || '').trim())}`;
};

const encodeUrlPath = (url) => {
  if (!url || typeof url !== 'string') return url;

  try {
    const parsedUrl = new URL(url);
    parsedUrl.pathname = parsedUrl.pathname
      .split('/')
      .map((segment) => {
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join('/');
    return parsedUrl.toString();
  } catch {
    return encodeURI(url);
  }
};

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseInstagramPosts(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

module.exports = ({ strapi }) => ({
  isConfigured() {
    return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID);
  },

  getConfig() {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const userId = process.env.INSTAGRAM_USER_ID;
    const apiVersion = process.env.INSTAGRAM_API_VERSION || 'v23.0';

    if (!accessToken || !userId) {
      throw new Error('Configuration Instagram manquante. Configurez INSTAGRAM_ACCESS_TOKEN et INSTAGRAM_USER_ID.');
    }

    return {
      accessToken,
      userId,
      apiBaseUrl: `https://graph.facebook.com/${apiVersion}`,
    };
  },

  async getImageUrl(imageData) {
    if (!imageData) return null;

    const image = imageData.attributes || imageData;
    if (!image.url) return null;

    if (image.url.startsWith('http://') || image.url.startsWith('https://')) {
      return encodeUrlPath(image.url);
    }

    const publicStrapiUrl =
      process.env.PUBLIC_STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      process.env.STRAPI_URL ||
      'http://localhost:1337';

    return encodeUrlPath(`${String(publicStrapiUrl).replace(/\/$/, '')}${image.url}`);
  },

  async getImagesForInstagram(recetteData) {
    const images = [];
    const instagramImages = recetteData.imagesInstagram?.data || recetteData.imagesInstagram || [];
    const pinterestImages = recetteData.imagesPinterest?.data || recetteData.imagesPinterest || [];
    const imagePrincipale = recetteData.imagePrincipale?.data || recetteData.imagePrincipale;

    for (const imageData of [...instagramImages, ...pinterestImages]) {
      const imageUrl = await this.getImageUrl(imageData);
      if (imageUrl && !images.includes(imageUrl)) images.push(imageUrl);
    }

    const mainImageUrl = await this.getImageUrl(imagePrincipale);
    if (mainImageUrl && !images.includes(mainImageUrl)) images.push(mainImageUrl);

    return images;
  },

  buildCaption(recette) {
    const recetteData = recette.attributes || recette;
    const title = recetteData.metaTitle || recetteData.titre || 'Recette 4epices';
    const description = stripHtml(recetteData.metaDescription || recetteData.description || '');
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://4epices.fr';
    const recipeUrl = buildRecipeUrl(frontendUrl, recetteData.slug);

    const tags = ['#recette', '#cuisine', '#faitmaison', '#4epices'];
    return `${title}\n\n${description}\n\nRetrouvez la recette complete: ${recipeUrl}\n\n${tags.join(' ')}`.substring(0, 2200);
  },

  async recordPost(recetteId, postId, metadata = {}) {
    const recette = await strapi.entityService.findOne('api::recette.recette', recetteId, {
      fields: ['instagramPosts', 'instagramPostId'],
    });

    const posts = parseInstagramPosts(recette?.instagramPosts);
    posts[postId] = {
      ...posts[postId],
      ...metadata,
      createdAt: metadata.createdAt || posts[postId]?.createdAt || new Date().toISOString(),
    };

    await strapi.entityService.update('api::recette.recette', recetteId, {
      data: {
        instagramPostId: recette?.instagramPostId || postId,
        instagramPosts: posts,
      },
    });
  },

  async publishFeedImage(recette, options = {}) {
    const { accessToken, userId, apiBaseUrl } = this.getConfig();
    const recetteData = recette.attributes || recette;
    const imageUrl = options.imageUrl || (await this.getImagesForInstagram(recetteData))[0];

    if (!imageUrl) {
      throw new Error('Aucune image disponible pour publier sur Instagram');
    }

    const caption = options.caption || this.buildCaption(recette);

    const containerResponse = await axios.post(
      `${apiBaseUrl}/${userId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        },
        timeout: 30_000,
      }
    );

    const creationId = containerResponse.data?.id;
    if (!creationId) {
      throw new Error('Instagram n a pas retourne de media container');
    }

    const publishResponse = await axios.post(
      `${apiBaseUrl}/${userId}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: accessToken,
        },
        timeout: 30_000,
      }
    );

    const postId = publishResponse.data?.id;
    if (!postId) {
      throw new Error('Instagram n a pas retourne d ID de publication');
    }

    await this.recordPost(recetteData.id || recette.id, postId, {
      imageUrl,
      creationId,
      source: options.source || 'manual',
      strategyScore: options.strategyScore || null,
    });

    strapi.log.info(`[Instagram] Publication creee pour "${recetteData.titre}" (ID: ${postId})`);
    return { id: postId, creationId, imageUrl };
  },
});
