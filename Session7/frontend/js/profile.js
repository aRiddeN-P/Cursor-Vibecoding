// profile.js — Profile page (purple+gold game UI).
// Sections: Live (conditional), Identity (+ theme toggle, rename, logout, change avatar),
// Stats (solo/group tabs), Achievements (solo/group with tooltips), History.

const root = document.getElementById('root');
let playerName  = localStorage.getItem('vibe_player_name') || '';
let chosenStyle = localStorage.getItem('vibe_avatar_style') || 'bottts';
let chosenSeed  = localStorage.getItem('vibe_avatar_seed')  || playerName;
let profile = null;
let lastRankSeen = null;
let livePollHandle = null;
let activeStatsTab = 'solo';   // 'solo' | 'group'

const MODE_ICONS  = { solo: '🎮', quiz: '👥', battle: '⚔️' };
const MODE_LABELS = { solo: 'بازی انفرادی', quiz: 'کوییز گروهی', battle: 'بتل گروهی' };
const RENAME_COOLDOWN_MS = 60 * 1000;

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function clear() { root.innerHTML = ''; }

// ============ LOAD ============
async function loadProfile() {
  if (!playerName) {
    // No local profile → bounce to login (no inline setup any more)
    return window.location.replace('./login.html');
  }
  try {
    const r = await fetch(`${API}/api/profile/${encodeURIComponent(playerName)}`);
    if (r.status === 404) {
      // Stale local profile — bounce to login
      localStorage.removeItem('vibe_player_name');
      return window.location.replace('./login.html');
    }
    profile = await r.json();
    chosenStyle = profile.player.avatar_style;
    chosenSeed  = profile.player.avatar_seed || profile.player.name;
    localStorage.setItem('vibe_avatar_style', chosenStyle);
    localStorage.setItem('vibe_avatar_seed',  chosenSeed);
    if (profile.player.solo_stage) localStorage.setItem('vibe_solo_stage', String(profile.player.solo_stage));
    renderAll();
    startLivePolling();
  } catch (e) {
    clear();
    root.appendChild(el(`<div class="alert alert-error">خطا در ارتباط با سرور.</div>`));
  }
}

function renderAll() {
  clear();
  root.appendChild(el('<div id="livePanel"></div>'));
  root.appendChild(buildIdentity());
  root.appendChild(buildStats());
  root.appendChild(buildAchievements());
  root.appendChild(buildHistory());
  if (!document.querySelector('.vk-dock-wrap')) renderDock('profile');
}

