# Rainlight Alley Backend

## Run

1. Fill `.env.local` (or `.env`) with backend vars from `.env.example`.
2. Execute Supabase SQL in `supabase/init.sql`.
3. Install deps: `npm install`
4. Start server: `npm run start:server` (or dev mode `npm run dev:server`)

## API

- `POST /api/register`
- `GET /api/unlocks/:deviceId`
- `POST /api/unlock`
- `POST /api/story`
- `POST /api/stats`
- `POST /api/fcm-token`
- `POST /api/verify-purchase`
- `GET /internal/stats` (requires `x-admin-key`)

## Notes

- Daily unlock cron runs at `00:00` with timezone `UNLOCK_TIMEZONE`.
- Server never trusts client time for unlock logic.
- Purchase verification supports Apple and Google Play.
