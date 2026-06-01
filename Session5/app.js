// — CONFIG —

const API = 'https://restcountries.com/v3.1/all?fields=name,flags,capital,region,population';
const GIPHY_KEY = 'YOUR_GIPHY_API_KEY'; // Replace at https://developers.giphy.com

const GIF_LOCAL_DIR = 'gifs';

const LEVELS = [
  {
    id: 1,
    name: 'Easy Capitals',
    color: '#58CC02',
    dark: '#46A302',
    type: 'capital-easy',
    gifs: {
      correct: {
        local: `${GIF_LOCAL_DIR}/level-1-correct.gif`,
        remote: ['https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif'],
        emoji: '🎉',
        giphyTag: 'celebration green',
      },
      wrong: {
        local: `${GIF_LOCAL_DIR}/level-1-wrong.gif`,
        remote: ['https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif'],
        emoji: '😢',
        giphyTag: 'fail oops',
      },
      complete: {
        local: `${GIF_LOCAL_DIR}/level-1-complete.gif`,
        remote: ['https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'],
        emoji: '🏆',
        giphyTag: 'victory trophy',
      },
    },
  },
  {
    id: 2,
    name: 'Flag Master',
    color: '#1CB0F6',
    dark: '#1899D6',
    type: 'flag',
    gifs: {
      correct: {
        local: `${GIF_LOCAL_DIR}/level-2-correct.gif`,
        remote: ['https://media.giphy.com/media/l0MYt5jPR6N5htq7S/giphy.gif'],
        emoji: '🎊',
        giphyTag: 'celebration blue',
      },
      wrong: {
        local: `${GIF_LOCAL_DIR}/level-2-wrong.gif`,
        remote: ['https://media.giphy.com/media/3o6Zt6ML6Bpu0v4aDm/giphy.gif'],
        emoji: '😔',
        giphyTag: 'fail sad',
      },
      complete: {
        local: `${GIF_LOCAL_DIR}/level-2-complete.gif`,
        remote: ['https://media.giphy.com/media/5GoVLqeE9PgPe/giphy.gif'],
        emoji: '🚩',
        giphyTag: 'winner flag',
      },
    },
  },
  {
    id: 3,
    name: 'Continents',
    color: '#CE82FF',
    dark: '#A560D1',
    type: 'region',
    gifs: {
      correct: {
        local: `${GIF_LOCAL_DIR}/level-3-correct.gif`,
        remote: ['https://media.giphy.com/media/9rtpurjbqiqZXbBBet/giphy.gif'],
        emoji: '✨',
        giphyTag: 'celebration purple',
      },
      wrong: {
        local: `${GIF_LOCAL_DIR}/level-3-wrong.gif`,
        remote: ['https://media.giphy.com/media/3o7TKsQ8MJHyTAsO2I/giphy.gif'],
        emoji: '😞',
        giphyTag: 'fail no',
      },
      complete: {
        local: `${GIF_LOCAL_DIR}/level-3-complete.gif`,
        remote: ['https://media.giphy.com/media/26BRvFJ3XxOTK/giphy.gif'],
        emoji: '🌍',
        giphyTag: 'world map win',
      },
    },
  },
  {
    id: 4,
    name: 'Hard Capitals',
    color: '#FF9600',
    dark: '#D97F00',
    type: 'capital-hard',
    gifs: {
      correct: {
        local: `${GIF_LOCAL_DIR}/level-4-correct.gif`,
        remote: ['https://media.giphy.com/media/11sBLlCs7rujkk/giphy.gif'],
        emoji: '🔥',
        giphyTag: 'celebration orange',
      },
      wrong: {
        local: `${GIF_LOCAL_DIR}/level-4-wrong.gif`,
        remote: ['https://media.giphy.com/media/14SaFK72VRDJ6/giphy.gif'],
        emoji: '😣',
        giphyTag: 'fail wrong',
      },
      complete: {
        local: `${GIF_LOCAL_DIR}/level-4-complete.gif`,
        remote: ['https://media.giphy.com/media/Is1O1TWV0LEI/giphy.gif'],
        emoji: '⭐',
        giphyTag: 'level up star',
      },
    },
  },
  {
    id: 5,
    name: 'Population & Detail',
    color: '#FF4B4B',
    dark: '#EA2B2B',
    type: 'population',
    gifs: {
      correct: {
        local: `${GIF_LOCAL_DIR}/level-5-correct.gif`,
        remote: ['https://media.giphy.com/media/4fDW3ySDxJUIw/giphy.gif'],
        emoji: '💯',
        giphyTag: 'celebration red',
      },
      wrong: {
        local: `${GIF_LOCAL_DIR}/level-5-wrong.gif`,
        remote: ['https://media.giphy.com/media/3og0IPx0cQ8P9pUIec/giphy.gif'],
        emoji: '😭',
        giphyTag: 'fail cry',
      },
      complete: {
        local: `${GIF_LOCAL_DIR}/level-5-complete.gif`,
        remote: ['https://media.giphy.com/media/7zEevJ9o7jpXe/giphy.gif'],
        emoji: '👑',
        giphyTag: 'champion crown',
      },
    },
  },
];

