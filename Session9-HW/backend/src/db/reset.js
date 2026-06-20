const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/lalayi.db');
const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];

for (const file of files) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Deleted ${file}`);
  }
}

require('./init');
console.log('Database reset complete.');
