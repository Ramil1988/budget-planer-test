# Architecture Documentation

**Last Updated:** 2025-12-29

## Overview

BudgetWise is a full-stack budget tracking application built with React (frontend), NestJS (backend), and Supabase (database). The application follows a modern component-based architecture with client-side routing, RESTful API communication, and PostgreSQL database for data persistence.

## Technology Stack

### Frontend
- **React** v19.2.3 - UI library
- **Vite** v7.2.7 - Build tool and dev server
- **React Router** v7.10.1 - Client-side routing
- **Chakra UI** v3.30.0 - Component library
- **Emotion** v11.14.0 - CSS-in-JS styling (required by Chakra UI)
- **Framer Motion** v12.23.26 - Animation library (required by Chakra UI)

### Backend
- **NestJS** v11.1.10 - Progressive Node.js framework
- **TypeScript** v5.9.3 - Type-safe JavaScript
- **Express** (via @nestjs/platform-express) - HTTP server
- **pg** (planned) - PostgreSQL client for direct SQL queries

### Database & Authentication
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Relational database (hosted by Supabase)
- **Supabase Auth** - User authentication and authorization
- **Row Level Security (RLS)** - Database-level data isolation

### Testing
- **Playwright** v1.57.0 - Frontend end-to-end testing
- **Jest** (NestJS default) - Backend unit and integration testing

### Package Manager
- **pnpm** v10.24.0 - Fast, disk space efficient package manager

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking for backend

## Project Structure

```
budget-planner/
├── docs/                      # Project documentation
│   ├── architecture.md        # This file - technical architecture
│   ├── changelog.md          # Version history
│   ├── project-status.md     # Current status and roadmap
│   └── technical-reference.md # Code patterns and quick reference
├── frontend/                  # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Header.jsx   # Navigation with mobile menu
│   │   │   └── Footer.jsx   # Footer with branding
│   │   ├── pages/           # Route-level page components
│   │   │   ├── Home.jsx     # Homepage with hero section
│   │   │   └── Features.jsx # Detailed features page
│   │   ├── App.jsx          # Root component with routing
│   │   └── main.jsx         # Application entry point
│   ├── images/              # Static image assets
│   ├── tests/               # Playwright E2E tests
│   ├── index.html
│   ├── vite.config.js
│   ├── playwright.config.js
│   └── package.json
├── backend/                   # NestJS backend API
│   ├── src/
│   │   ├── main.ts           # Application bootstrap
│   │   ├── app.module.ts     # Root module
│   │   ├── app.controller.ts # Root controller
│   │   └── app.service.ts    # Root service
│   ├── database/
│   │   └── schema.sql        # Supabase database schema
│   ├── .env.example          # Environment variables template
│   ├── tsconfig.json         # TypeScript configuration
│   ├── nest-cli.json         # NestJS CLI configuration
│   └── package.json
├── .gitignore
├── CLAUDE.md                  # Claude Code guidance
└── package.json               # Root monorepo package.json
```

## Component Architecture

### Layout Components

#### Header (`src/components/Header.jsx`)
- **Purpose:** Primary navigation with mobile-responsive menu
- **State Management:** Uses `useDisclosure` hook for mobile menu toggle
- **Routing:** Implements active link highlighting using `useLocation`
- **Responsive Behavior:**
  - Desktop: Horizontal navigation with HStack
  - Mobile: Hamburger menu with collapsible Stack

#### Footer (`src/components/Footer.jsx`)
- **Purpose:** Site footer with branding
- **State:** Stateless component
- **Layout:** Uses Chakra UI Container, Flex, and VStack

### Page Components

#### Home (`src/pages/Home.jsx`)
- **Purpose:** Landing page with hero section and features preview
- **Features:**
  - Hero section with CTA button
  - Feature cards grid (3 cards)
  - Scroll-to-top button (appears after scrolling 300px)
- **State:**
  - `showScrollTop` - Controls scroll-to-top button visibility
- **Effects:**
  - Scroll event listener for scroll-to-top button

#### Features (`src/pages/Features.jsx`)
- **Purpose:** Detailed features page with alternating image/text layouts
- **Features:**
  - Page hero section
  - 4 detailed feature sections with images
  - Call-to-action section
  - Scroll-to-top button