const QUESTIONS_PER_LEVEL = 10;
const MAX_HEARTS = 5;
const HEART_REGEN_MS = 60_000;

const LS_HEARTS = 'geoquiz_hearts';
const LS_LAST_LOSS = 'geoquiz_lastHeartLoss';
const LS_LEVEL = 'geoquiz_level';
const LS_QUESTION_IDX = 'geoquiz_questionIdx';
const LS_SCORE = 'geoquiz_score';
const LS_LEADERBOARD = 'geoquiz_leaderboard';
const LS_COMPLETED = 'geoquiz_completed';

// — STATE —

let countries = [];
let hearts = MAX_HEARTS;
let lastHeartLoss = Date.now();
let currentLevel = null;
let questionIdx = 0;
let score = 0;
let currentQuestion = null;
let answering = false;
let lastAnswerCorrect = false;
let wrongAttemptsOnQuestion = 0;
let answerRevealed = false;
let revealFeedbackTimer = null;
let revealHintTimer = null;
let countdownTimer = null;
let homeRegenTimer = null;
let audioCtx = null;

// — DATA —

async function fetchCountries() {
  if (countries.length) return countries;
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to load countries');
  const data = await res.json();
  countries = data.filter((c) => c.name?.common);
  return countries;
}

function getCountryName(c) {
  return c.name.common;
}

function getCapital(c) {
  return c.capital?.[0] ?? null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n, exclude = new Set()) {
  const pool = arr.filter((x) => !exclude.has(x));
  return shuffle(pool).slice(0, n);
}

function poolForType(type) {
  switch (type) {
    case 'capital-easy':
      return countries.filter((c) => c.population > 20_000_000 && getCapital(c));
    case 'capital-hard':
      return countries.filter((c) => getCapital(c));
    case 'flag':
    case 'population':
      return countries;
    case 'region':
      return countries.filter((c) => c.region);
    default:
      return countries;
  }
}

function formatPopulation(pop) {
  const millions = Math.round(pop / 1_000_000);
  return `~${millions} million`;
}

const REGION_LABELS = {
  Africa: 'Africa',
  Americas: 'Americas',
  Asia: 'Asia',
  Europe: 'Europe',
  Oceania: 'Oceania',
  Antarctic: 'Antarctica',
};

// — QUESTIONS —

