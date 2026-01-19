-- Migration: Add business_days_only column to recurring_payments table
-- Run this in Supabase SQL editor

-- Add the column (default false for existing payments)
ALTER TABLE recurring_payments
ADD COLUMN IF NOT EXISTS business_days_only BOOLEAN DEFAULT false;

-- Add a comment explaining the column
COMMENT ON COLUMN recurring_payments.business_days_only IS
'When true, payment dates falling on weekends are adjusted to the nearest business day (Saturday -> Friday, Sunday -> Monday)';
