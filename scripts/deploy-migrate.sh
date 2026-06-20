#!/usr/bin/env bash
# Safe Prisma migrate deploy for production (handles set -e / P3009 recovery).
set -euo pipefail

cd /var/www/accounting

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "🔵 Running migrations..."

set +e
MIGRATE_OUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?
set -e

echo "$MIGRATE_OUT"

if [ "$MIGRATE_EXIT" -eq 0 ]; then
  echo "✅ Migrations applied successfully."
  exit 0
fi

if echo "$MIGRATE_OUT" | grep -q "P3009"; then
  echo "⚠️  P3009 detected: a migration was interrupted. Checking schema drift..."

  FAILED_MIG=$(echo "$MIGRATE_OUT" | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p' | head -1)

  if [ -z "$FAILED_MIG" ]; then
    echo "🔴 Could not parse failed migration name. Manual intervention required."
    echo "   Run: npx prisma migrate status"
    exit 1
  fi

  echo "   Failed migration: $FAILED_MIG"

  if [ "$FAILED_MIG" = "20260620000100_customer_email_unique" ]; then
    echo "🔧 Attempting customer email unique index recovery..."
    set +e
    npx prisma db execute \
      --file prisma/migrations/20260620000101_fix_customer_email_unique_recovery/migration.sql \
      --schema prisma/schema.prisma 2>&1
    RECOVERY_EXIT=$?
    set -e

    if [ "$RECOVERY_EXIT" -eq 0 ]; then
      npx prisma migrate resolve --applied "$FAILED_MIG"
      npx prisma migrate deploy
      exit 0
    fi

    echo "⚠️  Recovery SQL failed (exit $RECOVERY_EXIT). Falling back to schema diff check..."
  fi

  set +e
  npx prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --exit-code > /dev/null 2>&1
  DIFF_EXIT=$?
  set -e

  if [ "$DIFF_EXIT" -eq 0 ]; then
    echo "✅ Schema is fully applied. Marking migration as applied in Prisma..."
    npx prisma migrate resolve --applied "$FAILED_MIG"
    npx prisma migrate deploy
    exit 0
  fi

  echo "🔴 Schema drift detected — the failed migration was only partially applied (exit $DIFF_EXIT)."
  echo "   Manual resolution required:"
  echo "   1. SSH into the server"
  echo "   2. cd /var/www/accounting"
  echo "   3. npx prisma migrate status"
  echo "   4. Manually apply the missing SQL, then run:"
  echo "      npx prisma migrate resolve --applied $FAILED_MIG"
  exit 1
fi

echo "🔴 Migration failed (exit $MIGRATE_EXIT)."

if echo "$MIGRATE_OUT" | grep -qiE "customers_email_key|Duplicate entry|Unique constraint failed"; then
  echo "🔧 Duplicate customer emails detected. Running dedupe recovery..."
  set +e
  npx prisma db execute \
    --file prisma/migrations/20260620000101_fix_customer_email_unique_recovery/migration.sql \
    --schema prisma/schema.prisma 2>&1
  RECOVERY_EXIT=$?
  set -e

  if [ "$RECOVERY_EXIT" -eq 0 ]; then
    echo "🔵 Retrying migrations after dedupe..."
    npx prisma migrate deploy
    exit 0
  fi
fi

exit "$MIGRATE_EXIT"
