# Dakhlyar (Dakhlyar)

Persian-first personal finance management app — Phase 1: Authentication (login, signup, email verification, password recovery).

This phase includes an Express backend, Vanilla JS frontend (mobile-first, RTL), and Swagger documentation (Persian and English, app and admin).

Persian README: [README.md](README.md)

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment (`.env`)](#environment-env)
- [Running the Project](#running-the-project)
- [Page Routes](#page-routes)
- [API Documentation (Swagger)](#api-documentation-swagger)
- [Endpoints and `curl` Examples](#endpoints-and-curl-examples)
- [Validation Rules](#validation-rules)
- [Security Rules](#security-rules)
- [Phase 2 — Onboarding Stories](#phase-2--onboarding-stories)
- [Phase 3 — Home Page + User Profile](#phase-3--home-page--user-profile)
- [Phase 3-B — User Avatar System](#phase-3-b--user-avatar-system)
- [Phase 3-C — Referral / Invite System](#phase-3-c--referral--invite-system)
- [Phase 3-D — Messages System](#phase-3-d--messages-system)
- [Phase 3-E — Live Support (Goftino)](#phase-3-e--live-support-goftino)
- [Phase 3-F — Web Push Notifications](#phase-3-f--web-push-notifications)
- [Phase 4 — Bottom Navigation + Page Structure + Categories](#phase-4--bottom-navigation--page-structure--categories)
- [Phase 5 — Transactions](#phase-5--transactions)
- [Phase 6 — Budgets, Reports, Comparison & Export](#phase-6--budgets-reports-comparison--export)
- [Phase 7 — Savings Goals + ZBB + Forecast](#phase-7--savings-goals--zbb--forecast)
- [Phase 8 — Market View (BrsApi.ir)](#phase-8--market-view-brsapiir)
- [Phase 9 — Assets](#phase-9--assets)
- [Phase 10 — Expert Recommendations](#phase-10--expert-recommendations)
- [Phase 11 — Financial Score + Behavioral Insights + Home Dashboard](#phase-11--financial-score--behavioral-insights--home-dashboard)
- [Phase 12 — Split Bills (Deng o Dong)](#phase-12--split-bills-deng-o-dong)
- [Phase 13 — Promotional Banners](#phase-13--promotional-banners)
- [Phase 14-A — Admin Panel (Infrastructure + Auth)](#phase-14-a--admin-panel-infrastructure--auth)
- [Phase 14-B — Admin Dashboard + Stats](#phase-14-b--admin-dashboard--stats)
- [Phase 14-C — User Management](#phase-14-c--user-management)
- [Phase 14-D — Content Management (Admin Panel)](#phase-14-d--content-management-admin-panel)
- [Phase 14-E — Messaging (Admin Panel)](#phase-14-e--messaging-admin-panel)
- [Future Phases](#future-phases)
- [License](#license)

---

## Prerequisites

- Node.js version 18 or higher
- npm or yarn
- An SMTP account (e.g. Gmail App Password) for sending OTP emails

---

## Project Structure

```
dakhlyar/
├── server/
│   ├── index.js
│   ├── db/
│   │   ├── appDb.js          ← dakhlyar_app.db
│   │   └── adminDb.js        ← dakhlyar_admin.db
│   ├── routes/auth.js
│   ├── controllers/authController.js
│   ├── middlewares/rateLimiter.js
│   ├── utils/mailer.js
│   └── swagger/
│       ├── swaggerConfig.js  ← base OpenAPI paths
│       ├── specBuilder.js    ← builds fa/en + app/admin
│       └── locales/
├── public/
│   ├── index.html            ← login page
│   ├── signup.html           ← 3-step signup wizard
│   ├── css/style.css
│   └── js/
│       ├── login.js
│       └── signup.js
├── .env.example
├── package.json
└── README.md
```

> Two fully independent SQLite databases: `dakhlyar_app.db` (user side) and `dakhlyar_admin.db` (admin panel, in later phases).

---

## Installation

```bash
git clone <repo-url> dakhlyar
cd dakhlyar
npm install
```

Main installed packages:

- `express`, `express-session`
- `better-sqlite3`
- `bcrypt` (rounds: 12)
- `nodemailer`
- `swagger-jsdoc`, `swagger-ui-express`
- `dotenv`

---

## Environment (`.env`)

Copy `.env.example` to `.env` and set your values:

```bash
cp .env.example .env
```

Example `.env`:

```dotenv
PORT=3000
SESSION_SECRET=SESSION_SECRET=your_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_password
FROM_EMAIL="دخلیار <your@gmail.com>"
APP_DB_PATH=./dakhlyar_app.db
ADMIN_DB_PATH=./dakhlyar_admin.db

# Phase 3-F — Web Push (VAPID)
# Generate ONCE with: node -e "console.log(require('web-push').generateVAPIDKeys())"
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_MAILTO=mailto:support@dakhlyar.ir

# Phase 3-E — Goftino live chat widget key (public, exposed via /api/config/public)
GOFTINO_WIDGET_KEY=your_goftino_widget_key_here

# Phase 8 — BrsApi.ir market data (server-side only)
BRSAPI_KEY=your_brsapi_key_here

# Phase 14-A — Admin panel session (separate from user session)
ADMIN_SESSION_SECRET=
```

### Gmail SMTP Guide

1. Enable 2-Step Verification on your Google account.
2. Create an **App Password**: <https://myaccount.google.com/apppasswords>
3. Put the generated 16-character password in `SMTP_PASS`.

---

## Running the Project

```bash
npm start
```

Or with auto-reload in development:

```bash
npm run dev
```

The server runs on the configured port (default 3000):

```
✅ Dakhlyar server is running at http://localhost:3000
📚 Swagger docs:           http://localhost:3000/api/docs
```

---

## Page Routes

### User App Pages

| Path | Description |
|------|-------------|
| `/` (`index.html`) | User login page |
| `/signup.html` | 3-step signup wizard |
| `/forgot-password.html` | 3-step password recovery wizard (email → OTP → new password) |
| `/dashboard.html` | Home dashboard — total net worth, monthly summary, financial score, market ticker, transactions, goals, insights |
| `/profile.html` | Single-page profile with hash routing (`#/info`, `#/verification`, `#/subscription`, …) |
| `/messages.html` | Messages inbox — unread/read/expired cards, type badges, read-all, delete read messages |
| `/goals.html` | Savings goals — progress, contribute/withdraw, cash-flow forecast, ZBB widget |
| `/transactions.html` | Transactions — sticky summary, daily groups, FAB add, filters, CSV/Excel import |
| `/reports.html` | Reports — financial score, charts, monthly comparison, budget sheet, CSV/PDF export |
| `/market.html` | Market view — gold/currency, crypto, commodities, favorites (BrsApi.ir) |
| `/expert.html` | Expert recommendations — subscription-gated, pending/done/dismissed status |
| `/assets.html` | Assets — manual asset tracking, net worth, subscription-gated |
| `/split.html` | Split bills (Deng o Dong) — groups, expenses, settlements |
| `/split-view.html` | Public debt view (shareable link, no login required) |
| `/score.html` | Financial score — large arc, 6-month history, score breakdown, insights, improvement tips |

### Dev Admin Pages (legacy `req.session.isAdmin`)

| Path | Description |
|------|-------------|
| `/admin` | Dev admin landing — links to dev panels below |
| `/admin-stories.html` | Onboarding story management (dev) |
| `/admin-verifications.html` | Verification request approve/reject (dev) |
| `/admin-subscriptions.html` | Subscription request approve/reject (dev) |

### Admin Panel Pages (`/admin/*`)

| Path | Description |
|------|-------------|
| `/admin` | Admin panel entry — redirects to login |
| `/admin/login.html` | Admin login (default: admin / admin — forced password change on first login) |
| `/admin/dashboard.html` | Admin dashboard — KPIs, charts, pending requests |
| `/admin/admins.html` | Admin account management (superadmin only) |
| `/admin/users.html` | User management — users / verification / subscription tabs |
| `/admin/stories.html` | Onboarding stories — upload, reorder, reset |
| `/admin/banners.html` | Promotional banners — CRUD, CTR stats |
| `/admin/recommendations.html` | Expert recommendation CRUD |
| `/admin/categories.html` | Category requests + default categories |
| `/admin/messages.html` | Messaging — broadcast, direct, bulk Excel, expert send, history |
| `/admin/history.html` | Admin activity log (superadmin) |

### API Documentation (Swagger)

| Path | Description |
|------|-------------|
| `/api/docs` | Documentation landing page with links to all 4 sections |
| `/api/docs/fa/app` | Swagger Persian — User App API |
| `/api/docs/fa/admin` | Swagger Persian — Admin Panel API |
| `/api/docs/en/app` | Swagger English — User App API |
| `/api/docs/en/admin` | Swagger English — Admin Panel API |

---

## API Documentation (Swagger)

OpenAPI documentation is split into **two sections** (User App / Admin Panel) and **two languages** (Persian / English):

| Path | Description |
|------|-------------|
| `GET /api/docs` | Landing page with links to all sections |
| `GET /api/docs/fa/app` | User App API — Persian |
| `GET /api/docs/fa/admin` | Admin Panel API — Persian |
| `GET /api/docs/en/app` | User App API — English |
| `GET /api/docs/en/admin` | Admin Panel API — English |

For each endpoint:

- Summary and description (Persian in `/fa/*`, English in `/en/*`)
- All body fields with type, description, example, and required flag
- All HTTP response codes with message and sample response

> Actual API responses are still returned in Persian; the English Swagger version is for documentation only.

Persian README: [README.md](README.md)

---

## Endpoints and `curl` Examples

> For session-dependent routes (`register`, `reset-password`), use `-c cookies.txt` and `-b cookies.txt` to save and send the session cookie.

---

### 1) `POST /api/auth/login` — User Login

**Successful login (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09121234567","password":"MyPass@123"}'
```

**Invalid mobile format (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"123","password":"x"}'
# { "message": "فرمت شماره موبایل معتبر نیست" }  (Invalid mobile number format)
```

**Wrong password — account exists (401):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09121234567","password":"wrong"}'
# { "message": "رمز عبور اشتباه است", "attempts_left": 2 }  (Incorrect password)
```

**Mobile not registered (404):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09999999999","password":"x"}'
# { "message": "حسابی با این شماره موبایل ثبت نشده است" }  (No account with this mobile)
```

**Account locked (423):** after 3 failed attempts in 10 minutes:

```bash
for i in 1 2 3 4; do
  curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"mobile":"09121234567","password":"wrong"}' && echo
done
# Last response:
# { "locked": true, "message": "حساب شما به مدت ۱۰ دقیقه قفل شده است", "remaining_seconds": 600 }
# (Your account is locked for 10 minutes)
```

---

### 2) `POST /api/auth/check-duplicates` — Check Duplicates

```bash
curl -i -X POST http://localhost:3000/api/auth/check-duplicates \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09121234567","email":"u@example.com","national_id":"0012345678"}'
# { "mobile_taken": false, "email_taken": true, "national_id_taken": false }
```

---

### 3) `POST /api/auth/send-otp` — Send Verification Code to Email

**Successful send (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"u@example.com","type":"signup"}'
# { "message": "کد تایید به ایمیل شما ارسال شد" }  (Verification code sent to your email)
```

**Invalid email (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","type":"signup"}'
# { "message": "آدرس ایمیل معتبر نیست" }  (Invalid email address)
```

**Account not found — only for `reset_password` (404):**

```bash
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"unknown@example.com","type":"reset_password"}'
# { "message": "حسابی با این ایمیل یافت نشد" }  (No account found with this email)
```

**Email send error (500):**

```bash
# With incorrect SMTP settings in .env:
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","type":"signup"}'
# { "message": "خطای سرور — ارسال ایمیل با مشکل مواجه شد" }  (Server error — email send failed)
```

---

### 4) `POST /api/auth/verify-otp` — Verify OTP Code

**Successful verification (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{"email":"u@example.com","code":"482910","type":"signup"}'
# { "verified": true }
```

**Wrong code (400):**

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","code":"000000","type":"signup"}'
# { "message": "کد وارد شده اشتباه است" }  (The entered code is incorrect)
```

**Expired code (400):** after 180 seconds from send:

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","code":"482910","type":"signup"}'
# { "message": "کد منقضی شده است — لطفاً کد جدید درخواست کنید" }
# (Code expired — please request a new code)
```

**Code already used (400):** if the same code is submitted again:

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","code":"482910","type":"signup"}'
# { "message": "این کد قبلاً استفاده شده است" }  (This code has already been used)
```

**Code not found (404):** no OTP registered for this email/type:

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"never@example.com","code":"123456","type":"signup"}'
# { "message": "کد معتبری یافت نشد" }  (No valid code found)
```

---

### 5) `POST /api/auth/register` — Register New User

> ⚠️ Before this endpoint, `verify-otp` with `type=signup` must succeed. Always use `-b cookies.txt` to send the session.

**Successful registration (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "mobile":"09121234567",
    "email":"u@example.com",
    "national_id":"0012345678",
    "birth_date":"1990-05-12",
    "password":"MyPass@123",
    "confirm_password":"MyPass@123"
  }'
# { "success": true, "message": "ثبت‌نام با موفقیت انجام شد" }  (Registration completed successfully)
```

**Password and confirmation do not match (400):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1990-05-12","password":"MyPass@123","confirm_password":"Other@123"
  }'
# { "message": "رمز عبور و تکرار آن یکسان نیستند" }  (Password and confirmation do not match)
```

**Email not verified (403):** without prior `verify-otp`:

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1990-05-12","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "ایمیل تایید نشده است — لطفاً ابتدا OTP را تایید کنید" }
# (Email not verified — please verify OTP first)
```

**Duplicate mobile (409):**

```bash
# { "message": "این شماره موبایل قبلاً ثبت شده است" }  (This mobile is already registered)
```

**Duplicate email (409):**

```bash
# { "message": "این ایمیل قبلاً ثبت شده است" }  (This email is already registered)
```

**Duplicate national ID (409):**

```bash
# { "message": "این کد ملی قبلاً ثبت شده است" }  (This national ID is already registered)
```

**Weak password (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1990-05-12","password":"weak","confirm_password":"weak"
  }'
# { "message": "رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد" }
# (Password must be at least 8 characters with one digit, one uppercase letter, and one special character)
```

**Invalid national ID (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"123",
    "birth_date":"1990-05-12","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "فرمت کد ملی معتبر نیست — باید ۱۰ رقم عددی باشد" }
# (Invalid national ID format — must be 10 digits)
```

**Birth date in the future (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"2099-01-01","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "تاریخ تولد نمی‌تواند در آینده باشد" }  (Birth date cannot be in the future)
```

**Age over 120 years (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1850-01-01","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "تاریخ تولد معتبر نیست — حداکثر سن مجاز ۱۲۰ سال است" }
# (Invalid birth date — maximum age is 120 years)
```

**Invalid birth date format (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"not-a-date","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "فرمت تاریخ تولد معتبر نیست" }  (Invalid birth date format)
```

---

### 6) `POST /api/auth/forgot-password` — Request Password Recovery

**Success (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" -c cookies.txt \
  -d '{"email":"u@example.com"}'
# { "message": "کد بازیابی به ایمیل شما ارسال شد" }  (Recovery code sent to your email)
```

**Account not found (404):**

```bash
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"unknown@example.com"}'
# { "message": "حسابی با این ایمیل یافت نشد" }  (No account found with this email)
```

**Invalid email (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'
# { "message": "آدرس ایمیل معتبر نیست" }  (Invalid email address)
```

---

### 7) `POST /api/auth/reset-password` — Set New Password

> ⚠️ Before this endpoint, `verify-otp` with `type=reset_password` must succeed.

**Success (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "email":"u@example.com",
    "new_password":"NewPass@123",
    "confirm_password":"NewPass@123"
  }'
# { "success": true, "message": "رمز عبور با موفقیت تغییر یافت" }  (Password changed successfully)
```

**Password and confirmation do not match (400):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"email":"u@example.com","new_password":"NewPass@123","confirm_password":"Other@123"}'
# { "message": "رمز عبور و تکرار آن یکسان نیستند" }  (Password and confirmation do not match)
```

**OTP not verified (403):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","new_password":"NewPass@123","confirm_password":"NewPass@123"}'
# { "message": "تایید OTP انجام نشده است — لطفاً ابتدا کد را تایید کنید" }
# (OTP not verified — please verify the code first)
```

**Weak password (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"email":"u@example.com","new_password":"weak","confirm_password":"weak"}'
# { "message": "رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد" }
# (Password must meet complexity requirements)
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| Mobile | `/^09[0-9]{9}$/` |
| Email | Standard RFC format |
| National ID | Exactly 10 numeric digits |
| Birth date | `YYYY-MM-DD` Gregorian — not in the future, max age 120 years (no lower bound) |
| Password | Min 8 characters, at least 1 uppercase, 1 digit, 1 special from `!@#$%^&*` |

---

## Security Rules

- Passwords are **never** stored in plain text — all hashed with `bcrypt.hash(password, 12)`.
- `password_hash` is never returned in any response.
- OTP codes expire exactly after 180 seconds.
- As soon as an OTP is verified, `used=1` and it cannot be reused.
- When a new OTP is sent for the same email+type, all previous unused OTPs are invalidated (`used=1`).
- Login lockout: 3 failed attempts in 10 minutes → account locked for 10 minutes.
- Passwords are never logged.

---


---

## Phase 2 — Onboarding Stories

After a user's first login, a fullscreen 3-page player (similar to Instagram stories) is shown. Once the user has seen the stories, they are not shown again — unless an admin resets them.

### Database Changes

Applied automatically on boot:

- `dakhlyar_app.db` → column `users.has_seen_stories INTEGER DEFAULT 0` (idempotent migration)
- `dakhlyar_admin.db` → table `stories(id, order_index, image_path, is_active, created_at)` + three seed rows with image `/uploads/stories/placeholder.jpg`

### User Endpoints

#### `GET /api/stories` — List Active Stories

```bash
curl -i -b cookies.txt http://localhost:3000/api/stories
# 200:
# { "stories": [ { "id":1, "order_index":1, "image_url":"/uploads/stories/placeholder.jpg" }, ... ] }
```

```bash
# 401 — not logged in
curl -i http://localhost:3000/api/stories
# { "message": "لطفاً وارد حساب کاربری خود شوید" }  (Please log in to your account)
```

#### `GET /api/stories/status` — View Status

```bash
curl -i -b cookies.txt http://localhost:3000/api/stories/status
# 200: { "has_seen_stories": 0 }
```

#### `POST /api/stories/mark-seen` — Mark as Seen

```bash
curl -i -X POST -b cookies.txt http://localhost:3000/api/stories/mark-seen
# 200: { "success": true }
```

### Admin Endpoints (requires `req.session.isAdmin === true`)

> ⚠️ These endpoints were built as Phase 2 placeholders. In Phase 3 they connect to admin login. Currently they return 401 unless `req.session.isAdmin = true` is set manually.

#### `POST /api/admin/stories/upload` — Upload New Story

```bash
curl -i -X POST -b cookies.txt http://localhost:3000/api/admin/stories/upload \
  -F "image=@/path/to/story1.jpg" \
  -F "order_index=1"
# 200: { "success": true, "story": { "id":4, "order_index":1, "image_url":"/uploads/stories/story_..._story1.jpg" } }
```

Sample errors:

```bash
# 400 — disallowed format
# { "message": "فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود" }
# (File format not allowed — only jpg, png, webp accepted)

# 400 — file too large
# { "message": "حجم فایل بیش از ۵ مگابایت است" }  (File size exceeds 5 MB)

# 400 — invalid order
# { "message": "ترتیب نمایش معتبر نیست — باید عدد صحیح و بزرگ‌تر از صفر باشد" }
# (Invalid display order — must be a positive integer)

# 401 — not admin
# { "message": "دسترسی غیرمجاز" }  (Unauthorized)
```

#### `POST /api/admin/stories/reset-for-users` — Reset All Users

```bash
curl -i -X POST -b cookies.txt http://localhost:3000/api/admin/stories/reset-for-users
# 200: { "success": true, "message": "استوری برای همه کاربران ریست شد", "affected_users": 12 }
# (Stories reset for all users)
```

### StoryPlayer Frontend Behavior

- Fullscreen black overlay — `z-index: 9999`
- Each story displays for 5 seconds
- Progress bars at top with CSS animation
- **Hold** → pause animation and timer — **Release** → resume from same point
- **Tap left 30%** → previous story (or close on first)
- **Tap right 70%** → next story (or finish on last)
- × button at top → `mark-seen` + close
- Natural end of last story → `mark-seen` + auto close
- Keyboard navigation: `←` previous, `→` next, `Esc` close, `Space` pause/resume

### Setup Notes

- Folder `server/uploads/stories/` is created automatically
- If `placeholder.jpg` is missing, a valid 1×1 white JPEG (~134 bytes) is written from code so the story flow works without admin upload
- Uploaded files are served statically via `app.use('/uploads', express.static('server/uploads'))`

---

## Phase 3 — Home Page + User Profile

This phase includes: new database migrations (profile columns, subscription and verification level + 4 new tables), profile APIs, tiered verification, subscription, connected devices, and the **Messages system (Phase 3-D, replacing old notifications)**, plus two frontend pages (updated dashboard + single-page profile with hash routing).

### Database Migrations (idempotent)

Columns added to `users`:

| Column | Type | Description |
|--------|------|-------------|
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `address` | TEXT | Address |
| `postal_code` | TEXT | Postal code (10 digits) |
| `verification_level` | INTEGER (0..3) | Current verification level |
| `subscription_plan` | TEXT | `silver` \| `gold` \| `diamond` |
| `subscription_expires_at` | TEXT | Subscription expiry date |

New tables: `verification_requests`, `subscription_requests`, `connected_devices` — all with `CREATE TABLE IF NOT EXISTS`. (In Phase 3-D the `notifications` table is fully replaced by `messages` and dropped with `DROP TABLE IF EXISTS notifications` at the start of the Phase 3-D migration.)

### Verification Levels

| Level | Prerequisite | Locked fields after verification |
|-------|-------------|----------------------------------|
| 0 | Email verified (default on signup) | `email` (always read-only) |
| 1 | Mobile + national ID | `mobile`, `national_id` |
| 2 | Birth date | `birth_date` |
| 3 | Address + postal code | `address`, `postal_code` |

- User can only request the next level (`current_level + 1`).
- A pending request blocks new requests of the same type.

### Subscription Plans (hardcoded on server)

| Key | Name | Duration | Price |
|-----|------|----------|-------|
| `silver` | Silver | 3 months | 2,000,000 Toman |
| `gold` | Gold | 6 months | 3,500,000 Toman |
| `diamond` | Diamond | 1 year | 6,000,000 Toman |

Price is always read from `server/utils/plans.js` — client-sent price is never accepted.

### `curl` Examples — Profile

```bash
# Profile info
curl -i -b cookies.txt http://localhost:3000/api/profile
# 200: { id, mobile, email, first_name, ..., verification_level, subscription_plan, is_subscription_active }

# Update free fields (first/last name)
curl -i -b cookies.txt -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"first_name":"فرید","last_name":"محمدی"}' \
  http://localhost:3000/api/profile
# 200: { "success": true, "message": "اطلاعات با موفقیت بروزرسانی شد", "updated_fields": ["first_name","last_name"] }
# (Information updated successfully)

# Attempt to edit locked field after verification (e.g. national_id after level 1)
# 403: { "message": "این فیلد به دلیل احراز هویت قابل ویرایش نیست", "locked_fields": ["national_id"] }
# (This field cannot be edited due to verification)

# Change password
curl -i -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"current_password":"Old@1234","new_password":"New@1234","confirm_password":"New@1234"}' \
  http://localhost:3000/api/profile/change-password
# 200: { "success": true, "message": "رمز عبور با موفقیت تغییر یافت" }  (Password changed successfully)
# 401: { "message": "رمز عبور فعلی اشتباه است" }  (Current password is incorrect)
# 400: { "message": "رمز عبور جدید نمیتواند با رمز فعلی یکسان باشد" }
# (New password cannot be the same as current password)

# Connected devices
curl -i -b cookies.txt http://localhost:3000/api/profile/devices
# 200: { "devices": [ { id, device_name, device_type, ip_address, last_active } ] }

curl -i -b cookies.txt -X DELETE http://localhost:3000/api/profile/devices/3
# 200 | 404

# Invite code
curl -i -b cookies.txt http://localhost:3000/api/profile/invite-code
# 200: { "invite_code": "DKHL-42" }
```

### `curl` Examples — Verification

```bash
# Verification status
curl -i -b cookies.txt http://localhost:3000/api/verification/status
# 200: {
#   "current_level": 1,
#   "pending_request": null,
#   "levels": [
#     { "level": 1, "state": "approved", ... },
#     { "level": 2, "state": "available", "required_fields": ["birth_date"], "missing_fields": [] },
#     { "level": 3, "state": "locked", ... }
#   ]
# }

# Request upgrade to next level
curl -i -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"requested_level":2}' \
  http://localhost:3000/api/verification/request
# 200: { "success": true, "message": "درخواست احراز هویت ثبت شد و در انتظار بررسی است", "request_id": 5 }
# (Verification request submitted and pending review)
# 400: { "message": "شما فقط می‌توانید سطح بعدی را درخواست دهید" }  (You can only request the next level)
# 409: { "message": "یک درخواست در حال بررسی دارید" }  (You already have a pending request)
# 422: { "message": "لطفاً ابتدا اطلاعات مورد نیاز این سطح را در پروفایل تکمیل کنید: تاریخ تولد", "missing_fields": ["birth_date"] }
# (Please complete required profile fields first: birth_date)
```

### `curl` Examples — Subscription

```bash
# Plan list (no login required)
curl -i http://localhost:3000/api/subscription/plans
# 200: { "plans": [ { "key":"silver", "name":"نقره‌ای", ... }, ... ] }

# User subscription status
curl -i -b cookies.txt http://localhost:3000/api/subscription/status
# 200: { "plan":"gold", "plan_name":"طلایی", "expires_at":"2026-09-01", "is_active":true, "days_remaining":45, "pending_request":null }

# Submit purchase request
curl -i -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"plan":"gold"}' \
  http://localhost:3000/api/subscription/request
# 200: { "success": true, "message": "درخواست اشتراک ثبت شد و در انتظار تایید ادمین است", "request_id": 12 }
# (Subscription request submitted and pending admin approval)
# 400: { "message": "پلن انتخابی معتبر نیست" }  (Selected plan is invalid)
# 409: { "message": "یک درخواست اشتراک در حال بررسی دارید" }  (You already have a pending subscription request)
```

### `curl` Examples — Messages (Phase 3-D, replaces Notifications)

```bash
# Message list + unread count (with Persian relative time)
curl -i -b cookies.txt http://localhost:3000/api/messages
# 200: { "messages": [{ "id":42, "title":"...", "time_ago":"۲ ساعت پیش", "is_expired":false, ... }], "unread_count": 3 }

# Mark one message as read
curl -i -b cookies.txt -X PATCH http://localhost:3000/api/messages/42/read
# 200: { "success": true }

# Mark all unread
curl -i -b cookies.txt -X PATCH http://localhost:3000/api/messages/read-all
# 200: { "success": true, "updated_count": 4 }

# Delete one message (read only)
curl -i -b cookies.txt -X DELETE http://localhost:3000/api/messages/42
# 200: { "success": true }
# 400 if unread: { "message": "پیام‌های خوانده نشده قابل حذف نیستند" }
# (Unread messages cannot be deleted)
```

### `curl` Examples — Logout

```bash
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
# 200: { "success": true, "message": "با موفقیت خارج شدید" }  (Logged out successfully)
```

### Device Tracking on Login

On every successful `/api/auth/login`, a record in `connected_devices` is upserted:

- If the same `(user_id, ip, user_agent)` already exists → only `last_active` is updated
- Otherwise → a new row with auto-detected `device_type` (`mobile` | `tablet` | `desktop`) and a readable `device_name` (e.g. `Chrome on macOS`)

This logic lives in `server/utils/deviceTracker.js` and never breaks the login flow (errors are only logged to console).

### New Frontend Pages

- `/dashboard.html` — now with top bar (profile icon + message bell with unread badge) and bottom nav (Home, Transactions, Reports, Budget). Other tabs currently show a "coming soon" toast.
- `/profile.html` — single page with hash routing for sub-sections: `#/info`, `#/verification`, `#/subscription`, `#/devices`, `#/invite`, `#/faq`, `#/terms`, `#/support`. Password change shown as a modal.
  - Birth date displayed in **Jalali (Persian calendar)** with Persian digits; Persian datepicker for editing (stored as Gregorian `YYYY-MM-DD` on server).
  - "Request verification" button is enabled only when all required fields for that level are complete; otherwise disabled with hint and "Complete info" shortcut.
- `/messages.html` — Messages page (Phase 3-D). Unread/read/expired cards, colored type badges, expandable body, delete read messages, "read all" with confirm modal.

### Dev Admin Panel — Verification/Subscription Review

Three simple Dev panels (require `req.session.isAdmin === true`, enabled via `POST /api/admin/stories/dev-login`):

- `/admin-stories.html` — onboarding story management
- `/admin-verifications.html` — list + approve/reject verification requests with filter (all / pending / approved / rejected) and optional admin note
- `/admin-subscriptions.html` — list + approve/reject subscription requests. Approval atomically sets `subscription_plan` and `subscription_expires_at = today + duration_months`

Landing page at `/admin` links to all three panels.

#### `curl` Examples — Admin Review

```bash
# (once) enable Dev admin
curl -s -X POST -c cookies.txt http://localhost:3000/api/admin/stories/dev-login

# List verification requests
curl -s -b cookies.txt http://localhost:3000/api/admin/verifications
# 200: { "requests": [ { id, user_id, requested_level, status, mobile, email, ... } ] }

# Approve
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"مدارک تایید شد"}' \
  http://localhost:3000/api/admin/verifications/5/approve
# 200: { "success": true, "message": "درخواست تایید شد", "new_level": 2 }
# (Request approved)

# Reject
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"کد ملی با تاریخ تولد همخوانی ندارد"}' \
  http://localhost:3000/api/admin/verifications/6/reject
# 200: { "success": true, "message": "درخواست رد شد" }  (Request rejected)

# Subscription — approve (atomic plan activation)
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"فاکتور #12345"}' \
  http://localhost:3000/api/admin/subscriptions/12/approve
# 200: { "success": true, "plan": "gold", "expires_at": "2026-12-12" }

# Subscription — reject
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"پرداخت تایید نشد"}' \
  http://localhost:3000/api/admin/subscriptions/13/reject
# 200: { "success": true, "message": "درخواست رد شد" }  (Request rejected)
```

---


## Phase 3-B — User Avatar System

Two-layer structure with 40 fixed **DiceBear Personas** avatars + custom photo upload for subscribed users.

### New Schema on `users` (in `dakhlyar_app.db`)

| Column | Type | Description |
|--------|------|-------------|
| `avatar_type` | TEXT DEFAULT `'dicebear'` | `'dicebear'` or `'custom'` |
| `avatar_seed` | TEXT DEFAULT `'aria'` | Selected DiceBear seed |
| `avatar_custom_path` | TEXT DEFAULT NULL | Custom photo path (`/uploads/avatars/...`) — only if `custom` |
| `avatar_last_seed` | TEXT DEFAULT `'aria'` | Last selected seed — for revert after subscription expiry |

This migration runs **idempotently** in `server/db/appDb.js > runMigrations()`.

### Seeds (fixed, whitelisted on server)

- **20 free** — `aria, luna, nova, sage, iris, leo, finn, zara, eden, blake, sky, rain, dawn, ash, brook, vale, reef, wren, cove, fern`
- **20 subscription premium** — `orion, lyra, phoenix, atlas, zephyr, aurora, draco, celeste, soleil, nimbus, vega, altair, sirius, cygnus, aquila, castor, pollux, rigel, deneb, antares`

Each seed has a fixed backgroundColor (full map in `server/utils/avatarHelper.js`).
Each avatar is served as SVG from:

```
https://api.dicebear.com/7.x/personas/svg?seed=<SEED>&backgroundColor=<HEX>
```

> ⚠️ Security: seed list is **hardcoded** on the server. Any client-sent seed is validated with `isValidSeed()` before use; premium seed access is always guarded server-side with subscription check.

### Subscription Expiry Behavior (automatic revert)

Function `checkAndRevertExpiredSubscriptions()` in `server/controllers/subscriptionController.js`:

1. Runs **once on server startup**.
2. Repeats **every 60 minutes** via `setInterval`.
3. **Real-time**: also runs for the same user before `GET /api/profile` and `GET /api/avatar/list` responses.

For each expired user (`subscription_expires_at < date('now')`) inside a transaction:

- If `avatar_type = 'custom'` → custom file deleted from disk, avatar reverts to `avatar_last_seed` (if that seed is premium → fallback to `aria`)
- If `avatar_type = 'dicebear'` and `avatar_seed` is premium → seed reverts to last free seed (or `aria`)
- If avatar was free → only `subscription_plan` and `subscription_expires_at` columns are cleared
- In all three cases a notification with title "پایان اشتراک" (Subscription ended) is inserted for the user

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/avatar/list` | List of 40 avatars + current avatar + lock status and `can_upload` |
| PATCH | `/api/avatar/select` | Select seed (`{ seed }`). Premium seeds require active subscription |
| POST | `/api/avatar/upload` | Upload custom photo (multipart `photo`, active subscription only) |
| DELETE | `/api/avatar/custom` | Delete custom photo and revert to last DiceBear seed |

All responses are in Persian and fully documented in Swagger under tag **آواتار** (Avatar).

#### Upload Rules

- **Accepted mimetype:** `image/jpeg`, `image/png`, `image/webp`
- **Accepted extension:** `.jpg`, `.jpeg`, `.png`, `.webp`
- **Max size:** 3 MB
- Stored filename built only from `userId + Date.now() + extension` (not `originalname`) → prevents path traversal
- If a previous photo exists, the old file is deleted from disk before saving the new one

### Frontend — `AvatarPicker`

- Added: `public/js/avatar.js` (class `AvatarPicker` + helper `window.getAvatarUrl`)
- Added: `public/css/avatar.css`
- In `profile.html` user avatar shown as `<img id="userAvatar" class="avatar-img">`. Tap opens avatar picker modal (overlay, closes with ESC and backdrop click).
- Modal has two tabs: "Avatars" (4-column grid of free + premium with lock overlay) and "Custom photo" (upload/preview/delete). Changes applied optimistically in UI; avatar at top updates without reload.

#### `curl` Examples — Avatar

```bash
# List (requires session)
curl -s -b cookies.txt http://localhost:3000/api/avatar/list

# Select free seed
curl -s -b cookies.txt -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"seed":"luna"}' \
  http://localhost:3000/api/avatar/select
# 200: { "success": true, "avatar_url": ".../seed=luna&backgroundColor=c0aede" }

# Select premium seed without subscription
# 403: { "message": "این آواتار مخصوص کاربران دارای اشتراک فعال است" }
# (This avatar is for users with an active subscription)

# Upload custom photo (requires active subscription)
curl -s -b cookies.txt -X POST \
  -F "photo=@/path/to/me.jpg" \
  http://localhost:3000/api/avatar/upload
# 200: { "success": true, "avatar_url": "/uploads/avatars/avatar_42_1718099999000.jpg" }

# Delete custom photo
curl -s -b cookies.txt -X DELETE http://localhost:3000/api/avatar/custom
# 200: { "success": true, "avatar_url": ".../seed=aria&backgroundColor=b6e3f4" }
```

### New/Modified Files in This Phase

**New**
- `server/utils/avatarHelper.js`
- `server/controllers/avatarController.js`
- `server/routes/avatar.js`
- `public/css/avatar.css`
- `public/js/avatar.js`
- Folder `server/uploads/avatars/` created on first upload

**Modified (extension only)**
- `server/db/appDb.js` — 4 new avatar columns on `users`
- `server/controllers/subscriptionController.js` — `checkAndRevertExpiredSubscriptions()`
- `server/controllers/profileController.js` — adds `avatar_url` (+ avatar_type/seed) to `GET /api/profile` and real-time expiry check
- `server/index.js` — mounts `/api/avatar`, startup sweep and `setInterval` every 60 minutes
- `server/swagger/swaggerConfig.js` — **Avatar** tag + docs for 4 endpoints
- `public/profile.html` and `public/js/profile.js` — replaces initials with `<img>` and triggers `AvatarPicker`

---

## Phase 3-C — Referral / Invite System

Dakhlyar's invite system lets users share their personal code (`DKHL-{userId}`) with friends; both parties benefit from subscription discounts.

### Discount Rules

| Inviter plan | Inviter % (each successful purchase) | Invitee % (one-time) | Invitee window |
|--------------|--------------------------------------|----------------------|----------------|
| Silver | 1% — no expiry | 2% | 10 days from signup |
| Gold | 2% — no expiry | 5% | 10 days from signup |
| Diamond | 5% — no expiry | 10% | 10 days from signup |
| No subscription | 0% (relationship still recorded) | 0% | — |

- Inviter cap: max **5 successful invites** for earning discount; after that relationships are recorded but no additional discount.
- Inviter accumulated discount applies to **their next purchase** (up to 50% cap).
- Invitee discount is active only if inviter had active subscription at signup time and invitee purchases within first 10 days after signup.
- On admin subscription approval, `final_price = price × (1 - discount/100)` is calculated and stored in `subscription_requests.final_price`.

### Schema Changes

New columns on `users`:

| Column | Type | Description |
|--------|------|-------------|
| `referred_by_code` | TEXT | Invite code used at signup (NULL = no referral) |
| `referral_discount_count` | INTEGER | Count of successful invites that earned discount (cap 5) |

New column on `subscription_requests`:

| Column | Type | Description |
|--------|------|-------------|
| `final_price` | INTEGER | Final price after discount (NULL = no discount, price = `price`) |

New tables:

```sql
CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_user_id INTEGER NOT NULL,
  invitee_user_id INTEGER UNIQUE NOT NULL,
  invite_code TEXT NOT NULL,
  inviter_plan_at_signup TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referral_discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL,            -- 'inviter' | 'invitee'
  discount_percent REAL NOT NULL,
  referral_id INTEGER NOT NULL,
  triggered_by_subscription_request_id INTEGER,
  is_used INTEGER DEFAULT 0,
  used_at TEXT,
  expires_at TEXT,                 -- NULL for inviter, 10-day date for invitee
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

All migrations are idempotent — re-running the server on an existing database is safe.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/referral/validate/:code` | public | Validate code + return masked inviter name |
| POST | `/api/referral/apply` | public | Apply invite code after register (before login) |
| GET | `/api/referral/discount` | session | Active invitee discount (if any) |
| GET | `/api/referral/my-invites` | session | Inviter panel + list of invitees |
| GET | `/api/admin/referrals` | admin | List all referral relationships (masked name/mobile) |
| GET | `/api/admin/referrals/stats` | admin | Global stats + top 10 inviters |

`GET /api/subscription/plans` for logged-in users now includes `discount_percent` and `final_price` on each plan, plus root keys `discount` and `pending_inviter_discount_percent`.

`GET /api/subscription/status` adds new key `pending_inviter_discounts` (unused accumulated inviter discount percent).

`POST /api/auth/register` returns additional field `user_id` so signup wizard can immediately call `POST /api/referral/apply`.

### Sample Calls

```bash
# Validate invite code before signup
curl http://localhost:3000/api/referral/validate/DKHL-42

# Apply invite code after register (with user_id from register response)
curl -X POST http://localhost:3000/api/referral/apply \
  -H "Content-Type: application/json" \
  -d '{"invitee_user_id": 99, "invite_code": "DKHL-42"}'

# Get active user discount (requires session)
curl -b cookies.txt http://localhost:3000/api/referral/discount

# Inviter panel
curl -b cookies.txt http://localhost:3000/api/referral/my-invites
```

### Client Behavior

- On **signup (Step 1)** an optional "Invite code" field was added. On `blur` the code is sent to the server; if valid, inviter name shown with green check below field. Code is sent to `/api/referral/apply` after register only if valid.
- In **Profile → Subscription**, if user has active invite discount or accumulated discount, plan cards show strikethrough original price and final price plus "X% discount" badge.
- In **Profile → Invite friends**, stats (invite count, discounts earned out of 5, accumulated discount) and list of invitees with masked names. Share button uses Web Share API; falls back to clipboard.

### New/Modified Files

**New:**
- `server/utils/discountHelper.js` — discount logic core (`processReferralOnSubscriptionApproval`, `applyInviterDiscountsToOwnPurchase`, …)
- `server/controllers/referralController.js`
- `server/routes/referral.js`

**Extended:**
- `server/db/appDb.js` — migration for new tables and Phase 3-C columns
- `server/controllers/adminReviewController.js` — calls `processReferralOnSubscriptionApproval` on subscription approval
- `server/controllers/subscriptionController.js` — exposes `discount` and `final_price` in `/plans` and `/status`
- `server/controllers/authController.js` — adds `user_id` to register response
- `server/index.js` — mounts `/api/referral` and admin endpoints
- `server/swagger/swaggerConfig.js` — full Persian docs for 6 new routes
- `public/signup.html` + `public/js/signup.js` — optional invite code field
- `public/profile.html` + `public/js/profile.js` + `public/css/profile.css` — discount display and inviter panel

---

## Phase 3-D — Messages System

The old notification system (`notifications`) is fully replaced by a rich **inbox** called `messages`. On startup migration, table `notifications` is dropped with `DROP TABLE IF EXISTS notifications`.

### Schema

```sql
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,           -- verification_request | verification_result |
                                       -- subscription_request | subscription_result |
                                       -- subscription_expiry_warning | subscription_expired |
                                       -- admin_broadcast | admin_direct | referral
  related_id  INTEGER DEFAULT NULL,    -- request id for upsert request↔result
  is_read     INTEGER DEFAULT 0,
  read_at     TEXT DEFAULT NULL,
  expires_at  TEXT DEFAULT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_user_id      ON messages(user_id);
CREATE INDEX idx_messages_type_related ON messages(type, related_id);
```

New user column: `users.first_login_message_sent INTEGER DEFAULT 0` (for welcome message).

### Display Rules (in SELECT)

1) Only messages for the same user  
2) Read messages whose `read_at` is more than 7 days ago are hidden  
3) Any read message older than 2 months is hidden  
4) Expired messages are shown but automatically marked read so the 7-day rule applies from expiry time (not creation time)

### Auto-expire (Hourly + inline)

Function `autoExpireMessages()` runs in hourly server `setInterval` and at the start of `GET /api/messages`:

```sql
UPDATE messages SET is_read=1, read_at=datetime('now')
WHERE expires_at IS NOT NULL AND expires_at < datetime('now') AND is_read=0;
```

### Upsert (request → result, no duplicates)

When admin approves/rejects a request (verification/subscription), instead of inserting a new message, **the same request message for that `related_id` is updated** (`type`, `title`, `body`, `expires_at`, `is_read=0`). If the request message was already cleaned up (7-day cleanup), a new message is INSERTed.

```js
messages.upsertResultMessage({
  userId, relatedId, requestType: 'subscription_request',
  resultType: 'subscription_result',
  title: 'اشتراک طلایی فعال شد ✓',
  body:  'اشتراک طلایی شما با موفقیت فعال شد...',
  expiresAt: new Date(Date.now() + 7*24*60*60*1000),
});
```

### Automatic Messages (with Dedup)

- **Subscription expiring soon** — in three windows (10, 5, 1 days) with dedup based on `body LIKE '%N روز%'` in past 2 days
- **Subscription expired** — together with `checkAndRevertExpiredSubscriptions`
- **Referral discount expiring** — for invitee discounts in 3-day and 1-day windows
- **Welcome** — only on first successful login (with `users.first_login_message_sent = 1`)
- **"Your invite paid off"** — to inviter after successful `POST /api/referral/apply`
- **"Referral discount added"** — to inviter after successful invitee purchase; cap-aware text (5/5 → reached cap message)

### User API (`/api/messages`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/messages` | List + `unread_count` + Persian `time_ago` |
| `PATCH` | `/api/messages/:id/read` | Mark one message read |
| `PATCH` | `/api/messages/read-all` | Mark all unread (`updated_count`) |
| `DELETE` | `/api/messages/:id` | Delete — read messages only |

### Admin API (`/api/admin/messages`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/messages/send` | `{target:'all'|'user', user_id?, title, body, expires_at}` — `expires_at` required and must be future |
| `GET` | `/api/admin/messages` | List of admin-sent messages with `target` and `user_id` filters |

### Sample `curl`

```bash
# user — list
curl -i -b cookies.txt http://localhost:3000/api/messages
# 200: { "messages":[ { "id":42, "title":"...", "type":"subscription_result", "time_ago":"۲ ساعت پیش", ...} ], "unread_count":1 }

# admin — broadcast to all
curl -i -b cookies.txt -X POST http://localhost:3000/api/admin/messages/send \
  -H 'Content-Type: application/json' \
  -d '{"target":"all","title":"اطلاعیه","body":"به‌روزرسانی نسخه ۲.۰","expires_at":"2026-12-31T23:59:00.000Z"}'
# 200: { "success": true, "sent_count": 142, "message": "پیام با موفقیت برای ۱۴۲ کاربر ارسال شد" }
# (Message successfully sent to 142 users)
```

### New/Deleted Files

**New:**
- `server/utils/timeHelper.js` — `persianTimeAgo`, `toPersianDigits`, `jalaliDate`
- `server/controllers/messagesController.js` — endpoints + `insertMessage` / `insertDedupedMessage` / `upsertResultMessage` / `autoExpireMessages` helpers
- `server/routes/messages.js`
- `public/messages.html` + `public/js/messages.js` + `public/css/messages.css`

**Deleted:**
- `server/routes/notifications.js`
- `server/controllers/notificationsController.js`
- `public/notifications.html`
- `public/js/notifications.js`

**Extended:**
- `server/db/appDb.js` — `messages` + indexes + `users.first_login_message_sent` + DROP `notifications`
- `server/controllers/authController.js` — welcome message on first login
- `server/controllers/verificationController.js` — inserts `verification_request` message on request submit
- `server/controllers/subscriptionController.js` — inserts `subscription_request`; `sendUpcomingExpiryWarnings()` (10/5/1 day windows with dedup); `subscription_expired` message in `checkAndRevertExpiredSubscriptions`
- `server/controllers/adminReviewController.js` — `upsertResultMessage` on verification/subscription approve/reject
- `server/controllers/referralController.js` — "invite succeeded" message for inviter after `applyReferral`
- `server/utils/discountHelper.js` — invitee/inviter discount messages (with cap message); `checkReferralDiscountExpiry()` for 3/1 day windows
- `server/index.js` — mounts `/api/messages` + `/api/admin/messages/*`, hourly scheduler includes `autoExpireMessages`, `sendUpcomingExpiryWarnings`, `checkReferralDiscountExpiry`
- `public/dashboard.html` + `public/js/dashboard.js` — bell links to `/messages.html` + badge from `/api/messages`
- `server/swagger/swaggerConfig.js` — full Persian docs for messages and admin messages

---


## Phase 3-E — Live Support (Goftino)

Live chat with Goftino using Dakhlyar's custom UX:

- Goftino widget with key from `GOFTINO_WIDGET_KEY` (exposed via `/api/config/public`) loads only in `profile.html`.
- **Goftino's default floating icon is never shown** (`setWidget({ hasIcon: false })`).
- Tapping "Online support" opens a fullscreen overlay with Dakhlyar green header and calls `Goftino.open()` so the iframe renders inside the overlay.
- User profile (name, mobile, email, avatar, verification level, subscription, metadata) is sent automatically via `Goftino.setUser({...})` (once, after `goftino_ready` and fetch from `/api/profile`).
- While overlay is closed, `goftino_getMessage` event increments a small green badge on the "Online support" row in profile (Persian digits).
- Closing from inside widget (`goftino_closeWidget`) and ✕ button both close the overlay.
- Overlay `z-index: 9000` is below `DakhlyarModal` (9999), so alert/confirm dialogs still appear on top.

### New/Extended Files

- New: `public/js/support-chat.js` (all logic in one self-contained file)
- Extended: `public/profile.html` (script bootstrap in `<head>`, overlay, script include, support button change, subview fallback)

---

## Phase 3-F — Web Push Notifications (No Third-Party Service)

Push notifications directly via standard Web Push Protocol (no Firebase / OneSignal). Uses `web-push` (server) + Service Worker + Push API + Notification API (browser).

### VAPID Keys

Generate once with this command and save in `.env`:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Then add to `.env`:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_MAILTO=mailto:support@dakhlyar.ir
```

> Never regenerate keys in production — all active browser subscriptions will be invalidated.

### Database Table (push_subscriptions)

```sql
CREATE TABLE push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT DEFAULT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used   TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
```

Expired subscriptions (410 or 404 from push service) are **deleted immediately** from the table.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/push/vapid-public-key` | public | Get VAPID public key |
| POST | `/api/push/subscribe` | login | Register/update subscription |
| DELETE | `/api/push/unsubscribe` | login | Remove subscription |

### Unique Push Tags (prevent duplicate messages)

| Event | tag |
|-------|-----|
| Verification result | `verification-result-{requestId}` |
| Subscription request result | `subscription-result-{requestId}` |
| 10-day expiry warning | `sub-expiry-10d-{userId}` |
| 5-day expiry warning | `sub-expiry-5d-{userId}` |
| 1-day expiry warning | `sub-expiry-1d-{userId}` (requireInteraction) |
| Subscription expired | `sub-expired-{userId}` |
| Admin broadcast message | `admin-broadcast-{messageId}` |
| Admin direct message | `admin-direct-{messageId}` |
| Referral signup | `referral-joined-{referralId}` |
| Invitee purchased | `referral-purchased-{referralId}` |

### Important Implementation Rules

- `public/sw.js` must be served from root path (`/sw.js`) so scope equals `/`.
- All push sends go through `pushHelper.sendPushAsync(userId, payload)` which internally queues with `setImmediate`; HTTP responses never wait for push delivery (fire-and-forget).
- If `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are empty in `.env`, server warns but all push calls become no-ops; rest of app works normally.
- Custom push permission banner (not native browser dialog) with Dakhlyar DLS design shown first time per session on `dashboard.html` / `profile.html` / `messages.html`.
- PWA icons generated once with script `server/scripts/generate-icons.js` (using `sharp`) from brand SVG, stored in `public/icons/`:

  ```bash
  node server/scripts/generate-icons.js
  ```

### New Files

- `server/utils/pushHelper.js` — push send layer (sendPushAsync / sendPushToAll / auto cleanup)
- `server/controllers/pushController.js` — `vapid-public-key`, `subscribe`, `unsubscribe`
- `server/routes/push.js` — `/api/push/*` routes
- `server/scripts/generate-icons.js` — one-time PWA icon + badge generation
- `public/sw.js` — Service Worker (push / notificationclick / pushsubscriptionchange)
- `public/js/push-init.js` — browser bootstrap + custom permission banner
- `public/manifest.json` — web app manifest
- `public/icons/icon-{72…512}.png` and `badge-72.png`

### Extended Files

- `server/db/appDb.js` — `push_subscriptions` table migration
- `server/index.js` — mounts `/api/push`
- `server/controllers/adminReviewController.js` — push for verification/subscription approve/reject
- `server/controllers/subscriptionController.js` — push for expiry and 10/5/1 day warnings
- `server/controllers/referralController.js` and `server/utils/discountHelper.js` — push for signup and invitee purchase
- `server/controllers/messagesController.js` — push for admin broadcast/direct messages
- `server/swagger/swaggerConfig.js` — new "Web Push" tag + docs for 3 endpoints
- All HTML pages — `<link rel="manifest">` and PWA meta tags; `push-init.js` loaded only on dashboard/profile/messages.

### Testing with curl

```bash
# 1) Public key
curl http://localhost:3000/api/push/vapid-public-key

# 2) Register a fake subscription (requires session — browser smoke test preferred)
curl -X POST http://localhost:3000/api/push/subscribe \
  -H 'Content-Type: application/json' \
  -b "connect.sid=…" \
  -d '{"endpoint":"https://example.com/x","keys":{"p256dh":"abc","auth":"xyz"}}'
```

---

## Phase 4 — Bottom Navigation + Page Structure + Transaction Categories

New app structure based on **fixed top header + fixed bottom nav + content cards in `.page-content`**. All user pages now share the same shell; Phase-4 classes (`.app-header`, `.page-content > .card`, `.section-title`, `.empty-state`, `.fab`) are defined in `public/css/style.css` and **scoped** inside the Phase-4 container so they don't conflict with auth/profile pages (still using legacy `.topbar` and `.card`).

### Bottom Navigation (6 tabs — RTL order)

| Tab | href | Icon | Lock |
|-----|------|------|------|
| Home | `/dashboard.html` | `ti-home` | — |
| Transactions | `/transactions.html` | `ti-arrows-exchange` | — |
| Reports | `/reports.html` | `ti-chart-bar` | — |
| Market | `/market.html` | `ti-trending-up` | — |
| Expert | `/expert.html` | `ti-bulb` | subscription only |
| Assets | `/assets.html` | `ti-wallet` | subscription only |

- Bottom nav injected dynamically by `public/js/bottom-nav.js` (inline styles; zero CSS conflicts).
- Subscription status checked with `GET /api/subscription/status`; if `is_active: true` lock is removed.
- Tap on locked tab → `DakhlyarModal.confirm` with title "دسترسی محدود" (Limited access) and redirect to `/profile.html#subscription`.

### Database (categories + category_requests)

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income','both')),
  is_default INTEGER DEFAULT 1,
  user_id INTEGER DEFAULT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income','both')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT DEFAULT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT DEFAULT NULL
);
```

On first startup, `categories` is seeded with 12 expense and 6 income default categories; never re-seeded.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories?type=expense\|income\|both` | login | Default + user custom categories |
| POST | `/api/categories/request` | login | Request new category (name<=30, hex color, valid type) |
| GET | `/api/categories/requests` | login | User's own request status |
| GET | `/api/admin/categories/requests` | admin | All requests + user info |
| PATCH | `/api/admin/categories/requests/:id` | admin | `{ action: 'approve'\|'reject', admin_note? }` |

Approval is atomic:
1. `INSERT INTO categories (… , user_id, is_default=0)`
2. `UPDATE category_requests SET status='approved'`
3. Send message to user ("Category «X» added to your list")

Rejection only changes status and sends a message with reason (if admin note provided).

### New Files

- `server/controllers/categoriesController.js`
- `server/routes/categories.js`
- `public/js/bottom-nav.js` — DakhlyarNav.init(activeTab)
- `public/js/app-common.js` — toPersianDigits + message badge refresh every 60 seconds
- `public/js/subscription-gate.js` — checkSubscriptionGate + showLockedScreen
- `public/transactions.html` — empty-state + FAB
- `public/reports.html` — empty-state
- `public/market.html` — empty-state
- `public/expert.html` — subscription-gated
- `public/assets.html` — subscription-gated

### Extended Files

- `server/db/appDb.js` — migration for two new tables + one-time default category seed
- `server/index.js` — mounts `/api/categories` + admin routes
- `server/swagger/swaggerConfig.js` — new tags "Categories" and "Category Management (Admin)" + 5 endpoints
- `public/dashboard.html` — migrated to app-header + page-content + DakhlyarNav.init('home')
- `public/css/style.css` — adds `--color-*` / `--radius-*` / `--shadow-*-4` tokens to `:root` and Phase-4 classes (scoped under `.app-header` and `.page-content`)

### Important Implementation Notes

- `bottom-nav.js` always loads **after** `modal.js` so modal is ready (for lock state).
- Phase-4 page bodies must have class `app-shell-body` for header/nav padding.
- Subscription checked client-side — server still applies gate on every API call.
- `category_requests` is not unique on `(user_id, lower(name))` but controller logic prevents multiple pending with same name.
- Default categories are never edited; user can only request new categories.

### Testing with curl

```bash
# List categories (requires login session)
curl -b cookie.txt 'http://localhost:3000/api/categories?type=expense'

# Request new category
curl -X POST -b cookie.txt -H 'Content-Type: application/json' \
  http://localhost:3000/api/categories/request \
  -d '{"name":"هزینه خودرو","icon":"🚙","color":"#1A5C3A","type":"expense"}'

# (admin) List requests
curl -b admin-cookie.txt http://localhost:3000/api/admin/categories/requests

# (admin) Approve
curl -X PATCH -b admin-cookie.txt -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/categories/requests/1 \
  -d '{"action":"approve","admin_note":"تبریک"}'
```

---

## Phase 5 — Transactions

This phase adds the financial core: create/edit/delete income and expense transactions, daily grouped list view, filter/search, monthly summary, tags, recurring transactions with reminders, and bulk CSV import.

### Key Concepts

- `amount` is always stored as a **positive integer in Toman**. Field `type` (`income` or `expense`) indicates direction.
- Currency: currently Toman only (`currency = 'IRR'`). Columns `amount_original`, `currency_original`, `exchange_rate` exist for future foreign currency support.
- Delete is **soft only (`is_deleted = 1`)** — no physical row deletion.
- Tags stored **denormalized in `transactions.tags`** (comma-separated) and simultaneously in `transaction_tags` with `usage_count`.
- Loan/installment/BNPL: no special type — use default "Loan & Credit" category (type=both); receiving loan = income, paying installment = expense.

### Database Changes (`server/db/appDb.js`)

Three new tables with idempotent migrations:

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'IRR',
  amount_original INTEGER, currency_original TEXT, exchange_rate INTEGER,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL, note TEXT, tags TEXT,
  transaction_date TEXT NOT NULL, transaction_time TEXT,
  is_recurring INTEGER DEFAULT 0,
  recurring_interval TEXT CHECK (recurring_interval IS NULL OR recurring_interval IN ('weekly','monthly','yearly')),
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_category  ON transactions(category_id);

CREATE TABLE IF NOT EXISTS transaction_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS recurring_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL,
  alert_sent_at TEXT,
  next_expected TEXT NOT NULL
);
```

Default category **"Loan & Credit"** (type=both, icon=🏦, color=#6366F1) added to seed; idempotently inserted on old databases too.

### New APIs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions` | List with filter/pagination + summary in same scope |
| GET | `/api/transactions/:id` | Single transaction details |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Partial edit |
| DELETE | `/api/transactions/:id` | Soft delete |
| POST | `/api/transactions/bulk-delete` | Soft delete multiple |
| POST | `/api/transactions/import` | Import **CSV or Excel** (multipart) — max 2 MB |
| GET | `/api/transactions/sample-csv` | Download sample file (UTF-8 BOM for Excel) |
| GET | `/api/transactions/tags` | User tags sorted by usage_count |
| GET | `/api/transactions/summary` | Monthly summary + top 3 expense categories + recurring subscriptions |
| GET | `/api/transactions/recurring` | Recurring transactions with next_expected |

All endpoints require session (401 for guest, 403 for another user's row).

### Validation Rules (POST/PATCH)

- `type` ∈ `{income, expense}`
- `amount > 0` and `amount ≤ 999,999,999,999`
- `title` up to 60 chars, `note` up to 500, `tags` up to 5 items each max 20 chars
- Category type must match transaction type (`both` means either)
- `is_recurring=true` → `recurring_interval` required
- `transaction_date` as `YYYY-MM-DD` — both Gregorian and Jalali accepted (auto-detect with year < 2000)

### Sample CSV File (`sample/transactions_sample.csv`)

With Persian headers:

```
نوع,عنوان,مبلغ (تومان),دسته‌بندی,تاریخ (YYYY-MM-DD),یادداشت,تگ‌ها,تکراری
هزینه,ناهار رستوران,185000,خوراک و رستوران,1404-03-01,با همکاران,کاری,خیر
هزینه,اشتراک نتفلیکس,120000,اشتراک‌های دیجیتال,1404-03-01,,سرگرمی,بله
درآمد,حقوق اردیبهشت,15000000,حقوق,1404-03-01,حقوق ماه اردیبهشت,,خیر
```

Import rules:
- `نوع` = `هزینه` (expense) or `درآمد` (income)
- `تاریخ` can be Jalali or Gregorian; server converts to Gregorian
- `دسته‌بندی`: case-insensitive match — if not found, fallback to "Miscellaneous" and add to warnings
- `تکراری` = `بله` (default monthly recurring) or `خیر`
- Invalid rows returned in `errors` but **never 500** — always 200 with summary

### Recurring Transactions & Budget Reminder (`server/utils/recurringHelper.js`)

- `calculateNextDate(date, interval)` — add weekly/monthly/yearly with end-of-month day clamp.
- `checkRecurringTransactions()` — scans `recurring_alerts` where `next_expected ≤ today` and `alert_sent_at` not set today — sends "recurring transaction reminder" message, push, and updates `next_expected` with next interval. Registered in hourly scheduler in `server/index.js` (internal dedup → safe hourly).
- `checkBudgetAlert(userId, categoryId, month)` — called after every POST/PATCH. If `budgets` table (Phase 6) doesn't exist, **silently skips** — no error thrown.

### Frontend Helpers

- `public/js/jalali.js` — inline jalaali-js algorithm, no CDN. Functions `toJalali`, `toGregorian`, `todayJalali`, `jalaliToStr`, `persianMonthName`, `persianDayName`, `formatJalaliFromGregorian`, `jStrFromGregorian`, `gStrFromJalali`, `formatJalaliShort`, `toPersian`, `withSeparators`.
- `public/js/app-common.js` (added): `formatToman(n)` and `formatTomanShort(n)` (K/million/billion).
- `public/css/transactions.css` — full transactions page styles, bottom sheets, category grid, tag pills, toggle, FAB.

### Transactions Page (`public/transactions.html` + `public/js/transactions.js`)

- App shell header + Sticky Summary (income/expense/balance for current month).
- List grouped by Jalali day, infinite scroll with "Load more" button.
- Bottom-left FAB → Add bottom sheet (type toggle, big amount input with live format, category grid filtered by type, title/note with counters, Jalali date with pretty preview, tag input with suggestions, recurring toggle with interval chips).
- Tap item → Details bottom sheet with edit / delete (with `DakhlyarModal.confirm`).
- Filter bottom sheet (type, date range, category, search).
- Import bottom sheet (download sample + file upload + imported/failed/errors/warnings display).

### Sample `curl`

```bash
# 1. Login → get session cookie
curl -c jar.txt -H 'Content-Type: application/json' \
  -d '{"mobile":"09120000005","password":"Smoke@1234"}' \
  http://localhost:3000/api/auth/login

# 2. Create expense transaction
curl -b jar.txt -X POST -H 'Content-Type: application/json' \
  -d '{"type":"expense","amount":185000,"category_id":1,
       "title":"ناهار","transaction_date":"1404-03-15","tags":["کاری"]}' \
  http://localhost:3000/api/transactions

# 3. Current month summary
curl -b jar.txt http://localhost:3000/api/transactions/summary

# 4. Import CSV
curl -b jar.txt -F "file=@sample/transactions_sample.csv;type=text/csv" \
  http://localhost:3000/api/transactions/import
```

### New Files This Phase

- `server/routes/transactions.js`
- `server/controllers/transactionsController.js`
- `server/utils/recurringHelper.js`
- `sample/transactions_sample.csv`
- `public/js/jalali.js`
- `public/css/transactions.css`

### Modified Files (allowed in spec)

- `server/db/appDb.js` — migrations + new category seed
- `server/index.js` — mount route + serve `/sample` + scheduler hook
- `public/js/app-common.js` — adds `formatToman`, `formatTomanShort`
- `public/transactions.html` — full UI (built on Phase 4 shell)
- `server/swagger/swaggerConfig.js` — Persian docs for all new endpoints
- `package.json` — adds `jalaali-js`, `papaparse`, `xlsx`

### Responsive Behavior

Bottom sheets slide up from bottom only on mobile (`< 768px`); on desktop (`≥ 768px`) they automatically become **centered modals** (max-width 520px, rounded corners, fade-in). All sheet buttons (confirm, delete, filter, import) use DLS class `dk-sheet-btn primary|secondary|danger` aligned with global Modal buttons (height 48, radius 14, primary/danger colors, accent focus).

---


## Phase 6 — Budgets, Reports, Comparison & Export

This phase adds monthly budgeting, analytical reports, financial score gamification, and CSV/PDF export.

### Database Changes

- `budgets` — monthly budget per category (UNIQUE on user+category+month)
- `financial_scores` — monthly financial score cache (breakdown as JSON)

### Budget API (`/api/budgets`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/budgets?month=YYYY-MM` | Budget list + spent/remaining/status |
| POST | `/api/budgets` | Upsert budget for one category |
| POST | `/api/budgets/bulk` | Upsert multiple budgets |
| DELETE | `/api/budgets/:id` | Delete budget |
| GET | `/api/budgets/zbb?month=` | Zero-based budgeting status |
| POST | `/api/budgets/copy-from-last-month` | Copy from previous month |

Budget alerts (80% and 100%) via `checkBudgetAlert` in `recurringHelper.js` send message + push.

### Reports API (`/api/reports`)

- `GET /monthly` — monthly report (income/expense/daily_totals)
- `GET /comparison` — 3–6 month comparison
- `GET /weekly-pattern` — spending pattern by day of week
- `GET /cash-flow-forecast` — end-of-month forecast
- `GET /net-worth-snapshot` — 12-month cumulative balance
- `GET /subscription-tracker` — monthly recurring subscriptions
- `GET /score` — financial score 0–100
- `GET /export/csv?month=` — CSV download (Jalali dates)
- `GET /export/pdf?month=` — PDF download (Vazirmatn font)

### Reports Page (`/reports.html`)

8 sections: financial score (SVG arc), summary, expense donut, monthly comparison, weekly pattern, forecast, subscriptions, export. "Set budget" button opens budget management sheet (`budget.js`).

### Charts

`public/js/charts.js` — pure SVG (no Chart.js): donut, bar, score arc, week bars.

### Export

```bash
# Current month CSV (requires session cookie)
curl -b cookies.txt -OJ "http://localhost:3000/api/reports/export/csv?month=2025-06"

# Monthly report PDF
curl -b cookies.txt -OJ "http://localhost:3000/api/reports/export/pdf?month=2025-06"
```

PDF fonts: `server/fonts/Vazirmatn-Regular.ttf` and `Vazirmatn-Bold.ttf`

---

## Phase 7 — Savings Goals + ZBB + Forecast

### New Tables

- `savings_goals` — financial goals (title, target_amount, saved_amount, deadline, …)
- `goal_contributions` — deposit/withdrawal history per goal

### Goals API (`/api/goals`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/goals?include_completed=` | Goal list + percentage + monthly_needed |
| POST | `/api/goals` | Create new goal |
| PATCH | `/api/goals/:id` | Edit goal |
| DELETE | `/api/goals/:id` | Delete goal + contributions |
| POST | `/api/goals/:id/contribute` | Deposit — on completion, message "Goal completed 🎉" |
| POST | `/api/goals/:id/withdraw` | Withdraw |
| GET | `/api/goals/:id/history` | Deposit/withdrawal history |

`saved_amount` always updated via contribute/withdraw (not computed from contributions on read).

### Goals Page (`/goals.html`)

- Overall progress summary card
- Cash-flow forecast widget (`GET /api/reports/cash-flow-forecast`)
- Zero-based budgeting widget (`GET /api/budgets/zbb`) + link to `/reports.html#budget`
- Goal list with progress bar, deposit/withdraw, history
- Add/edit goal sheet (emoji, color, Jalali date)

### Dashboard

"Savings goals" shortcut card in `dashboard.html` — active goal count + progress percent → `/goals.html`

---

## Phase 8 — Market View (BrsApi.ir)

### API Key Setup

Add BrsApi key to `.env` (server-side only — never in frontend):

```env
BRSAPI_KEY=your_brsapi_key_here
```

Get key from [BrsApi.ir](https://brsapi.ir). Without this key, market API returns `503`.

### Tables

- `market_cache` — 15-minute public data cache (shared across all users)
- `market_favorites` — per-user favorites and pins

### API (`/api/market`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/gold-currency` | Gold, coins, currency |
| GET | `/crypto` | Cryptocurrency |
| GET | `/commodity` | Commodities |
| GET | `/all` | All categories at once |
| GET/POST | `/favorites` | Favorites |
| DELETE | `/favorites/:symbol?category=` | Remove |
| PATCH | `/favorites/:symbol/pin` | Pin/unpin |

Query `?force=true` — force refresh (max once per minute per IP).

### Page `/market.html`

Tabs: Gold & Currency | Crypto | Commodity | Favorites — search, 2-column cards, ⭐ favorite, auto-refresh every 15 minutes.

---

## Phase 9 — Assets

Manual tracking of personal assets (gold, coins, currency, crypto, property, …) and **approximate value** based on market prices (Phase 8 cache) or user manual price. **Requires active subscription** (server-side and UX via `subscription-gate.js`).

### Tables (`dakhlyar_app.db`)

| Table | Description |
|-------|-------------|
| `assets` | Per-user registered assets (soft delete with `is_active=0`) |
| `asset_snapshots` | daily total value snapshot + JSON details |

### Asset Types

Fixed definition in `server/utils/assetPriceHelper.js` (`ASSET_TYPES`) — 14 auto-priced types (from `market_cache`) + 7 manual-priced types.

### API (`/api/assets`)

| Method | Path | Subscription | Description |
|--------|------|--------------|-------------|
| GET | `/types` | No | List of registerable types |
| GET | `/` | Yes | Asset list + `total_value` + grouping |
| POST | `/` | Yes | Add asset |
| PATCH | `/:id` | Yes | Edit |
| DELETE | `/:id` | Yes | Soft delete |
| GET | `/history?days=30` | Yes | Snapshot history |
| GET | `/net-worth` | Yes | Net worth summary |

### Page `/assets.html`

- Hero card total value (~ prefix)
- Risk filter: All | Safe | Risk-free | Risky
- Add/edit sheet with asset type grid + live preview
- Asset composition sheet (donut chart)
- 7/30 day history

---

## Phase 10 — Expert Recommendations

Admin publishes financial recommendations; users with **active subscription** view them and record status (pending / done / dismissed).

### Tables

| Table | Description |
|-------|-------------|
| `expert_recommendations` | Published recommendations (action or alert) |
| `user_recommendation_status` | Per-user status (default: pending) |

### User API (`/api/expert`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recommendations` | List + counts |
| GET | `/recommendations/:id` | Details |
| PATCH | `/recommendations/:id/status` | pending / done / dismissed |

### Admin API (`/api/admin/expert`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recommendations` | List + user status stats |
| POST | `/recommendations` | Create + push + in-app message |
| PATCH | `/recommendations/:id` | Edit / deactivate |
| DELETE | `/recommendations/:id` | Full delete |

### Page `/expert.html`

- Stats pending / done / dismissed
- Filter: active only | all / action / alert
- Cards with priority border + status badge
- Details sheet — status buttons only for type=action

---

## Phase 11 — Financial Score + Behavioral Insights + Home Dashboard

Placeholder dashboard replaced with full home page; dedicated financial score page (`/score.html`) and two new endpoints for score history and behavioral insights added.

### New API (`/api/reports`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/score/history?months=6` | Score history (max 12 months) + `best_month` + `avg_score` + `trend` |
| GET | `/insights?months=3` | 6 insight types: peak_day, category_trend, savings_rate, subscriptions, budget_adherence, logging_streak |

### Page `/dashboard.html`

10 sections: hero total value (net-worth or transaction balance), quick actions, promo banner (Phase 13 placeholder), monthly summary + mini chart, score widget, market ticker (refresh every 5 min), last 5 transactions, goal progress, one random insight.

- Parallel load with `Promise.allSettled` — one section failing doesn't stop others
- Amount hiding with eye icon (`sessionStorage`)
- Without subscription: hero shows transaction balance only + subscribe note

### Page `/score.html`

- Large SVG arc (200px) + label
- 6-month bar chart + trend line
- 5 score breakdown cards (from `breakdown`)
- Full insight list + improvement tips (`tips`)

### New Files

- `public/css/dashboard.css` — dashboard styles + skeleton pulse
- `public/css/score.css` — score page styles
- `public/js/dashboard.js` — dashboard load logic
- `public/js/score.js` — score page logic
- `public/score.html`

---

## Phase 12 — Split Bills (Deng o Dong)

**Deng o Dong** mini-app for group expense splitting inside Dakhlyar — no subscription required.

### Tables (`dakhlyar_app.db`)

| Table | Description |
|-------|-------------|
| `split_groups` | Group + `invite_token` for public link |
| `split_members` | Members (registered with `user_id` or guest with `mobile`) |
| `split_expenses` | Group expenses (soft delete) |
| `split_expense_shares` | Each member's share per expense |
| `split_settlements` | Completed settlements (+ optional `transaction_id`) |

### Settlement Algorithm

`server/utils/splitHelper.js` — `calculateBalances` + `calculateMinimumSettlements` (greedy min-cash-flow). Equal split: 1 Toman remainder goes to payer.

### API (`/api/split`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/public/:token?mobile=` | No | Public view for guest |
| GET | `/groups` | Yes | Group list + my balance |
| POST | `/groups` | Yes | Create group |
| GET | `/groups/:id` | Yes | Full details + suggested settlements |
| POST | `/groups/:id/members` | Yes | Add member (creator) |
| DELETE | `/groups/:id/members/:memberId` | Yes | Remove member |
| POST | `/groups/:id/expenses` | Yes | Add expense (equal/custom) |
| PATCH/DELETE | `/groups/:id/expenses/:expenseId` | Yes | Edit/delete |
| POST | `/groups/:id/settle` | Yes | Settle (+ optional transaction) |
| GET | `/lookup-mobile?mobile=` | Yes | Lookup Dakhlyar user |

### Pages

- `/split.html` — group list, details with Expenses/Settle/Members tabs, expense FAB
- `/split-view.html?token=…&member=…` — view debt without login
- Dashboard: "Deng o Dong" quick action

### Shareable Link

```
/split-view.html?token={invite_token}&member={mobile}
```

---

## Phase 13 — Promotional Banners

Admin uploads banners with start/end dates; dashboard shows rotating carousel. Without active banners, banner section stays hidden.

### Table (`dakhlyar_admin.db`)

| Table | Description |
|-------|-------------|
| `banners` | Image, link, date range, CTR, impression/click count |

### Public API (`/api/banners`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/active` | session | Active banners + impression (async) |
| POST | `/:id/click` | session | Record click (fire-and-forget) |

### Admin API (`/api/admin/banners`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List + status + ctr |
| GET | `/stats` | Overall stats |
| POST | `/` | Upload multipart (max 3MB) |
| PATCH | `/:id` | Edit (+ replace image) |
| DELETE | `/:id` | Delete file + record |

### Frontend

- `public/js/banner.js` — class `DakhlyarBanner` (carousel, swipe, dots, auto-advance 4s)
- `public/css/banner.css` — carousel styles
- Dashboard: `#dash-banner` div + fetch from `/api/banners/active`

---

## Phase 14-A — Admin Panel (Infrastructure + Auth)

Separate web panel at `/admin` with independent session (`dakhlyar_admin_sid`), database `dakhlyar_admin.db`, and dedicated HTML/CSS/JS files.

### Access

1. Browser: `http://localhost:3000/admin` (redirects to login)
2. Default login: **admin** / **admin** (forced password change on first login)
3. After login: dashboard at `/admin/dashboard.html`

### `.env` Variable

```env
ADMIN_SESSION_SECRET=your_admin_session_secret_here
```

If not set, falls back to `SESSION_SECRET`.

### Tables (`dakhlyar_admin.db`)

| Table | Description |
|-------|-------------|
| `admins` | Admin accounts (+ `must_change_password`, `last_login`) |
| `admin_sessions` | Session tokens (future) |
| `admin_activity_log` | Login/logout and management action log |

### Auth API (`/api/admin/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | — | Login + create session |
| POST | `/logout` | admin | Logout |
| GET | `/me` | admin | Current admin info |
| POST | `/change-password` | admin | Change password (skip current if must_change) |

### Admin Management API (`/api/admin/admins`) — superadmin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List admins |
| POST | `/` | Add admin |
| PATCH | `/:id` | Edit email/role/is_active |
| DELETE | `/:id` | Delete (keep at least one superadmin) |

### Frontend

```
public/admin/
├── login.html, dashboard.html, admins.html (+ shell pages)
├── css/admin-base.css, admin-login.css
└── js/admin-api.js, admin-layout.js, admin-login.js
```

### Sample Login (curl)

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'

curl -b cookies.txt http://localhost:3000/api/admin/auth/me
```

---

## Phase 14-B — Admin Dashboard + Stats

Full dashboard with KPIs, SVG charts, pending requests, banner stats, and activity log.

### Stats API (`/api/admin/stats`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | KPI — users, verification, subscription, transactions, banners, goals |
| GET | `/growth` | 6-month growth — users, subscriptions, transactions |
| GET | `/subscription-revenue?months=6` | Monthly subscription revenue/count |
| GET | `/top-categories` | Most-used categories |
| GET | `/pending-verifications` | 5 pending verification requests (dashboard) |
| GET | `/pending-subscriptions` | 5 pending subscription requests |
| GET | `/banners` | Banner stats table |

### Activity Log

```
GET /api/admin/activity-log?page=1&limit=20&admin_id=
```

### Frontend

- `public/admin/dashboard.html` — full dashboard
- `public/admin/css/admin-dashboard.css`
- `public/admin/js/admin-charts.js` — SVG charts (bar, donut, line)
- `public/admin/js/admin-dashboard.js` — fetch + render + KPI refresh every 5 minutes

### Notes

- Stats read from **appDb** (users/transactions) + **adminDb** (banners)
- `total_impressions_today` / `total_clicks_today` currently 0 (daily tracking not implemented)
- `revenue_this_month` calculated from approved `subscription_requests`
- Inline approve/reject from `/api/admin/stats/pending-*` (with new admin session)

---

## Phase 14-C — User Management

Full page `/admin/users.html` with 3 tabs: All Users | Verification | Subscription.

### Users API (`/api/admin/users`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List + filter + pagination |
| GET | `/search?mobile=` | Quick mobile search |
| GET | `/:id` | Full details + stats + requests |
| PATCH | `/:id/reset-stories` | Reset stories for one user |
| POST | `/reset-stories-all` | Reset stories for all users |

### Verification API (`/api/admin/verification`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/requests` | Request list (status, page) |
| PATCH | `/requests/:id` | `{ action: approve\|reject, admin_note? }` |

### Subscription API (`/api/admin/subscription`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/requests` | Request list |
| PATCH | `/requests/:id` | Approve/reject + referral hook |

### Frontend

- `public/admin/users.html` — 3 tabs + details modal + bulk actions
- `public/admin/css/admin-users.css`
- `public/admin/js/admin-users.js`

### Notes

- Quick mobile search at top of page — opens details modal directly
- Tabs via `?tab=users|verification|subscription`
- Approve/reject: logged in `admin_activity_log` + user message (Phase 3-D)
- Route `/api/admin/admins` for admin account management (separate from users)

---

## Phase 14-D — Content Management (Admin Panel)

### Pages

| Page | Path | Description |
|------|------|-------------|
| Stories | `/admin/stories.html` | Upload, drag-and-drop order, active/inactive, delete, reset for all users |
| Banners | `/admin/banners.html` | Banner CRUD, CTR stats, scheduling |
| Recommendations | `/admin/recommendations.html` | Create/edit expert recommendation + push to subscribers |
| Categories | `/admin/categories.html` | Approve/reject user requests + manage default categories |

### New Files

```
public/admin/css/admin-content.css
public/admin/js/admin-stories.js
public/admin/js/admin-banners.js
public/admin/js/admin-recommendations.js
public/admin/js/admin-categories.js
server/routes/admin/adminBanners.js
server/routes/admin/adminRecommendations.js
server/routes/admin/adminCategories.js
server/controllers/admin/adminRecommendationsController.js
server/controllers/admin/adminCategoriesController.js
```

### API (admin session — `dakhlyar_admin_sid`)

| Path | Operations |
|------|------------|
| `GET/PATCH/DELETE /api/admin/stories` | List, edit, delete story |
| `POST /api/admin/stories/upload` | Upload story |
| `POST /api/admin/stories/reset-for-users` | Reset has_seen_stories |
| `GET/POST/PATCH/DELETE /api/admin/banners` | Banner CRUD + `GET .../stats` |
| `GET/POST/PATCH/DELETE /api/admin/expert/recommendations` | Recommendation CRUD |
| `GET .../recommendations/subscriber-count` | Active subscriber count |
| `GET .../recommendations/:id/stats` | pending/done/dismissed stats |
| `GET/PATCH /api/admin/categories/requests` | User category requests |
| `GET/POST/PATCH /api/admin/categories/defaults` | Default categories |

### Notes

- Story order: HTML5 drag-and-drop — separate PATCH for each changed story
- Category request approval: creates category **only for requesting user_id** (not global default)
- All write operations logged in `admin_activity_log`
- Legacy dev routes (`req.session.isAdmin`) for stories/banners/expert/categories separated from `index.js`

---


## Phase 14-E — Messaging (Admin Panel)

### Page

`/admin/messages.html` — two tabs: **Send Message** | **History**

Send tab has sub-tabs: **Broadcast (all users)** | **Bulk from file (Excel/CSV)** | **Direct (one user)** | **Expert recommendation** | **Bulk expert from file (Excel/CSV)**

### Features

- Group message to all users (mandatory confirmation)
- Direct message to one user (mobile search)
- **Bulk message from Excel/CSV file** — parse mobiles, match registered users, send to `mobile_list` target
- Send expert recommendation to all subscribers or one user
- **Bulk expert send from Excel/CSV file** — same parse flow; users without active subscription are skipped
- History with read rate, type/period filter, pagination
- Live message preview + progress/success modal

---

### Excel/CSV Bulk Import — Overview

Both bulk flows share the same server-side parser in `server/utils/mobileImportHelper.js` and the same UI helper `parseMobileFile()` in `public/admin/js/admin-messages.js`.

**Supported formats:** `.csv`, `.xlsx`, `.xls`  
**Max file size:** 2 MB (multer limit in `server/routes/admin/adminMessaging.js`)  
**Mobile column detection:** auto-detects header from whitelist (case-insensitive):

| English headers | Persian headers |
|-----------------|-----------------|
| `mobile`, `phone`, `tel`, `cell` | `موبایل`, `شماره موبایل`, `شماره`, `تلفن`, `موبایل کاربر` |

If no known header matches, the **first column** is used.

**Mobile normalization** (`normalizeMobile`):
- Persian/Arabic digits converted to ASCII
- Non-digits stripped
- `98XXXXXXXXXX` (12 digits) → `0XXXXXXXXXX`
- 10-digit starting with `9` → prefixed with `0`
- Valid result must match `/^09[0-9]{9}$/`
- Duplicate mobiles in file are deduplicated (first occurrence kept)

**User matching:** normalized mobiles looked up in `users.mobile`; returns matched user IDs for send endpoints.

---

### Parse Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/messages/parse-mobiles` | Parse file for bulk **message** send |
| POST | `/api/admin/expert/parse-mobiles` | Parse file for bulk **expert recommendation** send |

Both require admin session (`dakhlyar_admin_sid`). Request: `multipart/form-data` with field `file`.

**Success response (200):**

```json
{
  "total_rows": 150,
  "unique_mobiles": 142,
  "invalid_rows": 3,
  "invalid_samples": ["0912abc", "12345"],
  "matched_count": 120,
  "unmatched_count": 22,
  "unmatched_samples": ["09111111111", "09222222222"],
  "user_ids": [1, 5, 12, ...],
  "users": [
    { "id": 1, "mobile": "09121234567", "first_name": "...", "last_name": "..." }
  ]
}
```

**Error responses:**

| Status | Message (Persian) | English |
|--------|-------------------|---------|
| 400 | `فایل ارسال نشده است` | No file uploaded |
| 400 | `فرمت فایل نامعتبر است — فقط CSV یا Excel پذیرفته می‌شود` | Invalid format — CSV or Excel only |
| 400 | `فایل خالی است` | Empty file |
| 400 | `هیچ شیتی در فایل اکسل وجود ندارد` | No sheet in Excel file |
| 400 | `هیچ ردیف معتبری در فایل یافت نشد` | No valid rows in file |
| 413 | `حجم فایل بیش از ۲ مگابایت است` | File exceeds 2 MB |

**Sample curl — parse mobiles for bulk message:**

```bash
# Admin login first
curl -c admin-cookies.txt -X POST http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}'

# Parse Excel/CSV file
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/messages/parse-mobiles \
  -F "file=@/path/to/recipients.xlsx"
```

**Sample curl — parse mobiles for bulk expert send:**

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/expert/parse-mobiles \
  -F "file=@/path/to/subscribers.csv"
```

---

### Send with `target: mobile_list`

After parsing, frontend stores `user_ids` from the parse response and enables the send button. Send endpoints accept `target: "mobile_list"` with `user_ids` array.

#### Bulk message send

**Endpoint:** `POST /api/admin/messages/send`

```json
{
  "target": "mobile_list",
  "user_ids": [1, 5, 12, 42],
  "title": "اطلاعیه",
  "body": "متن پیام",
  "expires_at": "2026-12-31T23:59:00.000Z",
  "send_push": true
}
```

| Field | Rule |
|-------|------|
| `target` | Must be `"mobile_list"` |
| `user_ids` | Non-empty array of positive integers from parse step |
| `title` | Required, max 80 chars |
| `body` | Required, max 1000 chars |
| `expires_at` | Required ISO datetime in the future |
| `send_push` | Optional, default true |

**Success (200):**

```json
{
  "success": true,
  "sent_count": 120,
  "push_queued": true,
  "message": "پیام برای ۱۲۰ کاربر از فایل ارسال شد"
}
```

(Persian: "Message sent to 120 users from file")

**Errors:**

| Status | Message (Persian) | English |
|--------|-------------------|---------|
| 400 | `لیست کاربران خالی است — ابتدا فایل را بارگذاری کنید` | User list empty — upload and parse file first |
| 404 | `هیچ کاربر معتبری در لیست یافت نشد` | No valid users found in list |

Messages inserted as `admin_broadcast` type per matched user. Optional web push queued asynchronously.

**Sample curl:**

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/messages/send \
  -H 'Content-Type: application/json' \
  -d '{
    "target": "mobile_list",
    "user_ids": [1, 5, 12],
    "title": "اطلاعیه ویژه",
    "body": "این پیام فقط برای کاربران فایل ارسال می‌شود",
    "expires_at": "2026-12-31T23:59:00.000Z",
    "send_push": true
  }'
```

#### Bulk expert recommendation send

**Endpoint:** `POST /api/admin/expert/send`

```json
{
  "target": "mobile_list",
  "recommendation_id": 7,
  "user_ids": [1, 5, 12, 42]
}
```

| Field | Rule |
|-------|------|
| `target` | Must be `"mobile_list"` |
| `recommendation_id` | Required active recommendation ID |
| `user_ids` | Non-empty array from parse step |

For each user ID:
- Loads full user record
- **Skips users without active subscription** (`skipped_no_subscription` counter)
- Inserts `user_recommendation_status` (pending)
- Sends in-app system message + web push to `/expert.html`

**Success (200):**

```json
{
  "success": true,
  "sent_count": 95,
  "skipped_no_subscription": 25,
  "recommendation_title": "عنوان پیشنهاد",
  "message": "پیشنهاد برای ۹۵ کاربر از فایل ارسال شد"
}
```

(Persian: "Recommendation sent to 95 users from file")

**Sample curl:**

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/expert/send \
  -H 'Content-Type: application/json' \
  -d '{
    "target": "mobile_list",
    "recommendation_id": 7,
    "user_ids": [1, 5, 12]
  }'
```

---

### Other Send Targets (non-bulk)

#### Message send — all users

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/messages/send \
  -H 'Content-Type: application/json' \
  -d '{
    "target": "all",
    "title": "اطلاعیه",
    "body": "به‌روزرسانی نسخه ۲.۰",
    "expires_at": "2026-12-31T23:59:00.000Z",
    "send_push": true
  }'
# { "success": true, "sent_count": 142, "message": "پیام با موفقیت برای ۱۴۲ کاربر ارسال شد" }
# (Message successfully sent to 142 users)
```

#### Message send — direct to one user

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/messages/send \
  -H 'Content-Type: application/json' \
  -d '{
    "target": "user",
    "user_id": 42,
    "title": "پیام شخصی",
    "body": "متن پیام",
    "expires_at": "2026-12-31T23:59:00.000Z"
  }'
```

#### Expert send — all subscribers

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/expert/send \
  -H 'Content-Type: application/json' \
  -d '{"target": "all_subscribed", "recommendation_id": 7}'
```

#### Expert send — one user

```bash
curl -b admin-cookies.txt -X POST http://localhost:3000/api/admin/expert/send \
  -H 'Content-Type: application/json' \
  -d '{"target": "user", "recommendation_id": 7, "user_id": 42}'
```

---

### History & Stats API

| Path | Operations |
|------|------------|
| `POST /api/admin/messages/send` | Send message (`all` \| `user` \| `mobile_list`) + optional push |
| `GET /api/admin/messages/history` | History + read_rate + sent_by (query: `page`, `limit`, `target`, `period`) |
| `GET /api/admin/messages/stats` | Today/month totals + avg read rate |
| `POST /api/admin/expert/send` | Send recommendation (`all_subscribed` \| `user` \| `mobile_list`) |
| `GET /api/admin/expert/stats/:recommendationId` | Detailed recommendation stats (pending/done/dismissed + users_done) |

**History query params:**

| Param | Values |
|-------|--------|
| `target` | `broadcast` (all users), `user` / `direct` (direct messages), empty = all |
| `period` | `today`, `week`, `month`, `all` (default) |
| `page` | Page number (default 1) |
| `limit` | Page size (default 20, max 100) |

---

### Frontend Flow (`public/admin/js/admin-messages.js`)

#### Bulk message tab

1. Admin selects `.xlsx`, `.xls`, or `.csv` file (`#bulk-msg-file`)
2. Clicks **Parse file** (`#btn-bulk-msg-parse`) → `POST /api/admin/messages/parse-mobiles`
3. Result panel (`#bulk-msg-parse-result`) shows:
   - Green: matched count
   - Red (if any): unmatched count + sample mobiles
   - Muted: unique mobile count in file
4. Send button (`#btn-bulk-msg-send`) enabled only when `user_ids.length > 0`
5. On submit → confirmation dialog with recipient count → `POST /api/admin/messages/send` with `target: "mobile_list"`
6. Progress modal during send; success modal shows sent count and push status
7. Form reset clears file, user IDs, and parse result

#### Bulk expert tab

Same flow using:
- `#bulk-expert-file`, `#btn-bulk-expert-parse`, `#bulk-expert-parse-result`
- Endpoint: `POST /api/admin/expert/parse-mobiles`
- Send: `POST /api/admin/expert/send` with `target: "mobile_list"` + `#bulk-expert-rec-select` recommendation ID
- Success modal also shows `skipped_no_subscription` count if any users lacked active subscription

#### Shared `parseMobileFile()` helper

```js
async function parseMobileFile(fileInput, endpoint, resultEl, onParsed) {
  const fd = new FormData();
  fd.append('file', file);
  const data = await AdminAPI.upload(endpoint, fd);
  renderImportResult(resultEl, data);
  onParsed(data.user_ids || []);
}
```

Changing the file input resets stored IDs and disables send until re-parse.

---

### Sample Excel File Structure

**Sheet 1 (first sheet used for Excel):**

| mobile | name (optional, ignored) |
|--------|--------------------------|
| 09121234567 | Ali |
| 09131112233 | Sara |
| 989121234567 | (normalized to 09121234567) |

**CSV equivalent:**

```csv
mobile,name
09121234567,Ali
09131112233,Sara
```

Persian header example:

```csv
شماره موبایل,نام
09121234567,علی
09131112233,سارا
```

---

### New Files

```
server/utils/mobileImportHelper.js       ← CSV/Excel parse, normalize, user lookup
server/routes/admin/adminMessaging.js    ← multer upload + parse-mobiles routes
server/controllers/admin/adminMessagingController.js  ← sendMessage, sendExpert, parseMobiles
public/admin/messages.html               ← bulk message + bulk expert UI tabs
public/admin/css/admin-messaging.css
public/admin/js/admin-messages.js        ← parseMobileFile, bulk send forms
```

---

## Future Phases

- Payment gateway and automatic subscription activation after payment
- Bank accounts and automatic transaction sync

---

## License

MIT
