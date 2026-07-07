# Hao Portfolio Socket Server

The real-time messaging backbone for the "Footprints" section of my personal portfolio. Built with a focus on low-latency communication and reliable data persistence.

## Architecture
- **Runtime:** Node.js
- **Communication:** WebSocket (ws)
- **Database:** PostgreSQL (Neon)
- **Deployment:** Render.com
- **Frontend:** [hao-portfolio](https://github.com/coolKIH/hao-portfolio) (Next.js on Vercel)

## Key Features
- **Hybrid Data Flow:** Supports initial SSR hydration via Next.js and live updates via WebSockets.
- **Connection Resilience:** Implements ping/pong heartbeats to manage connection lifecycles.
- **Auto-Sync:** Automatically pushes the last 7 days of message history upon connection.
- **Anonymous Messaging:** Server-side nickname generation for a consistent "essentialist" UI.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (SSL required for Neon) |
| `PORT` | No | Server port (default: `8080`) |
| `ACCESS_KEY` | Local dev | Shared secret for dev connections; must match `NEXT_PUBLIC_SOCKET_ACCESS_KEY` in hao-portfolio |

Production connections from the Vercel frontend are allowed via `ALLOWED_ORIGIN` without an access key. Local development (`localhost:3000`) uses `?accessKey=...` instead.

## Database setup

The server expects a `footprints` table in the `public` schema. For a new database:

```sql
CREATE TABLE footprints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname   VARCHAR DEFAULT 'Anonymous',
  content    VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

Use a **separate dev database** for local work. Point both this repo and hao-portfolio at the same dev `DATABASE_URL`.

## Local Development

1. Install dependencies and configure env:

```bash
pnpm install
cp .env.example .env
```

2. Start the server (with file watching):

```bash
pnpm dev
```

3. In a second terminal, start the frontend:

```bash
cd ../hao-portfolio
pnpm dev
```

4. Open http://localhost:3000/trace — the client connects to `ws://localhost:8080` in development.

## Production

```bash
pnpm start
```

Deployed on Render.com. Set `DATABASE_URL` and `PORT` in the Render dashboard.
