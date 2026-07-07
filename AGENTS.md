# Agent Guide — hao-portfolio-socket

WebSocket server for the Trace (Footprints) guestbook. For **workspace-wide workflow, commit conventions, and code review practices**, see [AGENTS.md in hao-portfolio](https://github.com/coolKIH/hao-portfolio/blob/main/AGENTS.md).

## Start here

1. Read **`README.md`** in this repo.
2. For Trace-related tasks, also read `hao-portfolio/README.md` and check whether frontend changes are needed.

## Repo-specific notes

| File | Purpose |
|---|---|
| `index.js` | WebSocket server, rate limiting, DB writes, broadcast |
| `.env` | `DATABASE_URL`, `ACCESS_KEY`, `PORT` (never commit) |
| `.env.example` | Committed template for local setup |

## Local dev

```bash
pnpm install
cp .env.example .env
pnpm dev    # port 8080, node --watch
```

Run `hao-portfolio` (`pnpm dev` on port 3000) in parallel for end-to-end Trace testing.

## Auth model

- **Production:** connections allowed from `ALLOWED_ORIGIN` (Vercel URL).
- **Development:** `localhost` is not in the allowlist; clients must pass `?accessKey=` matching `ACCESS_KEY`.

## Database

- Table: `public.footprints` — see README for `CREATE TABLE` SQL.
- Share the same dev `DATABASE_URL` with hao-portfolio.
- Do not use the production database for local testing.

## Commits

- Commit in **this repo only**; do not mix with hao-portfolio changes in one commit.
- Prefix examples: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`
- After changes, **ask the user** if README / AGENTS.md / `.env.example` need updating (see main [AGENTS.md](https://github.com/coolKIH/hao-portfolio/blob/main/AGENTS.md#keeping-documentation-in-sync)).

## Documentation

| File | When to update |
|---|---|
| `README.md` | Env vars, ports, schema SQL, local dev steps |
| `AGENTS.md` (this file) | Socket-specific agent notes |
| `.env.example` | New or renamed env vars |
