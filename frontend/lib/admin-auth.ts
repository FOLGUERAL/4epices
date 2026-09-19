/**
 * Utilitaires client pour l'authentification admin.
 *
 * Le secret n'est plus jamais présent dans le navigateur : la connexion et la vérification passent par
 * /api/admin/session, qui pose un cookie de session HttpOnly signé côté serveur.
 */

export interface AdminSessionState {
  configured: boolean;
  authenticated: boolean;
}

/** État de la session admin courante. */
export async function fetchAdminSession(): Promise<AdminSessionState> {
  try {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    if (!response.ok) return { configured: false, authenticated: false };
    return response.json();
  } catch {
    return { configured: false, authenticated: false };
  }
}

/** Vérifie si l'utilisateur courant est administrateur. */
export async function isAdmin(): Promise<boolean> {
  return (await fetchAdminSession()).authenticated;
}

/** Authentifie l'utilisateur en tant qu'admin avec le secret (vérifié côté serveur). */
export async function loginAdmin(secret: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    if (response.ok) return { ok: true };
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: (data as { error?: string }).error || 'Secret incorrect' };
  } catch {
    return { ok: false, error: 'Erreur de connexion au serveur' };
  }
}

/** Déconnecte l'utilisateur admin. */
export async function logoutAdmin(): Promise<void> {
  try {
    await fetch('/api/admin/session', { method: 'DELETE' });
  } catch {
    // Sans réseau, la session expire d'elle-même au bout de 8 h
  }
}