function buildQuestion(level) {
  const pool = poolForType(level.type);
  if (!pool.length) return null;

  const country = pool[Math.floor(Math.random() * pool.length)];
  const name = getCountryName(country);
  let prompt = '';
  let correct = '';
  let mediaHtml = null;
  let wrongPool = [];

  switch (level.type) {
    case 'capital-easy':
    case 'capital-hard': {
      correct = getCapital(country);
      prompt = `What is the capital of ${name}?`;
      wrongPool = pool.filter((c) => c !== country).map(getCapital).filter(Boolean);
      break;
    }
    case 'flag': {
      correct = name;
      prompt = 'Which country does this flag belong to?';
      mediaHtml = `<img src="${country.flags.svg}" alt="Flag of unknown country" width="120" />`;
      wrongPool = pool.filter((c) => c !== country).map(getCountryName);
      break;
    }
    case 'region': {
      correct = REGION_LABELS[country.region] || country.region;
      prompt = `Which region is ${name} in?`;
      wrongPool = [...new Set(countries.map((c) => REGION_LABELS[c.region] || c.region).filter(Boolean))];
      wrongPool = wrongPool.filter((r) => r !== correct);
      break;
    }
    case 'population': {
      correct = name;
      prompt = `Which country has a population of ${formatPopulation(country.population)}?`;
      wrongPool = pool.filter((c) => c !== country).map(getCountryName);
      break;
    }
    default:
      return null;
  }

  const wrong = pickRandom(wrongPool, 3, new Set([correct]));
  while (wrong.length < 3 && wrongPool.length > 0) {
    const extra = wrongPool[Math.floor(Math.random() * wrongPool.length)];
    if (extra !== correct && !wrong.includes(extra)) wrong.push(extra);
  }

  const options = shuffle([correct, ...wrong.slice(0, 3)]);
  return { prompt, correct, options, mediaHtml, country };
}

// — HEARTS —

function loadHearts() {
  const saved = localStorage.getItem(LS_HEARTS);
  const savedLoss = localStorage.getItem(LS_LAST_LOSS);
  hearts = saved !== null ? parseInt(saved, 10) : MAX_HEARTS;
  lastHeartLoss = savedLoss ? parseInt(savedLoss, 10) : Date.now();

  const elapsed = Date.now() - lastHeartLoss;
  const restored = Math.floor(elapsed / HEART_REGEN_MS);
  if (restored > 0) {
    hearts = Math.min(MAX_HEARTS, hearts + restored);
    if (hearts < MAX_HEARTS) {
      lastHeartLoss += restored * HEART_REGEN_MS;
    }
  }

  saveHearts();
}

function saveHearts() {
  localStorage.setItem(LS_HEARTS, String(hearts));
  localStorage.setItem(LS_LAST_LOSS, String(lastHeartLoss));
}

function loseHeart() {
  if (hearts <= 0) return;
  hearts = Math.max(0, hearts - 1);
  lastHeartLoss = Date.now();
  saveHearts();
  renderHearts();
}

function msUntilNextHeart() {
  if (hearts >= MAX_HEARTS) return 0;
  const elapsed = Date.now() - lastHeartLoss;
  return HEART_REGEN_MS - (elapsed % HEART_REGEN_MS);
}

function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function tickHearts() {
  const prev = hearts;
  loadHearts();
  if (hearts !== prev) {
    renderHearts();
    renderLevelList();
  }
  return hearts;
}

