# Lalayi (لالایی)

Persian children's bedtime storytelling app. UI copy is in Farsi with RTL layout; code comments are in English.

## Features

- **Phone OTP login** — mock 4-digit verification for development
- **Child profiles** — name, Jalali birth date, age group (0–2, 3–5, 6–7)
- **Home dashboard** — child selection, then Calm or Interactive story modes
- **Calm Story** — library of 30 bedtime stories + custom Gemini-generated stories with ElevenLabs TTS
- **Interactive Story** — real-time voice conversation via Gemini Live API (WebSocket)
- **Parent voice cloning** — record and clone a voice with ElevenLabs for Calm mode playback

## Project structure

```
├── backend/                 Express API + WebSocket server
│   ├── src/
│   │   ├── routes/          REST endpoints
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/        Gemini, ElevenLabs, Live API
│   │   ├── ws/              Interactive story WebSocket
│   │   └── db/              SQLite schema + default stories
│   └── data/                SQLite database (created on first run)
├── frontend/                Vanilla JS + CSS (RTL, Vazirmatn)
│   ├── screens/
│   ├── components/
│   ├── api/
│   └── styles/
├── scripts/
│   └── seed-stories.js      Optional Gemini story regeneration
└── package.json             Root scripts → backend
```

## Prerequisites

- [Node.js](https://nodejs.org/) **18+** (20+ recommended for Gemini Live)
- npm
- API keys (see [Environment variables](#environment-variables)):
  - **Gemini** — custom stories + interactive mode ([Google AI Studio](https://aistudio.google.com/apikey))
  - **ElevenLabs** — text-to-speech and voice cloning ([ElevenLabs](https://elevenlabs.io))

## Quick start

### 1. Install dependencies

From the project root:

```bash
npm install --prefix backend
```

Or:

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=3001
JWT_SECRET=your-long-random-secret-here
DATABASE_PATH=./data/lalayi.db
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_DEFAULT_VOICE_ID=pNInz6obpgDQGcFmaJgB
```

| Variable | Required for | Description |
|----------|--------------|-------------|
| `JWT_SECRET` | Auth | Long random string for session tokens |
| `GEMINI_API_KEY` | Custom + Interactive stories | Google Gemini API key |
| `ELEVENLABS_API_KEY` | Calm audio + voice cloning | ElevenLabs API key |

Stories from the bundled library work without API keys. Custom stories, TTS, voice cloning, and interactive mode need the keys above.

### 3. Initialize database (optional)

Tables are created automatically on server start. To initialize manually:

```bash
npm run db:init
```

### 4. Seed stories (optional)

**30 default stories** ship in `backend/src/db/default-stories.json` and load on every server start — no API call needed.

To regenerate stories via Gemini (optional):

```bash
# From project root
npm run seed:stories

# Replace all seeded stories
npm run seed:stories -- --fresh

# Export current DB stories back to the JSON bundle
cd backend && npm run db:build-stories
```

Requires `GEMINI_API_KEY` in `.env`. The seed script waits 1 second between requests and supports resume if interrupted.

### 5. Start the server

From the project root:

```bash
npm start
```

Development with auto-reload:

```bash
npm run dev
```

Open **http://localhost:3001** in your browser. The Express server serves both the API and the frontend.

## App flow

1. **Login** — enter Iranian mobile number (`09xxxxxxxxx`), any 4-digit OTP
2. **Add child** (new users) — name + Jalali birth date
3. **Home** — «سلام! امشب برای کدوم بچه قصه می‌خوای؟»
   - Multiple children → pick a card
   - One child → mode picker shown directly
4. **Choose mode** — Calm 🌙 or Interactive 💬, plus voice settings link
5. **Calm** — story library, custom topics, playback with parent voice options
6. **Interactive** — live voice story with Gemini (AI voice; headphones recommended)

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/send-otp` | — | Send OTP (mock) |
| POST | `/api/auth/verify-otp` | — | Verify OTP, returns JWT |
| GET | `/api/children` | ✓ | List children |
| POST | `/api/children` | ✓ | Add child |
| GET | `/api/stories?age_group=3-5` | — | Story list |
| GET | `/api/stories/:id` | — | Full story |
| GET | `/api/stories/remaining?child_id=` | ✓ | Custom stories left today |
| POST | `/api/stories/generate-custom` | ✓ | Generate story (Gemini) |
| POST | `/api/stories/:id/audio` | ✓ | TTS audio (ElevenLabs) |
| GET | `/api/voice-profiles` | ✓ | List cloned voices |
| POST | `/api/voice-profiles` | ✓ | Upload voice sample |
| DELETE | `/api/voice-profiles/:id` | ✓ | Delete cloned voice |
| WS | `/ws/interactive-story` | JWT query param | Gemini Live session |

### WebSocket (Interactive Story)

Connect with query parameters: `token`, `child_id`, `topic`, `age_group`.

Client sends JSON: `{ "type": "audio", "data": "<base64 PCM 16kHz>" }`  
Server sends: `ready`, `audio`, `state` (`speaking` / `listening`), `error`, `close`.

Daily cap: **5 custom/interactive sessions per child per day** (shared `story_generation_log`).

## Database

SQLite file: `backend/data/lalayi.db` (override with `DATABASE_PATH`).

Tables: `users`, `children`, `voice_profiles`, `stories`, `story_generation_log`, `story_sessions`.

Reset database:

```bash
npm run db:reset
```

## Frontend

Served from `frontend/` by Express at `http://localhost:3001`.

Hash routes: `#/login`, `#/add-child`, `#/home`, `#/calm`, `#/calm/play/:id`, `#/interactive`, `#/voice-settings`.

### Design system

- **Tokens:** `frontend/styles/tokens.css`
- **Font:** Vazirmatn (Google Fonts), RTL on `html[dir="rtl"]`
- **Starfield:** `frontend/components/starfield.js`
- **Loading:** moon + twinkling stars (`frontend/components/loading.js`)
- **Responsive:** mobile-first, tablet grid layouts in `responsive.css`

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Blank page at `/` | Server running? Use `http://localhost:3001` not file:// |
| Custom story fails | `GEMINI_API_KEY` set? Free tier has daily limits |
| No audio in Calm mode | `ELEVENLABS_API_KEY` set? |
| Interactive won't connect | `GEMINI_API_KEY` + `GEMINI_LIVE_MODEL`; use headphones |
| Daily limit message | 5 generations/child/day — resets at midnight local server date |

## License

MIT
