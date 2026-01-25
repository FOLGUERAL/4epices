/**
 * Utilitaires pour l'authentification admin
 */

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

/**
 * Vérifie si l'utilisateur est authentifié en tant qu'admin
 * En production, vous devriez utiliser une vraie session/cookie sécurisée
 */
export function isAdmin(): boolean {
  if (typeof window === 'undefined') {
    // Côté serveur, toujours retourner false pour forcer la vérification côté client
    return false;
  }
  
  // Vérifier si le secret admin est stocké dans sessionStorage
  const adminToken = sessionStorage.getItem('admin_token');
  return adminToken === ADMIN_SECRET && ADMIN_SECRET !== '';
}

/**
 * Authentifie l'utilisateur en tant qu'admin avec un secret
 */
export function loginAdmin(secret: string): boolean {
  if (secret === ADMIN_SECRET && ADMIN_SECRET !== '') {
    sessionStorage.setItem('admin_token', secret);
    return true;
  }
  return false;
}

/**
 * Déconnecte l'utilisateur admin
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('admin_token');
  }
}

/**
 * Vérifie si le secret admin est configuré
 */
export function isAdminConfigured(): boolean {
  return ADMIN_SECRET !== '';
}
