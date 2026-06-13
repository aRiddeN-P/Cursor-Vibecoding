'use strict';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
];

function parseOrigins(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const fromEnv = [
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...parseOrigins(process.env.FRONTEND_URL),
    ...parseOrigins(process.env.ADMIN_FRONTEND_URL),
  ];

  const unique = [...new Set(fromEnv)];

  if (unique.length === 0 && process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEV_ORIGINS;
  }

  return unique;
}

function createCorsOptions() {
  const allowedSet = new Set(getAllowedOrigins());

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedSet.has(origin)) {
        return callback(null, origin);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[cors] blocked origin: ${origin}`);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204,
  };
}

module.exports = {
  getAllowedOrigins,
  createCorsOptions,
};
