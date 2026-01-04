-- BudgetWise - Simple Install
-- Copy and paste this ENTIRE file into Supabase SQL editor and run once

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12, 2) NOT NULL,
  provider TEXT,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  balance DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  limit_amount DECIMAL(12, 2) NOT NULL,
  spent DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(budget_id, category_id)
);

-- Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_data" ON accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON budget_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM budgets WHERE budgets.id = budget_categories.budget_id AND budgets.user_id = auth.uid())
);

-- Functions (only if they don't exist)
CREATE OR REPLACE FUNCTION update_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE accounts
  SET balance = balance + CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END
  WHERE id = NEW.account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calc_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  prev_balance DECIMAL(12, 2);
BEGIN
  SELECT balance INTO prev_balance
  FROM transactions
  WHERE account_id = NEW.account_id AND date < NEW.date
  ORDER BY date DESC, created_at DESC LIMIT 1;

  IF prev_balance IS NULL THEN
    SELECT balance INTO prev_balance FROM accounts WHERE id = NEW.account_id;
    prev_balance := prev_balance - CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
  END IF;

  NEW.balance := prev_balance + CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'expense' THEN
    UPDATE budget_categories SET spent = spent + NEW.amount
    WHERE category_id = NEW.category_id
    AND budget_id IN (SELECT id FROM budgets WHERE user_id = NEW.user_id AND month = date_trunc('month', NEW.date)::date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (drop first if they exist, then create)
DROP TRIGGER IF EXISTS auto_update_balance ON transactions;
CREATE TRIGGER auto_update_balance
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION update_balance();

DROP TRIGGER IF EXISTS auto_calc_balance ON transactions;
CREATE TRIGGER auto_calc_balance
BEFORE INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION calc_running_balance();

DROP TRIGGER IF EXISTS auto_update_spent ON transactions;
CREATE TRIGGER auto_update_spent
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION update_spent();

-- Done! You now have 6 tables with automatic calculations
