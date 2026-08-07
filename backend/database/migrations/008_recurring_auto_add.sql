-- Migration: Auto-add recurring payments to transactions
-- Created: 2026-08-07
-- Description: Lets a recurring payment create its transaction automatically when the
--              due date arrives, instead of the user adding it by hand.
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: New columns on recurring_payments
-- ============================================================================

ALTER TABLE recurring_payments
ADD COLUMN IF NOT EXISTS auto_add BOOLEAN DEFAULT false;

ALTER TABLE recurring_payments
ADD COLUMN IF NOT EXISTS auto_add_from DATE;

ALTER TABLE recurring_payments
ADD COLUMN IF NOT EXISTS match_description TEXT;

COMMENT ON COLUMN recurring_payments.auto_add IS
  'When true, a transaction is created automatically for every occurrence that is due.';

COMMENT ON COLUMN recurring_payments.auto_add_from IS
  'Date auto-add was switched on. Occurrences before it are never generated, so enabling
   the option on an old recurring does not backfill months of history.';

COMMENT ON COLUMN recurring_payments.match_description IS
  'How this payment shows up on the bank statement. Used to recognise the imported row as
   the same payment, so auto-add and the Google Sheets import do not both record it.';

-- ============================================================================
-- STEP 2: Link generated transactions back to their recurring payment
-- ============================================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS recurring_payment_id UUID REFERENCES recurring_payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN transactions.recurring_payment_id IS
  'Set when the transaction was generated from a recurring payment. NULL for manual and imported rows.';

-- One transaction per recurring payment per date. NULLs are distinct in Postgres, so
-- manual/imported rows are unaffected. This is what makes generation idempotent: opening
-- the app twice, or on two devices, cannot create the same occurrence twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_occurrence
ON transactions (recurring_payment_id, date);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'recurring_payments' AND column_name IN ('auto_add', 'auto_add_from', 'match_description');
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_transactions_recurring_occurrence';
