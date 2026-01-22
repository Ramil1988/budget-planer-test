# Assets & Liabilities Setup Guide

Quick start guide for setting up the Assets & Liabilities tracker in BudgetWise.

## Prerequisites

- Supabase account with BudgetWise database already set up
- Basic database schema installed (profiles, accounts, categories, transactions, etc.)
- Access to Supabase SQL Editor

## Step 1: Run Database Migrations

### Option A: Supabase SQL Editor (Recommended)

1. Log into your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

**Run Migration 1:**
- Copy the contents of `/backend/database/migrations/003_assets_liabilities.sql`
- Paste into SQL Editor
- Click **Run**
- Verify: "Success. No rows returned"

**Run Migration 2:**
- Copy the contents of `/backend/database/migrations/004_auto_seed_assets_liabilities.sql`
- Paste into SQL Editor
- Click **Run**
- Verify: "Success. No rows returned"

### Option B: psql Command Line

```bash
# Connect to Supabase
psql "postgresql://postgres:[YOUR_PASSWORD]@[YOUR_HOST]:5432/postgres"

# Run migrations
\i backend/database/migrations/003_assets_liabilities.sql
\i backend/database/migrations/004_auto_seed_assets_liabilities.sql
```

## Step 2: Verify Installation

Run these SQL queries to verify the tables were created:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('assets', 'liabilities', 'asset_categories', 'liability_types', 'net_worth_snapshots');
```

Expected output: 5 rows showing all 5 table names.

```sql
-- Check auto-seeded categories
SELECT * FROM asset_categories LIMIT 10;
SELECT * FROM liability_types LIMIT 10;
```

Expected output: 8 asset categories and 7 liability types for existing users.

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('assets', 'liabilities', 'asset_categories', 'liability_types', 'net_worth_snapshots');
```

Expected output: All 5 tables should have `rowsecurity = true`.

## Step 3: Test the Feature

1. **Start the development server:**
   ```bash
   cd frontend
   pnpm run dev
   ```

2. **Navigate to the page:**
   - Open browser: http://localhost:5173
   - Sign in with your test account
   - Click "Assets" in the navigation menu
   - Or navigate directly to: http://localhost:5173/assets-liabilities

3. **Test basic functionality:**
   - Click "+ Add Asset" button
   - Fill in asset details (category, name, amount)
   - Click Save
   - Verify asset appears in the list
   - Verify "Total Assets" card updates
   - Click "+ Add Debt" button
   - Fill in liability details
   - Click Save
   - Verify liability appears in list
   - Verify "Total Liabilities" and "Net Worth" cards update

4. **Test snapshot feature:**
   - Click "Save Snapshot" button
   - Verify success message
   - Modify an asset amount
   - Save a new snapshot for a different date
   - Select previous date in "Compare From" dropdown
   - Verify "Equity Change" card shows the difference

## Step 4: Backfill Existing Users (If Needed)

If you already have users and they don't have categories/types, the migration handles this automatically. But to verify:

```sql
-- Check if specific user has categories
SELECT * FROM asset_categories WHERE user_id = 'YOUR_USER_ID';
SELECT * FROM liability_types WHERE user_id = 'YOUR_USER_ID';
```

If empty, manually trigger the auto-seed function:

```sql
-- Get user ID from profiles
SELECT id FROM profiles LIMIT 1;

-- Manually seed for a specific user
INSERT INTO asset_categories (user_id, name, icon) VALUES
  ('YOUR_USER_ID', 'Real Estate', '🏠'),
  ('YOUR_USER_ID', 'Cash', '💵'),
  ('YOUR_USER_ID', 'Savings Account', '🏦'),
  ('YOUR_USER_ID', 'RRSP', '📊'),
  ('YOUR_USER_ID', 'TFSA', '💼'),
  ('YOUR_USER_ID', 'Vehicle', '🚗'),
  ('YOUR_USER_ID', 'Investment', '📈'),
  ('YOUR_USER_ID', 'Other Assets', '💎');

INSERT INTO liability_types (user_id, name, icon) VALUES
  ('YOUR_USER_ID', 'Mortgage', '🏡'),
  ('YOUR_USER_ID', 'Car Loan', '🚙'),
  ('YOUR_USER_ID', 'Student Loan', '🎓'),
  ('YOUR_USER_ID', 'Credit Card', '💳'),
  ('YOUR_USER_ID', 'Personal Loan', '💰'),
  ('YOUR_USER_ID', 'Line of Credit', '📝'),
  ('YOUR_USER_ID', 'Other Debt', '💸');
```

## Troubleshooting

### Error: "relation already exists"
This is fine - the tables are already created. The migration uses `CREATE TABLE IF NOT EXISTS`.

### Error: "permission denied for schema public"
Run the migration as a database owner or superuser. In Supabase, use the SQL Editor (runs as postgres user).

### Categories not appearing for new users
Check if the trigger is working:
```sql
-- Verify trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'auto_seed_asset_liability_trigger';

-- Test trigger manually
-- Create a test profile, then check if categories were created
```

### RLS preventing access
If you can't see your own data:
```sql
-- Check current user
SELECT auth.uid();

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('assets', 'liabilities');

-- Temporarily disable RLS for testing (re-enable after!)
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
```

### Frontend errors
Check browser console for errors:
- Verify Supabase environment variables are set
- Verify user is authenticated
- Check network tab for failed API calls
- Verify table names match exactly (case-sensitive)

## Production Deployment

### Before deploying:
1. Test thoroughly in development
2. Verify all migrations run successfully
3. Test with a new user account (auto-seeding)
4. Test dark mode appearance
5. Test on mobile devices

### Deploy to Supabase Production:
1. Run migrations in production Supabase SQL Editor
2. Verify tables created
3. Test with production test account

### Deploy Frontend to Netlify:
```bash
# Build frontend
cd frontend
pnpm run build

# Deploy
netlify deploy --prod
```

## Next Steps

After setup is complete:

1. **Add your real data:**
   - Navigate to `/assets-liabilities`
   - Add your actual assets (home, car, savings, investments)
   - Add your actual liabilities (mortgage, loans, credit cards)

2. **Save your first snapshot:**
   - Set record date to today
   - Click "Save Snapshot"
   - This becomes your baseline for tracking

3. **Set up monthly snapshots:**
   - Mark your calendar to save a snapshot monthly (1st of each month)
   - Build historical trend data
   - Track your net worth growth over time

4. **Explore features:**
   - Try inline editing (click any row)
   - Compare different snapshot dates
   - Check key metrics (Home Equity, Liquid Assets, etc.)
   - Test on mobile device

## Support

For issues:
1. Check this setup guide
2. See `/docs/assets-liabilities-feature.md` for detailed documentation
3. See `/backend/database/migrations/README.md` for migration help
4. Check browser console for errors
5. Verify database connection in Supabase dashboard

## File Locations

- **Frontend Page:** `/frontend/src/pages/AssetsLiabilities.jsx`
- **Route:** `/assets-liabilities` (protected)
- **Migration 1:** `/backend/database/migrations/003_assets_liabilities.sql`
- **Migration 2:** `/backend/database/migrations/004_auto_seed_assets_liabilities.sql`
- **Documentation:** `/docs/assets-liabilities-feature.md`
- **Setup Guide:** `/docs/SETUP_ASSETS_LIABILITIES.md` (this file)
