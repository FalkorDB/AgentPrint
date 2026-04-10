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

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and GITHUB_TOKEN

# 3. Run database migrations
npx prisma migrate dev

# 4. Generate Prisma client
npx prisma generate

# 5. Start development server
npm run dev
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

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