- **Layout Pattern:** Alternating flex-direction for visual variety
- **State:**
  - `showScrollTop` - Controls scroll-to-top button visibility

### Routing Configuration

Defined in `src/App.jsx`:
- `/` → Home page
- `/features` → Features page

## Styling System

### Chakra UI Configuration

The app uses Chakra UI's default theme system with the following approach:

1. **ChakraProvider** wraps the entire app in `main.jsx`
2. **Default System** using `defaultSystem` from Chakra UI v3
3. **Responsive Props** using object syntax: `{{ base: 'value', md: 'value' }}`

### Color Palette

Primary colors used throughout the app:
- **Primary Blue:** `blue.600` - Main brand color, CTAs, links
- **Gray Scale:**
  - `gray.50` - Light backgrounds
  - `gray.200` - Borders
  - `gray.400` - Muted text
  - `gray.600` - Secondary text
  - `gray.800` - Footer background

### Responsive Breakpoints

Chakra UI's default breakpoints:
- `base`: 0px (mobile-first)
- `sm`: 480px
- `md`: 768px (primary breakpoint used in app)
- `lg`: 992px
- `xl`: 1280px
- `2xl`: 1536px

### Layout Constraints

- **Max Width:** 1200px for main content containers
- **Padding:** 8 (32px) horizontal padding on containers
- **Vertical Spacing:** 16 (64px) between major sections

### Redesigned pages (2026-11-24)

Budget, Recurring, Reports, Assets & Liabilities, Transactions and Add transaction are built
the same way, and differently from the pages that still use Chakra components throughout:

| Layer | Where | What it holds |
|-------|-------|---------------|
| Page | `src/pages/<Page>.jsx` | Loading and saving (unchanged from before the redesign) and the layout |
| Components | `src/components/<page>/` | The page's own charts, lists, forms and dialogs |
| View helpers | `src/lib/<page>View.js` (`budgetMath.js` for Budget) | Pure functions that turn records into what is drawn; unit-tested with `node --test` |
| Shared styles | `src/styles/ledger.css` | Tokens (`--bw-*`) and classes (`bw-*`): masthead, tabs, ledger of figures, panels, forms, dialogs |
| Page styles | `src/styles/<page>.css` | What only that page has |

- A page's root carries `bw-surface bw-page`. The tokens are defined on `.bw-surface` and
  again under `.dark .bw-surface`, so anything rendered outside the page (a dialog) must
  carry `bw-surface` too. `components/DialogFrame.jsx` does this for every dialog
- Charts are HTML and SVG written by hand. A line chart is an SVG stretched to its plot
  (`preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`) with the points and
  figures as ordinary elements laid over it, so text keeps its size on a phone
- Dropdowns are native `<select>` elements; no click-outside handling is needed
- Each page has one chart that is its own: the pace ruler (Budget), the month strip
  (Recurring), the year chart, treemap and heat map (Reports), the balance sheet to scale
  (Assets & Liabilities), the steps of income and spending with the balance between them
  (Transactions)

### Dashboard money flow (2026-11-26)

The monthly summary of the Dashboard holds a flow diagram, `src/components/dashboard/MoneyFlow.jsx`. The arithmetic is two pure functions in `src/lib/dashboardView.js` with `node --test` tests: `moneyFlow()` turns the month's transactions and the spending by category into the two sides of the diagram (sources of income; categories, a shortfall or what is left over), and `flowLayout()` places them in pixels to one scale. A category whose `outside_income` is true (migration 012) is paid from money that is not recorded as income: it is kept out of the flow from income and drawn with a source of its own. The bands are a single SVG stretched to its column; bars and labels are HTML.

## State Management

Currently using React's built-in state management:

### Component State (useState)
- Header: Mobile menu open/close state
- Home/Features: Scroll-to-top button visibility

### Router State (useLocation)
- Header: Active link detection

### Future Considerations
- For budget data: Consider Context API or state management library
- For forms: React Hook Form integration
- For server state: TanStack Query (React Query)

## Database Architecture

### Overview

BudgetWise uses **Supabase** as its Backend-as-a-Service platform, providing PostgreSQL database hosting, authentication, and Row Level Security (RLS). The database schema is defined in `/backend/database/schema.sql`.

### Database Schema

