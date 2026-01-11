# Supabase Setup Guide

**Last Updated:** 2026-01-10

This guide will walk you through setting up Supabase for authentication and database in the BudgetWise application.

---

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with your GitHub account (recommended) or email
4. Verify your email if required

---

## Step 2: Create a New Project

1. Click "New Project" in your Supabase dashboard
2. Fill in the project details:
   - **Name:** BudgetWise (or any name you prefer)
   - **Database Password:** Create a strong password (save this!)
   - **Region:** Choose the closest region to you
   - **Pricing Plan:** Free tier (perfect for 2-3 users)
3. Click "Create new project"
4. Wait 1-2 minutes for your database to be provisioned

---

## Step 3: Get Your API Keys

Once your project is created:

1. Go to **Project Settings** (gear icon in left sidebar)
2. Click on **API** in the left menu
3. You'll see two important values:

### Project URL
```
https://xyzcompany.supabase.co
```
Copy this entire URL.

### API Keys
You'll see two keys:
- **anon public** - This is safe to use in your frontend
- **service_role** - Keep this secret! (we'll use it later for Netlify Functions)

Copy the **anon public** key.

---

## Step 4: Create the Environment File

1. In your project, navigate to the `frontend/` directory
2. Create a new file called `.env` (note: starts with a dot)
3. Copy the contents from `frontend/.env.example`:

```bash
# In terminal
cd /Users/ramilsharapov/Desktop/Budget\ planner/frontend
cp .env.example .env
```

4. Edit the `.env` file and replace the placeholder values:

```env
# Replace these with your actual Supabase values
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

**Example:**
```env
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. Save the file

**Important:** The `.env` file is already in `.gitignore`, so it won't be committed to GitHub (which is good for security).

---

## Step 5: Run the Database Schema

We need to create the database tables for budgets, transactions, accounts, etc.

1. In Supabase dashboard, click on the **SQL Editor** icon (left sidebar)
2. Click "New Query"
3. Open the file `/Users/ramilsharapov/Desktop/Budget planner/backend/database/schema.sql`
4. Copy the entire contents of that file
5. Paste it into the Supabase SQL Editor
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. You should see a success message

This will create:
- **profiles** table - User profiles
- **accounts** table - Bank accounts, wallets, etc.
- **categories** table - Expense/income categories
- **transactions** table - All transactions
- **budgets** table - Monthly budgets
- **budget_categories** table - Category-level budget limits
- **Triggers** - Automatic balance calculations
- **Row Level Security** - Users can only see their own data

---

## Step 5b: Run Migrations (Required)

After the schema, run these migrations for full functionality:

### Migration 1: Merchant Mappings (seed-all.sql)
1. Open `/backend/database/seed-all.sql`
2. Copy and paste into Supabase SQL Editor
3. Click "Run"

This creates the `seed_merchant_mappings()` function with 300+ merchant patterns.

### Migration 2: Auto-Seeding for New Users
1. Open `/backend/database/migrations/002_auto_seed_new_users.sql`
2. Copy and paste into Supabase SQL Editor
3. Click "Run"

This creates:
- `seed_user_categories()` - Seeds 20 expense categories
- `seed_income_categories()` - Seeds 5 income categories
- `seed_new_user_data()` - Master seeding function
- **Database trigger** on `auth.users` - Automatically seeds new signups
- Also seeds any existing users who are missing categories

**After running this migration, all new users will automatically receive:**
- 20 default expense categories (Food, Fuel, Clothes, etc.)
- 5 default income categories (Salary, Freelance, etc.)
- 300+ merchant mappings for auto-categorization
- Default profile, account, and user settings

### Migration 3: Webhook Support (Optional)
If using Google Sheets real-time sync:
1. Open `/backend/database/migrations/001_add_webhook_secret.sql`
2. Copy and paste into Supabase SQL Editor
3. Click "Run"

---

## Step 6: Enable Email Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** provider is enabled (it should be by default)
3. Scroll down to **Email Templates** (optional but recommended):
   - Click "Confirm signup"
   - Customize the email template if you want
4. Under **Auth** → **URL Configuration**:
   - **Site URL:** `http://localhost:5173` (for development)
   - **Redirect URLs:** Add `http://localhost:5173/**`

Later, when you deploy to production:
- **Site URL:** `https://budgetwisetracker.netlify.app`
- **Redirect URLs:** Add `https://budgetwisetracker.netlify.app/**`

---

## Step 7: Test the Setup

Now let's test if everything works!

1. Start the development server:
```bash
cd /Users/ramilsharapov/Desktop/Budget\ planner/frontend
pnpm run dev
```

2. Open your browser to http://localhost:5173

3. Click "Sign Up" in the header

4. Create a test account:
   - Full Name: Test User
   - Email: your-email@example.com
   - Password: test123 (at least 6 characters)

5. Check your email for a confirmation link (if email confirmation is enabled)

6. Try logging in with your test account

7. You should be redirected to the Dashboard!

---

## Troubleshooting

### Error: "Missing Supabase environment variables"

**Problem:** The `.env` file is not being read.

**Solution:**
1. Make sure the `.env` file is in the `frontend/` directory
2. Make sure it starts with a dot: `.env` not `env` or `.env.local`
3. Restart the development server (`pnpm run dev`)

### Error: "Invalid API key"

**Problem:** The Supabase URL or anon key is incorrect.

**Solution:**
1. Double-check that you copied the entire URL and key
2. Make sure there are no extra spaces or quotes
3. The format should be:
   ```env
   VITE_SUPABASE_URL=https://abcdefg.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### Error: "Email not confirmed"

**Problem:** Supabase requires email confirmation by default.

**Solution:**
1. Check your email for the confirmation link
2. Or, disable email confirmation:
   - Go to Supabase Dashboard → Authentication → Providers
   - Click Email
   - Toggle OFF "Confirm email"

### Can't see the database tables

**Problem:** The schema SQL wasn't run correctly.

**Solution:**
1. Go to Supabase Dashboard → Table Editor
2. Check if you see tables: profiles, accounts, transactions, etc.
3. If not, go back to Step 5 and run the schema again

---

## Next Steps

Once authentication is working:

1. ✅ Authentication is set up
2. ⏭️ Build the dashboard UI with budget overview
3. ⏭️ Create transaction entry form
4. ⏭️ Build the pivot table view (like your Excel sheet)
5. ⏭️ Add CSV import functionality
6. ⏭️ Set up Google Sheets integration
7. ⏭️ Implement budget alerts

---

## Production Deployment

When you're ready to deploy to Netlify:

1. Add production environment variables in Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add `VITE_SUPABASE_URL` with your Supabase URL
   - Add `VITE_SUPABASE_ANON_KEY` with your anon key

2. Update Supabase Auth URLs:
   - Site URL: `https://budgetwisetracker.netlify.app`
   - Redirect URLs: `https://budgetwisetracker.netlify.app/**`

3. Deploy!

---

## Security Notes

1. **Never commit `.env` file** - It's already in `.gitignore`, but double-check
2. **Anon key is safe for frontend** - It's designed to be public
3. **Service role key is secret** - Only use in Netlify Functions, never in frontend
4. **Row Level Security is enabled** - Users can only access their own data
5. **Use environment variables** - Different keys for development and production

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase React Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-react)
