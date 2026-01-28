-- Migration: Add last_business_day_of_month column to recurring_payments
-- This allows payments to be scheduled on the last business day of each month
-- instead of a fixed day that may not exist (e.g., day 31 in February)

-- Add the column with default false
ALTER TABLE recurring_payments
ADD COLUMN IF NOT EXISTS last_business_day_of_month BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN recurring_payments.last_business_day_of_month IS
  'When true, payment is scheduled on the last business day of each month (Mon-Fri), ignoring the day portion of start_date. Useful for end-of-month payments like salary.';
