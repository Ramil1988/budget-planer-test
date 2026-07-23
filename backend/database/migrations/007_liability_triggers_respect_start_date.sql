-- Migration: Liability auto-reduce triggers respect start_date
-- Purpose: The triggers from 005 matched any transaction in the linked category,
-- so a payment belonging to a previous liability (same category, e.g. an old
-- mortgage) reduced the balance of the current one. Now a transaction only
-- affects the liability that had already started on the transaction date; when
-- several match, the most recently started one wins.

CREATE OR REPLACE FUNCTION update_liability_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  liability_record RECORD;
BEGIN
  IF NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    SELECT * INTO liability_record
    FROM liabilities
    WHERE user_id = NEW.user_id
      AND linked_category_id = NEW.category_id
      AND (start_date IS NULL OR start_date <= NEW.date)
    ORDER BY start_date DESC NULLS LAST
    LIMIT 1;

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

CREATE OR REPLACE FUNCTION reverse_liability_on_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
  liability_record RECORD;
BEGIN
  IF OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    SELECT * INTO liability_record
    FROM liabilities
    WHERE user_id = OLD.user_id
      AND linked_category_id = OLD.category_id
      AND (start_date IS NULL OR start_date <= OLD.date)
    ORDER BY start_date DESC NULLS LAST
    LIMIT 1;

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
      AND (start_date IS NULL OR start_date <= OLD.date)
    ORDER BY start_date DESC NULLS LAST
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
      AND (start_date IS NULL OR start_date <= NEW.date)
    ORDER BY start_date DESC NULLS LAST
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