function startHeartCountdown() {
  stopHeartCountdown();
  const el = document.getElementById('heart-countdown');
  if (!el) return;

  function tick() {
    tickHearts();
    if (hearts > 0) {
      stopHeartCountdown();
      showScreen('screen-home');
      renderHearts();
      renderLevelList();
      startHomeRegen();
      return;
    }
    el.textContent = formatCountdown(msUntilNextHeart());
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function stopHeartCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startHomeRegen() {
  stopHomeRegen();
  const info = document.getElementById('home-regen');
  const timeEl = document.getElementById('home-regen-time');
  if (!info || !timeEl) return;

  function tick() {
    tickHearts();
    if (hearts >= MAX_HEARTS) {
      info.classList.add('hidden');
      return;
    }
    info.classList.remove('hidden');
    timeEl.textContent = formatCountdown(msUntilNextHeart());
  }

  tick();
  homeRegenTimer = setInterval(tick, 1000);
}

function stopHomeRegen() {
  if (homeRegenTimer) {
    clearInterval(homeRegenTimer);
    homeRegenTimer = null;
  }
}

// — AUDIO —

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function ensureAudioReady() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

function scheduleTone(ctx, freq, delay, duration, type = 'sine', volume = 0.4) {
  const start = ctx.currentTime + delay;
  const end = start + duration;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.linearRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.05);
}

async function playCorrectSound() {
  try {
    const ctx = await ensureAudioReady();
    scheduleTone(ctx, 523, 0, 0.14, 'sine', 0.45);
    scheduleTone(ctx, 659, 0.13, 0.14, 'sine', 0.45);
    scheduleTone(ctx, 784, 0.26, 0.22, 'sine', 0.5);
  } catch { /* audio unavailable */ }
}

async function playWrongSound() {
  try {
    const ctx = await ensureAudioReady();
    scheduleTone(ctx, 220, 0, 0.22, 'square', 0.35);
    scheduleTone(ctx, 165, 0.18, 0.28, 'square', 0.3);
  } catch { /* audio unavailable */ }
}

async function playVictorySound() {
  try {
    const ctx = await ensureAudioReady();
    const notes = [523, 659, 784, 988, 1175, 1319];
    notes.forEach((freq, i) => scheduleTone(ctx, freq, i * 0.1, 0.2, 'sine', 0.38));
    scheduleTone(ctx, 1568, 0.65, 0.5, 'sine', 0.42);
    scheduleTone(ctx, 2093, 0.95, 0.35, 'triangle', 0.32);
  } catch { /* audio unavailable */ }
}

function unlockAudio() {
  ensureAudioReady();
}

// — LEVEL PROGRESS —

function getCompletedLevels() {
  try {
    return JSON.parse(localStorage.getItem(LS_COMPLETED) || '[]');
  } catch {
    return [];
  }
}

function isLevelUnlocked(levelId) {
  if (levelId === 1) return true;
  return getCompletedLevels().includes(levelId - 1);
}

function markLevelCompleted(levelId) {
  const completed = getCompletedLevels();
  if (!completed.includes(levelId)) {
    completed.push(levelId);
    localStorage.setItem(LS_COMPLETED, JSON.stringify(completed));
  }
}

// — RENDERING —

function renderHearts() {
  const html = Array.from({ length: MAX_HEARTS }, (_, i) => {
    const filled = i < hearts;
    return `<span class="heart${filled ? '' : ' empty'}" aria-hidden="true">${filled ? '❤️' : '🖤'}</span>`;
  }).join('');

  document.querySelectorAll('.hearts').forEach((el) => {
    el.innerHTML = html;
    el.setAttribute('aria-label', `${hearts} of ${MAX_HEARTS} lives remaining`);
  });
}

function renderLevelList() {
  const list = document.getElementById('level-list');
  if (!list) return;

  const completed = getCompletedLevels();
  const noHearts = hearts === 0;

  list.innerHTML = LEVELS.map((level) => {
    const unlocked = isLevelUnlocked(level.id);
    const done = completed.includes(level.id);
    const disabled = !unlocked || noHearts;
    const desc = {
      'capital-easy': 'Big countries & capitals',
      flag: 'Match flags to nations',
      region: 'Continents & regions',
      'capital-hard': 'Every capital',
      population: 'Guess by population',
    }[level.type];

    const lockIcon = !unlocked ? '<span class="level-lock" aria-hidden="true">🔒</span>' : '';
    const doneMark = done ? ' completed' : '';
    const lockClass = !unlocked ? ' locked' : '';

    return `
      <button
        type="button"
        class="level-card${lockClass}${doneMark}"
        data-level-id="${level.id}"
        style="border-bottom-color: ${level.dark}"
        ${disabled ? 'disabled' : ''}
        aria-label="${unlocked ? 'Start' : 'Locked'} level ${level.id}: ${level.name}"
      >
        <span class="level-badge" style="background: ${unlocked ? level.color : ''}">${done ? '✓' : level.id}</span>
        <span class="level-card-info">
          <span class="level-card-name">${level.name}</span>
          <span class="level-card-desc">${unlocked ? desc : 'Complete the previous level first'}</span>
        </span>
        ${lockIcon}
      </button>
    `;
  }).join('');

  list.querySelectorAll('.level-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.levelId, 10);
      if (!isLevelUnlocked(id)) return;
      startLevel(id);
    });
  });
}

function renderProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const pct = (questionIdx / QUESTIONS_PER_LEVEL) * 100;
  bar.style.width = `${pct}%`;
  bar.setAttribute('aria-valuenow', String(questionIdx));
  bar.setAttribute('aria-valuemax', String(QUESTIONS_PER_LEVEL));
}

