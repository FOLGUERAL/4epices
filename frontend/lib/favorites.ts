/**
 * Gestion des favoris avec localStorage
 */

const FAVORITES_KEY = '4epices_favorites';

export interface Favorite {
  id: number;
  slug: string;
  titre: string;
  imageUrl?: string;
  addedAt: string;
}

export function getFavorites(): Favorite[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erreur lors de la récupération des favoris:', error);
    return [];
  }
}

export function addFavorite(recette: {
  id: number;
  slug: string;
  titre: string;
  imageUrl?: string;
}): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const favorites = getFavorites();
    
    // Vérifier si déjà en favoris
    if (favorites.some(fav => fav.id === recette.id)) {
      return false;
    }
    
    const newFavorite: Favorite = {
      id: recette.id,
      slug: recette.slug,
      titre: recette.titre,
      imageUrl: recette.imageUrl,
      addedAt: new Date().toISOString(),
    };
    
    favorites.push(newFavorite);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'ajout aux favoris:', error);
    return false;
  }
}

export function removeFavorite(recetteId: number): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const favorites = getFavorites();
    const filtered = favorites.filter(fav => fav.id !== recetteId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression des favoris:', error);
    return false;
  }
}

export function isFavorite(recetteId: number): boolean {
  if (typeof window === 'undefined') return false;
  
  const favorites = getFavorites();
  return favorites.some(fav => fav.id === recetteId);
}

export function toggleFavorite(recette: {
  id: number;
  slug: string;
  titre: string;
  imageUrl?: string;
}): boolean {
  if (isFavorite(recette.id)) {
    removeFavorite(recette.id);
    return false; // Retourne l'état final : plus en favoris
  } else {
    addFavorite(recette);
    return true; // Retourne l'état final : maintenant en favoris
  }
}

