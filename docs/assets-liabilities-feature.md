# Assets & Liabilities Feature

## Overview

The Assets & Liabilities tracker is a comprehensive net worth management tool that allows users to:

- Track all assets (Real Estate, Cash, Investments, Vehicles, etc.)
- Track all liabilities (Mortgages, Loans, Credit Cards, etc.)
- Calculate net worth (Assets - Liabilities)
- Monitor key financial metrics (Home Equity, Liquid Assets, Debt Ratio)
- View Financial Health Score (0-100 with breakdown)
- Track emergency fund coverage in months
- See debt payoff projections with interest calculations
- Visualize asset allocation with interactive donut chart
- Track net worth trends over time with line chart
- Save historical snapshots for trend analysis
- Compare net worth across different dates

## Features

### Summary Dashboard

Five key metrics displayed as cards with icons:

1. **Total Assets** 📊 - Sum of all asset values
2. **Total Liabilities** 💳 - Sum of all debt balances
3. **Net Worth** 💎 - Assets minus Liabilities (with trend indicator)
4. **Debt-to-Assets Ratio** 📈 - Percentage of debt relative to assets
5. **Equity Change** ↗️/↘️ - Comparison vs. a previous snapshot date

### Asset Allocation Chart

Interactive SVG donut chart showing asset breakdown by category:

- **Visual segments** - Color-coded by asset category
- **Hover effects** - Segment expands on hover, shows details in center
- **Legend** - Interactive list showing category name, color, and percentage
- **Center display** - Shows total assets or hovered category details
- **Small category grouping:**
  - Categories below 5% are grouped into "Other Assets"
  - Prevents tiny visual artifacts in the chart
  - Click "Other Assets" in legend to expand and see individual breakdown
  - Each small category shows name, amount, and percentage
