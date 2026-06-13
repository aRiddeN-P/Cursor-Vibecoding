# Dakhlyar Backend (Session8-HW-Backend)

**دخلیار — API backend only**

Express + SQLite REST API for the Dakhlyar Persian personal-finance platform. This package serves all API routes, Swagger documentation, uploaded media, and sample CSV templates. It does **not** include the frontend (HTML/CSS/JS).

The user app and admin panel are expected to run as separate apps and connect via CORS with session cookies (`credentials: true`).

---

## Table of contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment setup](#environment-setup)
- [VAPID key generation (Web Push)](#vapid-key-generation-web-push)
- [Run the server](#run-the-server)
- [Default admin account](#default-admin-account)
- [Health check](#health-check)
- [API documentation (Swagger)](#api-documentation-swagger)
- [Authentication & sessions](#authentication--sessions)
- [API overview](#api-overview)
- [CORS](#cors)
- [Databases](#databases)
- [Background jobs](#background-jobs)
- [Static files & uploads](#static-files--uploads)
- [SMTP & OTP (development mode)](#smtp--otp-development-mode)
- [Rate limiting](#rate-limiting)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Notes](#notes)
- [License](#license)

---

## Features

| Phase | Module | Description |
|-------|--------|-------------|
| 1 | **Auth** | Mobile + email OTP registration, login, forgot/reset password, bcrypt-12 |
| 2 | **Stories** | Onboarding carousel; admin-managed images; per-user `has_seen_stories` |
| 3 | **Profile** | Name, address, postal code, password change, connected devices, invite code |
| 3 | **Verification** | Progressive KYC levels 0–3 (mobile/ID → birth date → address) |
| 3 | **Subscription** | Silver / Gold / Diamond plans; request → admin approval |
| 3-B | **Avatar** | DiceBear seeds (free/premium) + custom photo upload |
| 3-C | **Referral** | Invite codes, inviter/invitee discounts, stacking caps |
| 3-D | **Messages** | In-app inbox (welcome, admin, verification, subscription, alerts, …) |
| 3-E | **Config** | Public config endpoint (Goftino live-chat widget key) |
| 3-F | **Push** | Web Push notifications (VAPID) |
| 4 | **Categories** | 20+ Persian default categories; user requests; admin approval |
| 5 | **Transactions** | Income/expense in Toman, tags, recurring, CSV/XLSX import, bulk delete |
| 6 | **Budgets** | Monthly per-category limits, ZBB view, copy-from-last-month, financial score |
| 6 | **Reports** | Monthly/comparison/weekly/cash-flow/net-worth/score/insights; CSV + PDF export |
| 7 | **Goals** | Savings goals with contributions, withdrawals, history |
| 8 | **Market** | Live gold/currency/crypto/commodity prices via BrsApi.ir (15-min cache) |
| 9 | **Assets** | Net-worth tracking (gold, crypto, cash, property, …) with snapshots |
| 10 | **Expert** | Admin recommendations; users mark status; admin broadcast to subscribers |
| 12 | **Split** | Expense-splitting groups (دنگ و دونگ), members, settlements, public invite token |
| 13 | **Banners** | Scheduled advertising banners with impression/click tracking |
| 14 | **Session tracking** | User engagement heartbeat (`POST /api/session/ping`) for admin stats |
| 14-A | **Admin panel** | Full admin API: stats, user search, admin CRUD, activity log |

All API response messages are in **Persian**.

---

## Prerequisites

- **Node.js** 18+
- **npm**
- **SMTP account** (optional in dev — OTP codes are printed to the terminal)

---

## Installation

```bash
cd Session8-HW-Backend
npm install
```

---

## Environment setup

Copy the example file and edit values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API server port (default `3000`) |
| `SESSION_SECRET` | Yes (prod) | User session secret |
| `ADMIN_SESSION_SECRET` | No | Admin session secret (falls back to `SESSION_SECRET`) |
| `CORS_ORIGINS` | Prod | Comma-separated allowed origins |
| `FRONTEND_URL` | No | User app origin (also added to CORS allowlist) |
| `ADMIN_FRONTEND_URL` | No | Admin panel origin (also added to CORS allowlist) |
| `APP_DB_PATH` | No | User SQLite database path (default `./dakhlyar_app.db`) |
| `ADMIN_DB_PATH` | No | Admin SQLite database path (default `./dakhlyar_admin.db`) |
| `SMTP_HOST` | No | SMTP server host |
| `SMTP_PORT` | No | SMTP port (default `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password / app password |
| `FROM_EMAIL` | No | Sender address, e.g. `"Dakhlyar <noreply@dakhlyar.ir>"` |
| `VAPID_PUBLIC_KEY` | No | Web Push public key |
| `VAPID_PRIVATE_KEY` | No | Web Push private key |
| `VAPID_MAILTO` | No | Web Push contact, e.g. `mailto:support@dakhlyar.ir` |
| `GOFTINO_WIDGET_KEY` | No | Goftino live-chat widget key (exposed via `/api/config/public`) |
| `BRSAPI_KEY` | No | BrsApi.ir market data API key (server-side only) |
| `NODE_ENV` | No | Set to `production` in prod (affects cookies, CORS defaults) |

---

## VAPID key generation (Web Push)

Generate keys **once** and store them in `.env`:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Add the output to `.env`:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_MAILTO=mailto:support@dakhlyar.ir
```

> Regenerating keys in production invalidates all existing browser push subscriptions.

---

## Run the server

```bash
npm start
```

Development with auto-reload:

```bash
npm run dev
```

Expected output:

```
✅ Dakhlyar API server is running at http://localhost:3000
🏥 Health check:          http://localhost:3000/health
📚 Swagger docs:           http://localhost:3000/api/docs
   App (FA):               http://localhost:3000/api/docs/fa/app
   App (EN):               http://localhost:3000/api/docs/en/app
   Admin (FA):             http://localhost:3000/api/docs/fa/admin
   Admin (EN):             http://localhost:3000/api/docs/en/admin
🌐 CORS origins:           ...
```

If port 3000 is in use:

```bash
lsof -ti tcp:3000 | xargs kill -9
PORT=3001 npm start
```

---

## Default admin account

On first run, when the `admins` table is empty, a default superadmin is seeded:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |
| Email | `admin@dakhlyar.ir` |
| Role | `superadmin` |

`must_change_password` is set to `1` — you must change the password on first login.

Login endpoint: `POST /api/admin/auth/login`

Three placeholder onboarding stories are also seeded pointing to `/uploads/stories/placeholder.jpg`.

---

## Health check

```bash
curl http://localhost:3000/health
```

Response:

```json
{ "status": "ok", "timestamp": "2026-06-13T12:00:00.000Z" }
```

---

## API documentation (Swagger)

OpenAPI 3.0 docs are available in **Persian** and **English**, split into **App** and **Admin** scopes:

| URL | Description |
|-----|-------------|
| `GET /api/docs` | Landing page with links to all sections |
| `GET /api/docs/fa/app` | User App API — Persian |
| `GET /api/docs/fa/admin` | Admin Panel API — Persian |
| `GET /api/docs/en/app` | User App API — English |
| `GET /api/docs/en/admin` | Admin Panel API — English |
| `GET /api/docs/legacy` | Redirects to `/api/docs/fa/app` |

Use Swagger UI to explore request/response schemas, try endpoints, and read operation descriptions.

---

## Authentication & sessions

### User sessions

- **Cookie:** default `express-session` cookie
- **Secret:** `SESSION_SECRET`
- **TTL:** 2 hours
- **Set on:** `POST /api/auth/login` → `req.session.user_id`, `req.session.mobile`
- **Guard:** `requireUser` middleware (`middlewares/auth.js`)
- **OTP gate:** `POST /api/auth/verify-otp` sets `otp_verified_email` for register / reset-password flows
- **Logout:** `POST /api/auth/logout`

### Admin sessions (real panel)

- **Cookie:** `dakhlyar_admin_sid` (scoped to `/api/admin`)
- **Secret:** `ADMIN_SESSION_SECRET` (falls back to `SESSION_SECRET`)
- **TTL:** 8 hours
- **Set on:** `POST /api/admin/auth/login` → `adminId`, `adminRole`, `adminUsername`
- **Guard:** `requireAdmin` / `requireSuperAdmin` (`middlewares/adminAuth.js`)
- **Roles:** `admin`, `superadmin` (only superadmin can manage other admins)
- **Activity log:** admin actions are recorded in `admin_activity_log`

### Legacy dev admin flag

Some older routes (`/api/admin/verifications`, `/api/admin/subscriptions`, `/api/admin/referrals`) use `requireAdmin` from `middlewares/auth.js`, which checks `req.session.isAdmin === true`. The real admin panel uses `/api/admin/auth/*` with the dedicated admin session above.

---

## API overview

### Infrastructure

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/config/public` | — | Public config (Goftino key) |

### User app (`/api/*`)

| Prefix | Auth | Key endpoints |
|--------|------|---------------|
| `/api/auth` | Public | `login`, `check-duplicates`, `send-otp`, `verify-otp`, `register`, `forgot-password`, `reset-password`, `logout` |
| `/api/stories` | User | List stories, status, `mark-seen` |
| `/api/profile` | User | Get/update profile, change password, devices, invite code |
| `/api/avatar` | User | List/select/upload/delete avatar |
| `/api/verification` | User | KYC status, submit request |
| `/api/subscription` | Mixed | `plans` (public); `status`, `request` (auth) |
| `/api/messages` | User | Inbox, read, delete |
| `/api/referral` | Mixed | Validate/apply code (public); discounts, invites (auth) |
| `/api/push` | Mixed | VAPID key (public); subscribe/unsubscribe (auth) |
| `/api/categories` | User | List, request custom category |
| `/api/transactions` | User | CRUD, import, bulk delete, tags, summary, recurring, sample CSV |
| `/api/budgets` | User | CRUD, bulk, ZBB, copy-from-last-month |
| `/api/reports` | User | Monthly, comparison, weekly, cash-flow, net-worth, score, insights; CSV/PDF export |
| `/api/goals` | User | Savings goals CRUD, contribute, withdraw, history |
| `/api/market` | User | Gold/currency, crypto, commodity, favorites |
| `/api/assets` | User | Asset types, CRUD, history, net-worth |
| `/api/expert` | User | Recommendations list, detail, update status |
| `/api/split` | Mixed | Public group view by token; groups, members, expenses, settle |
| `/api/session` | User | Engagement ping |
| `/api/banners` | User | Active banners, click tracking |

### Admin panel (`/api/admin/*`)

| Prefix | Auth | Key endpoints |
|--------|------|---------------|
| `/api/admin/auth` | Mixed | `login`; `logout`, `me`, `change-password` |
| `/api/admin/admins` | Superadmin | Admin account CRUD |
| `/api/admin/users` | Admin | Search, list, detail, reset stories |
| `/api/admin/verification` | Admin | List/review verification requests |
| `/api/admin/subscription` | Admin | List/review subscription requests |
| `/api/admin/stats` | Admin | Overview, growth, revenue, engagement, pending items |
| `/api/admin/activity-log` | Admin | Admin audit trail |
| `/api/admin/stories` | Admin | CRUD, upload, reset-for-users |
| `/api/admin/banners` | Admin | CRUD, upload, stats |
| `/api/admin/categories` | Admin | Category requests, default catalog |
| `/api/admin/expert` | Admin | Recommendations CRUD, expert messaging |
| `/api/admin/messages` | Admin | Broadcast/direct messaging, history, stats |
| `/api/admin/verifications` | Legacy | Approve/reject (legacy session) |
| `/api/admin/subscriptions` | Legacy | Approve/reject (legacy session) |
| `/api/admin/referrals` | Legacy | List, stats (legacy session) |

> Full endpoint details, request bodies, and response schemas are in Swagger.

---

## CORS

Credentialed cross-origin requests are enabled for origins listed in `.env`:

```env
CORS_ORIGINS=http://localhost:3001,http://localhost:5173
FRONTEND_URL=http://localhost:3001
ADMIN_FRONTEND_URL=http://localhost:5173
```

Configuration lives in `server/utils/corsConfig.js`.

In **development** (`NODE_ENV` not `production`), if no origins are configured, these are allowed automatically:

- `http://localhost:3000`, `3001`, `5173`
- `http://127.0.0.1:3000`, `3001`, `5173`

In **production**, set `CORS_ORIGINS` (or `FRONTEND_URL` / `ADMIN_FRONTEND_URL`) to your real frontend URLs.

Frontend fetch example:

```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mobile, password }),
});
```

---

## Databases

Two **independent** SQLite databases are created on first run (WAL mode, foreign keys ON):

### App database — `dakhlyar_app.db`

User-facing data:

| Tables | Purpose |
|--------|---------|
| `users`, `otp_codes`, `login_attempts` | Auth |
| `verification_requests`, `subscription_requests`, `connected_devices` | KYC & subscription |
| `referrals`, `referral_discounts` | Invite system |
| `messages` | In-app inbox |
| `push_subscriptions` | Web Push |
| `categories`, `category_requests` | Transaction categories |
| `transactions`, `transaction_tags`, `recurring_alerts` | Transactions |
| `budgets`, `financial_scores` | Budgets & score |
| `savings_goals`, `goal_contributions` | Savings goals |
| `market_cache`, `market_favorites` | Market data |
| `assets`, `asset_snapshots` | Net worth |
| `expert_recommendations`, `user_recommendation_status` | Expert tips |
| `split_groups`, `split_members`, `split_expenses`, `split_expense_shares`, `split_settlements` | Split bills |
| `user_app_sessions` | Engagement tracking |

20 Persian default categories are seeded on first run.

### Admin database — `dakhlyar_admin.db`

Admin-panel data:

| Tables | Purpose |
|--------|---------|
| `admins` | Admin accounts |
| `admin_sessions` | Reserved (express-session used instead) |
| `stories` | Onboarding carousel images |
| `banners`, `banner_events` | Advertising banners |
| `admin_activity_log` | Admin audit trail |

Paths are configurable via `APP_DB_PATH` and `ADMIN_DB_PATH` in `.env`.

---

## Background jobs

On **startup** and **every hour**, the server runs these sweeps (`server/index.js`):

| Job | Description |
|-----|-------------|
| Subscription expiry | Reverts expired subscriptions; resets premium avatars; sends messages + push |
| Expiry warnings | Warns at 10, 5, 1 days before subscription ends |
| Message auto-expire | Removes messages past `expires_at` |
| Referral discount expiry | Expires unused invitee discounts; sends reminders |
| Recurring transactions | Due-date reminders; advances `next_expected` |

---

## Static files & uploads

| URL | Filesystem | Contents |
|-----|------------|----------|
| `/uploads` | `server/uploads/` | `stories/`, `banners/`, `avatars/` |
| `/sample` | `sample/` | `transactions_sample.csv` |

Also available via `GET /api/transactions/sample-csv`.

**Upload limits:**

| Type | Max size | Formats |
|------|----------|---------|
| Stories | 5 MB | jpg, png, webp |
| Banners | 3 MB | jpg, png, webp |
| Avatars | 3 MB | jpg, png, webp |
| Transaction import | 2 MB | CSV, XLSX |

Static assets are served with a 7-day cache header.

---

## SMTP & OTP (development mode)

When SMTP is **not** configured (missing `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`, or still set to `.env.example` placeholders):

1. Server startup prints a warning banner in the terminal.
2. OTP codes are **printed to the console** on every send (signup and reset-password).
3. No email is sent — API still returns success with an optional `smtp_warning`.
4. OTP remains valid in the `otp_codes` table (3-minute TTL).

When SMTP **is** configured, Nodemailer sends RTL Persian HTML emails. Codes are still logged to the console for debugging.

---

## Rate limiting

In-memory IP-based rate limits (`middlewares/rateLimiter.js`):

| Limiter | Window | Max | Routes |
|---------|--------|-----|--------|
| Login | 10 min | 30 | `POST /api/auth/login` |
| OTP send | 10 min | 10 | `POST /api/auth/send-otp`, `/forgot-password` |
| OTP verify | 10 min | 30 | `POST /api/auth/verify-otp` |

Returns `429` with `Retry-After` header.

Additionally, failed login attempts are tracked per mobile (3 failures → 10-minute lockout via `login_attempts` table).

---

## Project structure

```
Session8-HW-Backend/
├── server/
│   ├── index.js                 ← API entry point
│   ├── db/
│   │   ├── appDb.js             ← User SQLite DB + migrations
│   │   └── adminDb.js           ← Admin SQLite DB + seed
│   ├── routes/                  ← Express routers (user app)
│   │   └── admin/               ← Admin panel routers
│   ├── controllers/             ← Request handlers
│   │   └── admin/               ← Admin controllers
│   ├── middlewares/             ← Auth, rate limiting
│   ├── utils/                   ← mailer, push, scores, CORS, …
│   ├── swagger/                 ← OpenAPI specs (fa/en, app/admin)
│   ├── scripts/                 ← Utility scripts
│   ├── fonts/                   ← PDF export fonts (Vazirmatn)
│   └── uploads/                 ← User-uploaded files
│       ├── avatars/
│       ├── banners/
│       └── stories/
├── sample/
│   └── transactions_sample.csv
├── .env.example
├── package.json
└── README.md
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the API server |
| `npm run dev` | Start with nodemon (auto-reload) |
| `node server/scripts/generate-icons.js` | Generate PWA icons via Sharp |

Swagger locale generators (internal):

- `server/swagger/scripts/generateLocales.js`
- `server/swagger/scripts/generateResponseLocales.js`

---

## Notes

- **Backend only** — no frontend static files are served from `public/`.
- Two separate session cookies: user (default) and admin (`dakhlyar_admin_sid`).
- Response messages are in Persian; Swagger is available in FA and EN.
- PDF reports use Vazirmatn fonts from `server/fonts/`.
- Market data requires a valid `BRSAPI_KEY` from [BrsApi.ir](https://brsapi.ir).
- Goftino widget key is exposed only via the public config endpoint.

---

## License

MIT
