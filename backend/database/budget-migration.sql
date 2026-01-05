-- Budget Tables Migration
-- Run this in Supabase SQL Editor to set up or update budget tables

-- Step 1: Add unique constraint on budgets table to prevent duplicate months
-- First, drop any existing constraint if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_user_month_unique'
  ) THEN
    ALTER TABLE budgets ADD CONSTRAINT budgets_user_month_unique UNIQUE (user_id, month);
  END IF;
END $$;

-- Step 2: Create a function to get budget summary with calculated spent amounts
-- This calculates spent from actual transactions (more reliable than trigger-based tracking)
CREATE OR REPLACE FUNCTION get_budget_summary(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  limit_amount DECIMAL(12, 2),
  spent DECIMAL(12, 2),
  remaining DECIMAL(12, 2),
  percent_spent DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  WITH month_transactions AS (
    SELECT
      t.category_id,
      COALESCE(SUM(t.amount), 0) as total_spent
    FROM transactions t
    WHERE t.user_id = p_user_id
      AND t.type = 'expense'
      AND date_trunc('month', t.date) = date_trunc('month', p_month)
    GROUP BY t.category_id
  )
  SELECT
    c.id as category_id,
    c.name as category_name,
    COALESCE(bc.limit_amount, 0) as limit_amount,
    COALESCE(mt.total_spent, 0) as spent,
    COALESCE(bc.limit_amount, 0) - COALESCE(mt.total_spent, 0) as remaining,
    CASE
      WHEN COALESCE(bc.limit_amount, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(mt.total_spent, 0) / bc.limit_amount) * 100, 2)
    END as percent_spent
  FROM categories c
  LEFT JOIN budgets b ON b.user_id = p_user_id AND date_trunc('month', b.month) = date_trunc('month', p_month)
  LEFT JOIN budget_categories bc ON bc.budget_id = b.id AND bc.category_id = c.id
  LEFT JOIN month_transactions mt ON mt.category_id = c.id
  WHERE c.user_id = p_user_id AND c.type = 'expense'
  ORDER BY COALESCE(mt.total_spent, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_budget_summary(UUID, DATE) TO authenticated;

-- Step 4: Create or replace function to upsert budget with categories
CREATE OR REPLACE FUNCTION upsert_budget(
  p_user_id UUID,
  p_month DATE,
  p_total DECIMAL(12, 2),
  p_categories JSONB -- Array of {category_id, limit_amount}
)
RETURNS UUID AS $$
DECLARE
  v_budget_id UUID;
  v_category JSONB;
BEGIN
  -- Insert or update budget
  INSERT INTO budgets (user_id, month, total)
  VALUES (p_user_id, date_trunc('month', p_month)::date, p_total)
  ON CONFLICT (user_id, month)
  DO UPDATE SET total = p_total
  RETURNING id INTO v_budget_id;

  -- Delete existing budget categories for this budget
  DELETE FROM budget_categories WHERE budget_id = v_budget_id;

  -- Insert new budget categories
  FOR v_category IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    INSERT INTO budget_categories (budget_id, category_id, limit_amount)
    VALUES (
      v_budget_id,
      (v_category->>'category_id')::UUID,
      (v_category->>'limit_amount')::DECIMAL(12, 2)
    );
  END LOOP;

  RETURN v_budget_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_budget(UUID, DATE, DECIMAL, JSONB) TO authenticated;

-- Done! You now have:
-- 1. Unique constraint on (user_id, month) to prevent duplicate budgets
-- 2. get_budget_summary() function to get budget vs actual spending
-- 3. upsert_budget() function to create/update budgets with category limits