#### Tables

**1. profiles**
- Purpose: User profile information linked to Supabase Auth
- Key fields: `id` (UUID, references auth.users), `email`, `full_name`
- Security: RLS enabled, users can only access their own profile

**2. accounts**
- Purpose: User's financial accounts (bank accounts, wallets, etc.)
- Key fields: `id`, `user_id`, `name`, `balance`
- Features: Automatic balance calculation via triggers
- Security: RLS enabled, users can only access their own accounts

**3. categories**
- Purpose: Income and expense categories
- Key fields: `id`, `user_id`, `name`, `type` (income/expense)
- Security: RLS enabled, users manage their own categories

**4. transactions**
- Purpose: Individual financial transactions
- Key fields: `id`, `user_id`, `account_id`, `category_id`, `type`, `amount`, `date`, `balance`
- Features:
  - Automatic balance updates via `update_balance()` trigger
  - Running balance calculation via `calc_running_balance()` trigger
  - Budget tracking via `update_spent()` trigger
- Security: RLS enabled, users can only see their own transactions

**5. budgets**
- Purpose: Monthly budget planning
- Key fields: `id`, `user_id`, `month`, `total`
- Security: RLS enabled, users manage their own budgets

**6. budget_categories**
- Purpose: Category-level budget limits and tracking
- Key fields: `id`, `budget_id`, `category_id`, `limit_amount`, `spent`
- Features: Automatic spent amount updates from transactions
- Security: RLS enabled via budget ownership check

### Database Features

#### Automatic Balance Calculation
```sql
-- Trigger: update_balance()
-- Automatically updates account balance when a transaction is inserted
-- Income adds to balance, expenses subtract from balance
```

#### Running Balance Tracking
```sql
-- Trigger: calc_running_balance()
-- Calculates and stores the running balance for each transaction
-- Maintains historical balance at the time of each transaction
```

#### Liability Balances
```sql
-- Trigger function: recalculate_liabilities_on_transaction()  (011_liability_interest.sql)
-- Fires after a transaction is inserted, updated or deleted. A liability's balance is
-- worked out again from its anchor (liabilities.balance_anchor, _date, _at): each payment
-- in the linked category first covers balance x rate x days / 365 of interest, the rest
-- reduces the debt. Trashed transactions do not count. Editing a liability's balance,
-- link, start date or rate sets a new anchor (anchor_liability_balance()).
```

#### Budget Tracking
```sql
-- Trigger: update_spent()
-- Automatically updates budget_categories.spent when expenses are added
-- Links transactions to budgets based on transaction date and budget month
```

#### Import Deduplication
Every import (Google Sheets polling in `AutoSyncContext.jsx`, the Import page, the webhook
function and the assistant import) has to know whether a bank row is already in the ledger.
A bank row is identified by its **import signature**:
`date|UPPERCASED description (trimmed, whitespace collapsed)|absolute amount with two decimals`,
built by `importSignature()` in `frontend/src/lib/importSignature.js`. The browser and the
Netlify functions import that one module.

- `transactions.import_signature` (nullable `TEXT`, partial index on `(user_id, import_signature)`)
  stores the signature. It is written when a row is imported and is not rewritten afterwards
- An edit that changes `amount` or `description` of a row without a stored signature writes the
  signature of the values it replaces in the same `UPDATE` (`signatureStamp()`): the inline
  amount edit on the Transactions page and the assistant's `confirm_changes`
- A bank row counts as already imported when it equals the stored signature **or** the
  signature of the current values of any of the user's rows, trashed rows included
- The index is not unique: two identical purchases on the same day are two real rows
- **Migration:** `backend/database/migrations/010_import_signature.sql` (column, index, backfill
  of rows with `provider` set whose description is ASCII; other rows are stamped by the app on
  first edit). **It must be applied for edits to be protected.** Until then the code detects the
  missing column from the PostgREST error (`42703` / `PGRST204`) and uses signatures computed
  from current values only, as before
- No Data API grant is needed: the grants in `009_data_api_grants.sql` are table-level

### Security Model

**Row Level Security (RLS)**
- All tables have RLS enabled
- Users can only access data where `user_id = auth.uid()`
- Enforced at the database level, independent of application code
- Provides multi-tenant data isolation

