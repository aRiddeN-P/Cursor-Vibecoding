/**
 * avatarHelper.js
 * Hardcoded source-of-truth for Dakhlyar avatars.
 *
 * - 20 free seeds   → available to every user
 * - 20 premium seeds → only available while the user has an active subscription
 *
 * Whenever the server returns or accepts an avatar seed, this module MUST be
 * the only authority on what is valid. Never trust a seed name coming from
 * the client without passing it through `isValidSeed()`.
 */

const FREE_SEEDS = Object.freeze([
  'aria', 'luna', 'nova', 'sage', 'iris',
  'leo',  'finn', 'zara', 'eden', 'blake',
  'sky',  'rain', 'dawn', 'ash',  'brook',
  'vale', 'reef', 'wren', 'cove', 'fern',
]);

const PREMIUM_SEEDS = Object.freeze([
  'orion',   'lyra',    'phoenix', 'atlas',   'zephyr',
  'aurora',  'draco',   'celeste', 'soleil',  'nimbus',
  'vega',    'altair',  'sirius',  'cygnus',  'aquila',
  'castor',  'pollux',  'rigel',   'deneb',   'antares',
]);

const FREE_BG = [
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
];

const PREMIUM_BG = [
  'f4d03f', 'a9cce3', 'a9dfbf', 'f1948a', 'bb8fce',
  'f7dc6f', '85c1e9', '82e0aa', 'f1948a', 'c39bd3',
  'f4d03f', 'a9cce3', 'a9dfbf', 'f1948a', 'bb8fce',
  'f7dc6f', '85c1e9', '82e0aa', 'f1948a', 'c39bd3',
];

/** Map of every seed → its background color hex (no leading #). */
const BG_COLORS = Object.freeze(
  Object.fromEntries(
    FREE_SEEDS.map((s, i) => [s, FREE_BG[i]])
      .concat(PREMIUM_SEEDS.map((s, i) => [s, PREMIUM_BG[i]]))
  )
);

const PREMIUM_SET = new Set(PREMIUM_SEEDS);
const ALL_SEEDS_SET = new Set([...FREE_SEEDS, ...PREMIUM_SEEDS]);

const DEFAULT_SEED = 'aria';
const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/personas/svg';

function isValidSeed(seed) {
  return typeof seed === 'string' && ALL_SEEDS_SET.has(seed);
}

function isPremiumSeed(seed) {
  return PREMIUM_SET.has(seed);
}

function dicebearUrl(seed) {
  const safeSeed = isValidSeed(seed) ? seed : DEFAULT_SEED;
  const bg = BG_COLORS[safeSeed] || 'b6e3f4';
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(safeSeed)}&backgroundColor=${bg}`;
}

/**
 * Return the avatar URL that should be displayed for a given user row.
 * Falls back to the default free avatar if no fields are set yet.
 */
function getAvatarUrl(user) {
  if (!user) return dicebearUrl(DEFAULT_SEED);
  if (user.avatar_type === 'custom' && user.avatar_custom_path) {
    return user.avatar_custom_path;
  }
  return dicebearUrl(user.avatar_seed || DEFAULT_SEED);
}

/**
 * Build a list of all 40 avatars with their lock state for a given user.
 * `hasActiveSubscription` is computed once by the caller (no DB hit here).
 */
function listAvatars(hasActiveSubscription) {
  return [
    ...FREE_SEEDS.map((seed) => ({
      seed,
      url: dicebearUrl(seed),
      is_premium: false,
      is_locked: false,
    })),
    ...PREMIUM_SEEDS.map((seed) => ({
      seed,
      url: dicebearUrl(seed),
      is_premium: true,
      is_locked: !hasActiveSubscription,
    })),
  ];
}

module.exports = {
  FREE_SEEDS,
  PREMIUM_SEEDS,
  BG_COLORS,
  DEFAULT_SEED,
  DICEBEAR_BASE,
  isValidSeed,
  isPremiumSeed,
  dicebearUrl,
  getAvatarUrl,
  listAvatars,
};
