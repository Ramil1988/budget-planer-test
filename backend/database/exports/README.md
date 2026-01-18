# CSV Export Files for Manual Import

These CSV files can be used to manually import default categories and merchant mappings into Supabase for existing users.

## Files

1. **categories.csv** - 25 default categories (20 expense + 5 income)
2. **merchant_mappings.csv** - 300+ merchant-to-category mappings for auto-categorization

## How to Use

### Step 1: Get Your User ID

1. Go to Supabase Dashboard > Authentication > Users
2. Click on your user
3. Copy the `User UID` (a UUID like `12345678-1234-1234-1234-123456789abc`)

### Step 2: Prepare the CSV

1. Open the CSV file in a text editor (or spreadsheet app)
2. Find and Replace `YOUR_USER_ID_HERE` with your actual User UID
3. Save the file

**Using sed (command line):**
```bash
# Replace with your actual user ID
USER_ID="your-uuid-here"

# For categories
sed "s/YOUR_USER_ID_HERE/$USER_ID/g" categories.csv > categories_ready.csv

# For merchant mappings
sed "s/YOUR_USER_ID_HERE/$USER_ID/g" merchant_mappings.csv > merchant_mappings_ready.csv
```

### Step 3: Import into Supabase

1. Go to Supabase Dashboard > Table Editor
2. Select the `categories` table (or `merchant_mappings`)
3. Click "Insert" > "Import data from CSV"
4. Upload your prepared CSV file
5. Review the preview and click "Import"

## Categories Included

### Expense Categories (20)
- Afterschool
- Autocredit
- Clothes
- Food
- Food/Costco
- Fuel
- Government Loan
- Haircut
- Household items/Car
- Insurance
- Internet
- Massage
- Mobile/Internet
- Mortgage
- Electricity
- Pharmacy
- Property tax
- Subscriptions
- Unexpected
- Weekend

### Income Categories (5)
- Salary
- Freelance
- Investments
- Rental Income
- Other Income

## Alternative: Use SQL Function

Instead of CSV import, you can also run this SQL in Supabase SQL Editor:

```sql
-- Replace with your actual user ID
SELECT seed_new_user_data('your-uuid-here');
```

This will seed all categories, merchant mappings, profile, account, and settings in one command.

## Notes

- CSV import will skip duplicates (ON CONFLICT DO NOTHING)
- Make sure the seed functions exist before using the SQL alternative
- Run migration `002_auto_seed_new_users.sql` first to create all necessary functions