**Authentication**
- Supabase Auth integration (references `auth.users` table)
- User authentication handled by Supabase
- Backend validates Supabase JWT tokens for API requests

**Data API Grants**

Grants and RLS are two separate controls, and a table needs both:

| | Decides |
|---|---|
| `GRANT` | whether a role may touch the table at all |
| RLS policy | which rows that role then sees |

Supabase used to grant `anon`, `authenticated` and `service_role` full access to
every new table in `public` automatically, which hid the first control. Since
**30 October 2026** it does not: a table created after that date is invisible to
the Data API until it is granted explicitly, and a missing grant fails with
`42501 permission denied for table` no matter how correct the policies are.
The change also applies to a rebuilt database, a preview branch and a local
`supabase db reset`.

So every table-creating SQL file in this repo carries its own grants, and
`backend/database/migrations/009_data_api_grants.sql` restates the whole matrix
for databases that were created before the change. Privileges are the ones the
code actually uses:

- **`authenticated`** — the tables `frontend/src` reaches through supabase-js.
  Full CRUD on the records the UI manages; no `DELETE` on `accounts`, `budgets`,
  `categories` or `user_settings`, which the UI never deletes.
- **`service_role`** — only what `netlify/functions/*.js` reaches with the
  service key. `dismissed_suggestions` (full CRUD, used by `dismissed-suggestions.js`),
  read/insert on the tables `google-sheets-webhook.js` writes, read-only for
  `budget-recommendations.js`.
- **`anon`** — nothing. No table is read before sign-in.
- **`profiles`** — granted to no API role. It is written only by
  `seed_new_user_data()`, a `SECURITY DEFINER` function.

**Gotcha: triggers need grants too.** The triggers in `schema.sql` and
migrations 005/007 are plain `plpgsql` functions, *not* `SECURITY DEFINER`, so
they run as whichever role wrote the row. Inserting a transaction therefore
requires `UPDATE` on `accounts` (`update_balance()`), `UPDATE` on
`budget_categories` (`update_spent()`) and `SELECT, UPDATE` on `liabilities`
(`update_liability_on_transaction()`) — privileges no query in the codebase asks
for. These are granted and commented as "via trigger". The auto-seed functions
are `SECURITY DEFINER` and need nothing.

### Data Relationships

```
users (auth.users)
├── profiles (1:1)
├── accounts (1:many)
│   └── transactions (1:many)
│       └── categories (many:1)
├── categories (1:many)
└── budgets (1:many)
    └── budget_categories (1:many)
        └── categories (many:1)
```

### Database Connection

**Configuration:**
- Database hosted on Supabase cloud
- Connection via PostgreSQL connection string
- Stored in backend `.env` file (DATABASE_URL)

**Query Approach:**
- Direct SQL queries using `pg` (PostgreSQL client)
- No ORM (TypeORM/Prisma) - prefer raw SQL for control and performance
- Database service layer in NestJS backend

## Backend API Architecture

### Overview

The backend is built with NestJS, providing a RESTful API for the frontend to consume.

### Current Structure

**Main Files:**
- `src/main.ts` - Application bootstrap, CORS configuration
- `src/app.module.ts` - Root module, imports all feature modules
- `src/app.controller.ts` - Health check endpoint
- `src/app.service.ts` - Basic service logic

### Budget Assistant (2026-11-20)

Recurring follow-ups carry the audited category and month. The server repeats that user's audit, reads the source rows again, and signs a short-lived review of the proposed schedule changes. The confirmation endpoint accepts indices into that review. The `apply_assistant_recurring_changes` database function validates the sources and saves the selected rules and retry receipt in one transaction. New schedules use the bank date as their first occurrence and start with automatic transaction posting off.

The assistant is one Netlify Function, `netlify/functions/budget-assistant.mjs`, with its logic split across `netlify/functions/_lib/assistant-*.mjs`.

```
BudgetAssistant.jsx ──POST + Supabase JWT──▶ budget-assistant.mjs ──▶ OpenAI Responses API
                                                   │                        │ tool calls
                                                   ▼                        ▼
                                      supabase-js (anon key + user JWT) ◀── _lib/assistant-data.mjs
                                                   │
                                                   ▼
                                         Postgres, filtered by RLS
```