function renderQuestion(reuse = false) {
  if (!currentLevel) return;

  if (!reuse || !currentQuestion) {
    clearRevealHintTimer();
    currentQuestion = buildQuestion(currentLevel);
    wrongAttemptsOnQuestion = 0;
    answerRevealed = false;
  }
  if (!currentQuestion) {
    document.getElementById('question-text').textContent = 'Could not load question. Try again.';
    return;
  }

  const media = document.getElementById('question-media');
  const text = document.getElementById('question-text');
  const optionsEl = document.getElementById('options');

  if (currentQuestion.mediaHtml) {
    media.innerHTML = currentQuestion.mediaHtml;
    media.classList.remove('hidden');
  } else {
    media.innerHTML = '';
    media.classList.add('hidden');
  }

  text.textContent = currentQuestion.prompt;

  optionsEl.innerHTML = currentQuestion.options
    .map(
      (opt) => `
      <button
        type="button"
        class="option-btn"
        data-option="${escapeAttr(opt)}"
        aria-label="Answer: ${escapeAttr(opt)}"
      >
        ${escapeHtml(opt)}
      </button>
    `
    )
    .join('');

  optionsEl.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => onOptionClick(btn.dataset.option));
  });

  if (answerRevealed) {
    applyRevealedOptionsUI();
  }

  document.getElementById('level-label').textContent = currentLevel.name;
  document.getElementById('score-display').textContent = `Score: ${score} / ${QUESTIONS_PER_LEVEL}`;
  renderProgress();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// — FEEDBACK (GIF + SOUND) —
// Load order: Giphy API → remote URL → local gifs/ → emoji

function getLevelGifAsset(level, kind) {
  return level?.gifs?.[kind] ?? null;
}

async function fetchGiphy(tag) {
  if (!tag || GIPHY_KEY === 'YOUR_GIPHY_API_KEY') return null;
  try {
    const url = `https://api.giphy.com/v1/gifs/random?api_key=${GIPHY_KEY}&tag=${encodeURIComponent(tag)}&rating=g`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data?.images?.downsized_medium?.url || data.data?.images?.original?.url || null;
  } catch {
    return null;
  }
}

function buildGifUrlList(asset) {
  const urls = [];
  if (asset.remote?.length) urls.push(...asset.remote);
  if (asset.local) urls.push(asset.local);
  return urls;
}

function showEmojiOnly(gif, emoji, emojiChar) {
  gif.classList.add('hidden');
  gif.classList.remove('loaded');
  gif.src = '';
  gif.alt = '';
  emoji.textContent = emojiChar;
  emoji.style.display = '';
}

function showGifLoaded(gif, emoji, url, altText) {
  gif.src = url;
  gif.alt = altText;
  gif.classList.remove('hidden');
  gif.classList.add('loaded');
  emoji.style.display = 'none';
}

function tryLoadGifChain(gif, emoji, urls, idx, emojiFallback, altText) {
  if (idx >= urls.length) {
    showEmojiOnly(gif, emoji, emojiFallback);
    return;
  }

  const img = new Image();
  img.onload = () => showGifLoaded(gif, emoji, urls[idx], altText);
  img.onerror = () => tryLoadGifChain(gif, emoji, urls, idx + 1, emojiFallback, altText);
  img.src = urls[idx];
}

function loadGifAsset(gifEl, emojiEl, asset, altText) {
  if (!gifEl || !emojiEl || !asset) return;

  const emojiFallback = asset.emoji || '🎉';
  showEmojiOnly(gifEl, emojiEl, emojiFallback);

  const startChain = (candidates) => {
    tryLoadGifChain(gifEl, emojiEl, candidates, 0, emojiFallback, altText);
  };

  fetchGiphy(asset.giphyTag).then((giphyUrl) => {
    const candidates = [];
    if (giphyUrl) candidates.push(giphyUrl);
    candidates.push(...buildGifUrlList(asset));
    startChain(candidates);
  });
}

function loadFeedbackGif(correct) {
  if (!currentLevel) return;
  const kind = correct ? 'correct' : 'wrong';
  const asset = getLevelGifAsset(currentLevel, kind);
  const gif = document.getElementById('feedback-gif');
  const emoji = document.getElementById('feedback-emoji');
  loadGifAsset(gif, emoji, asset, correct ? 'Correct answer' : 'Wrong answer');
}

