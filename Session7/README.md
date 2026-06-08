# vibe-kahoot

## فارسی

یک بازی کوییز فارسی RTL با ظاهر گیم‌محور (بنفش/طلایی، گرادیان، gloss) برای کلاس برنامه‌نویسی. سه حالت بازی:

- **بازی انفرادی (Solo):** ۵ مرحله، در هر مرحله ۱۰ سوال (۱۰ ثانیه برای هر کدام). برای باز شدن مرحله بعد باید در مرحله جاری حداقل ۳۰۰۰ امتیاز بگیری. مرحله‌ای که در آن هستی روی سرور ذخیره می‌شود.
- **بازی گروهی — کوییز زنده:** چندنفره، هاست هر سوال را شروع می‌کند، همه پاسخ می‌دهند، بر اساس امتیاز رتبه‌بندی می‌شوند.
- **بازی گروهی — بتل رویال:** پاسخ غلط = حذف. آخرین نفر باقی‌مانده برنده است. در رتبه‌بندی، حذف‌شدگان بر اساس مرحله‌ای که حذف شده‌اند مرتب می‌شوند (هر چه دیرتر، رتبه بالاتر).

### ویژگی‌ها

- **ورود با نام + رمز عبور:** صفحه‌ی `login.html` با دو تب ورود/ثبت‌نام. رمز با scrypt هش می‌شود.
- **۴۰+ آواتار** با شرایط قفل‌گشایی متنوع:
  - رایگان (۲۴ مورد)
  - باز شدن با کسب دستاوردهای خاص (۸ مورد)
  - باز شدن پس از گذشت زمان از ثبت‌نام (۱، ۳، ۷، ۱۴، ۳۰، ۶۰، ۹۰، ۱۸۰، ۳۶۵، ۷۳۰ روز)
- **پروفایل کامل:** آمار جدا برای انفرادی/گروهی، تاریخچه ۱۰ بازی اخیر، دستاوردها با تصاویر Twemoji، تغییر آواتار/نام (با cooldown ۱ دقیقه‌ای)، حالت روشن/تیره.
- **رتبه‌بندی جداگانه** برای انفرادی و گروهی در `leaderboard.html`.
- **bottom nav** با orb طلایی برجسته که زیر آیتم فعال جابه‌جا می‌شود.
- **انیمیشن‌های گیمی:** زلزله، حذف‌شدن، confetti برای دستاورد جدید، pulse برای مرحله جاری.
- **مودال نتیجه** بدون blur که امتیاز، رتبه و دستاوردهای جدید را با نور و گرادیان نمایش می‌دهد.

### پالت و فونت

- پس‌زمینه `#1a1025`، طلایی `#FFD700`، نارنجی دکمه `#F4A623`، آبی `#2196F3`، قرمز `#E53935`
- متن فارسی: **Vazirmatn**؛ اعداد و عناوین: **Lilita One** (هر دو از Google Fonts)
- کلاس‌های CSS کلیدی: `cr-card`, `cr-card-solid`, `cr-btn`, `cr-btn-gold`, `cr-btn-blue`, `cr-btn-red`, `cr-btn-green`, `cr-btn-purple`, `cr-btn-sm`, `cr-btn-lg`, `h-title`, `vk-num`, `stage-card`, `achv`

### اجرا

```bash
npm install
npm start
```

دو سرور بالا می‌آید:

- API روی پورت `PORT_API` (پیش‌فرض ۳۰۰۰)
- فرانت‌اند روی پورت `PORT_FRONT` (پیش‌فرض ۳۰۰۱)

سپس `http://localhost:3001/login.html` را در مرورگر باز کنید (در ورود اول، تب ثبت‌نام پیش‌فرض است).

> فایل دیتابیس در `backend/data/vibe.db` ساخته می‌شود. برای ریست کامل: `rm -f backend/data/vibe.db*`

### اکسپوز کردن با ngrok

```bash
ngrok http 3001     # فرانت‌اند را عمومی کن
ngrok http 3000     # در یک ترمینال دیگر، API را هم عمومی کن
```

سپس `window.API` را در `frontend/js/config.js` به URL عمومی API تغییر بده (یا متغیر را قبل از لود صفحه ست کن).

### پنل میزبان

- آدرس: `http://localhost:3001/host.html`
- کلید پیش‌فرض: `vibe-class` (در `.env` با `HOST_KEY` قابل تغییر است؛ سمت کلاینت در localStorage با کلید `vibe_host_key` نگهداری می‌شود).
- از این پنل می‌توان لابی باز کرد، کوییز یا بتل را شروع کرد، و وضعیت بازیکنان زنده/حذف‌شده را دید.

