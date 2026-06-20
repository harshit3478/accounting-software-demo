#!/usr/bin/env bash
# Safe Prisma migrate deploy for production (handles set -e / P3009 recovery).
set -euo pipefail

cd /var/www/accounting

# Prisma loads .env internally — do NOT `source .env` (values with commas/spaces break bash).

apply_migration_sql() {
  local migration_name=$1
  local sql_file="prisma/migrations/${migration_name}/migration.sql"

  if [ ! -f "$sql_file" ]; then
    echo "🔴 Migration SQL not found: $sql_file"
    return 1
  fi

  echo "🔧 Applying SQL for failed migration: $migration_name"
  set +e
  local exec_out
  exec_out=$(npx prisma db execute --file "$sql_file" --schema prisma/schema.prisma 2>&1)
  local exec_exit=$?
  set -e
  echo "$exec_out"

  if [ "$exec_exit" -eq 0 ]; then
    return 0
  fi

  if echo "$exec_out" | grep -qiE "Duplicate column|Duplicate key name|already exists"; then
    echo "ℹ️  Schema change already present — continuing recovery."
    return 0
  fi

  return "$exec_exit"
}

recover_failed_migration() {
  local failed_mig=$1

  if [ "$failed_mig" = "20260620000100_customer_email_unique" ]; then
    echo "🔧 Running customer email dedupe recovery..."
    set +e
    local recovery_out
    recovery_out=$(npx prisma db execute \
      --file prisma/migrations/20260620000101_fix_customer_email_unique_recovery/migration.sql \
      --schema prisma/schema.prisma 2>&1)
    local recovery_exit=$?
    set -e
    echo "$recovery_out"

    if [ "$recovery_exit" -eq 0 ]; then
      return 0
    fi

    if echo "$recovery_out" | grep -qiE "Duplicate key name|already exists"; then
      return 0
    fi
  fi

  apply_migration_sql "$failed_mig"
}

parse_failed_migration() {
  echo "$1" | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p' | head -1
}

MAX_RECOVERY_ATTEMPTS=6
attempt=0

while [ "$attempt" -lt "$MAX_RECOVERY_ATTEMPTS" ]; do
  echo "🔵 Running migrations (attempt $((attempt + 1))/$MAX_RECOVERY_ATTEMPTS)..."

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
    FAILED_MIG=$(parse_failed_migration "$MIGRATE_OUT")

    if [ -z "$FAILED_MIG" ]; then
      echo "🔴 Could not parse failed migration name."
      echo "   Run: npx prisma migrate status"
      exit 1
    fi

    echo "⚠️  P3009: recovering failed migration → $FAILED_MIG"

    if ! recover_failed_migration "$FAILED_MIG"; then
      echo "🔴 Failed to apply recovery SQL for $FAILED_MIG"

      set +e
      npx prisma migrate diff \
        --from-schema-datasource prisma/schema.prisma \
        --to-schema-datamodel prisma/schema.prisma \
        --exit-code > /dev/null 2>&1
      DIFF_EXIT=$?
      set -e

      if [ "$DIFF_EXIT" -eq 0 ]; then
        echo "✅ Live DB already matches schema. Marking migration as applied..."
      else
        echo "🔴 Schema drift remains (exit $DIFF_EXIT). Manual fix required:"
        echo "   cd /var/www/accounting && npx prisma migrate status"
        exit 1
      fi
    fi

    echo "✅ Marking $FAILED_MIG as applied..."
    npx prisma migrate resolve --applied "$FAILED_MIG"
    attempt=$((attempt + 1))
    continue
  fi

  if echo "$MIGRATE_OUT" | grep -qiE "customers_email_key|Duplicate entry|Unique constraint failed"; then
    echo "🔧 Duplicate customer emails detected. Running dedupe recovery..."
    set +e
    npx prisma db execute \
      --file prisma/migrations/20260620000101_fix_customer_email_unique_recovery/migration.sql \
      --schema prisma/schema.prisma 2>&1
    RECOVERY_EXIT=$?
    set -e

    if [ "$RECOVERY_EXIT" -eq 0 ]; then
      attempt=$((attempt + 1))
      continue
    fi
  fi

  echo "🔴 Migration failed (exit $MIGRATE_EXIT)."
  exit "$MIGRATE_EXIT"
done

echo "🔴 Migration recovery exceeded max attempts."
exit 1