function loadWinGif(level) {
  const asset = getLevelGifAsset(level, 'complete');
  const gif = document.getElementById('win-gif');
  const emoji = document.getElementById('win-emoji');
  loadGifAsset(gif, emoji, asset, `Level ${level.id} complete`);
}

const REVEAL_ANSWER_MS = 2000;

function clearRevealFeedbackTimer() {
  if (revealFeedbackTimer) {
    clearTimeout(revealFeedbackTimer);
    revealFeedbackTimer = null;
  }
}

function clearRevealHintTimer() {
  if (revealHintTimer) {
    clearTimeout(revealHintTimer);
    revealHintTimer = null;
  }
}

function showFeedback(correct, message, options = {}) {
  clearRevealFeedbackTimer();

  const overlay = document.getElementById('overlay-feedback');
  const msg = document.getElementById('feedback-message');
  const btnNext = document.getElementById('btn-feedback-next');

  overlay.classList.remove('hidden', 'correct', 'wrong');
  overlay.classList.add(correct ? 'correct' : 'wrong');
  msg.textContent = message;
  btnNext.textContent = correct ? 'Continue' : 'Try again';
  btnNext.classList.remove('hidden');

  loadFeedbackGif(correct);
  answering = true;
  lastAnswerCorrect = correct;

  if (options.autoDismissMs) {
    btnNext.classList.add('hidden');
    revealFeedbackTimer = setTimeout(() => {
      revealFeedbackTimer = null;
      dismissRevealAnswerOverlay();
    }, options.autoDismissMs);
  }
}

function dismissRevealAnswerOverlay() {
  clearRevealFeedbackTimer();
  hideFeedback();
  document.getElementById('btn-feedback-next')?.classList.remove('hidden');

  if (hearts <= 0) {
    showScreen('screen-no-hearts');
    startHeartCountdown();
    return;
  }

  renderQuestion(true);
}

function normalizeRevealedOptions() {
  document.querySelectorAll('.option-btn').forEach((btn) => {
    btn.classList.remove('revealed-hint');
    btn.disabled = false;
  });
}

function applyRevealedOptionsUI() {
  if (!currentQuestion) return;
  clearRevealHintTimer();

  document.querySelectorAll('.option-btn').forEach((btn) => {
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'revealed-hint');
    if (btn.dataset.option === currentQuestion.correct) {
      btn.classList.add('revealed-hint');
    }
  });

  revealHintTimer = setTimeout(() => {
    revealHintTimer = null;
    normalizeRevealedOptions();
  }, REVEAL_ANSWER_MS);
}

async function onOptionClick(selected) {
  await ensureAudioReady();
  handleAnswer(selected);
}

function hideFeedback() {
  clearRevealFeedbackTimer();
  document.getElementById('overlay-feedback').classList.add('hidden');
  document.getElementById('btn-feedback-next')?.classList.remove('hidden');
  answering = false;
}

// — SCREENS —

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  const screen = document.getElementById(id);
  if (screen) screen.classList.remove('hidden');

  if (id === 'screen-home') {
    startHomeRegen();
  } else {
    stopHomeRegen();
  }
}

function applyLevelTheme(level) {
  const root = document.documentElement.style;
  root.setProperty('--accent', level.color);
  root.setProperty('--accent-dark', level.dark);
}

function persistProgress() {
  localStorage.setItem(LS_LEVEL, String(currentLevel?.id ?? 1));
  localStorage.setItem(LS_QUESTION_IDX, String(questionIdx));
  localStorage.setItem(LS_SCORE, String(score));
}

function loadProgress() {
  questionIdx = parseInt(localStorage.getItem(LS_QUESTION_IDX) || '0', 10);
  score = parseInt(localStorage.getItem(LS_SCORE) || '0', 10);
}

function startLevel(levelId) {
  if (hearts <= 0) {
    showScreen('screen-no-hearts');
    startHeartCountdown();
    return;
  }

  if (!isLevelUnlocked(levelId)) return;

  currentLevel = LEVELS.find((l) => l.id === levelId);
  if (!currentLevel) return;

  const resumeSame = parseInt(localStorage.getItem(LS_LEVEL) || '0', 10) === levelId;
  if (!resumeSame) {
    questionIdx = 0;
    score = 0;
  } else {
    loadProgress();
  }

  wrongAttemptsOnQuestion = 0;
  answerRevealed = false;
  clearRevealHintTimer();

  applyLevelTheme(currentLevel);
  persistProgress();
  showScreen('screen-game');
  renderHearts();
  renderQuestion();
}

