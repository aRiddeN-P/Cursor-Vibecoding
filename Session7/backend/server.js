// vibe-kahoot API server (PORT_API). Pure JSON API; does not serve frontend.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');
const game = require('./game');

const PORT = parseInt(process.env.PORT_API || '3000', 10);
const HOST_KEY = process.env.HOST_KEY || 'vibe-class';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// ---- Health ----
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// ---- Scores ----
app.post('/api/scores', (req, res) => {
  const { name, avatar, score, mode } = req.body || {};
  if (!name || typeof score !== 'number' || !mode) {
    return res.status(400).json({ error: 'name, score, mode required' });
  }
  const avatarUrl = avatar || db.avatarUrlFor(name, 'bottts');
  db.upsertPlayer(name, undefined);
  db.saveScore(name, avatarUrl, Math.max(0, Math.floor(score)), mode);
  const newly = db.checkAndGrantAchievements(name, score, mode, {});
  res.json({ ok: true, achievements: newly });
});

app.get('/api/leaderboard', (req, res) => {
  const mode = (req.query.mode || '').toString();
  if (mode === 'solo') {
    const rows = db.getSoloLeaderboard(20);
    return res.json(rows.map((r) => ({
      name: r.name,
      avatar: r.avatar,
      bestScore: r.best_score,
      lastAt: r.last_at,
    })));
  }
  if (mode === 'group') {
    const rows = db.getGroupLeaderboard(20);
    return res.json(rows.map((r) => ({
      name: r.name,
      avatar: r.avatar,
      bestScore: r.score,
      mode: r.mode,
      eliminated: !!r.eliminated,
      stageReached: r.stage_reached,
      totalStages: r.total_stages,
      lastAt: r.last_at,
    })));
  }
  // default: combined best
  const rows = db.getLeaderboard(20);
  res.json(rows.map((r) => ({
    name: r.name,
    avatar: r.avatar,
    bestScore: r.best_score,
    lastAt: r.last_at,
  })));
});

app.get('/api/history/:name', (req, res) => {
  const rows = db.getHistory(req.params.name);
  res.json(rows);
});

// ---- Profile ----
app.get('/api/profile/:name', (req, res) => {
  const name = req.params.name;
  const player = db.getPlayer(name);
  if (!player) {
    return res.status(404).json({ error: 'player not found' });
  }
  const avatarUrl = db.avatarUrlFor(player.name, player.avatar_style, player.avatar_seed);
  const stats = db.getPlayerStats(name);
  const statsByMode = db.getPlayerStatsByMode(name);
  const history = db.getHistory(name, 10);
  const achievements = db.getAchievements(name);
  const rank = db.getGlobalRank(name);

  res.json({
    player: {
      name: player.name,
      avatar_style: player.avatar_style,
      avatar_seed: player.avatar_seed || player.name,
      avatarUrl,
      created_at: player.created_at,
      last_seen: player.last_seen,
      solo_stage: player.solo_stage || 1,
      has_password: !!player.password_hash,
    },
    stats,
    statsByMode,
    history,
    achievements,
    rank,
  });
});

app.patch('/api/profile/:name', (req, res) => {
  const name = req.params.name;
  const { avatarStyle, avatarSeed } = req.body || {};
  if (!avatarStyle && avatarSeed == null) return res.status(400).json({ error: 'avatarStyle or avatarSeed required' });
  const player = db.updatePlayerAvatar(name, avatarStyle, avatarSeed);
  if (!player) return res.status(404).json({ error: 'player not found' });
  res.json({
    ok: true,
    avatarUrl: db.avatarUrlFor(player.name, player.avatar_style, player.avatar_seed),
    avatar_style: player.avatar_style,
    avatar_seed: player.avatar_seed,
  });
});

// Legacy: passwordless registration. Kept for backwards compatibility.
app.post('/api/players/register', (req, res) => {
  const raw = (req.body?.name || '').toString();
  const name = raw.trim().slice(0, 24);
  const avatarStyle = (req.body?.avatarStyle || 'bottts').toString();
  const avatarSeed  = (req.body?.avatarSeed || name).toString();
  if (!name) return res.status(400).json({ error: 'نام لازم است' });
  if (db.nameExists(name)) {
    return res.status(409).json({ error: 'این نام قبلا انتخاب شده، نام دیگری بزن' });
  }
  db.upsertPlayer(name, avatarStyle, avatarSeed);
  res.json({ ok: true, name, avatarUrl: db.avatarUrlFor(name, avatarStyle, avatarSeed) });
});

// ---- Auth (name + password) ----
app.post('/api/auth/register', (req, res) => {
  const raw = (req.body?.name || '').toString();
  const name = raw.trim().slice(0, 24);
  const password = (req.body?.password || '').toString();
  const avatarStyle = (req.body?.avatarStyle || 'bottts').toString();
  const avatarSeed  = (req.body?.avatarSeed || name).toString();
  if (!name)               return res.status(400).json({ error: 'نام لازم است' });
  if (password.length < 4) return res.status(400).json({ error: 'رمز عبور باید حداقل ۴ کاراکتر باشد' });
  const r = db.registerPlayer({ name, password, avatarStyle, avatarSeed });
  if (r.error === 'duplicate') return res.status(409).json({ error: 'این نام قبلا انتخاب شده، نام دیگری بزن' });
  if (r.error)                 return res.status(400).json({ error: 'ثبت‌نام ناموفق بود' });
  res.json({
    ok: true, name,
    avatarUrl: db.avatarUrlFor(name, avatarStyle, avatarSeed),
    soloStage: 1,
  });
});

