import { describe, expect, it } from 'vitest';
import { TABS, getActiveTab, isTabBarVisible } from '../tabs';

describe('getActiveTab', () => {
  it('associe chaque page principale à son onglet', () => {
    expect(getActiveTab('/')).toBe('accueil');
    expect(getActiveTab('/recettes')).toBe('recettes');
    expect(getActiveTab('/decouvrir')).toBe('decouvrir');
    expect(getActiveTab('/planning')).toBe('planning');
    expect(getActiveTab('/favoris')).toBe('favoris');
  });

  it('rattache les pages liées au bon onglet', () => {
    expect(getActiveTab('/ce-soir')).toBe('decouvrir');
    expect(getActiveTab('/categories/italien')).toBe('recettes');
    expect(getActiveTab('/tags/vegetarien')).toBe('recettes');
  });

  it('ne confond pas un préfixe commun : /recettes-xyz n’est pas /recettes', () => {
    expect(getActiveTab('/recettes-xyz')).toBeNull();
    expect(getActiveTab('/planning-x')).toBeNull();
  });

  it('renvoie null pour une page sans onglet', () => {
    expect(getActiveTab('/ingredients')).toBeNull();
    expect(getActiveTab('/politique-de-confidentialite')).toBeNull();
  });

  it('chaque onglet a un chemin distinct qui active bien cet onglet', () => {
    expect(new Set(TABS.map((tab) => tab.href)).size).toBe(TABS.length);
    for (const tab of TABS) expect(getActiveTab(tab.href)).toBe(tab.key);
  });
});

describe('isTabBarVisible', () => {
  it('s’affiche sur les pages principales et les listes', () => {
    for (const path of ['/', '/recettes', '/decouvrir', '/ce-soir', '/planning', '/favoris', '/categories/italien', '/ingredients']) {
      expect(isTabBarVisible(path)).toBe(true);
    }
  });

  it('est masquée sur une page recette et en Mode Cuisine', () => {
    expect(isTabBarVisible('/recettes/houmous')).toBe(false);
    expect(isTabBarVisible('/recettes/houmous/cuisine')).toBe(false);
    expect(isTabBarVisible('/recettes/houmous/classique')).toBe(false);
  });

  it('est masquée dans l’administration', () => {
    expect(isTabBarVisible('/admin')).toBe(false);
    expect(isTabBarVisible('/admin/pinterest')).toBe(false);
  });
});
