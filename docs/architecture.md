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

#### Budget Tracking
```sql
-- Trigger: update_spent()
-- Automatically updates budget_categories.spent when expenses are added
-- Links transactions to budgets based on transaction date and budget month
```

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
