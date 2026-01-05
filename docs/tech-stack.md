# Technology Stack - BudgetWise

**Last Updated:** 2026-01-04
**Version:** 2.0.0
**Project Type:** Personal project (2-3 users)

---

## Confirmed Technology Stack

### Frontend
- **React 19.2.3** - UI library with latest features
- **Vite 7.2.7** - Fast build tool and development server
- **React Router 7.11.0** - Client-side routing
- **Chakra UI 3.30.0** - Component library with built-in accessibility
- **Playwright** - End-to-end testing

### Backend
- **Netlify Functions (Serverless)** - Event-driven backend functions
- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment

### Database & Authentication
- **Supabase PostgreSQL** - Managed database with Row Level Security
- **Supabase Auth** - Built-in authentication (JWT, OAuth, email/password)
- **Supabase JS Client** - Direct database queries from functions

### Package Manager
- **pnpm 10.24.0** - Fast, disk space efficient

### Deployment
- **Netlify** - Hosts both frontend AND backend (serverless functions)
  - Frontend: Static site deployment
  - Backend: Serverless functions (AWS Lambda)
  - Single deployment platform for everything!

### Mobile (Future)
- **React Native + Expo** - Cross-platform mobile app (iOS & Android)
- **Supabase React Native SDK** - Same auth and database as web

---

## Why This Stack?

### Netlify Functions (Serverless Backend)
- ✅ No separate backend server to manage
- ✅ Everything deployed to one platform (Netlify)
- ✅ Free tier: 125,000 function invocations/month (plenty for 2-3 users)
- ✅ Automatic scaling (scales to zero when not used)
- ✅ Built-in environment variable management
- ✅ No cold start issues for low-traffic apps
- ✅ TypeScript support
- ✅ Perfect for small personal projects

### Supabase (Database + Auth)
- ✅ Built-in user management with JWT tokens
- ✅ Row Level Security (users can only access their data)
- ✅ Works natively with React and React Native
- ✅ OAuth providers (Google, GitHub, etc.)
- ✅ Free tier: 500MB database, unlimited API requests
- ✅ Can use Supabase JS client directly in functions

### Single Platform Deployment (Netlify)
- ✅ Frontend + Backend on one platform
- ✅ Continuous deployment from Git
- ✅ Automatic HTTPS
- ✅ CDN for fast global delivery
- ✅ Easy environment variables
- ✅ Simple configuration

### React Native + Expo (Mobile)
- ✅ Reuse React knowledge from web app
- ✅ Share business logic between web and mobile
- ✅ Supabase has official React Native support
- ✅ Expo simplifies mobile development
- ✅ One codebase for iOS and Android

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     NETLIFY HOSTING                      │
│  https://budgetwisetracker.netlify.app                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  FRONTEND (Static Site)                            │ │
│  │  - React + Vite + Chakra UI                        │ │
│  │  - Deployed to Netlify CDN                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  BACKEND (Serverless Functions)                    │ │
│  │  - /.netlify/functions/auth                        │ │
│  │  - /.netlify/functions/accounts                    │ │
│  │  - /.netlify/functions/transactions                │ │
│  │  - /.netlify/functions/categories                  │ │
│  │  - /.netlify/functions/budgets                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓ Supabase JS Client
┌─────────────────────────────────────────────────────────┐
│                  DATABASE & AUTH LAYER                   │
│                  Supabase Cloud                          │
│                                                          │
│  Supabase PostgreSQL                                    │
│  - Tables: profiles, accounts, transactions, etc.       │
│  - Row Level Security (RLS)                             │
│  - Automatic triggers for calculations                  │
│                                                          │
│  Supabase Auth                                          │
│  - JWT token generation                                 │
│  - User management                                       │
│  - OAuth providers                                       │
└─────────────────────────────────────────────────────────┘

Mobile App (React Native + Expo) [Future]
    │
    ├─→ Frontend: Same Netlify Functions API
    └─→ Auth: Same Supabase Auth
```

---

## Cost Breakdown

### Development & Small Scale (2-3 users)

**Netlify Free Tier:** $0/month
- 100GB bandwidth/month
- 300 build minutes/month
- 125,000 function invocations/month
- 1 concurrent build
- Automatic SSL + CDN
- ✅ Enough for frontend + backend + functions

**Supabase Free Tier:** $0/month
- 500MB database storage
- 2GB bandwidth
- 50MB file storage
- Unlimited API requests
- Row Level Security
- Realtime subscriptions
- ✅ More than enough for 2-3 users

**Total: $0/month** 🎉

---

## Project Structure

```
budgetwise/
├── frontend/                    # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── netlify/
│   └── functions/              # Serverless backend functions
│       ├── auth.ts             # Authentication endpoints
│       ├── accounts.ts         # Accounts CRUD
│       ├── transactions.ts     # Transactions CRUD
│       ├── categories.ts       # Categories CRUD
│       └── budgets.ts          # Budgets CRUD
├── shared/                      # Shared code (types, utils)
│   ├── types/
│   └── utils/
├── mobile/                      # Future: React Native app
├── netlify.toml                # Netlify configuration
├── package.json
└── README.md
```

---

## Netlify Functions Basics

### Function Structure
```typescript
// netlify/functions/accounts.ts
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event, context) => {
  // Get Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Get user from JWT token
  const token = event.headers.authorization?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Handle different HTTP methods
  switch (event.httpMethod) {
    case 'GET':
      // Get all accounts for user
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

      return {
        statusCode: 200,
        body: JSON.stringify(data)
      };

    case 'POST':
      // Create new account
      const body = JSON.parse(event.body || '{}');
      // ... handle POST
      break;

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
  }
};
```

### Function Endpoints
- Functions are accessed at: `/.netlify/functions/{function-name}`
- Example: `https://budgetwisetracker.netlify.app/.netlify/functions/accounts`

