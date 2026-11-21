# BudgetWise

Personal budget tracking app with transaction management, budget planning, and financial reports.

**Live:** https://budgetwisetracker.netlify.app

## Features

- **Dashboard** - Overview of accounts, balances, and recent activity
- **Transactions** - Add, edit, delete, and filter transactions
- **Import** - Bulk import transactions from CSV
- **Budget** - Set monthly spending limits by category, track progress
- **Reports** - Visual spending breakdown and trends
- **Categories** - Custom income and expense categories
- **Settings** - Account preferences and user settings

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Chakra UI |
| Backend | Netlify Functions (Serverless) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Netlify |

## Development

**Requirements:** Node.js 18+, pnpm

```bash
# Install dependencies
pnpm install:all

# Start dev server (frontend + functions)
netlify dev

# Build for production
pnpm run build:frontend

# Deploy
netlify deploy --prod
```

## Budget assistant

Open **Budget assistant** after signing in. The assistant can look up transactions, spending summaries, accounts, categories, budgets, recurring schedules, assets, and liabilities. It can add requested transactions, accounts, categories, and recurring schedules. Conversation history stays in the open browser session. Attach a CSV or a PNG, JPEG, or WebP screenshot to prepare a transaction import. Review the suggested accounts and categories, select the rows, and choose **Import**. The assistant checks for duplicates before saving. Transactions also has **Download CSV** for the current filters. Questions about bills before payday use the Upcoming Payments calendar to find the next salary and total the scheduled expenses.

Set these environment variables for Netlify Functions, or pass them to `netlify dev` in the local server environment.

- `OPENAI_API_KEY` is the OpenAI project secret key. Keep it server-side.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are the existing project URL and public key. The function also accepts their `VITE_` equivalents when available at runtime.
- `OPENAI_ASSISTANT_MODEL` optionally overrides `gpt-5-mini`.
- `BUDGET_ASSISTANT_READ_ONLY=true` optionally limits the assistant to lookups and conversation.

## Project Structure

```
├── frontend/          # React app
│   └── src/
│       ├── pages/     # Route components
│       ├── components/# Reusable UI
│       ├── contexts/  # Auth, state
│       └── lib/       # Supabase client
├── netlify/
│   └── functions/     # Serverless API
├── backend/
│   └── database/      # SQL schema
└── docs/              # Documentation
```

## Documentation

- [For Ramil](FOR_RAMIL.md) - plain-language walkthrough: how it works, why, and what broke along the way
- [Architecture](docs/architecture.md)
- [System Overview](docs/system-overview.md)
- [Changelog](docs/changelog.md)
- [Project Status](docs/project-status.md)

## License

ISC
