/**
 * Gestion des notes et avis avec localStorage
 */

export interface Rating {
  recetteId: number;
  rating: number; // 1-5
  comment?: string;
  author?: string;
  createdAt: string;
}

const RATINGS_KEY = '4epices_ratings';

export function getRatings(recetteId?: number): Rating[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RATINGS_KEY);
    const allRatings: Rating[] = stored ? JSON.parse(stored) : [];
    
    if (recetteId) {
      return allRatings.filter(r => r.recetteId === recetteId);
    }
    
    return allRatings;
  } catch (error) {
    console.error('Erreur lors de la récupération des notes:', error);
    return [];
  }
}

export function addRating(rating: Omit<Rating, 'createdAt'>): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const ratings = getRatings();
    const newRating: Rating = {
      ...rating,
      createdAt: new Date().toISOString(),
    };
    
    ratings.push(newRating);
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la note:', error);
    return false;
  }
}

export function getAverageRating(recetteId: number): number {
  const ratings = getRatings(recetteId);
  if (ratings.length === 0) return 0;
  
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function getRatingCount(recetteId: number): number {
  return getRatings(recetteId).length;
}

