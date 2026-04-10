<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AgentPrint — Coding Agent Guide

## Project Overview
GitHub Project Velocity Tracker. Next.js + Postgres + GitHub API + git clone. Computes 6 monthly metrics per project normalized per active developer.

## Commands
- `make up` — full dev startup (db + migrations + dev server)
- `make up-prod` — full production startup
- `make db` / `make db-stop` — manage Docker Postgres
- `make migrate` — run Prisma migrations
- `make generate` — regenerate Prisma client
- `npm run build` — production build
- `npx tsc --noEmit` — type check

## Key Directories
- `src/lib/github/` — GitHub API clients (Octokit)
- `src/lib/collector/` — Data collection orchestration + git clone
- `src/lib/metrics/` — Metric computation engine
- `src/app/api/` — REST API routes
- `prisma/schema.prisma` — Database schema

## Conventions
- Prisma v7 with `@prisma/adapter-pg` driver adapter
- Bot accounts are excluded from all metrics (see `BOT_LOGINS` in `client.ts`)
- File exclusions for line counts defined in `git-clone.ts` (`EXCLUDED_PATTERNS`)
- Monthly metrics attributed by: commits landed, PRs merged/closed, PRs opened (varies per metric)
