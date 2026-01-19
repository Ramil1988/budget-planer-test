# System Overview

This document provides a technical overview of how BudgetWise is structured and how its main parts work together.

## 1. Core Components / Modules

### 1.1 Frontend (React + Vite, `frontend/`)

**Entry & Composition**

- `frontend/src/main.jsx`
  - Bootstraps the React app.
  - Wraps the tree with:
    - `ChakraProvider` (UI system + theme)
    - `ColorModeProvider` (dark/light mode)
    - `BrowserRouter` (React Router)
    - `AuthProvider` (authentication context)
    - `AutoSyncProvider` (Google Sheets sync context)
  - This is effectively the top-level composition/root module.

- `frontend/src/App.jsx`
  - Declares client-side routes with React Router:
    - Public:
      - `/` → `Home`
      - `/login`, `/signup`
      - `/forgot-password`, `/reset-password`
    - Auth-protected (wrapped in `ProtectedRoute`):
      - `/dashboard`
      - `/import` (CSV / Google Sheets import)
      - `/categories`
      - `/transactions`
      - `/add-transaction`
      - `/budget`
      - `/recurring`
      - `/reports`
      - `/settings`
    - Additional:
      - `/report` → redirects to `/reports`
      - `*` → redirects to `/`
  - Global layout: `Header` at top, `Footer` at bottom, `<main>` in the middle.

**Context & Client Services**

- `frontend/src/lib/supabaseClient.js`
  - Creates a single Supabase JS client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - Enables `autoRefreshToken`, `persistSession`, `detectSessionInUrl`.
  - Used everywhere for both Auth and direct database access.

- `frontend/src/contexts/AuthContext.jsx`
  - React context for authentication state and operations.
  - State: `user`, `session`, `loading`.
  - On mount:
    - Calls `supabase.auth.getSession()` to bootstrap local state.
    - Subscribes to `supabase.auth.onAuthStateChange` to keep `user` and `session` in sync.
  - Exposes:
    - `signUp(email, password, metadata?)`
    - `signIn(email, password)`
    - `signOut()` (local scope sign-out + manual token cleanup)
    - `resetPassword(email)` – sends reset link to `/reset-password`.
    - `updatePassword(newPassword)`.
  - `useAuth()` hook gives access to these values and functions.

- `frontend/src/components/ProtectedRoute.jsx`
  - Small wrapper that uses `useAuth()`:
    - Shows a full-screen spinner while `loading`.
    - Redirects to `/login` if `user` is `null`.
    - Renders `children` if authenticated.

- `frontend/src/contexts/AutoSyncContext.jsx`
  - React context coordinating **transaction import & auto-sync** from Google Sheets and realtime inserts.
  - State:
    - `isEnabled`, `syncInterval` → polling-based auto-sync from Google Sheets.
    - `realtimeEnabled`, `webhookSecret` → webhook-based realtime mode.
    - `isSyncing`, `lastSyncTime`, `lastSyncResult`.
    - `sheetSettings` (data from `user_settings` table: `google_sheet_url`, `google_sheet_name`, etc.).
  - On user login:
    - Loads `user_settings` via Supabase.
    - If polling is enabled and a sheet is configured, sets up `setInterval` to run `performSync()` periodically.
    - If realtime is enabled, subscribes to Supabase Realtime `postgres_changes` on `transactions` filtered by `user_id`.
  - Exposes methods:
    - `performSync()` – import from Google Sheets (pull model).
    - `toggleAutoSync(enabled)` – enable/disable polling and persist to `user_settings`.
    - `updateSyncInterval(minutes)` – persist to `user_settings`.
    - `toggleRealtimeMode(enabled)` – toggle webhook mode, ensure `webhook_secret` exists, disable polling when turning realtime on.
    - `generateWebhookSecret()` – generate and store a new secret.
    - `getWebhookUrl()` – returns dev/prod URL to `/.netlify/functions/google-sheets-webhook`.
  - Internally uses:
    - `importUtils` for Google Sheets CSV parsing.
    - Its own `categorizeTransactions()` (uses DB `merchant_mappings` + `categories`).
    - `getOrCreateAccount()` to ensure at least one `accounts` row.
    - `notifications.js` for browser notifications and budget alerts.

