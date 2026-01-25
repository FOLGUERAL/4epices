'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAdmin, loginAdmin, isAdminConfigured } from '@/lib/admin-auth';

interface AdminAuthProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Composant pour protéger une route admin
 */
export default function AdminAuth({ children, redirectTo = '/' }: AdminAuthProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdminConfigured()) {
      setError('Configuration admin manquante. Veuillez définir NEXT_PUBLIC_ADMIN_SECRET dans .env.local');
      setIsAuthenticated(false);
      return;
    }

    if (isAdmin()) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (loginAdmin(secret)) {
      setIsAuthenticated(true);
    } else {
      setError('Secret incorrect');
      setSecret('');
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Accès Administrateur
          </h1>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="secret" className="block text-sm font-medium text-gray-700 mb-2">
                Secret administrateur
              </label>
              <input
                type="password"
                id="secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Entrez le secret admin"
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Se connecter
            </button>
          </form>

          <button
            onClick={() => router.push(redirectTo)}
            className="mt-4 w-full text-gray-600 hover:text-gray-800 text-sm"
          >
            ← Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
