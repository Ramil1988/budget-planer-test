# BudgetWise Backend

NestJS-based REST API for the BudgetWise budget tracking application.

## Technology Stack

- **Framework:** NestJS v11.1.10
- **Runtime:** Node.js with TypeScript
- **Architecture:** Modular, following NestJS conventions
- **Package Manager:** pnpm v10.24.0

## Getting Started

### Installation

```bash
pnpm install
```

### Development

Start the development server with hot reload:

```bash
pnpm run dev
```

The API will be available at `http://localhost:3000`

### Build

Build for production:

```bash
pnpm run build
```

### Running in Production

```bash
pnpm run start:prod
```

## API Endpoints

### Root
- `GET /` - Welcome message

### Health Check
- `GET /health` - Returns API health status and timestamp

## Project Structure

```
backend/
├── src/
│   ├── main.ts              # Application entry point
│   ├── app.module.ts        # Root application module
│   ├── app.controller.ts    # Root controller
│   └── app.service.ts       # Root service
├── dist/                    # Compiled JavaScript (generated)
├── tsconfig.json            # TypeScript configuration
├── tsconfig.build.json      # TypeScript build configuration
├── nest-cli.json            # NestJS CLI configuration
└── package.json
```

## Development Guidelines

### Creating a New Module

Use the NestJS CLI:

```bash
nest generate module <module-name>
nest generate controller <module-name>
nest generate service <module-name>
```

### CORS Configuration

CORS is enabled for the frontend development server:
- Origin: `http://localhost:5173`
- Credentials: enabled

Update `src/main.ts` to modify CORS settings for production.

## Available Scripts

- `pnpm run dev` - Start development server with watch mode
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run start:debug` - Start with debugger
- `pnpm run test` - Run unit tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Run tests with coverage
- `pnpm run test:e2e` - Run end-to-end tests

## Database Setup

### Step 1: Apply Schema (2 minutes)

1. Go to Supabase SQL Editor: https://app.supabase.com/project/bihqxglhrbanxejemohi/sql
2. Open `backend/database/schema.sql`
3. Copy all (Cmd+A, Cmd+C)
4. Paste in SQL editor (Cmd+V)
5. Click "Run"

### Step 2: Add Test Data (5 minutes)

Run these SQL queries one at a time in Supabase:

**Create account:**
```sql
INSERT INTO accounts (user_id, name, balance)
VALUES (auth.uid(), 'Checking Account', 5000.00);
```

**Create categories:**
```sql
INSERT INTO categories (user_id, name, type) VALUES
  (auth.uid(), 'Salary', 'income'),
  (auth.uid(), 'Mortgage', 'expense'),
  (auth.uid(), 'Food/Costco', 'expense'),
  (auth.uid(), 'Fuel', 'expense');
```

**Create budget:**
```sql
INSERT INTO budgets (user_id, month, total)
VALUES (auth.uid(), '2025-12-01', 6000.00);
```

**Set limits:**
```sql
INSERT INTO budget_categories (budget_id, category_id, limit_amount)
SELECT b.id, c.id, CASE c.name
  WHEN 'Mortgage' THEN 1500
  WHEN 'Food/Costco' THEN 800
  WHEN 'Fuel' THEN 300
END
FROM budgets b, categories c
WHERE b.user_id = auth.uid() AND c.user_id = auth.uid() AND c.type = 'expense';
```

**Add transactions:**
```sql
INSERT INTO transactions (user_id, account_id, category_id, type, amount, provider, description, date)
SELECT auth.uid(), a.id, c.id, 'income', 5000, 'Employer', 'Salary', '2025-12-01'
FROM accounts a, categories c WHERE a.user_id = auth.uid() AND c.name = 'Salary';

INSERT INTO transactions (user_id, account_id, category_id, type, amount, provider, description, date)
SELECT auth.uid(), a.id, c.id, 'expense', 1500, 'Bank', 'Mortgage', '2025-12-01'
FROM accounts a, categories c WHERE a.user_id = auth.uid() AND c.name = 'Mortgage';
```

### Step 3: View Data

**Transaction log:**
```sql
SELECT date, amount, provider, description, balance
FROM transactions WHERE user_id = auth.uid() ORDER BY date DESC;
```

**Budget summary:**
```sql
SELECT c.name, bc.spent, bc.limit_amount, (bc.limit_amount - bc.spent) AS remaining
FROM budget_categories bc JOIN categories c ON c.id = bc.category_id
WHERE bc.budget_id IN (SELECT id FROM budgets WHERE user_id = auth.uid());
```

## Next Steps

- Build API endpoints for transactions and budgets
- Connect React frontend
- Add authentication
