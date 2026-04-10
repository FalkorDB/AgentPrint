# AgentPrint — GitHub Project Velocity Tracker

Measure the velocity of open-source projects on GitHub by computing monthly metrics normalized per active developer.

## Metrics

All metrics are computed monthly and normalized per **active developer** (unique GitHub user with ≥1 commit OR ≥1 PR review/approval that month). Bot accounts are excluded.

| Metric | Description |
|--------|-------------|
| Lines Changed / Dev | (additions + deletions) on default branch, excluding lock/generated/dist/build files |
| PR Merge Rate / Dev | Merged PRs / active devs |
| PR Rejection Rate | Closed-without-merge PRs / total closed PRs |
| First-Time Contributor Ratio | PRs from first-time contributors / total PRs opened |
| Median Time-to-Merge | Median hours from PR open → merge |
| Median Time-to-Close (Rejected) | Median hours from PR open → close without merge |

## Tech Stack

- **Next.js** (App Router) — Dashboard + API
- **PostgreSQL** + **Prisma v7** — Data storage
- **GitHub API** (Octokit) — PR/review data
- **Git clone** (bare incremental) — Commit/file analysis
- **Recharts** — Charts

## Prerequisites

- **Node.js** ≥ 18
- **Docker** (for local PostgreSQL)
- **Git** (for bare clone commit analysis)
- A **GitHub Personal Access Token** with `repo` scope (or a GitHub App)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set GITHUB_TOKEN (see below)

# 3. Start PostgreSQL with Docker
docker run -d \
  --name agentprint-db \
  -e POSTGRES_DB=agentprint \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Generate Prisma client
npx prisma generate

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (default in `.env.example` points to Docker) |
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo` scope |
| `GITHUB_APP_ID` | No | GitHub App ID (alternative auth) |
| `GITHUB_APP_PRIVATE_KEY` | No | GitHub App private key |
| `GIT_CLONE_DIR` | No | Directory for bare repo caches (default: `/tmp/agentprint-repos`) |

### Creating a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens?type=beta) (fine-grained tokens recommended)
2. Click **Generate new token** → **Fine-grained token**
3. Give it a name (e.g. `agentprint`)
4. Set expiration as needed
5. Under **Repository access**, choose **Public Repositories (read-only)** — this is sufficient for tracking open-source projects
6. Under **Permissions → Repository permissions**, ensure:
   - **Contents**: Read-only (for commit data)
   - **Pull requests**: Read-only (for PR and review data)
   - **Metadata**: Read-only (granted by default)
7. Click **Generate token** and copy it into your `.env`:
   ```
   GITHUB_TOKEN="github_pat_xxxxxxxxxxxx"
   ```

> **Classic tokens** also work: go to [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → select the `repo` scope (or just `public_repo` for open-source only).

### Docker Commands

```bash
# Stop the database
docker stop agentprint-db

# Start it again
docker start agentprint-db

# Remove it entirely
docker rm -f agentprint-db
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List tracked projects |
| POST | `/api/projects` | Add a project `{ owner, repo, defaultBranch? }` |
| DELETE | `/api/projects?id=X` | Remove a project |
| POST | `/api/collect` | Trigger data collection + metric computation `{ projectId }` |
| GET | `/api/metrics?project_id=X` | Get monthly metrics for a project |

## Architecture

```
src/
├── app/                     # Next.js App Router
│   ├── page.tsx             # Dashboard home
│   ├── projects/[id]/       # Per-project metric view
│   └── api/                 # REST API routes
├── lib/
│   ├── db.ts                # Prisma client singleton
│   ├── github/              # GitHub API (Octokit)
│   ├── collector/           # Data collection + git clone
│   └── metrics/             # Metric computation engine
└── components/              # React UI components
```
