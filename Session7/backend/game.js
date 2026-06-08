// Multiplayer game engine (in-memory) for vibe-kahoot.
// Holds a single global game object; reset on open-lobby.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const QUESTION_MS = 10000;
const BETWEEN_MS = 3000;
const REVEAL_MS = 4000;

// ---- Load + validate questions ----
const QUESTIONS_PATH = path.join(__dirname, 'questions.json');
const RAW_QUESTIONS = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));

function validateQuestions(qs) {
  for (const q of qs) {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${q.id} must have exactly 4 options`);
    }
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
      throw new Error(`Question ${q.id} has invalid correct index ${q.correct}`);
    }
    if (q.options.some((o) => typeof o !== 'string' || !o.trim())) {
      throw new Error(`Question ${q.id} has an empty/non-string option`);
    }
    if (typeof q.text !== 'string' || !q.text.trim()) {
      throw new Error(`Question ${q.id} has invalid text`);
    }
  }
}
validateQuestions(RAW_QUESTIONS);
console.log(`[questions] loaded ${RAW_QUESTIONS.length} questions, validation OK`);

// shuffleOptions: returns a new question object with options shuffled
// and the correct index updated to its new position.
function shuffleOptions(q) {
  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const newOptions = indices.map((idx) => q.options[idx]);
  const newCorrect = indices.indexOf(q.correct);
  return {
    id: q.id,
    session: q.session,
    text: q.text,
    options: newOptions,
    correct: newCorrect,
  };
}

function pickQuestions(count) {
  const pool = [...RAW_QUESTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, Math.min(count, pool.length));
  return picked.map(shuffleOptions);
}

// ---- The game ----
function makeEmptyGame() {
  return {
    phase: 'lobby',        // lobby | question | reveal | between | waiting | ended
    mode: null,            // quiz | battle | null
    questions: [],
    currentIndex: 0,
    deadline: null,        // ms epoch
    revealEndsAt: null,
    betweenEndsAt: null,
    players: new Map(),    // id -> player
    midpointRanks: null,   // name -> rank at midpoint (for 'comeback')
    startedAt: null,
    endedAt: null,
    winnerName: null,
    finalLeaderboard: null,
    // history of per-question correct option counts
    lastOptionCounts: [0, 0, 0, 0],
    // results pushed to scores+achievements once on `ended`
    resultsRecorded: false,
  };
}

let game = makeEmptyGame();
let phaseTimer = null;

function clearPhaseTimer() {
  if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = null; }
}

function newPlayerId() {
  return crypto.randomBytes(8).toString('hex');
}

function alivePlayers() {
  return [...game.players.values()].filter((p) => !p.eliminated);
}

// ---- Public API for HTTP layer ----
function openLobby() {
  clearPhaseTimer();
  game = makeEmptyGame();
  return { ok: true };
}

function joinPlayer(name, avatarStyle, avatarSeed) {
  if (!name || typeof name !== 'string') {
    return { error: 'name required' };
  }
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed) return { error: 'name required' };

  const style = (avatarStyle || 'bottts').toString();
  const seed  = (avatarSeed != null ? avatarSeed : trimmed).toString();
  db.upsertPlayer(trimmed, style, seed);
  const avatarUrl = db.avatarUrlFor(trimmed, style, seed);

  // re-join by name if the same name already exists in this game
  for (const p of game.players.values()) {
    if (p.name === trimmed) {
      p.avatar = avatarUrl;
      p.avatarStyle = style;
      return { playerId: p.id, name: trimmed, avatarUrl };
    }
  }

  // Only allow joining during lobby (or as spectator); for simplicity allow lobby only
  if (game.phase !== 'lobby') {
    return { error: 'بازی شروع شده، صبر کنید لابی بعدی باز شود' };
  }

  const id = newPlayerId();
  game.players.set(id, {
    id,
    name: trimmed,
    avatar: avatarUrl,
    avatarStyle: style,
    score: 0,
    eliminated: false,
    answeredThisRound: false,
    lastAnswerIndex: null,
    lastAnswerAt: null,
    answerTimes: [],
    correctCount: 0,
  });
  return { playerId: id, name: trimmed, avatarUrl };
}

function startQuiz(count = 10) {
  if (game.phase !== 'lobby') return { error: 'لابی فعال نیست' };
  if (game.players.size === 0) return { error: 'هیچ بازیکنی وارد نشده' };
  game.mode = 'quiz';
  game.questions = pickQuestions(count);
  game.currentIndex = 0;
  game.startedAt = Date.now();
  beginQuestionPhase();
  return { ok: true };
}

function startBattle(count = 10) {
  if (game.phase !== 'lobby') return { error: 'لابی فعال نیست' };
  if (game.players.size === 0) return { error: 'هیچ بازیکنی وارد نشده' };
  game.mode = 'battle';
  game.questions = pickQuestions(count);
  game.currentIndex = 0;
  game.startedAt = Date.now();
  beginQuestionPhase();
  return { ok: true };
}

function nextQuestion() {
  if (game.mode !== 'battle') return { error: 'فقط در حالت بتل' };
  if (game.phase !== 'waiting') return { error: 'فاز فعلی منتظر هاست نیست' };
  beginQuestionPhase();
  return { ok: true };
}

function beginQuestionPhase() {
  clearPhaseTimer();
  if (game.currentIndex >= game.questions.length) {
    return endGame();
  }
  // Battle mode: if only 1 (or 0) alive, end now.
  if (game.mode === 'battle' && alivePlayers().length <= 1 && game.players.size > 1) {
    return endGame();
  }

  game.phase = 'question';
  game.deadline = Date.now() + QUESTION_MS;
  game.lastOptionCounts = [0, 0, 0, 0];
  for (const p of game.players.values()) {
    p.answeredThisRound = false;
    p.lastAnswerIndex = null;
    p.lastAnswerAt = null;
  }
  phaseTimer = setTimeout(() => {
    revealCurrent();
  }, QUESTION_MS + 50);

  // Midpoint snapshot (for comeback achievement)
  if (game.midpointRanks == null && game.currentIndex === Math.floor(game.questions.length / 2)) {
    captureMidpointRanks();
  }
}

function captureMidpointRanks() {
  const sorted = [...game.players.values()].sort((a, b) => b.score - a.score);
  const map = {};
  sorted.forEach((p, i) => { map[p.name] = i + 1; });
  game.midpointRanks = map;
}

function submitAnswer(playerId, answerIndex) {
  const p = game.players.get(playerId);
  if (!p) return { error: 'بازیکن یافت نشد' };
  if (game.phase !== 'question') return { error: 'الان زمان پاسخ نیست' };
  if (p.eliminated) return { error: 'حذف شده‌اید' };
  if (p.answeredThisRound) return { error: 'قبلا پاسخ داده‌اید' };
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return { error: 'پاسخ نامعتبر' };
  }
  const now = Date.now();
  const timeTakenMs = Math.max(0, QUESTION_MS - (game.deadline - now));
  const timeLeftMs = Math.max(0, game.deadline - now);

  p.answeredThisRound = true;
  p.lastAnswerIndex = answerIndex;
  p.lastAnswerAt = now;
  p.answerTimes.push(timeTakenMs);

  game.lastOptionCounts[answerIndex] += 1;

  // Scoring is decided at reveal so we don't expose correctness early.
  // Early-end the question if all alive players answered (battle or quiz)
  const alive = alivePlayers();
  if (alive.every((pp) => pp.answeredThisRound)) {
    // small grace so the host UI shows the last answer
    clearPhaseTimer();
    phaseTimer = setTimeout(revealCurrent, 400);
  }
  return { ok: true, timeLeftMs };
}

function revealCurrent() {
  clearPhaseTimer();
  const q = game.questions[game.currentIndex];
  if (!q) return endGame();

  // Score players + handle elimination
  for (const p of game.players.values()) {
    if (p.eliminated) continue;
    if (!p.answeredThisRound) {
      // timeout
      if (game.mode === 'battle') {
        p.eliminated = true;
        p.eliminatedAt = game.currentIndex;
      }
      continue;
    }
    const correct = p.lastAnswerIndex === q.correct;
    if (correct) {
      p.correctCount += 1;
      if (game.mode === 'quiz' || game.mode === 'solo') {
        const timeLeftMs = Math.max(0, game.deadline - p.lastAnswerAt);
        const speedBonus = Math.floor(500 * timeLeftMs / QUESTION_MS);
        p.score += 500 + speedBonus;
      } else if (game.mode === 'battle') {
        // tiny score bonus to break ties in battle: 100 + speed
        const timeLeftMs = Math.max(0, game.deadline - p.lastAnswerAt);
        const speedBonus = Math.floor(100 * timeLeftMs / QUESTION_MS);
        p.score += 100 + speedBonus;
      }
    } else if (game.mode === 'battle') {
      p.eliminated = true;
      p.eliminatedAt = game.currentIndex;
    }
  }

  game.phase = 'reveal';
  game.revealEndsAt = Date.now() + REVEAL_MS;

  // Decide what happens next
  if (game.mode === 'quiz') {
    phaseTimer = setTimeout(() => {
      game.currentIndex += 1;
      if (game.currentIndex >= game.questions.length) return endGame();
      game.phase = 'between';
      game.betweenEndsAt = Date.now() + BETWEEN_MS;
      phaseTimer = setTimeout(beginQuestionPhase, BETWEEN_MS);
    }, REVEAL_MS);
  } else if (game.mode === 'battle') {
    // After reveal -> 'waiting' (host pushes next), unless game ended
    phaseTimer = setTimeout(() => {
      game.currentIndex += 1;
      const aliveCount = alivePlayers().length;
      if (game.currentIndex >= game.questions.length || aliveCount <= 1) {
        return endGame();
      }
      game.phase = 'waiting';
    }, REVEAL_MS);
  }
}

function endGame() {
  clearPhaseTimer();
  game.phase = 'ended';
  game.endedAt = Date.now();

  // Compute final ranks
  const all = [...game.players.values()];
  const ranked = [...all].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    if (game.mode === 'battle') {
      // later elimination = better
      const ae = a.eliminatedAt ?? Infinity;
      const be = b.eliminatedAt ?? Infinity;
      return be - ae;
    }
    return 0;
  });
  ranked.forEach((p, i) => { p.rank = i + 1; });

  game.winnerName = ranked.length ? ranked[0].name : null;
  game.finalLeaderboard = ranked.map((p) => ({
    name: p.name,
    avatarUrl: p.avatar,
    score: p.score,
    rank: p.rank,
    eliminated: p.eliminated,
  }));

  // Persist scores + achievements once
  if (!game.resultsRecorded) {
    const totalPlayers = ranked.length;
    const totalStages = game.questions.length;
    for (const p of ranked) {
      // For battle: how many questions the player survived.
      //   - eliminated:      stage = p.eliminatedAt (0-based index of the Q where they died)
      //   - completed alive: stage = totalStages
      // For quiz: nobody is eliminated, so stage = totalStages.
      const stageReached = p.eliminated ? (p.eliminatedAt ?? 0) : totalStages;
      db.saveScore(p.name, p.avatar, p.score, game.mode, {
        stageReached,
        totalStages,
        eliminated: !!p.eliminated,
      });
      const avgAnswerTimeMs = p.answerTimes.length
        ? Math.round(p.answerTimes.reduce((a, b) => a + b, 0) / p.answerTimes.length)
        : 0;
      const midpointRank = game.midpointRanks ? (game.midpointRanks[p.name] || null) : null;
      const newly = db.checkAndGrantAchievements(p.name, p.score, game.mode, {
        rank: p.rank,
        totalPlayers,
        avgAnswerTimeMs: p.correctCount > 0 ? avgAnswerTimeMs : 0,
        midpointRank,
      });
      p.newlyEarned = newly;
    }
    game.resultsRecorded = true;
  }
}

// ---- Public state for clients ----
function publicState() {
  const now = Date.now();
  const q = game.questions[game.currentIndex] || null;

  let timeLeftMs = 0;
  if (game.phase === 'question' && game.deadline) {
    timeLeftMs = Math.max(0, game.deadline - now);
  } else if (game.phase === 'reveal' && game.revealEndsAt) {
    timeLeftMs = Math.max(0, game.revealEndsAt - now);
  } else if (game.phase === 'between' && game.betweenEndsAt) {
    timeLeftMs = Math.max(0, game.betweenEndsAt - now);
  }

  // Rank players by score, but eliminated players go after alive ones
  const sorted = [...game.players.values()].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return b.score - a.score;
  });
  sorted.forEach((p, i) => { p.rank = i + 1; });

  const playersPublic = sorted.map((p) => ({
    id: p.id,
    name: p.name,
    avatarUrl: p.avatar,
    score: p.score,
    eliminated: p.eliminated,
    hasAnswered: p.answeredThisRound,
    rank: p.rank,
  }));

  const leaderboardSnapshot = playersPublic.slice(0, 10).map((p) => ({
    name: p.name,
    avatarUrl: p.avatarUrl,
    score: p.score,
    rank: p.rank,
  }));

  const state = {
    phase: game.phase,
    mode: game.mode,
    questionIndex: game.currentIndex,
    questionCount: game.questions.length,
    timeLeftMs,
    aliveCount: alivePlayers().length,
    eliminatedNames: [...game.players.values()].filter((p) => p.eliminated).map((p) => p.name),
    winnerName: game.winnerName,
    players: playersPublic,
    leaderboard: leaderboardSnapshot,
  };

  if (q) {
    if (game.phase === 'question') {
      // Never expose correctIndex during 'question' phase
      state.question = { text: q.text, options: q.options };
    } else if (game.phase === 'reveal') {
      state.question = { text: q.text, options: q.options };
      state.reveal = {
        correctIndex: q.correct,
        optionCounts: game.lastOptionCounts.slice(),
      };
    } else if (game.phase === 'between' || game.phase === 'waiting') {
      state.question = { text: q.text, options: q.options };
    }
  }

  if (game.phase === 'ended') {
    state.finalLeaderboard = game.finalLeaderboard || [];
    // pull newly-earned achievements per player so player.html can show them
    state.results = [...game.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatar,
      score: p.score,
      rank: p.rank,
      eliminated: p.eliminated,
      newlyEarned: p.newlyEarned || [],
    }));
  }
  return state;
}

function liveStatusFor(name) {
  if (game.phase === 'lobby' || game.phase === 'ended') return { inGame: false };
  let foundPlayer = null;
  for (const p of game.players.values()) {
    if (p.name === name) { foundPlayer = p; break; }
  }
  if (!foundPlayer) return { inGame: false };

  const sorted = [...game.players.values()].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return b.score - a.score;
  });
  const rank = sorted.findIndex((p) => p.id === foundPlayer.id) + 1;

  const now = Date.now();
  let timeLeftMs = 0;
  if (game.phase === 'question' && game.deadline) timeLeftMs = Math.max(0, game.deadline - now);
  if (game.phase === 'reveal' && game.revealEndsAt) timeLeftMs = Math.max(0, game.revealEndsAt - now);
  if (game.phase === 'between' && game.betweenEndsAt) timeLeftMs = Math.max(0, game.betweenEndsAt - now);

  return {
    inGame: true,
    phase: game.phase,
    mode: game.mode,
    score: foundPlayer.score,
    rank,
    totalPlayers: game.players.size,
    eliminated: foundPlayer.eliminated,
    currentQuestion: { index: game.currentIndex, total: game.questions.length },
    timeLeftMs,
  };
}

module.exports = {
  openLobby,
  joinPlayer,
  startQuiz,
  startBattle,
  nextQuestion,
  submitAnswer,
  publicState,
  liveStatusFor,
  shuffleOptions,
  RAW_QUESTIONS,
  QUESTION_MS,
};