---

## English

A Persian, RTL, mobile-first quiz game with a "battle game" aesthetic (purple + gold, gradients, gloss) for a programming class. Three modes:

- **Solo:** 5 stages × 10 questions (10 seconds each). Each stage unlocks after scoring at least 3000 in the previous one. The player's current stage is persisted server-side.
- **Group — Live Quiz:** multiplayer, host advances each question, players ranked by score.
- **Group — Battle Royale:** wrong answer eliminates you; eliminated players are ranked by how far they got, so dying later puts you higher.

### Features

- **Login with name + password.** `login.html` has two tabs (login / register). Passwords are hashed with scrypt.
- **40+ avatars** with three unlock conditions:
  - Free (24 entries)
  - Unlocked by earning specific achievements (8 entries)
  - Unlocked after time since registration (1, 3, 7, 14, 30, 60, 90, 180, 365, 730 days)
- **Profile page:** stats split per mode (solo / group), 10-game history, achievements with Twemoji images and "how to earn" tooltips, avatar/name editing (rename has a 60-second cooldown), light/dark theme toggle.
- **Separate leaderboards** for solo and group play in `leaderboard.html`.
- **Bottom nav** with a golden orb that follows the active page.
- **Game-feel animations:** earthquake on elimination, confetti on new achievement, pulsing glow on the current solo stage.
- **Results modal with no backdrop blur** — score, rank, and any newly-unlocked achievements pop into view.

### Color & font

- Background `#1a1025`, gold `#FFD700`, button orange `#F4A623`, blue `#2196F3`, red `#E53935`
- Persian body: **Vazirmatn**; numbers & headings: **Lilita One** (both from Google Fonts)
- Key CSS classes: `cr-card`, `cr-card-solid`, `cr-btn` + color variants, `h-title`, `vk-num`, `stage-card`, `achv`

### How to run

```bash
npm install
npm start
```

This starts two servers:

- API on `PORT_API` (default 3000)
- Static frontend on `PORT_FRONT` (default 3001)

Open `http://localhost:3001/login.html`. The Register tab is shown by default for first-time visitors.

> The DB file is created at `backend/data/vibe.db`. To fully reset: `rm -f backend/data/vibe.db*`

### Exposing with ngrok

```bash
ngrok http 3001     # public frontend
ngrok http 3000     # in another terminal, public API
```

Then update `window.API` in `frontend/js/config.js` (or set it before scripts load) to the public API URL.

### Host panel

- URL: `http://localhost:3001/host.html`
- Default key: `vibe-class` (override with `HOST_KEY` in `.env`; the browser stores it under `vibe_host_key`).
- From here you can open lobbies, start a quiz or battle, and see live/eliminated player status.

---

## Architecture

### Two servers

- `backend/server.js` — Express API on port 3000
- `backend/static.js` — static file server on port 3001 (serves `frontend/`)

Run them together with `npm start`, or individually with `npm run start:api` / `npm run start:static`.

### Database (SQLite, `backend/data/vibe.db`)

| Table | Purpose |
| --- | --- |
| `players` | `name` (PK), `avatar_style`, `avatar_seed`, `password_hash`, `password_salt`, `solo_stage` (1..5), `created_at`, `last_seen` |
| `scores` | every finished game: `name`, `avatar`, `score`, `mode` (`solo` / `quiz` / `battle`), `stage_reached`, `total_stages`, `eliminated`, `solo_stage`, `at` |
| `leaderboard_best` | best score per player |
| `achievements` | `name`, `type`, `label`, `earned_at` |

Schema migrations run automatically on boot (idempotent `ALTER TABLE ADD COLUMN`).

### Key API endpoints

| Method & path | Purpose |
| --- | --- |
| `POST /api/auth/register` | `{name, password, avatarStyle, avatarSeed}` → create account (409 on duplicate) |
| `POST /api/auth/login` | `{name, password}` → verify (401 wrong / 404 missing) |
| `GET  /api/profile/:name` | full profile: player, statsByMode, history, achievements, rank, solo_stage |
| `PATCH /api/profile/:name` | update `avatarStyle` and/or `avatarSeed` |
| `POST /api/profile/:name/rename` | transactional player rename across all tables |
| `GET  /api/leaderboard?mode=solo\|group` | mode-specific leaderboard |
| `GET  /api/solo/questions?stage=N` | 10 shuffled questions for stage 1..5 |
| `POST /api/solo/complete` | record solo score, grant achievements, advance stage if passed |
| `GET  /api/game/state` | current live-game state (lobby / question / reveal / between / waiting / ended) |
| `POST /api/players/join` | join the current group game |
| `POST /api/players/answer` | submit answer |
| `POST /api/host/*` | host controls (`open-lobby`, `start-quiz`, `start-battle`, `next`) — requires `X-Host-Key` |

