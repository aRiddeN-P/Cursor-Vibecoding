/* Shared frontend helpers: theme, dock, achievements, avatar catalog, results modal. */

// ===================== THEME =====================
const THEME_KEY = 'vibe_theme';
function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
}
function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
}
function toggleTheme() {
  const cur = getTheme();
  setTheme(cur === 'dark' ? 'light' : 'dark');
}
function initTheme() {
  const t = getTheme();
  document.documentElement.setAttribute('data-theme', t);
}
window.getTheme = getTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;
initTheme();

// Inject Lilita One font (Google Fonts) once
(function ensureDisplayFont(){
  if (document.getElementById('vk-font-lilita')) return;
  const l = document.createElement('link');
  l.id = 'vk-font-lilita';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
  document.head.appendChild(l);
})();

// ===================== ACHIEVEMENTS =====================
window.ACHIEVEMENTS = [
  { type: 'first_win',     emoji: '🏆', label: 'اولین برد',     category: 'solo',  desc: 'اولین بازی انفرادی خود را با موفقیت تمام کنید (امتیاز > ۰)' },
  { type: 'perfect_score', emoji: '💎', label: 'امتیاز کامل',   category: 'solo',  desc: 'در بازی انفرادی به امتیاز حداکثر ۵۰۰۰ یا بالاتر برسید' },
  { type: 'speed_demon',   emoji: '⚡', label: 'سریع‌السیر',    category: 'solo',  desc: 'در یک بازی انفرادی امتیاز بالای ۴۰۰۰ بگیرید (پاسخ‌های سریع)' },
  { type: 'survivor',      emoji: '👑', label: 'بازمانده',      category: 'group', desc: 'در بازی گروهی (بتل رویال) تا انتها زنده بمانید' },
  { type: 'comeback',      emoji: '🔥', label: 'بازگشت',        category: 'group', desc: 'با امتیاز پایین ابتدای بازی، در پایان امتیاز خوبی بگیرید' },
  { type: 'veteran',       emoji: '🎖️', label: 'پیشکسوت',      category: 'group', desc: '۵ بازی گروهی یا بیشتر انجام دهید' },
];

window.ACH_DESC = window.ACHIEVEMENTS.reduce((acc,a) => { acc[a.type] = a.desc; return acc; }, {});

