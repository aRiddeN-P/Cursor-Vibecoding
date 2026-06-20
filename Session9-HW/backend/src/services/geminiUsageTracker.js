const geminiApiUsage = require('../models/geminiApiUsage');

const LIMITS = {
  rpm: Number(process.env.GEMINI_LIMIT_RPM) || 10,
  rpd: Number(process.env.GEMINI_LIMIT_RPD) || 250,
  tpm: Number(process.env.GEMINI_LIMIT_TPM) || 25000,
};

const WINDOW_MS = 60_000;
const minuteRequests = [];
const minuteTokens = [];

function pruneWindow(entries, now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  while (entries.length && entries[0].ts < cutoff) {
    entries.shift();
  }
}

function extractTokenCount(usageMetadata, fallback = 0) {
  if (!usageMetadata) return fallback;
  if (typeof usageMetadata.totalTokenCount === 'number') return usageMetadata.totalTokenCount;
  const prompt = usageMetadata.promptTokenCount || 0;
  const candidates = usageMetadata.candidatesTokenCount || 0;
  return prompt + candidates || fallback;
}

function estimateTokensFromText(...parts) {
  const chars = parts.filter(Boolean).join('').length;
  return Math.max(1, Math.ceil(chars / 4));
}

function recordGeminiUsage(usageMetadata, { fallbackText = '' } = {}) {
  const fallback = estimateTokensFromText(fallbackText);
  const tokens = extractTokenCount(usageMetadata, fallback);
  const now = Date.now();

  minuteRequests.push({ ts: now });
  minuteTokens.push({ ts: now, tokens });
  pruneWindow(minuteRequests, now);
  pruneWindow(minuteTokens, now);

  geminiApiUsage.incrementDaily(tokens);
  return tokens;
}

function recordGeminiRequestOnly(estimatedTokens = 0) {
  return recordGeminiUsage(null, { fallbackText: 'x'.repeat(estimatedTokens * 4) });
}

function getMinuteRequestCount() {
  pruneWindow(minuteRequests);
  return minuteRequests.length;
}

function getMinuteTokenCount() {
  pruneWindow(minuteTokens);
  return minuteTokens.reduce((sum, entry) => sum + entry.tokens, 0);
}

function getSnapshot() {
  const daily = geminiApiUsage.getDailyUsage();
  const requestsPerMinute = getMinuteRequestCount();
  const tokensPerMinute = getMinuteTokenCount();

  return {
    configured: true,
    limits: { ...LIMITS },
    used: {
      requests_per_minute: requestsPerMinute,
      requests_per_day: daily.request_count,
      tokens_per_minute: tokensPerMinute,
    },
    remaining: {
      requests_per_minute: Math.max(0, LIMITS.rpm - requestsPerMinute),
      requests_per_day: Math.max(0, LIMITS.rpd - daily.request_count),
      tokens_per_minute: Math.max(0, LIMITS.tpm - tokensPerMinute),
    },
  };
}

const LIMIT_MESSAGES = {
  gemini_daily_limit:
    'امروز ظرفیت سرویس قصه‌گویی پر شده — فردا دوباره می‌تونیم قصه تعاملی بسازیم. 🌙',
  gemini_rate_limit:
    'الان سرویس قصه‌گویی شلوغه — چند دقیقه دیگه دوباره امتحان کن. 🌙',
};

function checkAvailability() {
  const snapshot = getSnapshot();

  if (snapshot.remaining.requests_per_day <= 0) {
    return { available: false, code: 'gemini_daily_limit', message: LIMIT_MESSAGES.gemini_daily_limit };
  }
  if (snapshot.remaining.requests_per_minute <= 0) {
    return { available: false, code: 'gemini_rate_limit', message: LIMIT_MESSAGES.gemini_rate_limit };
  }
  if (snapshot.remaining.tokens_per_minute <= 0) {
    return { available: false, code: 'gemini_rate_limit', message: LIMIT_MESSAGES.gemini_rate_limit };
  }

  return { available: true };
}

module.exports = {
  LIMITS,
  LIMIT_MESSAGES,
  recordGeminiUsage,
  recordGeminiRequestOnly,
  getSnapshot,
  checkAvailability,
  extractTokenCount,
};
