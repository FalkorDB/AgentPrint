# AgentPrint - Detect the Fingerprint AI Agents Leave on projects Velocity

Detect the fingerprint AI coding agents leave on open-source projects velocity by computing monthly metrics normalized per active developer.

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

- **Next.js** (App Router) - Dashboard + API
- **PostgreSQL** + **Prisma v7** - Data storage
- **GitHub API** (Octokit) - PR/review data
- **Git clone** (bare incremental) - Commit/file analysis
- **Recharts** - Charts

## Prerequisites

- **Node.js** ≥ 18
- **Docker** (for local PostgreSQL)
- **Git** (for bare clone commit analysis)
- A **GitHub Personal Access Token** with `repo` scope (or a GitHub App)

## Setup

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env - set GITHUB_TOKEN (see below)

# 2. Start everything (installs deps, starts Postgres, migrates, launches app)
make up          # development mode (hot-reload)
make up-prod     # production mode
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Available Make Targets

| Target | Description |
|--------|-------------|
| `make up` | Full dev startup (install → db → migrate → generate → dev) |
| `make up-prod` | Full production startup (install → db → migrate → generate → build → start) |
| `make db` | Start/create Docker Postgres |
| `make db-stop` | Stop Postgres container |
| `make db-rm` | Remove Postgres container |
| `make migrate` | Run Prisma migrations |
| `make generate` | Generate Prisma client |
| `make dev` | Start dev server |
| `make build` | Production build |
| `make clean` | Remove build artifacts + node_modules |
| `make help` | Show all targets |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (default in `.env.example` points to Docker) |
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo` scope |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID (for login) |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `AUTH_SECRET` | Yes | Random secret for session encryption (`openssl rand -base64 32`) |
| `GITHUB_APP_ID` | No | GitHub App ID (alternative auth) |
| `GITHUB_APP_PRIVATE_KEY` | No | GitHub App private key |
| `GIT_CLONE_DIR` | No | Directory for bare repo caches (default: `/tmp/agentprint-repos`) |

### Creating a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens?type=beta) (fine-grained tokens recommended)
2. Click **Generate new token** → **Fine-grained token**
3. Give it a name (e.g. `agentprint`)
4. Set expiration as needed
5. Under **Repository access**, choose **Public Repositories (read-only)** - this is sufficient for tracking open-source projects
6. Under **Permissions → Repository permissions**, ensure:
   - **Contents**: Read-only (for commit data)
   - **Pull requests**: Read-only (for PR and review data)
   - **Metadata**: Read-only (granted by default)
7. Click **Generate token** and copy it into your `.env`:
   ```
   GITHUB_TOKEN="github_pat_xxxxxxxxxxxx"
   ```

> **Classic tokens** also work: go to [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → select the `repo` scope (or just `public_repo` for open-source only).

### Setting Up Google Login

The main dashboard requires Google sign-in. Project pages are public (read-only).

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Set **Authorized redirect URIs** to:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret** into your `.env`:
   ```
   GOOGLE_CLIENT_ID="xxxxxxxxxxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxx"
   ```
6. Generate an auth secret:
   ```bash
   openssl rand -base64 32
   ```
   Add it to `.env`:
   ```
   AUTH_SECRET="your-generated-secret"
   ```

> **Note:** If you haven't set up a Google Cloud project yet, you'll first need to create one and configure the [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) (External, with your app name and email).

### Docker Commands

```bash
# Stop the database
docker stop agentprint-db

# Start it again
docker start agentprint-db

# Remove it entirely
docker rm -f agentprint-db
```

### Deploying to Railway

1. Create a new project on [Railway](https://railway.com)
2. Add a **PostgreSQL** service - Railway provisions a database and sets `DATABASE_URL` automatically
3. Connect your GitHub repo (or use `railway up` from the CLI)
4. Set the following environment variables in the Railway service settings:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Provided by Railway's Postgres plugin (auto-set if you link the DB) |
   | `GITHUB_TOKEN` | Your GitHub PAT |
   | `GOOGLE_CLIENT_ID` | Google OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
   | `AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | Your Railway app URL, e.g. `https://agentprint.up.railway.app` |

5. Railway will run `npm run build` which automatically runs `prisma generate`, `prisma migrate deploy`, and `next build`
6. The app starts with `npm start` (`next start`) on the default port

> **Note:** If Railway provides the database URL under a different variable name (e.g. `DATABASE_PRIVATE_URL`), add a reference variable: `DATABASE_URL` → `${{Postgres.DATABASE_PRIVATE_URL}}`.

## API

Interactive API documentation is available at [`/api-docs`](https://agentprint.falkordb.com/api-docs) (Swagger UI).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects` | ✅ | List all tracked projects |
| PUT | `/api/projects/{owner}/{repo}` | ✅ | Add or update a project |
| DELETE | `/api/projects/{owner}/{repo}` | ✅ | Remove a project |
| GET | `/api/projects/{owner}/{repo}/metrics` | Public | Monthly velocity metrics |
| GET | `/api/projects/{owner}/{repo}/stars` | Public | Star history |
| POST | `/api/projects/{owner}/{repo}/collect` | ✅ | Start data sync (SSE stream) |
| GET | `/api/projects/{owner}/{repo}/collect` | ✅ | Reconnect to active sync job |
| GET | `/api/tokens` | Session | List API tokens |
| POST | `/api/tokens` | Session | Create a new API token |
| DELETE | `/api/tokens/{id}` | Session | Revoke an API token |

### Authentication

Protected endpoints (marked ✅) accept either:

1. **Session cookie** - log in via the dashboard at `/login`
2. **API token** - pass `Authorization: Bearer <token>` header

API tokens are managed from the dashboard (key icon in the header) or via the `/api/tokens` endpoints (session auth only - tokens cannot create other tokens).

```bash
# Example: list projects with an API token
curl -H "Authorization: Bearer ap_abc123..." https://agentprint.falkordb.com/api/projects
```

### MCP Server

AgentPrint exposes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for AI agents and coding assistants. Authenticate with an API token.

**Endpoint:** `https://agentprint.falkordb.com/api/mcp/mcp`

**Available tools:** `list_projects`, `add_project`, `delete_project`, `get_metrics`, `get_stars`

Configure in your MCP client (Claude Desktop, Cursor, VS Code, etc.):

```json
{
  "agentprint": {
    "url": "https://agentprint.falkordb.com/api/mcp/mcp",
    "headers": {
      "Authorization": "Bearer ap_your_token_here"
    }
  }
}
```

For stdio-only clients, use [mcp-remote](https://www.npmjs.com/package/mcp-remote):

```json
{
  "agentprint": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://agentprint.falkordb.com/api/mcp/mcp", "--header", "Authorization:Bearer ap_your_token_here"]
  }
}
```

## Architecture

```
src/
├── app/                     # Next.js App Router
│   ├── page.tsx             # Dashboard home (auth-protected)
│   ├── login/               # Google sign-in page
│   ├── projects/[owner]/[repo]/ # Per-project dashboard (public)
│   └── api/                 # REST API routes
├── auth.ts                  # NextAuth v5 config (Google provider)
├── lib/
│   ├── db.ts                # Prisma client singleton
│   ├── github/              # GitHub API (Octokit)
│   ├── collector/           # Data collection + git clone
│   ├── metrics/             # Metric computation engine
│   └── events.ts            # AI model release date markers
└── components/              # React UI components
```