// ============ IDENTITY ============
function buildIdentity() {
  const p = profile.player;
  const rank = profile.rank;
  const rankBadge = rank
    ? `${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆'} رتبه #${toFa(rank)} در رتبه‌بندی`
    : '— هنوز در رتبه‌بندی نیستی';
  const stageBadge = `⚔️ مرحله ${toFa(p.solo_stage || 1)} از ۵`;

  const card = el(`
    <div class="cr-card">
      <div class="p-4 flex flex-col items-center text-center gap-2">
        <span class="avatar-ring"><img id="myAv" src="${p.avatarUrl}" class="avatar-img" style="width:96px;height:96px;" alt=""></span>
        <h1 class="h-title mt-2" style="font-size:1.8rem;">${p.name}</h1>
        <div class="text-xs opacity-70">عضو از ${persianRelative(p.created_at)} • آخرین فعالیت ${persianRelative(p.last_seen)}</div>
        <div class="mt-1 flex gap-2 flex-wrap justify-center">
          <span class="badge badge-warning font-bold">${rankBadge}</span>
          <span class="badge badge-secondary font-bold">${stageBadge}</span>
        </div>

        <label class="swap swap-rotate mt-3">
          <input type="checkbox" id="themeChk" ${getTheme() === 'light' ? 'checked' : ''}>
          <div class="swap-on text-3xl">🌞</div>
          <div class="swap-off text-3xl">🌙</div>
        </label>
        <div class="text-xs opacity-60" id="themeLbl">حالت ${getTheme() === 'light' ? 'روشن' : 'تیره'}</div>

        <div class="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <button id="changeAv"  class="cr-btn cr-btn-blue cr-btn-sm">🎨 تغییر آواتار</button>
          <button id="renameBtn" class="cr-btn cr-btn-sm">✏️ تغییر نام</button>
          <button id="logoutBtn" class="cr-btn cr-btn-red cr-btn-sm">🚪 خروج</button>
        </div>
        <div id="renameCooldownInfo" class="text-xs opacity-60 mt-1"></div>
      </div>
    </div>
  `);

  card.querySelector('#changeAv').addEventListener('click', openAvatarPicker);
  card.querySelector('#renameBtn').addEventListener('click', openRenameModal);
  card.querySelector('#logoutBtn').addEventListener('click', () => {
    if (!confirm('از حساب خارج می‌شوی؟')) return;
    localStorage.removeItem('vibe_player_name');
    localStorage.removeItem('vibe_avatar_style');
    localStorage.removeItem('vibe_avatar_seed');
    localStorage.removeItem('vibe_solo_stage');
    window.location.replace('./login.html');
  });
  card.querySelector('#themeChk').addEventListener('change', (ev) => {
    setTheme(ev.target.checked ? 'light' : 'dark');
    const lbl = card.querySelector('#themeLbl');
    if (lbl) lbl.textContent = `حالت ${getTheme() === 'light' ? 'روشن' : 'تیره'}`;
  });

  refreshRenameCooldown(card);
  setInterval(() => refreshRenameCooldown(card), 1000);
  return card;
}

function refreshRenameCooldown(rootEl) {
  const btn = rootEl.querySelector('#renameBtn');
  const info = rootEl.querySelector('#renameCooldownInfo');
  if (!btn) return;
  const last = parseInt(localStorage.getItem('vibe_last_rename') || '0', 10);
  const remain = (last + RENAME_COOLDOWN_MS) - Date.now();
  if (remain > 0) {
    btn.disabled = true;
    btn.style.opacity = .55;
    if (info) info.textContent = `بعد از ${toFa(Math.ceil(remain / 1000))} ثانیه دیگر می‌توانی نام را تغییر دهی`;
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    if (info) info.textContent = '';
  }
}