// ===================== AVATAR CATALOG (40+) =====================
// Each entry: { id, style, seed, unlock }
// unlock: 'free' | { type:'achievement', achievement:'<type>' } | { type:'days', days:<n> }
window.AVATAR_CATALOG = [
  // ----- FREE (16) -----
  { id: 'f01', style: 'bottts',     seed: 'spark',     unlock: 'free', label: 'ربات شعله' },
  { id: 'f02', style: 'bottts',     seed: 'turbo',     unlock: 'free', label: 'ربات توربو' },
  { id: 'f03', style: 'bottts',     seed: 'nova',      unlock: 'free', label: 'ربات نوا' },
  { id: 'f04', style: 'adventurer', seed: 'hero',      unlock: 'free', label: 'قهرمان' },
  { id: 'f05', style: 'adventurer', seed: 'knight',    unlock: 'free', label: 'شوالیه' },
  { id: 'f06', style: 'adventurer', seed: 'rogue',     unlock: 'free', label: 'رنجر' },
  { id: 'f07', style: 'avataaars',  seed: 'cool',      unlock: 'free', label: 'باحال' },
  { id: 'f08', style: 'avataaars',  seed: 'student',   unlock: 'free', label: 'دانشجو' },
  { id: 'f09', style: 'fun-emoji',  seed: 'happy',     unlock: 'free', label: 'شاد' },
  { id: 'f10', style: 'fun-emoji',  seed: 'wild',      unlock: 'free', label: 'وحشی' },
  { id: 'f11', style: 'lorelei',    seed: 'iris',      unlock: 'free', label: 'آیریس' },
  { id: 'f12', style: 'micah',      seed: 'leo',       unlock: 'free', label: 'لئو' },
  { id: 'f13', style: 'pixel-art',  seed: 'pixel',     unlock: 'free', label: 'پیکسل' },
  { id: 'f14', style: 'pixel-art',  seed: 'ninja',     unlock: 'free', label: 'نینجا' },
  { id: 'f15', style: 'thumbs',     seed: 'classic',   unlock: 'free', label: 'کلاسیک' },
  { id: 'f16', style: 'thumbs',     seed: 'bold',      unlock: 'free', label: 'بولد' },

  // ----- ACHIEVEMENT-LOCKED (8) -----
  { id: 'a01', style: 'adventurer', seed: 'gold_hero',  unlock: { type:'achievement', achievement:'first_win'     }, label: 'قهرمان طلایی' },
  { id: 'a02', style: 'bottts',     seed: 'diamond',    unlock: { type:'achievement', achievement:'perfect_score' }, label: 'ربات الماس' },
  { id: 'a03', style: 'pixel-art',  seed: 'flash',      unlock: { type:'achievement', achievement:'speed_demon'   }, label: 'سرعت نور' },
  { id: 'a04', style: 'micah',      seed: 'royal',      unlock: { type:'achievement', achievement:'survivor'      }, label: 'پادشاه' },
  { id: 'a05', style: 'fun-emoji',  seed: 'phoenix',    unlock: { type:'achievement', achievement:'comeback'      }, label: 'ققنوس' },
  { id: 'a06', style: 'lorelei',    seed: 'medal',      unlock: { type:'achievement', achievement:'veteran'       }, label: 'مدال‌دار' },
  { id: 'a07', style: 'thumbs',     seed: 'champion',   unlock: { type:'achievement', achievement:'survivor'      }, label: 'قهرمان میدان' },
  { id: 'a08', style: 'avataaars',  seed: 'legend',     unlock: { type:'achievement', achievement:'veteran'       }, label: 'افسانه‌ای' },

  // ----- TIME-LOCKED (10) -----
  { id: 't01', style: 'bottts',     seed: 'day_one',     unlock: { type:'days', days: 1   }, label: 'پس از ۱ روز' },
  { id: 't02', style: 'adventurer', seed: 'three_days',  unlock: { type:'days', days: 3   }, label: 'پس از ۳ روز' },
  { id: 't03', style: 'pixel-art',  seed: 'week',        unlock: { type:'days', days: 7   }, label: 'پس از ۷ روز' },
  { id: 't04', style: 'fun-emoji',  seed: 'two_weeks',   unlock: { type:'days', days: 14  }, label: 'پس از ۲ هفته' },
  { id: 't05', style: 'micah',      seed: 'month',       unlock: { type:'days', days: 30  }, label: 'پس از ۱ ماه' },
  { id: 't06', style: 'lorelei',    seed: 'two_months',  unlock: { type:'days', days: 60  }, label: 'پس از ۲ ماه' },
  { id: 't07', style: 'thumbs',     seed: 'quarter',     unlock: { type:'days', days: 90  }, label: 'پس از ۳ ماه' },
  { id: 't08', style: 'avataaars',  seed: 'half_year',   unlock: { type:'days', days: 180 }, label: 'پس از ۶ ماه' },
  { id: 't09', style: 'bottts',     seed: 'one_year',    unlock: { type:'days', days: 365 }, label: 'پس از ۱ سال' },
  { id: 't10', style: 'adventurer', seed: 'elder',       unlock: { type:'days', days: 730 }, label: 'پیشکسوت' },
];

// totals: 16 + 8 + 10 = 34 — pad to 40+ with extra free variants
window.AVATAR_CATALOG.push(
  { id: 'f17', style: 'bottts',     seed: 'mech',     unlock: 'free', label: 'مکانیک' },
  { id: 'f18', style: 'adventurer', seed: 'mage',     unlock: 'free', label: 'جادوگر' },
  { id: 'f19', style: 'avataaars',  seed: 'pro',      unlock: 'free', label: 'حرفه‌ای' },
  { id: 'f20', style: 'fun-emoji',  seed: 'party',    unlock: 'free', label: 'پارتی' },
  { id: 'f21', style: 'lorelei',    seed: 'aurora',   unlock: 'free', label: 'آرورا' },
  { id: 'f22', style: 'micah',      seed: 'sam',      unlock: 'free', label: 'سم' },
  { id: 'f23', style: 'pixel-art',  seed: 'retro',    unlock: 'free', label: 'رترو' },
  { id: 'f24', style: 'thumbs',     seed: 'plus',     unlock: 'free', label: 'پلاس' }
); // -> 42 entries

