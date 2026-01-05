'use strict';

/**
 * Lifecycle callbacks for the recette model.
 */

/**
 * Génère automatiquement le metaTitle si il est vide
 */
function generateMetaTitle(data) {
  // Si metaTitle est déjà rempli, on ne le modifie pas
  if (data.metaTitle && data.metaTitle.trim()) {
    return data.metaTitle;
  }

  const titre = data.titre || '';
  
  // Le metaTitle est simplement le titre de la recette
  // Limité à 60 caractères (recommandation SEO)
  if (titre.length <= 60) {
    return titre;
  }
  
  // Si trop long, on tronque intelligemment
  return titre.substring(0, 57) + '...';
}

/**
 * Génère automatiquement la metaDescription si elle est vide
 */
function generateMetaDescription(data) {
  // Si metaDescription est déjà remplie, on ne la modifie pas
  if (data.metaDescription && data.metaDescription.trim()) {
    return data.metaDescription;
  }

  const titre = data.titre || '';
  const difficulte = data.difficulte || 'facile';
  const tempsPrep = data.tempsPreparation || 0;
  const tempsCuisson = data.tempsCuisson || 0;
  const tempsTotal = tempsPrep + tempsCuisson;
  const personnes = data.nombrePersonnes || 4;
  
  // Adjectifs selon la difficulté
  const adjectifs = {
    facile: ['facile', 'simple', 'rapide'],
    moyen: ['moyenne', 'traditionnelle'],
    difficile: ['sophistiquée', 'gastronomique', 'traditionnelle']
  };
  
  // Choisir un adjectif aléatoire pour varier
  const adjectifsList = adjectifs[difficulte] || adjectifs.facile;
  const adjectif = adjectifsList[Math.floor(Math.random() * adjectifsList.length)];
  
  // Construire le texte de temps
  let tempsText = '';
  if (tempsTotal > 0) {
    if (tempsPrep > 0 && tempsCuisson > 0) {
      tempsText = `Préparation ${tempsPrep} min, cuisson ${tempsCuisson} min`;
    } else if (tempsPrep > 0) {
      tempsText = `Préparation ${tempsPrep} min`;
    } else if (tempsCuisson > 0) {
      tempsText = `Cuisson ${tempsCuisson} min`;
    }
  }
  
  // Construire la description selon un template
  let metaDesc = '';
  
  // Template 1 : Avec temps détaillé
  if (tempsText && tempsTotal <= 60) {
    metaDesc = `${titre} : recette ${adjectif} ${tempsText}. Pour ${personnes} ${personnes === 1 ? 'personne' : 'personnes'}.`;
  }
  // Template 2 : Avec temps total
  else if (tempsTotal > 0) {
    metaDesc = `${titre} : recette ${adjectif} en ${tempsTotal} minutes. Pour ${personnes} ${personnes === 1 ? 'personne' : 'personnes'}.`;
  }
  // Template 3 : Sans temps
  else {
    metaDesc = `${titre} : recette ${adjectif} pour ${personnes} ${personnes === 1 ? 'personne' : 'personnes'}.`;
  }
  
  // Ajouter un élément distinctif si on a de la place
  if (metaDesc.length < 120) {
    if (tempsTotal > 0 && tempsTotal <= 30) {
      metaDesc = metaDesc.replace('rapide', 'ultra rapide');
    } else if (tempsTotal > 120) {
      metaDesc = metaDesc.replace('recette', 'recette mijotée');
    }
  }
  
  // Limiter à 160 caractères
  if (metaDesc.length > 160) {
    metaDesc = metaDesc.substring(0, 157) + '...';
  }
  
  return metaDesc;
}

module.exports = {
  /**
   * Before create - Génère metaTitle et metaDescription si vides
   */
  async beforeCreate(event) {
    const { data } = event.params;
    
    // Générer metaTitle si vide
    if (!data.metaTitle || !data.metaTitle.trim()) {
      data.metaTitle = generateMetaTitle(data);
    }
    
    // Générer metaDescription si vide
    if (!data.metaDescription || !data.metaDescription.trim()) {
      data.metaDescription = generateMetaDescription(data);
    }
  },

  /**
   * Before update - Génère metaTitle et metaDescription si vides
   */
  async beforeUpdate(event) {
    const { data } = event.params;
    
    // Générer metaTitle si vide
    if (!data.metaTitle || !data.metaTitle.trim()) {
      data.metaTitle = generateMetaTitle(data);
    }
    
    // Générer metaDescription si vide
    if (!data.metaDescription || !data.metaDescription.trim()) {
      data.metaDescription = generateMetaDescription(data);
    }
  },

  /**
   * After create.
   */
  async afterCreate(event) {
    const { result } = event;
    
    // Si auto-publish est activé et que la recette est publiée
    if (result.pinterestAutoPublish && result.publishedAt && !result.pinterestPinId) {
      const pinterestService = strapi.service('api::recette.pinterest');
      
      try {
        const pinData = await pinterestService.createPin(result);
        await strapi.entityService.update('api::recette.recette', result.id, {
          data: {
            pinterestPinId: pinData.id,
          },
        });
        strapi.log.info(`Pin Pinterest créé automatiquement pour: ${result.titre}`);
      } catch (error) {
        strapi.log.error('Erreur lors de la publication automatique Pinterest:', error);
      }
    }
  },

  /**
   * After update.
   */
  async afterUpdate(event) {
    const { result } = event;
    
    // Si auto-publish est activé et que la recette vient d'être publiée
    if (result.pinterestAutoPublish && result.publishedAt && !result.pinterestPinId) {
      const pinterestService = strapi.service('api::recette.pinterest');
      
      try {
        const pinData = await pinterestService.createPin(result);
        await strapi.entityService.update('api::recette.recette', result.id, {
          data: {
            pinterestPinId: pinData.id,
          },
        });
        strapi.log.info(`Pin Pinterest créé automatiquement pour: ${result.titre}`);
      } catch (error) {
        strapi.log.error('Erreur lors de la publication automatique Pinterest:', error);
      }
    }
  },
};