// ---- Avatar picker modal ----
function openAvatarPicker() {
  const back = el(`
    <div class="vk-modal-backdrop" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;background:hsla(263,49%,6%,.85);">
      <div class="cr-card-solid" style="max-width:28rem;width:100%;padding:1.25rem;max-height:90vh;overflow-y:auto;">
        <div class="flex items-center justify-between mb-3">
          <h3 class="h-title" style="font-size:1.3rem;">انتخاب آواتار</h3>
          <button class="cr-btn cr-btn-red cr-btn-sm" id="closeAv">✕</button>
        </div>
        <div class="text-xs opacity-70 mb-2">آواتارهای قفل‌دار با کسب دستاورد یا گذشت زمان از ثبت‌نام باز می‌شوند.</div>
        <div id="avGrid"></div>
      </div>
    </div>
  `);
  document.body.appendChild(back);

  const container = back.querySelector('#avGrid');
  // Find current selection by matching style+seed
  const currentItem = (window.AVATAR_CATALOG || []).find(it => it.style === chosenStyle && it.seed === chosenSeed);
  window.renderAvatarGrid(container, profile, currentItem ? currentItem.id : null, async (item) => {
    try {
      const r = await fetch(`${API}/api/profile/${encodeURIComponent(playerName)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarStyle: item.style, avatarSeed: item.seed }),
      });
      const data = await r.json();
      chosenStyle = item.style;
      chosenSeed  = item.seed;
      localStorage.setItem('vibe_avatar_style', item.style);
      localStorage.setItem('vibe_avatar_seed',  item.seed);
      const myAv = document.getElementById('myAv');
      if (myAv) myAv.src = data.avatarUrl;
      setTimeout(() => back.remove(), 300);
    } catch (e) {}
  });

  back.querySelector('#closeAv').addEventListener('click', () => back.remove());
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
}

// ---- Rename modal ----
function openRenameModal() {
  const back = el(`
    <div class="vk-modal-backdrop" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;background:hsla(263,49%,6%,.85);">
      <div class="cr-card-solid" style="max-width:26rem;width:100%;padding:1.25rem;">
        <h3 class="h-title mb-2" style="font-size:1.3rem;">تغییر نام کاربر</h3>
        <p class="text-sm opacity-70 mb-3">نام جدید نباید توسط کاربر دیگری گرفته شده باشد.</p>
        <input id="newName" class="input input-bordered w-full" maxlength="24" placeholder="نام جدید">
        <p id="renameErr" class="text-error text-sm mt-2 min-h-[1.25rem]"></p>
        <div class="alert alert-warning mt-2 text-sm">
          <span>⏱ پس از تغییر نام، این دکمه ۱ دقیقه غیرفعال می‌شود.</span>
        </div>
        <div class="flex gap-2 mt-3 justify-end">
          <button id="renameCancel" class="cr-btn cr-btn-sm cr-btn-red">انصراف</button>
          <button id="renameOk" class="cr-btn cr-btn-sm cr-btn-gold">تایید</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector('#renameCancel').addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });

  back.querySelector('#renameOk').addEventListener('click', async () => {
    const input = back.querySelector('#newName');
    const errBox = back.querySelector('#renameErr');
    const okBtn = back.querySelector('#renameOk');
    const newName = input.value.trim();
    errBox.textContent = '';
    if (!newName) { errBox.textContent = 'نام جدید لازم است'; return; }
    if (newName === playerName) { errBox.textContent = 'نام جدید با فعلی یکی است'; return; }
    okBtn.disabled = true;
    try {
      const r = await fetch(`${API}/api/profile/${encodeURIComponent(playerName)}/rename`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 409) { errBox.textContent = data.error || 'این نام قبلا انتخاب شده'; okBtn.disabled = false; return; }
      if (!r.ok)            { errBox.textContent = data.error || 'خطا'; okBtn.disabled = false; return; }
      playerName = newName;
      localStorage.setItem('vibe_player_name', newName);
      localStorage.setItem('vibe_last_rename', String(Date.now()));
      close();
      await loadProfile();
    } catch (e) {
      errBox.textContent = 'خطای شبکه';
      okBtn.disabled = false;
    }
  });
}

// ============ STATS (tabs: solo / group) ============
function buildStats() {
  const card = el(`
    <div class="cr-card">
      <div class="p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="font-bold">📊 آمار</div>
          <div role="tablist" class="tabs tabs-boxed tabs-sm">
            <a role="tab" id="st-solo"  class="tab tab-active">🎮 انفرادی</a>
            <a role="tab" id="st-group" class="tab">👥 گروهی</a>
          </div>
        </div>
        <div id="statsBody"></div>
      </div>
    </div>
  `);
  card.querySelector('#st-solo').addEventListener('click', () => { activeStatsTab = 'solo'; renderStatsBody(card); });
  card.querySelector('#st-group').addEventListener('click', () => { activeStatsTab = 'group'; renderStatsBody(card); });
  renderStatsBody(card);
  return card;
}

function renderStatsBody(card) {
  card.querySelector('#st-solo').classList.toggle('tab-active', activeStatsTab === 'solo');
  card.querySelector('#st-group').classList.toggle('tab-active', activeStatsTab === 'group');
  const body = card.querySelector('#statsBody');
  const s = profile.statsByMode || { solo: {}, group: {}, overall: {} };
  const overall = s.overall || {};

  if (activeStatsTab === 'solo') {
    const so = s.solo || {};
    body.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        ${statTile('🎮', 'تعداد بازی',  so.totalGames)}
        ${statTile('🏆', 'بهترین امتیاز', so.bestScore)}
        ${statTile('⭐', 'میانگین امتیاز', so.avgScore)}
        ${statTile('🔥', 'کل امتیازات',  so.totalPoints)}
        ${statTile('❤️', 'رشته فعلی',   overall.currentStreak)}
        ${statTile('🥇', 'طولانی‌ترین رشته', overall.longestStreak)}
      </div>
    `;
  } else {
    const gr = s.group || {};
    body.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        ${statTile('👥', 'تعداد بازی',  gr.totalGames)}
        ${statTile('🏆', 'بهترین امتیاز', gr.bestScore)}
        ${statTile('⭐', 'میانگین امتیاز', gr.avgScore)}
        ${statTile('🔥', 'کل امتیازات',  gr.totalPoints)}
        ${statTile('⚔️', 'برد بتل',     gr.wins)}
        ${statTile('🚀', 'بهترین مرحله', gr.bestStageReached)}
      </div>
    `;
  }
}

function statTile(ico, lbl, val) {
  return `<div class="stat-tile">
    <span class="ico">${ico}</span>
    <span class="val">${toFa(val ?? 0)}</span>
    <span class="lbl">${lbl}</span>
  </div>`;
}

// ============ ACHIEVEMENTS (2 categories, with images + tooltips on both states) ============
function buildAchievements() {
  const earned = new Map();
  (profile.achievements || []).forEach((a) => earned.set(a.type, a));

  // escape for HTML attribute (data-tip / title)
  const esc = (s) => String(s || '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const renderRow = (catId, catLabel) => {
    const items = ACHIEVEMENTS.filter((a) => a.category === catId);
    return `
      <div class="font-bold text-sm mb-2 mt-2">${catLabel}</div>
      <div class="grid grid-cols-3 gap-3">
        ${items.map((a) => {
          const got = earned.get(a.type);
          // Tip text — visible on hover (native title) for both locked + unlocked
          const howToText = `روش کسب: ${a.desc}`;
          const stateText = got ? 'وضعیت: قفل‌گشایی شده' : 'وضعیت: قفل';
          const tip = `${a.label}\n${howToText}\n${stateText}`;
          const imgUrl = window.emojiImgUrl(a.emoji);
          return `
            <div class="achv ${got ? 'unlocked' : 'locked'}" title="${esc(tip)}">
              <div class="achv-img-wrap">
                <img class="achv-img" src="${imgUrl}" alt="${esc(a.label)}"
                     onerror="this.outerHTML='<span class=&quot;text-5xl&quot;>${a.emoji}</span>'">
                ${got ? '' : '<span class="achv-lock-icon">🔒</span>'}
              </div>
              <div class="achv-label">${a.label}</div>
              <div class="achv-date">${got ? persianRelative(got.earned_at) : 'قفل'}</div>
              <div class="achv-how" title="${esc(howToText)}">${a.desc}</div>
            </div>`;
        }).join('')}
      </div>`;
  };

  return el(`
    <div class="cr-card">
      <div class="p-4 overflow-visible">
        <div class="font-bold mb-1">🏅 دستاوردها</div>
        <div class="text-xs opacity-60 mb-2">روی هر دستاورد نگه دار تا روش کسب آن را ببینی</div>
        ${renderRow('solo',  '🎮 دستاوردهای انفرادی')}
        ${renderRow('group', '👥 دستاوردهای گروهی')}
      </div>
    </div>
  `);
}

// ============ HISTORY ============
function buildHistory() {
  const hist = profile.history || [];
  const best = Math.max(1, profile.stats?.bestScore || 1);
  const card = el(`
    <div class="cr-card">
      <div class="p-4">
        <div class="font-bold mb-3">📜 تاریخچه (آخرین ${toFa(hist.length)})</div>
        <div class="space-y-2" id="histList"></div>
      </div>
    </div>
  `);
  const list = card.querySelector('#histList');
  if (!hist.length) {
    list.appendChild(el(`<div class="text-center text-sm opacity-70">هنوز بازی نکرده‌ای — برو یکی شروع کن!</div>`));
    return card;
  }
  hist.forEach((h) => {
    const cls = scoreClass(h.score, best);
    const pct = Math.max(4, Math.round((h.score / best) * 100));
    const at = new Date(h.at);
    list.appendChild(el(`
      <div class="history-row ${cls}" title="${at.toLocaleString('fa-IR')}">
        <div class="text-2xl">${MODE_ICONS[h.mode] || '❓'}</div>
        <div>
          <div class="font-bold">${MODE_LABELS[h.mode] || h.mode}</div>
          <div class="text-xs opacity-70">${persianRelative(h.at)}</div>
          <div class="bar-track" style="width:${pct}%"><div class="bar-fill" style="width:100%"></div></div>
        </div>
        <div class="score-num">${toFa(h.score)}</div>
      </div>
    `));
  });
  return card;
}

function scoreClass(score, best) {
  const pct = score / best;
  if (pct >= 0.85) return 'gold';
  if (pct >= 0.6)  return 'silver';
  if (pct >= 0.35) return 'bronze';
  return 'gray';
}

// ============ LIVE PANEL ============
function startLivePolling() {
  if (livePollHandle) clearInterval(livePollHandle);
  pollLive();
  livePollHandle = setInterval(pollLive, 2000);
}

async function pollLive() {
  if (!playerName) return;
  try {
    const r = await fetch(`${API}/api/profile/${encodeURIComponent(playerName)}/live`);
    const data = await r.json();
    renderLive(data);
  } catch (e) {}
}

function renderLive(data) {
  const slot = document.getElementById('livePanel');
  if (!slot) return;
  if (!data.inGame) { slot.innerHTML = ''; lastRankSeen = null; return; }
  const arrow = lastRankSeen == null ? '' : (data.rank < lastRankSeen ? '▲' : data.rank > lastRankSeen ? '▼' : '·');
  const arrowColor = lastRankSeen == null ? 'opacity-60' : (data.rank < lastRankSeen ? 'text-success' : data.rank > lastRankSeen ? 'text-error' : 'opacity-60');
  lastRankSeen = data.rank;
  const totalMs = 10000;
  const pct = Math.max(0, Math.min(100, (data.timeLeftMs / totalMs) * 100));
  slot.innerHTML = `
    <div class="cr-card" style="border-color:hsl(var(--su));">
      <div class="p-4">
        <div class="flex items-center justify-between">
          <span class="live-badge"><span class="dot"></span> زنده</span>
          <span class="text-sm opacity-70">${data.mode === 'battle' ? '⚔️ بتل' : '🎮 کوییز'} • سوال ${toFa(data.currentQuestion.index + 1)} از ${toFa(data.currentQuestion.total)}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-3">
          <div class="text-center">
            <div class="text-xs opacity-70">امتیاز</div>
            <div class="vk-num text-2xl text-warning">${toFa(data.score)}</div>
          </div>
          <div class="text-center">
            <div class="text-xs opacity-70">رتبه</div>
            <div class="vk-num text-2xl">${toFa(data.rank)}/${toFa(data.totalPlayers)} <span class="${arrowColor}">${arrow}</span></div>
          </div>
          <div class="text-center">
            <div class="text-xs opacity-70">زمان</div>
            <div class="vk-num text-2xl">${toFa(Math.ceil(data.timeLeftMs/1000))}<span class="text-sm">ث</span></div>
          </div>
        </div>
        <div class="timer-bar mt-2"><div style="width:${pct}%"></div></div>
        ${data.mode === 'battle' && data.eliminated ? `
          <div class="alert alert-error mt-3"><span class="font-bold">💥 حذف شدی</span></div>` : ''}
        <a href="./player.html" class="cr-btn cr-btn-blue cr-btn-sm mt-3 w-full" style="text-align:center;">رفتن به صفحه بازی</a>
      </div>
    </div>
  `;
}

// ============ BOOT ============
loadProfile();
renderDock('profile');
