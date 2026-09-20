import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '4epices',
    short_name: '4epices',
    description: 'Swipez, planifiez, cuisinez : l’app qui s’occupe du dîner.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff7ed',
    theme_color: '#ea580c',
    // Appui long sur l'icône de l'app installée : accès direct aux sous-applications
    shortcuts: [
      { name: 'Planning', short_name: 'Planning', url: '/planning' },
      { name: 'Découvrir des recettes', short_name: 'Découvrir', url: '/decouvrir' },
      { name: 'Que manger ce soir ?', short_name: 'Ce soir', url: '/ce-soir' },
      { name: 'Mes favoris', short_name: 'Favoris', url: '/favoris' },
    ],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
