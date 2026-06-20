function runMigrations(db) {
  const storyColumns = db.prepare('PRAGMA table_info(stories)').all();
  const columnNames = new Set(storyColumns.map((col) => col.name));

  if (!columnNames.has('submitted_by_user_id')) {
    db.exec(`
      ALTER TABLE stories
      ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id)
    `);
    console.log('Migration: added stories.submitted_by_user_id');
  }

  if (!columnNames.has('approval_status')) {
    db.exec(`
      ALTER TABLE stories
      ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('pending', 'approved', 'rejected'))
    `);
    console.log('Migration: added stories.approval_status');
  }

  if (!columnNames.has('gemini_suggested_age_group')) {
    db.exec(`
      ALTER TABLE stories
      ADD COLUMN gemini_suggested_age_group TEXT
        CHECK (gemini_suggested_age_group IS NULL OR gemini_suggested_age_group IN ('0-2', '3-5', '6-7'))
    `);
    console.log('Migration: added stories.gemini_suggested_age_group');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS gemini_api_usage (
      date          TEXT    NOT NULL PRIMARY KEY,
      request_count INTEGER NOT NULL DEFAULT 0,
      token_count   INTEGER NOT NULL DEFAULT 0
    )
  `);
}

module.exports = { runMigrations };
