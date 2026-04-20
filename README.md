# KanbanCord Frontend (Auth Smoke Test)

This frontend is intentionally minimal.

Current scope:
- Login with a Discord OAuth button (authorization code flow)
- Exchange Discord auth code through backend `POST /api/auth/discord/exchange`
- Store backend JWT token locally
- Validate JWT with backend `GET /api/me`
- Verify authenticated communication with `GET /api/me/servers`

No dashboard, boards, or styling work is included yet.

## Prerequisites

- Node.js 20+
- Running backend API (default: `http://localhost:8080`)
- Discord application with OAuth redirect URI configured (default: `http://localhost:5173`)

## Setup

1. Copy `.env.example` to `.env`.
2. Set frontend OAuth variables:

```env
VITE_API_BASE_URL=
VITE_DISCORD_CLIENT_ID=your_discord_app_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:5173
VITE_DISCORD_SCOPES=identify guilds
```

When `VITE_API_BASE_URL` is empty, Vite dev proxy forwards `/api/*` to `http://localhost:8080`.

3. Install dependencies:

```bash
npm install
```

4. Start dev server:

```bash
npm run dev
```

3. Configure backend OAuth environment variables before running Spring Boot:

```powershell
$env:KANBANCORD_DISCORD_CLIENT_ID="your_discord_app_client_id"
$env:KANBANCORD_DISCORD_CLIENT_SECRET="your_discord_app_client_secret"
$env:KANBANCORD_JWT_SECRET="your_jwt_secret"
$env:KANBANCORD_BOT_TOKEN="your_bot_token"
```

## How To Test Backend Communication

1. Open the app in browser.
2. Click `Login with Discord`.
3. Complete Discord consent screen.
4. Browser returns to frontend and auto-authenticates against backend.
4. Click `Validate Token (/api/me)`.
5. Click `Fetch Servers (/api/me/servers)`.

Successful responses confirm frontend and backend token-based communication is working.
