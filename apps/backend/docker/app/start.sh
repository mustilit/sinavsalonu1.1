#!/bin/sh
set -e

echo "Running migrations (with retry)..."
for i in 1 2 3 4 5; do
  if npx prisma migrate deploy; then
    echo "Migrations applied."
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo "Migration failed after 5 attempts. Exiting."
    exit 1
  fi
  echo "Migration attempt $i/5 failed, retrying in 5s..."
  sleep 5
done

echo "Generating Prisma client..."
npx prisma generate

echo "Starting application..."
exec npm run start

