# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BudgetWise is a full-stack budget tracking application built with React (frontend), Netlify Functions (serverless backend), and Supabase (database). The project was migrated from vanilla HTML/CSS/JS to React (v1.0.0), then migrated from vanilla CSS to Chakra UI (v2.0.0), and recently added backend infrastructure with Supabase PostgreSQL database and serverless API using Netlify Functions.

**Current Version:** 2.0.0

**Technology Stack:**
- **Frontend:** React 19.2.3 + Chakra UI 3.30.0 + Vite 7.2.7
- **Backend:** Netlify Functions (Serverless) + TypeScript
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Authentication:** Supabase Auth
- **Deployment:** Netlify (Frontend + Backend Functions)
- **Package Manager:** pnpm 10.24.0

## Documentation Structure

This project maintains comprehensive documentation in the `docs/` directory. **Always read these documents first** when working on the project:

- **`FOR_RAMIL.md`** (project root) - Plain-language learning document: architecture by analogy, technology reasoning, lessons learned and war stories. Written for reading, not for reference
- **`docs/architecture.md`** - Complete technical architecture, technology stack, component structure, and design patterns
- **`docs/changelog.md`** - Version history and detailed change log
- **`docs/project-status.md`** - Current status, roadmap, tasks, and priorities
- **`docs/technical-reference.md`** - Code patterns, examples, and quick reference guides

**Important:** When making significant changes:
1. Read the relevant documentation first
2. Make your changes
3. Update the appropriate documentation files
4. Add an entry to `docs/changelog.md` under `[Unreleased]`
5. Update `docs/project-status.md` if completing tasks or adding new ones

## Development Commands

**Package Manager:** This project uses `pnpm` (v10.24.0)

**Project Structure:** The project consists of `frontend/` (React app) and `netlify/functions/` (serverless backend).