- **Identity:** the function never uses the service-role key. It creates a supabase-js client from the anon key and the caller's JWT, so every read and write is filtered by the same RLS policies as the browser. A non-public key is rejected at startup with `503`
- Recognized recurring date checks and their month clarifications use the `recurring_date_audit` report directly. Other chat requests and file extraction use OpenAI. Suggestions, budget reviews, financial summaries, category comparisons, transaction details and upcoming payment reports read Supabase directly.
- Recurring audits read expenses by user and category before comparing bank descriptions. The category total uses ledger dates in the selected range. The report can also read nearby dates when matching a scheduled occurrence. The card previews up to 150 expenses and opens Transactions with the same category, dates and expense type.
- **Writes:** `create_transaction`, `create_account`, `create_category` and `create_recurring_payment` are exposed as tools only until the model reads data in the turn, so several records can be created in sequence but retrieved text can never trigger a write. CSV/PDF/screenshot imports and reviewed transactions are two-step — the server signs an expiring proposal (HMAC) and writes only when the browser returns it via `commit_import` / `confirm_transaction`. `BUDGET_ASSISTANT_READ_ONLY=true` turns all writes off
- **Changes to existing transactions:** the model has no edit or delete tool. `propose_transaction_changes` validates a set of updates, additions and removals against the user's rows and returns a signed change set; the window shows it as a card and `confirm_changes` applies it. Edits are made in place; an edit of amount or description first stamps the row's import signature (see Import Deduplication) so the Google Sheets sync still recognises the bank row. On a database without migration 010 a bank-imported row whose amount or description changes is instead replaced (the original moves to the trash and a corrected copy is inserted), except rows generated by a recurring payment and rows in a category linked to a liability. Applying is rejected with `409` when a row changed after the proposal or another card already made the change. The `apply_assistant_transaction_changes` RPC locks the reviewed source versions and commits the entire card with its user-scoped retry receipt. A database error rolls the whole card back. For a split the model supplies only the parts; the server maps them onto the existing rows and rejects parts whose sum differs from the rows they replace. The card shows the net total before and after
- **Reply format:** chat replies are a JSON object with `message` and `choices` (structured output). Choices become buttons; the chosen text is sent as the next user message. Bare-JSON lines are removed from `message` on the server
- **Receipts:** a receipt sent with a request is handled by two structured model calls without tools — a copy of the receipt that the server verifies against its printed totals, then a plan that assigns each numbered line to a category — and ends in the same signed change card. The follow-up message carries a signed copy of the receipt, so a correction needs no second upload. These calls use `OPENAI_RECEIPT_MODEL` (default `gpt-6.2-sol`) A purchase that is not in the records yet can be added from the same checked receipt as new transactions, one per category, through the ordinary signed import draft; when nothing recorded adds up to the receipt, the server's reply lists what it does hold.
- **Limits:** 16 messages per request, 3 tool rounds, 5 tool calls per round, 20 requests per minute per IP, `store: false` on the OpenAI call. Conversation history lives only in the open browser session
- **Frontend refresh:** `App.jsx` keeps a `dataVersion` counter used as the `key` on `<Routes>`. The assistant increments it after a successful write, remounting the current page so it refetches

### Planned API Endpoints

**(To be implemented)**

**Authentication:**
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user profile

**Accounts:**
- `GET /accounts` - List user's accounts
- `POST /accounts` - Create new account
- `GET /accounts/:id` - Get account details
- `PUT /accounts/:id` - Update account
- `DELETE /accounts/:id` - Delete account

**Transactions:**
- `GET /transactions` - List transactions (with filters)
- `POST /transactions` - Create new transaction
- `GET /transactions/:id` - Get transaction details
- `PUT /transactions/:id` - Update transaction
- `DELETE /transactions/:id` - Delete transaction

**Categories:**
- `GET /categories` - List categories
- `POST /categories` - Create category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

**Budgets:**
- `GET /budgets` - List budgets
- `POST /budgets` - Create monthly budget
- `GET /budgets/:id` - Get budget with categories
- `PUT /budgets/:id` - Update budget
- `DELETE /budgets/:id` - Delete budget

### API Design Principles

- RESTful resource-based endpoints
- JWT authentication via Supabase tokens
- Consistent error responses
- Pagination for list endpoints
- Filtering and sorting support
- Input validation using DTOs
- Proper HTTP status codes

