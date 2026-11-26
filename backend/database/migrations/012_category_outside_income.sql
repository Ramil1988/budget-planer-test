-- Migration: Categories that are not paid from the recorded income
-- Version: 012
-- Created: 2026-11-26
-- Description: Some spending is recorded in the app while the money that pays for it is not:
--              a mortgage paid by a partner or from an account the app does not follow. The
--              Dashboard's money flow then showed it as paid from the salary, with the same
--              amount as a "shortfall". A category can now be marked as paid from other money;
--              the flow gives it a source of its own and leaves it out of the shortfall.
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- The app works without this migration: the flow treats every category as paid from income
-- and the control that marks a category is not shown.
--
-- No grant is needed: the grants of 009 are table-level (authenticated has SELECT, INSERT and
-- UPDATE on categories) and cover the new column. The "own_data" policy already limits the
-- update to the user's own categories.

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS outside_income BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN categories.outside_income IS
  'True when spending in this category is paid from money that is not recorded as income in
   the app. Only the Dashboard money flow reads it: such a category gets a source of its own
   ("Other money") and does not count towards the shortfall. Totals elsewhere are unchanged.';