- `frontend/src/lib/importUtils.js`
  - Import utility layer:
    - `extractSheetId(input)` – accepts either raw ID or Sheets URL.
    - `fetchTransactionsFromGoogleSheets(sheetId, sheetName)` – pulls CSV from Google.
    - CSV parsing helpers: `parseCSVText`, `parseCSVLine`, `parseDate`, `parseAmount`.
    - File parsing: `parseCSVFile(file)` for uploaded CSV files.
    - Validation: `validateTransactions(transactions)` → `{ valid, invalid, validCount, invalidCount }`.

- `frontend/src/lib/recurringUtils.js`
  - Pure functions for recurring payments and projections:
    - Frequency config (`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`).
    - `getNextPaymentDate`, `getPaymentDatesInRange`.
    - `getUpcomingPayments(recurringPayments, daysAhead)`.
    - `getMonthlyProjection(recurringPayments, month)`.
    - `formatFrequency`, `formatDate`.

- `frontend/src/lib/notifications.js`
  - Browser notification abstraction:
    - `isNotificationSupported`, `getNotificationPermission`, `requestNotificationPermission`.
    - `showNotification(title, options)` – uses Service Worker if possible, or `Notification`, or `alert`.
    - `notifyNewTransaction(transaction, categoryName)`.
    - `notifyBudgetLimit(categoryName, spent, limit, percentUsed)`.
    - `checkBudgetAndNotify(supabase, userId, categoryId, newAmount)` – reads budgets + transactions from Supabase and triggers alerts when a category hits 80%/90%/100% of its limit.

**Pages / UI**

- Shared layout: `Header`, `Footer`, `PageContainer`, color mode components.
- Main route-level pages (`frontend/src/pages/`):
  - `Home` – marketing/landing.
  - Auth: `Login`, `Signup`, `ForgotPassword`, `ResetPassword`.
  - Core app:
    - `Dashboard` – high-level overview of income/expenses, category usage, weekly/monthly charts, and recurring payments.
    - `ImportTransactions` – Google Sheet/CSV import configuration and manual sync.
    - `CategoryManager` – manage categories and merchant mappings.
    - `Transactions` – list + filters.
    - `AddTransaction` – manual transaction entry.
    - `Budget` – configure monthly budgets and per-category limits.
    - `RecurringPayments` – CRUD for `recurring_payments`.
    - `Reports` – analytic views.
    - `Settings` – preferences, notification and sync options.

### 1.2 Database (Supabase PostgreSQL, `backend/database/`)

Core tables (see `backend/database/schema.sql` and migrations):

- `profiles` – 1:1 user profile linked to `auth.users(id)`.
- `accounts` – user accounts (bank accounts, wallets) with `balance`.
- `categories` – income/expense categories (`type` in `('income', 'expense')`).
- `transactions` – ledger entries:
  - `user_id`, `account_id`, `category_id`, `type`, `amount`, `provider`, `description`, `date`, `balance`.
- `budgets` – per-month budget entities (`month`, `total`).
- `budget_categories` – per-category limits and `spent` for a given budget.
- `user_settings` – per-user config (Google Sheet URL/name, auto-sync flags, webhook secret, etc.).
- `merchant_mappings` – merchant description → category name rules.
- `recurring_payments` – recurring incomes/expenses with frequency, dates, `is_active`, and optional `category_id`.

Security:

- Row Level Security (RLS) enabled on all tables.
- Policies like `own_data` enforce `auth.uid() = user_id` (or equivalent) so each user only sees their own data.

Triggers & functions:

- `update_balance()` + `auto_update_balance` trigger
  - After `INSERT` on `transactions`:
    - Adjusts `accounts.balance` up/down depending on `type`.
- `calc_running_balance()` + `auto_calc_balance` trigger
  - Before `INSERT` on `transactions`:
    - Computes `transactions.balance` based on prior transactions or account balance.
- `update_spent()` + `auto_update_spent` trigger
  - After `INSERT` of an `expense` transaction:
    - Updates `budget_categories.spent` for the matching month/category.

Migrations and seeds provide:

- Default expense and income categories for each user.
- Hundreds of merchant patterns in `merchant_mappings` (see `docs/transaction-categorization.md`).
- An `auth.users` trigger to auto-seed new users.
- Webhook support (`webhook_secret` in `user_settings`).

