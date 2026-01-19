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

- [Architecture](docs/architecture.md)
- [System Overview](docs/system-overview.md)
- [Changelog](docs/changelog.md)
- [Project Status](docs/project-status.md)

## License

ISC
