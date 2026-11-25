-- Migration: A payment on a debt pays its interest first
-- Created: 2026-11-24
--
-- Until now a transaction in a liability's linked category brought the balance down by
-- its whole amount (005, 007). A mortgage payment of 2,720.26 on 539,700.00 at 3.59% is
-- about 1,600 of interest and 1,100 of debt, so the stored balance fell about 1,600 too
-- fast every month, and net worth rose by the same amount.
--
-- From here on the balance is not adjusted by each transaction; it is worked out again
-- from a fixed point every time a payment is added, changed, trashed, restored or deleted:
--
--   * the fixed point (the anchor) is a balance that is known to be true on a date:
--     the one typed in when the liability is created or edited;
--   * every payment after the anchor first covers the interest for the days since the
--     previous payment (balance x yearly rate x days / 365), and only the rest of it
--     brings the balance down;
--   * a trashed transaction does not count, and restoring it makes it count again.
--     (Before, trashing a payment left the balance where it was.)
--
-- A liability with no interest rate behaves as before: the whole payment comes off.
-- Which liability a payment belongs to is unchanged from 007: the one linked to the
-- transaction's category that had already started on the transaction's date, the most
-- recently started one when there are several.
--
-- The interest is simple daily interest. A lender's own schedule differs a little (a
-- Canadian fixed mortgage compounds twice a year), so the balance is an estimate that
-- stays close; typing the lender's figure into the liability sets a new anchor.
--
-- Needs no grants: it adds no table, and the triggers read and write only tables the
-- roles that write transactions can already reach (see 009). Safe to re-run.

-- ============================================================================
-- STEP 1: The anchor
-- ============================================================================

ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS balance_anchor DECIMAL(12, 2);
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS balance_anchor_date DATE;
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS balance_anchor_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- STEP 2: Which liability a payment belongs to, and its balance worked out again
-- ============================================================================

CREATE OR REPLACE FUNCTION liability_for_payment(p_user_id UUID, p_category_id UUID, p_date DATE)
RETURNS UUID AS $$
  SELECT id
  FROM liabilities
  WHERE user_id = p_user_id
    AND linked_category_id = p_category_id
    AND (start_date IS NULL OR start_date <= p_date)
  ORDER BY start_date DESC NULLS LAST, created_at DESC, id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION recalculate_liability_balance(p_liability_id UUID)
RETURNS VOID AS $$
DECLARE
  liability RECORD;
  payment RECORD;
  balance NUMERIC;
  paid_to DATE;
  daily_rate NUMERIC;
BEGIN
  SELECT * INTO liability FROM liabilities WHERE id = p_liability_id;
  IF NOT FOUND OR liability.linked_category_id IS NULL OR liability.balance_anchor IS NULL THEN
    RETURN;
  END IF;

  balance := liability.balance_anchor;
  paid_to := liability.balance_anchor_date;
  daily_rate := COALESCE(liability.interest_rate, 0) / 100.0 / 365.0;

  FOR payment IN
    SELECT t.date, t.amount
    FROM transactions t
    WHERE t.user_id = liability.user_id
      AND t.category_id = liability.linked_category_id
      AND t.type = 'expense'
      AND t.deleted_at IS NULL
      -- After the anchor: a later date, or the same date but recorded after the balance was typed.
      AND (t.date > liability.balance_anchor_date
           OR (t.date = liability.balance_anchor_date AND t.created_at > liability.balance_anchor_at))
      AND liability_for_payment(t.user_id, t.category_id, t.date) = liability.id
    ORDER BY t.date, t.created_at
  LOOP
    -- Interest for the days since the last payment, then the payment.
    balance := balance * (1 + daily_rate * GREATEST(payment.date - paid_to, 0)) - payment.amount;
    balance := GREATEST(balance, 0);
    paid_to := GREATEST(paid_to, payment.date);
  END LOOP;

  UPDATE liabilities
  SET outstanding_balance = ROUND(balance, 2),
      updated_at = NOW()
  WHERE id = liability.id
    AND outstanding_balance IS DISTINCT FROM ROUND(balance, 2);
END;
$$ LANGUAGE plpgsql;