### 1.3 Serverless Backend (Netlify Functions, `netlify/functions/`)

Currently one main function:

- `netlify/functions/google-sheets-webhook.js`
  - Uses `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` (server-side only) to bypass RLS while still explicitly setting `user_id`.
  - Expects POST body with:
    - `transactions`: `{ date, description, amount, type?, bank? }[]`.
    - `userId`: Supabase `auth.users.id`.
    - `webhookSecret`: must match `user_settings.webhook_secret`.
  - Flow:
    1. Validate payload and method.
    2. Verify `webhookSecret` against `user_settings`.
    3. Normalize dates and amounts, filter invalid entries.
    4. Load existing `transactions` for that user and build duplicate signatures (`date|normalizedDescription|normalizedAmount`).
    5. Filter out duplicates.
    6. Categorize remaining transactions using `merchant_mappings` + `categories`.
    7. Ensure a default `accounts` row exists.
    8. Resolve `category_id` for each transaction (separate logic for income/expense; creates `Other Income` if needed).
    9. Insert into `transactions` and return `imported` count.

This function is used by Google Apps Script to push new rows from Sheets into Supabase.

## 2. Component Interactions

### 2.1 Frontend ↔ Supabase (Direct JS Client)

- **Auth**
  - Auth pages call `useAuth()` → `AuthContext` → `supabase.auth.*`.
  - Supabase stores a JWT-backed session in local storage.
  - `AuthContext` updates `user`/`session`; `ProtectedRoute` uses these for gating.

- **Data Access**
  - Most CRUD operations (transactions, categories, budgets, recurring payments, user settings) are done directly from the browser using the Supabase client and anon key.
  - RLS on the database enforces per-user data access.

### 2.2 Google Sheets Polling Mode (Pull)

- Controlled by `AutoSyncContext` + `importUtils`.
- Flow:
  1. User configures `google_sheet_url` & `google_sheet_name` and enables auto-sync.
  2. `AutoSyncContext` stores this in `user_settings`.
  3. If `auto_sync_enabled` is true and `realtime_enabled` is false, a `setInterval` periodically calls `performSync()`.
  4. `performSync()`:
     - Extracts sheet ID from URL.
     - Downloads CSV for the configured sheet.
     - Parses and validates rows into `{ date, description, amount, bank, type }`.
     - Loads existing `transactions` and filters out duplicates.
     - Categorizes via DB `merchant_mappings` + `categories`.
     - Ensures there is a `Main Account` in `accounts`.
     - Maps category names to `category_id` (expense vs income), creating `Other Income` if needed.
     - Inserts new rows into `transactions`.
     - Optionally fires browser notifications and budget alerts for new transactions.

### 2.3 Google Sheets Webhook Mode (Push)

Components:

- Google Sheet + Apps Script (`docs/google-apps-script/WebhookSync.gs`).
- Netlify function `google-sheets-webhook.js`.
- Supabase Realtime.
- `AutoSyncContext` realtime subscription.

Flow:

1. In the UI (Import page), `AutoSyncContext` is used to:
   - Generate a `webhook_secret` (if missing).
   - Provide a webhook URL, `userId`, and secret.
2. User pastes these values into the Apps Script `CONFIG` in `WebhookSync.gs` and runs `setupTriggers()`.
3. On new/edited sheet rows, Apps Script:
   - Extracts row data into a transaction object.
   - POSTs `{ transactions, userId, webhookSecret }` to the Netlify function.
4. The Netlify function validates, deduplicates, categorizes, and writes to Supabase `transactions`.
5. Supabase Realtime notifies connected clients.
6. `AutoSyncContext`:
   - Subscribes to `postgres_changes` on `transactions` for the current `user.id`.
   - On each new transaction:
     - Updates `lastSyncTime`/`lastSyncResult`.
     - Shows a notification with amount and description.
     - Calls `checkBudgetAndNotify` for budget alerts.

### 2.4 Budgets & Recurring Payments

- New expense transactions, regardless of how they are created (manual, polling import, webhook), trigger database functions:
  - Account balances updated.
  - Running balance recorded on the transaction row.
  - Matching `budget_categories.spent` updated for the appropriate month.
- Dashboard aggregates:
  - Monthly total income/expenses/net.
  - Per-category spending vs limit.
  - Weekly and monthly spending breakdowns.
