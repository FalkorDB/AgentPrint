#!/usr/bin/env bash
set -euo pipefail

# AgentPrint start script
# Starts Docker Postgres, runs migrations, generates Prisma client, and launches the app.
# Usage: ./start.sh [--dev]

DEV_MODE=false
if [[ "${1:-}" == "--dev" ]]; then
  DEV_MODE=true
fi

echo "🚀 AgentPrint — Starting up..."

# 1. Start or create Docker Postgres
if docker ps --format '{{.Names}}' | grep -q '^agentprint-db$'; then
  echo "✅ Postgres container already running"
elif docker ps -a --format '{{.Names}}' | grep -q '^agentprint-db$'; then
  echo "▶ Starting existing Postgres container..."
  docker start agentprint-db
else
  echo "📦 Creating Postgres container..."
  docker run -d \
    --name agentprint-db \
    -e POSTGRES_DB=agentprint \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -p 5432:5432 \
    postgres:16-alpine
fi

# Wait for Postgres to be ready
echo "⏳ Waiting for Postgres..."
until docker exec agentprint-db pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
done
echo "✅ Postgres is ready"

# 2. Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev --name init --skip-generate 2>/dev/null || \
  npx prisma migrate deploy

# 3. Generate Prisma client
echo "⚙️  Generating Prisma client..."
npx prisma generate

# 4. Start the app
if $DEV_MODE; then
  echo "🔧 Starting in development mode..."
  npm run dev
else
  echo "📦 Building for production..."
  npm run build
  echo "🌐 Starting production server..."
  npm start
fi