-- Called from the transaction triggers as whichever role wrote the transaction.
REVOKE EXECUTE ON FUNCTION liability_for_payment(UUID, UUID, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION recalculate_liability_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION liability_for_payment(UUID, UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION recalculate_liability_balance(UUID) TO authenticated, service_role;

-- ============================================================================
-- STEP 3: Existing liabilities get their anchor
-- ============================================================================
-- Where the old arithmetic can be checked (the balance at the start, less every payment
-- since, is exactly the stored balance), the anchor is the balance at the start and the
-- balance is worked out again with interest: this corrects what has drifted so far.
-- Everywhere else the stored balance is taken as true today.

DO $$
DECLARE
  liability RECORD;
  paid NUMERIC;
  corrected NUMERIC;
BEGIN
  FOR liability IN SELECT * FROM liabilities WHERE balance_anchor IS NULL LOOP
    paid := NULL;
    IF liability.linked_category_id IS NOT NULL
       AND liability.start_date IS NOT NULL
       AND COALESCE(liability.interest_rate, 0) > 0
       AND liability.original_balance > liability.outstanding_balance THEN
      -- The old triggers counted trashed payments too.
      SELECT COALESCE(SUM(t.amount), 0) INTO paid
      FROM transactions t
      WHERE t.user_id = liability.user_id
        AND t.category_id = liability.linked_category_id
        AND t.type = 'expense'
        AND t.date >= liability.start_date
        AND liability_for_payment(t.user_id, t.category_id, t.date) = liability.id;
    END IF;

    IF paid IS NOT NULL AND ABS(liability.original_balance - liability.outstanding_balance - paid) <= 0.01 THEN
      UPDATE liabilities
      SET balance_anchor = original_balance,
          balance_anchor_date = start_date,
          balance_anchor_at = '-infinity'
      WHERE id = liability.id;
      PERFORM recalculate_liability_balance(liability.id);
      SELECT outstanding_balance INTO corrected FROM liabilities WHERE id = liability.id;
      RAISE NOTICE 'Liability "%": balance corrected from % to % (% of payments since %, less interest)',
        liability.creditor, liability.outstanding_balance, corrected, paid, liability.start_date;
    ELSE
      UPDATE liabilities
      SET balance_anchor = outstanding_balance,
          balance_anchor_date = CURRENT_DATE,
          balance_anchor_at = NOW()
      WHERE id = liability.id;
      RAISE NOTICE 'Liability "%": balance % kept as it is; interest applies to payments from now on',
        liability.creditor, liability.outstanding_balance;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 4: A balance typed in is a new anchor
-- ============================================================================
-- Creating a liability, or editing its balance, link, start date or rate by hand, fixes
-- the balance as true at that moment. The update made by recalculate_liability_balance()
-- from inside a transaction trigger is one level deeper and is left alone.

CREATE OR REPLACE FUNCTION anchor_liability_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (pg_trigger_depth() = 1 AND (
           NEW.outstanding_balance IS DISTINCT FROM OLD.outstanding_balance
           OR NEW.linked_category_id IS DISTINCT FROM OLD.linked_category_id
           OR NEW.start_date IS DISTINCT FROM OLD.start_date
           OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate)) THEN
    NEW.balance_anchor := NEW.outstanding_balance;
    NEW.balance_anchor_date := CURRENT_DATE;
    NEW.balance_anchor_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS liability_balance_anchor ON liabilities;
CREATE TRIGGER liability_balance_anchor
  BEFORE INSERT OR UPDATE ON liabilities
  FOR EACH ROW
  EXECUTE FUNCTION anchor_liability_balance();

-- ============================================================================
-- STEP 5: Transactions work the balance out again instead of adjusting it
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_liabilities_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  old_liability UUID;
  new_liability UUID;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    old_liability := liability_for_payment(OLD.user_id, OLD.category_id, OLD.date);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    new_liability := liability_for_payment(NEW.user_id, NEW.category_id, NEW.date);
  END IF;

  IF old_liability IS NOT NULL THEN
    PERFORM recalculate_liability_balance(old_liability);
  END IF;
  IF new_liability IS NOT NULL AND new_liability IS DISTINCT FROM old_liability THEN
    PERFORM recalculate_liability_balance(new_liability);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS liability_update_on_transaction_insert ON transactions;
DROP TRIGGER IF EXISTS liability_update_on_transaction_delete ON transactions;
DROP TRIGGER IF EXISTS liability_update_on_transaction_update ON transactions;

CREATE TRIGGER liability_update_on_transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_liabilities_on_transaction();

CREATE TRIGGER liability_update_on_transaction_delete
  AFTER DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_liabilities_on_transaction();

CREATE TRIGGER liability_update_on_transaction_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount
        OR OLD.category_id IS DISTINCT FROM NEW.category_id
        OR OLD.date IS DISTINCT FROM NEW.date
        OR OLD.type IS DISTINCT FROM NEW.type
        OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION recalculate_liabilities_on_transaction();

-- The functions the old triggers used.
DROP FUNCTION IF EXISTS update_liability_on_transaction();
DROP FUNCTION IF EXISTS reverse_liability_on_transaction_delete();
DROP FUNCTION IF EXISTS update_liability_on_transaction_update();
