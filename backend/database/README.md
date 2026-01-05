# Database Setup Instructions

This directory contains SQL scripts to set up your Budget Planner database in Supabase.

## Quick Setup

1. **Create Database Schema** (First time only)
   - Open Supabase SQL Editor
   - Run `schema.sql` to create all tables, triggers, and RLS policies

2. **Seed Categories for All Users**
   - Run `seed-all.sql` in Supabase SQL Editor
   - This will automatically seed categories and patterns for ALL existing users
   - Creates a reusable function for future users

## What seed-all.sql Does

When you run this script, it will:

1. ✅ Add unique constraint to categories table (prevents duplicates)
2. ✅ Create `category_patterns` table
3. ✅ Set up RLS policies
4. ✅ Create a `seed_user_categories()` function
5. ✅ Automatically seed all 20 categories + 300+ patterns for **every existing user**

## Automatic Seeding for New Users

After running `seed-all.sql`, the `seed_user_categories()` function is available in your database.

**Option 1: Call from SQL Editor**
```sql
-- Seed categories for a specific user
SELECT seed_user_categories('user-uuid-here');
```

**Option 2: Call from Application Code**
You can call this function when a new user signs up:

```javascript
// In your sign-up handler
const { data, error } = await supabase.rpc('seed_user_categories', {
  target_user_id: user.id
});
```

**Option 3: Trigger on User Creation**
Create a database trigger to automatically seed categories when a new user is created:

```sql
CREATE OR REPLACE FUNCTION auto_seed_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_user_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_seed_new_user();
```

## All Categories

The seed script creates these 20 expense categories with merchant patterns:

1. **Afterschool** - Dance classes, daycare, schools
2. **Autocredit** - Car loans, loan payments
3. **Clothes** - Clothing stores, shoe stores
4. **Food** - Grocery stores, supermarkets
5. **Food/Costco** - Costco food purchases
6. **Fuel** - Gas stations
7. **Government Loan** - Student loans
8. **Haircut** - Barbers, hair salons
9. **Household items/Car** - Amazon, Canadian Tire, IKEA, etc.
10. **Insurance** - Car/home insurance
11. **Internet** - Internet service providers
12. **Massage** - Massage therapy, wellness
13. **Mobile/Internet** - Cell phone providers
14. **Mortgage** - Mortgage payments
15. **NB Power** - Electricity bills
16. **Pharmacy** - Drug stores, health products
17. **Property tax** - Municipal taxes
18. **Subscriptions** - Digital subscriptions, gym memberships
19. **Unexpected** - Miscellaneous expenses
20. **Weekend** - Restaurants, entertainment, travel

## Category Pattern Matching

Transactions are automatically categorized based on merchant names:

- "COSTCO GAS W1345" → matches "COSTCO GAS" → **Fuel**
- "COSTCO WHOLESALE W1345" → matches "COSTCO WHOLESALE" → **Food/Costco**
- "MCDONALD'S #1234" → matches "MCDONALD'S" → **Weekend**
- "ROGERS BILL" → matches "ROGERS" → **Mobile/Internet**

## Files Overview

- **schema.sql** - Complete database schema (tables, triggers, RLS)
- **seed-all.sql** - Seeds categories and patterns for all users
- **README.md** - This file

## Troubleshooting

**Error: "constraint already exists"**
- Safe to ignore - the script checks before creating

**Error: "function already exists"**
- Safe to ignore - the script uses `CREATE OR REPLACE`

**Error: "policy already exists"**
- Safe to ignore - the script drops before creating

**Categories not showing up for a user?**
- Run: `SELECT seed_user_categories('user-id-here');`
- Check: `SELECT * FROM categories WHERE user_id = 'user-id-here';`

## Next Steps

After seeding:
1. Import transactions from Google Sheets
2. Transactions will be automatically categorized
3. Manage patterns via the Categories page
4. View categorized transactions in your app
