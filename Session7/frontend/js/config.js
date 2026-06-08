// Shared frontend config. If you deploy backend to a different host, edit API here.
window.API = window.API || `${location.protocol}//${location.hostname}:3000`;

window.AVATAR_STYLES = [
  'adventurer', 'avataaars', 'bottts', 'fun-emoji',
  'lorelei', 'micah', 'pixel-art', 'thumbs'
];

window.avatarUrl = function (style, seed) {
  const s = encodeURIComponent(style || 'bottts');
  const seedSafe = encodeURIComponent(seed || 'guest');
  return `https://api.dicebear.com/7.x/${s}/svg?seed=${seedSafe}`;
};

window.HOST_KEY_STORAGE_KEY = 'vibe_host_key';
window.HOST_KEY_DEFAULT = 'vibe-class';

// Profile helpers: a "complete" profile means we have a saved name.
window.hasProfile = function () {
  const name = (localStorage.getItem('vibe_player_name') || '').trim();
  return !!name;
};

// Bounce to the login/register page if no profile is configured yet.
// Returns true if a redirect was triggered (caller should stop further work).
window.requireProfile = function () {
  if (window.hasProfile()) return false;
  const next = encodeURIComponent(location.pathname + location.search);
  window.location.replace(`./login.html?next=${next}`);
  return true;
};

window.persianRelative = function (iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'همین الان';
  const m = Math.floor(s / 60);
  if (m < 60) return `${toFa(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${toFa(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${toFa(d)} روز پیش`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${toFa(mo)} ماه پیش`;
  return `${toFa(Math.floor(mo / 12))} سال پیش`;
};

function toFa(n) {
  const map = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).split('').map((c) => (map[+c] !== undefined ? map[+c] : c)).join('');
}
window.toFa = toFa;
