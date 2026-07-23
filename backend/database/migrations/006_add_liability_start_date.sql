-- Migration: Add start_date to liabilities
-- Purpose: Payments shown for a liability are pulled from its linked category.
-- Without a start date, a newly created liability shows payment history that
-- belongs to a previous liability using the same category (e.g. an old mortgage).

ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS start_date DATE;

-- Backfill existing rows with their creation date
UPDATE liabilities SET start_date = created_at::date WHERE start_date IS NULL;