## Performance Considerations

### Current Optimizations
- Vite's fast HMR (Hot Module Replacement)
- React 19's automatic batching
- Chakra UI's built-in CSS optimization

### Animation Strategy
- The Dashboard draws itself once as it opens (2026-11-26): the three figures of the summary run up to their values (`useEased` in `src/lib/motion.js`), the bands of the money flow pour in from the left, and the bars of the two lower charts rise when the chart first comes into view (`useSeen`, an `IntersectionObserver`). All of it is switched off by `prefers-reduced-motion`
- Scroll-to-top button uses React state (not CSS classes)
- Hover effects use Chakra's `_hover` prop
- Feature cards use CSS animation delays (staggered effect)

## Platform-Specific Notes

### macOS ARM64 (Apple Silicon)
- Requires `esbuild@0.27.1` pinned to exact version
- Requires `@esbuild/darwin-arm64@0.27.1`
- Requires `@rollup/rollup-darwin-arm64` for Vite

If encountering platform errors:
1. Remove `node_modules` and `pnpm-lock.yaml`
2. Run `pnpm install --force`

## Development Workflow

### Running the App

**Full Stack (from root directory):**
```bash
pnpm run dev                 # Start both frontend and backend concurrently
pnpm run dev:frontend        # Start frontend only (http://localhost:5173)
pnpm run dev:backend         # Start backend only (http://localhost:3000)
pnpm run build               # Build both frontend and backend
pnpm run build:frontend      # Build frontend for production
pnpm run build:backend       # Build backend for production
```

**Frontend Only (from frontend/ directory):**
```bash
pnpm run dev        # Start Vite dev server at http://localhost:5173
pnpm run build      # Production build
pnpm run preview    # Preview production build
```

**Backend Only (from backend/ directory):**
```bash
pnpm run dev        # Start NestJS server in watch mode (http://localhost:3000)
pnpm run build      # Build for production (creates dist/ folder)
pnpm run start      # Start production server
pnpm run start:prod # Start production server (NODE_ENV=production)
```

### Testing

**Frontend Tests:**
```bash
pnpm run test:frontend   # Run Playwright tests
pnpm test:ui             # Playwright UI mode (from frontend/)
pnpm test:headed         # Run tests in headed browser
pnpm test:debug          # Debug mode
pnpm test:report         # Show test report
```

**Backend Tests:**
```bash
pnpm run test:backend    # Run Jest tests
pnpm test                # Run tests (from backend/)
pnpm test:watch          # Run tests in watch mode
pnpm test:cov            # Run tests with coverage
```

## Future Architecture Considerations

### Implemented
- ✅ **Database:** Supabase PostgreSQL with comprehensive schema
- ✅ **Backend:** NestJS API framework set up
- ✅ **Authentication:** Supabase Auth with Row Level Security
- ✅ **Data Model:** Complete schema for budgets, transactions, accounts, categories

### Planned Enhancements
1. **State Management:** Implement Context API or React Query for API data caching
2. **Forms:** Add budget entry forms with React Hook Form validation
3. **Charts:** Integrate chart library (e.g., Recharts, Nivo) for data visualization
4. **API Implementation:** Build out all planned REST endpoints in NestJS
5. **Frontend-Backend Integration:** Connect React app to NestJS API
6. **PWA:** Progressive Web App capabilities (offline support, installable)
7. **Dark Mode:** Chakra UI color mode toggle
8. **Real-time Updates:** Supabase real-time subscriptions for live data sync
9. **File Upload:** Receipt scanning and OCR integration
10. **Export Features:** CSV/PDF export functionality

### Scalability
- Monorepo structure supports independent frontend/backend development
- Component structure supports easy addition of new pages
- Chakra UI theme can be customized with brand tokens
- NestJS modular architecture scales to large applications
- Database design supports multi-tenancy via RLS
- Current folder structure scales to enterprise-level applications
- For additional features, consider feature-based folder structure:
  ```
  backend/src/
  ├── auth/          # Authentication module
  ├── accounts/      # Accounts management
  ├── transactions/  # Transactions module
  ├── budgets/       # Budgets module
  └── shared/        # Shared utilities
  ```