- **Category colors:**
  - Real Estate: Purple (#6366F1)
  - Cash: Green (#10B981)
  - Savings Account: Blue (#3B82F6)
  - RRSP: Violet (#8B5CF6)
  - TFSA: Teal (#14B8A6)
  - Vehicle: Amber (#F59E0B)
  - Investment: Pink (#EC4899)
  - Other Assets: Gray (#9CA3AF)

### Financial Health Score

Circular gauge showing overall financial health (0-100):

**Scoring Algorithm:**
- **Low Debt Ratio** (30 points max) - 0% debt = 30 points, 100% debt = 0 points
- **Emergency Fund** (30 points max) - 6+ months = 30 points, scaled proportionally
- **Investments** (20 points max) - 30%+ of net worth in investments = 20 points
- **Positive Net Worth** (20 points max) - Based on asset-to-liability ratio

**Score Labels:**
- 80-100: Excellent (Green)
- 60-79: Good (Green)
- 40-59: Fair (Amber)
- 0-39: Needs Work (Red)

### Emergency Fund Indicator

Shows available assets coverage in months of expenses:

- **Months covered** - Available assets ÷ Monthly expenses
- **Progress bar** - Visual indicator toward 6-month target
- **Status labels:**
  - ✅ Excellent: 6+ months
  - 👍 Good: 3-6 months
  - 🔨 Building: 1-3 months
  - ⚠️ Critical: <1 month
- **Available assets include:** Cash + Savings Account + TFSA + RRSP (all accessible in emergencies)
- **Monthly expenses calculation:**
  1. **Primary:** Uses your monthly Budget plan amount from the Budget page
  2. **Fallback:** If no budget set, calculates average from actual transactions divided by actual months with data

### Key Metrics Cards

Four cards showing calculated financial metrics:

- **Emergency Fund** - Months of expenses covered by liquid assets
- **Home Equity** - Real Estate assets - Mortgage liabilities
- **Investments** - RRSP + TFSA + Investment accounts (% of net worth)
- **Liquid Assets** - Cash + Savings accounts (% of total assets)

### Assets Section

- **Green gradient header** with "+ Add Asset" button
- **Modal-based editing** - Click any row to open edit modal
- **Table columns:**
  - Category (with icon)
  - Name
  - Value (green text)
  - % of Total
  - Note
  - Actions (Delete button)
- **Empty state** - Friendly message when no assets exist

### Liabilities Section

- **Red gradient header** with "+ Add Debt" button
- **Modal-based editing** - Click any row to open edit modal
- **Table columns:**
  - Type (with icon)
  - Creditor
  - Balance (red text, with progress bar if original balance set)
  - Monthly Payment
  - Interest Rate (APR)
  - Actions (Delete button)
- **Empty state** - Celebratory message when debt-free

### Debt Payoff Projections

Card for each liability showing:

- **Creditor name** with icon
- **Outstanding balance**
- **Payoff date** - Calculated based on payments and interest
- **Time to payoff** - Years and months format
- **Total interest** - Amount of interest to be paid
- **Warning** - Alert if monthly payment doesn't cover interest

**Calculation:** Uses amortization formula with monthly compounding interest.

### Net Worth Trend Chart

SVG line chart showing net worth history:

- **Data points** - From saved snapshots (up to 20)
- **Gradient fill** - Blue gradient under the line
- **Hover tooltips** - Show date, assets, liabilities, net worth
- **Y-axis labels** - Auto-scaled with K/M formatting
- **X-axis labels** - Date format (M/D)
- **Empty state** - Encourages user to save first snapshot

### Modal Forms

**Asset Modal:**
- Category dropdown with icons
- Asset name (required)
- Current value (required)
- Note (optional)
- Form validation with error messages

**Liability Modal:**
- Debt type dropdown with icons
- Creditor name (required)
- Outstanding balance (required)
- Original balance (for progress tracking)
- Monthly payment
- Interest rate (0-100%)
- Note (optional)

**Delete Confirmation Dialog:**
- Warning icon
- Item name displayed
- "Are you sure?" message
- Cancel/Delete buttons

### Net Worth Snapshots

- **Auto-save on changes** - Snapshots are automatically saved when you:
  - Add, edit, or delete an asset
  - Add, edit, or delete a liability
  - Multiple changes on the same day update the same snapshot (upsert by date)
- **Record Date** picker - Set date for manual snapshot (useful for backdating)
- **Compare From** dropdown - Select previous snapshot to compare
- **Save Snapshot** button - Manual save for specific dates (auto-save handles daily updates)
- **Historical tracking** - View up to 20 most recent snapshots in trend chart
- **Trend analysis** - Equity Change card shows increase/decrease vs comparison date
- **Snapshot Management Modal:**
  - Click "Manage" button next to snapshot count to open modal
  - Scrollable table showing all snapshots (handles 100+ records)
  - Columns: Date, Assets, Liabilities, Net Worth, Delete button
  - Sticky header stays visible while scrolling
  - Delete any snapshot with confirmation

## Database Schema

### Tables

#### `asset_categories`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
name TEXT (e.g., "Real Estate", "Cash", "RRSP")
icon TEXT (emoji icon)
created_at TIMESTAMP
```

#### `liability_types`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
name TEXT (e.g., "Mortgage", "Car Loan", "Credit Card")
icon TEXT (emoji icon)
created_at TIMESTAMP
```

#### `assets`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
category_id UUID REFERENCES asset_categories(id)
name TEXT (asset name)
amount DECIMAL(12, 2) (asset value)
note TEXT (optional description)
display_order INTEGER (for sorting)
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### `liabilities`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
type_id UUID REFERENCES liability_types(id)
creditor TEXT (lender name)
outstanding_balance DECIMAL(12, 2) (current debt)
monthly_payment DECIMAL(12, 2) (regular payment)
interest_rate DECIMAL(5, 2) (APR percentage)
note TEXT (optional description)
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### `net_worth_snapshots`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
record_date DATE (snapshot date)
total_assets DECIMAL(12, 2)
total_liabilities DECIMAL(12, 2)
equity DECIMAL(12, 2) (net worth)
assets_breakdown JSONB (all assets at snapshot time)
liabilities_breakdown JSONB (all liabilities at snapshot time)
created_at TIMESTAMP
UNIQUE(user_id, record_date) -- One snapshot per user per date
```

### Security

- **Row Level Security (RLS)** enabled on all tables
- **Policy:** Users can only access their own data (`auth.uid() = user_id`)
- **Indexes** created for optimal query performance
- **Triggers** automatically update `updated_at` timestamp

### Auto-Seeding

New users automatically receive:

- **8 default asset categories:**
  - 🏠 Real Estate
  - 💵 Cash
  - 🏦 Savings Account
  - 📊 RRSP
  - 💼 TFSA
  - 🚗 Vehicle
  - 📈 Investment
  - 💎 Other Assets

- **7 default liability types:**
  - 🏡 Mortgage
  - 🚙 Car Loan
  - 🎓 Student Loan
  - 💳 Credit Card
  - 💰 Personal Loan
  - 📝 Line of Credit
  - 💸 Other Debt

## UI/UX Design

### Color System

Uses `useDarkModeColors()` hook for consistent theming:

- **Card backgrounds:** `colors.cardBg`
- **Text:** `colors.textPrimary`, `colors.textSecondary`, `colors.textMuted`
- **Borders:** `colors.borderColor`, `colors.borderSubtle`
- **Success (assets):** `colors.success`, `colors.successBg`
- **Danger (liabilities):** `colors.danger`, `colors.dangerBg`
- **Primary actions:** `colors.primary`, `colors.primaryHover`

### Gradients

- **Assets section header:** `linear-gradient(135deg, #10B981 0%, #059669 100%)`
- **Liabilities section header:** `linear-gradient(135deg, #EF4444 0%, #DC2626 100%)`
- **Summary cards:** Blue, Green, Red, Purple gradients with 5% opacity overlay

### Animations

```css
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Applied to cards and rows for smooth appearance.

### Responsive Design

- **Summary cards:**
  - Mobile: 2 columns (1fr 1fr)
  - Tablet: 3 columns
  - Desktop: 5 columns

- **Tables:**
  - Desktop: 6-column grid layout
  - Mobile: Stacked cards (column headers hidden)

- **Spacing:**
  - Mobile: padding 4, gap 3
  - Desktop: padding 6, gap 4

### Dark Mode

Full support with automatic theme switching:
- Light backgrounds: white, #FAFAF9
- Dark backgrounds: #18181B, #09090B
- All colors adapt via `useDarkModeColors()` hook

## User Workflow

### Adding an Asset

1. Click **"+ Add Asset"** button (green section header)
2. Modal opens with form fields
3. Select category from dropdown (Real Estate, Cash, etc.)
4. Enter asset name (e.g., "Main Residence", "TD Savings")
5. Enter current value (e.g., 500000, 25000)
6. Add optional note (e.g., "Current market value")
7. Click **"Add Asset"** to save
8. Total Assets updates automatically
9. **Today's snapshot is auto-saved** (no manual action needed!)

### Adding a Liability

1. Click **"+ Add Debt"** button (red section header)
2. Modal opens with form fields
3. Select debt type from dropdown (Mortgage, Car Loan, etc.)
4. Enter creditor name (e.g., "TD Bank", "Honda Finance")
5. Enter outstanding balance (e.g., 350000)
6. Enter monthly payment (e.g., 2500)
7. Enter interest rate (e.g., 3.5)
8. Click **"Add Debt"** to save
9. Total Liabilities updates automatically
10. **Today's snapshot is auto-saved** (no manual action needed!)

### Snapshots (Automatic)

Snapshots are now **automatically saved** whenever you:
- Add, edit, or delete any asset
- Add, edit, or delete any liability

Multiple changes on the same day update the same snapshot. No manual "Save Snapshot" button needed for daily tracking!

### Manual Snapshot (for Backdating)

Use the manual "Save Snapshot" button only when you want to:
1. Record a snapshot for a **past date** (backdate)
2. Set a specific **Record Date** using the date picker
3. Click **"Save Snapshot"** to save

### Comparing Net Worth

1. Ensure at least 2 snapshots exist
2. Select previous date from **"Compare From"** dropdown
3. **Equity Change** card shows difference:
   - Green arrow ↗ if increased
   - Red arrow ↘ if decreased
   - Dollar amount of change

### Managing Snapshots

1. Click **"Manage"** button next to snapshot count
2. Modal opens showing all snapshots in a table
3. View Date, Assets, Liabilities, Net Worth for each
4. Click **"Delete"** to remove any snapshot
5. Scrollable list handles 100+ snapshots

## API/Database Operations

### Load Data
```javascript
// Fetch asset categories, liability types, assets, liabilities, and snapshots
const { data: assetCats } = await supabase
  .from('asset_categories')
  .select('*')
  .eq('user_id', user.id)
  .order('name');
```

### Add Asset
```javascript
const newAsset = {
  user_id: user.id,
  category_id: categoryId,
  name: 'New Asset',
  amount: 0,
  display_order: assets.length
};
const { data } = await supabase
  .from('assets')
  .insert([newAsset])
  .select();
```

### Update Asset (Inline)
```javascript
const { error } = await supabase
  .from('assets')
  .update({ name, amount, category_id, note })
  .eq('id', assetId);
```

### Delete Asset
```javascript
const { error } = await supabase
  .from('assets')
  .delete()
  .eq('id', assetId);
```

### Save Snapshot
```javascript
const snapshot = {
  user_id: user.id,
  record_date: recordDate,
  total_assets: totalAssets,
  total_liabilities: totalLiabilities,
  equity: totalAssets - totalLiabilities,
  assets_breakdown: JSON.stringify(assets),
  liabilities_breakdown: JSON.stringify(liabilities)
};
const { error } = await supabase
  .from('net_worth_snapshots')
  .upsert([snapshot], { onConflict: 'user_id,record_date' });
```

## Future Enhancements

### High Priority
- [ ] Net Worth Trend Chart (line chart using Chart.js or Recharts)
- [ ] Export to PDF/Excel
- [ ] Percentage of total assets calculation for each asset
- [ ] Debt payoff calculator
- [ ] Sorting and filtering options

### Medium Priority
- [ ] Asset/Liability attachments (upload documents)
- [ ] Monthly auto-snapshots (scheduled job)
- [ ] Net worth goals and targets
- [ ] Asset appreciation tracking
- [ ] Liability payoff projections

### Low Priority
- [ ] Multi-currency support
- [ ] Asset/Liability categories customization
- [ ] Data import from CSV
- [ ] Asset depreciation tracking
- [ ] Retirement projection calculator

## Testing Checklist

### Functional Tests
- [ ] Add asset with all fields
- [ ] Edit asset inline
- [ ] Delete asset
- [ ] Add liability with all fields
- [ ] Edit liability inline
- [ ] Delete liability
- [ ] Save snapshot
- [ ] Compare two snapshots
- [ ] Verify key metrics calculations
- [ ] Verify total assets calculation
- [ ] Verify total liabilities calculation
- [ ] Verify net worth calculation

### UI Tests
- [ ] Responsive layout on mobile (320px)
- [ ] Responsive layout on tablet (768px)
- [ ] Responsive layout on desktop (1200px+)
- [ ] Dark mode appearance
- [ ] Light mode appearance
- [ ] Animations play smoothly
- [ ] Empty states display correctly
- [ ] Loading states display correctly

### Security Tests
- [ ] User can only see their own assets
- [ ] User can only see their own liabilities
- [ ] User can only see their own snapshots
- [ ] RLS policies prevent unauthorized access
- [ ] Input validation prevents SQL injection

## File Locations

### Frontend
- **Page:** `/frontend/src/pages/AssetsLiabilities.jsx`
- **Route:** `/assets-liabilities` (protected)
- **Navigation:** Header.jsx (Desktop: "Assets", Mobile: "Assets & Liabilities")

### Backend
- **Migration:** `/backend/database/migrations/003_assets_liabilities.sql`
- **Auto-seed:** `/backend/database/migrations/004_auto_seed_assets_liabilities.sql`
- **README:** `/backend/database/migrations/README.md`

### Documentation
- **This file:** `/docs/assets-liabilities-feature.md`

## Migration Instructions

See `/backend/database/migrations/README.md` for detailed migration instructions.

Quick start:
1. Run `003_assets_liabilities.sql` in Supabase SQL Editor
2. Run `004_auto_seed_assets_liabilities.sql` in Supabase SQL Editor
3. Verify tables exist: `SELECT * FROM asset_categories LIMIT 5;`
4. Navigate to `/assets-liabilities` in the app
5. Start tracking your net worth!

## Support

For issues or questions:
1. Check database migration logs
2. Verify RLS policies are enabled
3. Check browser console for errors
4. Verify Supabase connection
5. Test with a new user account (auto-seeding)