function avatarUrlForCatalogItem(item) {
  const style = encodeURIComponent(item.style);
  const seed  = encodeURIComponent(item.seed);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

/**
 * Convert an emoji string into a Twemoji SVG URL (colorful image).
 * Falls back gracefully if the resource isn't found (caller can use onerror).
 */
function emojiImgUrl(emoji) {
  const cps = [...String(emoji || '')]
    .map(c => c.codePointAt(0).toString(16))
    .filter(cp => cp !== 'fe0f'); // strip variation selectors
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cps.join('-')}.svg`;
}
window.emojiImgUrl = emojiImgUrl;

/**
 * Determine if a catalog entry is unlocked for a given profile.
 *   profile: { achievements: [{type}], created_at?: string }
 * Returns { unlocked: boolean, reason?: string }
 */
function isAvatarUnlocked(item, profile) {
  if (!item || item.unlock === 'free') return { unlocked: true };
  if (!item.unlock || typeof item.unlock !== 'object') return { unlocked: true };
  if (item.unlock.type === 'achievement') {
    const have = (profile && profile.achievements) || [];
    const ok = have.some(a => a.type === item.unlock.achievement);
    if (ok) return { unlocked: true };
    const labelObj = (window.ACHIEVEMENTS || []).find(a => a.type === item.unlock.achievement);
    return { unlocked: false, reason: `با کسب دستاورد «${labelObj ? labelObj.label : item.unlock.achievement}» باز می‌شود` };
  }
  if (item.unlock.type === 'days') {
    if (!profile || !profile.created_at) return { unlocked: false, reason: `پس از ${toFa ? toFa(item.unlock.days) : item.unlock.days} روز از ثبت‌نام باز می‌شود` };
    const ageMs = Date.now() - new Date(profile.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays >= item.unlock.days) return { unlocked: true };
    const remain = Math.ceil(item.unlock.days - ageDays);
    return { unlocked: false, reason: `${toFa ? toFa(remain) : remain} روز دیگر باز می‌شود` };
  }
  return { unlocked: true };
}

window.isAvatarUnlocked = isAvatarUnlocked;
window.avatarUrlForCatalogItem = avatarUrlForCatalogItem;

/**
 * Render an avatar selection grid into a container.
 *   container : DOM element
 *   profile   : { achievements?, created_at? } (use {} for guest)
 *   selectedId: catalog item id of current selection
 *   onSelect  : function(item) called when an unlocked avatar is clicked
 *   opts      : { hideLocked?: boolean, sortUnlockedFirst?: boolean (default true) }
 * Returns a setter to change selection from outside.
 */
function renderAvatarGrid(container, profile, selectedId, onSelect, opts) {
  const options = Object.assign({ hideLocked: false, sortUnlockedFirst: true }, opts || {});
  container.innerHTML = '';
  container.classList.add('avatar-grid');
  let currentId = selectedId;

  // Annotate each item with its unlock state, then optionally filter/sort.
  let items = (window.AVATAR_CATALOG || []).map(item => {
    const u = isAvatarUnlocked(item, profile || {});
    return { item, unlocked: u.unlocked, reason: u.reason };
  });
  if (options.hideLocked) items = items.filter(x => x.unlocked);
  if (options.sortUnlockedFirst) {
    items.sort((a, b) => (a.unlocked === b.unlocked) ? 0 : (a.unlocked ? -1 : 1));
  }

  items.forEach(({ item, unlocked, reason }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.id = item.id;
    btn.className = (currentId === item.id ? 'selected ' : '') + (unlocked ? '' : 'locked');
    btn.title = unlocked ? item.label : `${item.label} — ${reason}`;
    const img = document.createElement('img');
    img.src = avatarUrlForCatalogItem(item);
    img.className = 'avatar-img';
    img.loading = 'lazy';
    img.style.width = '100%'; img.style.aspectRatio = '1/1';
    img.alt = item.label;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      currentId = item.id;
      container.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (onSelect) onSelect(item);
    });
    container.appendChild(btn);
  });
  return {
    setSelected(id) {
      currentId = id;
      container.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.id === id));
    }
  };
}
window.renderAvatarGrid = renderAvatarGrid;

// ===================== BOTTOM DOCK =====================
// Uniform structure — the active item becomes the lifted golden orb,
// regardless of position.
const NAV_ITEMS = [
  { id: 'leaderboard', label: 'رتبه‌بندی', icon: '🏆', href: 'leaderboard.html' },
  { id: 'live',        label: 'گروهی',     icon: '👥', href: 'player.html' },
  { id: 'home',        label: 'بازی',      icon: '⚔️', href: 'index.html' },
  { id: 'profile',     label: 'پروفایل',   icon: '🎭', href: 'profile.html' },
  { id: 'host',        label: 'میزبان',     icon: '🎙️', href: 'host.html' },
];

function renderDock(activeId) {
  document.querySelectorAll('.vk-dock-wrap').forEach(n => n.remove());
  const wrap = document.createElement('div');
  wrap.className = 'vk-dock-wrap';
  const nav = document.createElement('nav');
  nav.className = 'vk-dock';
  NAV_ITEMS.forEach(it => {
    const isActive = activeId === it.id;
    const a = document.createElement('a');
    a.href = it.href;
    a.className = 'vk-dock-item' + (isActive ? ' is-active' : '');
    a.innerHTML = `
      <span class="vk-dock-ico">${it.icon}</span>
      <span class="vk-dock-lbl">${it.label}</span>`;
    nav.appendChild(a);
  });
  wrap.appendChild(nav);
  document.body.appendChild(wrap);
  document.body.classList.add('has-vk-dock');
}
window.renderDock = renderDock;

// ===================== RESULTS MODAL (no backdrop blur) =====================
/**
 * opts: { title?, score?, rank?, totalScores?, achievementsEarned: [{type,label,emoji}], onClose?, extraHtml? }
 */
function showResultsModal(opts) {
  const o = opts || {};
  const earned = Array.isArray(o.achievementsEarned) ? o.achievementsEarned : [];

  const labelOf = (type) => (window.ACHIEVEMENTS || []).find(a => a.type === type);

  let achHtml = '';
  if (earned.length) {
    achHtml = `
      <div class="mt-4">
        <div class="text-center font-bold mb-2" style="color: hsl(var(--s));">🎉 دستاوردهای جدید 🎉</div>
        <div class="space-y-2">
          ${earned.map((a, i) => {
            const ach = labelOf(a.type) || a;
            const emoji = ach.emoji || '🏅';
            const imgUrl = emojiImgUrl(emoji);
            return `
              <div class="vk-ach-unlock" style="animation-delay:${i*200}ms;">
                <span class="vk-ach-glow"></span>
                <img class="achv-img" src="${imgUrl}" alt="" style="width:44px;height:44px;"
                     onerror="this.outerHTML='<span class=&quot;text-3xl&quot;>${emoji}</span>'">
                <div>
                  <div class="font-bold text-base">${ach.label || ach.type}</div>
                  <div class="text-xs opacity-80">دستاورد قفل‌گشایی شد</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  let scoreHtml = '';
  if (o.score != null) {
    scoreHtml = `
      <div class="text-center my-3">
        <div class="text-sm opacity-70">امتیاز شما</div>
        <div class="vk-num text-6xl" style="color: hsl(var(--s)); text-shadow: 0 0 20px hsl(var(--s)/.6);">${toFa ? toFa(o.score) : o.score}</div>
        ${o.rank ? `<div class="mt-1 opacity-80">رتبه شما: <b class="vk-num" style="color:hsl(var(--s));">${toFa ? toFa(o.rank) : o.rank}</b>${o.totalScores ? ` از ${toFa ? toFa(o.totalScores) : o.totalScores}` : ''}</div>` : ''}
      </div>`;
  }

  // Build solid (non-blurred) backdrop manually so we have full control
  const root = document.createElement('div');
  root.className = 'vk-modal-backdrop';
  root.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    background: hsla(263, 49%, 6%, .85);
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    animation: fadeIn .25s ease-out;
  `;

  const card = document.createElement('div');
  card.className = 'cr-card-solid';
  card.style.cssText = 'max-width: 26rem; width: 100%; padding: 1.25rem 1.25rem 1rem; max-height: 92vh; overflow-y: auto;';

  card.innerHTML = `
    <div class="text-center">
      <div class="text-3xl">${earned.length ? '🏆' : '🎯'}</div>
      <div class="h-title mt-1" style="font-size:1.6rem;">${o.title || 'پایان بازی'}</div>
    </div>
    ${scoreHtml}
    ${achHtml}
    ${o.extraHtml || ''}
    <div class="mt-5 flex flex-col gap-2">
      <button id="vkResClose" class="cr-btn cr-btn-gold w-full">ادامه</button>
    </div>
  `;
  root.appendChild(card);
  document.body.appendChild(root);

  // Confetti effect if achievements were unlocked
  if (earned.length) {
    spawnConfetti(root);
  }

  card.querySelector('#vkResClose').addEventListener('click', () => {
    root.remove();
    if (o.onClose) o.onClose();
  });
  // Click outside to close
  root.addEventListener('click', (e) => {
    if (e.target === root) {
      root.remove();
      if (o.onClose) o.onClose();
    }
  });
}
window.showResultsModal = showResultsModal;

function spawnConfetti(container) {
  const colors = ['#FFD700', '#F4A623', '#2196F3', '#E53935', '#26890C', '#9C27B0'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    const sz = 6 + Math.random() * 6;
    c.style.cssText = `
      position: absolute; top: -10px; left: ${Math.random()*100}%;
      width: ${sz}px; height: ${sz}px; pointer-events: none;
      background: ${colors[i % colors.length]};
      border-radius: ${Math.random() > .5 ? '50%' : '2px'};
      animation: vkConfetti ${1.5 + Math.random()*1.5}s ${Math.random()*.5}s ease-in forwards;
      opacity: ${.7 + Math.random()*.3};
    `;
    container.appendChild(c);
  }
  if (!document.getElementById('vk-confetti-kf')) {
    const s = document.createElement('style');
    s.id = 'vk-confetti-kf';
    s.textContent = `@keyframes vkConfetti { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`;
    document.head.appendChild(s);
  }
}
