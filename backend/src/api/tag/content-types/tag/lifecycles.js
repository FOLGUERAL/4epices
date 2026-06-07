'use strict';

/**
 * Lifecycle callbacks for the tag model.
 */

module.exports = {
  /**
   * Before create - S'assurer que le tag est toujours publié lors de la création
   */
  async beforeCreate(event) {
    const { data } = event.params;

    if (!data.publishedAt) {
      data.publishedAt = new Date().toISOString();
    }

    const nom = (data.nom || '').trim();
    if (nom && !(data.description || '').trim()) {
      data.description = `Découvrez nos recettes ${nom} : idées faciles et gourmandes sur 4épices.`;
    }
    if (nom && !(data.metaTitle || '').trim()) {
      data.metaTitle = nom.length <= 50 ? `Recettes ${nom}` : `Recettes ${nom}`.substring(0, 57) + '...';
    }
  },

  /**
   * After create - Vérifier et publier le tag s'il n'est pas déjà publié
   */
  async afterCreate(event) {
    const { result } = event;

    // Double vérification : publier automatiquement le tag s'il n'est pas déjà publié
    if (!result.publishedAt) {
      try {
        // Utiliser la méthode publish de Strapi pour publier le tag
        await strapi.entityService.publish('api::tag.tag', result.id);
        strapi.log.info(`Tag "${result.nom}" publié automatiquement`);
      } catch (error) {
        // Si la méthode publish échoue, essayer avec update
        try {
          await strapi.entityService.update('api::tag.tag', result.id, {
            data: {
              publishedAt: new Date().toISOString(),
            },
          });
          strapi.log.info(`Tag "${result.nom}" publié automatiquement (via update)`);
        } catch (updateError) {
          strapi.log.error(`Erreur lors de la publication automatique du tag "${result.nom}":`, updateError);
        }
      }
    } else {
      strapi.log.info(`Tag "${result.nom}" créé et publié automatiquement`);
    }
  },
};

