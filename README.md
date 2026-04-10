# Hao Portfolio Socket Server

The real-time messaging backbone for the "Footprints" section of my personal portfolio. Built with a focus on low-latency communication and reliable data persistence.

## Architecture
- **Runtime:** Node.js
- **Communication:** WebSocket (ws)
- **Database:** PostgreSQL (via Vercel/Neon)
- **Deployment:** Render.com

## Key Features
- **Hybrid Data Flow:** Supports initial SSR hydration via Next.js and live updates via WebSockets.
- **Connection Resilience:** Implements ping/pong heartbeats to manage connection lifecycles.
- **Auto-Sync:** Automatically pushes the last 7 days of message history upon connection.
- **Anonymous Messaging:** Server-side nickname generation for a consistent "essentialist" UI.

## Environment Variables
The following variables are required for deployment:
- `DATABASE_URL`: Full PostgreSQL connection string (including SSL requirements).
- `PORT`: The port on which the server listens (default: 8080).

## Local Development
```bash
pnpm install
pnpm dev
```