From the root directory:
- `netlify dev` - Start development server with frontend and functions (http://localhost:8888)
- `pnpm run dev:frontend` - Start frontend Vite development server only (http://localhost:5173/)
- `pnpm run build:frontend` - Build frontend for production
- `pnpm run test:frontend` - Run frontend Playwright tests
- `pnpm run install:all` - Install dependencies for root and frontend
- `netlify deploy --prod` - Deploy to Netlify production

From the frontend directory (`cd frontend`):
- `pnpm run dev` - Start Vite development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build locally
- `pnpm run test` - Run all Playwright tests
- `pnpm run test:ui` - Run tests with interactive UI (recommended for development)
- `pnpm run test:headed` - Run tests in headed mode (see browser)
- `pnpm run test:debug` - Debug tests with Playwright inspector
- `npx playwright test auth.spec.js` - Run specific test file
- `npx playwright test -g "login"` - Run tests matching pattern

Netlify Functions (serverless backend):
- Functions are located in `netlify/functions/`
- Accessed at `/.netlify/functions/{function-name}` or `/api/*` (via redirect)
- Automatically deployed with frontend to Netlify
- No separate backend server needed

## Architecture

### Project Structure

```
.
├── frontend/             # Frontend React application
│   ├── src/
│   │   ├── main.jsx              # Application entry point, wraps App with BrowserRouter
│   │   ├── App.jsx               # Root component with routing configuration
│   │   ├── components/           # Reusable UI components
│   │   │   ├── Header.jsx        # Navigation with mobile menu toggle
│   │   │   └── Footer.jsx        # Footer with branding
│   │   ├── pages/                # Route-level page components
│   │   │   ├── Home.jsx          # Homepage with hero and feature preview
│   │   │   └── Features.jsx      # Detailed features page
│   │   └── styles/
│   │       └── styles.css        # Global CSS with CSS custom properties
│   ├── public/                   # Static assets
│   ├── images/                   # Image assets
│   ├── tests/                    # Playwright E2E test files
│   │   ├── test-utils.js         # Shared test utilities and helpers
│   │   ├── auth.spec.js          # Authentication tests
│   │   ├── dashboard.spec.js     # Dashboard tests
│   │   ├── transactions.spec.js  # Transaction tests
│   │   ├── budget.spec.js        # Budget tests
│   │   ├── categories.spec.js    # Category tests
│   │   ├── recurring.spec.js     # Recurring payments tests
│   │   ├── reports.spec.js       # Reports tests
│   │   ├── settings.spec.js      # Settings tests
│   │   ├── import.spec.js        # Import tests
│   │   └── mobile.spec.js        # Mobile responsiveness tests
│   ├── index.html
│   ├── vite.config.js
│   ├── playwright.config.js
│   └── package.json
├── netlify/              # Serverless backend
│   └── functions/                # Netlify Functions (TypeScript)
│       ├── auth.ts               # Authentication endpoints
│       ├── accounts.ts           # Accounts CRUD
│       ├── transactions.ts       # Transactions CRUD
│       ├── categories.ts         # Categories CRUD
│       └── budgets.ts            # Budgets CRUD
├── backend/              # Legacy NestJS (to be removed)
│   └── database/
│       └── schema.sql            # Supabase PostgreSQL database schema
├── docs/                 # Project documentation
│   ├── tech-stack.md             # Technology stack details
│   ├── architecture.md           # Architecture documentation
│   ├── changelog.md              # Version history
│   └── project-status.md         # Current status and roadmap
├── netlify.toml          # Netlify deployment configuration
└── package.json          # Root package.json with scripts
```

### Routing

React Router is configured in `App.jsx` with two routes:
- `/` - Home page (hero section, feature cards)
- `/features` - Features page (detailed feature descriptions)

The Header component uses `useLocation` hook to highlight active navigation links.

### State Management

The application uses React's built-in state management:
- **Header component:** `useDisclosure` hook (Chakra UI) for mobile menu toggle
- **Home & Features pages:** `useState` for scroll-to-top button visibility
- **Router state:** `useLocation` hook for active link detection

**Future:** Context API for budget data (see `docs/project-status.md` for roadmap)

### Styling Approach

**Current (v2.0.0):**
- Chakra UI v3.30.0 component library
- Emotion for CSS-in-JS (required by Chakra UI)
- Framer Motion for animations (required by Chakra UI)
- ChakraProvider wraps entire app in `main.jsx`
- Uses Chakra's default theme system
- Responsive props using object syntax: `{{ base: 'value', md: 'value' }}`
- No custom CSS files
- **Dark mode support** via `next-themes` library (integrated with Chakra UI)

**Redesigned pages (Budget, Recurring, Reports, Assets & Liabilities, Transactions, Add transaction — 2026-11-24):**
- They follow the Dashboard's look and do **not** use `useDarkModeColors`. The shared stylesheet is `frontend/src/styles/ledger.css`: tokens `--bw-*` (paper, ink, muted, border, accent, positive, negative, caution, track, fill) and classes `bw-*` (`bw-masthead`, `bw-title`, `bw-tabs`, `bw-segment`, `bw-ledger`, `bw-figures`, `bw-panel`, `bw-form`, `bw-field`, `bw-button`, `bw-dialog`, `bw-note`, `bw-nothing`). Each page adds `styles/<page>.css`
- A page's root is `<Box className="bw-surface bw-page">`. The tokens live on `.bw-surface` (and `.dark .bw-surface`), so **anything rendered in a portal needs `bw-surface` too**. Use `components/DialogFrame.jsx` for dialogs
- Structure: `pages/<Page>.jsx` keeps loading and saving; `components/<page>/` holds the page's charts, lists and forms; `lib/<page>View.js` (`budgetMath.js` for Budget) holds pure functions with `node --test` tests, all listed in `test:unit`
- Charts are hand-written HTML and SVG. A line is an SVG stretched to its plot (`preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`); points and figures are HTML laid over it. Proportions are exact: a part too small to label is named in text, never drawn larger
- **GOTCHA:** never give a flex item both `aspect-ratio` and a `min-height`. Safari derives the width from the height and the element runs out of its panel; Chrome keeps the width. The Reports treemap did this. Size from the container and measure the box instead (`ExpenseTreemap.jsx`). Check layout in WebKit, not only Chromium: `reports.spec.js` asserts that every tile is inside its panel
- Dropdowns are native `<select>`; dates are local (`today()` in `lib/transactionView.js`), never `toISOString()`
- The Transactions filters are one object (`NO_FILTERS` in `lib/transactionView.js`) applied by `applyFilters()`; the filtered list is derived with `useMemo`, never kept in state. A new filter is a field in that object, a control in `components/transactions/Filters.jsx` and an entry in its `chips` list, so that it is written out under the bar and can be removed on its own
- **GOTCHA:** on Transactions the trash button writes at once. The Playwright tests for these pages only read: they never press it, cancel every dialog, and the Transactions and Add transaction tests fail if the page sends anything but a read to `/rest/v1/`

**Dark Mode Implementation:**
- Uses `ColorModeProvider` from `@/components/ui/color-mode`
- Toggle via `ColorModeButton` in Header (sun/moon icons)
- Custom `useDarkModeColors` hook (`frontend/src/lib/useDarkModeColors.js`) provides semantic color tokens:
  - `pageBg`, `cardBg`, `inputBg`, `modalBg` - Background colors
  - `textPrimary`, `textSecondary`, `textMuted` - Text colors
  - `borderColor`, `borderSubtle`, `borderStrong` - Border colors
  - `success`, `successBg`, `successBorder` - Success status colors
  - `danger`, `dangerBg`, `dangerBorder` - Error/danger status colors
  - `warning`, `warningBg`, `warningBorder` - Warning status colors
  - `info`, `infoBg`, `infoBorder` - Info status colors
- Theme persists in localStorage (key: "theme")
- Usage pattern:
  ```jsx
  import { useDarkModeColors } from '../lib/useDarkModeColors';

  function MyComponent() {
    const colors = useDarkModeColors();
    return <Box bg={colors.cardBg} color={colors.textPrimary}>...</Box>;
  }
  ```

**Previous (v1.0.0):**
- Single global CSS file with CSS custom properties
- Vanilla CSS with BEM-like naming
- Migrated to Chakra UI in v2.0.0

### Key Implementation Details

**Mobile Menu:**
- Uses Chakra UI's `useDisclosure` hook for toggle state
- Desktop: HStack with horizontal navigation
- Mobile: Collapsible Stack with hamburger IconButton

**Scroll-to-Top Button:**
- Managed via React useState (visibility based on scroll position)
- Appears after scrolling 300px
- Chakra UI IconButton with fixed positioning

**Feature Cards:**
- Use Chakra UI's VStack and SimpleGrid components
- Staggered animation using CSS animation delays
- Hover effects via Chakra's `_hover` prop

**Navigation:**
- React Router's `Link` wrapped in Chakra's `Box` component (`as={RouterLink}`)
- Active link highlighting using `useLocation` hook
- Color changes via Chakra's color tokens

**Images:**
- Stored in `frontend/images/` directory
- Referenced using `/images/` paths (Vite's public asset handling)
- Displayed using Chakra's `Box` component with `as="img"`

## Backend (Netlify Functions)

The backend is built with Netlify Functions, a serverless platform that runs event-driven backend logic without managing servers.

**Technology Stack:**
- **Platform:** Netlify Functions (AWS Lambda)
- **Runtime:** Node.js with TypeScript
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **Architecture:** Serverless, event-driven functions
- **API Style:** RESTful

**Project Structure:**
- `netlify/functions/` - Serverless function handlers
- `backend/database/schema.sql` - Complete Supabase PostgreSQL schema with triggers and RLS
- Environment variables configured in Netlify dashboard

**Key Features:**
- Serverless - no servers to manage, auto-scaling
- Zero cost when not in use (pay per invocation)
- Single deployment platform with frontend (Netlify)
- CORS handled automatically by Netlify
- Functions accessible at `/.netlify/functions/{name}` or via `/api/*` redirects

**Development Patterns:**
- Each function handles specific HTTP endpoints
- Use Supabase JS client for database queries
- JWT token validation via Supabase Auth
- TypeScript for type safety
- Functions run independently (stateless)

**Database Schema:**
- **Tables:**
  - `profiles` - User profiles linked to Supabase Auth
  - `accounts` - Financial accounts (bank accounts, wallets, etc.) with balance tracking
  - `categories` - Income and expense categories
  - `transactions` - Individual transactions with running balance
  - `budgets` - Monthly budget planning
  - `budget_categories` - Category-level budget limits and spent tracking
- **Features:**
  - Running balance tracking (automatic via triggers)
  - Automatic account balance updates on transactions
  - Budget spent amount tracking (linked to transactions)
- **Automation:** 3 trigger functions for automatic calculations:
  - `update_balance()` - Updates account balance on transaction insert
  - `calc_running_balance()` - Calculates running balance for each transaction
  - `update_spent()` - Updates budget_categories.spent when expenses are added
- **Security:** Row Level Security (RLS) enabled on all tables
  - Users can only access their own data (user_id = auth.uid())
  - Budget categories secured via budget ownership check
- See `backend/database/schema.sql` for complete schema definition

**Recurring Payments Auto-Add:**
- A recurring payment with `auto_add = true` records its own transaction when the due date arrives — no manual entry
- Runs on the client at app open: `App.jsx` calls `generateDueRecurringTransactions()` from `frontend/src/lib/recurringAutoAdd.js` (no server cron, RLS applies)
- Idempotency: generated transactions carry `transactions.recurring_payment_id`, with a unique index on `(recurring_payment_id, date)`. Insert uses `upsert(..., { onConflict: 'recurring_payment_id,date', ignoreDuplicates: true })`. Soft-deleted generated rows are **not** regenerated
- No backfill: generation starts at `recurring_payments.auto_add_from` (set to today when the toggle is switched on), capped at 366 days of catch-up
- `recurring_payments.match_description` = how the payment reads on the bank statement. Used to recognise the same payment coming from Google Sheets: same type + exact amount + description contains it + within 4 days. Applied in both directions — auto-add skips an occurrence the bank already reported, and all three import paths call `filterOutRecurringDuplicates()`: `ImportTransactions.jsx`, `AutoSyncContext.jsx`, and `netlify/functions/google-sheets-webhook.js` (own copy of the matcher, keep the 4-day window in sync). Without `match_description` nothing is cross-matched
- Migration: `backend/database/migrations/008_recurring_auto_add.sql`

**Import Deduplication (import signature):**
- A bank row is identified by `date|UPPERCASED description|abs(amount).toFixed(2)`. `importSignature()` in `frontend/src/lib/importSignature.js` is the single implementation, imported by the browser and by the Netlify functions; the only other copy is the SQL backfill in migration 010
- The signature is stored in `transactions.import_signature`: written at insert by all four import paths (`AutoSyncContext.jsx`, `ImportTransactions.jsx`, `netlify/functions/google-sheets-webhook.js`, `netlify/functions/_lib/assistant-import-data.mjs`), and stamped from the row's values the first time an edit changes amount or description (`signatureStamp()`, used by the inline amount edit in `Transactions.jsx` and by the assistant's `confirm_changes`). It is never rewritten afterwards
- "Already imported" means the stored signature **or** the signature of the current values of any of the user's rows, trashed rows included (`knownImportSignatures()`). The second half keeps manual rows and databases without the migration working as before
- **GOTCHA:** any new code path that edits `amount`, `description` or `date` of a transaction must write `signatureStamp(row)` in the same update, or the next Google Sheets sync imports the original bank row again
- **Migration required:** `backend/database/migrations/010_import_signature.sql`. Without it the code detects the missing column (`isMissingImportSignatureColumn()`: `42703` on a select, `PGRST204` on a write) and falls back to the old behaviour — signatures computed from current values only, plus the assistant's replace-instead-of-edit workaround. No extra grant is needed: the grants in 009 are table-level and cover the new column
- Known limit: permanently deleting an imported row (*Empty trash*) deletes its signature with it, so a polling sync imports it again while it is still in the sheet
- Unit tests: `netlify/functions/_lib/import-signature.test.mjs` (part of `pnpm run test:unit`)

**Liability balances (interest first):**
- A liability linked to a spending category (`liabilities.linked_category_id`) has its balance worked out by the database, not by the app. Migration: `backend/database/migrations/011_liability_interest.sql` (replaces the triggers of 005 and 007)
- The balance is recalculated from an **anchor** — `balance_anchor`, `balance_anchor_date`, `balance_anchor_at`: a balance known to be true at a moment — every time a transaction in the category is inserted, updated or deleted (`recalculate_liabilities_on_transaction()` → `recalculate_liability_balance()`). Each payment after the anchor covers `balance x interest_rate x days / 365` of interest first; the rest reduces the debt. No rate means the whole payment comes off
- Trashed transactions (`deleted_at`) do not count; restoring one counts it again. The page's payment history filters them out the same way
- Creating a liability, or editing its balance, link, start date or rate, sets a new anchor (`anchor_liability_balance()`, which tells a direct edit from the trigger's own update by `pg_trigger_depth()`). To bring a balance in line with the lender, type the lender's figure into the form
- Which liability a payment belongs to is unchanged from 007: the one linked to the category that had started by the transaction's date, the most recently started first (`liability_for_payment()`)
- It is simple daily interest, so it is an estimate: a Canadian fixed mortgage compounds twice a year and differs by a few dollars a month
- **Migration required.** Without it the old triggers stay: the whole payment comes off the balance and trashing a payment changes nothing. The app works either way. Applied to the production database on 2026-11-24
- Verified on an embedded PostgreSQL (PGlite) with 18 scenarios; that harness is not in the repository

**Auto-Seeding for New Users:**
- Migration: `backend/database/migrations/002_auto_seed_new_users.sql`
- Automatically creates for each new user:
  - 20 expense categories (Food, Fuel, etc.)
  - 5 income categories (Salary, Freelance, etc.)
  - 300+ merchant mappings for auto-categorization
  - Default profile, account, and user settings
- CSV exports available in `backend/database/exports/` for manual import

## Database & Supabase

### Supabase Setup

**Database:** PostgreSQL hosted on Supabase
**Authentication:** Supabase Auth (integrated with database via `auth.users` table)
**Connection:** Direct SQL queries using `pg` (PostgreSQL client) - no ORM

### Environment Configuration

The backend requires the following environment variables in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Note:** Never commit the `.env` file to git. Use `.env.example` as a template.

### Database Connection

**Supabase JS Client** is used in Netlify Functions to interact with the database:

1. Install in function: `npm install @supabase/supabase-js`
2. Create Supabase client in each function
3. Use client methods for queries (type-safe)
4. JWT validation built into Supabase client

### Working with the Database

**Query Pattern (Using Supabase JS Client):**
```typescript
// Netlify Function example
import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Get user from JWT token
  const token = event.headers.authorization?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);

  // Query with automatic RLS filtering
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id);

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};
```

**Security:**
- Always use Row Level Security (RLS) policies (already enabled in schema)
- **Data API grants are a separate control from RLS.** Since **30 Oct 2026** Supabase grants `anon`/`authenticated`/`service_role` nothing on new `public` tables, so every new table needs an explicit `GRANT` or supabase-js fails with `42501 permission denied for table`. Put the grants in the same migration that creates the table; `backend/database/migrations/009_data_api_grants.sql` holds the full matrix. Scope them to what the code does — `anon` gets nothing, `service_role` only the tables `netlify/functions/*.js` touch — and never use `GRANT ALL`.
- **GOTCHA:** the balance triggers (`update_balance`, `update_spent`, and for liabilities `recalculate_liabilities_on_transaction` — `update_liability_on_transaction` before migration 011) are plain `plpgsql`, **not** `SECURITY DEFINER`, so they run as the role that wrote the row. Any role allowed to write `transactions` also needs `SELECT` on `transactions`, `UPDATE` on `accounts`, `UPDATE` on `budget_categories` and `SELECT, UPDATE` on `liabilities`. The auto-seed functions *are* `SECURITY DEFINER` and need no grants.
- **GOTCHA:** `transactions` uses soft delete (`deleted_at`). Every read that feeds a total, a chart or a list of live transactions needs `.is('deleted_at', null)`; without it trashed rows are counted. Until 2026-11-23 the Dashboard, Reports, the 12-month expense average on Assets & Liabilities and the budget notifications lacked it. The payment history of a liability (Assets & Liabilities) filters them out too since 2026-11-24: with migration 011 a trashed payment no longer counts towards the balance
- Validate Supabase JWT tokens in Netlify Functions
- Never expose database credentials in frontend code
- Supabase client handles SQL injection prevention automatically

**Important:** The database schema (`backend/database/schema.sql`) should be executed in Supabase SQL editor. It includes:
- Table definitions
- Trigger functions for automatic calculations
- Row Level Security policies
- All required indexes and constraints

## Platform-Specific Notes

**macOS ARM64 (Apple Silicon):**
- The project requires `esbuild@0.27.1` and `@esbuild/darwin-arm64@0.27.1` pinned to exact versions
- If encountering esbuild platform errors, remove `node_modules` and `pnpm-lock.yaml`, then run `pnpm install --force`
- The `@rollup/rollup-darwin-arm64` package is also required for Vite to work properly

## Component Patterns

**Page Components:**
- Each page handles scroll-to-top button in local state
- Use Chakra UI's `Box` with `as="main"` for semantic HTML
- Wrapped in `Container` component (maxW="1200px") for consistent layout
- See `docs/technical-reference.md` for component templates

**Layout Components:**
- **Header:** Sticky navigation with mobile responsive menu, uses Chakra UI components
- **Footer:** Dark footer with branding, uses Chakra UI Container and VStack
- Both rendered once in App.jsx, wrapping all routes

**Chakra UI Patterns:**
- Layout: Box, Container, Flex, Stack, HStack, VStack, SimpleGrid
- Typography: Heading, Text
- Interactive: Button, IconButton
- See `docs/technical-reference.md` for detailed usage patterns

## Assets & Liabilities

**Key Files:** `frontend/src/pages/AssetsLiabilities.jsx`, `frontend/src/components/assets/*`, `frontend/src/lib/assetsView.js` (+ `assetsView.test.js`), `frontend/src/styles/assets.css`

- **Categories are found by name.** The emergency fund is `Cash + Savings Account + TFSA + RRSP`, investments are `RRSP + TFSA + Investment`, home equity is `Real Estate` less liabilities of type `Mortgage` (`measures()`). Renaming one of the seeded categories takes it out of these sums. An RRSP is meant to be recorded at what would be left after tax
- **Financial health** (`healthScore()`), 100 points in three parts: debt against assets `40 x (1 - liabilities / assets)`; emergency fund `5 x months covered`, 30 at six months; investments `150 x investments / assets`, 30 at 20%. Named Excellent / Good / Fair / Needs work at 80 / 60 / 40, and coloured at the same points. Paying a debt off never lowers it (there is a test for that)
- **Monthly spending** for the emergency fund is this month's budget total when there is one, otherwise the average of the last 12 months of expenses; the panel says which
- **Snapshots** (`net_worth_snapshots`) are saved on every change to an asset or a liability and with the Save snapshot button, one per local date. Choosing a saved date shows its totals, and its bars, score and fund from the lists stored with it; the two lists of assets and liabilities always show today. A past date cannot be saved over
- **The balance sheet bars** are one scale for both: `balanceSheet()` returns each segment's part of `max(assets, liabilities)`
- **Debts** show the payoff from `payoff()` (the linked recurring payment sets the schedule) and the balance from the database: see **Liability balances** above

## Budget Assistant

A signed-in chat that answers questions about the user's own data and can add records on request.

**Key Files:**
- `netlify/functions/budget-assistant.mjs` - the single endpoint (`POST /.netlify/functions/budget-assistant`)
- `netlify/functions/_lib/assistant-*.mjs` - tools and lookups (`assistant-data`), budget review (`assistant-budget`), CSV/PDF/screenshot import (`assistant-import`, `assistant-import-data`), transaction confirmation (`assistant-transaction`), chart payloads (`assistant-visuals`)
- `frontend/src/components/BudgetAssistant.jsx` (+ `AssistantReplyVisuals`, `AssistantReplyFollowUps`, `AssistantCategoryDetails`) and `frontend/src/styles/budget-assistant.css`
- Mounted once in `App.jsx` for signed-in users. After the assistant writes data it bumps `dataVersion`, which is the `key` on `<Routes>`, so the open page remounts and refetches

**How it works:**
- The request carries the user's Supabase JWT. The function builds a supabase-js client from the **anon key + that token**, so RLS applies exactly as in the browser. It refuses to start (`503`) if the configured key is not a public anon/publishable key — never point it at the service-role key
- `mode` selects the operation. `chat` and `prepare_import` call the OpenAI Responses API (`store: false`, at most 3 tool rounds). `commit_import`, `confirm_transaction` and `confirm_changes` apply a signed proposal without the model. The report modes (`suggestions`, `budget_review`, `financial_summary`, `category_comparison`, `category_drilldown`, `upcoming_payments`) are plain database reads and work without an OpenAI key
- **Creating records:** write tools (`create_transaction`, `create_account`, `create_category`, `create_recurring_payment`) are offered to the model only **until it reads data in that turn** (`dataRead` in the tool loop). Several creates in a row are fine; after any lookup they disappear, so retrieved text cannot suggest a write. Imports and reviewed transactions are two-step: the server returns an HMAC-signed, expiring proposal and saves only when the browser sends it back (`commit_import`, `confirm_transaction`)
- **Changing existing transactions:** the model cannot edit or delete. `propose_transaction_changes` (updates / additions copied from an existing row / removals / `splits`, by ids from `list_transactions`) only builds a signed change set. For a split the model names only the parts — the server maps them onto the existing rows and **rejects parts that do not add up to the rows they replace** (the one exception: parts taken from a checked receipt, see *Rounded amounts* below), because the model gets this arithmetic wrong often enough to matter; the window shows it as a "Review changes" card and `confirm_changes` applies it. Edits are made in place. An edit that changes amount or description first stamps `transactions.import_signature` with the signature of the values it replaces, unless the row already has one (see **Import Deduplication**), so a later Google Sheets sync still recognises the bank row. **Fallback on a database without migration 010:** a bank-imported row (`provider` set) whose amount or description changes is replaced — the original goes to the trash (`deleted_at`) and a corrected copy with a new id is inserted — except rows generated by a recurring payment (`recurring_payment_id`) and rows whose old or new category is linked to a liability (`liabilities.linked_category_id` — the liability triggers follow an `UPDATE` but would deduct an inserted copy a second time). Only in that fallback, *Restore all* brings a replaced original back next to its copy and *Empty trash* lets a polling sync import it again; rows replaced before the migration was applied keep that weakness. Applying refuses with `409` if a row changed after the proposal or if another card already made the same change, and a retry of the same card is safe. The `apply_assistant_transaction_changes` RPC locks all source rows, checks their versions and commits the entire card with a user-scoped retry receipt. Apply `20261125145446_assistant_transaction_changes.sql` before deploying the handler. Logic: `proposeAssistantChanges` / `confirmAssistantChanges` in `assistant-transaction.mjs`
- **Reply format:** chat replies are structured (`text.format` JSON schema in `_lib/assistant-reply.mjs`): `message` plus `choices`. Choices render as buttons under the reply and the clicked text is sent as the next user message. `parseAssistantReply()` also strips lines that are bare JSON — a model that runs out of tools sometimes writes the call it wanted, or an invented result, as text. Unit tests: `assistant-reply.test.mjs` (part of `pnpm run test:unit`)
- The pending import card is rendered right after the reply that produced it, not pinned under the newest message
- Import attachments: CSV (128 KB, confidential columns stripped before the model sees them), PNG/JPEG/WebP screenshot or PDF (2.5 MB each, verified by file signature). A PDF goes to the Responses API as an `input_file` part with a `data:application/pdf;base64,…` URL; a screenshot as `input_image`. Both reach OpenAI whole. At most 60 transactions per file. To add a type, change `attachmentKind()` / `attachmentLimits` in `BudgetAssistant.jsx` **and** `prepareAssistantImport()` in `assistant-import.mjs` — the browser check alone is not a control
- **A receipt sent with a request** (`attachmentNote: true` from the window, image or PDF only) does not use the chat tool loop. It is two model calls with structured output and no tools (`_lib/assistant-receipt.mjs`, wired in `planFromReceipt()` in `budget-assistant.mjs`):
  1. **Copy** (`readReceipt`): the model lists every priced line, its tax mark and the printed subtotal/tax/total, and says whether the user wants the purchase added as new, a recorded purchase changed, or something else. `checkReceipt()` accepts the reading only if the lines tie to a printed figure (lines = subtotal with the total above it; lines + tax = total; or lines = total when tax is included) and retries once with the reason. **No amount from a receipt is used unless this check passed.** Not a receipt, or "add it" → the ordinary import.
  2. **Plan**: the model gets the checked receipt as numbered lines, the transactions recorded around the purchase date and the expense categories, and returns only ids and a category per line number. `resolveSplits()` requires every line exactly once, takes prices and tax from the checked receipt and `spreadExtra()` shares the tax (by tax mark for a plain tax line, by price when a tip or fee is involved). The result goes through `propose_transaction_changes` into a change card. The reply text is written by the server (`receiptMessage`), not the model.
  - **Follow-ups need no second upload:** the reply carries `receiptToken` (HMAC-signed receipt + current proposal, 30 min). The window sends it with the next chat message; the plan step runs again and anything not about the receipt falls through to the normal chat. A new receipt card replaces the previous receipt card.
  - **A purchase that is not recorded:** the plan has two more actions. `add` — the purchase is recorded as new transactions, one per category: the amounts come from the checked receipt through `resolveSplits()`, become an ordinary import draft (`draftAssistantImport()`) and are saved only by `commit_import`; the card warns when entries that may be this purchase are already recorded (`addWarnings()`). `not_found` — the user asked to change a recorded purchase and nothing recorded comes close to the receipt: it is answered exactly like `add`, in the same turn — the receipt by category, then `missingNote()`, which also names look-alike entries found in the trash (`trashedLookalikes()`), then the card. **The user asked for the receipt by category, so every reply shows it; never answer only that nothing was found.** `unsure` marks only the lines whose category is in doubt, not every abbreviated name. A receipt whose lines cannot be verified after the second reading is not added at all: the reply says so, and that a file sent without text is imported as one amount. In the window a receipt follow-up replaces the earlier receipt card of either kind (change card or import card). **Do not let the model describe a next step in free text**: it once told the user to resend the file "to add it with a split", which the code could not do. Handler-level test with a scripted model and database: `assistant-receipt-flow.test.mjs` (part of `pnpm run test:unit`; needs `npm ci` in `netlify/functions`)
  - **Rounded amounts:** the transactions recorded for a purchase need not match its receipt to the cent — amounts typed in by hand are often rounded (the real ledger held 360.00 + 198.00 for a receipt of 557.68). `closeToReceipt()` in `assistant-split.mjs` accepts a difference of one percent of the receipt, at least 1.00. `resolveSplits()` marks a split built from the receipt `receipt_total`, and only for such a split does `proposeAssistantChanges()` let the parts differ from the rows they replace; the reply states both totals (`differenceNote()`) and the card shows before → after. In any split a part goes to the row that already has its category, and new rows copy the source row with the shortest description. When the user names the categories to use, the plan stays inside them and flags what does not fit as unsure
  - **GOTCHA — try it on the real ledger before pushing.** Three pushes of this flow passed every scripted test and failed on the first real request, because the scripted ledger held what I assumed (two bank payments that add up to the cent) and the real one did not. Run the function locally (`netlify dev`), sign in with the test account, send the real receipt with the real wording, and read the reply and the card — without pressing Apply or Import
  - **Models:** both calls use `OPENAI_RECEIPT_MODEL` (default `gpt-6.2-sol`), not the chat model. `gpt-5-mini` mis-copied long receipts and put the same abbreviated product in a different category on each run; `gpt-5-nano` fails the sum check; `gpt-5.1` still moved a product between categories from run to run. Measured on a 34-line receipt, three runs each (2026-11-23): `gpt-6.2-sol` copies in 10–11 s and plans in 5–6 s with the same split every time; `gpt-6-sol` was as stable in about half the time (5 s + 5 s) and is the one to switch to if the 30-second limit gets tight. `reasoningFor()` picks the lowest effort each generation accepts: `minimal` for gpt-5 and its mini/nano, `none` for gpt-5.1–5.6, `low` for gpt-6 (its larger models have nothing below `low`)
- **GOTCHA — 30 seconds:** Netlify ends a synchronous function at 30 s with a bare `504`. The handler's own limit is 27 s so it can answer with a message or a prepared card. Every model call with a file attached costs 5–11 s, so a flow that needs more than two of them does not fit (a receipt copy that fails its sum check and is retried already uses the time of the plan step). Measure with a real document, not a tidy fixture
- Netlify rate limit: 20 requests per minute per IP (`config.rateLimit` in the function)

**Environment variables (Netlify Functions):**
- `OPENAI_API_KEY` - required for chat and imports; server-side only
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - the `VITE_` equivalents are accepted as a fallback
- `OPENAI_ASSISTANT_MODEL` - optional, defaults to `gpt-5-mini`
- `OPENAI_RECEIPT_MODEL` - optional, defaults to `gpt-6.2-sol`; used only for reading receipts. If the account cannot use it, the chat model is used instead
- `BUDGET_ASSISTANT_READ_ONLY=true` - optional, disables every write path

**Local testing:** `pnpm run dev` serves only the frontend; the Vite proxy forwards `/.netlify/functions` to port 9999, so the dialog opens but requests fail with a proxy error. Use `netlify dev` (port 8888) to exercise the function.

## Google Sheets Integration

BudgetWise supports two modes of syncing transactions from Google Sheets:

### Polling Mode (Legacy)
- Fetches data from Google Sheets at configurable intervals (1-60 minutes)
- Uses public CSV export (`/gviz/tq?tqx=out:csv`)
- Simple but inefficient (fetches even when no changes)

### Webhook Mode (Recommended)
- Real-time sync using Google Apps Script and webhooks
- Transactions appear instantly (1-2 seconds) when added to the sheet
- More efficient - only triggers when new data is added

**Architecture:**
```
Google Sheet → Apps Script → Netlify Function → Supabase → Frontend (Realtime)
```

**Key Files:**
- `netlify/functions/google-sheets-webhook.js` - Webhook endpoint
- `docs/google-apps-script/WebhookSync.gs` - Google Apps Script code
- `docs/google-apps-script/README.md` - Setup instructions
- `backend/database/migrations/001_add_webhook_secret.sql` - Database migration

**Setup Requirements:**
1. Run database migration to add `webhook_secret`, `realtime_enabled` columns
2. Set Netlify environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Configure webhook in Import Transactions page
4. Set up Google Apps Script with provided code

See `docs/google-apps-script/README.md` for detailed setup instructions.

## Testing

### Playwright Test Suite

BudgetWise has a comprehensive end-to-end test suite built with Playwright. Tests are located in `frontend/tests/`.

**Test Configuration:**
- Config file: `frontend/playwright.config.js`
- Base URL: `http://localhost:5173` (Vite dev server)
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)

**Test Credentials:**
- Read from the environment, never hardcoded: `BUDGETWISE_TEST_EMAIL`, `BUDGETWISE_TEST_PASSWORD` (optional `BUDGETWISE_TEST_NAME`)
- `loginUser()` in `frontend/tests/test-utils.js` throws if either is missing, so export both before running any authenticated spec
- **GOTCHA:** every test logs in through the UI. A multi-browser run (~190 logins in a few minutes) trips Supabase Auth's sign-in limit and tests fail on `waitForURL('/dashboard')` with "Request rate limit reached" on the login form. That is the rate limit, not a broken page — run one project at a time (`--project=chromium`) or fewer workers

### Test Files

| File | Description |
|------|-------------|
| `test-utils.js` | Shared utilities, login helper, common selectors |
| `auth.spec.js` | Authentication: login, signup, logout, protected routes, session |
| `dashboard.spec.js` | Dashboard: summary cards, charts, navigation, data loading |
| `transactions.spec.js` | Transactions: figures, chart, list by day, filters, editing in place, trash; Add transaction form (read-only, with a write guard) |
| `assets.spec.js` | Assets & Liabilities: figures, balance sheet, trend, health score, emergency fund, lists and forms (read-only) |
| `budget.spec.js` | Budget: tracking, setup, category budgets, progress |
| `categories.spec.js` | Categories: expense/income tabs, merchant mappings |
| `recurring.spec.js` | Recurring payments: list, actions, next 30 days |
| `reports.spec.js` | Reports: charts, tables, year selection |
| `settings.spec.js` | Settings: notifications, account info |
| `import.spec.js` | Import: Google Sheets sync, auto-sync, CSV upload |
| `mobile.spec.js` | Mobile responsiveness: all pages on mobile/tablet viewports |
| `assistant.spec.js` | Budget assistant window: choice buttons, change card, import card placement (function replies are scripted) |

### Test Utilities (`test-utils.js`)

Common helper functions:
- `loginUser(page, email?, password?)` - Log in a user
- `logoutUser(page)` - Log out current user
- `openMobileMenuIfNeeded(page)` - Open hamburger menu on mobile
- `isMobileViewport(page)` - Check if viewport is mobile
- `navigateToProtectedPage(page, path)` - Navigate with auto-login
- `takeScreenshot(page, name)` - Take timestamped screenshot
- `TEST_USER` - Object with test credentials
- `SELECTORS` - Common CSS selectors

### Running Tests

```bash
cd frontend

# Run all tests (headless)
npm test

# Interactive UI mode (recommended for development)
npm run test:ui

# See browser while testing
npm run test:headed

# Debug with inspector
npm run test:debug

# Run specific file
npx playwright test auth.spec.js

# Run tests matching pattern
npx playwright test -g "login"

# View HTML report
npm run test:report
```

### Writing New Tests

```javascript
import { test, expect } from '@playwright/test';
import { loginUser, TEST_USER } from './test-utils.js';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

See `frontend/tests/README.md` for complete documentation.
