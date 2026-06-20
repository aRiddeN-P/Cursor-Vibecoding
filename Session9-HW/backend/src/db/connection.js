const { createDatabase } = require('./init');
const { runMigrations } = require('./migrations');

const db = createDatabase();
runMigrations(db);

module.exports = db;