### Avatar catalog & unlocks

`frontend/js/app.js` defines `window.AVATAR_CATALOG` (42 items). Each entry has:

```js
{ id, style, seed, label, unlock: 'free' | { type: 'achievement', achievement: '<type>' } | { type: 'days', days: <n> } }
```

`window.isAvatarUnlocked(item, profile)` evaluates unlock state from the player's `created_at` and `achievements` list. `window.renderAvatarGrid(container, profile, selectedId, onSelect, { hideLocked?, sortUnlockedFirst? })` renders the picker grid:

- **Login page:** `hideLocked: true` (new users only see free avatars)
- **Profile page:** `sortUnlockedFirst: true` (locked avatars appear at the end with a 🔒 overlay)

### Achievements

Six achievements split into two categories (solo / group). Each has a Twemoji SVG image (`window.emojiImgUrl(emoji)`), a `desc` ("how to earn"), and a `category`.

| Type | Category | Emoji | How to earn |
| --- | --- | --- | --- |
| `first_win` | solo | 🏆 | Finish a solo game with score > 0 |
| `perfect_score` | solo | 💎 | Score ≥ 5000 in a solo game |
| `speed_demon` | solo | ⚡ | Average correct-answer time < 3s |
| `survivor` | group | 👑 | Survive to the end of a battle royale |
| `comeback` | group | 🔥 | Rank top-3 after being last at midpoint |
| `veteran` | group | 🎖️ | Play 10+ games total |

### Tech stack

- Backend: Node.js, Express, `better-sqlite3`, `dotenv`, `cors`, `serve-static`. Password hashing via Node's built-in `crypto.scrypt` (no external auth lib).
- Frontend: vanilla HTML/CSS/JS, Tailwind CSS (CDN), daisyUI v4 (CDN, theme variables overridden for the purple+gold look), Google Fonts (Vazirmatn + Lilita One), DiceBear 7.x for avatars, Twemoji 14.0.2 for achievement images, canvas-confetti for celebration FX.
- No build step. No bundler. Reload to see your changes.

### Project layout

```
vibe-kahoot/
├── .env                       # PORT_API=3000, PORT_FRONT=3001, HOST_KEY=vibe-class
├── .gitignore                 # node_modules, .env, *.db, .DS_Store
├── README.md                  # Persian + English project description
├── package.json               # deps + npm start / start:api / start:static
├── package-lock.json
├── frontend/
│   ├── login.html             # Login + Register (name + password + avatar picker)
│   ├── index.html             # Solo: 5-stage selector + per-stage 10-question game
│   ├── player.html            # Group game player UI (auto-joins from saved profile)
│   ├── host.html              # Host / projector UI (requires HOST_KEY)
│   ├── profile.html           # Player profile shell (logic in js/profile.js)
│   ├── leaderboard.html       # Tabbed leaderboard (solo / group)
│   ├── css/
│   │   └── style.css          # Theme overrides + cr-card/cr-btn + stage-card + dock + animations
│   └── js/
│       ├── app.js             # Theme, AVATAR_CATALOG (42), NAV_ITEMS, renderDock,
│       │                      # renderAvatarGrid, showResultsModal, emojiImgUrl (Twemoji)
│       ├── config.js          # window.API, hasProfile / requireProfile, toFa, persianRelative
│       ├── profile.js         # Profile page: identity, stats, achievements, history, live panel
│       └── questions.js       # 10 fallback questions for offline solo play
└── backend/
    ├── server.js              # Express API on PORT_API (3000)
    │                          # /api/auth/* /api/profile/* /api/solo/* /api/leaderboard
    │                          # /api/game/state /api/players/* /api/host/*
    ├── static.js              # Static file server on PORT_FRONT (3001), serves frontend/
    ├── db.js                  # SQLite schema + migrations + helpers (auth, stages,
    │                          # leaderboards, achievements, rename, scrypt password hashing)
    ├── game.js                # In-memory live-game engine (lobby/question/reveal/between/
    │                          # waiting/ended, quiz + battle modes, RAW_QUESTIONS, shuffleOptions)
    ├── questions.json         # 50 Persian MCQs (5 stages × 10, sessions 0–6)
    └── data/
        └── vibe.db            # SQLite file (auto-created, gitignored — wipe with rm -f data/vibe.db*)
```
