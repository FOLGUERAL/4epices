module.exports = ({ env }) => {
  const raw = env.array('APP_KEYS');
  const fromEnv = Array.isArray(raw)
    ? raw
        .map((k) => (typeof k === 'string' ? k.trim() : String(k || '').trim()))
        .filter(Boolean)
    : [];
  const keys =
    fromEnv.length > 0
      ? fromEnv
      : [
          '4epices-dev-only-rotate-in-prod-1',
          '4epices-dev-only-rotate-in-prod-2',
        ];

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    app: {
      keys,
    },
    webhooks: {
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
    },
  };
};

