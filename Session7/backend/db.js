// SQLite database layer for vibe-kahoot
// All persistent data: players, scores, leaderboard, achievements.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'vibe.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    name TEXT PRIMARY KEY,
    avatar_style TEXT NOT NULL DEFAULT 'bottts',
    created_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    score INTEGER NOT NULL,
    mode TEXT NOT NULL,
    at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leaderboard_best (
    name TEXT PRIMARY KEY,
    avatar TEXT NOT NULL,
    best_score INTEGER NOT NULL,
    last_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    earned_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scores_name ON scores(name);
  CREATE INDEX IF NOT EXISTS idx_scores_at ON scores(at);
  CREATE INDEX IF NOT EXISTS idx_achievements_name ON achievements(name);
`);

// Lightweight migrations: ensure new columns exist without breaking existing DBs.
const scoreCols = db.prepare("PRAGMA table_info(scores)").all().map((c) => c.name);
if (!scoreCols.includes('stage_reached')) {
  db.exec("ALTER TABLE scores ADD COLUMN stage_reached INTEGER");
}
if (!scoreCols.includes('total_stages')) {
  db.exec("ALTER TABLE scores ADD COLUMN total_stages INTEGER");
}
if (!scoreCols.includes('eliminated')) {
  db.exec("ALTER TABLE scores ADD COLUMN eliminated INTEGER NOT NULL DEFAULT 0");
}
if (!scoreCols.includes('solo_stage')) {
  db.exec("ALTER TABLE scores ADD COLUMN solo_stage INTEGER");
}

const playerCols = db.prepare("PRAGMA table_info(players)").all().map((c) => c.name);
if (!playerCols.includes('avatar_seed')) {
  db.exec("ALTER TABLE players ADD COLUMN avatar_seed TEXT");
}
if (!playerCols.includes('password_hash')) {
  db.exec("ALTER TABLE players ADD COLUMN password_hash TEXT");
}
if (!playerCols.includes('password_salt')) {
  db.exec("ALTER TABLE players ADD COLUMN password_salt TEXT");
}
if (!playerCols.includes('solo_stage')) {
  db.exec("ALTER TABLE players ADD COLUMN solo_stage INTEGER NOT NULL DEFAULT 1");
}

// ---- Avatar URL helper ----
function avatarUrlFor(name, style, seed) {
  const seedSafe  = encodeURIComponent(seed || name || 'guest');
  const styleSafe = encodeURIComponent(style || 'bottts');
  return `https://api.dicebear.com/7.x/${styleSafe}/svg?seed=${seedSafe}`;
}

// ---- Password helpers (scrypt, no external deps) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  try {
    const test = crypto.scryptSync(String(password || ''), salt, 64);
    const known = Buffer.from(hash, 'hex');
    if (test.length !== known.length) return false;
    return crypto.timingSafeEqual(test, known);
  } catch (e) { return false; }
}