async function handleAnswer(selected) {
  if (answering || !currentQuestion) return;

  const correct = selected === currentQuestion.correct;
  const buttons = document.querySelectorAll('.option-btn');

  if (answerRevealed && !correct) {
    await playWrongSound();
    buttons.forEach((btn) => {
      if (btn.dataset.option === selected) {
        btn.classList.add('wrong');
        setTimeout(() => btn.classList.remove('wrong'), 500);
      }
    });
    return;
  }

  if (correct) {
    buttons.forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.option === currentQuestion.correct) btn.classList.add('correct');
    });
    await playCorrectSound();
    score += 1;
    persistProgress();
    showFeedback(true, 'Great job!');
    return;
  }

  wrongAttemptsOnQuestion += 1;
  const revealCorrect = wrongAttemptsOnQuestion >= 2;

  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.option === selected) btn.classList.add('wrong');
    });

  loseHeart();
  await playWrongSound();

  if (revealCorrect) {
    answerRevealed = true;
    showFeedback(false, `The correct answer is: ${currentQuestion.correct}`, {
      autoDismissMs: REVEAL_ANSWER_MS,
    });
  } else {
    showFeedback(false, 'Not quite! Try again.');
  }
}

function advanceAfterFeedback() {
  if (revealFeedbackTimer) {
    dismissRevealAnswerOverlay();
    return;
  }

  hideFeedback();

  if (hearts <= 0) {
    showScreen('screen-no-hearts');
    startHeartCountdown();
    return;
  }

  if (!lastAnswerCorrect) {
    renderQuestion(true);
    return;
  }

  wrongAttemptsOnQuestion = 0;
  answerRevealed = false;
  clearRevealHintTimer();

  questionIdx += 1;

  if (questionIdx >= QUESTIONS_PER_LEVEL) {
    finishLevel();
    return;
  }

  persistProgress();
  renderQuestion();
}

function renderWinScreen(level, finalScore) {
  const completed = getCompletedLevels().includes(level.id);
  const badge = document.getElementById('win-badge');
  const title = document.getElementById('win-title');
  const message = document.getElementById('win-message');
  const scoreEl = document.getElementById('win-score');
  const nameEl = document.getElementById('win-level-name');

  if (badge) {
    badge.textContent = `Level ${level.id}`;
    badge.style.background = level.color;
    badge.style.borderColor = level.dark;
  }
  if (title) title.textContent = `${level.name} — finished!`;
  if (message) {
    message.textContent = completed
      ? `You completed all ${QUESTIONS_PER_LEVEL} questions in this level.`
      : `Level ${level.id} is now complete. Great work!`;
  }
  if (scoreEl) scoreEl.textContent = `Score: ${finalScore} / ${QUESTIONS_PER_LEVEL}`;
  if (nameEl) nameEl.textContent = `Stage ${level.id} of ${LEVELS.length} done`;

  loadWinGif(level);

  const nextLevel = LEVELS.find((l) => l.id === level.id + 1);
  const btnNext = document.getElementById('btn-win-next');
  if (nextLevel) {
    btnNext.textContent = `Next: ${nextLevel.name}`;
    btnNext.onclick = () => startLevel(nextLevel.id);
  } else {
    btnNext.textContent = 'Play again';
    btnNext.onclick = () => startLevel(level.id);
  }
}

function finishLevel() {
  const finalScore = score;
  const level = currentLevel;
  addLeaderboardEntry(level.name, finalScore, level.id);
  markLevelCompleted(level.id);

  questionIdx = 0;
  score = 0;
  persistProgress();

  renderWinScreen(level, finalScore);
  showScreen('screen-win');
  playVictorySound();
}

// — RESET —