---

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install:all

# Install Netlify CLI globally
npm install -g netlify-cli

# Development (runs both frontend + functions)
netlify dev

# This starts:
# - Frontend: http://localhost:8888
# - Functions: http://localhost:8888/.netlify/functions/*
```

### Testing Functions Locally
```bash
# Test a specific function
curl http://localhost:8888/.netlify/functions/accounts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Build & Deploy
```bash
# Build for production
pnpm run build

# Deploy (automatic via Git push, or manual)
netlify deploy --prod
```

---

## Configuration Files

### netlify.toml
```toml
[build]
  command = "cd frontend && pnpm run build"
  publish = "frontend/dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Environment Variables (Netlify Dashboard)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Comparison: NestJS vs Netlify Functions

### ❌ NestJS Server (Original Plan)
- Runs 24/7 on Render/Railway
- Needs separate deployment and monitoring
- Fixed cost even if no one is using it
- More complex setup
- Better for high-traffic apps

### ✅ Netlify Functions (New Plan)
- Runs only when called (event-driven)
- Single deployment platform with frontend
- Zero cost when not in use
- Simpler setup for small projects
- Perfect for 2-3 users
- Automatic scaling

**For your use case (2-3 users, personal project): Netlify Functions is the better choice!**

---

## Authentication Flow

### 1. User Registration/Login (Frontend → Supabase)
```typescript
// Frontend: Direct call to Supabase Auth
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Frontend stores the JWT token
const token = data.session.access_token;
```

### 2. API Calls (Frontend → Netlify Function → Supabase)
```typescript
// Frontend: Call Netlify function with JWT
const response = await fetch('/.netlify/functions/accounts', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Netlify Function: Validate JWT and query database
const { data: { user } } = await supabase.auth.getUser(token);
// Row Level Security automatically filters by user_id
```

---

## Migration Plan

Since you already have NestJS backend set up, here's how to transition:

### Option 1: Start Fresh with Netlify Functions
1. Create `netlify/functions/` directory
2. Write serverless functions using TypeScript
3. Remove `backend/` directory eventually
4. Simpler and cleaner for your use case

### Option 2: Keep NestJS Structure (Not Recommended)
1. Keep backend/ but deploy as Netlify Functions
2. More complex, not leveraging serverless benefits

**Recommendation: Option 1 - Start fresh with Netlify Functions**

---

## Next Steps

### 1. Set Up Netlify Functions Structure
```bash
mkdir -p netlify/functions
cd netlify/functions
```

### 2. Install Dependencies
```bash
# From root
pnpm add @netlify/functions @supabase/supabase-js
pnpm add -D @types/aws-lambda
```

### 3. Create First Function
Create `netlify/functions/hello.ts`:
```typescript
import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Netlify Functions!' })
  };
};
```

### 4. Test Locally
```bash
netlify dev
# Visit: http://localhost:8888/.netlify/functions/hello
```

### 5. Build API Functions
- Auth endpoints (signup, login, logout)
- Accounts CRUD
- Transactions CRUD
- Categories CRUD
- Budgets CRUD

### 6. Deploy to Netlify
```bash
# Connect to Netlify
netlify init

# Deploy
git push origin main  # Auto-deploys via Netlify Git integration
```

---

## Mobile App Strategy (Future)

### React Native will use the same Netlify Functions
- Mobile app → Netlify Functions → Supabase
- Same authentication (Supabase Auth)
- Same API endpoints
- Just different UI layer

---

## Resources

### Netlify Functions
- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Build Netlify Functions with TypeScript](https://docs.netlify.com/functions/build-with-typescript/)
- [Netlify Functions Examples](https://functions.netlify.com/examples/)

### Supabase
- [Supabase JS Client Docs](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Deployment
- [Deploy to Netlify](https://docs.netlify.com/get-started/)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)

---

## Summary

**Final Stack:**
```
Frontend:      React + Vite + Chakra UI
Backend:       Netlify Functions (Serverless)
Database:      Supabase PostgreSQL
Auth:          Supabase Auth
Deployment:    Netlify (Frontend + Backend)
Mobile:        React Native + Expo (future)
Cost:          $0/month
```

**Benefits:**
- ✅ Everything on one platform (Netlify)
- ✅ No separate backend server
- ✅ Scales automatically
- ✅ Free for your use case
- ✅ Simple deployment
- ✅ Perfect for 2-3 users
- ✅ Easy to add mobile app later

**Ready to start building?** Let me know if you want to:
1. Set up Netlify Functions structure
2. Create the first API endpoints
3. Configure Supabase connection
