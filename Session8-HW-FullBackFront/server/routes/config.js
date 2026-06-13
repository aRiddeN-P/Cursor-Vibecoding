/**
 * routes/config.js
 *
 * Public, unauthenticated configuration values that the browser needs
 * BEFORE the user logs in. ONLY values that are already public-by-nature
 * (i.e. visible in the rendered page or in third-party widget URLs) may
 * be exposed here. Secrets — VAPID_PRIVATE_KEY, SESSION_SECRET,
 * SMTP_PASS, etc — must NEVER be returned by this endpoint.
 *
 * Currently exposes:
 *   - GOFTINO_WIDGET_KEY → goftino_key
 */
'use strict';

const express = require('express');

const router = express.Router();

router.get('/public', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5-min CDN/proxy cache
  res.json({
    goftino_key: process.env.GOFTINO_WIDGET_KEY || '',
  });
});

module.exports = router;