// ---- Players ----
function upsertPlayer(name, avatarStyle, avatarSeed) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
  if (existing) {
    db.prepare(`
      UPDATE players
         SET avatar_style = ?, avatar_seed = ?, last_seen = ?
       WHERE name = ?
    `).run(
      avatarStyle || existing.avatar_style,
      avatarSeed != null ? avatarSeed : existing.avatar_seed,
      now, name);
  } else {
    db.prepare(`
      INSERT INTO players (name, avatar_style, avatar_seed, created_at, last_seen, solo_stage)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(name, avatarStyle || 'bottts', avatarSeed || name, now, now);
  }
  return getPlayer(name);
}

/**
 * Update avatar (both style and seed). Returns null if player not found.
 */
function updatePlayerAvatar(name, avatarStyle, avatarSeed) {
  const now = new Date().toISOString();
  const player = getPlayer(name);
  if (!player) return null;
  db.prepare(`
    UPDATE players SET avatar_style = ?, avatar_seed = ?, last_seen = ? WHERE name = ?
  `).run(
    avatarStyle || player.avatar_style,
    avatarSeed != null ? avatarSeed : (player.avatar_seed || name),
    now, name);
  return getPlayer(name);
}

// ---- Auth: register / login ----
/**
 * Create a new account with a password. Refuses if name already exists.
 * Returns { ok: true } or { error: 'duplicate' | 'bad_input' }.
 */
function registerPlayer({ name, password, avatarStyle, avatarSeed }) {
  if (!name || typeof name !== 'string') return { error: 'bad_input' };
  if (!password || password.length < 4)   return { error: 'bad_password' };
  if (nameExists(name)) return { error: 'duplicate' };
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO players (name, avatar_style, avatar_seed, created_at, last_seen, solo_stage, password_hash, password_salt)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(name, avatarStyle || 'bottts', avatarSeed || name, now, now, hash, salt);
  return { ok: true };
}

/**
 * Verify name+password. Returns { ok: true } or { error: 'not_found' | 'bad_password' }.
 * If the player has no password (legacy), accept any (so accounts created before auth still work).
 */
function loginPlayer(name, password) {
  const p = getPlayer(name);
  if (!p) return { error: 'not_found' };
  // Legacy account without password — accept and refuse to force a password.
  if (!p.password_hash || !p.password_salt) return { ok: true, legacy: true };
  if (!verifyPassword(password, p.password_salt, p.password_hash)) return { error: 'bad_password' };
  db.prepare('UPDATE players SET last_seen = ? WHERE name = ?').run(new Date().toISOString(), name);
  return { ok: true };
}

// ---- Solo stages ----
/**
 * Record a completed solo stage. If the stage matches the player's current
 * unlocked max stage AND they passed (score >= passThreshold), advance to next.
 * Returns { newStage, advanced }.
 */
function recordSoloStage(name, stage, score, passThreshold = 3000) {
  const p = getPlayer(name);
  if (!p) return { error: 'not_found' };
  const cur = p.solo_stage || 1;
  let advanced = false;
  if (stage === cur && cur < 5 && score >= passThreshold) {
    db.prepare('UPDATE players SET solo_stage = ? WHERE name = ?').run(cur + 1, name);
    advanced = true;
  }
  return { newStage: advanced ? cur + 1 : cur, advanced };
}

function getPlayer(name) {
  return db.prepare('SELECT * FROM players WHERE name = ?').get(name) || null;
}

function nameExists(name) {
  return !!db.prepare('SELECT 1 FROM players WHERE name = ?').get(name);
}

/**
 * Atomically rename a player. Updates `players`, `scores`,
 * `leaderboard_best`, `achievements`. Refuses if newName is taken.
 */
function renamePlayer(oldName, newName) {
  if (!nameExists(oldName)) return { error: 'not_found' };
  if (nameExists(newName)) return { error: 'duplicate' };

  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare('UPDATE players SET name = ?, last_seen = ? WHERE name = ?').run(newName, now, oldName);
    db.prepare('UPDATE scores SET name = ? WHERE name = ?').run(newName, oldName);
    db.prepare('UPDATE leaderboard_best SET name = ? WHERE name = ?').run(newName, oldName);
    db.prepare('UPDATE achievements SET name = ? WHERE name = ?').run(newName, oldName);
  });
  try { tx(); return { ok: true }; }
  catch (e) { return { error: 'rename_failed' }; }
}

// ---- Scores & leaderboard ----
/**
 * @param {object} opts  { stageReached?, totalStages?, eliminated? }
 */
function saveScore(name, avatar, score, mode, opts = {}) {
  const now = new Date().toISOString();
  const stageReached = opts.stageReached ?? null;
  const totalStages = opts.totalStages ?? null;
  const eliminated = opts.eliminated ? 1 : 0;
  const soloStage = opts.soloStage ?? null;

  db.prepare(`
    INSERT INTO scores (name, avatar, score, mode, at, stage_reached, total_stages, eliminated, solo_stage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, avatar, score, mode, now, stageReached, totalStages, eliminated, soloStage);

  const existing = db.prepare('SELECT * FROM leaderboard_best WHERE name = ?').get(name);
  if (!existing) {
    db.prepare(`
      INSERT INTO leaderboard_best (name, avatar, best_score, last_at)
      VALUES (?, ?, ?, ?)
    `).run(name, avatar, score, now);
  } else {
    const newBest = Math.max(existing.best_score, score);
    db.prepare(`
      UPDATE leaderboard_best SET avatar = ?, best_score = ?, last_at = ? WHERE name = ?
    `).run(avatar, newBest, now, name);
  }
}

// Best-overall leaderboard (kept for backward compat).
function getLeaderboard(limit = 20) {
  return db.prepare(`
    SELECT name, avatar, best_score, last_at
    FROM leaderboard_best
    ORDER BY best_score DESC, last_at ASC
    LIMIT ?
  `).all(limit);
}

// Solo leaderboard: best score per player among mode='solo' games.
function getSoloLeaderboard(limit = 20) {
  return db.prepare(`
    WITH ranked AS (
      SELECT name, avatar, score, at,
        ROW_NUMBER() OVER (PARTITION BY name ORDER BY score DESC, at ASC) AS rn
      FROM scores
      WHERE mode = 'solo'
    )
    SELECT name, avatar, score AS best_score, at AS last_at
    FROM ranked
    WHERE rn = 1
    ORDER BY best_score DESC, last_at ASC
    LIMIT ?
  `).all(limit);
}

// Group (live multiplayer) leaderboard.
// For each player, pick their "best" group game using:
//   1. completed (eliminated = 0) outranks eliminated
//   2. higher stage_reached outranks lower
//   3. higher score breaks remaining ties
// Then sort the picked rows the same way.
function getGroupLeaderboard(limit = 20) {
  return db.prepare(`
    WITH ranked AS (
      SELECT name, avatar, score, eliminated, stage_reached, total_stages, mode, at,
        ROW_NUMBER() OVER (
          PARTITION BY name
          ORDER BY eliminated ASC,
                   COALESCE(stage_reached, 9999) DESC,
                   score DESC,
                   at ASC
        ) AS rn
      FROM scores
      WHERE mode IN ('quiz', 'battle')
    )
    SELECT name, avatar, score, eliminated, stage_reached, total_stages, mode, at AS last_at
    FROM ranked
    WHERE rn = 1
    ORDER BY eliminated ASC,
             COALESCE(stage_reached, 9999) DESC,
             score DESC,
             last_at ASC
    LIMIT ?
  `).all(limit);
}

function getGlobalRank(name) {
  const row = db.prepare(`
    SELECT COUNT(*) + 1 AS rank
    FROM leaderboard_best
    WHERE best_score > (SELECT COALESCE(best_score, 0) FROM leaderboard_best WHERE name = ?)
  `).get(name);
  const exists = db.prepare('SELECT 1 FROM leaderboard_best WHERE name = ?').get(name);
  return exists ? row.rank : null;
}

function getHistory(name, limit = 50) {
  return db.prepare(`
    SELECT id, name, avatar, score, mode, at FROM scores
    WHERE name = ?
    ORDER BY at DESC
    LIMIT ?
  `).all(name, limit);
}

function getPlayerStats(name) {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS totalGames,
      COALESCE(MAX(score), 0) AS bestScore,
      COALESCE(ROUND(AVG(score)), 0) AS avgScore,
      COALESCE(SUM(score), 0) AS totalPoints
    FROM scores WHERE name = ?
  `).get(name) || { totalGames: 0, bestScore: 0, avgScore: 0, totalPoints: 0 };

  const byMode = db.prepare(`
    SELECT mode, COUNT(*) AS n FROM scores WHERE name = ? GROUP BY mode
  `).all(name);
  const soloGames = byMode.find((r) => r.mode === 'solo')?.n || 0;
  const quizGames = byMode.find((r) => r.mode === 'quiz')?.n || 0;
  const battleGames = byMode.find((r) => r.mode === 'battle')?.n || 0;

  // Wins / top3: based on achievements + saved metadata. We approximate from achievements table
  const wins = db.prepare(`
    SELECT COUNT(*) AS n FROM achievements WHERE name = ? AND type = 'survivor'
  `).get(name)?.n || 0;

  const top3Finishes = db.prepare(`
    SELECT COUNT(*) AS n FROM achievements WHERE name = ? AND type IN ('survivor', 'comeback')
  `).get(name)?.n || 0;

  let favoriteMode = null;
  let max = -1;
  for (const m of [
    { key: 'solo', n: soloGames },
    { key: 'quiz', n: quizGames },
    { key: 'battle', n: battleGames },
  ]) {
    if (m.n > max) { max = m.n; favoriteMode = m.key; }
  }
  if (max <= 0) favoriteMode = null;

  // Day-streak (consecutive days with at least one game)
  const days = db.prepare(`
    SELECT DISTINCT substr(at, 1, 10) AS day FROM scores WHERE name = ? ORDER BY day DESC
  `).all(name).map((r) => r.day);

  const { currentStreak, longestStreak } = computeStreaks(days);

  return {
    totalGames: totals.totalGames,
    bestScore: totals.bestScore,
    avgScore: totals.avgScore,
    totalPoints: totals.totalPoints,
    soloGames,
    quizGames,
    battleGames,
    wins,
    top3Finishes,
    favoriteMode,
    currentStreak,
    longestStreak,
  };
}

/**
 * Returns stats grouped per "mode bucket":
 *   - solo:  mode = 'solo'
 *   - group: mode in ('quiz','battle')   (live multiplayer)
 *   - overall: aggregate + streaks
 */
function getPlayerStatsByMode(name) {
  const solo = db.prepare(`
    SELECT COUNT(*) AS totalGames,
           COALESCE(MAX(score), 0) AS bestScore,
           COALESCE(ROUND(AVG(score)), 0) AS avgScore,
           COALESCE(SUM(score), 0) AS totalPoints
    FROM scores WHERE name = ? AND mode = 'solo'
  `).get(name) || { totalGames: 0, bestScore: 0, avgScore: 0, totalPoints: 0 };

  const group = db.prepare(`
    SELECT COUNT(*) AS totalGames,
           COALESCE(MAX(score), 0) AS bestScore,
           COALESCE(ROUND(AVG(score)), 0) AS avgScore,
           COALESCE(SUM(score), 0) AS totalPoints,
           COALESCE(MAX(CASE WHEN eliminated = 0 THEN 1 ELSE 0 END), 0) AS hasCompleted,
           COALESCE(MAX(stage_reached), 0) AS bestStage,
           COALESCE(MAX(total_stages), 0) AS gameLength
    FROM scores WHERE name = ? AND mode IN ('quiz', 'battle')
  `).get(name) || { totalGames: 0, bestScore: 0, avgScore: 0, totalPoints: 0, hasCompleted: 0, bestStage: 0, gameLength: 0 };

  const groupWins = db.prepare(`
    SELECT COUNT(*) AS n FROM achievements WHERE name = ? AND type = 'survivor'
  `).get(name)?.n || 0;

  const overall = db.prepare(`
    SELECT COUNT(*) AS totalGames,
           COALESCE(MAX(score), 0) AS bestScore,
           COALESCE(SUM(score), 0) AS totalPoints
    FROM scores WHERE name = ?
  `).get(name) || { totalGames: 0, bestScore: 0, totalPoints: 0 };

  const days = db.prepare(`
    SELECT DISTINCT substr(at, 1, 10) AS day FROM scores WHERE name = ? ORDER BY day DESC
  `).all(name).map((r) => r.day);
  const { currentStreak, longestStreak } = computeStreaks(days);

  // Favourite mode bucket
  let favoriteBucket = null;
  if (solo.totalGames > 0 || group.totalGames > 0) {
    favoriteBucket = solo.totalGames >= group.totalGames ? 'solo' : 'group';
  }

  return {
    solo: {
      totalGames: solo.totalGames,
      bestScore: solo.bestScore,
      avgScore: solo.avgScore,
      totalPoints: solo.totalPoints,
    },
    group: {
      totalGames: group.totalGames,
      bestScore: group.bestScore,
      avgScore: group.avgScore,
      totalPoints: group.totalPoints,
      wins: groupWins,
      completedAny: !!group.hasCompleted,
      bestStageReached: group.bestStage,
      gameLength: group.gameLength,
    },
    overall: {
      totalGames: overall.totalGames,
      bestScore: overall.bestScore,
      totalPoints: overall.totalPoints,
      currentStreak,
      longestStreak,
      favoriteBucket,
    },
  };
}

function computeStreaks(daysDesc) {
  if (!daysDesc.length) return { currentStreak: 0, longestStreak: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let current = 0;
  let longest = 0;
  let run = 1;

  // current: starts from today/yesterday going backwards
  if (daysDesc[0] === today || daysDesc[0] === yesterday) {
    current = 1;
    for (let i = 1; i < daysDesc.length; i++) {
      const prev = new Date(daysDesc[i - 1]);
      const curr = new Date(daysDesc[i]);
      const diff = (prev - curr) / 86400000;
      if (diff === 1) current++;
      else break;
    }
  }

  // longest: scan all
  for (let i = 1; i < daysDesc.length; i++) {
    const prev = new Date(daysDesc[i - 1]);
    const curr = new Date(daysDesc[i]);
    const diff = (prev - curr) / 86400000;
    if (diff === 1) { run++; } else { longest = Math.max(longest, run); run = 1; }
  }
  longest = Math.max(longest, run);
  return { currentStreak: current, longestStreak: longest };
}

// ---- Achievements ----
const ACH_LABELS = {
  first_win:     'اولین امتیاز',
  perfect_score: 'نمره کامل',
  survivor:      'بازمانده',
  speed_demon:   'سرعت نور',
  veteran:       'کهنه‌کار',
  comeback:      'بازگشت بزرگ',
};

function addAchievement(name, type, label) {
  const existing = db.prepare(`
    SELECT 1 FROM achievements WHERE name = ? AND type = ?
  `).get(name, type);
  if (existing) return false;
  db.prepare(`
    INSERT INTO achievements (name, type, label, earned_at) VALUES (?, ?, ?, ?)
  `).run(name, type, label || ACH_LABELS[type] || type, new Date().toISOString());
  return true;
}

function getAchievements(name) {
  return db.prepare(`
    SELECT type, label, earned_at FROM achievements
    WHERE name = ? ORDER BY earned_at DESC
  `).all(name);
}

function hasAchievement(name, type) {
  return !!db.prepare(`SELECT 1 FROM achievements WHERE name = ? AND type = ?`).get(name, type);
}

/**
 * Check and grant all achievements based on a finished game.
 * @param {string} name
 * @param {number} score
 * @param {string} mode      'solo' | 'quiz' | 'battle'
 * @param {object} ctx       { rank, totalPlayers, avgAnswerTimeMs, midpointRank }
 * @returns {Array<{type,label,earned_at}>} newly earned achievement objects
 */
function checkAndGrantAchievements(name, score, mode, ctx = {}) {
  const newly = [];
  const grant = (type) => {
    if (addAchievement(name, type, ACH_LABELS[type])) {
      newly.push({ type, label: ACH_LABELS[type], earned_at: new Date().toISOString() });
    }
  };

  // first_win: first time score > 0
  if (score > 0 && !hasAchievement(name, 'first_win')) {
    grant('first_win');
  }

  // perfect_score: solo score >= 5000
  if (mode === 'solo' && score >= 5000) grant('perfect_score');

  // survivor: won a battle
  if (mode === 'battle' && ctx.rank === 1) grant('survivor');

  // speed_demon: avg correct-answer time < 3000ms across the run
  if (typeof ctx.avgAnswerTimeMs === 'number' && ctx.avgAnswerTimeMs > 0 && ctx.avgAnswerTimeMs < 3000) {
    grant('speed_demon');
  }

  // veteran: total games >= 10 (after this game is saved)
  const totalGames = db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE name = ?`).get(name)?.n || 0;
  if (totalGames >= 10) grant('veteran');

  // comeback: ranked top 3 after being last at midpoint
  if (
    typeof ctx.rank === 'number' &&
    typeof ctx.totalPlayers === 'number' &&
    typeof ctx.midpointRank === 'number' &&
    ctx.totalPlayers >= 3 &&
    ctx.rank <= 3 &&
    ctx.midpointRank === ctx.totalPlayers
  ) {
    grant('comeback');
  }

  return newly;
}

module.exports = {
  db,
  avatarUrlFor,
  hashPassword,
  verifyPassword,
  upsertPlayer,
  updatePlayerAvatar,
  renamePlayer,
  getPlayer,
  nameExists,
  registerPlayer,
  loginPlayer,
  recordSoloStage,
  saveScore,
  getLeaderboard,
  getSoloLeaderboard,
  getGroupLeaderboard,
  getGlobalRank,
  getHistory,
  getPlayerStats,
  getPlayerStatsByMode,
  addAchievement,
  getAchievements,
  checkAndGrantAchievements,
  ACH_LABELS,
};