function resetAllProgress() {
  const confirmed = confirm(
    'Reset all progress?\n\nThis clears hearts, levels, scores, and the leaderboard.'
  );
  if (!confirmed) return;

  [
    LS_HEARTS,
    LS_LAST_LOSS,
    LS_LEVEL,
    LS_QUESTION_IDX,
    LS_SCORE,
    LS_LEADERBOARD,
    LS_COMPLETED,
  ].forEach((key) => localStorage.removeItem(key));

  hearts = MAX_HEARTS;
  lastHeartLoss = Date.now();
  questionIdx = 0;
  score = 0;
  currentLevel = null;
  currentQuestion = null;
  answering = false;
  wrongAttemptsOnQuestion = 0;
  answerRevealed = false;
  clearRevealFeedbackTimer();
  clearRevealHintTimer();

  saveHearts();
  renderHearts();
  renderLevelList();
  showScreen('screen-home');
  startHomeRegen();
}

// — LEADERBOARD —

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LS_LEADERBOARD) || '[]');
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LS_LEADERBOARD, JSON.stringify(entries));
}

function getEntryCompletedAt(entry) {
  return entry.completedAt ?? entry.date ?? 0;
}

function formatLeaderboardDateTime(timestamp) {
  const d = new Date(timestamp);
  const datePart = d.toLocaleDateString();
  const timePart = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function addLeaderboardEntry(levelName, entryScore, levelId) {
  const completedAt = Date.now();
  const completed = new Date(completedAt);
  const entries = getLeaderboard();
  entries.push({
    levelName,
    score: entryScore,
    levelId,
    total: QUESTIONS_PER_LEVEL,
    completedAt,
    hour: completed.getHours(),
    minute: completed.getMinutes(),
  });
  entries.sort(
    (a, b) => b.score - a.score || getEntryCompletedAt(b) - getEntryCompletedAt(a)
  );
  saveLeaderboard(entries.slice(0, 20));
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  const empty = document.getElementById('leaderboard-empty');
  const entries = getLeaderboard();

  if (!entries.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  const rankClass = ['gold', 'silver', 'bronze'];

  list.innerHTML = entries
    .map((e, i) => {
      const rank = i + 1;
      const rc = rank <= 3 ? rankClass[rank - 1] : '';
      const completedLabel = formatLeaderboardDateTime(getEntryCompletedAt(e));
      return `
        <li class="leaderboard-item">
          <span class="leaderboard-rank ${rc}">${rank}</span>
          <div class="leaderboard-details">
            <strong>${escapeHtml(e.levelName)}</strong>
            <span class="leaderboard-time">${escapeHtml(completedLabel)}</span>
          </div>
          <span class="leaderboard-score">${e.score}/${e.total}</span>
        </li>
      `;
    })
    .join('');
}

// — INIT —

function bindEvents() {
  document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
    renderLeaderboard();
    showScreen('screen-leaderboard');
  });

  document.getElementById('btn-leaderboard-back')?.addEventListener('click', () => {
    showScreen('screen-home');
    renderLevelList();
  });

  document.getElementById('btn-quit')?.addEventListener('click', () => {
    showScreen('screen-home');
    renderLevelList();
  });

  document.getElementById('btn-no-hearts-home')?.addEventListener('click', () => {
    stopHeartCountdown();
    showScreen('screen-home');
    renderLevelList();
  });

  document.getElementById('btn-win-home')?.addEventListener('click', () => {
    showScreen('screen-home');
    renderLevelList();
  });

  document.getElementById('btn-feedback-next')?.addEventListener('click', async () => {
    await ensureAudioReady();
    advanceAfterFeedback();
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    resetAllProgress();
  });

  document.body.addEventListener('click', unlockAudio);
  document.body.addEventListener('touchstart', unlockAudio, { passive: true });
}

async function init() {
  const loading = document.getElementById('loading');
  bindEvents();
  loadHearts();
  renderHearts();

  try {
    await fetchCountries();
  } catch {
    loading.querySelector('p').textContent = 'Failed to load countries. Check your connection.';
    return;
  }

  loading.classList.add('hidden');
  renderLevelList();

  if (hearts <= 0) {
    showScreen('screen-no-hearts');
    startHeartCountdown();
  } else {
    showScreen('screen-home');
    startHomeRegen();
  }
}

init();
