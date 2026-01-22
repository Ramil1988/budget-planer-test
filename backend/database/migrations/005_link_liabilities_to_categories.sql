-- Migration: Link Liabilities to Spending Categories
-- Created: 2026-01-21
-- Description: Adds ability to link liabilities to spending categories for automatic balance tracking

-- Add linked_category_id column to liabilities table
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS linked_category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add original_balance column if not exists (for tracking payment progress)
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS original_balance DECIMAL(12, 2);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_liabilities_linked_category_id ON liabilities(linked_category_id);

-- Function to update liability balance when a linked category transaction is created
CREATE OR REPLACE FUNCTION update_liability_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  liability_record RECORD;
BEGIN
  -- Only process expense transactions
  IF NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    -- Find any liability linked to this category for this user
    SELECT * INTO liability_record
    FROM liabilities
    WHERE user_id = NEW.user_id
      AND linked_category_id = NEW.category_id
    LIMIT 1;

    -- If a linked liability exists, reduce its balance
    IF FOUND THEN
      UPDATE liabilities
      SET outstanding_balance = GREATEST(0, outstanding_balance - NEW.amount),
          updated_at = NOW()
      WHERE id = liability_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to reverse liability update when a linked category transaction is deleted
CREATE OR REPLACE FUNCTION reverse_liability_on_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
  liability_record RECORD;
BEGIN
  -- Only process expense transactions
  IF OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    -- Find any liability linked to this category for this user
    SELECT * INTO liability_record
    FROM liabilities
    WHERE user_id = OLD.user_id
      AND linked_category_id = OLD.category_id
    LIMIT 1;

    -- If a linked liability exists, restore the amount
    IF FOUND THEN
      UPDATE liabilities
      SET outstanding_balance = outstanding_balance + OLD.amount,
          updated_at = NOW()
      WHERE id = liability_record.id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function to handle transaction updates (amount or category changes)
CREATE OR REPLACE FUNCTION update_liability_on_transaction_update()
RETURNS TRIGGER AS $$
DECLARE
  old_liability_record RECORD;
  new_liability_record RECORD;
BEGIN
  -- Handle old category (reverse the old amount if it was linked)
  IF OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    SELECT * INTO old_liability_record
    FROM liabilities
    WHERE user_id = OLD.user_id
      AND linked_category_id = OLD.category_id
    LIMIT 1;

    IF FOUND THEN
      UPDATE liabilities
      SET outstanding_balance = outstanding_balance + OLD.amount,
          updated_at = NOW()
      WHERE id = old_liability_record.id;
    END IF;
  END IF;

  -- Handle new category (apply the new amount if it's linked)
  IF NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    SELECT * INTO new_liability_record
    FROM liabilities
    WHERE user_id = NEW.user_id
      AND linked_category_id = NEW.category_id
    LIMIT 1;

    IF FOUND THEN
      UPDATE liabilities
      SET outstanding_balance = GREATEST(0, outstanding_balance - NEW.amount),
          updated_at = NOW()
      WHERE id = new_liability_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS liability_update_on_transaction_insert ON transactions;
DROP TRIGGER IF EXISTS liability_update_on_transaction_delete ON transactions;
DROP TRIGGER IF EXISTS liability_update_on_transaction_update ON transactions;

-- Create triggers
CREATE TRIGGER liability_update_on_transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_liability_on_transaction();

CREATE TRIGGER liability_update_on_transaction_delete
  AFTER DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION reverse_liability_on_transaction_delete();

CREATE TRIGGER liability_update_on_transaction_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.category_id IS DISTINCT FROM NEW.category_id)
  EXECUTE FUNCTION update_liability_on_transaction_update();

-- Done! Liabilities can now be linked to spending categories
-- When transactions are made with a linked category, the liability balance auto-updates
