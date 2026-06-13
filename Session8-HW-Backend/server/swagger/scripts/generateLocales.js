'use strict';

/**
 * Regenerates operations.en.js summaries from swagger + opDescriptions.en.js
 * Run: node server/swagger/scripts/generateLocales.js
 */

const fs = require('fs');
const path = require('path');
const spec = require('../swaggerConfig');
const opDescriptions = require('../locales/opDescriptions.en');

const OUT_OPS = path.join(__dirname, '../locales/operations.en.js');
const existingOps = require('../locales/operations.en');

const lines = ["'use strict';", '', '/** English operation metadata (key: "METHOD /path") */', 'module.exports = {'];

for (const [p, methods] of Object.entries(spec.paths)) {
  for (const [m, op] of Object.entries(methods)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue;
    const key = `${m.toUpperCase()} ${p}`;
    const existing = existingOps[key] || {};
    const summary = existing.summary || op.summary || key;
    const desc = opDescriptions[key] || existing.description || null;
    const parts = [`summary: ${JSON.stringify(summary)}`];
    if (desc) parts.push(`description: ${JSON.stringify(desc)}`);
    lines.push(`  ${JSON.stringify(key)}: { ${parts.join(', ')} },`);
  }
}
lines.push('};', '');
fs.writeFileSync(OUT_OPS, lines.join('\n'), 'utf8');
console.log(`Wrote ${OUT_OPS}`);
