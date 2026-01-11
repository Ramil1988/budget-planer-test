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
- Email: `complianceramsharapov@gmail.com`
- Password: `@Ramilka1988`
- Stored in: `frontend/tests/test-utils.js`

### Test Files

| File | Description |
|------|-------------|
| `test-utils.js` | Shared utilities, login helper, common selectors |
| `auth.spec.js` | Authentication: login, signup, logout, protected routes, session |
| `dashboard.spec.js` | Dashboard: summary cards, charts, navigation, data loading |
| `transactions.spec.js` | Transactions: list, add, filter, search, validation |
| `budget.spec.js` | Budget: tracking, setup, category budgets, progress |
| `categories.spec.js` | Categories: expense/income tabs, merchant mappings |
| `recurring.spec.js` | Recurring payments: list, actions, next 30 days |
| `reports.spec.js` | Reports: charts, tables, year selection |
| `settings.spec.js` | Settings: notifications, account info |
| `import.spec.js` | Import: Google Sheets sync, auto-sync, CSV upload |
| `mobile.spec.js` | Mobile responsiveness: all pages on mobile/tablet viewports |

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
