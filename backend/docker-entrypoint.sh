#!/bin/sh
set -eu

echo "Waiting for database migrations..."
npx prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding demo data because SEED_ON_START=true"
  npx tsx prisma/seed.ts
fi

echo "Starting Jaafar API on 0.0.0.0:${PORT:-5050}"
exec node dist/index.js
