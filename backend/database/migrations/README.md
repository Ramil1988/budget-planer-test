# Database Migrations

This directory contains SQL migration files to extend the BudgetWise database schema.

## Migration Files

### 001_add_webhook_secret.sql
Adds webhook functionality for Google Sheets integration:
- Adds `webhook_secret` and `realtime_enabled` columns to `user_settings`
- Enables real-time sync from Google Sheets via webhooks

### 002_auto_seed_new_users.sql
Automatically seeds default data for new users:
- Creates 20 expense categories (Food, Fuel, etc.)
- Creates 5 income categories (Salary, Freelance, etc.)
- Creates 300+ merchant mappings for auto-categorization
- Backfills existing users

### 003_assets_liabilities.sql
Creates tables for Assets & Liabilities tracker:
- `asset_categories` - Categories for assets (Real Estate, Cash, RRSP, etc.)
- `liability_types` - Types of liabilities (Mortgage, Loans, Credit Cards, etc.)
- `assets` - User's assets with amounts and notes
- `liabilities` - User's debts with balances, payments, and interest rates
- `net_worth_snapshots` - Historical snapshots for trend tracking
- Includes RLS policies and indexes

### 004_auto_seed_assets_liabilities.sql
Automatically seeds asset categories and liability types for new users:
- Creates 8 default asset categories
- Creates 7 default liability types
- Backfills existing users
- Auto-triggers on new user signup

### 005_link_liabilities_to_categories.sql
Links liabilities to spending categories for automatic balance tracking:
- Adds `linked_category_id` column to `liabilities` table
- Creates trigger `liability_update_on_transaction_insert` - reduces liability balance when payment transaction is created
- Creates trigger `liability_update_on_transaction_delete` - restores liability balance when payment transaction is deleted
- Creates trigger `liability_update_on_transaction_update` - adjusts liability balance when transaction amount/category changes
- Use case: Link "Mortgage" liability to "Mortgage" spending category, and the balance auto-reduces on payments

## How to Apply Migrations

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of a migration file
5. Click **Run** to execute
6. Repeat for each migration file in order (001, 002, 003, 004)

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Run migrations
supabase db push
```

### Option 3: psql Command Line

```bash
# Connect to your Supabase PostgreSQL database
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Run migration file
\i backend/database/migrations/003_assets_liabilities.sql
\i backend/database/migrations/004_auto_seed_assets_liabilities.sql
```

## Migration Order

**Important:** Run migrations in this order:

1. `001_add_webhook_secret.sql` (if using Google Sheets sync)
2. `002_auto_seed_new_users.sql` (if using auto-seeding)
3. `003_assets_liabilities.sql` (creates tables)
4. `004_auto_seed_assets_liabilities.sql` (auto-seeds data)
5. `005_link_liabilities_to_categories.sql` (links liabilities to spending categories)

## Verification

After running migrations, verify they worked:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('assets', 'liabilities', 'asset_categories', 'liability_types', 'net_worth_snapshots');

-- Check if RLS policies are enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('assets', 'liabilities', 'asset_categories', 'liability_types', 'net_worth_snapshots');

-- Check auto-seeded categories (for a test user)
SELECT * FROM asset_categories LIMIT 10;
SELECT * FROM liability_types LIMIT 10;
```

## Rollback

If you need to undo a migration:

```sql
-- Remove Assets & Liabilities tables
DROP TABLE IF EXISTS net_worth_snapshots CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS liabilities CASCADE;
DROP TABLE IF EXISTS asset_categories CASCADE;
DROP TABLE IF EXISTS liability_types CASCADE;

-- Remove auto-seed trigger
DROP TRIGGER IF EXISTS auto_seed_asset_liability_trigger ON profiles;
DROP FUNCTION IF EXISTS auto_seed_asset_liability_data();
```

## Troubleshooting

### Error: "relation already exists"
This means the table/function already exists. You can safely ignore this error or use `CREATE TABLE IF NOT EXISTS` syntax.

### Error: "permission denied"
Make sure you're running the SQL as a superuser or database owner.

### Error: "RLS policy already exists"
Drop the existing policy first:
```sql
DROP POLICY IF EXISTS "own_data" ON assets;
```

## Notes

- All tables have Row Level Security (RLS) enabled
- Users can only access their own data (filtered by `user_id`)
- Timestamps are automatically managed via triggers
- Indexes are created for optimal query performance
- Auto-seeding triggers run automatically on new user signup