app.post('/api/auth/login', (req, res) => {
  const name = (req.body?.name || '').toString().trim();
  const password = (req.body?.password || '').toString();
  if (!name) return res.status(400).json({ error: 'نام لازم است' });
  const r = db.loginPlayer(name, password);
  if (r.error === 'not_found')    return res.status(404).json({ error: 'این نام ثبت نشده' });
  if (r.error === 'bad_password') return res.status(401).json({ error: 'رمز عبور اشتباه است' });
  const p = db.getPlayer(name);
  res.json({
    ok: true, legacy: !!r.legacy, name,
    avatarUrl: db.avatarUrlFor(p.name, p.avatar_style, p.avatar_seed),
    avatar_style: p.avatar_style,
    avatar_seed: p.avatar_seed || p.name,
    soloStage: p.solo_stage || 1,
  });
});

// ---- Solo stages ----
// Return 10 shuffled questions (options reshuffled) for a given stage 1..5.
app.get('/api/solo/questions', (req, res) => {
  const stage = parseInt(req.query.stage, 10);
  if (!Number.isInteger(stage) || stage < 1 || stage > 5) {
    return res.status(400).json({ error: 'stage must be 1..5' });
  }
  const start = (stage - 1) * 10;
  const slice = game.RAW_QUESTIONS.slice(start, start + 10);
  // Shuffle the order of the 10 + shuffle options inside each question
  const ordered = [...slice];
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  const out = ordered.map(q => game.shuffleOptions(q));
  res.json({ stage, totalStages: 5, questions: out });
});

app.post('/api/solo/complete', (req, res) => {
  const name = (req.body?.name || '').toString().trim();
  const stage = parseInt(req.body?.stage, 10);
  const score = parseInt(req.body?.score, 10) || 0;
  const avatar = (req.body?.avatar || '').toString();
  if (!name || !Number.isInteger(stage) || stage < 1 || stage > 5) {
    return res.status(400).json({ error: 'نام و مرحله معتبر لازم است' });
  }
  if (!db.nameExists(name)) return res.status(404).json({ error: 'کاربر یافت نشد' });
  // Persist score with the solo stage attached
  const finalAvatar = avatar || db.avatarUrlFor(name, 'bottts');
  db.saveScore(name, finalAvatar, Math.max(0, score), 'solo', { soloStage: stage });
  const newly = db.checkAndGrantAchievements(name, score, 'solo', {});
  const advance = db.recordSoloStage(name, stage, score);
  res.json({
    ok: true,
    advanced: !!advance.advanced,
    newStage: advance.newStage,
    achievements: newly,
  });
});

// Quick existence probe (no 404 noise in dev logs).
app.get('/api/players/exists/:name', (req, res) => {
  res.json({ exists: db.nameExists(req.params.name) });
});

// Rename a player. Atomic across scores/leaderboard/achievements.
// Returns 409 if newName is taken, 404 if old name doesn't exist.
app.post('/api/profile/:name/rename', (req, res) => {
  const oldName = req.params.name;
  const raw = (req.body?.newName || '').toString();
  const newName = raw.trim().slice(0, 24);
  if (!newName) return res.status(400).json({ error: 'نام جدید لازم است' });
  if (newName === oldName) return res.status(400).json({ error: 'نام جدید با نام فعلی یکسان است' });
  const r = db.renamePlayer(oldName, newName);
  if (r.error === 'not_found')  return res.status(404).json({ error: 'کاربر یافت نشد' });
  if (r.error === 'duplicate')  return res.status(409).json({ error: 'این نام قبلا انتخاب شده، نام دیگری بزن' });
  if (r.error)                  return res.status(500).json({ error: 'تغییر نام ناموفق بود' });
  const player = db.getPlayer(newName);
  res.json({ ok: true, name: newName, avatarUrl: db.avatarUrlFor(player.name, player.avatar_style, player.avatar_seed) });
});

app.get('/api/profile/:name/live', (req, res) => {
  res.json(game.liveStatusFor(req.params.name));
});

// ---- Game (host) ----
function requireHost(req, res, next) {
  const key = req.get('X-Host-Key');
  if (!key || key !== HOST_KEY) {
    return res.status(401).json({ error: 'invalid host key' });
  }
  next();
}

app.post('/api/host/open-lobby', requireHost, (_req, res) => {
  res.json(game.openLobby());
});

app.post('/api/host/start-quiz', requireHost, (req, res) => {
  const count = parseInt(req.body?.count || 10, 10);
  const result = game.startQuiz(count);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/host/start-battle', requireHost, (req, res) => {
  const count = parseInt(req.body?.count || 10, 10);
  const result = game.startBattle(count);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/host/next-question', requireHost, (_req, res) => {
  const result = game.nextQuestion();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// ---- Game (player) ----
app.post('/api/players/join', (req, res) => {
  const { name, avatarStyle, avatarSeed } = req.body || {};
  const result = game.joinPlayer(name, avatarStyle, avatarSeed);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/players/answer', (req, res) => {
  const { playerId, answerIndex } = req.body || {};
  const result = game.submitAnswer(playerId, answerIndex);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/game/state', (_req, res) => {
  res.json(game.publicState());
});

// ---- 404 fallback ----
app.use((_req, res) => res.status(404).json({ error: 'not found' }));

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] HOST_KEY: ${HOST_KEY}`);
});