- Recurring payments (`recurring_payments`):
  - Loaded on the Dashboard.
  - Processed with `recurringUtils` to show upcoming payments (list + mini-calendar) and monthly projections.

## 3. Deployment Architecture

### 3.1 Platforms & Services

- **Hosting & CI**: Netlify
  - Hosts the built React SPA (`frontend/dist`).
  - Runs serverless functions from `netlify/functions`.
  - Configured via `netlify.toml`:
    - `[build]`:
      - `command`: installs dependencies for functions and frontend, then runs `npm run build` in `frontend/`.
      - `publish = "frontend/dist"`.
      - `functions = "netlify/functions"`.
    - Node version: `NODE_VERSION = "20"`.
    - `node_bundler = "esbuild"` for functions.
    - Redirects:
      - `/api/*` → `/.netlify/functions/:splat` (API entrypoint).
      - `/*` → `/index.html` for SPA routing.
    - Cache & security headers for HTML, JS, CSS.

- **Database & Auth**: Supabase
  - PostgreSQL instance with RLS and SQL-defined schema and triggers.
  - Supabase Auth handles login, signup, password reset.
  - Environment variables:
    - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
    - Functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- **Google Sheets Integration**
  - Polling mode: uses public CSV export of the sheet.
  - Webhook mode: Google Apps Script → Netlify function → Supabase → Realtime → frontend.

### 3.2 Local Development & Build

- Root `package.json` scripts (monorepo-style):
  - `dev:frontend` → `cd frontend && pnpm run dev`.
  - `dev:backend` → legacy; there is no running Node backend now (the "backend" directory is database SQL only).
  - `build:frontend` → builds the Vite app.
- Frontend `package.json`:
  - `dev` → Vite dev server on `http://localhost:5173`.
  - `build` → Vite production build.
  - `test*` → Playwright E2E tests.

Supabase SQL is applied manually in the Supabase dashboard using `backend/database/schema.sql` and migrations, as described in `docs/supabase-setup-guide.md`.

## 4. Runtime Behavior

### 4.1 Initialization

1. Browser loads the SPA from Netlify.
2. `main.jsx` renders the app tree with Chakra, routing, auth, and auto-sync providers.
3. `AuthContext`:
   - Calls `supabase.auth.getSession()`.
   - Subscribes to auth state changes.
4. `AutoSyncContext`:
   - Waits for `user`.
   - Loads `user_settings`.
   - Sets up polling or Realtime subscription depending on config.
5. `App` renders `Header`, the appropriate route component, and `Footer`.

### 4.2 Request / Workflow Handling

- **Auth:**
  - Auth pages trigger `signIn`/`signUp`/`signOut`/reset flows via Supabase Auth.
  - Successful login updates `user` and navigates to protected routes.

- **Manual Transactions:**
  - Created through UI pages and inserted directly into Supabase `transactions` using the JS client.
  - DB triggers handle balances and budget `spent` updates.

- **Imported Transactions (Polling):**
  - `performSync` fetches/validates CSV, deduplicates, categorizes, and inserts.
  - Browser notifications and budget alerts are fired where enabled.

- **Imported Transactions (Webhook):**
  - Apps Script posts rows to Netlify function.
  - Function validates, deduplicates, categorizes, and inserts into Supabase.
  - Supabase Realtime notifies `AutoSyncContext`, which updates UI/notifications.

### 4.3 Error Handling

- Frontend:
  - `try/catch` around Supabase and import operations.
  - Errors logged via `console.error` and surfaced in UI (e.g., Dashboard error banner).
  - Auto-sync records failures in `lastSyncResult`.

- Netlify Function:
  - Returns meaningful HTTP codes (400/401/405/500) with JSON error messages.
  - Logs internal errors with `console.error`.

- Apps Script:
  - Uses `Logger.log` for debugging.
  - Provides `testConnection()` and `manualSync()` helpers.

### 4.4 Background & Realtime

- Polling runs in the browser when enabled and user is authenticated, using intervals managed by `AutoSyncContext`.
- Realtime updates come from Supabase Realtime over WebSockets and are mapped to in-app state and notifications.
- Recurring payments are calculated on-demand in the browser; there is no server-side scheduler.
