#!/usr/bin/env node
/**
 * Wipe all SQLite databases and user uploads, then recreate fresh empty DBs
 * with default admin (username: admin, password: admin, must_change_password: 1).
 *
 * Usage: node scripts/reset-all.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`  removed ${path.relative(ROOT, filePath)}`);
  }
}

function cleanDir(dirPath, keepNames = ['.gitkeep']) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    if (keepNames.includes(entry)) continue;
    const full = path.join(dirPath, entry);
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`  removed ${path.relative(ROOT, full)}`);
  }
}

console.log('[reset-all] Deleting database files…');
for (const base of [ROOT, path.join(ROOT, 'server')]) {
  for (const name of fs.readdirSync(base)) {
    if (/\.db(-shm|-wal)?$/.test(name)) {
      removeIfExists(path.join(base, name));
    }
  }
}

console.log('[reset-all] Cleaning uploads (keeping directory structure)…');
cleanDir(path.join(ROOT, 'server/uploads/avatars'));
cleanDir(path.join(ROOT, 'server/uploads/banners'));
cleanDir(path.join(ROOT, 'server/uploads/stories'));

console.log('[reset-all] Recreating databases…');
require('../server/db/appDb');
require('../server/db/adminDb');

console.log('[reset-all] Done.');
console.log('  Default admin → username: admin | password: admin (change on first login)');
