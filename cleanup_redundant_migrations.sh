#!/bin/bash

# Script to remove redundant migration files
# This script removes migrations that have been consolidated into the new migration

echo "Cleaning up redundant migration files..."

# List of migrations to remove (these are now consolidated)
REDUNDANT_MIGRATIONS=(
  "20250706086000_fix_organizations_migration.sql"
  "20250706087000_setup_existing_users.sql"
  "20250707041715_navy_queen.sql"
  "20250707041937_wild_dew.sql"
)

# Backup directory
BACKUP_DIR="supabase/migrations/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backup in: $BACKUP_DIR"

# Move redundant migrations to backup
for migration in "${REDUNDANT_MIGRATIONS[@]}"; do
  if [ -f "supabase/migrations/$migration" ]; then
    echo "Moving $migration to backup..."
    mv "supabase/migrations/$migration" "$BACKUP_DIR/"
  else
    echo "Warning: $migration not found"
  fi
done

echo "Cleanup completed!"
echo "Redundant migrations backed up to: $BACKUP_DIR"
echo ""
echo "Remaining migrations:"
ls -la supabase/migrations/*.sql

echo ""
echo "Next steps:"
echo "1. Run: supabase db reset"
echo "2. Run: supabase db push"
echo "3. Verify the database structure" 