-- Migration: Store the import signature on the transaction
-- Version: 010
-- Created: 2026-11-23
-- Description: Imports (Google Sheets polling, webhook, the Import page, the assistant) decide
--              whether a bank row was already imported by comparing `date|DESCRIPTION|amount`.
--              That used to be recomputed from the row's current values, so editing the amount
--              or the description made the next sync import the original bank row again.
--              The signature is now stored on the row and survives edits.
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- The app works without this migration (it falls back to the old behaviour), but edits of
-- imported transactions are only protected against re-import once it has been applied.

-- ============================================================================
-- STEP 1: Column
-- ============================================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS import_signature TEXT;

COMMENT ON COLUMN transactions.import_signature IS
  'The bank row this transaction answers for in import deduplication: date|UPPERCASED
   description|absolute amount with two decimals. Written at import, and stamped from the
   original values the first time an edit changes amount or description. Never rewritten
   afterwards. NULL for rows that were never imported or edited. Built by importSignature()
   in frontend/src/lib/importSignature.js.';

-- ============================================================================
-- STEP 2: Index
-- ============================================================================
-- Not unique on purpose: two identical purchases on the same day are two real rows.

CREATE INDEX IF NOT EXISTS idx_transactions_import_signature
ON transactions (user_id, import_signature)
WHERE import_signature IS NOT NULL;

-- ============================================================================
-- STEP 3: Backfill rows that came from a bank import
-- ============================================================================
-- Same normalisation as importSignature(): uppercase, trim, collapse whitespace; absolute
-- amount with two decimals; ISO date. Trashed rows are included, because a removed bank row
-- must keep blocking its re-import.
--
-- Only descriptions made of ASCII characters are backfilled. For those, Postgres upper() and
-- \s agree with JavaScript toUpperCase() and \s exactly; for other characters they can differ
-- (for example the German sharp s, or a non-breaking space). Rows left NULL here lose nothing:
-- they are still recognised by their current values, and the app stamps them with the exact
-- JavaScript signature the first time they are edited.

UPDATE transactions
SET import_signature =
  to_char(date, 'YYYY-MM-DD') || '|' ||
  btrim(regexp_replace(upper(coalesce(description, '')), '\s+', ' ', 'g'), ' ') || '|' ||
  to_char(abs(amount), 'FM9999999990.00')
WHERE provider IS NOT NULL
  AND import_signature IS NULL
  -- one byte per character = ASCII only
  AND octet_length(coalesce(description, '')) = char_length(coalesce(description, ''));

-- ============================================================================
-- STEP 4: Grants
-- ============================================================================
-- None needed. The Data API grants in 009_data_api_grants.sql are table-level, so they
-- already cover a new column on transactions: authenticated has SELECT, INSERT, UPDATE,
-- DELETE and service_role has SELECT, INSERT, which is all the webhook does with it.

-- Make PostgREST see the new column straight away.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'transactions' AND column_name = 'import_signature';
--
-- SELECT count(*) FILTER (WHERE import_signature IS NOT NULL) AS with_signature,
--        count(*) FILTER (WHERE provider IS NOT NULL AND import_signature IS NULL) AS imported_without
-- FROM transactions;
