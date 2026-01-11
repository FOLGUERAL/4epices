module.exports = ({ env }) => [
  'strapi::logger',
  'strapi::errors',
  'global::publish-pinterest', // Middleware personnalisé pour /publish-pinterest
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'dl.airtable.com',
            '*.pinterest.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'dl.airtable.com',
            '*.pinterest.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      headers: '*',
      origin: (() => {
        const origins = [
          'http://localhost:3000',
          'http://localhost:3001',
        ];
        
        const frontendUrl = env('FRONTEND_URL', 'http://localhost:3000');
        if (frontendUrl) {
          // Ajouter l'URL telle quelle
          origins.push(frontendUrl);
          
          // Ajouter la version HTTPS si c'est HTTP
          if (frontendUrl.startsWith('http://')) {
            origins.push(frontendUrl.replace('http://', 'https://'));
          }
          
          // Ajouter la version avec www si elle n'a pas www
          if (!frontendUrl.includes('www.')) {
            origins.push(frontendUrl.replace('://', '://www.'));
            if (frontendUrl.startsWith('http://')) {
              origins.push(frontendUrl.replace('http://', 'https://www.'));
            }
          }
          
          // Ajouter la version sans www si elle a www
          if (frontendUrl.includes('www.')) {
            origins.push(frontendUrl.replace('://www.', '://'));
            if (frontendUrl.startsWith('http://')) {
              origins.push(frontendUrl.replace('http://www.', 'https://'));
            }
          }
        }
        
        return origins.filter(Boolean);
      })(),
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

